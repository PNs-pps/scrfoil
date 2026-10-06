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
 * This file is client-side code, so it ships to the browser in plaintext, and
 * so does the operator password. That is a deliberate, accepted trade-off:
 * the operator wanted the gate usable without a CI secret to configure.
 * Anyone who opens the app can read it out of the bundle.
 *
 * What this gate actually buys you is therefore narrow: it stops the next
 * person to pick up the shared shop-floor tablet from being one tap away from
 * cutting stock. It is NOT a security boundary. `firestore.rules` is the real
 * boundary — it denies everything unless `request.auth.token.email` is on the
 * staff list, and it is enforced by Google, not by this file. Anyone with the
 * bundle can bypass this prompt entirely and still be stopped by the rules.
 *
 * To change the password without editing source: set VITE_OPERATOR_PASSWORD
 * in .env.local (local) or as a build-time env var (CI), then rebuild.
 * If unset, falls back to the hardcoded default below.
 */

const MODE_STORAGE_KEY = 'siampuufoam_user_mode';

const DEFAULT_STAFF_EMAILS = ['ikuyisad@ikwai.com'];

/**
 * Shared operator password.
 * Prefer VITE_OPERATOR_PASSWORD (build-time) so the value can be changed
 * without editing source. Falls back to the hardcoded default when unset.
 * Still plaintext in the published bundle by design — see security note above.
 */
const OPERATOR_PASSWORD =
  (typeof import.meta !== 'undefined' &&
    (import.meta.env?.VITE_OPERATOR_PASSWORD as string | undefined)?.trim()) ||
  'Scrromklao';

/** True when an operator password is present. */
export function hasOperatorPassword(): boolean {
  return OPERATOR_PASSWORD.trim().length > 0;
}

/** Exposed so Settings can show which staff list this build was compiled with. */
export function getStaffEmails(): string[] {
  try {
    const saved = localStorage.getItem('pufoam_staff_emails');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return [...DEFAULT_STAFF_EMAILS];
}

/**
 * Check whether an authenticated email belongs to staff.
 * Mirrors `isStaff()` in firestore.rules (which lowercases before comparing).
 */
export function isStaffEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const clean = email.trim().toLowerCase();
  const list = getStaffEmails().map((e) => e.trim().toLowerCase());
  return list.includes(clean);
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
 * Returns false when no password is configured — callers must then refuse the
 * action rather than treating an empty config as "everyone passes" (see
 * `requireEditorPermission` in App.tsx). An empty submission never passes.
 */
export function verifyPassword(password: string): boolean {
  const input = (password ?? '').trim();
  if (!input) return false;
  const expected = OPERATOR_PASSWORD.trim();
  if (!expected) return false;
  return input === expected;
}

/**
 * Helper to check if current user is in editor mode
 */
export function isEditorMode(): boolean {
  return activeUserMode === 'editor';
}