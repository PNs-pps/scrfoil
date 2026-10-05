import { FoilRoll, StockCutRecord } from '../types';
import { todayLocalISO } from './formatters';
import { saveStoredRolls, saveStoredCutRecords } from './storage';

export interface AutoBackupConfig {
  enabled: boolean;
  intervalMinutes: number;
  autoSyncCloud: boolean;
  saveLocalSnapshots: boolean;
  autoSyncD1: boolean;
  lastBackupTime: string | null;
  lastDoubleBackupTime?: string | null;
  lastD1AutoBackupTime?: string | null;
}

export interface AutoBackupSnapshot {
  id: string;
  timestamp: string;
  rollsCount: number;
  recordsCount: number;
  totalRemainingMeters: number;
  reason: 'scheduled' | 'before_cut' | 'manual' | 'before_reset' | 'cloud_sync' | 'double_backup' | 'realign_chain';
  data: {
    rolls: FoilRoll[];
    records: StockCutRecord[];
  };
}

const CONFIG_KEY = 'pufoam_autobackup_config_v1';
const SNAPSHOTS_KEY = 'pufoam_autobackup_snapshots_v1';
const MAX_SNAPSHOTS = 10;

// localStorage is ~5MB shared with every other key this app writes. A snapshot is a
// full deep copy of rolls + records, so 10 of them can easily exceed the quota on a
// real inventory. When that happens localStorage throws QuotaExceededError and the
// snapshot silently stops being written — the operator loses the undo point before
// every cut without ever being told. We handle it explicitly: shrink the retained
// set until it fits, and surface the failure so the UI can warn.
const SNAPSHOT_WRITE_FAILURE_KEY = 'pufoam_autobackup_write_failure_v1';

export type SnapshotWriteResult = {
  ok: boolean;
  /** Number of older snapshots dropped to make room (0 = fit on the first try). */
  dropped: number;
  /** Set when the snapshot could not be persisted even after trimming. */
  error?: 'quota-exceeded' | 'unknown';
};

let lastSnapshotFailure: { at: string; error: 'quota-exceeded' | 'unknown' } | null = null;

/** The most recent snapshot write failure, or null if the last write succeeded. */
export function getLastSnapshotFailure(): { at: string; error: 'quota-exceeded' | 'unknown' } | null {
  try {
    const raw = localStorage.getItem(SNAPSHOT_WRITE_FAILURE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearLastSnapshotFailure(): void {
  lastSnapshotFailure = null;
  try {
    localStorage.removeItem(SNAPSHOT_WRITE_FAILURE_KEY);
  } catch {
    // ignore
  }
}

function isQuotaError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  // Name/exception varies by browser: QuotaExceededError, NS_ERROR_DOM_QUOTA_REACHED,
  // or a plain message. Check all three so we don't miss Safari/WebView variants.
  return (
    err.name === 'QuotaExceededError' ||
    err.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    /quota|exceeded the storage/i.test(err.message)
  );
}

function markSnapshotWriteFailure(error: 'quota-exceeded' | 'unknown'): void {
  const entry = { at: new Date().toISOString(), error };
  lastSnapshotFailure = entry;
  try {
    localStorage.setItem(SNAPSHOT_WRITE_FAILURE_KEY, JSON.stringify(entry));
  } catch {
    // Storage is full — the in-memory copy still lets the UI warn this session.
  }
}

/**
 * Persist a snapshot list, progressively dropping the oldest snapshots until the
 * write fits inside the localStorage quota. Never silently swallows a failure.
 */
function persistSnapshots(
  snapshots: AutoBackupSnapshot[]
): { dropped: number; error?: 'quota-exceeded' | 'unknown' } {
  let attempt = snapshots.slice(0, MAX_SNAPSHOTS);
  let dropped = 0;

  while (attempt.length > 0) {
    try {
      localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(attempt));
      lastSnapshotFailure = null;
      try {
        localStorage.removeItem(SNAPSHOT_WRITE_FAILURE_KEY);
      } catch {
        // ignore
      }
      return { dropped };
    } catch (err) {
      dropped += 1;
      // Drop the oldest retained snapshot and retry. We never drop the newest one
      // (attempt.length > 0 guard) because that's the pre-cut undo point.
      attempt = attempt.slice(0, -1);
      if (attempt.length === 0) {
        return { dropped, error: isQuotaError(err) ? 'quota-exceeded' : 'unknown' };
      }
    }
  }

  return { dropped, error: 'unknown' };
}

export const DEFAULT_BACKUP_CONFIG: AutoBackupConfig = {
  enabled: true,
  intervalMinutes: 10,
  autoSyncCloud: true,
  saveLocalSnapshots: true,
  autoSyncD1: false,
  lastBackupTime: null,
  lastD1AutoBackupTime: null,
};

export function getAutoBackupConfig(): AutoBackupConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return DEFAULT_BACKUP_CONFIG;
    return { ...DEFAULT_BACKUP_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_BACKUP_CONFIG;
  }
}

export function saveAutoBackupConfig(config: AutoBackupConfig): void {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  } catch (err) {
    console.warn('Failed to save auto backup config:', err);
  }
}

export function getBackupSnapshots(): AutoBackupSnapshot[] {
  try {
    const raw = localStorage.getItem(SNAPSHOTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Create a rollback snapshot of the current inventory state.
 *
 * Returns the write result so the caller can warn the operator when the snapshot
 * could NOT be persisted — a snapshot that only exists in memory is not a safety net,
 * and the app takes one before every stock cut.
 */
export function createBackupSnapshot(
  rolls: FoilRoll[],
  records: StockCutRecord[],
  reason: AutoBackupSnapshot['reason'] = 'scheduled'
): { snapshot: AutoBackupSnapshot; result: SnapshotWriteResult } {
  const totalMeters = rolls.reduce((sum, r) => sum + r.remainingMeters, 0);
  const newSnapshot: AutoBackupSnapshot = {
    id: `snap-${Date.now()}`,
    timestamp: new Date().toISOString(),
    rollsCount: rolls.length,
    recordsCount: records.length,
    totalRemainingMeters: Math.round(totalMeters * 100) / 100,
    reason,
    data: {
      rolls: JSON.parse(JSON.stringify(rolls)),
      records: JSON.parse(JSON.stringify(records)),
    },
  };

  let result: SnapshotWriteResult = { ok: true, dropped: 0 };
  try {
    const current = getBackupSnapshots();
    const updated = [newSnapshot, ...current].slice(0, MAX_SNAPSHOTS);
    const persist = persistSnapshots(updated);
    result = {
      ok: !persist.error,
      dropped: persist.dropped,
      ...(persist.error ? { error: persist.error } : {}),
    };
    if (persist.error) {
      markSnapshotWriteFailure(persist.error);
      console.warn(
        `Snapshot not saved (${persist.error}); dropped ${persist.dropped} older snapshot(s) to fit quota`
      );
    } else {
      // Update last backup time only when the snapshot actually landed on disk.
      const config = getAutoBackupConfig();
      saveAutoBackupConfig({ ...config, lastBackupTime: newSnapshot.timestamp });
    }
  } catch (err) {
    const error = isQuotaError(err) ? 'quota-exceeded' : 'unknown';
    result = { ok: false, dropped: 0, error };
    markSnapshotWriteFailure(error);
    console.warn('Failed to save snapshot:', err);
  }

  return { snapshot: newSnapshot, result };
}

export function restoreSnapshot(snapshotId: string): { rolls: FoilRoll[]; records: StockCutRecord[] } | null {
  try {
    const snapshots = getBackupSnapshots();
    const target = snapshots.find((s) => s.id === snapshotId);
    if (!target) return null;

    saveStoredRolls(target.data.rolls);
    saveStoredCutRecords(target.data.records);
    return target.data;
  } catch (err) {
    console.warn('Failed to restore snapshot:', err);
    return null;
  }
}

export function deleteSnapshot(snapshotId: string): void {
  try {
    const snapshots = getBackupSnapshots();
    const updated = snapshots.filter((s) => s.id !== snapshotId);
    const persist = persistSnapshots(updated);
    if (persist.error) {
      console.warn('Failed to delete snapshot:', persist.error);
    }
  } catch (err) {
    console.warn('Failed to delete snapshot:', err);
  }
}

export function clearAllSnapshots(): void {
  try {
    localStorage.removeItem(SNAPSHOTS_KEY);
  } catch {}
}

// --- Cloudflare D1: fixed-time daily schedule (client-side) ---------------
// Same idea as the stock-integrity check above: there's no server-side cron
// in this app, so "automatic" means the app checks, on every load/render,
// whether the current time has already passed one of the two scheduled slots
// (12:30 / 17:30) and that slot hasn't backed up yet today. If the device was
// off or the app closed at the exact time, the very next time the app is
// opened after that time it sees the slot is still "due" and backs up right
// away — it doesn't wait for the clock to hit the slot again.

export const D1_SCHEDULED_TIMES: { hour: number; minute: number }[] = [
  { hour: 12, minute: 30 },
  { hour: 17, minute: 30 },
];

const D1_SCHEDULE_STATE_KEY = 'pufoam_d1_scheduled_backup_state_v1';

interface D1ScheduleState {
  date: string; // YYYY-MM-DD
  doneSlots: number[];
}

function todayStr(): string {
  return todayLocalISO();
}

function readD1ScheduleState(): D1ScheduleState {
  try {
    const raw = localStorage.getItem(D1_SCHEDULE_STATE_KEY);
    if (raw) {
      const parsed: D1ScheduleState = JSON.parse(raw);
      if (parsed.date === todayStr() && Array.isArray(parsed.doneSlots)) return parsed;
    }
  } catch {
    // ignore corrupt/missing state
  }
  return { date: todayStr(), doneSlots: [] };
}

/** Index of a scheduled D1 backup slot (12:30 or 17:30) that is due right now
 * and hasn't run yet today, or null if none is due. */
export function getDueD1ScheduleSlot(): number | null {
  const now = new Date();
  const state = readD1ScheduleState();
  for (let i = 0; i < D1_SCHEDULED_TIMES.length; i++) {
    if (state.doneSlots.includes(i)) continue;
    const { hour, minute } = D1_SCHEDULED_TIMES[i];
    const slotTime = new Date(now);
    slotTime.setHours(hour, minute, 0, 0);
    if (now >= slotTime) return i;
  }
  return null;
}

/** All scheduled slots (12:30, 17:30) whose time has already passed today
 * but that haven't backed up yet — e.g. every slot missed while the app/
 * device was closed. Used so opening the app late catches up in one go
 * instead of trickling out one slot per minute. */
export function getAllDueD1ScheduleSlots(): number[] {
  const now = new Date();
  const state = readD1ScheduleState();
  const due: number[] = [];
  for (let i = 0; i < D1_SCHEDULED_TIMES.length; i++) {
    if (state.doneSlots.includes(i)) continue;
    const { hour, minute } = D1_SCHEDULED_TIMES[i];
    const slotTime = new Date(now);
    slotTime.setHours(hour, minute, 0, 0);
    if (now >= slotTime) due.push(i);
  }
  return due;
}

export function markD1ScheduleSlotRun(slot: number): void {
  const state = readD1ScheduleState();
  if (!state.doneSlots.includes(slot)) {
    state.doneSlots.push(slot);
  }
  try {
    localStorage.setItem(D1_SCHEDULE_STATE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn('Failed to save D1 schedule state:', err);
  }
}

export function exportFullBackupJSON(rolls: FoilRoll[], records: StockCutRecord[]): void {
  const exportPayload = {
    app: 'pufoam-foil-metalsheet-stock',
    version: '2.5',
    exportedAt: new Date().toISOString(),
    rollsCount: rolls.length,
    recordsCount: records.length,
    data: {
      rolls,
      records,
    },
  };

  const jsonString = JSON.stringify(exportPayload, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  
  const d = new Date();
  const dateStr = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}_${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
  
  link.setAttribute('href', url);
  link.setAttribute('download', `PUFOAM_STOCK_BACKUP_${dateStr}.json`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function parseAndValidateBackupJSON(jsonContent: string): { rolls: FoilRoll[]; records: StockCutRecord[] } {
  const parsed = JSON.parse(jsonContent);
  if (!parsed) throw new Error('ไฟล์ว่างหรือไม่ถูกต้อง');

  let rolls: FoilRoll[] = [];
  let records: StockCutRecord[] = [];

  if (Array.isArray(parsed.rolls) || Array.isArray(parsed.data?.rolls)) {
    rolls = parsed.data?.rolls || parsed.rolls || [];
  }
  if (Array.isArray(parsed.records) || Array.isArray(parsed.data?.records)) {
    records = parsed.data?.records || parsed.records || [];
  }

  // Validate rolls
  const validatedRolls = rolls.filter(r => r && typeof r.lotNumber === 'string' && typeof r.remainingMeters === 'number');
  const validatedRecords = records.filter(r => r && typeof r.soNumber === 'string' && typeof r.totalDeducted === 'number');

  return {
    rolls: validatedRolls,
    records: validatedRecords,
  };
}
