import React from 'react';
import { Cloud, CloudCheck, RefreshCw, UploadCloud, Database, Wifi, Check, AlertTriangle } from 'lucide-react';

interface FirebaseSyncBarProps {
  syncStatus: 'connected' | 'syncing' | 'error' | 'offline';
  lastSyncedTime: string | null;
  onManualSaveToCloud: () => void;
  onManualFetchFromCloud: () => void;
  isSaving: boolean;
  isFetching: boolean;
  rollsCount: number;
  recordsCount: number;
  projectId?: string;
}

export const FirebaseSyncBar: React.FC<FirebaseSyncBarProps> = ({
  syncStatus,
  lastSyncedTime,
  onManualSaveToCloud,
  onManualFetchFromCloud,
  isSaving,
  isFetching,
  rollsCount,
  recordsCount,
  projectId = 'stock-foil',
}) => {
  return (
    <div className="bg-slate-900 text-slate-100 border-b border-slate-800 px-4 py-2 text-xs transition-colors">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5">
        
        {/* Left: Status Indicator & Realtime Info */}
        <div className="flex items-center flex-wrap gap-2.5">
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700">
            {syncStatus === 'connected' && (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                  <Wifi className="w-3 h-3" />
                  <span>Firestore Realtime:</span>
                  <span className="font-mono text-amber-300 bg-slate-950/60 px-1.5 py-0.2 rounded text-[11px]">
                    {projectId}
                  </span>
                </span>
              </>
            )}

            {syncStatus === 'syncing' && (
              <>
                <RefreshCw className="w-3 h-3 text-amber-400 animate-spin" />
                <span className="text-amber-300 font-medium">
                  กำลังซิงค์ข้อมูลกับ Cloud ({projectId})...
                </span>
              </>
            )}

            {syncStatus === 'error' && (
              <>
                <AlertTriangle className="w-3 h-3 text-rose-400" />
                <span className="text-rose-400 font-medium">พบปัญหาการเชื่อมต่อ ({projectId})</span>
              </>
            )}

            {syncStatus === 'offline' && (
              <>
                <span className="w-2 h-2 rounded-full bg-slate-500" />
                <span className="text-slate-400 font-medium">โหมดออฟไลน์ (บันทึกในเครื่อง)</span>
              </>
            )}
          </div>

          <span className="text-slate-400 hidden md:inline">•</span>
          <span className="text-slate-300 hidden md:inline">
            ข้อมูลกลาง: <strong className="text-amber-400 font-mono">{rollsCount}</strong> ม้วน, ประวัติ <strong className="text-amber-400 font-mono">{recordsCount}</strong> รายการ
          </span>

          {lastSyncedTime && (
            <span className="text-slate-400 text-[11px] hidden lg:inline">
              (อัปเดตล่าสุด: {lastSyncedTime})
            </span>
          )}
        </div>

        {/* Right: Manual Actions (Save to Cloud & Fetch Latest) */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            id="btn-fetch-cloud"
            onClick={onManualFetchFromCloud}
            disabled={isFetching || isSaving}
            title="ดึงข้อมูลล่าสุดจาก Firebase Firestore"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-600 transition-all text-xs font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-sky-400 ${isFetching ? 'animate-spin' : ''}`} />
            <span>{isFetching ? 'กำลังดึง...' : 'ดึงข้อมูล (Fetch)'}</span>
          </button>

          <button
            type="button"
            id="btn-save-cloud"
            onClick={onManualSaveToCloud}
            disabled={isSaving || isFetching}
            title="บันทึกข้อมูลทั้งหมดลงฐานข้อมูลกลาง Firebase Firestore ทันที"
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition-all text-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs"
          >
            {isSaving ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-950" />
            ) : (
              <UploadCloud className="w-3.5 h-3.5 stroke-[2.4]" />
            )}
            <span>{isSaving ? 'กำลังบันทึก...' : 'บันทึกลง Cloud (Save)'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
