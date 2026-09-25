import React, { useState, useEffect, useRef } from 'react';
import { FoilRoll, StockCutRecord, PuSandwichCutRecord } from './types';
import { 
  getStoredRolls, 
  saveStoredRolls, 
  getStoredCutRecords, 
  saveStoredCutRecords, 
  getStoredPuSandwichRecords,
  saveStoredPuSandwichRecords,
  resetAllDataToDefault,
  exportRollsToCSV,
  exportCutRecordsToCSV,
  exportPuSandwichRecordsToCSV
} from './utils/storage';
import { 
  subscribeToFoilRolls, 
  subscribeToStockCutRecords, 
  subscribeToPuSandwichCuts,
  savePuSandwichCutToFirestore,
  deletePuSandwichCutFromFirestore,
  saveFoilRollToFirestore, 
  deleteFoilRollFromFirestore, 
  executeCutBatchInFirestore, 
  executeMultiRollCutBatchInFirestore,
  revertCutRecordInFirestore, 
  reconcileRollsInFirestore,
  realignRollCutChainInFirestore,
  uploadAllToFirestore,
  testFirestoreConnection,
  fetchAllCutRecordsFromFirestore,
  fetchArchivedFoilRolls,
  saveCycleCountSession,
  applyCycleCountAdjustments,
  firebaseConfig,
  activeTarget,
  setActiveTarget
} from './lib/firebase';
import { CycleCountSession } from './types';
import { Navbar } from './components/Navbar';
import { FirebaseSyncBar } from './components/FirebaseSyncBar';
import { FirebaseRulesModal } from './components/FirebaseRulesModal';
import { DashboardOverview } from './components/DashboardOverview';
import { FoilRollTable } from './components/FoilRollTable';
import { CuttingHistoryTable } from './components/CuttingHistoryTable';
import { DailyProductionFlow } from './components/DailyProductionFlow';
import { AddFoilModal } from './components/AddFoilModal';
import { EditFoilModal } from './components/EditFoilModal';
import { CutStockModal } from './components/CutStockModal';
import { RollUsageHistoryModal } from './components/RollUsageHistoryModal';
import { MonthlySummaryModal } from './components/MonthlySummaryModal';
import { SOBatchImportModal } from './components/SOBatchImportModal';
import { SettingsBackupView } from './components/SettingsBackupView';
import { PuSandwichModal } from './components/PuSandwichModal';
import { PuSandwichView } from './components/PuSandwichView';
import { MobileBottomNav } from './components/MobileBottomNav';
import { PasswordPromptModal } from './components/PasswordPromptModal';
import { IntegrityCheckModal } from './components/IntegrityCheckModal';
import { SOBugInspectorModal } from './components/SOBugInspectorModal';
import { CycleCountModal } from './components/CycleCountModal';
import { auditAllRollsSOHistory } from './utils/soHistoryAudit';
import { getUserMode, setUserMode as saveUserMode, UserMode } from './utils/auth';
import { createBackupSnapshot, getAutoBackupConfig, saveAutoBackupConfig, exportFullBackupJSON } from './utils/autoBackup';
import { formatMeters, round2 } from './utils/formatters';
import { checkStockIntegrity, shouldRunAutoCheck, markAutoCheckRun, getCheckState, IntegrityMismatch } from './utils/integrityCheck';
import { CheckCircle2, AlertCircle, AlertTriangle, Sparkles, X } from 'lucide-react';

type AppTab = 'dashboard' | 'rolls' | 'history' | 'flow' | 'sandwich' | 'settings';

export default function App() {
  const [rolls, setRolls] = useState<FoilRoll[]>([]);
  const [archivedRolls, setArchivedRolls] = useState<FoilRoll[]>([]);
  const [archiveLoaded, setArchiveLoaded] = useState(false);
  const [isLoadingArchive, setIsLoadingArchive] = useState(false);
  const [records, setRecords] = useState<StockCutRecord[]>([]);
  const [puSandwichRecords, setPuSandwichRecords] = useState<PuSandwichCutRecord[]>([]);
  
  // Persistent activeTab so that reloading keeps the user on the exact page being viewed
  const [activeTab, setActiveTabRaw] = useState<AppTab>(() => {
    try {
      const hash = window.location.hash.replace('#', '') as AppTab;
      if (['dashboard', 'rolls', 'history', 'flow', 'sandwich', 'settings'].includes(hash)) {
        return hash;
      }
      const saved = sessionStorage.getItem('scrfoil_active_tab') as AppTab;
      if (saved && ['dashboard', 'rolls', 'history', 'flow', 'sandwich', 'settings'].includes(saved)) {
        return saved;
      }
    } catch {}
    return 'dashboard';
  });

  const setActiveTab = (tab: AppTab) => {
    setActiveTabRaw(tab);
    try {
      sessionStorage.setItem('scrfoil_active_tab', tab);
      window.history.replaceState(null, '', `#${tab}`);
    } catch {}
  };

  // Visitor vs Data Entry (Editor) Mode State
  const [userMode, setUserMode] = useState<UserMode>(() => getUserMode());
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [pendingGuardedAction, setPendingGuardedAction] = useState<(() => void) | null>(null);

  // Firebase Realtime Sync State
  const [syncStatus, setSyncStatus] = useState<'connected' | 'syncing' | 'error' | 'offline' | 'permission-denied'>('syncing');
  const [lastSyncedTime, setLastSyncedTime] = useState<string | null>(null);
  const [isSavingToCloud, setIsSavingToCloud] = useState(false);
  const [isDoubleBackingUp, setIsDoubleBackingUp] = useState(false);
  const [lastDoubleBackupTime, setLastDoubleBackupTime] = useState<string | null>(() => getAutoBackupConfig().lastDoubleBackupTime || null);
  const [isFetchingFromCloud, setIsFetchingFromCloud] = useState(false);
  const [isFetchingFullHistory, setIsFetchingFullHistory] = useState(false);
  const [isCached, setIsCached] = useState(true);
  // True when the realtime listener detects a change that came from ANOTHER
  // device (not an echo of our own write) — prompts the user to reload so
  // they're not looking at a stale page while they keep working.
  const [externalUpdateAvailable, setExternalUpdateAvailable] = useState(false);
  // Results of the daily stock-integrity check (roll remaining vs. its own cut
  // records). null = not checked yet this session; [] = checked, all good.
  const [stockIntegrityIssues, setStockIntegrityIssues] = useState<IntegrityMismatch[] | null>(null);
  const [showIntegrityModal, setShowIntegrityModal] = useState(false);
  const [isRunningIntegrityCheck, setIsRunningIntegrityCheck] = useState(false);

  // SO History Bug Inspector State
  const [isSOBugInspectorOpen, setIsSOBugInspectorOpen] = useState(false);
  const [soBugAuditTargetRollId, setSoBugAuditTargetRollId] = useState<string | null>(null);

  // Real-time calculation of SO bugs across all rolls
  const soAuditResults = React.useMemo(() => {
    return auditAllRollsSOHistory(rolls, records);
  }, [rolls, records]);

  const soBugCount = React.useMemo(() => {
    return soAuditResults.filter((r) => r.issues.length > 0).length;
  }, [soAuditResults]);

  const handleOpenSOAudit = (rollId?: string) => {
    setSoBugAuditTargetRollId(rollId || null);
    setIsSOBugInspectorOpen(true);
  };

  const runIntegrityCheck = (isManual: boolean = false) => {
    setIsRunningIntegrityCheck(true);
    const issues = checkStockIntegrity(rolls, records);
    setStockIntegrityIssues(issues);
    if (!isManual) {
      markAutoCheckRun();
    }
    if (issues.length > 0) {
      setShowIntegrityModal(true);
    } else if (isManual) {
      showToast('ตรวจสอบแล้ว ยอดคงเหลือของทุกม้วนตรงกับรายการตัด SO ทั้งหมด ✅');
    }
    setIsRunningIntegrityCheck(false);
  };
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);
  
  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isCutModalOpen, setIsCutModalOpen] = useState(false);
  const [isPuSandwichModalOpen, setIsPuSandwichModalOpen] = useState(false);
  const [cutModalInitialMode, setCutModalInitialMode] = useState<'so' | 'non_so'>('so');
  const [preselectedRollId, setPreselectedRollId] = useState<string | null>(null);
  const [detailRoll, setDetailRoll] = useState<FoilRoll | null>(null);
  const [editingRoll, setEditingRoll] = useState<FoilRoll | null>(null);
  const [isMonthlySummaryOpen, setIsMonthlySummaryOpen] = useState(false);
  const [isBatchImportOpen, setIsBatchImportOpen] = useState(false);
  const [isCycleCountOpen, setIsCycleCountOpen] = useState(false);

  // Error Alert Modal State
  const [errorAlert, setErrorAlert] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    detail?: string;
  }>({
    isOpen: false,
    title: '',
    message: '',
    detail: '',
  });

  // Feedback Toast
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' } | null>(null);

  const showToast = (text: string, type: 'success' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Realtime load & Firestore subscription (Optimized with Persistent Cache & Read limits)
  useEffect(() => {
    // 1. Initial fast local load from cache
    const loadedRolls = getStoredRolls();
    const loadedRecords = getStoredCutRecords();
    const loadedPuSandwich = getStoredPuSandwichRecords();
    setRolls(loadedRolls);
    setRecords(loadedRecords);
    setPuSandwichRecords(loadedPuSandwich);

    // 2. Realtime listener for Foil Rolls
    let isInitialRollsFetch = true;
    const unsubRolls = subscribeToFoilRolls(
      (firestoreRolls) => {
        // activeOnly query already filters status==='active'; also drop any legacy
        // depleted/zeroed that slipped through so the main list stays lean.
        const activeRolls = firestoreRolls.filter(
          (r) => r.status === 'active' && (r.remainingMeters > 0 || !r.isZeroedOut)
        );
        if (activeRolls.length > 0 || firestoreRolls.length === 0) {
          setRolls(activeRolls.length > 0 ? activeRolls : firestoreRolls);
          saveStoredRolls(activeRolls.length > 0 ? activeRolls : firestoreRolls);
        } else if (isInitialRollsFetch && loadedRolls.length > 0) {
          // If cloud is initially empty, seed from existing local rolls
          uploadAllToFirestore(loadedRolls, loadedRecords).catch((err) => {
            console.warn('Initial cloud seed notice:', err);
          });
        }
        isInitialRollsFetch = false;
        setSyncStatus('connected');
        setLastSyncedTime(new Date().toLocaleTimeString('th-TH'));
      },
      (err: any) => {
        console.warn('Foil rolls sync note:', err?.message || err);
        if (err?.code === 'permission-denied' || err?.message?.includes('permission')) {
          setSyncStatus('permission-denied');
        } else {
          setSyncStatus('offline');
        }
      },
      {
        activeOnly: true,
        onFromCache: (fromCache) => {
          setIsCached(fromCache);
        },
        onExternalChange: () => setExternalUpdateAvailable(true),
      }
    );

    // 3. Realtime listener for Cut Records (Optimized with 200 records window to minimize Read quota)
    const unsubRecords = subscribeToStockCutRecords(
      (firestoreRecords, removedIds) => {
        setRecords((prev) => {
          const map = new Map<string, StockCutRecord>();
          // Keep all existing historical records from local cache
          prev.forEach((r) => map.set(r.id, r));
          // Drop anything the server just told us was deleted (e.g. an SO cut
          // that was cancelled) — otherwise a plain "add/update only" merge
          // would keep a deleted record around forever in local cache.
          (removedIds || []).forEach((id) => map.delete(id));
          // Overlay updated recent records from Firestore
          firestoreRecords.forEach((r) => map.set(r.id, r));
          const merged = Array.from(map.values());
          merged.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
          saveStoredCutRecords(merged);
          return merged;
        });
        setSyncStatus('connected');
        setLastSyncedTime(new Date().toLocaleTimeString('th-TH'));
      },
      (err: any) => {
        console.warn('Stock cut records sync note:', err?.message || err);
        if (err?.code === 'permission-denied' || err?.message?.includes('permission')) {
          setSyncStatus('permission-denied');
        }
      },
      {
        limitCount: 200,
        onFromCache: (fromCache) => {
          setIsCached(fromCache);
        },
        onExternalChange: () => setExternalUpdateAvailable(true),
      }
    );

    // 4. Realtime listener for PU Sandwich Cuts (ไม่ใช้ฟอยล์)
    const unsubSandwich = subscribeToPuSandwichCuts(
      (firestoreSandwich) => {
        setPuSandwichRecords((prev) => {
          const map = new Map<string, PuSandwichCutRecord>();
          prev.forEach((r) => map.set(r.id, r));
          firestoreSandwich.forEach((r) => map.set(r.id, r));
          const merged = Array.from(map.values());
          merged.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
          saveStoredPuSandwichRecords(merged);
          return merged;
        });
      },
      (err: any) => {
        console.warn('PU Sandwich cuts sync note:', err?.message || err);
      }
    );

    return () => {
      unsubRolls();
      unsubRecords();
      unsubSandwich();
    };
  }, []);

  // Automatic Background Backup (Local Snapshots & Cloud Sync)
  useEffect(() => {
    if (rolls.length === 0) return;

    const runAutoBackup = () => {
      const config = getAutoBackupConfig();
      if (!config.enabled) return;

      if (config.saveLocalSnapshots) {
        createBackupSnapshot(rolls, records, 'scheduled');
      }

      // Also sync to cloud if enabled and online
      if (config.autoSyncCloud && syncStatus === 'connected') {
        uploadAllToFirestore(rolls, records).catch((err) => {
          console.warn('Background auto cloud backup notice:', err);
        });
      }
    };

    const config = getAutoBackupConfig();
    const intervalMs = Math.max(1, config.intervalMinutes || 10) * 60 * 1000;
    const intervalId = setInterval(runAutoBackup, intervalMs);

    return () => clearInterval(intervalId);
  }, [rolls, records, syncStatus]);

  // Automatic daily stock-integrity check (runs by itself, up to 2x/day, the
  // first couple of times someone opens the app each day — see
  // src/utils/integrityCheck.ts for how "automatic" works in a client-only app).
  const hasRunAutoIntegrityCheckRef = useRef(false);
  useEffect(() => {
    if (rolls.length === 0 || records.length === 0) return;
    if (hasRunAutoIntegrityCheckRef.current) return;
    if (!shouldRunAutoCheck()) return;

    hasRunAutoIntegrityCheckRef.current = true;
    // Small delay so this runs after the initial Firestore sync has settled,
    // not against a half-loaded local cache.
    const timer = setTimeout(() => {
      const issues = checkStockIntegrity(rolls, records);
      setStockIntegrityIssues(issues);
      markAutoCheckRun();
      if (issues.length > 0) {
        setShowIntegrityModal(true);
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [rolls, records]);


  // Switch between user custom project and auto-provisioned cloud
  const handleSwitchCloud = () => {
    const nextTarget = activeTarget === 'managed' ? 'user' : 'managed';
    setActiveTarget(nextTarget);
    window.location.reload();
  };

  // Sync to local storage
  const updateRollsState = (newRolls: FoilRoll[]) => {
    setRolls(newRolls);
    saveStoredRolls(newRolls);
  };

  const updateRecordsState = (newRecords: StockCutRecord[]) => {
    setRecords(newRecords);
    saveStoredCutRecords(newRecords);
  };

  // Manual save all data to Firebase Firestore
  const handleManualSaveToCloud = async () => {
    try {
      setIsSavingToCloud(true);
      setSyncStatus('syncing');
      const result = await uploadAllToFirestore(rolls, records);
      setSyncStatus('connected');
      setLastSyncedTime(new Date().toLocaleTimeString('th-TH'));
      showToast(`บันทึกข้อมูลสำเร็จ! ซิงค์ม้วนฟอยล์ ${result.rollsUploaded} ม้วน และประวัติ ${result.recordsUploaded} รายการ ลงฐานข้อมูลกลาง Firebase เรียบร้อย ทุกเครื่องเห็นข้อมูลตรงกันทันที`);
    } catch (err: any) {
      console.warn('Notice: Could not upload to Firestore:', err?.message || err);
      if (err?.code === 'permission-denied' || err?.message?.includes('permission')) {
        setSyncStatus('permission-denied');
        setIsRulesModalOpen(true);
        showToast('ยังไม่ได้เปิดสิทธิ์ Rules ใน Firebase Console กรุณาตั้งค่า Rules', 'info');
      } else {
        setSyncStatus('error');
        showToast('เกิดข้อผิดพลาดในการบันทึกข้อมูลขึ้น Firebase', 'info');
      }
    } finally {
      setIsSavingToCloud(false);
    }
  };

  // Perform Double Backup (Cloud Firestore + Local Snapshot + JSON File Download)
  const handleDoubleBackup = async () => {
    try {
      setIsDoubleBackingUp(true);

      // Layer 1: Local Snapshot Archive in Browser LocalStorage
      createBackupSnapshot(rolls, records, 'double_backup');

      // Layer 2: Cloud Firestore Remote Persistence
      let cloudOk = false;
      try {
        setSyncStatus('syncing');
        await uploadAllToFirestore(rolls, records);
        setSyncStatus('connected');
        setLastSyncedTime(new Date().toLocaleTimeString('th-TH'));
        cloudOk = true;
      } catch (cErr: any) {
        console.warn('Notice: Double backup cloud sync notice:', cErr);
        if (cErr?.code === 'permission-denied') {
          setSyncStatus('permission-denied');
        }
      }

      // Physical File Export: Download Full JSON Backup
      exportFullBackupJSON(rolls, records);

      // Update configuration timestamp
      const nowIso = new Date().toISOString();
      const cfg = getAutoBackupConfig();
      saveAutoBackupConfig({ ...cfg, lastDoubleBackupTime: nowIso });
      setLastDoubleBackupTime(nowIso);

      if (cloudOk) {
        showToast(`สำรองข้อมูล 2 ชั้น (Double Backup) สำเร็จสมบูรณ์! ซิงค์ Cloud Firestore + เก็บ Local Snapshot + ดาวน์โหลดไฟล์สำรองเรียบร้อย`, 'success');
      } else {
        showToast(`สำรองข้อมูล 2 ชั้นสำเร็จในเครื่อง (Local Snapshot + ดาวน์โหลดไฟล์สำรอง) ส่วน Cloud อยู่ในคิวรอการเชื่อมต่อ`, 'info');
      }
    } catch (err: any) {
      showToast('เกิดข้อผิดพลาดในการทำ Double Backup กรุณาลองใหม่อีกครั้ง', 'info');
    } finally {
      setIsDoubleBackingUp(false);
    }
  };

  // Manual fetch / refresh from Firebase Firestore
  const handleManualFetchFromCloud = async () => {
    try {
      setIsFetchingFromCloud(true);
      setSyncStatus('syncing');
      const test = await testFirestoreConnection();
      if (test.error === 'permission-denied') {
        setSyncStatus('permission-denied');
        setIsRulesModalOpen(true);
        showToast('ยังไม่ได้เปิดสิทธิ์ Rules ใน Firebase Console', 'info');
      } else {
        setSyncStatus('connected');
        setLastSyncedTime(new Date().toLocaleTimeString('th-TH'));
        showToast(`ดึงข้อมูลเรียลไทม์ล่าสุดจาก Firebase สำเร็จ (${rolls.length} ม้วน, ${records.length} รายการ)`);
      }
    } catch (err: any) {
      console.warn('Notice: Could not fetch from Firestore:', err?.message || err);
      if (err?.code === 'permission-denied' || err?.message?.includes('permission')) {
        setSyncStatus('permission-denied');
        setIsRulesModalOpen(true);
      } else {
        setSyncStatus('error');
      }
    } finally {
      setIsFetchingFromCloud(false);
    }
  };

  // On-demand fetch of all historical records from Firestore
  const handleFetchFullHistoryFromCloud = async () => {
    try {
      setIsFetchingFullHistory(true);
      showToast('กำลังดึงประวัติการตัดสต๊อกทั้งหมดจาก Cloud...', 'info');
      const allCloudRecords = await fetchAllCutRecordsFromFirestore();
      setRecords((prev) => {
        const map = new Map<string, StockCutRecord>();
        prev.forEach((r) => map.set(r.id, r));
        allCloudRecords.forEach((r) => map.set(r.id, r));
        const merged = Array.from(map.values());
        merged.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        saveStoredCutRecords(merged);
        return merged;
      });
      showToast(`ดึงประวัติย้อนหลังทั้งหมดสำเร็จ (${allCloudRecords.length} รายการ)`, 'success');
    } catch (err: any) {
      console.warn('Full history fetch notice:', err?.message || err);
      showToast('ไม่สามารถดึงประวัติทั้งหมดได้: ' + (err?.message || ''), 'info');
    } finally {
      setIsFetchingFullHistory(false);
    }
  };

  // Add new incoming roll
  const handleAddFoil = (
    newRollData: Omit<FoilRoll, 'id' | 'createdAt' | 'remainingMeters' | 'usedMeters' | 'ngMeters' | 'status'>
  ) => {
    const newRoll: FoilRoll = {
      ...newRollData,
      id: `foil-${Date.now()}`,
      remainingMeters: newRollData.totalMeters,
      usedMeters: 0,
      ngMeters: 0,
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    const updated = [newRoll, ...rolls];
    updateRollsState(updated);
    
    // Save to Firestore Realtime
    saveFoilRollToFirestore(newRoll).catch((err) => {
      console.warn('Notice: Save new roll to Firestore pending/offline:', err?.message || err);
      if (err?.code === 'permission-denied' || err?.message?.includes('permission')) {
        setSyncStatus('permission-denied');
      }
    });

    showToast(`เพิ่มฟอยล์รับเข้าสำเร็จ: ล็อต ${newRoll.lotNumber} #${newRoll.rollNumber} (${newRoll.totalMeters.toLocaleString()} ม.) [บันทึกลง Cloud]`);
  };

  // Update existing foil roll
  const handleUpdateRoll = async (updatedRoll: FoilRoll) => {
    const updated = rolls.map(r => r.id === updatedRoll.id ? updatedRoll : r);
    updateRollsState(updated);

    try {
      await saveFoilRollToFirestore(updatedRoll);
      setSyncStatus('connected');
      setLastSyncedTime(new Date().toLocaleTimeString('th-TH'));
    } catch (err: any) {
      console.warn('Update foil roll in Firestore warning/offline:', err);
    }

    showToast(`แก้ไขข้อมูลฟอยล์สำเร็จ: ล็อต ${updatedRoll.lotNumber} #${updatedRoll.rollNumber}`);
  };

  // Add multiple incoming rolls batch
  const handleAddMultipleFoils = async (
    rollsData: Omit<FoilRoll, 'id' | 'createdAt' | 'remainingMeters' | 'usedMeters' | 'ngMeters' | 'status'>[]
  ) => {
    if (!rollsData || rollsData.length === 0) return;
    const now = new Date().toISOString();
    const newRolls: FoilRoll[] = rollsData.map((data, index) => ({
      ...data,
      id: `foil-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`,
      remainingMeters: data.totalMeters,
      usedMeters: 0,
      ngMeters: 0,
      status: 'active',
      createdAt: now,
    }));

    const updated = [...newRolls, ...rolls];
    updateRollsState(updated);

    // Save all new rolls to Firestore
    try {
      for (const r of newRolls) {
        await saveFoilRollToFirestore(r);
      }
      setSyncStatus('connected');
      setLastSyncedTime(new Date().toLocaleTimeString('th-TH'));
    } catch (err: any) {
      console.warn('Batch add rolls to firestore error/warning:', err);
    }

    showToast(
      `เพิ่มฟอยล์หลายม้วนสำเร็จ: ${newRolls.length} ม้วน (ล็อต ${newRolls[0]?.lotNumber} เบอร์ ${newRolls.map((r) => r.rollNumber).join(', ')}) [บันทึกลง Cloud]`
    );
  };

  // Auth Guard helper: If visitor mode, prompt password first
  const requireEditorPermission = (action: () => void) => {
    if (userMode === 'editor') {
      action();
      return;
    }
    setPendingGuardedAction(() => action);
    setIsPasswordModalOpen(true);
  };

  const handleUnlockSuccess = () => {
    setUserMode('editor');
    saveUserMode('editor');
    setIsPasswordModalOpen(false);
    showToast('เข้าสู่โหมดคีย์ข้อมูล (Editor Mode) สำเร็จ สามารถแก้ไขและตัดสต๊อกได้');
    if (pendingGuardedAction) {
      pendingGuardedAction();
      setPendingGuardedAction(null);
    }
  };

  const handleLockToVisitor = () => {
    setUserMode('visitor');
    saveUserMode('visitor');
    showToast('สลับกลับสู่โหมดผู้เข้าชม (Visitor Mode: แสดงข้อมูลอย่างเดียว)', 'info');
  };

  // Cut stock handler (supports single roll batch and multi-roll import batch)
  const handleConfirmCutBatch = async (batchData: Omit<StockCutRecord, 'id' | 'createdAt'>[]): Promise<void> => {
    if (!batchData || batchData.length === 0) return;

    // Strict math sanitization: Ensure all inputs are positive and rounded.
    // Note: remainingBefore/remainingAfter here are only used for display in
    // this device's own optimistic UI before the server confirms — the real,
    // authoritative remainingAfter is computed server-side inside the
    // transaction (see firebase.ts) against the roll's fresh remainingMeters,
    // never against this locally-cached number.
    const now = new Date().toISOString();
    const createdRecords: StockCutRecord[] = batchData.map((item, idx) => {
      const safeUsed = round2(Math.abs(Number(item.usedMeters || 0)));
      const safeNg = round2(Math.abs(Number(item.ngMeters || 0)));
      const safeTotal = round2(Math.abs(Number(item.totalDeducted || (safeUsed + safeNg))));
      const safeRemBefore = Math.max(0, round2(Number(item.remainingBefore ?? 0)));
      const safeRemAfter = Math.max(0, round2(Number(item.remainingAfter ?? (safeRemBefore - safeTotal))));

      return {
        ...item,
        usedMeters: safeUsed,
        ngMeters: safeNg,
        totalDeducted: safeTotal,
        remainingBefore: safeRemBefore,
        remainingAfter: safeRemAfter,
        id: `cut-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
        createdAt: now,
      };
    });

    const rollIdsInvolved = Array.from(new Set(createdRecords.map((r) => r.foilId)));
    const totalDeductedAll = round2(createdRecords.reduce((sum, r) => sum + r.totalDeducted, 0));
    const single = createdRecords[0];
    const cutDesc = single?.cutType === 'non_so'
      ? `รายการไม่ใช้ SO (${single.nonSoReason || 'สาขายืม/ซ่อม'})`
      : `รหัส SO ${single?.soNumber || ''}`;

    // STRICT DIRECTIVE: read the roll(s) fresh and commit inside a Firestore
    // transaction FIRST — only update local UI state once the server confirms
    // the deduction against its true, current remaining meters. This is what
    // actually keeps "ยอดคงเหลือฟอยล์" in sync with the SO cutting slips even
    // when another device is cutting the same roll at the same time.
    try {
      let finalRollsById = new Map<string, FoilRoll>();

      if (rollIdsInvolved.length === 1) {
        const finalRoll = await executeCutBatchInFirestore(createdRecords, rollIdsInvolved[0]);
        finalRollsById.set(finalRoll.id, finalRoll);
      } else if (rollIdsInvolved.length > 1) {
        const finalRolls = await executeMultiRollCutBatchInFirestore(createdRecords);
        finalRolls.forEach((r) => finalRollsById.set(r.id, r));
      }

      // ✅ Transaction committed successfully — now sync local state to the
      // server's authoritative roll data (not our own pre-cut calculation).
      const updatedRolls = rolls.map((r) => finalRollsById.get(r.id) || r);
      const updatedRecords = [...records, ...createdRecords];

      updateRollsState(updatedRolls);
      updateRecordsState(updatedRecords);
      createBackupSnapshot(updatedRolls, updatedRecords, 'before_cut');

      setSyncStatus('connected');
      setLastSyncedTime(new Date().toLocaleTimeString('th-TH'));

      if (createdRecords.length === 1) {
        showToast(`ตัดสต๊อกสำเร็จ! ${cutDesc} (ใช้ ${formatMeters(single.usedMeters)} ม. + NG ${formatMeters(single.ngMeters)} ม.) [บันทึกลง Firebase เรียบร้อย]`);
      } else {
        showToast(`ตัดสต๊อกสำเร็จ ${createdRecords.length} รายการใบงาน! ยอดตัดรวม ${formatMeters(totalDeductedAll)} ม. [บันทึกลง Firebase เรียบร้อย]`);
      }
    } catch (err: any) {
      console.error('Firebase transaction error during stock cut:', err);
      const isPermissionError = err?.code === 'permission-denied' || err?.message?.includes('permission');
      setSyncStatus(isPermissionError ? 'permission-denied' : 'error');

      setErrorAlert({
        isOpen: true,
        title: 'ตัดสต๊อกไม่สำเร็จ',
        message: err?.message || 'บันทึกไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อ',
        detail: 'ข้อมูลคงเหลือเดิมยังไม่ถูกเปลี่ยนแปลง กรุณารีเฟรชหน้าจอเพื่อดูยอดล่าสุดแล้วลองใหม่อีกครั้ง',
      });

      // Reject so the modal knows the cut did not actually go through
      throw err;
    }
  };

  // Backward compatible single cut handler
  const handleConfirmCut = async (cutData: Omit<StockCutRecord, 'id' | 'createdAt'>) => {
    await handleConfirmCutBatch([cutData]);
  };

  // PU Sandwich Cut Handlers (ไม่ใช้ฟอยล์)
  const handleSavePuSandwichCut = async (record: PuSandwichCutRecord) => {
    const updated = [record, ...puSandwichRecords];
    setPuSandwichRecords(updated);
    saveStoredPuSandwichRecords(updated);

    try {
      await savePuSandwichCutToFirestore(record);
      setSyncStatus('connected');
      setLastSyncedTime(new Date().toLocaleTimeString('th-TH'));
      showToast(`บันทึกตัด SO แซนวิช ${record.soNumber} (คอล์ย ${record.coilNumber} ใช้ ${record.weightUsed} กก.) สำเร็จ! [ซิงค์ Cloud]`);
    } catch (err: any) {
      console.warn('Notice: PU Sandwich cloud sync pending/offline:', err?.message || err);
      showToast(`บันทึกตัด SO แซนวิช ${record.soNumber} ในเครื่องเรียบร้อย (รอซิงค์ Cloud เมื่อออนไลน์)`, 'info');
    }
  };

  const handleDeletePuSandwichCut = async (id: string) => {
    const updated = puSandwichRecords.filter((r) => r.id !== id);
    setPuSandwichRecords(updated);
    saveStoredPuSandwichRecords(updated);

    try {
      await deletePuSandwichCutFromFirestore(id);
      showToast('ลบรายการตัด SO แซนวิชเรียบร้อย');
    } catch (err: any) {
      console.warn('Notice: PU Sandwich deletion pending in cloud:', err?.message || err);
    }
  };

  // Toggle zero out for low stock rolls (<= 50m)
  const handleToggleZeroOut = (rollId: string, zeroOut: boolean) => {
    const targetRoll = rolls.find(r => r.id === rollId);
    let updatedTargetRoll: FoilRoll | null = null;
    const updatedRolls = rolls.map((r) => {
      if (r.id === rollId) {
        if (zeroOut) {
          const rollObj: FoilRoll = {
            ...r,
            isZeroedOut: true,
            manualZeroedOriginalMeters: r.remainingMeters,
            remainingMeters: 0,
            status: 'depleted' as const,
          };
          updatedTargetRoll = rollObj;
          return rollObj;
        } else {
          const restored = r.manualZeroedOriginalMeters ?? 0;
          const rollObj: FoilRoll = {
            ...r,
            isZeroedOut: false,
            remainingMeters: restored,
            status: restored > 0 ? ('active' as const) : ('depleted' as const),
          };
          updatedTargetRoll = rollObj;
          return rollObj;
        }
      }
      return r;
    });

    updateRollsState(updatedRolls);
    if (updatedTargetRoll) {
      saveFoilRollToFirestore(updatedTargetRoll).catch((err) => {
        console.warn('Notice: Update zero-out in Firestore pending/offline:', err?.message || err);
      });
    }

    if (zeroOut) {
      showToast(`ตัดยอดคงเหลือสล็อตล็อต ${targetRoll?.lotNumber || ''} #${targetRoll?.rollNumber || ''} เป็น 0 เมตรเรียบร้อย [ซิงค์ Cloud]`, 'info');
    } else {
      showToast(`คืนค่ายอดคงเหลือเดิม ${targetRoll?.manualZeroedOriginalMeters ?? 0} เมตร เรียบร้อยแล้ว [ซิงค์ Cloud]`, 'info');
    }
  };

  // Delete / Void a cutting record and restore stock
  const handleDeleteRecord = async (recordId: string) => {
    const targetRecord = records.find((r) => r.id === recordId);
    if (!targetRecord) return;

    // STRICT DIRECTIVE: run the revert as a transaction against the roll's
    // FRESH server state first, and only update local UI once it actually
    // commits. Passing just the ids (not a pre-computed roll object) means
    // the restore math happens on the server against whatever the roll's true
    // remaining meters are right now — safe even if another device cut more
    // from this same roll after this record was created.
    try {
      const finalRoll = await revertCutRecordInFirestore(recordId, targetRecord.foilId);

      const updatedRolls = rolls.map((r) => (r.id === finalRoll.id ? finalRoll : r));
      const updatedRecords = records.filter((r) => r.id !== recordId);
      updateRollsState(updatedRolls);
      updateRecordsState(updatedRecords);

      showToast(`ยกเลิกรายการ SO ${targetRecord.soNumber} และคืนยอด ${targetRecord.totalDeducted.toLocaleString()} เมตร เข้าม้วนเรียบร้อย [ซิงค์ Cloud]`, 'info');
    } catch (err: any) {
      console.error('Firebase error while deleting/reverting cut record:', err);
      const isPermissionError = err?.code === 'permission-denied' || err?.message?.includes('permission');
      if (isPermissionError) {
        setSyncStatus('permission-denied');
      }
      setErrorAlert({
        isOpen: true,
        title: 'ลบรายการไม่สำเร็จ',
        message: isPermissionError
          ? 'ไม่มีสิทธิ์ลบข้อมูลนี้ใน Firebase'
          : (err?.message || 'ไม่สามารถลบรายการตัด SO นี้ได้'),
        detail: isPermissionError
          ? 'กฎความปลอดภัย (Security Rules) ของ Firestore กำลังปฏิเสธการลบข้อมูล กรุณาตรวจสอบสิทธิ์การลบ (delete) ในหน้า Rules แล้วลองใหม่อีกครั้ง ข้อมูลเดิมยังไม่ถูกเปลี่ยนแปลง'
          : 'กรุณาตรวจสอบสัญญาณอินเทอร์เน็ตหรือสถานะ Cloud แล้วลองใหม่อีกครั้ง ข้อมูลเดิมยังไม่ถูกเปลี่ยนแปลง',
      });
    }
  };

  // Delete a roll
  const handleDeleteRoll = (rollId: string) => {
    const updatedRolls = rolls.filter((r) => r.id !== rollId);
    updateRollsState(updatedRolls);
    
    // Delete in Firestore
    deleteFoilRollFromFirestore(rollId).catch((err) => {
      console.warn('Notice: Delete roll in Firestore pending/offline:', err?.message || err);
    });

    showToast('ลบม้วนฟอยล์ออกจากรายการและ Cloud แล้ว', 'info');
  };

  // Reconcile and fix a single roll's remaining stock based on authoritative SO cut slips
  const handleFixRoll = async (
    rollId: string,
    expectedRemaining: number,
    sumUsed?: number,
    sumNg?: number
  ) => {
    try {
      const updated = await reconcileRollsInFirestore([{
        rollId,
        expectedRemaining,
        sumUsed,
        sumNg,
      }]);

      if (updated && updated.length > 0) {
        const nextRolls = rolls.map((r) => (r.id === rollId ? updated[0] : r));
        updateRollsState(nextRolls);
        showToast(`ปรับปรุงยอดคงเหลือม้วนล็อต ${updated[0].lotNumber} #${updated[0].rollNumber} เป็น ${formatMeters(updated[0].remainingMeters)} ม. สำเร็จ ✅`);
        const newIssues = checkStockIntegrity(nextRolls, records);
        setStockIntegrityIssues(newIssues);
      }
    } catch (err: any) {
      console.error('Failed to reconcile roll:', err);
      showToast(`ไม่สามารถปรับปรุงยอดได้: ${err?.message || err}`, 'info');
    }
  };

  // Reconcile and fix multiple rolls automatically with user consent
  const handleFixMultipleRolls = async (
    adjustments: Array<{ rollId: string; expectedRemaining: number; sumUsed: number; sumNg: number }>
  ) => {
    try {
      const updated = await reconcileRollsInFirestore(adjustments);
      if (updated && updated.length > 0) {
        const updatedMap = new Map(updated.map((r) => [r.id, r]));
        const nextRolls = rolls.map((r) => (updatedMap.has(r.id) ? updatedMap.get(r.id)! : r));
        updateRollsState(nextRolls);
        showToast(`ปรับปรุงยอดคงเหลือตามใบตัด SO อัตโนมัติสำเร็จ ${updated.length} ม้วน เรียบร้อยแล้ว ✅`);
        const newIssues = checkStockIntegrity(nextRolls, records);
        setStockIntegrityIssues(newIssues);
      }
    } catch (err: any) {
      console.error('Failed to auto-reconcile multiple rolls:', err);
      showToast(`ไม่สามารถปรับปรุงยอดอัตโนมัติได้: ${err?.message || err}`, 'info');
    }
  };

  // Realign sequential cut chain for a specific roll in Firestore
  const handleRealignChain = async (rollId: string, recordIds: string[]): Promise<void> => {
    try {
      const { updatedRoll, updatedRecords } = await realignRollCutChainInFirestore(rollId, recordIds);

      // Update rolls in local state
      const nextRolls = rolls.map((r) => (r.id === updatedRoll.id ? updatedRoll : r));

      // Update records in local state
      const updatedMap = new Map(updatedRecords.map((r) => [r.id, r]));
      const nextRecords = records.map((r) => (updatedMap.has(r.id) ? updatedMap.get(r.id)! : r));

      updateRollsState(nextRolls);
      updateRecordsState(nextRecords);
      createBackupSnapshot(nextRolls, nextRecords, 'realign_chain');

      // Re-run integrity check
      const newIssues = checkStockIntegrity(nextRolls, nextRecords);
      setStockIntegrityIssues(newIssues);

      showToast(`ปรับยอดความต่อเนื่อง SO ของม้วนล็อต ${updatedRoll.lotNumber} #${updatedRoll.rollNumber} สำเร็จ เรียบร้อยแล้ว ✅`);
    } catch (err: any) {
      console.error('Failed to realign roll cut chain:', err);
      showToast(`ไม่สามารถปรับยอดความต่อเนื่องได้: ${err?.message || err}`, 'info');
      throw err;
    }
  };

  // Reset to default sample
  const handleResetData = () => {
    if (confirm('คุณต้องการรีเซ็ตข้อมูลเป็นตัวอย่างเริ่มต้นของโรงงานหรือไม่? (คิดดีๆ)')) {
      createBackupSnapshot(rolls, records, 'before_reset');
      const { rolls: initR, records: initC } = resetAllDataToDefault();
      setRolls(initR);
      setRecords(initC);
      showToast('รีเซ็ตข้อมูลตัวอย่างเรียบร้อย (บันทึกจุดสำรองก่อนรีเซ็ตไว้แล้ว)', 'info');
    }
  };

  // Trigger quick cut from a specific roll
  const handleOpenCutForRoll = (rollId: string) => {
    setPreselectedRollId(rollId);
    setCutModalInitialMode('so');
    setIsCutModalOpen(true);
  };

  const handleSaveCycleCount = async (session: CycleCountSession, applyAdjustments: boolean) => {
    await saveCycleCountSession(session);
    if (applyAdjustments) {
      const toAdjust = session.lines
        .filter((l) => l.adjusted && Math.abs(l.variance) > 0.001)
        .map((l) => ({
          rollId: l.rollId,
          physicalCount: l.physicalCount,
          systemRemaining: l.systemRemaining,
          lotNumber: l.lotNumber,
          rollNumber: l.rollNumber,
          width: l.width,
          pattern: l.pattern,
          reason: l.reason,
        }));
      if (toAdjust.length > 0) {
        const { updatedRolls, createdRecords } = await applyCycleCountAdjustments(toAdjust, {
          period: session.period,
          countedBy: session.countedBy,
        });
        if (updatedRolls.length > 0) {
          setRolls((prev) => {
            const byId = new Map(prev.map((r) => [r.id, r]));
            updatedRolls.forEach((u) => {
              if (u.status === 'active' && u.remainingMeters > 0) {
                byId.set(u.id, u);
              } else {
                byId.delete(u.id);
              }
            });
            const next = Array.from(byId.values());
            saveStoredRolls(next);
            return next;
          });
          if (updatedRolls.some((u) => u.status === 'depleted' || u.remainingMeters <= 0)) {
            setArchiveLoaded(false);
          }
        }
        // ใส่รายการ Cycle Count ลงประวัติตัด (records) เพื่อให้ integrity / SO audit คำนวณยอดตรง
        if (createdRecords.length > 0) {
          setRecords((prev) => {
            const byId = new Map(prev.map((r) => [r.id, r]));
            createdRecords.forEach((r) => byId.set(r.id, r));
            const merged = Array.from(byId.values()).sort((a, b) =>
              (b.createdAt || '').localeCompare(a.createdAt || '')
            );
            saveStoredCutRecords(merged);
            return merged;
          });
        }
      }
    }
  };

  // Aggregate metrics
  const totalRemainingMeters = rolls.reduce((sum, r) => sum + r.remainingMeters, 0);
  const activeRollsCount = rolls.filter((r) => r.remainingMeters > 0).length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col antialiased selection:bg-amber-200">
      {/* External update banner: another device changed data — offer a reload
          so this device doesn't keep working on a stale page. */}
      {externalUpdateAvailable && (
        <div className="sticky top-0 z-[60] bg-blue-700 text-white px-4 py-2.5 flex items-center justify-center gap-3 text-xs sm:text-sm font-medium shadow-md animate-in slide-in-from-top duration-200">
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping shrink-0" />
            <span>🔄 มีการตัดสต๊อก/อัปเดตข้อมูลใหม่จากเครื่องอื่น (ดึงอ่านค่า Realtime เรียบร้อยแล้ว)</span>
          </span>
          <button
            onClick={() => {
              try {
                sessionStorage.setItem('scrfoil_active_tab', activeTab);
              } catch {}
              window.location.reload();
            }}
            className="bg-white text-blue-800 font-bold px-3 py-1 rounded-lg hover:bg-blue-50 transition-all text-xs shrink-0 shadow-xs cursor-pointer active:scale-95"
          >
            รีโหลดหน้านี้ ({activeTab === 'dashboard' ? 'แดชบอร์ด' : activeTab === 'rolls' ? 'ม้วนฟอยล์' : activeTab === 'history' ? 'ประวัติ' : activeTab === 'flow' ? 'ยอดผลิตประจำวัน' : activeTab === 'sandwich' ? 'แซนวิช' : 'ตั้งค่า'})
          </button>
          <button
            onClick={() => setExternalUpdateAvailable(false)}
            className="text-blue-200 hover:text-white shrink-0 p-1 cursor-pointer transition-colors"
            title="ปิดข้อความแจ้งเตือน"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 animate-in fade-in slide-in-from-bottom-5 duration-200">
          <div className={`px-4 py-3 rounded-xl shadow-lg border text-sm font-medium flex items-center gap-2.5 ${
            toastMessage.type === 'success'
              ? 'bg-slate-900 text-white border-slate-800'
              : 'bg-white text-slate-800 border-slate-200 shadow-xl'
          }`}>
            <CheckCircle2 className="w-5 h-5 text-amber-400 shrink-0" />
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* Firebase Central Cloud Sync Bar */}
      <FirebaseSyncBar
        syncStatus={syncStatus}
        lastSyncedTime={lastSyncedTime}
        onManualSaveToCloud={handleManualSaveToCloud}
        onManualFetchFromCloud={handleManualFetchFromCloud}
        isSaving={isSavingToCloud}
        isFetching={isFetchingFromCloud}
        rollsCount={rolls.length}
        recordsCount={records.length}
        projectId={firebaseConfig.projectId}
        isManagedTarget={activeTarget === 'managed'}
        isCached={isCached}
        onOpenRulesModal={() => setIsRulesModalOpen(true)}
        onSwitchCloud={handleSwitchCloud}
        onNavigateToSettings={() => setActiveTab('settings')}
      />

      {/* Navigation Header */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenAddModal={() => requireEditorPermission(() => setIsAddModalOpen(true))}
        onOpenCutModal={(mode = 'so') => {
          requireEditorPermission(() => {
            setPreselectedRollId(null);
            setCutModalInitialMode(mode);
            setIsCutModalOpen(true);
          });
        }}
        onOpenPuSandwichModal={() => requireEditorPermission(() => setIsPuSandwichModalOpen(true))}
        puSandwichCount={puSandwichRecords.length}
        totalRemainingMeters={totalRemainingMeters}
        activeRollsCount={activeRollsCount}
        onResetData={() => requireEditorPermission(handleResetData)}
        onExportRolls={() => exportRollsToCSV(rolls)}
        onExportHistory={() => exportCutRecordsToCSV(records)}
        hasPermissionNotice={syncStatus === 'permission-denied'}
        userMode={userMode}
        onUnlockEditor={() => requireEditorPermission(() => {})}
        onLockVisitor={handleLockToVisitor}
        onOpenSOAudit={() => handleOpenSOAudit()}
        soBugCount={soBugCount}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 pb-24 md:pb-6">
        {activeTab === 'dashboard' && (
          <DashboardOverview
            rolls={rolls}
            records={records}
            onOpenCutModal={(rollId) => {
              requireEditorPermission(() => {
                setPreselectedRollId(rollId || null);
                setCutModalInitialMode('so');
                setIsCutModalOpen(true);
              });
            }}
            onOpenAddModal={() => requireEditorPermission(() => setIsAddModalOpen(true))}
            onViewAllRolls={() => setActiveTab('rolls')}
            onViewAllHistory={() => setActiveTab('history')}
            onOpenMonthlySummary={() => setIsMonthlySummaryOpen(true)}
            onOpenBatchImport={() => requireEditorPermission(() => setIsBatchImportOpen(true))}
            onDoubleBackup={handleDoubleBackup}
            isDoubleBackingUp={isDoubleBackingUp}
            lastDoubleBackupTime={lastDoubleBackupTime}
            showToast={showToast}
          />
        )}

        {activeTab === 'rolls' && (
          <FoilRollTable
            rolls={rolls}
            archivedRolls={archivedRolls}
            archiveLoaded={archiveLoaded}
            isLoadingArchive={isLoadingArchive}
            onLoadArchive={async () => {
              if (isLoadingArchive) return;
              setIsLoadingArchive(true);
              try {
                const archived = await fetchArchivedFoilRolls();
                setArchivedRolls(archived);
                setArchiveLoaded(true);
                showToast(`โหลดคลังข้อมูลเก่าแล้ว ${archived.length} ม้วน`, 'info');
              } catch (err: any) {
                showToast(err?.message || 'โหลดคลังข้อมูลเก่าไม่สำเร็จ', 'info');
              } finally {
                setIsLoadingArchive(false);
              }
            }}
            onOpenCutModal={(rollId) => requireEditorPermission(() => handleOpenCutForRoll(rollId))}
            onOpenAddModal={() => requireEditorPermission(() => setIsAddModalOpen(true))}
            onViewRollHistory={(roll) => setDetailRoll(roll)}
            onDeleteRoll={(rollId) => requireEditorPermission(() => handleDeleteRoll(rollId))}
            onExportRolls={() => exportRollsToCSV(rolls)}
            onToggleZeroOut={(rollId, zeroOut) => requireEditorPermission(() => handleToggleZeroOut(rollId, zeroOut))}
            onOpenBatchImport={() => requireEditorPermission(() => setIsBatchImportOpen(true))}
            onOpenMonthlySummary={() => setIsMonthlySummaryOpen(true)}
            onUpdateRoll={(updatedRoll) => requireEditorPermission(() => handleUpdateRoll(updatedRoll))}
            onEditRoll={(roll) => requireEditorPermission(() => setEditingRoll(roll))}
            userMode={userMode}
            onRequestUnlock={() => requireEditorPermission(() => {})}
          />
        )}

        {activeTab === 'history' && (
          <CuttingHistoryTable
            records={records}
            onDeleteRecord={(recId) => requireEditorPermission(() => handleDeleteRecord(recId))}
            onOpenCutModal={() => {
              requireEditorPermission(() => {
                setPreselectedRollId(null);
                setCutModalInitialMode('so');
                setIsCutModalOpen(true);
              });
            }}
            userMode={userMode}
            onRequestUnlock={() => requireEditorPermission(() => {})}
          />
        )}

        {activeTab === 'sandwich' && (
          <PuSandwichView
            records={puSandwichRecords}
            onOpenCreateModal={() => requireEditorPermission(() => setIsPuSandwichModalOpen(true))}
            onDeleteRecord={(recId) => requireEditorPermission(() => handleDeletePuSandwichCut(recId))}
            userMode={userMode}
            onUnlockEditor={() => requireEditorPermission(() => {})}
          />
        )}

        {activeTab === 'flow' && (
          <DailyProductionFlow
            records={records}
            rolls={rolls}
            puRecords={puSandwichRecords}
            onOpenCutModal={() => {
              requireEditorPermission(() => {
                setPreselectedRollId(null);
                setCutModalInitialMode('so');
                setIsCutModalOpen(true);
              });
            }}
            showToast={(msg, type) => showToast(msg, type === 'error' ? 'info' : type)}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsBackupView
            rolls={rolls}
            records={records}
            syncStatus={syncStatus}
            lastSyncedTime={lastSyncedTime}
            projectId={firebaseConfig.projectId}
            isManagedTarget={activeTarget === 'managed'}
            onSwitchCloud={handleSwitchCloud}
            onManualSaveToCloud={async () => {
              requireEditorPermission(handleManualSaveToCloud);
            }}
            onManualFetchFromCloud={handleManualFetchFromCloud}
            onRestoreData={(newRolls, newRecords) => {
              requireEditorPermission(() => {
                updateRollsState(newRolls);
                updateRecordsState(newRecords);
              });
            }}
            onResetData={() => requireEditorPermission(handleResetData)}
            showToast={showToast}
            userMode={userMode}
            onRequestUnlock={() => requireEditorPermission(() => {})}
            onDoubleBackup={() => requireEditorPermission(handleDoubleBackup)}
            isDoubleBackingUp={isDoubleBackingUp}
            lastDoubleBackupTime={lastDoubleBackupTime}
            onFetchFullHistory={handleFetchFullHistoryFromCloud}
            isFetchingFullHistory={isFetchingFullHistory}
            isCached={isCached}
            onRunIntegrityCheck={() => requireEditorPermission(() => runIntegrityCheck(true))}
            isRunningIntegrityCheck={isRunningIntegrityCheck}
            integrityCheckState={getCheckState()}
            onOpenSOAudit={() => handleOpenSOAudit()}
            onOpenCycleCount={() => requireEditorPermission(() => setIsCycleCountOpen(true))}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2 font-mono">
          <div>
            หลังคาเย็นสยาม (ร่มเกล้า) • ระบบตัดสต๊อกฟอยล์ โดย นอต
          </div>
          <div className="flex items-center gap-2">
            <span>รองรับคำสั่งซื้อรูปแบบ <strong className="text-amber-700">soxxyyzzz</strong> และตัดไม่ใช้ SO</span>
            <span className="text-slate-300">•</span>
            <span>Realtime Cloud Sync</span>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <AddFoilModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddFoil={handleAddFoil}
        onAddMultipleFoils={handleAddMultipleFoils}
      />

      <PuSandwichModal
        isOpen={isPuSandwichModalOpen}
        onClose={() => setIsPuSandwichModalOpen(false)}
        records={puSandwichRecords}
        onSaveCut={handleSavePuSandwichCut}
        onDeleteRecord={(recId) => requireEditorPermission(() => handleDeletePuSandwichCut(recId))}
      />

      <CutStockModal
        isOpen={isCutModalOpen}
        onClose={() => {
          setIsCutModalOpen(false);
          setPreselectedRollId(null);
        }}
        availableRolls={rolls}
        preselectedRollId={preselectedRollId}
        initialCutMode={cutModalInitialMode}
        onConfirmCut={handleConfirmCut}
        onConfirmCutBatch={handleConfirmCutBatch}
      />

      {/* Comprehensive Roll Usage History Modal */}
      {detailRoll && (
        <RollUsageHistoryModal
          roll={rolls.find((r) => r.id === detailRoll.id) || detailRoll}
          records={records}
          onClose={() => setDetailRoll(null)}
          onOpenCutForThisRoll={handleOpenCutForRoll}
          onEditRoll={(roll) => requireEditorPermission(() => setEditingRoll(roll))}
          onFixRoll={handleFixRoll}
          onRealignChain={handleRealignChain}
          canEdit={userMode === 'editor'}
          onOpenFullAudit={(rollId) => handleOpenSOAudit(rollId)}
        />
      )}

      {/* Edit Foil Roll Modal */}
      {editingRoll && (
        <EditFoilModal
          isOpen={Boolean(editingRoll)}
          roll={rolls.find((r) => r.id === editingRoll.id) || editingRoll}
          onClose={() => setEditingRoll(null)}
          onSave={handleUpdateRoll}
        />
      )}

      {/* Monthly Summary Report Modal */}
      <MonthlySummaryModal
        isOpen={isMonthlySummaryOpen}
        onClose={() => setIsMonthlySummaryOpen(false)}
        rolls={rolls}
        records={records}
        onOpenRollHistory={(rollId) => {
          const target = rolls.find((r) => r.id === rollId);
          if (target) {
            setIsMonthlySummaryOpen(false);
            setDetailRoll(target);
          }
        }}
      />

      {/* Batch Import SO Modal */}
      <SOBatchImportModal
        isOpen={isBatchImportOpen}
        onClose={() => setIsBatchImportOpen(false)}
        rolls={rolls}
        onConfirmBatchCut={handleConfirmCutBatch}
      />

      {/* Global Error Alert Modal */}
      {errorAlert.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in">
          <div 
            id="modal-global-error"
            className="bg-white rounded-2xl shadow-2xl border border-rose-200 max-w-md w-full overflow-hidden p-6 space-y-4 animate-in zoom-in-95 duration-150"
          >
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <AlertCircle className="w-6 h-6 stroke-[2.5]" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-slate-900 leading-tight">
                  {errorAlert.title}
                </h3>
                <p className="text-sm font-semibold text-rose-600 mt-1">
                  {errorAlert.message}
                </p>
                {errorAlert.detail && (
                  <p className="text-xs text-slate-600 mt-2 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    {errorAlert.detail}
                  </p>
                )}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setErrorAlert({ isOpen: false, title: '', message: '', detail: '' })}
                className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
              >
                รับทราบ / ตกลง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stock Integrity Auto-Reconciliation Modal */}
      {showIntegrityModal && stockIntegrityIssues && (
        <IntegrityCheckModal
          isOpen={showIntegrityModal}
          onClose={() => setShowIntegrityModal(false)}
          mismatches={stockIntegrityIssues}
          checkedAt={getCheckState().lastCheckedAt || new Date().toISOString()}
          onFixRoll={handleFixRoll}
          onFixMultipleRolls={handleFixMultipleRolls}
          canEdit={userMode === 'editor'}
          onOpenSOAudit={(rollId) => handleOpenSOAudit(rollId)}
        />
      )}

      {/* Roll SO Diagnostics & Bug Inspector Modal */}
      <SOBugInspectorModal
        isOpen={isSOBugInspectorOpen}
        onClose={() => {
          setIsSOBugInspectorOpen(false);
          setSoBugAuditTargetRollId(null);
        }}
        rolls={rolls}
        records={records}
        initialRollId={soBugAuditTargetRollId}
        onFixRoll={handleFixRoll}
        onFixMultipleRolls={handleFixMultipleRolls}
        onRealignChain={handleRealignChain}
        onDeleteRecord={handleDeleteRecord}
        canEdit={userMode === 'editor'}
      />

      {/* Physical Cycle Count Modal */}
      <CycleCountModal
        isOpen={isCycleCountOpen}
        onClose={() => setIsCycleCountOpen(false)}
        rolls={rolls}
        onSaveSession={handleSaveCycleCount}
        showToast={showToast}
        canEdit={userMode === 'editor'}
      />

      {/* Firebase Rules Configuration Guide Modal */}
      <FirebaseRulesModal
        isOpen={isRulesModalOpen}
        onClose={() => setIsRulesModalOpen(false)}
        projectId={firebaseConfig.projectId}
        onRetry={() => {
          setIsRulesModalOpen(false);
          handleManualFetchFromCloud();
        }}
        onSwitchToManagedCloud={handleSwitchCloud}
        currentIsManaged={activeTarget === 'managed'}
      />

      {/* Mobile Bottom Navigation for Android & iOS Phones */}
      <MobileBottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenCutModal={(mode = 'so') => {
          requireEditorPermission(() => {
            setPreselectedRollId(null);
            setCutModalInitialMode(mode);
            setIsCutModalOpen(true);
          });
        }}
        hasPermissionNotice={syncStatus === 'permission-denied'}
      />

      {/* Password Prompt Modal for Data Entry Mode */}
      <PasswordPromptModal
        isOpen={isPasswordModalOpen}
        onClose={() => {
          setIsPasswordModalOpen(false);
          setPendingGuardedAction(null);
        }}
        onSuccess={handleUnlockSuccess}
      />
    </div>
  );
}
