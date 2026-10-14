/**
 * Durable queue for SO cut-record *edits* that could not reach Cloud yet.
 *
 * Why this exists
 * ---------------
 * An edit to a cut record runs as a Firestore transaction (record + roll are
 * updated together, then the whole remainingBefore/remainingAfter chain is
 * re-aligned). Like a cut, Firestore's own offline outbox does not hold
 * transactions: when the device is offline the transaction fails and nothing
 * ever retries it. The app used to rebuild the edited record + roll in memory
 * only, so the next realtime snapshot silently reverted the edit and the
 * operator was told it was "รอซิงค์ Cloud" when it never would.
 *
 * The queue keeps the exact edited record (and the recomputed roll, when we
 * have one) in localStorage so a replay can restore both the record and the
 * roll's deducted meters. `recordId` is the stable key — re-editing the same
 * record replaces the queued copy rather than piling up stale edits.
 */
import type { FoilRoll, StockCutRecord } from '../types';

export const PENDING_RECORD_EDITS_KEY = 'foil_pending_record_edits_v1';

export interface PendingRecordEdit {
  /** Stable id of the record being edited (also the queue key). */
  recordId: string;
  /** The edited record as it should exist on Cloud. */
  record: StockCutRecord;
  /** Roll state recomputed from the edit, if the edit changed the roll. */
  roll?: FoilRoll | null;
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

export function loadPendingRecordEdits(
  storage: StorageLike | null = defaultStorage()
): PendingRecordEdit[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(PENDING_RECORD_EDITS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is PendingRecordEdit =>
        e && typeof e.recordId === 'string' && e.record && typeof e.record === 'object'
    );
  } catch {
    return [];
  }
}

/** Returns false when the queue could not be persisted (storage full/unavailable). */
export function savePendingRecordEdits(
  entries: PendingRecordEdit[],
  storage: StorageLike | null = defaultStorage()
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(PENDING_RECORD_EDITS_KEY, JSON.stringify(entries));
    return true;
  } catch (err) {
    console.warn('Failed to persist pending record edits queue:', err);
    return false;
  }
}

/**
 * Queue (or re-queue) an edit. Editing the same record twice keeps one copy —
 * the newest — so a replay never applies a stale edit over a newer one.
 * Returns false when it could not be persisted; the caller must then refuse the
 * edit, because an edit that is neither on Cloud nor durably queued is lost.
 */
export function enqueuePendingRecordEdit(
  edit: { record: StockCutRecord; roll?: FoilRoll | null },
  err?: unknown,
  storage: StorageLike | null = defaultStorage()
): boolean {
  const recordId = edit.record?.id;
  if (!recordId) return false;
  const entries = loadPendingRecordEdits(storage).filter((e) => e.recordId !== recordId);
  entries.push({
    recordId,
    record: edit.record,
    roll: edit.roll ?? null,
    enqueuedAt: new Date().toISOString(),
    attempts: 1,
    lastError: errMessage(err),
  });
  return savePendingRecordEdits(entries, storage);
}

export function removePendingRecordEdit(
  recordId: string,
  storage: StorageLike | null = defaultStorage()
): void {
  const entries = loadPendingRecordEdits(storage).filter((e) => e.recordId !== recordId);
  savePendingRecordEdits(entries, storage);
}

export function notePendingRecordEditAttempt(
  recordId: string,
  err: unknown,
  storage: StorageLike | null = defaultStorage()
): void {
  const entries = loadPendingRecordEdits(storage).map((e) =>
    e.recordId === recordId ? { ...e, attempts: e.attempts + 1, lastError: errMessage(err) } : e
  );
  savePendingRecordEdits(entries, storage);
}

/**
 * รหัสรายการที่ยังแก้ไขค้างอยู่ในคิว — ให้ realtime snapshot รู้ว่าใบนี้เป็น
 * เวอร์ชันในเครื่องที่ยังไม่ขึ้น Cloud จะได้ไม่ทับกลับด้วยค่าเก่า
 * คืน Set ว่างเมื่อไม่มีคิวหรืออ่าน storage ไม่ได้
 */
export function getPendingRecordEditIds(
  storage: StorageLike | null = defaultStorage()
): Set<string> {
  const ids = new Set<string>();
  try {
    for (const entry of loadPendingRecordEdits(storage)) {
      if (entry.recordId) ids.add(entry.recordId);
    }
  } catch {
    return new Set<string>();
  }
  return ids;
}

/**
 * รหัสม้วน (foilId) ของทุกรายการที่แก้ไขค้างอยู่ในคิว — ให้ merge ม้วนรู้ว่าม้วนใด
 * มียอดที่ยังไม่ขึ้น Cloud จะได้เก็บยอดในเครื่องไว้ ไม่โดน snapshot เก่าทับกลับ
 */
export function getPendingRecordEditRollIds(
  storage: StorageLike | null = defaultStorage()
): Set<string> {
  const ids = new Set<string>();
  try {
    for (const entry of loadPendingRecordEdits(storage)) {
      const foilId = entry.record?.foilId;
      if (typeof foilId === 'string' && foilId) ids.add(foilId);
      if (typeof entry.roll?.id === 'string' && entry.roll.id) ids.add(entry.roll.id);
    }
  } catch {
    return new Set<string>();
  }
  return ids;
}

function errMessage(err: unknown): string | undefined {
  if (!err) return undefined;
  const m = (err as any)?.message;
  return typeof m === 'string' ? m.slice(0, 300) : String(err).slice(0, 300);
}
