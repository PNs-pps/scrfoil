/**
 * Authentication and User Mode Management
 * Modes:
 * - 'visitor': Read-only visitor mode (cannot add/cut/delete/reset data)
 * - 'editor': Data entry operator mode (full permissions)
 *
 * Requirement: Every time the app or website is opened, it MUST always start in 'visitor' mode.
 *
 * SECURITY MODEL — read this before changing anything here.
 *
 * This file is client-side code, so it is shipped to the browser in plaintext.
 * That has two consequences:
 *
 * 1. Nothing in this file is a security boundary. Firestore Rules are the real
 *    boundary — see `firestore.rules`, which denies everything unless
 *    `request.auth.token.email` is on the staff list. Even a perfect editor-mode
 *    lock here cannot stop someone from writing directly to Firestore.
 *
 * 2. Therefore the shared operator password must NOT live in source. It used to
 *    be a hardcoded string literal, which leaked to anyone with the bundle, the
 *    git history, or this file. (The old value has been removed rather than
 *    quoted here — a comment is still source, and it was a live credential.)
 *    It is now supplied at build time and, if neither build var is set, editor
 *    mode is unreachable rather than falling back to a guessable default.
 *
 * The password gate exists for a narrow UX reason: the shop floor shares one
 * tablet, and we don't want a worker who opens the app to be one tap away from
 * cutting stock. Real authorization stays with Firebase Auth + Firestore Rules.
 *
 * BUILD CONFIGURATION — both are optional, `VITE_OPERATOR_PASSWORD_HASH` wins:
 *   VITE_OPERATOR_PASSWORD_HASH  SHA-256 hex of the password. Preferred: the
 *                                plaintext never enters the bundle. Produced by
 *                                `npm run hash-password -- "<password>"`.
 *   VITE_OPERATOR_PASSWORD      Plaintext. Only for local `npm run dev`.
 * On GitHub Pages both come from repository secrets of the same name (see
 * DEPLOY_TO_GITHUB.md). If neither is present the build is READ-ONLY and says so.
 */

const MODE_STORAGE_KEY = 'siampuufoam_user_mode';

/**
 * Emails allowed to unlock editor mode. Kept in sync with `isStaff()` in
 * firestore.rules — the rules are authoritative; this list only controls the UI.
 */
const STAFF_EMAILS = ['ikuyisad@ikwai.com'];

/**
 * Shared operator password, supplied at build time.
 * `VITE_OPERATOR_PASSWORD_HASH` (SHA-256 hex) is preferred because the plaintext
 * then never exists inside the published bundle. `VITE_OPERATOR_PASSWORD` is the
 * plaintext fallback, used for local dev.
 */
const OPERATOR_PASSWORD = (import.meta.env?.VITE_OPERATOR_PASSWORD as string | undefined) ?? '';
const OPERATOR_PASSWORD_HASH = ((import.meta.env?.VITE_OPERATOR_PASSWORD_HASH as string | undefined) ?? '').trim().toLowerCase();

/** True when a build-time shared password was provided. */
export function hasOperatorPassword(): boolean {
  return OPERATOR_PASSWORD_HASH.length > 0 || OPERATOR_PASSWORD.length > 0;
}

/** SHA-256 hex of a UTF-8 string. Used to compare against the hash build var. */
async function sha256Hex(text: string): Promise<string> {
  // WebCrypto is only exposed in a secure context (https, or localhost). Opening
  // the site over a plain-http LAN address would otherwise fail with an opaque
  // TypeError, so surface an explanation instead.
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('insecure-context');
  }
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Check whether an authenticated email belongs to staff.
 * Mirrors `isStaff()` in firestore.rules (which lowercases before comparing).
 */
export function isStaffEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return STAFF_EMAILS.includes(email.trim().toLowerCase());
}

/** Exposed so Settings can show which staff list this build was compiled with. */
export function getStaffEmails(): string[] {
  return [...STAFF_EMAILS];
}

export type UserMode = 'visitor' | 'editor';

// In-memory session mode: ALWAYS initialized to 'visitor' on app/web load
let activeUserMode: UserMode = 'visitor';

/**
 * Retrieve current user mode.
 * Always defaults to 'visitor' on open/reload.
 */
export function getUserMode(): UserMode {
  return activeUserMode;
}

/**
 * Save user mode for active session
 */
export function setUserMode(mode: UserMode): void {
  activeUserMode = mode;
  try {
    sessionStorage.setItem(MODE_STORAGE_KEY, mode);
  } catch (err) {
    console.warn('Storage write error:', err);
  }
}

/**
 * Reset to visitor mode (e.g. on logout or app load)
 */
export function resetToVisitorMode(): void {
  activeUserMode = 'visitor';
  try {
    sessionStorage.removeItem(MODE_STORAGE_KEY);
    localStorage.removeItem(MODE_STORAGE_KEY);
  } catch (err) {
    console.warn('Storage clean error:', err);
  }
}

/**
 * Check the input against the shared operator password.
 *
 * Async because the hashed build config needs SHA-256, which is only available
 * through WebCrypto. Returns false when no password is configured — callers must
 * then refuse the action rather than treating an empty config as "everyone
 * passes" (see `requireEditorPermission` in App.tsx).
 */
export async function verifyPassword(password: string): Promise<boolean> {
  const input = password.trim();
  if (!input) return false;

  if (OPERATOR_PASSWORD_HASH) {
    return (await sha256Hex(input)) === OPERATOR_PASSWORD_HASH;
  }

  if (!OPERATOR_PASSWORD) return false;
  return input === OPERATOR_PASSWORD.trim();
}

/**
 * Helper to check if current user is in editor mode
 */
export function isEditorMode(): boolean {
  return activeUserMode === 'editor';
}