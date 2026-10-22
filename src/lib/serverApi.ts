/**
 * client-side helper for Full-Stack REST API endpoints (/api/*)
 */

export interface ServerHealthResponse {
  status: 'ok' | 'error';
  server: string;
  version: string;
  mode: 'production' | 'development';
  port: number;
  uptimeSeconds: number;
  timestamp: string;
  nodeVersion: string;
  memoryUsageMB: number;
  database: {
    projectId: string;
    firestoreDatabaseId: string;
    storeType: string;
    storeLastUpdated: string;
    counts: {
      totalRolls: number;
      activeRolls: number;
      depletedRolls: number;
      cutRecords: number;
      puSandwichCuts: number;
      cycleCounts: number;
      soAuditLogs: number;
    };
  };
  latencyMs?: number;
}

export interface ServerStatsResponse {
  inventory: {
    totalRolls: number;
    activeRolls: number;
    depletedRolls: number;
    lowStockRolls: number;
    totalMetersRemaining: number;
    totalMetersUsed: number;
    totalNgMeters: number;
    ngRatePercent: number;
    byWidth: Array<{
      width: number;
      activeRollCount: number;
      remainingMeters: number;
      usedMeters: number;
    }>;
  };
  sandwich: {
    totalRecords: number;
    totalSteelUsedKg: number;
    totalLengthMeters: number;
    totalNgMeters: number;
    totalNgKg: number;
  };
  computedAt: string;
}

export interface ServerInfoResponse {
  name: string;
  system: string;
  fullstack: boolean;
  capabilities: string[];
  endpoints: Array<{
    method: string;
    path: string;
    desc: string;
  }>;
}

export async function checkServerHealth(): Promise<ServerHealthResponse> {
  const t0 = performance.now();
  const res = await fetch('/api/health', {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  const t1 = performance.now();
  if (!res.ok) {
    throw new Error(`Server health check failed: HTTP ${res.status}`);
  }
  const data = await res.json();
  data.latencyMs = Math.round(t1 - t0);
  return data;
}

export async function getServerStats(): Promise<ServerStatsResponse> {
  const res = await fetch('/api/stats', {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`Failed to get server stats: HTTP ${res.status}`);
  }
  return res.json();
}

export async function getServerInfo(): Promise<ServerInfoResponse> {
  const res = await fetch('/api/info', {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`Failed to get server info: HTTP ${res.status}`);
  }
  return res.json();
}

export async function syncWithServer(payload: {
  rolls?: any[];
  cutRecords?: any[];
  puSandwichCuts?: any[];
}): Promise<any> {
  const res = await fetch('/api/sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Server sync failed: HTTP ${res.status}`);
  }
  return res.json();
}

export async function downloadServerBackup(): Promise<void> {
  const res = await fetch('/api/backup/export', {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Backup export failed: HTTP ${res.status}`);
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pufoam_fullstack_backup_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

export async function restoreServerBackup(backupJson: any): Promise<any> {
  const res = await fetch('/api/backup/import', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(backupJson),
  });
  if (!res.ok) throw new Error(`Backup import failed: HTTP ${res.status}`);
  return res.json();
}

export async function seedServerData(reset: boolean = true): Promise<any> {
  const res = await fetch('/api/seed', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ reset }),
  });
  if (!res.ok) throw new Error(`Server seeding failed: HTTP ${res.status}`);
  return res.json();
}

export async function getFullstackData(): Promise<any> {
  const res = await fetch('/api/data', {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Failed to fetch fullstack data: HTTP ${res.status}`);
  return res.json();
}

export async function saveFullstackData(data: {
  rolls?: any[];
  cutRecords?: any[];
  puSandwichCuts?: any[];
  cycleCounts?: any[];
  soAuditLogs?: any[];
}): Promise<any> {
  const res = await fetch('/api/data', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to save fullstack data: HTTP ${res.status}`);
  return res.json();
}

export async function clearFullstackData(): Promise<any> {
  const res = await fetch('/api/data', {
    method: 'DELETE',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Failed to clear fullstack data: HTTP ${res.status}`);
  return res.json();
}
