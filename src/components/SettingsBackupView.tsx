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
  Zap
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
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'backup' | 'folders' | 'permissions' | 'mobile'>('backup');
  
  // Backup config state
  const [backupConfig, setBackupConfig] = useState<AutoBackupConfig>(getAutoBackupConfig());
  const [snapshots, setSnapshots] = useState<AutoBackupSnapshot[]>(getBackupSnapshots());
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
    showToast('บันทึกการตั้งค่าสำรองข้อมูลเรียบร้อย');
  };

  // Immediate manual snapshot & cloud backup
  const handleBackupNow = async () => {
    setIsBackingUpNow(true);
    try {
      // 1. Local Snapshot
      const snap = createBackupSnapshot(rolls, records, 'manual');
      setSnapshots(getBackupSnapshots());
      
      // 2. Cloud Backup if connected
      if (backupConfig.autoSyncCloud) {
        await onManualSaveToCloud();
      }

      showToast(`สร้างจุดสำรองข้อมูลสำเร็จ (#${snap.id.slice(-4)}) เรียบร้อยแล้ว`);
    } catch (err) {
      showToast('สร้างจุดสำรองเรียบร้อย (แจ้งเตือนคลาวด์)', 'info');
    } finally {
      setIsBackingUpNow(false);
    }
  };

  // Restore snapshot
  const handleRestoreSnapshot = (snapshotId: string) => {
    const snap = snapshots.find(s => s.id === snapshotId);
    if (!snap) return;

    if (confirm(`คุณต้องการกู้คืนข้อมูลกลับไปจุดสำรองนี้หรือไม่?\n\nวันเวลา: ${new Date(snap.timestamp).toLocaleString('th-TH')}\nจำนวนม้วนฟอยล์: ${snap.rollsCount} ม้วน\nประวัติตัดสต๊อก: ${snap.recordsCount} รายการ\n\n(ระบบจะสร้างจุดสำรองฉุกเฉินของข้อมูลปัจจุบันไว้ให้ก่อน)`)) {
      // Create safety snapshot before restoring
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
  };

  // Delete snapshot
  const handleDeleteSnapshot = (snapshotId: string) => {
    deleteSnapshot(snapshotId);
    setSnapshots(getBackupSnapshots());
    showToast('ลบจุดสำรองแล้ว');
  };

  // Import JSON backup file
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
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
    showToast('คัดลอกโค้ด Rules สำเร็จ');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200">
                SYSTEM CONFIGURATION
              </span>
              <span className="text-xs text-slate-500 font-mono">ระบบจัดการสต๊อกฟอยล์ PWA</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">
              การตั้งค่าและระบบสำรองข้อมูล
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
              จัดการการสำรองข้อมูลอัตโนมัติ สิทธิ์ Firebase Rules คลาวด์กลาง และคู่มือใช้งานบนมือถือ
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleBackupNow}
              disabled={isBackingUpNow}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm shadow-xs transition-all active:scale-[0.98] cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{isBackingUpNow ? 'กำลังสำรองข้อมูล...' : 'สำรองข้อมูลทันที'}</span>
            </button>
          </div>
        </div>

        {/* Sub Navigation Pills */}
        <div className="flex items-center gap-2 mt-6 border-b border-slate-100 pb-3 overflow-x-auto">
          <button
            onClick={() => setActiveSubTab('backup')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === 'backup'
                ? 'bg-slate-900 text-amber-400 shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>ระบบสำรองข้อมูล & รีเซ็ต</span>
          </button>

          <button
            onClick={() => setActiveSubTab('folders')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === 'folders'
                ? 'bg-slate-900 text-amber-400 shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <FolderArchive className="w-4 h-4 text-amber-500" />
            <span>โฟลเดอร์แยกตามวันที่ (รับเข้า & ตัด SO)</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-amber-200 text-amber-950 font-bold">
              {incomingDateFolders.length + cutsDateFolders.length}
            </span>
          </button>

          <button
            onClick={() => setActiveSubTab('permissions')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === 'permissions'
                ? 'bg-slate-900 text-amber-400 shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>สิทธิ์ Rules & คลาวด์กลาง</span>
            {syncStatus === 'permission-denied' && (
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            )}
          </button>

          <button
            onClick={() => setActiveSubTab('mobile')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === 'mobile'
                ? 'bg-slate-900 text-amber-400 shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>ใช้งานบนมือถือ Android/iOS</span>
          </button>
        </div>
      </div>

      {/* TAB 1: AUTO BACKUP & SNAPSHOTS */}
      {activeSubTab === 'backup' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Settings Control Card */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-5">
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
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 disabled:opacity-50"
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

              {/* Double Backup Action Card */}
              {onDoubleBackup && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-slate-900 font-bold text-xs">
                      <ShieldCheck className="w-4 h-4 text-amber-600" />
                      <span>สำรองข้อมูล 2 ชั้น (Double Backup)</span>
                    </div>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500 text-slate-950">
                      2 ชั้น ปลอดภัยสูง
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    บันทึกข้อมูลพร้อมกันทั้ง <strong>1) Cloud Firestore</strong>, <strong>2) Local Snapshot ในเบราว์เซอร์</strong> และ <strong>3) ดาวน์โหลดไฟล์ JSON</strong> สำหรับเก็บในคอมพิวเตอร์หรือแฟลชไดรฟ์
                  </p>
                  <button
                    type="button"
                    onClick={() => onDoubleBackup()}
                    disabled={isDoubleBackingUp}
                    className="w-full py-2 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                  >
                    {isDoubleBackingUp ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <ShieldCheck className="w-3.5 h-3.5" />
                    )}
                    <span>ทำ Double Backup ตอนนี้</span>
                  </button>
                  {lastDoubleBackupTime && (
                    <div className="text-[10px] text-slate-500 text-center font-mono">
                      ทำ Double Backup ล่าสุด: {new Date(lastDoubleBackupTime).toLocaleString('th-TH')}
                    </div>
                  )}
                </div>
              )}

              {/* Stock Integrity Check Card */}
              {onRunIntegrityCheck && (
                <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-slate-900 font-bold text-xs">
                      <ShieldCheck className="w-4 h-4 text-blue-600" />
                      <span>ตรวจสอบความถูกต้องของสต๊อก</span>
                    </div>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500 text-white">
                      อัตโนมัติ 2 ครั้ง/วัน
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    ตรวจว่ายอดคงเหลือของทุกม้วนตรงกับผลรวมของรายการตัด SO จริงหรือไม่ ระบบจะรันให้เองอัตโนมัติสูงสุด 2 ครั้งต่อวัน (ครั้งแรกๆ ที่มีคนเปิดแอปในแต่ละวัน) หรือกดตรวจสอบเองตอนนี้ได้เลย
                  </p>
                  <button
                    type="button"
                    onClick={() => onRunIntegrityCheck()}
                    disabled={isRunningIntegrityCheck}
                    className="w-full py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-colors shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
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
                      วันนี้ตรวจอัตโนมัติไปแล้ว {integrityCheckState.count}/2 ครั้ง
                      {integrityCheckState.lastCheckedAt && (
                        <> • ล่าสุด {new Date(integrityCheckState.lastCheckedAt).toLocaleString('th-TH')}</>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Read Quota Optimization & Persistent Cache Status */}
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-slate-900 font-bold text-xs">
                    <Zap className="w-4 h-4 text-emerald-600" />
                    <span>ระบบลดการใช้ Read (Firestore Optimization)</span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    {isCached ? 'แคชในเครื่องทำงาน' : 'เปิดใช้งานแล้ว'}
                  </span>
                </div>

                <div className="space-y-1 text-[11px] text-slate-600 leading-relaxed">
                  <div className="flex items-start gap-1.5">
                    <span className="text-emerald-600 font-bold shrink-0">•</span>
                    <span><strong>IndexedDB Persistent Cache:</strong> ข้อมูลที่ไม่เปลี่ยนแปลงจะดึงจากเครื่องโดยตรง (0 Read สำหรับการรีเฟรชหรือเปิดหน้าซ้ำ)</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <span className="text-emerald-600 font-bold shrink-0">•</span>
                    <span><strong>Multi-Tab Sync:</strong> เปิดหลายแท็บพร้อมกันได้โดยใช้ Cache ร่วมกัน ไม่ดาวน์โหลดซ้ำ</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <span className="text-emerald-600 font-bold shrink-0">•</span>
                    <span><strong>Smart Realtime Window:</strong> ฟังประวัติล่าสุด 200 รายการ ช่วยประหยัด Read มหาศาลเมื่อเอกสารสะสมเยอะ</span>
                  </div>
                </div>

                {onFetchFullHistory && (
                  <button
                    type="button"
                    onClick={() => onFetchFullHistory()}
                    disabled={isFetchingFullHistory}
                    className="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                    title="ดึงประวัติการตัดสต๊อกทั้งหมดที่มีใน Cloud Firestore ลงมาเก็บในแคชเครื่อง"
                  >
                    {isFetchingFullHistory ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Database className="w-3.5 h-3.5" />
                    )}
                    <span>ดึงประวัติย้อนหลังทั้งหมดจาก Cloud (Force Full Fetch)</span>
                  </button>
                )}
              </div>

              {/* Export / Import File Actions */}
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <button
                  onClick={() => exportFullBackupJSON(rolls, records)}
                  className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs transition-colors cursor-pointer"
                >
                  <Download className="w-4 h-4 text-slate-600" />
                  <span>ดาวน์โหลดไฟล์สำรองทั้งหมด (.JSON)</span>
                </button>

                <label className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 font-semibold text-xs transition-colors cursor-pointer">
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

          {/* Snapshots History Table */}
          <div className="lg:col-span-2">
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
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
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

      {/* TAB: DATE-SEPARATED FOLDERS (รับเข้า & ตัด SO) */}
      {activeSubTab === 'folders' && (
        <div className="space-y-6">
          {/* Header Card */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
                    <FolderArchive className="w-5 h-5" />
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900">
                    บันทึกโฟลเดอร์แยกวันที่ (รับเข้าสต๊อก & ตัด SO)
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  แยกจัดเก็บไฟล์และข้อมูลเป็นโฟลเดอร์ตามวันที่รับเข้าฟอยล์ และวันที่ตัดงานใบสั่งผลิต SO เพื่อความสะดวกในการเรียกดูย้อนหลัง
                </p>
              </div>

              <div className="flex items-center flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => exportDateOrganizedArchiveJSON(rolls, records)}
                  className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-400 text-xs sm:text-sm font-bold flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>ดาวน์โหลดสำรองแยก 2 โฟลเดอร์ (JSON)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleActionGuarded(async () => {
                    await onManualSaveToCloud();
                    showToast('บันทึกข้อมูลจัดโฟลเดอร์ขึ้น Cloud สำเร็จแล้ว');
                  })}
                  className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs sm:text-sm font-bold flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
                >
                  {userMode === 'visitor' ? <Lock className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                  <span>บันทึกขึ้น Cloud ทันที</span>
                </button>
              </div>
            </div>

            {/* Folder Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-400 block text-[11px]">โฟลเดอร์รับเข้า</span>
                <span className="text-base font-bold font-mono text-slate-900">{incomingDateFolders.length} วัน</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-400 block text-[11px]">ม้วนรับเข้ารวม</span>
                <span className="text-base font-bold font-mono text-amber-700">{rolls.length} ม้วน</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-400 block text-[11px]">โฟลเดอร์ตัด SO</span>
                <span className="text-base font-bold font-mono text-slate-900">{cutsDateFolders.length} วัน</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-400 block text-[11px]">รายการตัด SO รวม</span>
                <span className="text-base font-bold font-mono text-emerald-700">{records.length} ครั้ง</span>
              </div>
            </div>
          </div>

          {/* 2 Column Folders Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Column 1: Incoming Folders */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <FolderOpen className="w-5 h-5 text-amber-600" />
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

      {/* TAB 2: PERMISSION RULES & FIREBASE CLOUD */}
      {activeSubTab === 'permissions' && (
        <div className="bg-white rounded-2xl p-5 sm:p-7 border border-slate-200 shadow-xs space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-6 h-6 text-amber-500" />
                <h3 className="text-lg font-bold text-slate-900">
                  การเปิดสิทธิ์ Firebase Rules & ฐานข้อมูลกลาง
                </h3>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 mt-1">
                การตั้งค่า Security Rules เพื่อให้เครื่องและโทรศัพท์มือถือทุกเครื่องสามารถอ่าน-เขียนข้อมูลสต๊อกฟอยล์ได้ทันที
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

          {/* Cloud Switcher & Target info */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs text-slate-500 block">โปรเจกต์ Firebase ที่กำลังเชื่อมต่อ:</span>
              <span className="font-mono text-sm font-bold text-slate-900">{projectId}</span>
              <span className="text-[11px] text-slate-500 block mt-0.5">
                เป้าหมาย: <strong>{isManagedTarget ? 'Cloud กลางระบบ (พร้อมใช้ทันที)' : 'Firebase ของคุณเอง'}</strong>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={onSwitchCloud}
                className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 text-xs font-bold shadow-xs cursor-pointer"
              >
                สลับโหมด Cloud (สลับเป้าหมาย)
              </button>
              <button
                onClick={onManualFetchFromCloud}
                className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                ทดสอบการเชื่อมต่อ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: MOBILE ANDROID & IOS EXPERIENCE */}
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
              <li><strong>รองรับ Safe Area Inset:</strong> หน้าจอไม่ถูกรอยบาก Notch หรือแถบด้านล่างของ iPhone / Android บัง</li>
              <li><strong>ป้องกัน Auto-Zoom:</strong> ช่องกรอกตัวเลขและรหัส SO ได้รับการปรับแต่งขนาดตัวอักษรเพื่อไม่ให้หน้าจอดิ้นหรือขยายอัตโนมัติขณะพิมพ์</li>
              <li><strong>ปุ่มตัดสต๊อกเด่นตรงกลาง:</strong> ให้ช่างและผู้ดูแลสต๊อกสามารถกดบันทึกตัดยอด SO ได้อย่างรวดเร็วหน้าเครื่องจักร</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
