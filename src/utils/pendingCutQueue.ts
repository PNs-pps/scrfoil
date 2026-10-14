/**
 * Durable queue for stock cuts that could not be committed to Cloud yet.
 *
 * Why this exists
 * ---------------
 * A cut is a Firestore *transaction*. Unlike a plain `setDoc`, Firestore's offline
 * outbox does not hold transactions: when the device is offline the transaction
 * fails, and nothing will ever retry it. The app used to apply such a cut to local
 * state only and forget about it, so Cloud kept the old stock while this device
 * showed the deduction, and the next realtime snapshot silently reverted the roll.
 *
 * The queue keeps the exact records (with their ids) in localStorage and replays
 * them through the same transaction. That is safe to repeat because the
 * transaction skips any record id that already exists on the server, so a replay of
 * a cut that actually committed is a no-op rather than a second deduction.
 */
import type { StockCutRecord } from '../types';
import { classifyWriteError } from './cloudWrite';

export const PENDING_CUTS_KEY = 'foil_pending_cuts_v1';

export interface PendingCutEntry {
  /** Stable id for this queued submit (the first record's id). */
  queueId: string;
  records: StockCutRecord[];
  enqueuedAt: string;
  attempts: number;
  lastError?: string;
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export function loadPendingCuts(storage: StorageLike | null = defaultStorage()): PendingCutEntry[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(PENDING_CUTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is PendingCutEntry =>
        e && typeof e.queueId === 'string' && Array.isArray(e.records) && e.records.length > 0
    );
  } catch {
    return [];
  }
}

/** Returns false when the queue could not be persisted (storage full/unavailable). */
export function savePendingCuts(
  entries: PendingCutEntry[],
  storage: StorageLike | null = defaultStorage()
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(PENDING_CUTS_KEY, JSON.stringify(entries));
    return true;
  } catch (err) {
    console.warn('Failed to persist pending cuts queue:', err);
    return false;
  }
}

/**
 * Add a batch to the queue. Enqueuing the same batch twice (same first record id)
 * keeps one copy. Returns false if it could not be persisted — the caller must then
 * refuse the cut, because a cut that is neither on Cloud nor durably queued is lost.
 */
export function enqueuePendingCut(
  records: StockCutRecord[],
  err?: unknown,
  storage: StorageLike | null = defaultStorage()
): boolean {
  if (records.length === 0) return true;
  const entries = loadPendingCuts(storage);
  const queueId = records[0].id;
  if (entries.some((e) => e.queueId === queueId)) return true;
  entries.push({
    queueId,
    records,
    enqueuedAt: new Date().toISOString(),
    attempts: 1,
    lastError: errMessage(err),
  });
  return savePendingCuts(entries, storage);
}

export function removePendingCut(
  queueId: string,
  storage: StorageLike | null = defaultStorage()
): void {
  const entries = loadPendingCuts(storage).filter((e) => e.queueId !== queueId);
  savePendingCuts(entries, storage);
}

export function notePendingCutAttempt(
  queueId: string,
  err: unknown,
  storage: StorageLike | null = defaultStorage()
): void {
  const entries = loadPendingCuts(storage).map((e) =>
    e.queueId === queueId ? { ...e, attempts: e.attempts + 1, lastError: errMessage(err) } : e
  );
  savePendingCuts(entries, storage);
}

function errMessage(err: unknown): string | undefined {
  if (!err) return undefined;
  const m = (err as any)?.message;
  return typeof m === 'string' ? m.slice(0, 300) : String(err).slice(0, 300);
}

export type CutFailureKind =
  /** Not enough stock on the server. Will never succeed as-is. */
  | 'shortage'
  /** Rules / auth / bad data. Will never succeed on retry. */
  | 'terminal'
  /** Offline or transient. Safe to queue and retry later. */
  | 'retry';

/**
 * Decide what to do with a failed cut transaction.
 *
 * Anything we cannot positively identify as transient is NOT treated as retryable:
 * the previous code applied every non-shortage error to local state, which turned
 * code bugs and permission errors into silent local-only cuts.
 */
export function classifyCutFailure(err: any): CutFailureKind {
  const message: string = typeof err?.message === 'string' ? err.message : '';
  if (message.includes('สต๊อกไม่พอ')) return 'shortage';

  const code: string | undefined = err?.code;
  if (code === 'unavailable' || code === 'deadline-exceeded' || code === 'resource-exhausted') {
    return 'retry';
  }
  // The web SDK reports a transaction attempted while offline with a message rather
  // than always with a distinct code.
  if (/offline|network|unavailable|timed? ?out/i.test(message) && !code) return 'retry';

  if (classifyWriteError(err).kind === 'rejected') return 'terminal';
  // Includes the "queued" bucket of classifyWriteError, which for a transaction can
  // only mean a transient network-type error.
  return code || /offline|network|unavailable/i.test(message) ? 'retry' : 'terminal';
}
