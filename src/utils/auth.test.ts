import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// The gate reads its configuration from import.meta.env at module load, so each
// configuration needs a fresh module instance.
async function loadAuth(env: Record<string, string>) {
  vi.resetModules();
  vi.stubEnv('VITE_OPERATOR_PASSWORD', env.VITE_OPERATOR_PASSWORD ?? '');
  vi.stubEnv('VITE_OPERATOR_PASSWORD_HASH', env.VITE_OPERATOR_PASSWORD_HASH ?? '');
  return await import('./auth');
}

const plainPassword = 'ทดสอบ-1234';

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

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

describe('operator password gate', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('reports no password configured when neither build var is set', async () => {
    const { hasOperatorPassword } = await loadAuth({});
    expect(hasOperatorPassword()).toBe(false);
  });

  it('refuses every password when no password is configured', async () => {
    const { verifyPassword } = await loadAuth({});
    // The failure mode that let anyone edit: an empty config used to be treated
    // as "no gate" rather than "no way in".
    expect(await verifyPassword('')).toBe(false);
    expect(await verifyPassword(plainPassword)).toBe(false);
    expect(await verifyPassword('anything')).toBe(false);
  });

  it('accepts the exact plaintext password when only the plaintext var is set', async () => {
    const { verifyPassword, hasOperatorPassword } = await loadAuth({
      VITE_OPERATOR_PASSWORD: plainPassword,
    });
    expect(hasOperatorPassword()).toBe(true);
    expect(await verifyPassword(plainPassword)).toBe(true);
  });

  it('trims surrounding whitespace on both sides of the comparison', async () => {
    const { verifyPassword } = await loadAuth({ VITE_OPERATOR_PASSWORD: plainPassword });
    expect(await verifyPassword(`  ${plainPassword}  `)).toBe(true);
  });

  it('rejects a wrong password', async () => {
    const { verifyPassword } = await loadAuth({ VITE_OPERATOR_PASSWORD: plainPassword });
    expect(await verifyPassword('wrong')).toBe(false);
    expect(await verifyPassword(`${plainPassword}x`)).toBe(false);
  });

  it('never accepts an empty submission', async () => {
    const { verifyPassword } = await loadAuth({ VITE_OPERATOR_PASSWORD: plainPassword });
    expect(await verifyPassword('')).toBe(false);
    expect(await verifyPassword('   ')).toBe(false);
  });

  it('accepts the matching digest when the hash var is set', async () => {
    const digest = await sha256Hex(plainPassword);
    const { verifyPassword, hasOperatorPassword } = await loadAuth({
      VITE_OPERATOR_PASSWORD_HASH: digest,
    });
    expect(hasOperatorPassword()).toBe(true);
    expect(await verifyPassword(plainPassword)).toBe(true);
  });

  it('rejects a password whose digest does not match', async () => {
    const { verifyPassword } = await loadAuth({
      VITE_OPERATOR_PASSWORD_HASH: await sha256Hex('a different password'),
    });
    expect(await verifyPassword(plainPassword)).toBe(false);
  });

  it('prefers the hash var over the plaintext var', async () => {
    // Both set but disagreeing: the hash is authoritative, so a password equal
    // to the plaintext must NOT pass.
    const { verifyPassword } = await loadAuth({
      VITE_OPERATOR_PASSWORD: plainPassword,
      VITE_OPERATOR_PASSWORD_HASH: await sha256Hex('a different password'),
    });
    expect(await verifyPassword(plainPassword)).toBe(false);
  });

  it('accepts an uppercase digest from the build var', async () => {
    // Operators paste hashes out of terminals that uppercase hex.
    const digest = (await sha256Hex(plainPassword)).toUpperCase();
    const { verifyPassword } = await loadAuth({ VITE_OPERATOR_PASSWORD_HASH: digest });
    expect(await verifyPassword(plainPassword)).toBe(true);
  });

  it('digests Thai passwords as UTF-8', async () => {
    const { verifyPassword } = await loadAuth({
      VITE_OPERATOR_PASSWORD_HASH: await sha256Hex('รหัสผ่านไทย๑๒๓'),
    });
    expect(await verifyPassword('รหัสผ่านไทย๑๒๓')).toBe(true);
    expect(await verifyPassword('รหัสผ่านไทย123')).toBe(false);
  });

  it('never returns true for a digest-shaped submission', async () => {
    // Guard against accidentally comparing the digest to itself.
    const digest = await sha256Hex(plainPassword);
    const { verifyPassword } = await loadAuth({ VITE_OPERATOR_PASSWORD_HASH: digest });
    expect(await verifyPassword(digest)).toBe(false);
  });
});

describe('staff allowlist (display only)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('matches the staff email case-insensitively', async () => {
    const { isStaffEmail, getStaffEmails } = await loadAuth({});
    expect(getStaffEmails()).toEqual(['ikuyisad@ikwai.com']);
    expect(isStaffEmail('IKUYISAD@IKWAI.COM')).toBe(true);
    expect(isStaffEmail('  ikuyisad@ikwai.com ')).toBe(true);
  });

  it('rejects other addresses and empty input', async () => {
    const { isStaffEmail } = await loadAuth({});
    expect(isStaffEmail('someone@else.com')).toBe(false);
    expect(isStaffEmail(null)).toBe(false);
    expect(isStaffEmail(undefined)).toBe(false);
    expect(isStaffEmail('')).toBe(false);
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
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('starts in visitor mode on every fresh session', async () => {
    const { getUserMode, isEditorMode } = await loadAuth({});
    expect(getUserMode()).toBe('visitor');
    expect(isEditorMode()).toBe(false);
  });

  it('persists editor mode for the session only', async () => {
    const { setUserMode } = await loadAuth({});
    setUserMode('editor');
    expect(sessionStorage.getItem(modeKey)).toBe('editor');
  });

  it('drops editor mode back to visitor on reset (logout path)', async () => {
    const { getUserMode, setUserMode, resetToVisitorMode } = await loadAuth({});
    setUserMode('editor');
    expect(getUserMode()).toBe('editor');
    resetToVisitorMode();
    expect(getUserMode()).toBe('visitor');
    expect(sessionStorage.getItem(modeKey)).toBeNull();
    expect(localStorage.getItem(modeKey)).toBeNull();
  });
});