/**
 * Authentication and User Mode Management
 * Modes:
 * - 'visitor': Read-only visitor mode (cannot add/cut/delete/reset data)
 * - 'editor': Data entry operator mode (full permissions, unlocked with password 'scrromklao')
 * 
 * Requirement: Every time the app or website is opened, it MUST always start in 'visitor' mode.
 */

const MODE_STORAGE_KEY = 'siampuufoam_user_mode';
const OPERATOR_PASSWORD = 'scrromklao';

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
 * Check if the input password matches the operator password
 * Password: 'scrromklao'
 */
export function verifyPassword(password: string): boolean {
  if (!password) return false;
  return password.trim() === OPERATOR_PASSWORD;
}

/**
 * Helper to check if current user is in editor mode
 */
export function isEditorMode(): boolean {
  return activeUserMode === 'editor';
}

