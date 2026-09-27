/**
 * Client สำหรับสำรอง/กู้คืน snapshot ไป Cloudflare D1 (ผ่าน Worker)
 * เก็บเฉพาะ URL + secret ใน localStorage — ไม่แทนที่ Firebase realtime
 */

import { FoilRoll, StockCutRecord, PuSandwichCutRecord, CycleCountSession } from '../types';

const CONFIG_KEY = 'pufoam_d1_backup_config_v1';

export interface D1BackupConfig {
  workerUrl: string;
  secret: string;
  lastBackupAt: string | null;
  lastBackupId: string | null;
}

export interface D1BackupListItem {
  id: string;
  created_at: string;
  label?: string;
  reason?: string;
  rolls_count: number;
  records_count: number;
  sandwich_count?: number;
  total_remaining?: number;
}

export interface D1BackupPayload {
  rolls: FoilRoll[];
  records: StockCutRecord[];
  sandwichRecords?: PuSandwichCutRecord[];
  cycleCounts?: CycleCountSession[];
  meta?: {
    app?: string;
    exportedAt?: string;
    note?: string;
  };
}

export interface D1BackupFull extends D1BackupListItem {
  payload: D1BackupPayload | null;
}

const DEFAULT_CONFIG: D1BackupConfig = {
  workerUrl: '',
  secret: '',
  lastBackupAt: null,
  lastBackupId: null,
};

export function getD1BackupConfig(): D1BackupConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return { ...DEFAULT_CONFIG };
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveD1BackupConfig(config: Partial<D1BackupConfig>): D1BackupConfig {
  const next = { ...getD1BackupConfig(), ...config };
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(next));
  } catch (err) {
    console.warn('Failed to save D1 config:', err);
  }
  return next;
}

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

async function d1Fetch(
  path: string,
  options: RequestInit & { config?: D1BackupConfig } = {}
): Promise<Response> {
  const config = options.config || getD1BackupConfig();
  const base = normalizeBaseUrl(config.workerUrl);
  if (!base) {
    throw new Error('ยังไม่ได้ตั้ง Worker URL ของ Cloudflare D1');
  }
  if (!config.secret) {
    throw new Error('ยังไม่ได้ตั้งรหัสลับ (BACKUP_SECRET)');
  }

  const { config: _c, ...init } = options;
  const headers = new Headers(init.headers || {});
  headers.set('X-Backup-Secret', config.secret);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(`${base}${path}`, { ...init, headers });
  return res;
}

/** ทดสอบว่า Worker ตอบ /health และ secret ใช้ได้กับ /backups */
export async function testD1Connection(
  config?: D1BackupConfig
): Promise<{ ok: boolean; message: string }> {
  const cfg = config || getD1BackupConfig();
  const base = normalizeBaseUrl(cfg.workerUrl);
  if (!base) return { ok: false, message: 'ใส่ Worker URL ก่อน' };

  try {
    const health = await fetch(`${base}/health`, { method: 'GET' });
    if (!health.ok) {
      return { ok: false, message: `Worker ไม่ตอบ /health (HTTP ${health.status})` };
    }
  } catch (err: any) {
    return {
      ok: false,
      message: `เชื่อมต่อ Worker ไม่ได้: ${err?.message || err}`,
    };
  }

  if (!cfg.secret) {
    return { ok: true, message: 'Worker ทำงาน — ยังไม่ได้ใส่รหัสลับ (ใส่แล้วค่อยสำรองได้)' };
  }

  try {
    const res = await d1Fetch('/backups?limit=1', { method: 'GET', config: cfg });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        message: data?.error || `รหัสลับหรือสิทธิ์ไม่ผ่าน (HTTP ${res.status})`,
      };
    }
    return {
      ok: true,
      message: `เชื่อมต่อ D1 สำเร็จ — มี snapshot ${(data?.backups || []).length >= 0 ? 'พร้อมใช้งาน' : ''}`,
    };
  } catch (err: any) {
    return { ok: false, message: String(err?.message || err) };
  }
}

/** อัปโหลด snapshot ขึ้น D1 */
export async function uploadBackupToD1(params: {
  rolls: FoilRoll[];
  records: StockCutRecord[];
  sandwichRecords?: PuSandwichCutRecord[];
  cycleCounts?: CycleCountSession[];
  label?: string;
  reason?: string;
}): Promise<{ id: string; created_at: string }> {
  const totalRemaining = params.rolls.reduce(
    (s, r) => s + (Number(r.remainingMeters) || 0),
    0
  );

  const body = {
    label: params.label || 'จากแอปโรงงาน',
    reason: params.reason || 'manual',
    rollsCount: params.rolls.length,
    recordsCount: params.records.length,
    sandwichCount: params.sandwichRecords?.length || 0,
    totalRemaining: Math.round(totalRemaining * 100) / 100,
    payload: {
      rolls: params.rolls,
      records: params.records,
      sandwichRecords: params.sandwichRecords || [],
      cycleCounts: params.cycleCounts || [],
      meta: {
        app: 'scrfoil',
        exportedAt: new Date().toISOString(),
      },
    } satisfies D1BackupPayload,
  };

  const res = await d1Fetch('/backups', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.ok) {
    throw new Error(data?.error || `อัปโหลดไม่สำเร็จ (HTTP ${res.status})`);
  }

  saveD1BackupConfig({
    lastBackupAt: data.created_at || new Date().toISOString(),
    lastBackupId: data.id,
  });

  return { id: data.id, created_at: data.created_at };
}

/** รายการ snapshot บน D1 */
export async function listD1Backups(limit = 20): Promise<D1BackupListItem[]> {
  const res = await d1Fetch(`/backups?limit=${limit}`, { method: 'GET' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.ok) {
    throw new Error(data?.error || `โหลดรายการไม่สำเร็จ (HTTP ${res.status})`);
  }
  return (data.backups || []) as D1BackupListItem[];
}

/** ดึง snapshot เต็มตาม id */
export async function fetchD1Backup(id: string): Promise<D1BackupFull> {
  const res = await d1Fetch(`/backups/${encodeURIComponent(id)}`, { method: 'GET' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.ok) {
    throw new Error(data?.error || `ไม่พบ snapshot (HTTP ${res.status})`);
  }
  return data.backup as D1BackupFull;
}

/** ลบ snapshot บน D1 */
export async function deleteD1Backup(id: string): Promise<void> {
  const res = await d1Fetch(`/backups/${encodeURIComponent(id)}`, { method: 'DELETE' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.ok) {
    throw new Error(data?.error || `ลบไม่สำเร็จ (HTTP ${res.status})`);
  }
}
