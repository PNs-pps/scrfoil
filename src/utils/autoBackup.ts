import { FoilRoll, StockCutRecord } from '../types';
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

export function createBackupSnapshot(
  rolls: FoilRoll[],
  records: StockCutRecord[],
  reason: AutoBackupSnapshot['reason'] = 'scheduled'
): AutoBackupSnapshot {
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

  try {
    const current = getBackupSnapshots();
    const updated = [newSnapshot, ...current].slice(0, MAX_SNAPSHOTS);
    localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(updated));
    
    // Update last backup time
    const config = getAutoBackupConfig();
    saveAutoBackupConfig({ ...config, lastBackupTime: newSnapshot.timestamp });
  } catch (err) {
    console.warn('Failed to save snapshot:', err);
  }

  return newSnapshot;
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
    localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(updated));
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
  return new Date().toISOString().split('T')[0];
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
