import React, { useState, useMemo } from 'react';
import { 
  ShieldCheck, 
  Database, 
  Clock, 
  RotateCcw, 
  Download, 
  Upload, 
  Copy, 
  Check, 
  ExternalLink, 
  Smartphone, 
  CheckCircle2, 
  AlertTriangle, 
  Server, 
  Save, 
  History, 
  Layers,
  ArrowRight,
  Info,
  FolderArchive,
  FolderOpen,
  Folder,
  FileText,
  Lock,
  Unlock,
  RefreshCw,
  Zap,
  Bug,
  ClipboardList,
  Sliders,
  Cloud,
  CheckCircle,
  HelpCircle,
  AlertOctagon,
  Search
} from 'lucide-react';
import { 
  AutoBackupConfig, 
  AutoBackupSnapshot, 
  getAutoBackupConfig, 
  saveAutoBackupConfig, 
  getBackupSnapshots, 
  createBackupSnapshot, 
  restoreSnapshot, 
  deleteSnapshot, 
  exportFullBackupJSON, 
  parseAndValidateBackupJSON 
} from '../utils/autoBackup';
import { FoilRoll, StockCutRecord } from '../types';
import { UserMode } from '../utils/auth';
import { 
  groupRollsByDateReceived, 
  groupCutsByDate, 
  exportDateOrganizedArchiveJSON, 
  exportIncomingDateCSV, 
  exportCutsDateCSV 
} from '../utils/dateGrouping';
import { formatMeters } from '../utils/formatters';
import {
  getD1BackupConfig,
  saveD1BackupConfig,
  testD1Connection,
  uploadBackupToD1,
  listD1Backups,
  fetchD1Backup,
  deleteD1Backup,
  D1BackupListItem,
} from '../utils/d1Backup';

export type SettingsCategoryTab = 'cloud' | 'backup' | 'audit' | 'system';

interface SettingsBackupViewProps {
  rolls: FoilRoll[];
  records: StockCutRecord[];
  syncStatus: 'connected' | 'syncing' | 'error' | 'offline' | 'permission-denied';
  lastSyncedTime: string | null;
  projectId: string;
  isManagedTarget: boolean;
  onSwitchCloud: () => void;
  onManualSaveToCloud: () => Promise<void>;
  onManualFetchFromCloud: () => Promise<void>;
  onRestoreData: (newRolls: FoilRoll[], newRecords: StockCutRecord[]) => void;
  onResetData?: () => void;
  showToast: (text: string, type?: 'success' | 'info') => void;
  userMode?: UserMode;
  onRequestUnlock?: () => void;
  onDoubleBackup?: () => Promise<void> | void;
  isDoubleBackingUp?: boolean;
  lastDoubleBackupTime?: string | null;
  onFetchFullHistory?: () => Promise<void> | void;
  isFetchingFullHistory?: boolean;
  isCached?: boolean;
  onRunIntegrityCheck?: () => void;
  isRunningIntegrityCheck?: boolean;
  integrityCheckState?: { date: string; count: number; lastCheckedAt: string };
  onOpenSOAudit?: () => void;
  onOpenCycleCount?: () => void;
  onOpenCycleCountHistory?: () => void;
  isSaving?: boolean;
  isFetching?: boolean;
  initialTab?: SettingsCategoryTab;
}

export const SettingsBackupView: React.FC<SettingsBackupViewProps> = ({
  rolls,
  records,
  syncStatus,
  lastSyncedTime,
  projectId,
  isManagedTarget,
  onSwitchCloud,
  onManualSaveToCloud,
  onManualFetchFromCloud,
  onRestoreData,
  onResetData,
  showToast,
  userMode = 'visitor',
  onRequestUnlock,
  onDoubleBackup,
  isDoubleBackingUp = false,
  lastDoubleBackupTime,
  onFetchFullHistory,
  isFetchingFullHistory = false,
  isCached = true,
  onRunIntegrityCheck,
  isRunningIntegrityCheck = false,
  integrityCheckState,
  onOpenSOAudit,
  onOpenCycleCount,
  onOpenCycleCountHistory,
  isSaving = false,
  isFetching = false,
  initialTab = 'cloud',
}) => {
  // Category state (Cloud | Backup | Audit | System)
  const [activeCategory, setActiveCategory] = useState<SettingsCategoryTab>(() => {
    if (syncStatus === 'permission-denied') return 'cloud';
    return initialTab;
  });

  // Local state for auto-backup and snapshots
  const [backupConfig, setBackupConfig] = useState<AutoBackupConfig>(getAutoBackupConfig());
  const [snapshots, setSnapshots] = useState<AutoBackupSnapshot[]>(getBackupSnapshots());

  // Cloudflare D1 snapshot state
  const [d1Config, setD1Config] = useState(getD1BackupConfig());
  const [d1List, setD1List] = useState<D1BackupListItem[]>([]);
  const [d1Busy, setD1Busy] = useState(false);
  const [d1Status, setD1Status] = useState<string | null>(null);

  // Copy rules state
  const [copiedRules, setCopiedRules] = useState(false);
  const [isBackingUpNow, setIsBackingUpNow] = useState(false);

  // Local fetch / save busy indicator
  const [localFetchBusy, setLocalFetchBusy] = useState(false);
  const [localSaveBusy, setLocalSaveBusy] = useState(false);

  // Date-grouped folders
  const incomingDateFolders = useMemo(() => groupRollsByDateReceived(rolls), [rolls]);
  const cutsDateFolders = useMemo(() => groupCutsByDate(records), [records]);

  // Guard action for visitor mode
  const handleActionGuarded = (action: () => void) => {
    if (userMode === 'visitor' && onRequestUnlock) {
      onRequestUnlock();
      return;
    }
    action();
  };

  // Toggle backup setting
  const updateConfig = (patch: Partial<AutoBackupConfig>) => {
    const updated = { ...backupConfig, ...patch };
    setBackupConfig(updated);
    saveAutoBackupConfig(updated);
    showToast('บันทึกการตั้งค่าเรียบร้อยแล้ว');
  };

  // Immediate manual snapshot & cloud backup
  const handleBackupNow = async () => {
    setIsBackingUpNow(true);
    try {
      const snap = createBackupSnapshot(rolls, records, 'manual');
      setSnapshots(getBackupSnapshots());
      
      if (backupConfig.autoSyncCloud) {
        await onManualSaveToCloud();
      }
      showToast(`สร้างจุดสำรองข้อมูลสำเร็จ (#${snap.id.slice(-4)}) เรียบร้อยแล้ว`);
    } catch (err: any) {
      showToast('สร้างจุดสำรองในเครื่องเรียบร้อย (แจ้งเตือนคลาวด์)', 'info');
    } finally {
      setIsBackingUpNow(false);
    }
  };

  // Manual Fetch with feedback
  const handleManualFetch = async () => {
    setLocalFetchBusy(true);
    try {
      await onManualFetchFromCloud();
      showToast('ดึงข้อมูลล่าสุดจาก Cloud Firestore สำเร็จแล้ว');
    } catch (err: any) {
      showToast(`เกิดข้อผิดพลาดในการดึงข้อมูล: ${err?.message || err}`, 'info');
    } finally {
      setLocalFetchBusy(false);
    }
  };

  // Manual Save with feedback
  const handleManualSave = async () => {
    handleActionGuarded(async () => {
      setLocalSaveBusy(true);
      try {
        await onManualSaveToCloud();
        showToast('บันทึกข้อมูลขึ้น Cloud Firestore สำเร็จแล้ว');
      } catch (err: any) {
        showToast(`เกิดข้อผิดพลาดในการบันทึก: ${err?.message || err}`, 'info');
      } finally {
        setLocalSaveBusy(false);
      }
    });
  };

  // Restore snapshot
  const handleRestoreSnapshot = (snapshotId: string) => {
    handleActionGuarded(() => {
      const snap = snapshots.find(s => s.id === snapshotId);
      if (!snap) return;

      if (confirm(`คุณต้องการกู้คืนข้อมูลกลับไปจุดสำรองนี้หรือไม่?\n\nวันเวลา: ${new Date(snap.timestamp).toLocaleString('th-TH')}\nจำนวนม้วนฟอยล์: ${snap.rollsCount} ม้วน\nประวัติตัดสต๊อก: ${snap.recordsCount} รายการ\n\n(ระบบจะสร้างจุดสำรองฉุกเฉินของข้อมูลปัจจุบันไว้ให้ก่อน)`)) {
        createBackupSnapshot(rolls, records, 'before_reset');
        const restored = restoreSnapshot(snapshotId);
        if (restored) {
          onRestoreData(restored.rolls, restored.records);
          setSnapshots(getBackupSnapshots());
          showToast('กู้คืนข้อมูลจากจุดสำรองสำเร็จเรียบร้อย!');
        } else {
          showToast('ไม่สามารถกู้คืนจุดสำรองนี้ได้', 'info');
        }
      }
    });
  };

  // Delete snapshot
  const handleDeleteSnapshot = (snapshotId: string) => {
    handleActionGuarded(() => {
      deleteSnapshot(snapshotId);
      setSnapshots(getBackupSnapshots());
      showToast('ลบจุดสำรองแล้ว');
    });
  };

  // Import JSON backup file
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleActionGuarded(() => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const content = event.target?.result as string;
          const result = parseAndValidateBackupJSON(content);
          
          if (result.rolls.length === 0 && result.records.length === 0) {
            showToast('ไม่พบข้อมูลม้วนฟอยล์หรือประวัติตัดสต๊อกในไฟล์นี้', 'info');
            return;
          }

          if (confirm(`พบข้อมูลในไฟล์สำรอง:\n- ม้วนฟอยล์: ${result.rolls.length} ม้วน\n- ประวัติตัด: ${result.records.length} รายการ\n\nคุณต้องการแทนที่ข้อมูลปัจจุบันด้วยข้อมูลจากไฟล์นี้หรือไม่?`)) {
            createBackupSnapshot(rolls, records, 'before_reset');
            onRestoreData(result.rolls, result.records);
            createBackupSnapshot(result.rolls, result.records, 'manual');
            setSnapshots(getBackupSnapshots());
            showToast('นำเข้าและกู้คืนข้อมูลจากไฟล์ JSON สำเร็จ!');
          }
        } catch (err: any) {
          showToast(`เกิดข้อผิดพลาดในการอ่านไฟล์: ${err.message}`, 'info');
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    });
  };

  const copyRulesCode = () => {
    const rules = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}`;
    navigator.clipboard.writeText(rules);
    setCopiedRules(true);
    setTimeout(() => setCopiedRules(false), 2500);
    showToast('คัดลอกโค้ด Firebase Rules สำเร็จ');
  };

  // Category definitions for clear navigation
  const categories = [
    {
      id: 'cloud' as const,
      label: 'ซิงค์และคลาวด์',
      sublabel: 'Cloud & Sync',
      icon: Cloud,
      badge: syncStatus === 'permission-denied' ? 'สิทธิ์ขาด' : undefined,
      badgeColor: 'bg-rose-500 text-white',
    },
    {
      id: 'backup' as const,
      label: 'การสำรองและกู้คืน',
      sublabel: 'Backup & Restore',
      icon: ShieldCheck,
      badge: `${snapshots.length} จุด`,
      badgeColor: 'bg-slate-200 text-slate-700',
    },
    {
      id: 'audit' as const,
      label: 'ตรวจสอบ & นับสต๊อก',
      sublabel: 'Audit & Count',
      icon: ClipboardList,
      badge: '3 เครื่องมือ',
      badgeColor: 'bg-amber-100 text-amber-900',
    },
    {
      id: 'system' as const,
      label: 'สิทธิ์ใช้งาน & ระบบ',
      sublabel: 'System & Access',
      icon: Sliders,
      badge: userMode === 'editor' ? 'คีย์ข้อมูล' : 'ผู้เข้าชม',
      badgeColor: userMode === 'editor' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600',
    },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Settings Header with Clean Hierarchy */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200/90 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-200/80">
                SYSTEM SETTINGS
              </span>
              <span className="text-xs text-slate-500">
                ระบบจัดการสต๊อกฟอยล์ · ร่มเกล้า
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">
              การตั้งค่าและศูนย์รวมคำสั่ง
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
              จัดหมวดหมู่คำสั่งซิงค์คลาวด์ สำรองข้อมูล ตรวจสอบสต๊อก และสิทธิ์ระบบให้ค้นหาง่าย ไม่รกตา
            </p>
          </div>

          {/* Quick status pill in header */}
          <div className="flex items-center gap-2 self-start sm:self-center">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold ${
              syncStatus === 'connected'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : syncStatus === 'permission-denied'
                ? 'bg-rose-50 text-rose-800 border border-rose-300'
                : 'bg-amber-50 text-amber-800 border border-amber-200'
            }`}>
              <span className={`w-2 h-2 rounded-full ${
                syncStatus === 'connected' ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'
              }`} />
              <span>
                {syncStatus === 'connected' ? 'Firestore เชื่อมต่อแล้ว' :
                 syncStatus === 'permission-denied' ? 'ต้องเปิดสิทธิ์ Rules' :
                 syncStatus === 'syncing' ? 'กำลังซิงค์...' : 'โหมดในเครื่อง'}
              </span>
            </span>
          </div>
        </div>

        {/* Re-categorized Tab Navigation (Clean, Spacious Segmented Navigation) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-5 pt-4 border-t border-slate-100">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`relative flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                    : 'bg-slate-50/80 hover:bg-slate-100 text-slate-700 border-slate-200/80'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  isActive ? 'bg-amber-400 text-slate-950 font-bold' : 'bg-white text-slate-600 border border-slate-200'
                }`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-bold text-xs sm:text-sm truncate">
                      {cat.label}
                    </span>
                    {cat.badge && (
                      <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded shrink-0 ${
                        isActive ? 'bg-amber-400 text-slate-950' : cat.badgeColor
                      }`}>
                        {cat.badge}
                      </span>
                    )}
                  </div>
                  <span className={`text-[11px] block truncate ${
                    isActive ? 'text-slate-300' : 'text-slate-500'
                  }`}>
                    {cat.sublabel}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ============================================================== */}
      {/* CATEGORY 1: CLOUD & REALTIME SYNC (ซิงค์และคลาวด์)              */}
      {/* ============================================================== */}
      {activeCategory === 'cloud' && (
        <div className="space-y-6">
          {/* Main Cloud Control & Manual Actions Card */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 border border-sky-100 flex items-center justify-center font-bold">
                  <Cloud className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base sm:text-lg">
                    การจัดการเชื่อมต่อ Firestore Cloud
                  </h3>
                  <p className="text-xs text-slate-500">
                    ข้อมูลจะซิงค์แบบ Realtime อัตโนมัติ หรือสั่งดึงและส่งข้อมูลด้วยตนเองได้ที่นี่
                  </p>
                </div>
              </div>

              {/* Status Indicator */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-mono">โปรเจกต์:</span>
                <span className="font-mono text-xs font-bold px-2 py-1 rounded-lg bg-slate-900 text-amber-300">
                  {projectId}
                </span>
                {isManagedTarget && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-200">
                    Cloud กลาง
                  </span>
                )}
              </div>
            </div>

            {/* Cloud Manual Action Buttons (Clean & Prominent Here, Not Cluttering the Top Screen) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {/* Action 1: Manual Fetch */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/90 hover:border-sky-300 transition-colors space-y-2.5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                    <RefreshCw className={`w-4 h-4 text-sky-600 ${isFetching || localFetchBusy ? 'animate-spin' : ''}`} />
                    <span>ดึงข้อมูลล่าสุด (Fetch)</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    อ่านข้อมูลม้วนฟอยล์และประวัติตัดสต๊อกล่าสุดจาก Firestore บน Cloud มาอัปเดตลงเครื่อง
                  </p>
                </div>
                <button
                  type="button"
                  id="btn-settings-fetch-cloud"
                  onClick={handleManualFetch}
                  disabled={isFetching || localFetchBusy || isSaving || localSaveBusy}
                  className="w-full py-2.5 px-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw className={`w-4 h-4 ${isFetching || localFetchBusy ? 'animate-spin' : ''}`} />
                  <span>{isFetching || localFetchBusy ? 'กำลังดึงข้อมูล...' : 'ดึงข้อมูลจาก Cloud เดี๋ยวนี้'}</span>
                </button>
              </div>

              {/* Action 2: Manual Save */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/90 hover:border-amber-300 transition-colors space-y-2.5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                    <Save className="w-4 h-4 text-amber-600" />
                    <span>บันทึกลง Cloud (Save)</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    ส่งข้อมูลม้วนฟอยล์ทั้งหมด ({rolls.length} ม้วน) และประวัติ ({records.length} รายการ) ขึ้นเก็บที่ฐานข้อมูลกลาง
                  </p>
                </div>
                <button
                  type="button"
                  id="btn-settings-save-cloud"
                  onClick={handleManualSave}
                  disabled={isSaving || localSaveBusy || isFetching || localFetchBusy}
                  className="w-full py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving || localSaveBusy ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  <span>{isSaving || localSaveBusy ? 'กำลังบันทึกลง Cloud...' : 'บันทึกขึ้น Cloud ทันที'}</span>
                </button>
              </div>

              {/* Action 3: Force Full History Fetch */}
              {onFetchFullHistory && (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/90 hover:border-emerald-300 transition-colors space-y-2.5 flex flex-col justify-between sm:col-span-2 lg:col-span-1">
                  <div>
                    <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                      <Database className="w-4 h-4 text-emerald-600" />
                      <span>ดึงประวัติย้อนหลังทั้งหมด</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      ดึงประวัติตัดสต๊อกย้อนหลังทั้งหมดจาก Firestore ลงมาเก็บในแคชเบราว์เซอร์สำหรับออกรายงาน
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onFetchFullHistory()}
                    disabled={isFetchingFullHistory}
                    className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isFetchingFullHistory ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Database className="w-4 h-4" />
                    )}
                    <span>{isFetchingFullHistory ? 'กำลังดึงประวัติทั้งหมด...' : 'ดึงประวัติย้อนหลังทั้งหมด'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Cloud Target Switcher Details */}
            <div className="p-4 rounded-xl bg-slate-100/80 border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div className="space-y-0.5">
                <span className="font-bold text-slate-900 block">สลับเป้าหมายคลาวด์ (Cloud Target)</span>
                <span className="text-slate-600">
                  กำลังใช้งาน: <strong>{isManagedTarget ? 'Cloud กลางระบบ (ค่าเริ่มต้นสำหรับโรงงาน)' : 'Firebase บัญชีอิสระ'}</strong>
                  {lastSyncedTime && ` · อัปเดตล่าสุด: ${lastSyncedTime}`}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onSwitchCloud}
                  className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-300 font-bold text-slate-800 text-xs shadow-2xs transition-colors cursor-pointer"
                >
                  สลับโหมด Cloud
                </button>
                <button
                  type="button"
                  onClick={handleManualFetch}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-2xs transition-colors cursor-pointer"
                >
                  ทดสอบการเชื่อมต่อ
                </button>
              </div>
            </div>
          </div>

          {/* Firebase Security Rules Guide Card */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm sm:text-base">
                    การตั้งค่าสิทธิ์ Firebase Security Rules
                  </h4>
                  <p className="text-xs text-slate-500">
                    เพื่อให้ทุกเครื่องและสมาร์ทโฟนของช่างอ่าน-เขียนข้อมูลสต๊อกได้โดยไม่ติดสิทธิ์ (Permission Denied)
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={copyRulesCode}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-400 text-xs font-bold transition-colors cursor-pointer shadow-2xs self-start sm:self-auto"
              >
                {copiedRules ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedRules ? 'คัดลอกโค้ดแล้ว' : 'คัดลอกโค้ด Rules'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700 block">
                  โค้ด Security Rules สำหรับวางใน Firebase Console:
                </label>
                <div className="relative">
                  <pre className="p-3 bg-slate-950 text-emerald-400 rounded-xl text-[11px] font-mono leading-relaxed overflow-x-auto border border-slate-800">
{`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}`}
                  </pre>
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-2">
                <span className="font-bold text-slate-900 block flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-sky-600" />
                  <span>3 ขั้นตอนเปิดสิทธิ์บน Firebase Console:</span>
                </span>
                <ol className="list-decimal list-inside space-y-1 text-slate-600 leading-relaxed pl-1">
                  <li>เปิด <strong className="text-slate-900">Firebase Console</strong> เลือกโปรเจกต์ <code className="bg-white px-1 rounded font-mono">{projectId}</code></li>
                  <li>ไปที่เมนู <strong className="text-slate-900">Firestore Database</strong> &gt; แท็บ <strong className="text-slate-900">Rules</strong></li>
                  <li>วางโค้ดด้านบนแทนที่ของเดิม แล้วกดปุ่ม <strong className="text-emerald-700">Publish</strong> มุมขวาบน</li>
                </ol>
                <a
                  href={`https://console.firebase.google.com/project/${projectId}/firestore/rules`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-amber-700 hover:text-amber-800 font-bold underline mt-1"
                >
                  <span>เปิดหน้า Rules บน Firebase Console</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* CATEGORY 2: BACKUP & RESTORE (การสำรองและกู้คืน)                */}
      {/* ============================================================== */}
      {activeCategory === 'backup' && (
        <div className="space-y-6">
          {/* Quick Backup Controls */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center font-bold">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base sm:text-lg">
                    คำสั่งสำรองข้อมูลและกู้คืน
                  </h3>
                  <p className="text-xs text-slate-500">
                    สำรองข้อมูลอัตโนมัติ สร้าง Snapshot ย้อนหลัง หรือสำรองข้อมูล 2 ชั้น
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleBackupNow}
                  disabled={isBackingUpNow}
                  className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-xs transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{isBackingUpNow ? 'กำลังสำรองข้อมูล...' : 'สำรองข้อมูลทันที (Snapshot Now)'}</span>
                </button>
              </div>
            </div>

            {/* 3 Columns: Auto Backup / Double Backup / JSON Files */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Sub-card 1: Auto-backup configuration */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 flex flex-col justify-between">
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-amber-600" />
                      <span>สำรองข้อมูลอัตโนมัติ</span>
                    </span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={backupConfig.enabled}
                        onChange={(e) => updateConfig({ enabled: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                    </label>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                      ความถี่ในการสำรอง:
                    </label>
                    <select
                      disabled={!backupConfig.enabled}
                      value={backupConfig.intervalMinutes}
                      onChange={(e) => updateConfig({ intervalMinutes: Number(e.target.value) })}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 disabled:opacity-50"
                    >
                      <option value={5}>ทุก 5 นาที</option>
                      <option value={10}>ทุก 10 นาที (แนะนำ)</option>
                      <option value={15}>ทุก 15 นาที</option>
                      <option value={30}>ทุก 30 นาที</option>
                      <option value={60}>ทุก 1 ชั่วโมง</option>
                    </select>
                  </div>

                  <div className="space-y-1.5 text-[11px] text-slate-700">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={backupConfig.autoSyncCloud}
                        onChange={(e) => updateConfig({ autoSyncCloud: e.target.checked })}
                        className="rounded text-amber-500"
                      />
                      <span>ซิงค์ Cloud อัตโนมัติ</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={backupConfig.saveLocalSnapshots}
                        onChange={(e) => updateConfig({ saveLocalSnapshots: e.target.checked })}
                        className="rounded text-amber-500"
                      />
                      <span>เก็บ 10 จุดสำรองในเครื่อง</span>
                    </label>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200 text-[10px] text-slate-500">
                  สำรองล่าสุด: {backupConfig.lastBackupTime ? new Date(backupConfig.lastBackupTime).toLocaleTimeString('th-TH') : 'รอรอบแรก'}
                </div>
              </div>

              {/* Sub-card 2: Double Backup (2-tier protection) */}
              {onDoubleBackup && (
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-3 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-amber-600" />
                        <span>Double Backup (2 ชั้น)</span>
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500 text-slate-950">
                        ปลอดภัยสูง
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      บันทึกพร้อมกันทั้ง 1) Firestore Cloud, 2) Local Snapshot ในเครื่อง และ 3) ดาวน์โหลดไฟล์ JSON อัตโนมัติ
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <button
                      type="button"
                      onClick={() => onDoubleBackup()}
                      disabled={isDoubleBackingUp}
                      className="w-full py-2 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-2xs cursor-pointer disabled:opacity-60"
                    >
                      {isDoubleBackingUp ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <ShieldCheck className="w-3.5 h-3.5" />
                      )}
                      <span>{isDoubleBackingUp ? 'กำลังทำ Double Backup...' : 'ทำ Double Backup ตอนนี้'}</span>
                    </button>
                    {lastDoubleBackupTime && (
                      <div className="text-[10px] text-slate-500 text-center font-mono">
                        ล่าสุด: {new Date(lastDoubleBackupTime).toLocaleTimeString('th-TH')}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Sub-card 3: JSON File Import & Export */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 flex flex-col justify-between">
                <div>
                  <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5 mb-1.5">
                    <FileText className="w-4 h-4 text-slate-600" />
                    <span>ไฟล์สำรองเครื่อง (.JSON)</span>
                  </span>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    ส่งออกและนำเข้าไฟล์สำรองเพื่อย้ายเครื่องหรือเก็บสำรองในแฟลชไดรฟ์
                  </p>
                </div>

                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => exportFullBackupJSON(rolls, records)}
                    className="w-full py-2 px-3 rounded-lg bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-500" />
                    <span>ดาวน์โหลดไฟล์ JSON</span>
                  </button>

                  <label className="w-full py-2 px-3 rounded-lg bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer">
                    <Upload className="w-3.5 h-3.5 text-amber-600" />
                    <span>นำเข้าไฟล์ JSON เพื่อกู้คืน</span>
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleImportFile}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* Cloudflare D1 External Backup Section */}
            <div className="p-4 rounded-xl bg-sky-50/80 border border-sky-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Server className="w-4 h-4 text-sky-600" />
                  <span className="font-bold text-xs text-slate-900">
                    สำรองนอกระบบด้วย Cloudflare D1 (External Snapshot)
                  </span>
                </div>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-600 text-white">
                  แยกอิสระจาก Firebase
                </span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                เก็บ snapshot ม้วนและประวัติตัดสต๊อกบน Cloudflare D1 เพื่อใช้กู้ข้อมูลกรณีคลาวด์หลักขัดข้อง
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={d1Busy}
                  onClick={async () => {
                    setD1Busy(true);
                    setD1Status(null);
                    try {
                      const r = await testD1Connection(d1Config);
                      setD1Status(r.message);
                      showToast(r.message, r.ok ? 'success' : 'info');
                      if (r.ok && d1Config.secret) {
                        const list = await listD1Backups(15);
                        setD1List(list);
                      }
                    } catch (err: any) {
                      setD1Status(String(err?.message || err));
                      showToast(String(err?.message || err), 'info');
                    } finally {
                      setD1Busy(false);
                    }
                  }}
                  className="py-2 px-3 rounded-lg bg-white border border-sky-300 text-sky-900 text-xs font-bold cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${d1Busy ? 'animate-spin' : ''}`} />
                  <span>ทดสอบเชื่อมต่อ D1</span>
                </button>

                <button
                  type="button"
                  disabled={d1Busy || userMode !== 'editor'}
                  onClick={async () => {
                    if (userMode !== 'editor') {
                      onRequestUnlock?.();
                      return;
                    }
                    setD1Busy(true);
                    try {
                      const result = await uploadBackupToD1({
                        rolls,
                        records,
                        label: 'จากแอปโรงงาน',
                        reason: 'manual',
                      });
                      setD1Config(getD1BackupConfig());
                      setD1Status(`สำรองสำเร็จ · id ${result.id.slice(0, 10)}`);
                      showToast('สำรอง snapshot ขึ้น Cloudflare D1 สำเร็จ');
                      const list = await listD1Backups(15);
                      setD1List(list);
                    } catch (err: any) {
                      setD1Status(String(err?.message || err));
                      showToast(String(err?.message || err), 'info');
                    } finally {
                      setD1Busy(false);
                    }
                  }}
                  className="py-2 px-3 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>สำรองขึ้น Cloudflare D1 ตอนนี้</span>
                </button>
              </div>

              {d1Status && (
                <p className="text-[11px] text-slate-700 bg-white rounded-lg p-2 border border-sky-100 font-mono">
                  {d1Status}
                </p>
              )}
            </div>
          </div>

          {/* Snapshots History Timeline */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <History className="w-5 h-5 text-amber-500" />
                  <span>จุดสำรองข้อมูลย้อนหลัง (Snapshot Timeline)</span>
                </h3>
                <p className="text-xs text-slate-500">
                  เก็บจุดสำรองล่าสุดสูงสุด 10 จุด กู้คืนได้ปลอดภัยโดยไม่ทำให้ข้อมูลสูญหาย
                </p>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-mono">
                {snapshots.length} / 10 จุด
              </span>
            </div>

            {snapshots.length === 0 ? (
              <div className="text-center py-10 px-4 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50">
                <Clock className="w-9 h-9 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700">ยังไม่มีประวัติจุดสำรอง</p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  กดปุ่ม "สำรองข้อมูลทันที" ด้านบน หรือรอให้ระบบอัตโนมัติทำงานเพื่อบันทึกประวัติ
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
                {snapshots.map((s, idx) => {
                  const date = new Date(s.timestamp);
                  const reasonLabel = 
                    s.reason === 'double_backup' ? 'Double Backup (2 ชั้น)' :
                    s.reason === 'manual' ? 'สำรองด้วยตนเอง' :
                    s.reason === 'before_cut' ? 'อัตโนมัติก่อนตัดสต๊อก' :
                    s.reason === 'before_reset' ? 'ก่อนรีเซ็ต/กู้คืน' : 'อัตโนมัติตามรอบเวลา';
                  
                  return (
                    <div key={s.id} className="p-3.5 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-mono text-xs font-bold shrink-0 mt-0.5 ${
                          idx === 0 ? 'bg-amber-500 text-slate-950 shadow-xs' : 'bg-slate-100 text-slate-600'
                        }`}>
                          #{idx + 1}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-sm">
                              {date.toLocaleDateString('th-TH')} {date.toLocaleTimeString('th-TH')}
                            </span>
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                              s.reason === 'double_backup' ? 'bg-amber-100 text-amber-900 font-bold border border-amber-300' :
                              s.reason === 'manual' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-700'
                            }`}>
                              {reasonLabel}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-3">
                            <span>ฟอยล์ <strong>{s.rollsCount}</strong> ม้วน</span>
                            <span>•</span>
                            <span>ตัดไป <strong>{s.recordsCount}</strong> รายการ</span>
                            <span>•</span>
                            <span>คงเหลือรวม <strong>{s.totalRemainingMeters.toLocaleString()}</strong> ม.</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <button
                          type="button"
                          onClick={() => handleRestoreSnapshot(s.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-amber-50 text-slate-800 hover:text-amber-900 border border-slate-200 hover:border-amber-300 text-xs font-bold transition-all cursor-pointer shadow-xs"
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                          <span>กู้คืนจุดนี้</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSnapshot(s.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer text-sm"
                          title="ลบจุดสำรองนี้"
                        >
                          &times;
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* CATEGORY 3: AUDIT & STOCK TOOLS (ตรวจสอบ & นับสต๊อก)             */}
      {/* ============================================================== */}
      {activeCategory === 'audit' && (
        <div className="space-y-6">
          {/* Audit Tools Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Tool 1: Stock Integrity Check */}
            {onRunIntegrityCheck && (
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-slate-900 text-sm flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-blue-600" />
                      <span>ตรวจสอบความถูกต้องสต๊อก</span>
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">
                      อัตโนมัติ 2 ครั้ง/วัน
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    ตรวจเช็กยอดคงเหลือของทุกม้วนเทียบกับผลรวมของรายการตัด SO จริง ป้องกันยอดผิดเพี้ยน
                  </p>
                </div>

                <div className="space-y-2 pt-2">
                  <button
                    type="button"
                    onClick={() => onRunIntegrityCheck()}
                    disabled={isRunningIntegrityCheck}
                    className="w-full py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-colors shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                  >
                    {isRunningIntegrityCheck ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <ShieldCheck className="w-3.5 h-3.5" />
                    )}
                    <span>ตรวจสอบตอนนี้</span>
                  </button>
                  {integrityCheckState && (
                    <div className="text-[10px] text-slate-500 text-center font-mono">
                      ตรวจวันนี้: {integrityCheckState.count}/2 ครั้ง
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tool 2: SO Bug Inspector */}
            {onOpenSOAudit && (
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-slate-900 text-sm flex items-center gap-2">
                      <Bug className="w-4 h-4 text-amber-600" />
                      <span>ตรวจหาบัคจากประวัติ SO</span>
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-900">
                      ตรวจจับเชิงลึก
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    วิเคราะห์ประวัติการตัด SO รายม้วนอย่างละเอียด ตรวจสอบยอดกระโดดและปรับยอดอัตโนมัติ
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={onOpenSOAudit}
                    className="w-full py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Bug className="w-3.5 h-3.5 text-amber-400" />
                    <span>เปิดระบบตรวจหาบัค SO</span>
                  </button>
                </div>
              </div>
            )}

            {/* Tool 3: Cycle Count */}
            {(onOpenCycleCount || onOpenCycleCountHistory) && (
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-slate-900 text-sm flex items-center gap-2">
                      <ClipboardList className="w-4 h-4 text-violet-600" />
                      <span>ตรวจนับสต๊อกประจำงวด</span>
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-100 text-violet-800">
                      Variance
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    นับยอดจริงรายม้วน เปรียบเทียบกับยอดในระบบ บันทึกส่วนต่างและปรับยอดเมื่อปิดงวด
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2">
                  {onOpenCycleCount && (
                    <button
                      type="button"
                      onClick={onOpenCycleCount}
                      className="py-2.5 px-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs transition-colors shadow-2xs flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <ClipboardList className="w-3.5 h-3.5" />
                      <span>นับสต๊อก</span>
                    </button>
                  )}
                  {onOpenCycleCountHistory && (
                    <button
                      type="button"
                      onClick={onOpenCycleCountHistory}
                      className="py-2.5 px-2 rounded-xl bg-white hover:bg-violet-50 text-violet-800 border border-violet-300 font-bold text-xs transition-colors flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <History className="w-3.5 h-3.5" />
                      <span>ประวัติงวด</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Date-Organized Folders Section */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                  <FolderArchive className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-base">
                    โฟลเดอร์จัดเก็บแยกตามวันที่ (รับเข้า & ตัด SO)
                  </h4>
                  <p className="text-xs text-slate-500">
                    แยกจัดเก็บข้อมูลเป็นโฟลเดอร์ตามวันที่รับเข้าฟอยล์ และวันที่ตัดงานใบสั่งผลิต SO
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => exportDateOrganizedArchiveJSON(rolls, records)}
                className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-400 text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer self-start sm:self-auto"
              >
                <Download className="w-3.5 h-3.5" />
                <span>ดาวน์โหลดทั้ง 2 โฟลเดอร์ (.JSON)</span>
              </button>
            </div>

            {/* Folders 2 Columns */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Column 1: Incoming */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                  <span className="flex items-center gap-1.5">
                    <FolderOpen className="w-4 h-4 text-amber-600" />
                    <span>โฟลเดอร์รับเข้าสต๊อก ({incomingDateFolders.length} วัน)</span>
                  </span>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {incomingDateFolders.slice(0, 10).map((f) => (
                    <div key={f.date} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-slate-900">{f.displayDate}</span>
                        <div className="text-[11px] text-slate-500">{f.totalRolls} ม้วน · {formatMeters(f.totalMeters)} ม.</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => exportIncomingDateCSV(f.date, f.rolls)}
                        className="px-2 py-1 bg-white hover:bg-amber-50 text-slate-700 border border-slate-200 rounded-lg text-[11px] font-bold shadow-2xs cursor-pointer"
                      >
                        CSV
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Column 2: Cuts */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                  <span className="flex items-center gap-1.5">
                    <FolderOpen className="w-4 h-4 text-emerald-600" />
                    <span>โฟลเดอร์ตัด SO ({cutsDateFolders.length} วัน)</span>
                  </span>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {cutsDateFolders.slice(0, 10).map((f) => (
                    <div key={f.date} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                      <div className="min-w-0 pr-2">
                        <span className="font-bold text-slate-900">{f.displayDate}</span>
                        <div className="text-[11px] text-slate-500 truncate">{f.records.length} ครั้ง · ใช้ {formatMeters(f.totalUsedMeters)} ม.</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => exportCutsDateCSV(f.date, f.records)}
                        className="px-2 py-1 bg-white hover:bg-emerald-50 text-slate-700 border border-slate-200 rounded-lg text-[11px] font-bold shadow-2xs cursor-pointer"
                      >
                        CSV
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* CATEGORY 4: SYSTEM & ACCESS (สิทธิ์ใช้งาน & ระบบ)              */}
      {/* ============================================================== */}
      {activeCategory === 'system' && (
        <div className="space-y-6">
          {/* User Mode & Access Card */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
              <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
                <Sliders className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  สิทธิ์การใช้งานและโหมดคีย์ข้อมูล
                </h3>
                <p className="text-xs text-slate-500">
                  สลับโหมดผู้เข้าชม (ดูได้อย่างเดียว) หรือโหมดคีย์ข้อมูล (ต้องใส่รหัสผ่าน)
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-600">สถานะสิทธิ์ปัจจุบัน:</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                    userMode === 'editor'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-amber-100 text-amber-800 border border-amber-300'
                  }`}>
                    {userMode === 'editor' ? 'โหมดคีย์ข้อมูล (Editor)' : 'โหมดผู้เข้าชม (Visitor)'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  {userMode === 'editor'
                    ? 'คุณได้รับสิทธิ์ในการเพิ่มม้วน ตัดสต๊อก แก้ไข และสำรองข้อมูล'
                    : 'โหมดป้องกันการกดผิดพลาด สามารถดูยอดสต๊อกได้ หากต้องการแก้ไขกรุณากดปลดล็อค'}
                </p>
              </div>

              {userMode === 'visitor' ? (
                <button
                  type="button"
                  onClick={() => onRequestUnlock?.()}
                  className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>ใส่รหัสผ่านปลดล็อค</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onRequestUnlock?.()}
                  className="px-3.5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Unlock className="w-3.5 h-3.5 text-emerald-600" />
                  <span>สลับเป็นโหมดผู้เข้าชม</span>
                </button>
              )}
            </div>
          </div>

          {/* Mobile PWA Installation Guide Card */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
              <div className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-bold">
                <Smartphone className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  คู่มือติดตั้งแอปบนสมาร์ทโฟน (PWA)
                </h3>
                <p className="text-xs text-slate-500">
                  วิธีติดตั้งเว็บแอปให้มีไอคอนบนหน้าจอโฮมและเปิดแบบเต็มหน้าจอ เสมือนแอปมือถือจริง
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                <span className="font-bold text-slate-900 block">สำหรับ iPhone / iPad (Safari):</span>
                <ol className="list-decimal list-inside space-y-1.5 text-slate-600 leading-relaxed pl-1">
                  <li>เปิดเว็บไซต์ในเบราว์เซอร์ <strong>Safari</strong></li>
                  <li>แตะปุ่ม <strong>แชร์ (Share)</strong> รูปกล่องสี่เหลี่ยมลูกศรชี้ขึ้น</li>
                  <li>เลือก <strong>"เพิ่มไปยังหน้าจอโฮม (Add to Home Screen)"</strong></li>
                  <li>กด <strong>"เพิ่ม"</strong> มุมขวาบน จะได้ไอคอนแอปบนหน้าจอทันที</li>
                </ol>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                <span className="font-bold text-slate-900 block">สำหรับ Android (Google Chrome):</span>
                <ol className="list-decimal list-inside space-y-1.5 text-slate-600 leading-relaxed pl-1">
                  <li>เปิดเว็บไซต์ใน <strong>Google Chrome</strong></li>
                  <li>แตะที่ <strong>จุด 3 จุด (เมนู)</strong> มุมขวาบน</li>
                  <li>เลือก <strong>"ติดตั้งแอป (Install App)"</strong> หรือ "เพิ่มลงในหน้าจอหลัก"</li>
                  <li>กดยืนยัน แอปจะเปิดใช้งานแบบเต็มหน้าจอไม่มีแถบ URL รบกวน</li>
                </ol>
              </div>
            </div>
          </div>

          {/* Danger Zone: Reset Data */}
          {onResetData && (
            <div className="bg-rose-50/60 rounded-2xl p-5 border border-rose-200 space-y-3">
              <div className="flex items-center gap-2 text-rose-900">
                <AlertOctagon className="w-5 h-5 text-rose-600 shrink-0" />
                <h4 className="font-bold text-sm">เขตอันตราย (Danger Zone)</h4>
              </div>
              <p className="text-xs text-rose-700 leading-relaxed">
                การรีเซ็ตข้อมูลจะโหลดข้อมูลม้วนฟอยล์และประวัติตัวอย่างมาตรฐานใหม่ (ระบบจะสร้างจุดสำรองฉุกเฉินของข้อมูลเดิมไว้ให้อัตโนมัติก่อนรีเซ็ต)
              </p>
              <button
                type="button"
                onClick={() => {
                  handleActionGuarded(() => {
                    if (confirm('คุณต้องการรีเซ็ตข้อมูลสต๊อกทั้งหมดกลับเป็นชุดตัวอย่างเริ่มต้นใช่หรือไม่?\n\n(ระบบจะสร้างจุดสำรองข้อมูลปัจจุบันไว้ให้ก่อน)')) {
                      onResetData();
                      showToast('รีเซ็ตข้อมูลตัวอย่างเรียบร้อย');
                    }
                  });
                }}
                className="py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-colors shadow-2xs cursor-pointer"
              >
                รีเซ็ตข้อมูลกลับสู่ค่าเริ่มต้น
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
