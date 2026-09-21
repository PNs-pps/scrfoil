import { FoilRoll, StockCutRecord } from '../types';
import { saveStoredRolls, saveStoredCutRecords } from './storage';

export interface AutoBackupConfig {
  enabled: boolean;
  intervalMinutes: number;
  autoSyncCloud: boolean;
  saveLocalSnapshots: boolean;
  lastBackupTime: string | null;
  lastDoubleBackupTime?: string | null;
}

export interface AutoBackupSnapshot {
  id: string;
  timestamp: string;
  rollsCount: number;
  recordsCount: number;
  totalRemainingMeters: number;
  reason: 'scheduled' | 'before_cut' | 'manual' | 'before_reset' | 'cloud_sync' | 'double_backup';
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
  lastBackupTime: null,
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
