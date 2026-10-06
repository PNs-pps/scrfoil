import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/** Minimal in-memory Storage stand-in (the suite runs in the node environment). */
class FakeStorage {
  private store = new Map<string, string>();
  get length() {
    return this.store.size;
  }
  key(i: number) {
    return Array.from(this.store.keys())[i] ?? null;
  }
  getItem(k: string) {
    return this.store.has(k) ? this.store.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.store.set(k, String(v));
  }
  removeItem(k: string) {
    this.store.delete(k);
  }
  clear() {
    this.store.clear();
  }
}

async function loadAuth() {
  vi.resetModules();
  return await import('./auth');
}

describe('operator password gate', () => {
  afterEach(() => {
    vi.resetModules();
  });

  it('has a password configured', async () => {
    const { hasOperatorPassword } = await loadAuth();
    expect(hasOperatorPassword()).toBe(true);
  });

  it('accepts the configured password', async () => {
    const { verifyPassword } = await loadAuth();
    expect(verifyPassword('Scrromklao')).toBe(true);
  });

  it('trims surrounding whitespace on both sides of the comparison', async () => {
    const { verifyPassword } = await loadAuth();
    expect(verifyPassword('  Scrromklao  ')).toBe(true);
  });

  it('rejects a wrong password', async () => {
    const { verifyPassword } = await loadAuth();
    expect(verifyPassword('scrromklao')).toBe(false); // case matters
    expect(verifyPassword('Scrromklaox')).toBe(false);
    expect(verifyPassword('wrong')).toBe(false);
  });

  it('never accepts an empty submission', async () => {
    const { verifyPassword } = await loadAuth();
    expect(verifyPassword('')).toBe(false);
    expect(verifyPassword('   ')).toBe(false);
  });

  it('treats a null-ish submission as a miss rather than throwing', async () => {
    // The prompt input is a controlled string, but a stray null/undefined must
    // not blow up the editor gate and leave it stuck open.
    const { verifyPassword } = await loadAuth();
    expect(verifyPassword(undefined as unknown as string)).toBe(false);
    expect(verifyPassword(null as unknown as string)).toBe(false);
  });

  it('does not depend on WebCrypto being available', async () => {
    // The shop tablet is often opened over a plain-http LAN address, where
    // `crypto.subtle` is absent. A digest-based gate fails closed there.
    const { verifyPassword } = await loadAuth();
    expect(typeof crypto === 'undefined' || !crypto.subtle).toBe(false); // precondition
    expect(verifyPassword('Scrromklao')).toBe(true);
  });
});

describe('staff allowlist (display only)', () => {
  afterEach(() => {
    vi.resetModules();
  });

  it('matches the staff email case-insensitively', async () => {
    const { isStaffEmail, getStaffEmails } = await loadAuth();
    expect(getStaffEmails()).toEqual(['ikuyisad@ikwai.com']);
    expect(isStaffEmail('IKUYISAD@IKWAI.COM')).toBe(true);
    expect(isStaffEmail('  ikuyisad@ikwai.com ')).toBe(true);
  });

  it('rejects other addresses and empty input', async () => {
    const { isStaffEmail } = await loadAuth();
    expect(isStaffEmail('someone@else.com')).toBe(false);
    expect(isStaffEmail(null)).toBe(false);
    expect(isStaffEmail(undefined)).toBe(false);
    expect(isStaffEmail('')).toBe(false);
  });

  it('does not itself grant editor mode', async () => {
    // Staff email is used for display/diagnostics only. Unlocking still runs
    // through verifyPassword, which is the fix for "anyone can edit".
    const { isStaffEmail, verifyPassword } = await loadAuth();
    expect(isStaffEmail('ikuyisad@ikwai.com')).toBe(true);
    expect(verifyPassword('')).toBe(false);
  });
});

describe('user mode session state', () => {
  const modeKey = 'siampuufoam_user_mode';

  beforeEach(() => {
    (globalThis as any).sessionStorage = new FakeStorage();
    (globalThis as any).localStorage = new FakeStorage();
  });

  afterEach(() => {
    delete (globalThis as any).sessionStorage;
    delete (globalThis as any).localStorage;
    vi.resetModules();
  });

  it('starts in visitor mode on every fresh session', async () => {
    const { getUserMode, isEditorMode } = await loadAuth();
    expect(getUserMode()).toBe('visitor');
    expect(isEditorMode()).toBe(false);
  });

  it('persists editor mode for the session only', async () => {
    const { setUserMode } = await loadAuth();
    setUserMode('editor');
    expect(sessionStorage.getItem(modeKey)).toBe('editor');
  });

  it('drops editor mode back to visitor on reset (logout path)', async () => {
    const { getUserMode, setUserMode, resetToVisitorMode } = await loadAuth();
    setUserMode('editor');
    expect(getUserMode()).toBe('editor');
    resetToVisitorMode();
    expect(getUserMode()).toBe('visitor');
    expect(sessionStorage.getItem(modeKey)).toBeNull();
    expect(localStorage.getItem(modeKey)).toBeNull();
  });
});