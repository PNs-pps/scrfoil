import React from 'react';
import { 
  RefreshCw, 
  AlertTriangle, 
  ShieldAlert, 
  Database,
  Code
} from 'lucide-react';

interface FirebaseSyncBarProps {
  syncStatus: 'connected' | 'syncing' | 'error' | 'offline' | 'permission-denied';
  lastSyncedTime: string | null;
  onManualSaveToCloud: () => void;
  onManualFetchFromCloud: () => void;
  isSaving: boolean;
  isFetching: boolean;
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
  projectId = 'stock-foil',
  isManagedTarget = false,
  isCached = false,
  onOpenRulesModal,
  onSwitchCloud,
  onNavigateToSettings,
}) => {
  const isPermissionDenied = syncStatus === 'permission-denied';

  return (
    <div
      className={`text-slate-100 border-b px-3 py-1 text-[11px] transition-colors ${
        isPermissionDenied
          ? 'bg-amber-950/95 border-amber-800'
          : 'bg-slate-900 border-slate-800'
      }`}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
        {/* Compact status indicator */}
        <div className="flex items-center gap-1.5 min-w-0">
          {syncStatus === 'connected' && (
            <>
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-emerald-400 font-medium truncate">
                {projectId}
              </span>
              {isManagedTarget && (
                <span className="hidden sm:inline text-[10px] text-emerald-300/80">สำรอง</span>
              )}
              {isCached && (
                <span className="hidden sm:inline text-[10px] text-emerald-300/70">· Cache</span>
              )}
            </>
          )}

          {syncStatus === 'syncing' && (
            <>
              <RefreshCw className="w-3 h-3 text-amber-400 animate-spin shrink-0" />
              <span className="text-amber-300 font-medium truncate">กำลังเชื่อมต่อ…</span>
            </>
          )}

          {syncStatus === 'permission-denied' && (
            <>
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400 animate-pulse shrink-0" />
              <span className="text-amber-300 font-medium truncate">รอเปิดสิทธิ์ Rules</span>
            </>
          )}

          {syncStatus === 'error' && (
            <>
              <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0" />
              <span className="text-rose-400 font-medium truncate">ปัญหาการเชื่อมต่อ</span>
            </>
          )}

          {syncStatus === 'offline' && (
            <>
              <span className="w-2 h-2 rounded-full bg-slate-500 shrink-0" />
              <span className="text-slate-400 font-medium truncate">Local Cache</span>
            </>
          )}
        </div>

        {/* Permission-denied quick actions only */}
        {isPermissionDenied && (
          <div className="flex items-center gap-1.5 shrink-0">
            {onNavigateToSettings ? (
              <button
                type="button"
                onClick={onNavigateToSettings}
                className="px-2 py-0.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded text-[10px] flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Code className="w-3 h-3" />
                <span className="hidden sm:inline">ตั้งค่า Rules</span>
              </button>
            ) : onOpenRulesModal ? (
              <button
                type="button"
                onClick={onOpenRulesModal}
                className="px-2 py-0.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded text-[10px] flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Code className="w-3 h-3" />
                <span>Rules</span>
              </button>
            ) : null}
            {onSwitchCloud && (
              <button
                type="button"
                onClick={onSwitchCloud}
                className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded text-[10px] flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Database className="w-3 h-3" />
                <span className="hidden sm:inline">สลับ Cloud</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
