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
 *    It is now read from a
 *    build-time env var and, if unset, the shared-password gate is disabled
 *    entirely rather than falling back to a guessable default.
 *
 * The password gate exists for a narrow UX reason: the shop floor shares one
 * tablet, and we don't want a worker who opens the app to be one tap away from
 * cutting stock. Real authorization stays with Firebase Auth + Firestore Rules.
 */

const MODE_STORAGE_KEY = 'siampuufoam_user_mode';

/**
 * Emails allowed to unlock editor mode. Kept in sync with `isStaff()` in
 * firestore.rules — the rules are authoritative; this list only controls the UI.
 */
const STAFF_EMAILS = ['ikuyisad@ikwai.com'];

/**
 * Shared operator password, supplied at build time via VITE_OPERATOR_PASSWORD.
 * Empty string means "no shared password configured" — see note 2 above.
 */
const OPERATOR_PASSWORD = (import.meta.env?.VITE_OPERATOR_PASSWORD as string | undefined) ?? '';

/** True when a build-time shared password was provided. */
export function hasOperatorPassword(): boolean {
  return OPERATOR_PASSWORD.length > 0;
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
 * Returns false when no password is configured — callers must then fall back to
 * the Firebase Auth staff-email check (see `isStaffEmail`) rather than treating
 * an empty config as "everyone passes".
 */
export function verifyPassword(password: string): boolean {
  if (!password) return false;
  if (!OPERATOR_PASSWORD) return false;
  return password.trim() === OPERATOR_PASSWORD;
}

/**
 * Helper to check if current user is in editor mode
 */
export function isEditorMode(): boolean {
  return activeUserMode === 'editor';
}