import React from 'react';
import { 
  RefreshCw, 
  Wifi, 
  AlertTriangle, 
  ShieldAlert, 
  Database,
  ArrowRight,
  Code
} from 'lucide-react';

interface FirebaseSyncBarProps {
  syncStatus: 'connected' | 'syncing' | 'error' | 'offline' | 'permission-denied';
  lastSyncedTime: string | null;
  onManualSaveToCloud?: () => void;
  onManualFetchFromCloud?: () => void;
  isSaving?: boolean;
  isFetching?: boolean;
  rollsCount: number;
  recordsCount: number;
  projectId?: string;
  isManagedTarget?: boolean;
  isCached?: boolean;
  onOpenRulesModal?: () => void;
  onSwitchCloud?: () => void;
  onNavigateToSettings?: () => void;
}

export const FirebaseSyncBar: React.FC<FirebaseSyncBarProps> = ({
  syncStatus,
  lastSyncedTime,
  rollsCount,
  recordsCount,
  projectId = 'stock-foil',
  isManagedTarget = false,
  isCached = false,
  onOpenRulesModal,
  onSwitchCloud,
  onNavigateToSettings,
}) => {
  const isPermissionDenied = syncStatus === 'permission-denied';

  // If permission denied: Show high-visibility action banner to resolve
  if (isPermissionDenied) {
    return (
      <div className="bg-amber-950/95 border-b border-amber-800 text-slate-100 px-3 sm:px-4 py-2 text-xs transition-colors">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
            <div>
              <span className="font-bold text-amber-300">รอเปิดสิทธิ์ Firebase Rules:</span>{' '}
              <span className="text-slate-200">โปรเจกต์</span>{' '}
              <span className="font-mono text-amber-200 font-bold bg-slate-950/60 px-1.5 py-0.5 rounded text-[11px]">
                {projectId}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onNavigateToSettings ? (
              <button
                type="button"
                onClick={onNavigateToSettings}
                className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
              >
                <Code className="w-3.5 h-3.5" />
                <span>ไปที่วิธีตั้งค่า Rules (หน้าตั้งค่า)</span>
              </button>
            ) : onOpenRulesModal && (
              <button
                type="button"
                onClick={onOpenRulesModal}
                className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
              >
                <Code className="w-3.5 h-3.5" />
                <span>วิธีเปิดสิทธิ์ Rules</span>
              </button>
            )}
            {onSwitchCloud && (
              <button
                type="button"
                onClick={onSwitchCloud}
                className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-600 text-white font-medium rounded-lg text-xs flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Database className="w-3.5 h-3.5" />
                <span>สลับใช้ Cloud สำรอง</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // If connection error: Show warning banner
  if (syncStatus === 'error') {
    return (
      <div className="bg-rose-950/90 border-b border-rose-800 text-rose-200 px-3 sm:px-4 py-1.5 text-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span>พบปัญหาการเชื่อมต่อ Cloud ({projectId})</span>
          </div>
          {onNavigateToSettings && (
            <button
              type="button"
              onClick={onNavigateToSettings}
              className="text-rose-300 hover:text-white underline text-[11px] cursor-pointer"
            >
              ตรวจสอบการตั้งค่า
            </button>
          )}
        </div>
      </div>
    );
  }

  // When connected or syncing: Keep it ultra-sleek, clean, non-cluttered!
  // No bulky buttons taking up vertical space; clean status strip that doesn't crowd the screen.
  return (
    <div className="bg-slate-900 border-b border-slate-800/80 text-slate-300 px-3 sm:px-4 py-1 text-[11px] transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
        {/* Left: Minimal Status Pill */}
        <div className="flex items-center gap-2 min-w-0">
          {syncStatus === 'connected' ? (
            <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="hidden xs:inline flex items-center gap-1">
                <Wifi className="w-3 h-3 text-emerald-400" />
                <span>Cloud Realtime:</span>
              </span>
              <span className="font-mono text-amber-300 font-semibold bg-slate-950/70 px-1.5 py-0.2 rounded text-[10px]">
                {projectId}
              </span>
              {isManagedTarget && (
                <span className="bg-emerald-950 text-emerald-300 border border-emerald-700/50 text-[9px] px-1 rounded hidden sm:inline">
                  Cloud สำรอง
                </span>
              )}
              {isCached && (
                <span className="text-slate-400 text-[10px] hidden md:inline">
                  (Cache ประหยัด Read)
                </span>
              )}
            </div>
          ) : syncStatus === 'syncing' ? (
            <div className="flex items-center gap-1.5 text-amber-300 font-medium">
              <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />
              <span>กำลังเชื่อมต่อ Cloud ({projectId})...</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-slate-400">
              <span className="w-2 h-2 rounded-full bg-slate-500" />
              <span>โหมดในเครื่อง (Offline)</span>
            </div>
          )}

          {/* Counts summary (muted and concise) */}
          <span className="text-slate-500 hidden sm:inline">•</span>
          <span className="text-slate-400 hidden sm:inline truncate">
            ม้วน: <strong className="text-slate-200 font-mono">{rollsCount}</strong> · ตัด:{' '}
            <strong className="text-slate-200 font-mono">{recordsCount}</strong>
          </span>
          {lastSyncedTime && (
            <span className="text-slate-500 text-[10px] hidden lg:inline">
              (อัปเดต {lastSyncedTime})
            </span>
          )}
        </div>

        {/* Right: Clean, quiet navigation shortcut to Settings */}
        {onNavigateToSettings && (
          <button
            type="button"
            onClick={onNavigateToSettings}
            className="text-slate-400 hover:text-amber-300 transition-colors text-[11px] font-medium flex items-center gap-1 shrink-0 cursor-pointer hover:underline"
            title="ไปที่หน้าตั้งค่า เพื่อจัดการการสำรองข้อมูล ดึงข้อมูล หรือบันทึกขึ้น Cloud"
          >
            <span>จัดการ Cloud & สำรองข้อมูล</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
};
