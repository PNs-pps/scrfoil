/**
 * Authentication and User Mode Management
 * Modes:
 * - 'visitor': Read-only visitor mode (cannot add/cut/delete/reset data)
 * - 'editor': Data entry operator mode (full permissions, unlocked with password 'scrromklao')
 */

const MODE_STORAGE_KEY = 'siampuufoam_user_mode';
const OPERATOR_PASSWORD = 'scrromklao';

export type UserMode = 'visitor' | 'editor';

/**
 * Retrieve current user mode from sessionStorage/localStorage
 * Defaults to 'visitor'
 */
export function getUserMode(): UserMode {
  try {
    const stored = sessionStorage.getItem(MODE_STORAGE_KEY) || localStorage.getItem(MODE_STORAGE_KEY);
    if (stored === 'editor') {
      return 'editor';
    }
  } catch (err) {
    console.warn('Storage access error:', err);
  }
  return 'visitor';
}

/**
 * Save user mode
 */
export function setUserMode(mode: UserMode): void {
  try {
    sessionStorage.setItem(MODE_STORAGE_KEY, mode);
    localStorage.setItem(MODE_STORAGE_KEY, mode);
  } catch (err) {
    console.warn('Storage write error:', err);
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
  return getUserMode() === 'editor';
}
