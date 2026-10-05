import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as autoBackup from './autoBackup';
import { persistSnapshots } from './autoBackup';
import type { AutoBackupSnapshot } from './autoBackup';
import type { FoilRoll, StockCutRecord } from '../types';

const SNAPSHOTS_KEY = 'pufoam_autobackup_snapshots_v1';

/** Minimal in-memory localStorage that can be made to fail on demand. */
class FakeStorage {
  private store = new Map<string, string>();
  /** Bytes allowed before setItem throws QuotaExceededError. Infinity by default. */
  quota = Infinity;
  /** When true, every setItem throws, simulating storage being unavailable. */
  hardFail = false;
  /** When true, removeItem throws. */
  failRemoves = false;

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
    if (this.hardFail) throw new Error('storage unavailable');
    // Real localStorage replaces an existing value rather than adding to it, so
    // the previous size for this key must be discounted. Without this the fake
    // reports a quota failure for every write once a value is already stored.
    const used = Array.from(this.store.entries()).reduce(
      (n, [key, val]) => n + (key === k ? 0 : key.length + val.length),
      0
    );
    if (used + k.length + v.length > this.quota) {
      const err: any = new Error('quota');
      err.name = 'QuotaExceededError';
      throw err;
    }
    this.store.set(k, v);
  }
  removeItem(k: string) {
    if (this.failRemoves) throw new Error('remove failed');
    this.store.delete(k);
  }
  clear() {
    this.store.clear();
  }
  /** Raw access for assertions, bypassing quota simulation. */
  peek(k: string) {
    return this.store.has(k) ? this.store.get(k)! : null;
  }
  seed(k: string, v: string) {
    this.store.set(k, v);
  }
}

function installFakeStorage(): FakeStorage {
  const storage = new FakeStorage();
  (globalThis as any).localStorage = storage;
  return storage;
}

function snap(id: string, pad = 0): AutoBackupSnapshot {
  return {
    id,
    timestamp: `2026-01-0${id.charCodeAt(0) % 9}`.replace(/0$/, '1') + 'T00:00:00.000Z',
    rollsCount: 1,
    recordsCount: 0,
    totalRemainingMeters: 100,
    reason: 'manual',
    data: {
      rolls: [{ id: `roll-${id}`, lotNumber: `L${'x'.repeat(pad)}` } as FoilRoll],
      records: [] as StockCutRecord[],
    },
  };
}

describe('persistSnapshots', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('writes an empty list, so deleting the last snapshot actually removes it', () => {
    const storage = installFakeStorage();
    storage.seed(SNAPSHOTS_KEY, JSON.stringify([snap('a')]));

    const result = persistSnapshots([]);

    expect(result.error).toBeUndefined();
    expect(storage.peek(SNAPSHOTS_KEY)).toBeNull();
  });

  it('reports failure instead of silently succeeding when storage is unavailable', () => {
    const storage = installFakeStorage();
    storage.hardFail = true;

    const result = persistSnapshots([snap('a')]);

    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('keeps the newest snapshot and drops the oldest until the write fits', () => {
    const storage = installFakeStorage();
    const list = ['a', 'b', 'c', 'd', 'e'].map((id) => snap(id));
    storage.seed(SNAPSHOTS_KEY, JSON.stringify(list));
    const full = JSON.stringify(list).length;

    // Room for the full list minus roughly one snapshot.
    storage.quota = full - 10;

    const result = persistSnapshots(list);

    expect(result.ok).toBe(true);
    expect(result.dropped).toBeGreaterThan(0);

    const stored = JSON.parse(storage.peek(SNAPSHOTS_KEY)!);
    expect(stored.length).toBeLessThan(list.length);
    // Newest is at the head (createBackupSnapshot prepends), trimming removes the
    // tail, so the head must survive.
    expect(stored[0].id).toBe('a');
  });

  it('surfaces quota-exceeded when even a single snapshot cannot be written', () => {
    const storage = installFakeStorage();
    storage.quota = 0;

    const result = persistSnapshots([snap('a')]);

    expect(result.ok).toBe(false);
    expect(result.error).toBe('quota-exceeded');
  });
});

describe('snapshot failure reporting', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('falls back to the in-memory marker when localStorage cannot hold it', async () => {
    const storage = installFakeStorage();
    // Quota is exhausted, so the persisted marker cannot be written either.
    storage.seed(SNAPSHOTS_KEY, JSON.stringify([snap('a', 500)]));
    storage.quota = 10;

    const mod = await import('./autoBackup');
    const result = mod.createBackupSnapshot(
      [{ id: 'r1', lotNumber: 'L' } as FoilRoll],
      [],
      'manual'
    );

    expect(result.result.ok).toBe(false);
    // The whole point: the failure is still observable even though the marker
    // itself could not be persisted.
    expect(mod.getLastSnapshotFailure()).not.toBeNull();
  });
});

describe('deleteSnapshot', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('reports success and removes the final snapshot', async () => {
    const storage = installFakeStorage();
    const mod = await import('./autoBackup');

    // Create one snapshot, then delete it: this is the case that previously
    // reported success while leaving the snapshot in storage.
    mod.createBackupSnapshot([{ id: 'r1', lotNumber: 'L' } as FoilRoll], [], 'manual');
    expect(mod.getBackupSnapshots().length).toBe(1);

    const onlyId = mod.getBackupSnapshots()[0].id;
    const ok = mod.deleteSnapshot(onlyId);

    expect(ok).toBe(true);
    expect(mod.getBackupSnapshots()).toHaveLength(0);
    expect(storage.peek(SNAPSHOTS_KEY)).toBeNull();
  });

  it('returns false when removing the final snapshot cannot be persisted', async () => {
    installFakeStorage();
    const mod = await import('./autoBackup');

    mod.createBackupSnapshot([{ id: 'r1', lotNumber: 'L' } as FoilRoll], [], 'manual');
    const onlyId = mod.getBackupSnapshots()[0].id;

    // Deleting the last snapshot goes through removeItem, so that is what has to
    // fail for the caller to learn the delete did not happen.
    (globalThis as any).localStorage.failRemoves = true;
    const ok = mod.deleteSnapshot(onlyId);

    expect(ok).toBe(false);
    // And the snapshot must still be readable — a reported failure that actually
    // deleted the data would be worse than the original bug.
    expect(mod.getBackupSnapshots()).toHaveLength(1);
  });
});
