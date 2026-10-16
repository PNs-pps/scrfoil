import { describe, it, expect, beforeEach } from 'vitest';

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

import {
  SANDBOX_STORAGE_KEY,
  SANDBOX_KEY_PREFIX,
  CACHE_BASE_KEYS,
  CACHE_SCOPE_MIGRATION_KEY,
  scopeKey,
  archivedRollsCacheKey,
  clearRealDataCache,
  purgeSandboxCache,
  runCacheScopeMigration,
  isSandboxActive,
} from './localCache';

describe('localCache namespacing', () => {
  beforeEach(() => {
    (globalThis as any).localStorage = new FakeStorage();
  });

  it('scopeKey returns the base key when sandbox is off', () => {
    expect(scopeKey(CACHE_BASE_KEYS.ROLLS)).toBe('pufoam_foil_rolls_v3');
    expect(archivedRollsCacheKey()).toBe('pufoam_archived_rolls_cache');
  });

  it('scopeKey prefixes keys while sandbox is active', () => {
    localStorage.setItem(SANDBOX_STORAGE_KEY, 'true');
    expect(isSandboxActive()).toBe(true);
    expect(scopeKey(CACHE_BASE_KEYS.ROLLS)).toBe(`${SANDBOX_KEY_PREFIX}pufoam_foil_rolls_v3`);
    expect(archivedRollsCacheKey()).toBe(`${SANDBOX_KEY_PREFIX}pufoam_archived_rolls_cache`);
  });

  it('clearRealDataCache removes real keys but keeps sandbox keys', () => {
    localStorage.setItem(CACHE_BASE_KEYS.ROLLS, 'real');
    localStorage.setItem(CACHE_BASE_KEYS.ARCHIVED_ROLLS, 'real');
    localStorage.setItem(`${SANDBOX_KEY_PREFIX}${CACHE_BASE_KEYS.ROLLS}`, 'sandbox');
    clearRealDataCache();
    expect(localStorage.getItem(CACHE_BASE_KEYS.ROLLS)).toBeNull();
    expect(localStorage.getItem(CACHE_BASE_KEYS.ARCHIVED_ROLLS)).toBeNull();
    expect(localStorage.getItem(`${SANDBOX_KEY_PREFIX}${CACHE_BASE_KEYS.ROLLS}`)).toBe('sandbox');
  });

  it('purgeSandboxCache removes only sandbox-prefixed keys', () => {
    localStorage.setItem(CACHE_BASE_KEYS.ROLLS, 'real');
    localStorage.setItem(SANDBOX_STORAGE_KEY, 'true');
    localStorage.setItem(`${SANDBOX_KEY_PREFIX}store`, 'sandbox');
    localStorage.setItem(`${SANDBOX_KEY_PREFIX}${CACHE_BASE_KEYS.RECORDS}`, 'sandbox');
    purgeSandboxCache();
    expect(localStorage.getItem(CACHE_BASE_KEYS.ROLLS)).toBe('real');
    expect(localStorage.getItem(SANDBOX_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(`${SANDBOX_KEY_PREFIX}store`)).toBeNull();
    expect(localStorage.getItem(`${SANDBOX_KEY_PREFIX}${CACHE_BASE_KEYS.RECORDS}`)).toBeNull();
  });

  it('runCacheScopeMigration clears real cache once and records a flag', () => {
    localStorage.setItem(CACHE_BASE_KEYS.RECORDS, 'polluted');
    runCacheScopeMigration();
    expect(localStorage.getItem(CACHE_BASE_KEYS.RECORDS)).toBeNull();
    expect(localStorage.getItem(CACHE_SCOPE_MIGRATION_KEY)).toBe('true');

    localStorage.setItem(CACHE_BASE_KEYS.RECORDS, 'kept');
    runCacheScopeMigration();
    expect(localStorage.getItem(CACHE_BASE_KEYS.RECORDS)).toBe('kept');
  });

  it('runCacheScopeMigration is a no-op while sandbox is active', () => {
    localStorage.setItem(SANDBOX_STORAGE_KEY, 'true');
    localStorage.setItem(CACHE_BASE_KEYS.RECORDS, 'real');
    runCacheScopeMigration();
    expect(localStorage.getItem(CACHE_BASE_KEYS.RECORDS)).toBe('real');
    expect(localStorage.getItem(CACHE_SCOPE_MIGRATION_KEY)).toBeNull();
  });
});
