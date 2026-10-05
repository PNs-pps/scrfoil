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
  RefreshCw,
  Zap,
  Bug,
  ClipboardList,
  Sparkles,
  Cloud
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
  showToast: (text: string, type?: 'success' | 'error' | 'info') => void;
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
}

export type SettingsSubTab = 
  | 'backup'       // สำรอง & กู้คืน (Auto Backup, Snapshots, Export/Import JSON, Reset)
  | 'cycle_count'  // ตรวจนับสต๊อกจริง (Physical Cycle Count & History comparison)
  | 'audit'        // ตรวจสอบ & บัค (Integrity Check & SO Audit Inspector)
  | 'cloud'        // คลาวด์ & D1 (Firebase Sync, Cloudflare D1, Force Full Fetch, Rules)
  | 'folders'      // โฟลเดอร์วันที่ (Date-grouped folders)
  | 'mobile';      // ใช้งานบนมือถือ (PWA Mobile)

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
}) => {
  const [activeSubTab, setActiveSubTab] = useState<SettingsSubTab>('backup');
  
  // Backup config state
  const [backupConfig, setBackupConfig] = useState<AutoBackupConfig>(getAutoBackupConfig());
  const [snapshots, setSnapshots] = useState<AutoBackupSnapshot[]>(getBackupSnapshots());

  // Cloudflare D1 snapshot backup
  const [d1Config, setD1Config] = useState(getD1BackupConfig());
  const [d1List, setD1List] = useState<D1BackupListItem[]>([]);
  const [d1Busy, setD1Busy] = useState(false);
  const [d1Status, setD1Status] = useState<string | null>(null);
  const [copiedRules, setCopiedRules] = useState(false);
  const [isBackingUpNow, setIsBackingUpNow] = useState(false);

  // Date Grouped Folders for Incoming and Cuts
  const incomingDateFolders = useMemo(() => groupRollsByDateReceived(rolls), [rolls]);
  const cutsDateFolders = useMemo(() => groupCutsByDate(records), [records]);

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
    showToast('บันทึกการตั้งค่าการสำรองเรียบร้อย');
  };

  // Manual snapshot trigger
  const handleCreateManualSnapshot = () => {
    try {
      setIsBackingUpNow(true);
      const { result } = createBackupSnapshot(rolls, records, 'manual');
      setSnapshots(getBackupSnapshots());
      if (result.ok) {
        showToast(
          result.dropped > 0
            ? `สร้างจุดสำรองข้อมูลเรียบร้อย (พื้นที่เครื่องเต็ม — ลบจุดสำรองเก่าออก ${result.dropped} จุดเพื่อให้พอ)`
            : 'สร้างจุดสำรองข้อมูลเรียบร้อย'
        );
      } else {
        showToast(
          'สร้างจุดสำรองไม่สำเร็จ: พื้นที่จัดเก็บในเครื่องเต็ม — กรุณาลบจุดสำรองเก่า หรือใช้การสำรองขึ้น D1',
          'error'
        );
      }
    } catch {
      showToast('ไม่สามารถสร้างจุดสำรองได้', 'error');
    } finally {
      setIsBackingUpNow(false);
    }
  };

  // Guard for destructive actions that claim to snapshot first — if the snapshot
  // didn't land, the user must not be told it's recoverable from there.
  const snapshotOrWarn = (reason: 'before_reset', blockOnFailure = true): boolean => {
    const { result } = createBackupSnapshot(rolls, records, reason);
    if (!result.ok) {
      showToast(
        'บันทึกจุดสำรองก่อนดำเนินการไม่สำเร็จ (พื้นที่เครื่องเต็ม) — การกู้คืนจากจุดสำรองนี้ไม่ได้ กรุณาสำรองขึ้น D1 ก่อน',
        'error'
      );
      return !blockOnFailure;
    }
    return true;
  };

  // Restore snapshot
  const handleRestoreSnapshot = (id: string) => {
    handleActionGuarded(() => {
      const snap = snapshots.find((s) => s.id === id);
      if (!snap) return;

      const dateStr = new Date(snap.timestamp).toLocaleString('th-TH');
      const confirmMsg = `ยืนยันการกู้คืนข้อมูลกลับไปที่จุดสำรอง:\n\nเวลา: ${dateStr}\nจำนวนฟอยล์: ${snap.rollsCount} ม้วน\nจำนวนตัด: ${snap.recordsCount} รายการ\n\n(ระบบจะสร้างจุดสำรองข้อมูลปัจจุบันไว้ให้อัตโนมัติ)`;

      if (window.confirm(confirmMsg)) {
        if (!snapshotOrWarn('before_reset')) return;
        const restored = restoreSnapshot(id);
        if (restored) {
          onRestoreData(restored.rolls, restored.records);
          setSnapshots(getBackupSnapshots());
          showToast('กู้คืนข้อมูลสำเร็จเรียบร้อย');
        } else {
          showToast('เกิดข้อผิดพลาดในการกู้คืน', 'error');
        }
      }
    });
  };

  // Delete snapshot
  const handleDeleteSnapshot = (id: string) => {
    handleActionGuarded(() => {
      if (window.confirm('คุณต้องการลบจุดสำรองนี้ใช่หรือไม่?')) {
        deleteSnapshot(id);
        setSnapshots(getBackupSnapshots());
        showToast('ลบจุดสำรองเรียบร้อย');
      }
    });
  };

  // Import JSON file
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleActionGuarded(() => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const text = event.target?.result as string;
          const res = parseAndValidateBackupJSON(text);

          if (!res.rolls.length && !res.records.length) {
            alert('ไม่พบข้อมูลม้วนฟอยล์หรือรายการตัดที่ถูกต้องในไฟล์นี้');
            return;
          }

          const confirmMsg = `ตรวจพบข้อมูลสำรอง:\n- ม้วนฟอยล์: ${res.rolls.length} ม้วน\n- ประวัติการตัด: ${res.records.length} รายการ\n\nคุณต้องการนำเข้าเพื่อแทนที่ข้อมูลปัจจุบันใช่หรือไม่? (ระบบจะสร้างจุดสำรองก่อนหน้าไว้ให้)`;

          if (window.confirm(confirmMsg)) {
            if (!snapshotOrWarn('before_reset')) return;
            onRestoreData(res.rolls, res.records);
            setSnapshots(getBackupSnapshots());
            showToast('นำเข้าไฟล์และกู้คืนข้อมูลสำเร็จ');
          }
        } catch (err: any) {
          alert(`ไฟล์ไม่ถูกต้อง: ${err?.message || err}`);
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    });
  };

  return (
    <div className="space-y-6">
      {/* Header Banner & Cloud Sync Overview */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-900 text-amber-300 font-mono">
                System Administration
              </span>
              <span className="text-xs text-slate-500 font-mono">Siam Cool Roof Stock</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 mt-1 flex items-center gap-2">
              ตั้งค่า & เครื่องมือระบบ
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">
              จัดหมวดหมู่เครื่องมือการสำรองข้อมูล, ตรวจนับสต๊อกจริง, วินิจฉัยความถูกต้อง, ฐานข้อมูลคลาวด์ และโฟลเดอร์แยกตามวันที่
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleCreateManualSnapshot}
              disabled={isBackingUpNow}
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isBackingUpNow ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5 text-amber-400" />
              )}
              <span>สำรองข้อมูลทันที</span>
            </button>

            {onDoubleBackup && (
              <button
                type="button"
                onClick={onDoubleBackup}
                disabled={isDoubleBackingUp}
                className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                title="สำรอง 2 ชั้น (Firebase + จุดสำรองในเครื่อง)"
              >
                {isDoubleBackingUp ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ShieldCheck className="w-3.5 h-3.5 text-slate-950" />
                )}
                <span>สำรอง 2 ชั้น</span>
              </button>
            )}
          </div>
        </div>

        {/* Sub Navigation Categorized Tabs */}
        <div className="flex items-center gap-1.5 mt-5 border-t border-slate-100 pt-3.5 overflow-x-auto text-xs">
          <button
            onClick={() => setActiveSubTab('backup')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === 'backup'
                ? 'bg-slate-900 text-amber-400 shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>สำรอง & กู้คืน</span>
          </button>

          <button
            onClick={() => setActiveSubTab('cycle_count')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === 'cycle_count'
                ? 'bg-slate-900 text-amber-400 shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <ClipboardList className="w-4 h-4 text-violet-500" />
            <span>ตรวจนับสต๊อกจริง</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-violet-100 text-violet-900 font-bold">
              Cycle Count
            </span>
          </button>

          <button
            onClick={() => setActiveSubTab('audit')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === 'audit'
                ? 'bg-slate-900 text-amber-400 shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-blue-500" />
            <span>ตรวจสอบ & ตรวจบัค</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-900 font-bold">
              2 ทูล
            </span>
          </button>

          <button
            onClick={() => setActiveSubTab('cloud')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === 'cloud'
                ? 'bg-slate-900 text-amber-400 shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Database className="w-4 h-4 text-emerald-500" />
            <span>คลาวด์ & D1</span>
            {syncStatus === 'permission-denied' && (
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            )}
          </button>

          <button
            onClick={() => setActiveSubTab('folders')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === 'folders'
                ? 'bg-slate-900 text-amber-400 shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <FolderArchive className="w-4 h-4 text-amber-500" />
            <span>โฟลเดอร์วันที่</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-amber-200 text-amber-950 font-bold">
              {incomingDateFolders.length + cutsDateFolders.length}
            </span>
          </button>

          <button
            onClick={() => setActiveSubTab('mobile')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === 'mobile'
                ? 'bg-slate-900 text-amber-400 shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Smartphone className="w-4 h-4 text-slate-500" />
            <span>แอปมือถือ</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: AUTO BACKUP, LOCAL SNAPSHOTS & EXPORT/IMPORT JSON                   */}
      {/* ========================================================================= */}
      {activeSubTab === 'backup' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Settings Control Column */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-xs space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
                    <Clock className="w-4 h-4" />
                  </div>
                  <h3 className="font-bold text-slate-900 text-base">ตั้งค่าการสำรอง</h3>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={backupConfig.enabled}
                    onChange={(e) => updateConfig({ enabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
              </div>

              <div className="space-y-4 pt-2">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                    ความถี่ในการสำรองข้อมูลอัตโนมัติ
                  </label>
                  <select
                    disabled={!backupConfig.enabled}
                    value={backupConfig.intervalMinutes}
                    onChange={(e) => updateConfig({ intervalMinutes: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 disabled:opacity-50"
                  >
                    <option value={5}>ทุก 5 นาที (บ่อยที่สุด)</option>
                    <option value={10}>ทุก 10 นาที (แนะนำสำหรับโรงงาน)</option>
                    <option value={15}>ทุก 15 นาที</option>
                    <option value={30}>ทุก 30 นาที</option>
                    <option value={60}>ทุก 1 ชั่วโมง</option>
                  </select>
                </div>

                <div className="space-y-2.5 pt-2">
                  <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                    <div className="text-xs">
                      <span className="font-bold text-slate-800 block">สำรองลงคลาวด์ Firebase</span>
                      <span className="text-slate-500">ซิงค์ฐานข้อมูลกลางอัตโนมัติ</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={backupConfig.autoSyncCloud}
                      onChange={(e) => updateConfig({ autoSyncCloud: e.target.checked })}
                      className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                    <div className="text-xs">
                      <span className="font-bold text-slate-800 block">เก็บประวัติจุดสำรองในเครื่อง (Snapshots)</span>
                      <span className="text-slate-500">เก็บ 10 จุดสำรองล่าสุด กู้คืนได้ทันที</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={backupConfig.saveLocalSnapshots}
                      onChange={(e) => updateConfig({ saveLocalSnapshots: e.target.checked })}
                      className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400"
                    />
                  </label>
                </div>
              </div>

              {/* Status Banner */}
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">ระบบสำรองข้อมูลอัตโนมัติเปิดทำงานอยู่</span>
                  <span className="text-emerald-700">
                    สำรองล่าสุดเมื่อ: {backupConfig.lastBackupTime ? new Date(backupConfig.lastBackupTime).toLocaleTimeString('th-TH') : 'กำลังรอรอบแรก'}
                  </span>
                </div>
              </div>

              {/* Export / Import File Actions */}
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <button
                  onClick={() => exportFullBackupJSON(rolls, records)}
                  className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition-colors cursor-pointer"
                >
                  <Download className="w-4 h-4 text-slate-600" />
                  <span>ดาวน์โหลดไฟล์สำรองทั้งหมด (.JSON)</span>
                </button>

                <label className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 font-bold text-xs transition-colors cursor-pointer">
                  <Upload className="w-4 h-4 text-amber-600" />
                  <span>นำเข้าไฟล์สำรอง (.JSON) เพื่อกู้คืน</span>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportFile}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Danger Zone: Reset Data */}
              {onResetData && (
                <div className="pt-3 border-t border-rose-100">
                  <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 space-y-2">
                    <div className="flex items-center gap-2 text-rose-900">
                      <RotateCcw className="w-4 h-4 text-rose-600 shrink-0" />
                      <span className="font-bold text-xs">รีเซ็ตข้อมูลเริ่มต้น (Reset Data)</span>
                    </div>
                    <p className="text-[11px] text-rose-700 leading-relaxed">
                      โหลดข้อมูลม้วนฟอยล์และประวัติตัวอย่างมาตรฐานใหม่ (ระบบจะสร้างจุดสำรองข้อมูลก่อนหน้าไว้ให้อัตโนมัติ)
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm('คุณต้องการรีเซ็ตข้อมูลสต๊อกทั้งหมดกลับเป็นชุดตัวอย่างเริ่มต้นใช่หรือไม่?\n\n(ระบบจะสร้างจุดสำรองข้อมูลปัจจุบันไว้ให้ก่อน)')) {
                          onResetData();
                          showToast('รีเซ็ตข้อมูลตัวอย่างเรียบร้อย');
                        }
                      }}
                      className="w-full py-2 px-3 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-colors shadow-2xs cursor-pointer"
                    >
                      รีเซ็ตข้อมูลกลับสู่ค่าเริ่มต้น
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Snapshots History Table Column */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-xs space-y-4">
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
                <div className="text-center py-12 px-4 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50">
                  <Clock className="w-10 h-10 text-slate-300 mx-auto mb-2" />
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
                      s.reason === 'double_backup' ? 'สำรอง 2 ชั้น (Double Backup)' :
                      s.reason === 'manual' ? 'สำรองด้วยตนเอง' :
                      s.reason === 'before_cut' ? 'อัตโนมัติก่อนตัดสต๊อก' :
                      s.reason === 'before_reset' ? 'ก่อนรีเซ็ต/กู้คืน' : 'อัตโนมัติตามรอบเวลา';
                    
                    return (
                      <div key={s.id} className="p-4 hover:bg-slate-50/80 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
                            onClick={() => handleRestoreSnapshot(s.id)}
                            title="กู้คืนข้อมูลกลับไปจุดเวลานี้"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-amber-50 text-slate-800 hover:text-amber-900 border border-slate-200 hover:border-amber-300 text-xs font-bold transition-all cursor-pointer shadow-xs"
                          >
                            <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                            <span>กู้คืนจุดนี้</span>
                          </button>
                          <button
                            onClick={() => handleDeleteSnapshot(s.id)}
                            title="ลบจุดสำรองนี้"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
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
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: CYCLE COUNT (ตรวจนับสต๊อกจริง & เปรียบเทียบงวด)                       */}
      {/* ========================================================================= */}
      {activeSubTab === 'cycle_count' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-violet-500/10 text-violet-600 flex items-center justify-center font-bold">
                    <ClipboardList className="w-5 h-5 stroke-[2.2]" />
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900">
                    ระบบตรวจนับสต๊อกจริงประจำงวด (Physical Inventory Cycle Count)
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  นับยอดจริงรายม้วนหน้างาน เปรียบเทียบกับยอดในระบบ บันทึกผลต่าง (Variance) และสาเหตุ พร้อมปรับปรุงฐานข้อมูลให้ตรงของจริง
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Tool 1: นับสต๊อกงวดนี้ */}
            {onOpenCycleCount && (
              <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                      <div className="w-8 h-8 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center">
                        <ClipboardList className="w-4 h-4" />
                      </div>
                      <span>บันทึกตรวจนับสต๊อกจริง (งวดปัจจุบัน)</span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-900">
                      ตรวจนับรายม้วน
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    เปิดตารางบันทึกการนับม้วนฟอยล์จริงหน้างาน คำนวณผลต่าง (Variance เมตร) อัตโนมัติ เลือกระบุเหตุผลความคลาดเคลื่อน และยืนยันปรับยอดสต๊อกเข้าสู่ระบบ
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={onOpenCycleCount}
                    className="w-full py-2.5 px-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs transition-colors shadow-2xs flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <ClipboardList className="w-4 h-4" />
                    <span>เปิดแบบบันทึกตรวจนับสต๊อก (Cycle Count)</span>
                  </button>
                </div>
              </div>
            )}

            {/* Tool 2: ประวัติ & เปรียบเทียบงวด */}
            {onOpenCycleCountHistory && (
              <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                      <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                        <History className="w-4 h-4" />
                      </div>
                      <span>ประวัติการตรวจนับ & เปรียบเทียบผลต่าง</span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900">
                      Audit Trail
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    ดูรายงานผลการตรวจนับย้อนหลังแต่ละเดือน ตรวจสอบสถิติม้วนที่ตรง/ไม่ตรง วิเคราะห์สาเหตุความผิดพลาดของสต๊อก และดาวน์โหลดสรุปรายงาน
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={onOpenCycleCountHistory}
                    className="w-full py-2.5 px-3 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 font-bold text-xs transition-colors shadow-2xs flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <History className="w-4 h-4 text-violet-600" />
                    <span>ดูประวัติการนับสต๊อก & เปรียบเทียบงวด</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* SOP Guide Card */}
          <div className="bg-slate-50 rounded-2xl p-4 sm:p-5 border border-slate-200/80 space-y-2">
            <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-violet-600" />
              <span>แนวทางปฏิบัติมาตรฐานสำหรับการตรวจนับสต๊อกโรงงาน (Standard Operating Procedure):</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-600 pt-1">
              <div className="bg-white p-3 rounded-xl border border-slate-200/80 space-y-1">
                <span className="font-bold text-slate-900 block font-mono text-[11px]">1. สแกนตรวจสอบหน้าม้วน</span>
                <p className="text-[11px] leading-relaxed">ตรวจสอบแท็กเลขล็อตและเบอร์ม้วนให้ตรงกับที่ระบุในระบบ</p>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-200/80 space-y-1">
                <span className="font-bold text-slate-900 block font-mono text-[11px]">2. บันทึกผลต่าง & เหตุผล</span>
                <p className="text-[11px] leading-relaxed">หากยอดจริงไม่ตรง ให้ระบุสาเหตุ เช่น เศษหัวม้วนเสีย, ฉีกขาด หรือตัดทิ้ง</p>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-200/80 space-y-1">
                <span className="font-bold text-slate-900 block font-mono text-[11px]">3. ปิดงวดและปรับยอด</span>
                <p className="text-[11px] leading-relaxed">ยืนยันปิดงวดตรวจนับเพื่อให้ระบบปรับปรุงยอดคงเหลือในฐานข้อมูลให้ตรงจริง</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: AUDIT & DIAGNOSTIC TOOLS (ตรวจสอบ & ตรวจบัค)                         */}
      {/* ========================================================================= */}
      {activeSubTab === 'audit' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold">
                    <ShieldCheck className="w-5 h-5 stroke-[2.2]" />
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900">
                    เครื่องมือตรวจสอบความถูกต้อง & วินิจฉัยสต๊อก (Integrity & Bug Audit)
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  ตรวจสอบความถูกต้องอัตโนมัติ (Integrity Check) และตรวจจับข้อผิดพลาดของไทม์ไลน์โซ่ประวัติ SO รายม้วน
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Tool 1: ตรวจสอบความถูกต้องสต๊อก */}
            {onRunIntegrityCheck && (
              <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                      <span>ตรวจสอบความถูกต้องของสต๊อก</span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                      อัตโนมัติ 2 ครั้ง/วัน
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    ตรวจเช็คว่ายอดคงเหลือของทุกม้วนตรงกับผลรวมรายการตัด SO จริงหรือไม่ ป้องกันยอดเพี้ยน หากพบจุดไม่ตรงระบบสามารถซ่อมแซมยอดม้วนให้ตรงกับฐานข้อมูลจริงได้ทันที
                  </p>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => onRunIntegrityCheck()}
                    disabled={isRunningIntegrityCheck}
                    className="w-full py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-colors shadow-2xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    {isRunningIntegrityCheck ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <ShieldCheck className="w-4 h-4" />
                    )}
                    <span>{isRunningIntegrityCheck ? 'กำลังตรวจสอบ...' : 'เริ่มตรวจสอบความถูกต้องตอนนี้'}</span>
                  </button>
                  {integrityCheckState && (
                    <div className="text-[11px] text-slate-500 text-center font-mono">
                      วันนี้ตรวจอัตโนมัติแล้ว {integrityCheckState.count}/2 ครั้ง
                      {integrityCheckState.lastCheckedAt && (
                        <> • ล่าสุด {new Date(integrityCheckState.lastCheckedAt).toLocaleTimeString('th-TH')}</>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tool 2: ตรวจหาบัค SO เชิงลึก */}
            {onOpenSOAudit && (
              <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                      <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                        <Bug className="w-4 h-4" />
                      </div>
                      <span>ตรวจหาบัคจากประวัติ SO แต่ละลูก</span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900">
                      ตรวจจับโซ่ขาด
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    วิเคราะห์ไทม์ไลน์ตัด SO รายม้วนอย่างละเอียด ตรวจสอบยอดคงเหลือโซ่ขาด (ยอดกระโดด) และเปรียบเทียบยอดตัดจริง พร้อมฟังก์ชันปรับยอดและจัดเรียงโซ่ประวัติใหม่ให้ถูกต้อง
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={onOpenSOAudit}
                    className="w-full py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors shadow-2xs flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Bug className="w-4 h-4 text-amber-400" />
                    <span>เปิดระบบตรวจหาบัค SO เชิงลึก (Audit Inspector)</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: CLOUD STORAGE, D1 & RULES                                          */}
      {/* ========================================================================= */}
      {activeSubTab === 'cloud' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
                    <Database className="w-5 h-5 stroke-[2.2]" />
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900">
                    ฐานข้อมูลคลาวด์ & สำรอง Cloudflare D1
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  จัดการการเชื่อมต่อ Firebase Cloud, สำรองข้อมูลขึ้น Cloudflare D1 และดึงประวัติสต๊อกทั้งหมด
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 ${
                  syncStatus === 'connected' 
                    ? 'bg-emerald-100 text-emerald-800' 
                    : syncStatus === 'permission-denied'
                    ? 'bg-rose-100 text-rose-800 border border-rose-300'
                    : 'bg-amber-100 text-amber-800'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${
                    syncStatus === 'connected' ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'
                  }`} />
                  {syncStatus === 'connected' && 'เชื่อมต่อ Cloud สำเร็จ'}
                  {syncStatus === 'permission-denied' && 'รอเปิดสิทธิ์ Rules ใน Console'}
                  {syncStatus === 'syncing' && 'กำลังซิงค์...'}
                  {syncStatus === 'offline' && 'โหมดออฟไลน์ (Local)'}
                  {syncStatus === 'error' && 'ข้อผิดพลาดการเชื่อมต่อ'}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Cloudflare D1 Snapshot Backup */}
            <div className="bg-sky-50/70 rounded-2xl p-5 border border-sky-200/90 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-sky-500 text-white flex items-center justify-center font-bold">
                    <Cloud className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">
                      สำรอง snapshot ขึ้น Cloudflare D1
                    </h4>
                    <p className="text-[11px] text-sky-900/80">
                      ฐานข้อมูลสำรองระยะไกลอีกหนึ่งชั้น (นอกเหนือจาก Firebase)
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3 text-xs">
                <label className="flex items-center justify-between p-3 rounded-xl bg-white border border-sky-200 cursor-pointer">
                  <div>
                    <span className="font-bold text-slate-800 block">สำรองอัตโนมัติขึ้น D1</span>
                    <span className="text-[11px] text-slate-500">
                      รอบเวลา 12:30 น. และ 17:30 น. ของทุกวัน
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={backupConfig.autoSyncD1}
                    onChange={(e) => updateConfig({ autoSyncD1: e.target.checked })}
                    className="w-4 h-4 rounded text-sky-600 focus:ring-sky-400"
                  />
                </label>

                {backupConfig.autoSyncD1 && backupConfig.lastD1AutoBackupTime && (
                  <p className="text-[10px] text-sky-800 font-mono">
                    สำรองอัตโนมัติขึ้น D1 ล่าสุด: {new Date(backupConfig.lastD1AutoBackupTime).toLocaleString('th-TH')}
                  </p>
                )}

                {userMode === 'editor' ? (
                  <div className="space-y-2">
                    <div>
                      <label className="text-[11px] text-slate-600 block mb-1 font-medium">Worker URL:</label>
                      <input
                        type="url"
                        placeholder="https://foil-stock-d1-backup.xxx.workers.dev"
                        value={d1Config.workerUrl}
                        onChange={(e) => {
                          const next = saveD1BackupConfig({ workerUrl: e.target.value });
                          setD1Config(next);
                        }}
                        className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-sky-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-600 block mb-1 font-medium">รหัสลับ BACKUP_SECRET:</label>
                      <input
                        type="password"
                        placeholder="BACKUP_SECRET"
                        value={d1Config.secret}
                        onChange={(e) => {
                          const next = saveD1BackupConfig({ secret: e.target.value });
                          setD1Config(next);
                        }}
                        className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-sky-200 rounded-lg"
                        autoComplete="off"
                      />
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => onRequestUnlock?.()}
                    className="w-full flex items-center justify-center gap-1.5 px-2.5 py-2 text-xs font-bold text-sky-900 bg-white border border-dashed border-sky-300 rounded-lg cursor-pointer"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Worker URL / รหัสลับ — ปลดล็อคโหมดแก้ไขเพื่อดูและตั้งค่า</span>
                  </button>
                )}

                {d1Status && (
                  <p className="text-[11px] text-slate-700 bg-white/90 rounded px-2.5 py-1.5 border border-sky-200 font-mono">
                    {d1Status}
                  </p>
                )}

                <div className="grid grid-cols-2 gap-2 pt-1">
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
                    className="py-2 px-2.5 rounded-lg bg-white border border-sky-300 text-sky-900 text-xs font-bold cursor-pointer disabled:opacity-50"
                  >
                    ทดสอบเชื่อมต่อ
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
                      setD1Status(null);
                      try {
                        const result = await uploadBackupToD1({
                          rolls,
                          records,
                          label: 'จากแอปโรงงาน',
                          reason: 'manual',
                        });
                        setD1Config(getD1BackupConfig());
                        setD1Status(`สำรองสำเร็จ · id ${result.id}`);
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
                    className="py-2 px-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1"
                  >
                    {d1Busy ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    <span>สำรองขึ้น D1</span>
                  </button>
                </div>

                {/* D1 Backup List */}
                {d1List.length > 0 && (
                  <div className="max-h-40 overflow-y-auto space-y-1.5 border-t border-sky-200 pt-2">
                    {d1List.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-1 text-[11px] bg-white rounded-lg px-2.5 py-1.5 border border-sky-100"
                      >
                        <div className="min-w-0">
                          <div className="font-mono font-bold text-slate-800 truncate">
                            {new Date(item.created_at).toLocaleString('th-TH')}
                          </div>
                          <div className="text-slate-500 text-[10px]">
                            {item.rolls_count} ม้วน · {item.records_count} ตัด
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            disabled={d1Busy || userMode !== 'editor'}
                            title="กู้คืนลงแอป (แทนที่ข้อมูลปัจจุบัน)"
                            onClick={async () => {
                              if (userMode !== 'editor') {
                                onRequestUnlock?.();
                                return;
                              }
                              if (
                                !confirm(
                                  `กู้คืนจาก D1?\n${new Date(item.created_at).toLocaleString('th-TH')}\n${item.rolls_count} ม้วน · ${item.records_count} รายการตัด\n\nระบบจะสร้างจุดสำรองฉุกเฉินในเครื่องก่อน`
                                )
                              ) {
                                return;
                              }
                              setD1Busy(true);
                              try {
                                // D1 holds its own copy of the payload, so a failed
                                // local snapshot here is a warning, not a blocker.
                                snapshotOrWarn('before_reset', false);
                                const full = await fetchD1Backup(item.id);
                                const payload = full.payload;
                                if (!payload?.rolls || !payload?.records) {
                                  throw new Error('snapshot ไม่มีข้อมูล rolls/records');
                                }
                                onRestoreData(payload.rolls, payload.records);
                                setSnapshots(getBackupSnapshots());
                                showToast('กู้คืนจาก Cloudflare D1 สำเร็จ');
                                setD1Status(`กู้แล้ว · ${item.id.slice(0, 10)}…`);
                              } catch (err: any) {
                                showToast(String(err?.message || err), 'info');
                              } finally {
                                setD1Busy(false);
                              }
                            }}
                            className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold cursor-pointer disabled:opacity-40"
                          >
                            กู้
                          </button>
                          <button
                            type="button"
                            disabled={d1Busy || userMode !== 'editor'}
                            onClick={async () => {
                              if (userMode !== 'editor') {
                                onRequestUnlock?.();
                                return;
                              }
                              if (!confirm('ลบ snapshot นี้บน D1?')) return;
                              setD1Busy(true);
                              try {
                                await deleteD1Backup(item.id);
                                setD1List((prev) => prev.filter((x) => x.id !== item.id));
                                showToast('ลบ snapshot บน D1 แล้ว');
                              } catch (err: any) {
                                showToast(String(err?.message || err), 'info');
                              } finally {
                                setD1Busy(false);
                              }
                            }}
                            className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 font-bold cursor-pointer disabled:opacity-40"
                          >
                            ลบ
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Firebase Cloud Connection & Fetch Tools */}
            <div className="space-y-5">
              {/* Tool: ดึงประวัติทั้งหมดจากคลาวด์ */}
              {onFetchFullHistory && (
                <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                        <Database className="w-4 h-4" />
                      </div>
                      <span>ดึงประวัติสต๊อกทั้งหมดจาก Cloud</span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900">
                      Force Full Fetch
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    บังคับดึงข้อมูลประวัติการตัดสต๊อกย้อนหลังทั้งหมดจาก Cloud Firestore ลงมาเก็บไว้ในแคชเครื่อง เพื่อความแม่นยำในการดูรายงานแบบออฟไลน์
                  </p>

                  <div className="pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => onFetchFullHistory()}
                      disabled={isFetchingFullHistory}
                      className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors shadow-2xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                    >
                      {isFetchingFullHistory ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Database className="w-4 h-4" />
                      )}
                      <span>{isFetchingFullHistory ? 'กำลังดึงข้อมูล...' : 'ดึงประวัติทั้งหมดจาก Cloud ตอนนี้'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Firebase Target Information & Switcher */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs space-y-3">
                <div className="flex items-center gap-2 font-bold text-slate-900 text-sm pb-2 border-b border-slate-100">
                  <Server className="w-4 h-4 text-amber-500" />
                  <span>โปรเจกต์ Firebase & ฐานข้อมูลกลาง</span>
                </div>

                <div className="text-xs space-y-1">
                  <span className="text-slate-500 block">Firebase Project ID:</span>
                  <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-1 rounded block">
                    {projectId}
                  </span>
                  <span className="text-[11px] text-slate-500 block pt-1">
                    เป้าหมาย: <strong>{isManagedTarget ? 'Cloud กลางระบบ (พร้อมใช้ทันที)' : 'Firebase ของคุณเอง'}</strong>
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={onSwitchCloud}
                    className="py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold cursor-pointer transition-colors"
                  >
                    สลับเป้าหมาย Cloud
                  </button>
                  <button
                    type="button"
                    onClick={onManualFetchFromCloud}
                    className="py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer transition-colors"
                  >
                    ทดสอบเชื่อมต่อ
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: DATE-SEPARATED FOLDERS (รับเข้า & ตัด SO)                           */}
      {/* ========================================================================= */}
      {activeSubTab === 'folders' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <FolderArchive className="w-5 h-5 text-amber-500" />
                  <h3 className="text-base sm:text-lg font-bold text-slate-900">
                    โฟลเดอร์จัดเก็บข้อมูลแยกตามวันที่ (Date-Organized Folders)
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  จัดกลุ่มม้วนฟอยล์ที่รับเข้า และรายการตัดสต๊อก SO แยกตามวันที่ เพื่อความสะดวกในการตรวจสอบบัญชีและส่งออก CSV
                </p>
              </div>
              <button
                type="button"
                onClick={() => exportDateOrganizedArchiveJSON(rolls, records)}
                className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>ส่งออกคลังวันที่ (.JSON)</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Column 1: Incoming Rolls Folders */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <FolderOpen className="w-5 h-5 text-amber-500" />
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm sm:text-base">
                      โฟลเดอร์รับเข้าสต๊อก (แยกตามวันที่รับ)
                    </h4>
                    <p className="text-xs text-slate-500">
                      มีทั้งหมด {incomingDateFolders.length} โฟลเดอร์วันที่
                    </p>
                  </div>
                </div>
              </div>

              {incomingDateFolders.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs font-mono">
                  ยังไม่มีข้อมูลม้วนฟอยล์รับเข้า
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                  {incomingDateFolders.map((folder) => (
                    <div
                      key={folder.date}
                      className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-amber-300 transition-all space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Folder className="w-4 h-4 text-amber-500 shrink-0" />
                          <div>
                            <span className="font-bold text-slate-900 text-xs sm:text-sm">
                              {folder.displayDate}
                            </span>
                            <span className="text-[11px] font-mono text-slate-500 ml-2">
                              ({folder.date})
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => exportIncomingDateCSV(folder.date, folder.rolls)}
                          className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-amber-50 text-slate-700 text-xs font-semibold flex items-center gap-1 cursor-pointer shadow-2xs"
                        >
                          <Download className="w-3 h-3 text-slate-400" />
                          <span>ดาวน์โหลด CSV</span>
                        </button>
                      </div>

                      <div className="flex items-center justify-between text-xs font-mono text-slate-600 bg-white px-3 py-1.5 rounded-lg border border-slate-100">
                        <span>จำนวนม้วน: <strong className="text-slate-900">{folder.totalRolls}</strong> ม้วน</span>
                        <span>เมตรลูกเต็มรวม: <strong className="text-amber-800">{formatMeters(folder.totalMeters)}</strong> ม.</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Column 2: Cuts SO Folders */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <FolderOpen className="w-5 h-5 text-emerald-600" />
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm sm:text-base">
                      โฟลเดอร์ตัดสต๊อก SO (แยกตามวันที่ตัด)
                    </h4>
                    <p className="text-xs text-slate-500">
                      มีทั้งหมด {cutsDateFolders.length} โฟลเดอร์วันที่
                    </p>
                  </div>
                </div>
              </div>

              {cutsDateFolders.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs font-mono">
                  ยังไม่มีข้อมูลประวัติการตัดสต๊อก SO
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                  {cutsDateFolders.map((folder) => (
                    <div
                      key={folder.date}
                      className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-emerald-300 transition-all space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Folder className="w-4 h-4 text-emerald-500 shrink-0" />
                          <div>
                            <span className="font-bold text-slate-900 text-xs sm:text-sm">
                              {folder.displayDate}
                            </span>
                            <span className="text-[11px] font-mono text-slate-500 ml-2">
                              ({folder.records.length} ครั้ง)
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => exportCutsDateCSV(folder.date, folder.records)}
                          className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-emerald-50 text-slate-700 text-xs font-semibold flex items-center gap-1 cursor-pointer shadow-2xs"
                        >
                          <Download className="w-3 h-3 text-slate-400" />
                          <span>ดาวน์โหลด CSV</span>
                        </button>
                      </div>

                      <div className="text-xs text-slate-500 truncate">
                        SO: {folder.uniqueSoList.join(', ')}
                      </div>

                      <div className="flex items-center justify-between text-xs font-mono text-slate-600 bg-white px-3 py-1.5 rounded-lg border border-slate-100">
                        <span>ตัดใช้: <strong className="text-slate-900">{formatMeters(folder.totalUsedMeters)}</strong> ม.</span>
                        {folder.totalNgMeters > 0 && (
                          <span>NG: <strong className="text-rose-600">{formatMeters(folder.totalNgMeters)}</strong> ม.</span>
                        )}
                        <span>รวมตัด: <strong className="text-emerald-700">{formatMeters(folder.totalDeductedMeters)}</strong> ม.</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: MOBILE ANDROID & IOS EXPERIENCE                                    */}
      {/* ========================================================================= */}
      {activeSubTab === 'mobile' && (
        <div className="bg-white rounded-2xl p-5 sm:p-7 border border-slate-200 shadow-xs space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                การใช้งานบนโทรศัพท์มือถือ Android และ iPhone / iPad (iOS)
              </h3>
              <p className="text-xs sm:text-sm text-slate-600">
                ระบบถูกออกแบบให้เป็น Mobile-First Web App พร้อมปุ่มสัมผัสขนาดใหญ่ เมนูนำทางด้านล่าง และทำงานเสมือนแอปจริง
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* iOS Guide */}
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 text-sm">สำหรับ iPhone / iPad (Safari)</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-200 text-slate-800">iOS</span>
              </div>
              <ol className="text-xs text-slate-700 space-y-2 list-decimal list-inside leading-relaxed">
                <li>เปิดลิงก์เว็บไซต์ในเบราว์เซอร์ <strong>Safari</strong></li>
                <li>กดที่ปุ่ม <strong>แชร์ (Share)</strong> รูปสี่เหลี่ยมมีลูกศรชี้ขึ้น ด้านล่างหน้าจอ</li>
                <li>เลื่อนลงมาแล้วเลือก <strong>"เพิ่มไปยังหน้าจอโฮม (Add to Home Screen)"</strong></li>
                <li>กด <strong>"เพิ่ม (Add)"</strong> มุมขวาบน จะมีไอคอนแอปตัดสต๊อกฟอยล์ปรากฏบนหน้าจอมือถือของคุณทันที!</li>
              </ol>
            </div>

            {/* Android Guide */}
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 text-sm">สำหรับโทรศัพท์ Android (Google Chrome)</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-200 text-slate-800">Android</span>
              </div>
              <ol className="text-xs text-slate-700 space-y-2 list-decimal list-inside leading-relaxed">
                <li>เปิดลิงก์เว็บไซต์ในเบราว์เซอร์ <strong>Google Chrome</strong></li>
                <li>กดที่ <strong>จุด 3 จุด (เมนู)</strong> บริเวณมุมขวาบนของหน้าจอ</li>
                <li>เลือก <strong>"ติดตั้งแอป (Install App)"</strong> หรือ <strong>"เพิ่มลงในหน้าจอหลัก"</strong></li>
                <li>กดยืนยัน แอปจะเปิดใช้งานแบบเต็มหน้าจอ (Standalone) ไม่มีแถบ URL รบกวน สะดวกต่อการเดินตรวจเช็กหน้างาน</li>
              </ol>
            </div>
          </div>

          {/* Responsive Features highlights */}
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 text-xs space-y-2">
            <span className="font-bold flex items-center gap-1.5 text-amber-900">
              <Info className="w-4 h-4" />
              <span>ความสามารถพิเศษสำหรับผู้ใช้งานผ่านโทรศัพท์มือถือ:</span>
            </span>
            <ul className="list-disc list-inside space-y-1 text-slate-700 pl-1">
              <li><strong>แถบนำทางล่างหน้าจอ (Bottom Navigation Bar):</strong> กดเปลี่ยนหน้าและกดตัดสต๊อกได้ด้วยมือเดียวอย่างคล่องตัว</li>
              <li><strong>เน้น Lot, No. และยอดคงเหลือ:</strong> ย่อรายละเอียดคำอธิบายที่ไม่จำเป็นลงเพื่อให้เห็นข้อมูลสำคัญได้ทันที</li>
              <li><strong>รองรับ Safe Area Inset:</strong> หน้าจอไม่ถูกรอยบาก Notch หรือแถบด้านล่างของ iPhone / Android บัง</li>
              <li><strong>ป้องกัน Auto-Zoom:</strong> ช่องกรอกตัวเลขและรหัส SO ได้รับการปรับแต่งขนาดตัวอักษรเพื่อไม่ให้หน้าจอดิ้นหรือขยายอัตโนมัติขณะพิมพ์</li>
              <li><strong>ปุ่มตัดสต๊อกเด่นชัด:</strong> ให้ช่างและผู้ดูแลสต๊อกสามารถกดบันทึกตัดยอด SO ได้อย่างรวดเร็วหน้าเครื่องจักร</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
