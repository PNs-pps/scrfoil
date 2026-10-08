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
  isRecentLocalWrite,
  savePuSandwichCutToFirestore,
  deletePuSandwichCutFromFirestore,
  saveFoilRollToFirestore, 
  deleteFoilRollFromFirestore, 
  executeCutBatchInFirestore, 
  executeMultiRollCutBatchInFirestore,
  revertCutRecordInFirestore,
  updateStockCutRecordInFirestore,
  reconcileRollsInFirestore,
  realignRollCutChainInFirestore,
  uploadAllToFirestore,
  testFirestoreConnection,
  fetchAllCutRecordsFromFirestore,
  fetchArchivedFoilRolls,
  saveCycleCountSession,
  applyCycleCountAdjustments,
  deleteCycleCountSession,
  firebaseConfig,
  activeTarget,
  setActiveTarget,
  auth,
  signOutUser,
  subscribeToAuthState,
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
import { EditSOCutModal } from './components/EditSOCutModal';
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
import { CycleCountHistoryModal } from './components/CycleCountHistoryModal';
import { auditAllRollsSOHistory } from './utils/soHistoryAudit';
import { getUserMode, setUserMode as saveUserMode, isStaffEmail, getStaffEmails, hasOperatorPassword, resetToVisitorMode, UserMode } from './utils/auth';
import { confirmAction } from './utils/confirmAction';
import { createBackupSnapshot, getAutoBackupConfig, saveAutoBackupConfig, exportFullBackupJSON, getAllDueD1ScheduleSlots, markD1ScheduleSlotRun, getLastSnapshotFailure } from './utils/autoBackup';
import { getD1BackupConfig, uploadBackupToD1 } from './utils/d1Backup';
import { trackCloudWrite, describeWriteFailure } from './utils/cloudWrite';
import { summarizeBatch, BatchWriteOutcome } from './utils/batchReconcile';
import { formatMeters, round2 } from './utils/formatters';
import { checkStockIntegrity, shouldRunAutoCheck, markAutoCheckRun, getCheckState, IntegrityMismatch } from './utils/integrityCheck';
import { playFeedback } from './utils/feedback';
import { CheckCircle2, AlertCircle, AlertTriangle, Sparkles, X, Workflow } from 'lucide-react';

type AppTab = 'dashboard' | 'rolls' | 'history' | 'settings';

export default function App() {
  const [rolls, setRolls] = useState<FoilRoll[]>([]);
  const rollsRef = useRef<FoilRoll[]>([]);
  const [archivedRolls, setArchivedRolls] = useState<FoilRoll[]>(() => {
    try {
      const cached = localStorage.getItem('pufoam_archived_rolls_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [];
  });
  const [archiveLoaded, setArchiveLoaded] = useState<boolean>(() => {
    try {
      const cached = localStorage.getItem('pufoam_archived_rolls_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return true;
      }
    } catch {}
    return false;
  });
  const [isLoadingArchive, setIsLoadingArchive] = useState(false);
  const [records, setRecords] = useState<StockCutRecord[]>([]);
  const [puSandwichRecords, setPuSandwichRecords] = useState<PuSandwichCutRecord[]>([]);
  const [isDailyFlowOpen, setIsDailyFlowOpen] = useState(false);
  const [historyInitialCategory, setHistoryInitialCategory] = useState<'all' | 'foil' | 'sandwich'>('all');
  
  // Persistent activeTab so that reloading keeps the user on the exact page being viewed
  const [activeTab, setActiveTabRaw] = useState<AppTab>(() => {
    try {
      const hash = window.location.hash.replace('#', '') as string;
      if (['dashboard', 'rolls', 'history', 'settings'].includes(hash)) {
        return hash as AppTab;
      }
      const saved = sessionStorage.getItem('scrfoil_active_tab') as string;
      if (saved && ['dashboard', 'rolls', 'history', 'settings'].includes(saved)) {
        return saved as AppTab;
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

  // Signed-in Google account (AuthGate guarantees this exists by the time App
  // mounts, but keep it live here too so the Navbar can show who's signed in
  // and offer sign-out).
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(auth.currentUser?.email || null);
  useEffect(() => {
    const unsub = subscribeToAuthState((user) => {
      const email = user?.email || null;
      setCurrentUserEmail(email);
      // หากอีเมลไม่ใช่ทีมงานที่ได้รับอนุญาต ให้รีเซ็ตออกจากโหมดคีย์ข้อมูลทันที
      if (email && !isStaffEmail(email)) {
        resetToVisitorMode();
        setUserMode('visitor');
      }
    });
    return unsub;
  }, []);
  const handleSignOut = async () => {
    // Drop editor mode first. Otherwise signing out on a shared tablet leaves the
    // next person to pick it up still in editor mode, with the cut-stock button
    // live — which is exactly the state the password gate exists to prevent.
    resetToVisitorMode();
    setUserMode('visitor');
    setPendingGuardedAction(null);
    setIsPasswordModalOpen(false);
    try {
      await signOutUser();
    } catch (err) {
      console.warn('Sign-out notice:', err);
    }
  };

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

  // ไม่นับ SPLIT_PRODUCTION_BATCH (แบ่งรอบปกติ) เป็นบัคที่ต้องแจ้งเตือนบน badge
  const soBugCount = React.useMemo(() => {
    return soAuditResults.filter((r: { issues: { type: string }[] }) =>
      r.issues.some((i: { type: string }) => i.type !== 'SPLIT_PRODUCTION_BATCH')
    ).length;
  }, [soAuditResults]);

  const handleOpenSOAudit = (rollId?: string) => {
    setSoBugAuditTargetRollId(rollId || null);
    setIsSOBugInspectorOpen(true);
  };

  const runIntegrityCheck = (isManual: boolean = false) => {
    setIsRunningIntegrityCheck(true);
    // auto: ข้ามม้วนที่ตั้งใจตัดเป็น 0; manual: แสดงทั้งหมดเพื่อตรวจสอบ
    const issues = checkStockIntegrity(rolls, records, {
      excludeZeroedOut: !isManual,
    });
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
  const [editingPuSandwich, setEditingPuSandwich] = useState<PuSandwichCutRecord | null>(null);
  const [cutModalInitialMode, setCutModalInitialMode] = useState<'so' | 'non_so'>('so');
  const [preselectedRollId, setPreselectedRollId] = useState<string | null>(null);
  const [detailRoll, setDetailRoll] = useState<FoilRoll | null>(null);
  const [editingRoll, setEditingRoll] = useState<FoilRoll | null>(null);
  const [editingCutRecord, setEditingCutRecord] = useState<StockCutRecord | null>(null);
  const [isMonthlySummaryOpen, setIsMonthlySummaryOpen] = useState(false);
  const [monthlySummaryScope, setMonthlySummaryScope] = useState<'all' | 'foil' | 'sandwich'>('all');
  const [isBatchImportOpen, setIsBatchImportOpen] = useState(false);
  const [isCycleCountOpen, setIsCycleCountOpen] = useState(false);
  const [isCycleCountHistoryOpen, setIsCycleCountHistoryOpen] = useState(false);

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

  // Feedback Toast (bottom-center, closable, with sound/haptic)
  const [toastMessage, setToastMessage] = useState<{
    text: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (
    text: string,
    type: 'success' | 'error' | 'info' = 'success',
    opts?: { silent?: boolean }
  ) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setToastMessage({ text, type });
    if (!opts?.silent) {
      playFeedback(type === 'error' ? 'error' : type === 'info' ? 'info' : 'success');
    }
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
      toastTimerRef.current = null;
    }, type === 'error' ? 7000 : 4500);
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

    // 2. Realtime listener for Foil Rolls (activeOnly: false เพื่อให้ทุกบัญชีรวมทั้ง non-admin ดูม้วนที่หมดแล้วได้)
    let isInitialRollsFetch = true;
    const unsubRolls = subscribeToFoilRolls(
      (firestoreRolls) => {
        setRolls((prev: FoilRoll[]) => {
          const prevMap = new Map<string, FoilRoll>(prev.map((r: FoilRoll) => [r.id, r]));
          // เพิ่ง realign/ตัดยอด — เก็บยอด local ไว้ ไม่ให้ cache เก่าเด้งกลับ
          const mergedServer = firestoreRolls.map((r: FoilRoll) => {
            if (isRecentLocalWrite(r.id) && prevMap.has(r.id)) {
              const local = prevMap.get(r.id)!;
              return {
                ...r,
                remainingMeters: local.remainingMeters,
                usedMeters: local.usedMeters,
                ngMeters: local.ngMeters,
                recentCuts: local.recentCuts ?? r.recentCuts,
                isZeroedOut: local.isZeroedOut,
                status: local.status,
              };
            }
            return r;
          });

          // พร้อมใช้เท่านั้น — เหลือ 0 / depleted / zeroed ไม่นับในลิสต์หลัก
          const activeRolls = mergedServer.filter(
            (r) =>
              r.status !== 'depleted' &&
              !r.isZeroedOut &&
              Number(r.remainingMeters) > 0
          );

          // ม้วนที่หมดแล้ว — ซิงค์ให้ทุกบัญชี (admin และ non-admin) สามารถดูได้ทันที
          const depletedRolls = mergedServer.filter(
            (r) =>
              r.status === 'depleted' ||
              r.isZeroedOut ||
              Number(r.remainingMeters) <= 0
          );

          if (depletedRolls.length > 0) {
            setArchivedRolls((prevArchived) => {
              const map = new Map<string, FoilRoll>();
              prevArchived.forEach((r) => map.set(r.id, r));
              depletedRolls.forEach((r) => map.set(r.id, r));
              const combined = Array.from(map.values());
              try {
                localStorage.setItem('pufoam_archived_rolls_cache', JSON.stringify(combined));
              } catch {}
              return combined;
            });
            setArchiveLoaded(true);
          }

          const next =
            activeRolls.length > 0 || firestoreRolls.length === 0
              ? activeRolls.length > 0
                ? activeRolls
                : mergedServer
              : prev;

          if (activeRolls.length > 0 || firestoreRolls.length === 0) {
            saveStoredRolls(next);
          } else if (isInitialRollsFetch && loadedRolls.length > 0) {
            uploadAllToFirestore(loadedRolls, loadedRecords).catch((err) => {
              console.warn('Initial cloud seed notice:', err);
            });
          }
          isInitialRollsFetch = false;
          return next;
        });
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
        activeOnly: false,
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
          // Drop server-deleted ids (ยกเว้นเพิ่งเขียนเอง — กันเด้งหายตอน sync)
          (removedIds || []).forEach((id) => {
            if (!isRecentLocalWrite(id)) map.delete(id);
          });
          // Overlay จาก Firestore — ถ้าเพิ่ง realign/ตัด เก็บยอด local ไม่ให้เด้งกลับ
          firestoreRecords.forEach((r) => {
            if (isRecentLocalWrite(r.id) && map.has(r.id)) {
              const local = map.get(r.id)!;
              map.set(r.id, {
                ...r,
                remainingBefore: local.remainingBefore,
                remainingAfter: local.remainingAfter,
                usedMeters: local.usedMeters,
                ngMeters: local.ngMeters,
                totalDeducted: local.totalDeducted,
              });
            } else {
              map.set(r.id, r);
            }
          });
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

  // A local snapshot is the undo point taken before every stock cut. If it can't be
  // written (localStorage quota exhausted by a large inventory), the safety net is
  // gone and the operator has to know — otherwise they keep cutting believing every
  // action is reversible. Warn once per failure, not on every interval tick.
  const snapshotWarnedRef = useRef<string | null>(null);
  const warnIfSnapshotFailed = (result: { ok: boolean; dropped: number; error?: 'quota-exceeded' | 'unknown' }) => {
    if (result.ok) {
      snapshotWarnedRef.current = null;
      return;
    }
    const failure = getLastSnapshotFailure();
    const stamp = failure?.at || 'unknown';
    if (snapshotWarnedRef.current === stamp) return;
    snapshotWarnedRef.current = stamp;

    const quotaNote =
      result.error === 'quota-exceeded'
        ? 'พื้นที่จัดเก็บในเครื่องเต็ม (เกิน ~5 MB)'
        : 'บันทึกจุดสำรองไม่สำเร็จ';
    showToast(
      `แจ้งเตือน: ${quotaNote} — จุดสำรองก่อนตัดสต๊อกบันทึกไม่ได้` +
        (result.dropped > 0 ? ` (ลบจุดสำรองเก่าออก ${result.dropped} จุดแล้ว)` : '') +
        ' กรุณาลบจุดสำรองเก่าในหน้าตั้งค่า หรือสำรองขึ้น D1',
      'error'
    );
  };

  // Automatic Background Backup (Local Snapshots & Cloud Sync)
  useEffect(() => {
    if (rolls.length === 0) return;

    const runAutoBackup = () => {
      const config = getAutoBackupConfig();
      if (!config.enabled) return;

      if (config.saveLocalSnapshots) {
        const { result } = createBackupSnapshot(rolls, records, 'scheduled');
        warnIfSnapshotFailed(result);
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

  // Cloudflare D1 scheduled backup — fixed times daily (12:30 / 17:30), using
  // the Worker URL + secret already saved in Settings > Backup. Independent
  // of the Firebase interval above. Checks right away on open and once a
  // minute after that; if the device/app was closed at 12:30 or 17:30, the
  // moment it's opened again after that time it treats the slot as still due
  // and backs up immediately (catching up on any slots missed since midnight,
  // in one upload) rather than waiting for the next scheduled time. The
  // person can also always press "สำรองขึ้น D1" in Settings on demand.
  useEffect(() => {
    if (rolls.length === 0) return;

    const checkD1Schedule = () => {
      const config = getAutoBackupConfig();
      if (!config.autoSyncD1) return;

      const dueSlots = getAllDueD1ScheduleSlots();
      if (dueSlots.length === 0) return;

      const d1Config = getD1BackupConfig();
      if (!d1Config.workerUrl || !d1Config.secret) return;

      dueSlots.forEach(markD1ScheduleSlotRun);
      uploadBackupToD1({
        rolls,
        records,
        sandwichRecords: puSandwichRecords,
        label: 'สำรองอัตโนมัติ (ตามเวลาที่ตั้งไว้)',
        reason: 'scheduled',
      })
        .then(() => {
          saveAutoBackupConfig({ ...getAutoBackupConfig(), lastD1AutoBackupTime: new Date().toISOString() });
        })
        .catch((err) => {
          console.warn('Scheduled D1 backup notice:', err);
        });
    };

    checkD1Schedule();
    const intervalId = setInterval(checkD1Schedule, 60 * 1000);
    return () => clearInterval(intervalId);
  }, [rolls, records, puSandwichRecords]);

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


  // Switch between user custom project and auto-provisioned cloud.
  //
  // The managed target points at a *different* Firestore database
  // (firestoreDatabaseId 'ai-studio-pufoam-...'), not the production one. Two
  // things follow:
  //   1. The choice persists in localStorage, so it survives reloads for whoever
  //      made it. Previously any visitor could flip the whole app onto the other
  //      project with one tap — including accidentally, leaving this device
  //      writing stock to the wrong database. Gate it behind staff + editor mode.
  //   2. firestore.rules in this repo is only deployed to the production
  //      database. The managed database needs its own rules deployed (same
  //      deny-by-default + isStaff) or it is effectively unprotected.
  const handleSwitchCloud = async () => {
    if (userMode !== 'editor' && !isStaffEmail(currentUserEmail)) {
      showToast('เฉพาะผู้ดูแลระบบเท่านั้นที่สลับ Cloud ได้ — กรุณาเข้าสู่โหมดคีย์ข้อมูลก่อน', 'error');
      return;
    }

    const nextTarget = activeTarget === 'managed' ? 'user' : 'managed';
    const nextLabel =
      nextTarget === 'managed'
        ? 'AI Studio Cloud (xenon-airport-rlxdt / ฐานข้อมูล ai-studio-pufoam-...)'
        : `โรงงาน (${firebaseConfig.projectId} / ฐานข้อมูล (default))`;

    const warn =
      nextTarget === 'managed'
        ? '⚠️ ข้อมูลสต๊อกทั้งหมดจะถูกเขียนไปยังฐานข้อมูลอีกชุดหนึ่ง (ไม่ใช่ฐานข้อมูลหลักของโรงงาน)'
        : '⚠️ ข้อมูลสต๊อกทั้งหมดจะถูกเขียนไปยังฐานข้อมูลหลักของโรงงาน';

    const ok = await confirmAction({
      title: 'สลับฐานข้อมูล',
      message: `สลับไปใช้:\n${nextLabel}\n\n${warn}`,
      confirmLabel: 'สลับฐานข้อมูล',
    });
    if (!ok) {
      return;
    }

    setActiveTarget(nextTarget);
    window.location.reload();
  };

  // Sync to local storage
  // `rollsRef` mirrors `rolls` so async handlers can commit from the newest value
  // instead of the array captured when they started. Handlers that await before
  // writing (batch import, add/update roll) would otherwise spread a stale array
  // back over state the realtime listener had already advanced, silently dropping
  // whatever arrived in between — locally and in localStorage.
  const commitRolls = (updater: (prev: FoilRoll[]) => FoilRoll[]) => {
    const next = updater(rollsRef.current);
    rollsRef.current = next;
    setRolls(next);
    saveStoredRolls(next);
  };

  const updateRollsState = (newRolls: FoilRoll[]) => {
    rollsRef.current = newRolls;
    setRolls(newRolls);
    saveStoredRolls(newRolls);
  };

  // Keep the mirror honest for the paths that bypass the two helpers above
  // (realtime listener, initial load, integrity/reset fixes).
  useEffect(() => {
    rollsRef.current = rolls;
  }, [rolls]);

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
      const protectNote =
        result.rollsStockProtected > 0
          ? ` · กันทับสต๊อก ${result.rollsStockProtected} ม้วนที่ server ใหม่กว่า`
          : '';
      const skipNote =
        result.recordsSkippedExisting > 0
          ? ` · ข้ามใบตัดที่มีอยู่แล้ว ${result.recordsSkippedExisting} ใบ`
          : '';
      showToast(
        `ซิงค์ขึ้น Cloud สำเร็จ: ม้วน ${result.rollsUploaded} · ใบตัดใหม่ ${result.recordsUploaded}${protectNote}${skipNote}`,
        'success'
      );
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
      const { result: doubleBackupSnapshot } = createBackupSnapshot(rolls, records, 'double_backup');

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

      // Report the snapshot layer honestly. A dropped snapshot means the pre-backup undo
      // point is degraded, which the operator needs to know about even when the other
      // two layers succeeded — "สำเร็จสมบูรณ์" would be a lie about local recoverability.
      const snapshotFailed = !doubleBackupSnapshot.ok;
      const snapshotNote = snapshotFailed
        ? doubleBackupSnapshot.error === 'quota-exceeded'
          ? ` (Local Snapshot เต็มโควตา — ลดจุดสำรองเก่าออก ${doubleBackupSnapshot.dropped} รายการ)`
          : ' (บันทึก Local Snapshot ไม่สำเร็จ)'
        : '';

      if (cloudOk && !snapshotFailed) {
        showToast(`สำรองข้อมูล 2 ชั้น (Double Backup) สำเร็จสมบูรณ์! ซิงค์ Cloud Firestore + เก็บ Local Snapshot + ดาวน์โหลดไฟล์สำรองเรียบร้อย`, 'success');
      } else if (cloudOk && snapshotFailed) {
        showToast(`สำรองข้อมูลขึ้น Cloud + ดาวน์โหลดไฟล์สำรองเรียบร้อย แต่ Local Snapshot ไม่สมบูรณ์${snapshotNote}`, 'info');
      } else {
        showToast(`สำรองข้อมูลสำเร็จในเครื่อง (Local Snapshot + ดาวน์โหลดไฟล์สำรอง) ส่วน Cloud อยู่ในคิวรอการเชื่อมต่อ${snapshotNote}`, 'info');
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
        // permission-denied has two very different causes and they need opposite
        // advice. A signed-in staff account means the rules are genuinely not
        // published yet. A non-staff account means the rules are working exactly as
        // written — the staff allowlist simply does not include this person — so
        // telling them to go publish rules would send them off to change a working
        // security config in an attempt to grant themselves access.
        if (isStaffEmail(currentUserEmail)) {
          setIsRulesModalOpen(true);
          showToast('ยังไม่ได้เปิดสิทธิ์ Rules ใน Firebase Console', 'info');
        } else if (currentUserEmail) {
          showToast(
            `บัญชี ${currentUserEmail} ไม่มีสิทธิ์อ่านข้อมูล Cloud (Firestore Rules อนุญาตเฉพาะบัญชีทีมงาน) — ติดต่อผู้ดูแลระบบเพื่อเพิ่มอีเมลใน allowlist`,
            'error'
          );
        } else {
          setIsRulesModalOpen(true);
          showToast('ยังไม่ได้เข้าสู่ระบบ — เข้าสู่ระบบด้วยบัญชีทีมงานก่อน หรือตรวจสิทธิ์ Rules ใน Firebase Console', 'info');
        }
      } else {
        setSyncStatus('connected');
        setLastSyncedTime(new Date().toLocaleTimeString('th-TH'));
        showToast(`ดึงข้อมูลเรียลไทม์ล่าสุดจาก Firebase สำเร็จ (${rolls.length} ม้วน, ${records.length} รายการ)`);
      }
    } catch (err: any) {
      console.warn('Notice: Could not fetch from Firestore:', err?.message || err);
      if (err?.code === 'permission-denied' || err?.message?.includes('permission')) {
        setSyncStatus('permission-denied');
        // Same split as above: only surface the rules modal to an account that could
        // legitimately pass those rules once published.
        if (isStaffEmail(currentUserEmail)) {
          setIsRulesModalOpen(true);
        }
        showToast(
          currentUserEmail && !isStaffEmail(currentUserEmail)
            ? `บัญชี ${currentUserEmail} ไม่มีสิทธิ์อ่านข้อมูล Cloud — ติดต่อผู้ดูแลระบบ`
            : 'ยังไม่ได้เปิดสิทธิ์ Rules ใน Firebase Console',
          'info'
        );
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
      isUnused: true,
      createdAt: new Date().toISOString(),
    };

const updated = [newRoll, ...rolls];
    updateRollsState(updated);

    // Save to Firestore Realtime
    void trackCloudWrite(saveFoilRollToFirestore(newRoll)).then((outcome) => {
      if (outcome.kind === 'committed') {
        setSyncStatus('connected');
        setLastSyncedTime(new Date().toLocaleTimeString('th-TH'));
        showToast(
          `เพิ่มฟอยล์รับเข้าสำเร็จ: ล็อต ${newRoll.lotNumber} #${newRoll.rollNumber} (${formatMeters(newRoll.totalMeters)} ม.) [บันทึกลง Cloud]`
        );
        return;
      }

      if (outcome.kind === 'queued') {
        // Offline: Firestore is holding this in its own durable outbox and will
        // push it when connectivity returns. Keeping the local copy is correct.
        setSyncStatus('offline');
        showToast(
          `เพิ่มฟอยล์ ${newRoll.lotNumber} #${newRoll.rollNumber} ในเครื่องแล้ว — รอสัญญาณเน็ตเพื่อซิงค์ขึ้น Cloud`,
          'info'
        );
        return;
      }

      // Terminal rejection: nothing will ever push this write, so keeping the
      // local copy would strand the roll on this device and report a phantom
      // "waiting to sync" that never resolves. Roll it back instead.
      console.warn('Save new roll to Firestore rejected permanently:', outcome.message);
      setSyncStatus('permission-denied');
      commitRolls((prev) => prev.filter((r) => r.id !== newRoll.id));
      showToast(`เพิ่มฟอยล์ไม่สำเร็จ — ${describeWriteFailure(outcome)}`, 'error');
    });
  };

  // Update existing foil roll
  const handleUpdateRoll = async (updatedRoll: FoilRoll) => {
    const previous = rolls.find(r => r.id === updatedRoll.id) ?? null;
    const updated = rolls.map(r => r.id === updatedRoll.id ? updatedRoll : r);
    updateRollsState(updated);

    const outcome = await trackCloudWrite(saveFoilRollToFirestore(updatedRoll));

    if (outcome.kind === 'committed') {
      setSyncStatus('connected');
      setLastSyncedTime(new Date().toLocaleTimeString('th-TH'));
      showToast(`แก้ไขข้อมูลฟอยล์สำเร็จ: ล็อต ${updatedRoll.lotNumber} #${updatedRoll.rollNumber}`);
      return;
    }

    if (outcome.kind === 'queued') {
      setSyncStatus('offline');
      showToast(
        `แก้ไขม้วน ${updatedRoll.lotNumber} #${updatedRoll.rollNumber} ในเครื่องแล้ว — รอสัญญาณเน็ตเพื่อซิงค์ขึ้น Cloud`,
        'info'
      );
      return;
    }

    // Terminal rejection — restore the pre-edit values so local state matches what
    // Cloud actually holds. commitRolls (not updateRollsState) so an edit made on
    // another device during this write is not clobbered by the rollback.
    console.warn('Update foil roll in Firestore rejected permanently:', outcome.message);
    setSyncStatus('permission-denied');
    if (previous) {
      commitRolls((prev) => prev.map((r) => (r.id === previous.id ? previous : r)));
    }
    showToast(`แก้ไขไม่สำเร็จ — ${describeWriteFailure(outcome)}`, 'error');
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
      isUnused: true,
      createdAt: now,
    }));

    updateRollsState([...newRolls, ...rolls]);

    // Save all new rolls to Firestore one at a time, so a mid-batch failure can be
    // reported precisely and attributed to specific rolls. Firestore has no
    // multi-doc atomic write outside a batch, so each roll is independent and a
    // failure does not need to abort the rest.
    const outcomes: BatchWriteOutcome[] = [];

    for (const r of newRolls) {
      const outcome = await trackCloudWrite(saveFoilRollToFirestore(r));

      if (outcome.kind === 'rejected') {
        console.warn(
          `Batch add roll ${r.lotNumber} #${r.rollNumber} rejected permanently:`,
          outcome.message
        );
        outcomes.push('rejected');
        continue;
      }

      // 'queued' means the write is sitting in Firestore's durable outbox and will
      // land by itself. It is not a failure, and dropping the roll here would
      // delete something Cloud is about to accept.
      outcomes.push(outcome.kind);
    }

    const { committed, queued, dropped } = summarizeBatch(newRolls, outcomes);

    // Reconcile against current state, never against the array captured at the top:
    // this loop awaited a network round trip per roll, so `rolls` is stale and
    // rebuilding from it would discard whatever the realtime listener delivered.
    if (dropped.length > 0) {
      const droppedIds = new Set(dropped.map((r) => r.id));
      commitRolls((prev) => prev.filter((r) => !droppedIds.has(r.id)));
    }

    const numbers = (list: FoilRoll[]) => list.map((r) => r.rollNumber).join(', ');

    if (committed.length === newRolls.length) {
      setSyncStatus('connected');
      setLastSyncedTime(new Date().toLocaleTimeString('th-TH'));
      showToast(
        `เพิ่มฟอยล์หลายม้วนสำเร็จ: ${newRolls.length} ม้วน (ล็อต ${newRolls[0]?.lotNumber} เบอร์ ${numbers(newRolls)}) [บันทึกลง Cloud]`
      );
      return;
    }

    if (dropped.length === 0) {
      // Nothing was rejected; the remainder is queued. Not a failure.
      setSyncStatus('offline');
      showToast(
        `เพิ่มฟอยล์ ${newRolls.length} ม้วนในเครื่องแล้ว — รอสัญญาณเน็ตเพื่อซิงค์ขึ้น Cloud` +
          (committed.length > 0 ? ` (ขึ้น Cloud แล้ว ${committed.length} ม้วน)` : ''),
        'info'
      );
      return;
    }

    setSyncStatus('permission-denied');

    if (committed.length === 0 && queued.length === 0) {
      // Every roll was rejected outright, so the whole batch is already out of local
      // state and the operator can retry cleanly.
      showToast(
        `เพิ่มฟอยล์ไม่สำเร็จ: บันทึกขึ้น Cloud ไม่ได้ทั้ง ${newRolls.length} ม้วน ` +
          `(${numbers(dropped)}) — ยกเลิกการเพิ่มแล้ว ` +
          'ไม่มีสิทธิ์เขียนลง Cloud (Firestore Rules) — ตรวจสิทธิ์แล้วลองใหม่',
        'error'
      );
      return;
    }

    showToast(
      `เพิ่มฟอยล์บางส่วน: ขึ้น Cloud แล้ว ${committed.length} ม้วน` +
        (committed.length > 0 ? ` (${numbers(committed)})` : '') +
        (queued.length > 0 ? ` · รอซิงค์ ${queued.length} ม้วน (${numbers(queued)})` : '') +
        ` · ยกเลิก ${dropped.length} ม้วน (${numbers(dropped)}) — ไม่มีสิทธิ์เขียนลง Cloud (Firestore Rules)`,
      'error'
    );
  };

  // Auth Guard helper.
  //
  // Editor mode requires the shared operator password. Signing in with a staff
  // account is NOT enough on its own: the shop floor shares one tablet, and the
  // whole point of this gate is that opening the app must not put the cut-stock
  // button one tap away from whoever happens to pick up the device. Signing in
  // only proves an account is attached to the tablet, not that the person
  // holding it is the operator.
  //
  // Real authorization still belongs to Firestore Rules (see the header comment
  // in src/utils/auth.ts) — this gate is the UI layer on top of it.
  const requireEditorPermission = (action: () => void) => {
    // ตรวจสอบสิทธิ์อีเมลเจ้าหน้าที่ก่อน: หากอีเมลที่ล็อกอินไม่มีสิทธิ์คีย์ข้อมูล ให้บล็อกตั้งแต่ก่อนเปิดหน้าตัดใบงาน
    if (!currentUserEmail || !isStaffEmail(currentUserEmail)) {
      setErrorAlert({
        isOpen: true,
        title: 'ไม่มีสิทธิ์เข้าถึงหน้าตัดใบงาน / คีย์ข้อมูล',
        message: `บัญชีที่เข้าสู่ระบบ (${currentUserEmail || 'ยังไม่ได้เข้าสู่ระบบ'}) ไม่มีสิทธิ์คีย์ข้อมูลหรือตัดสต๊อก`,
        detail: `ระบบเปิดสิทธิ์การคีย์ข้อมูลเฉพาะอีเมลทีมงานที่ได้รับอนุญาตเท่านั้น (${getStaffEmails().join(', ')}) กรุณาสลับบัญชี หรือติดต่อผู้ดูแลระบบ`,
      });
      playFeedback('error');
      return;
    }

    if (userMode === 'editor') {
      action();
      return;
    }

    if (!hasOperatorPassword()) {
      showToast(
        'เวอร์ชันนี้ยังไม่ได้ตั้งรหัสผ่านสำหรับผู้ปฏิบัติการ จึงเข้าโหมดคีย์ข้อมูลไม่ได้ — กรุณาแจ้งผู้ดูแลระบบ',
        'error'
      );
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

    if (!currentUserEmail || !isStaffEmail(currentUserEmail)) {
      setErrorAlert({
        isOpen: true,
        title: 'ไม่มีสิทธิ์ตัดใบงาน',
        message: `บัญชี ${currentUserEmail || 'ยังไม่ได้เข้าสู่ระบบ'} ไม่มีสิทธิ์ตัดสต๊อกหรือบันทึกข้อมูลขึ้น Cloud`,
        detail: `ระบบเปิดสิทธิ์ให้เฉพาะอีเมลเจ้าหน้าที่ที่ได้รับอนุญาตเท่านั้น (${getStaffEmails().join(', ')})`,
      });
      playFeedback('error');
      throw new Error('PERMISSION_DENIED_NOT_STAFF');
    }

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

    const fallbackRollsMap = new Map<string, FoilRoll>();
    rolls.forEach((r) => fallbackRollsMap.set(r.id, r));

    // Pre-calculate local roll deduction state as guaranteed offline fallback
    const localUpdatedRolls = rolls.map((r) => {
      const recordsForThisRoll = createdRecords.filter((rec) => rec.foilId === r.id);
      if (recordsForThisRoll.length === 0) return r;
      const totalUsedThis = round2(recordsForThisRoll.reduce((s, rec) => s + rec.usedMeters, 0));
      const totalNgThis = round2(recordsForThisRoll.reduce((s, rec) => s + rec.ngMeters, 0));
      const totalDeductedThis = round2(recordsForThisRoll.reduce((s, rec) => s + rec.totalDeducted, 0));
      const newRemaining = Math.max(0, round2(r.remainingMeters - totalDeductedThis));
      const newUsed = round2((r.usedMeters || 0) + totalUsedThis);
      const newNg = round2((r.ngMeters || 0) + totalNgThis);

      const recent = [
        ...recordsForThisRoll.map((rec) => ({
          id: rec.id,
          soNumber: rec.soNumber || '',
          cutType: rec.cutType || 'so',
          usedMeters: rec.usedMeters,
          ngMeters: rec.ngMeters,
          totalDeducted: rec.totalDeducted,
          remainingAfter: rec.remainingAfter,
          usageDate: rec.usageDate,
          recordedDate: rec.recordedDate,
          recordedBy: rec.recordedBy,
          notes: rec.notes || '',
        })),
        ...(r.recentCuts || []),
      ].slice(0, 50);

      return {
        ...r,
        remainingMeters: newRemaining,
        usedMeters: newUsed,
        ngMeters: newNg,
        status: newRemaining <= 0 ? ('depleted' as const) : ('active' as const),
        depletedAt: newRemaining <= 0 ? (r.depletedAt || new Date().toISOString()) : undefined,
        isUnused: false,
        recentCuts: recent,
      };
    });

    try {
      let finalRollsById = new Map<string, FoilRoll>();

      if (rollIdsInvolved.length === 1) {
        const rollId = rollIdsInvolved[0];
        const finalRoll = await executeCutBatchInFirestore(
          createdRecords,
          rollId,
          fallbackRollsMap.get(rollId)
        );
        finalRollsById.set(finalRoll.id, finalRoll);
      } else if (rollIdsInvolved.length > 1) {
        const finalRolls = await executeMultiRollCutBatchInFirestore(
          createdRecords,
          fallbackRollsMap
        );
        finalRolls.forEach((r) => finalRollsById.set(r.id, r));
      }

      // ✅ Transaction committed successfully — now sync local state to the
      // server's authoritative roll data (not our own pre-cut calculation).
      const updatedRolls = rolls.map((r) => finalRollsById.get(r.id) || r);
      const updatedRecords = [...records, ...createdRecords];

      updateRollsState(updatedRolls);
      updateRecordsState(updatedRecords);
      const { result: snapshotResult } = createBackupSnapshot(updatedRolls, updatedRecords, 'before_cut');

      setSyncStatus('connected');
      setLastSyncedTime(new Date().toLocaleTimeString('th-TH'));

      // silent: เสียง/ผลลัพธ์หลักมาจาก CutStockModal (หรือ caller อื่น) — กัน feedback ซ้ำ
      if (createdRecords.length === 1) {
        showToast(
          `ตัดสต๊อกสำเร็จ! ${cutDesc} (ใช้ ${formatMeters(single.usedMeters)} ม. + NG ${formatMeters(single.ngMeters)} ม.)`,
          'success',
          { silent: true }
        );
      } else {
        showToast(
          `ตัดสต๊อกสำเร็จ ${createdRecords.length} รายการใบงาน! ยอดตัดรวม ${formatMeters(totalDeductedAll)} ม.`,
          'success',
          { silent: true }
        );
      }

      // การตัดสำเร็จ แต่จุดสำรองก่อนตัดอาจบันทึกไม่ได้ — เตือนคนละ toast
      warnIfSnapshotFailed(snapshotResult);
    } catch (err: any) {
      console.warn('Firebase transaction failed during stock cut:', err);
      const isStockShortage = err?.message && err.message.includes('สต๊อกไม่พอ');
      if (isStockShortage) {
        throw err;
      }

      // Offline or permissions failure: do NOT block the factory worker from cutting!
      // Commit cut into local state & storage safely.
      const updatedRecords = [...records, ...createdRecords];
      updateRollsState(localUpdatedRolls);
      updateRecordsState(updatedRecords);
      createBackupSnapshot(localUpdatedRolls, updatedRecords, 'before_cut');

      const isPermissionError = err?.code === 'permission-denied' || err?.message?.includes('permission');
      setSyncStatus(isPermissionError ? 'permission-denied' : 'offline');

      showToast(
        `บันทึกตัดสต๊อกในเครื่องแล้ว (${isPermissionError ? 'คลาวด์จำกัดสิทธิ์เจ้าหน้าที่' : 'รอสัญญาณเพื่อซิงค์ Cloud'})`,
        'info'
      );
    }
  };

  // Backward compatible single cut handler
  const handleConfirmCut = async (cutData: Omit<StockCutRecord, 'id' | 'createdAt'>) => {
    await handleConfirmCutBatch([cutData]);
  };

  // PU Sandwich Cut Handlers (ไม่ใช้ฟอยล์)
  const handleSavePuSandwichCut = async (record: PuSandwichCutRecord) => {
    if (!currentUserEmail || !isStaffEmail(currentUserEmail)) {
      setErrorAlert({
        isOpen: true,
        title: 'ไม่มีสิทธิ์บันทึกตัดแซนวิช',
        message: `บัญชี ${currentUserEmail || 'ยังไม่ได้เข้าสู่ระบบ'} ไม่มีสิทธิ์บันทึกข้อมูลขึ้น Cloud`,
        detail: `ระบบเปิดสิทธิ์ให้เฉพาะอีเมลเจ้าหน้าที่ที่ได้รับอนุญาตเท่านั้น (${getStaffEmails().join(', ')})`,
      });
      playFeedback('error');
      throw new Error('PERMISSION_DENIED_NOT_STAFF');
    }

    const previous = puSandwichRecords;
    const exists = previous.some((r) => r.id === record.id);
    const updated = exists
      ? previous.map((r) => (r.id === record.id ? record : r))
      : [record, ...previous];
    setPuSandwichRecords(updated);
    saveStoredPuSandwichRecords(updated);

    // Firestore does not retry `permission-denied` — the record would sit in
    // localStorage forever while the UI claimed it was merely "pending". Route
    // through trackCloudWrite so a terminal rejection is reported as such and
    // the local copy is rolled back.
    const outcome = await trackCloudWrite(savePuSandwichCutToFirestore(record));

    if (outcome.kind === 'committed') {
      setSyncStatus('connected');
      setLastSyncedTime(new Date().toLocaleTimeString('th-TH'));
      const metersTxt = record.soLengthMeters ? ` · ${record.soLengthMeters} ม.` : '';
      showToast(
        `${exists ? 'แก้ไข' : 'บันทึก'} SO แซนวิช ${record.soNumber}${metersTxt} สำเร็จ [Cloud]`,
        'success'
      );
      return;
    }

    if (outcome.kind === 'rejected') {
      // Keep record in localStorage so local data is never lost, but inform user of cloud status
      setSyncStatus(outcome.reason === 'rules' ? 'permission-denied' : 'error');
      showToast(
        `บันทึก SO แซนวิช ${record.soNumber} ในเครื่องแล้ว (คลาวด์แจ้งเตือน: ${describeWriteFailure(outcome)})`,
        'info'
      );
      return;
    }

    setSyncStatus('offline');
    showToast(`บันทึก SO แซนวิช ${record.soNumber} ในเครื่องแล้ว (รอซิงค์ Cloud)`, 'info');
  };

  const handleDeletePuSandwichCut = async (id: string) => {
    const previous = puSandwichRecords;
    const updated = previous.filter((r) => r.id !== id);
    setPuSandwichRecords(updated);
    saveStoredPuSandwichRecords(updated);

    const outcome = await trackCloudWrite(deletePuSandwichCutFromFirestore(id));

    if (outcome.kind === 'committed') {
      showToast('ลบรายการตัด SO แซนวิชเรียบร้อย');
      return;
    }

    // A rejected delete is worse than a failed save: the row is gone on this
    // device and reappears on the next sync. Put it back and say why.
    if (outcome.kind === 'rejected') {
      setPuSandwichRecords(previous);
      saveStoredPuSandwichRecords(previous);
      setSyncStatus(outcome.reason === 'rules' ? 'permission-denied' : 'error');
      showToast(
        `ลบรายการแซนวิชไม่สำเร็จ — ${describeWriteFailure(outcome)} (คืนรายการไว้ในเครื่องแล้ว)`,
        'error'
      );
      return;
    }

    setSyncStatus('offline');
    showToast('ลบรายการแซนวิชในเครื่องแล้ว (รอซิงค์ Cloud)', 'info');
  };

  // Toggle zero out for low stock rolls (<= 50m)
  const handleToggleZeroOut = (rollId: string, zeroOut: boolean) => {
    const targetRoll = rolls.find(r => r.id === rollId);
    if (!targetRoll) {
      showToast('ไม่พบม้วนฟอยล์ที่เลือก — รีเฟรชหน้าแล้วลองใหม่', 'error');
      return;
    }
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
            depletedAt: new Date().toISOString(),
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
            depletedAt: restored > 0 ? undefined : r.depletedAt,
          };
          updatedTargetRoll = rollObj;
          return rollObj;
        }
      }
      return r;
    });

    updateRollsState(updatedRolls);
    const rollLabel = `${targetRoll.lotNumber || ''} #${targetRoll.rollNumber || ''}`;

    if (!updatedTargetRoll) {
      return;
    }

    void trackCloudWrite(saveFoilRollToFirestore(updatedTargetRoll)).then((outcome) => {
      const action = zeroOut ? 'ตัดยอด' : 'คืนค่ายอด';

      if (outcome.kind === 'committed') {
        setSyncStatus('connected');
        setLastSyncedTime(new Date().toLocaleTimeString('th-TH'));
        showToast(
          zeroOut
            ? `ตัดยอดคงเหลือสล็อต ${rollLabel} เป็น 0 เมตรเรียบร้อย [ซิงค์ Cloud]`
            : `คืนค่ายอดคงเหลือเดิม ${targetRoll.manualZeroedOriginalMeters ?? 0} เมตร เรียบร้อยแล้ว [ซิงค์ Cloud]`,
          'info'
        );
        return;
      }

      if (outcome.kind === 'queued') {
        setSyncStatus('offline');
        showToast(`${action}สล็อต ${rollLabel} ในเครื่องแล้ว — รอสัญญาณเน็ตเพื่อซิงค์ขึ้น Cloud`, 'info');
        return;
      }

      // Terminal rejection: restore the pre-zero-out values. Restoring the meters is
      // the safe direction — it puts stock back that Cloud still counts as available.
      console.warn('Zero-out update rejected permanently:', outcome.message);
      setSyncStatus('permission-denied');
      commitRolls((prev) => prev.map((r) => (r.id === targetRoll.id ? targetRoll : r)));
      showToast(`${action}ไม่สำเร็จ — ${describeWriteFailure(outcome)}`, 'error');
    });
  };

  // Delete / Void a cutting record and restore stock
  const handleDeleteRecord = async (recordId: string) => {
    const targetRecord = records.find((r) => r.id === recordId);
    if (!targetRecord) return;

    // ใบปรับยอดจากนับสต๊อก — ห้ามลบจากประวัติตัด ต้องใช้เมนู Cycle Count
    const td = Number(targetRecord.totalDeducted);
    const isCycleCountAdj =
      String(targetRecord.id || '').startsWith('cc_') ||
      String(targetRecord.soNumber || '').trim().startsWith('นับสต๊อก') ||
      (Number.isFinite(td) &&
        td < 0 &&
        Math.abs(Number(targetRecord.usedMeters || 0)) < 0.001 &&
        Math.abs(Number(targetRecord.ngMeters || 0)) < 0.001);
    if (isCycleCountAdj) {
      setErrorAlert({
        isOpen: true,
        title: 'ไม่สามารถลบจากประวัติตัดได้',
        message:
          'รายการนี้เป็นใบปรับยอดจากนับสต๊อก (Cycle Count)',
        detail:
          'กรุณาไปที่เมนู ประวัตินับสต๊อก → ลบงวดนั้น ระบบจะคืนยอดม้วนและลบใบปรับยอดให้อัตโนมัติอย่างถูกต้อง',
      });
      throw new Error('CYCLE_COUNT_DELETE_BLOCKED');
    }

    // STRICT DIRECTIVE: run the revert as a transaction against the roll's
    // FRESH server state first, and only update local UI once it actually
    // commits. Passing just the ids (not a pre-computed roll object) means
    // the restore math happens on the server against whatever the roll's true
    // remaining meters are right now — safe even if another device cut more
    // from this same roll after this record was created.
    try {
      const finalRoll = await revertCutRecordInFirestore(recordId, targetRecord.foilId);

      const updatedRecords = records.filter((r) => r.id !== recordId);
      updateRecordsState(updatedRecords);

      if (finalRoll) {
        const updatedRolls = rolls.map((r) => (r.id === finalRoll.id ? finalRoll : r));
        updateRollsState(updatedRolls);
        showToast(`ยกเลิกรายการ SO ${targetRecord.soNumber} และคืนยอด ${targetRecord.totalDeducted.toLocaleString()} เมตร เข้าม้วนเรียบร้อย [ซิงค์ Cloud]`, 'info');
      } else {
        // Roll no longer exists — the orphaned/duplicate record was still
        // removed, but there was no roll left to restore the meters into.
        showToast(`ลบรายการซ้ำ SO ${targetRecord.soNumber} ออกแล้ว (ม้วนต้นทางถูกลบไปก่อนหน้านี้ จึงไม่มีสต๊อกให้คืนยอด) [ซิงค์ Cloud]`, 'info');
      }
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
      // STRICT: re-throw so callers (e.g. the duplicate-record delete confirm
      // dialog in SOBugInspectorModal) know the delete actually failed instead
      // of assuming success and closing as if the duplicate had been removed.
      throw err;
    }
  };

  /** แก้ไขข้อมูลใบตัด SO แล้วปรับยอดม้วน + realign ห่วงโซ่ remaining ของม้วนนั้น */
  const handleUpdateCutRecord = async (
    updatedRecord: StockCutRecord,
    oldRecord: StockCutRecord
  ) => {
    if (!currentUserEmail || !isStaffEmail(currentUserEmail)) {
      setErrorAlert({
        isOpen: true,
        title: 'ไม่มีสิทธิ์แก้ไขประวัติ SO',
        message: `บัญชี ${currentUserEmail || 'ยังไม่ได้เข้าสู่ระบบ'} ไม่มีสิทธิ์แก้ไขข้อมูล`,
        detail: `ระบบเปิดสิทธิ์ให้เฉพาะอีเมลเจ้าหน้าที่ที่ได้รับอนุญาตเท่านั้น (${getStaffEmails().join(', ')})`,
      });
      playFeedback('error');
      throw new Error('PERMISSION_DENIED_NOT_STAFF');
    }

    const matchingRoll = rolls.find((r) => r.id === updatedRecord.foilId);

    try {
      const { updatedRoll, updatedRecord: finalRec } =
        await updateStockCutRecordInFirestore(
          updatedRecord,
          oldRecord,
          matchingRoll,
          oldRecord
        );

      let nextRolls = rolls.map((r) =>
        r.id === updatedRoll.id ? updatedRoll : r
      );
      let nextRecords = records.map((r) =>
        r.id === finalRec.id ? finalRec : r
      );

      // จัดห่วงโซ่ remainingBefore/After ของทุกใบในม้วนนี้ใหม่หลังแก้เมตร
      const rollRecordIds = nextRecords
        .filter((r) => r.foilId === finalRec.foilId)
        .map((r) => r.id);
      if (rollRecordIds.length > 0) {
        try {
          const { updatedRoll: realignedRoll, updatedRecords: realignedRecs } =
            await realignRollCutChainInFirestore(finalRec.foilId, rollRecordIds);
          nextRolls = nextRolls.map((r) =>
            r.id === realignedRoll.id ? realignedRoll : r
          );
          const byId = new Map(realignedRecs.map((r) => [r.id, r]));
          nextRecords = nextRecords.map((r) => byId.get(r.id) || r);
        } catch (alignErr: any) {
          console.warn(
            'Realign after SO edit failed (ยอดม้วนอัปเดตแล้ว):',
            alignErr?.message || alignErr
          );
        }
      }

      updateRecordsState(nextRecords);
      updateRollsState(nextRolls);

      setEditingCutRecord(null);
      const finalRoll = nextRolls.find((r) => r.id === finalRec.foilId) || updatedRoll;
      showToast(
        `แก้ไขใบ SO ${finalRec.soNumber} สำเร็จ (ใช้ ${formatMeters(finalRec.usedMeters)} ม. + NG ${formatMeters(finalRec.ngMeters)} ม.) คงเหลือม้วน ${formatMeters(finalRoll.remainingMeters)} ม. · จัดห่วงโซ่ประวัติแล้ว [Cloud]`,
        'success'
      );
    } catch (err: any) {
      console.warn('Update cut record failed, checking fallback:', err);
      const isPermissionError =
        err?.code === 'permission-denied' || err?.message?.includes('permission');
      if (isPermissionError) {
        setSyncStatus('permission-denied');
        playFeedback('error');
        throw err;
      }

      // Offline / network fallback: บันทึกข้อมูลที่แก้ไขลงในเครื่องเพื่อไม่ให้ข้อมูลสูญหาย
      const oldUsed = Math.abs(Number(oldRecord.usedMeters || 0));
      const oldNg = Math.abs(Number(oldRecord.ngMeters || 0));
      const oldTotal = Math.abs(Number(oldRecord.totalDeducted) || (oldUsed + oldNg));
      const newUsed = Math.abs(Number(updatedRecord.usedMeters || 0));
      const newNg = Math.abs(Number(updatedRecord.ngMeters || 0));
      const newTotal = round2(newUsed + newNg);
      const deltaTotal = round2(newTotal - oldTotal);
      const deltaUsed = round2(newUsed - oldUsed);
      const deltaNg = round2(newNg - oldNg);

      let finalRoll = matchingRoll;
      if (matchingRoll) {
        const nextRemaining = round2(Math.max(0, Number(matchingRoll.remainingMeters || 0) - deltaTotal));
        const nextUsedVal = round2(Math.max(0, Number(matchingRoll.usedMeters || 0) + deltaUsed));
        const nextNgVal = round2(Math.max(0, Number(matchingRoll.ngMeters || 0) + deltaNg));
        finalRoll = {
          ...matchingRoll,
          remainingMeters: nextRemaining,
          usedMeters: nextUsedVal,
          ngMeters: nextNgVal,
          status: nextRemaining > 0 ? ('active' as const) : ('depleted' as const),
        };
      }

      const finalRec: StockCutRecord = {
        ...updatedRecord,
        usedMeters: newUsed,
        ngMeters: newNg,
        totalDeducted: newTotal,
        remainingAfter: finalRoll ? finalRoll.remainingMeters : updatedRecord.remainingAfter,
      };

      const nextRolls = finalRoll ? rolls.map((r) => r.id === finalRoll.id ? finalRoll : r) : rolls;
      const nextRecords = records.map((r) => r.id === finalRec.id ? finalRec : r);

      updateRecordsState(nextRecords);
      updateRollsState(nextRolls);
      createBackupSnapshot(nextRolls, nextRecords, 'realign_chain');
      setEditingCutRecord(null);
      setSyncStatus('offline');
      showToast(
        `แก้ไขใบ SO ${finalRec.soNumber} สำเร็จในเครื่อง (รอซิงค์ Cloud)`,
        'info'
      );
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
        let nextRolls = rolls.map((r) => (r.id === rollId ? updated[0] : r));
        let nextRecords = records;

        // STRICT: fixing the roll's aggregate remaining meters is not enough —
        // each individual ใบงาน (cut slip) still carries its own, possibly-wrong
        // remainingBefore/remainingAfter. Re-chain every cut record for this
        // roll too, so ใบงานที่ 1's "หลังตัด" always equals ใบงานที่ 2's "ก่อนตัด", etc.
        if (!updated[0].isZeroedOut) {
          const rollRecordIds = records.filter((r) => r.foilId === rollId).map((r) => r.id);
          if (rollRecordIds.length > 0) {
            try {
              const { updatedRoll: realignedRoll, updatedRecords } = await realignRollCutChainInFirestore(rollId, rollRecordIds);
              nextRolls = nextRolls.map((r) => (r.id === realignedRoll.id ? realignedRoll : r));
              const updatedMap = new Map(updatedRecords.map((r) => [r.id, r]));
              nextRecords = records.map((r) => (updatedMap.has(r.id) ? updatedMap.get(r.id)! : r));
              updateRecordsState(nextRecords);
            } catch (realignErr) {
              console.warn('Notice: chain realign after single-roll fix failed:', realignErr);
            }
          }
        }

        updateRollsState(nextRolls);
        const fixedRoll = nextRolls.find((r) => r.id === rollId) || updated[0];
        showToast(`ปรับปรุงยอดคงเหลือม้วนล็อต ${fixedRoll.lotNumber} #${fixedRoll.rollNumber} เป็น ${formatMeters(fixedRoll.remainingMeters)} ม. สำเร็จ ✅`);
        const newIssues = checkStockIntegrity(nextRolls, nextRecords);
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
        let nextRolls = rolls.map((r) => (updatedMap.has(r.id) ? updatedMap.get(r.id)! : r));
        let nextRecords = records;

        // STRICT: same as the single-roll fix — also re-chain every roll's own
        // cut records so ใบงานที่ 1, 2, 3... ก่อนตัด/หลังตัด stay continuous,
        // not just the roll-level total.
        for (const roll of updated) {
          if (roll.isZeroedOut) continue;
          const rollRecordIds = nextRecords.filter((r) => r.foilId === roll.id).map((r) => r.id);
          if (rollRecordIds.length === 0) continue;
          try {
            const { updatedRoll: realignedRoll, updatedRecords } = await realignRollCutChainInFirestore(roll.id, rollRecordIds);
            nextRolls = nextRolls.map((r) => (r.id === realignedRoll.id ? realignedRoll : r));
            const localUpdatedMap = new Map(updatedRecords.map((r) => [r.id, r]));
            nextRecords = nextRecords.map((r) => (localUpdatedMap.has(r.id) ? localUpdatedMap.get(r.id)! : r));
          } catch (realignErr) {
            console.warn(`Notice: chain realign after bulk fix failed for roll ${roll.id}:`, realignErr);
          }
        }

        updateRollsState(nextRolls);
        updateRecordsState(nextRecords);
        showToast(`ปรับปรุงยอดคงเหลือตามใบตัด SO อัตโนมัติสำเร็จ ${updated.length} ม้วน เรียบร้อยแล้ว ✅`);
        const newIssues = checkStockIntegrity(nextRolls, nextRecords);
        setStockIntegrityIssues(newIssues);
      }
    } catch (err: any) {
      console.error('Failed to auto-reconcile multiple rolls:', err);
      showToast(`ไม่สามารถปรับปรุงยอดอัตโนมัติได้: ${err?.message || err}`, 'info');
    }
  };

  // Realign sequential cut chain for a specific roll in Firestore
  const handleRealignChain = async (
    rollId: string,
    recordIds: string[]
  ): Promise<{ updatedRecords: StockCutRecord[] }> => {
    try {
      const { updatedRoll, updatedRecords } = await realignRollCutChainInFirestore(rollId, recordIds);

      // อัปเดตม้วน + ใส่ใบตัดที่ปรับแล้ว (รวมกรณีมีใบใหม่ที่ไม่ได้อยู่ใน state เดิม)
      const nextRolls = rolls.map((r) => (r.id === updatedRoll.id ? updatedRoll : r));
      const updatedMap = new Map(updatedRecords.map((r) => [r.id, r]));
      const nextRecords = [
        ...records.map((r) => (updatedMap.has(r.id) ? updatedMap.get(r.id)! : r)),
      ];
      // ถ้ามี record จาก server ที่ไม่อยู่ใน state ให้เติมเข้าไป
      updatedRecords.forEach((r) => {
        if (!nextRecords.some((x) => x.id === r.id)) nextRecords.push(r);
      });

      updateRollsState(nextRolls);
      updateRecordsState(nextRecords);
      const { result: realignSnapshot } = createBackupSnapshot(nextRolls, nextRecords, 'realign_chain');

      const newIssues = checkStockIntegrity(nextRolls, nextRecords);
      setStockIntegrityIssues(newIssues);

      const snapshotSuffix = realignSnapshot.ok
        ? ''
        : realignSnapshot.error === 'quota-exceeded'
          ? ' (เตือน: เก็บ Local Snapshot ไม่ได้ — พื้นที่จัดเก็บเต็ม)'
          : ' (เตือน: เก็บ Local Snapshot ไม่สำเร็จ)';

      showToast(
        `ปรับยอดก่อนตัด–หลังตัดของล็อต ${updatedRoll.lotNumber} #${updatedRoll.rollNumber} ให้ต่อเนื่องแล้ว (คงเหลือ ${formatMeters(updatedRoll.remainingMeters)} ม.)${snapshotSuffix}`,
        realignSnapshot.ok ? 'success' : 'info'
      );
      // คืนค่าให้ modal ประวัติม้วนอัปเดตตารางทันที (ไม่รอ snapshot)
      return { updatedRecords };
    } catch (err: any) {
      console.error('Failed to realign roll cut chain:', err);
      const raw = String(err?.message || err || '');
      const isPermission = /permission|insufficient/i.test(raw) || err?.code === 'permission-denied';
      showToast(
        isPermission
          ? 'ปรับยอดไม่สำเร็จ: สิทธิ์ Firestore ไม่พอ — ตรวจ Rules แล้ว Publish ใหม่'
          : `ไม่สามารถปรับยอดความต่อเนื่องได้: ${raw}`,
        'info'
      );
      throw err;
    }
  };

  // Reset to default sample
  const handleResetData = async () => {
    if (
      await confirmAction({
        title: 'รีเซ็ตข้อมูลทั้งหมด',
        message:
          'ข้อมูลสต๊อกทั้งหมดจะถูกลบและแทนที่ด้วยชุดตัวอย่างเริ่มต้นของโรงงาน\nระบบจะบันทึกจุดสำรองไว้ก่อนลบ\n\nต้องการดำเนินการต่อหรือไม่?',
        confirmLabel: 'รีเซ็ตข้อมูล',
      })
    ) {
      const { result: snapshotResult } = createBackupSnapshot(rolls, records, 'before_reset');
      const { rolls: initR, records: initC } = resetAllDataToDefault();
      setRolls(initR);
      setRecords(initC);
      // รีเซ็ตลบข้อมูลจริงทั้งชุด — ถ้าจุดสำรองบันทึกไม่ได้ ห้ามบอกว่า "บันทึกไว้แล้ว"
      if (snapshotResult.ok) {
        showToast('รีเซ็ตข้อมูลตัวอย่างเรียบร้อย (บันทึกจุดสำรองก่อนรีเซ็ตไว้แล้ว)', 'info');
      } else {
        showToast(
          'รีเซ็ตข้อมูลตัวอย่างเรียบร้อย แต่บันทึกจุดสำรองก่อนรีเซ็ตไม่สำเร็จ — ข้อมูลเดิมกู้คืนจาก Cloud ไม่ได้ กรุณาสำรองขึ้น D1 ทันที',
          'error'
        );
      }
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
        // เก็บ id ใบปรับยอดไว้ใน session เพื่อตอนลบประวัติจะคืนยอด + ลบใบนับสต๊อกได้
        if (createdRecords.length > 0) {
          await saveCycleCountSession({
            ...session,
            adjustmentRecordIds: createdRecords.map((r) => r.id),
            updatedAt: new Date().toISOString(),
          });
        }
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

  /** ลบประวัติ Cycle Count แล้วคืนยอดม้วน + ลบใบนับสต๊อก */
  const handleDeleteCycleCountSession = async (session: CycleCountSession) => {
    const { restoredRolls, deletedRecordIds } = await deleteCycleCountSession(session);
    if (restoredRolls.length > 0) {
      setRolls((prev) => {
        const byId = new Map(prev.map((r) => [r.id, r]));
        restoredRolls.forEach((u) => {
          if (u.status === 'active' && u.remainingMeters > 0) {
            byId.set(u.id, u);
          } else if (u.remainingMeters <= 0) {
            byId.delete(u.id);
          } else {
            byId.set(u.id, u);
          }
        });
        const next = Array.from(byId.values());
        saveStoredRolls(next);
        return next;
      });
    }
    if (deletedRecordIds.length > 0) {
      setRecords((prev) => {
        const next = prev.filter((r) => !deletedRecordIds.includes(r.id));
        saveStoredCutRecords(next);
        return next;
      });
    }
  };

  // Aggregate metrics
  const totalRemainingMeters = rolls.reduce((sum, r) => sum + r.remainingMeters, 0);
  const activeRollsCount = rolls.filter((r) => r.remainingMeters > 0).length;

  return (
    <div className="min-h-screen bg-[#F4F6F9] text-slate-900 flex flex-col antialiased selection:bg-amber-200">
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
            รีโหลดหน้านี้ ({activeTab === 'dashboard' ? 'แดชบอร์ด' : activeTab === 'rolls' ? 'ม้วนฟอยล์' : activeTab === 'history' ? 'ประวัติ' : 'ตั้งค่า'})
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
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[90] w-[min(92vw,28rem)] animate-in fade-in slide-in-from-bottom-4 duration-200"
        >
          <div
            className={`px-4 py-3 rounded-2xl shadow-2xl border text-sm font-medium flex items-start gap-2.5 ${
              toastMessage.type === 'success'
                ? 'bg-emerald-600 text-white border-emerald-500'
                : toastMessage.type === 'error'
                  ? 'bg-rose-600 text-white border-rose-500'
                  : 'bg-white text-slate-800 border-slate-200'
            }`}
          >
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-white shrink-0 mt-0.5" />
            ) : toastMessage.type === 'error' ? (
              <AlertTriangle className="w-5 h-5 text-white shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
            )}
            <span className="flex-1 leading-snug pt-0.5">{toastMessage.text}</span>
            <button
              type="button"
              onClick={() => {
                if (toastTimerRef.current) {
                  clearTimeout(toastTimerRef.current);
                  toastTimerRef.current = null;
                }
                setToastMessage(null);
              }}
              className={`shrink-0 p-1 rounded-lg transition-colors cursor-pointer ${
                toastMessage.type === 'info'
                  ? 'hover:bg-slate-100 text-slate-500'
                  : 'hover:bg-white/15 text-white/90'
              }`}
              aria-label="ปิด"
              title="ปิด"
            >
              <X className="w-4 h-4" />
            </button>
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
        onOpenPuSandwichModal={() => requireEditorPermission(() => {
          // Clear any record left over from a previous edit so this button always
          // opens an empty form instead of silently overwriting that record.
          setEditingPuSandwich(null);
          setIsPuSandwichModalOpen(true);
        })}
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
        currentUserEmail={currentUserEmail}
        onSignOut={handleSignOut}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-5 pb-20 md:pb-8">
        {activeTab === 'dashboard' && (
          <DashboardOverview
            rolls={rolls}
            records={records}
            puRecords={puSandwichRecords}
            archivedRolls={archivedRolls}
            archiveLoaded={archiveLoaded}
            onLoadArchive={async () => {
              if (isLoadingArchive || (archiveLoaded && archivedRolls.length > 0)) return;
              setIsLoadingArchive(true);
              try {
                const archived = await fetchArchivedFoilRolls();
                setArchivedRolls(archived);
                setArchiveLoaded(true);
              } catch (err) {
                console.warn('Dashboard archive load:', err);
              } finally {
                setIsLoadingArchive(false);
              }
            }}
            onOpenCutModal={(rollId) => {
              requireEditorPermission(() => {
                setPreselectedRollId(rollId || null);
                setCutModalInitialMode('so');
                setIsCutModalOpen(true);
              });
            }}
            onOpenAddModal={() => requireEditorPermission(() => setIsAddModalOpen(true))}
            onOpenPuSandwichModal={() => requireEditorPermission(() => {
              setEditingPuSandwich(null);
              setIsPuSandwichModalOpen(true);
            })}
            onOpenDailyFlow={() => setIsDailyFlowOpen(true)}
            onViewAllRolls={() => setActiveTab('rolls')}
            onViewAllHistory={(category) => {
              setHistoryInitialCategory(category || 'all');
              setActiveTab('history');
            }}
            onOpenMonthlySummary={(scope) => {
              setMonthlySummaryScope(scope || 'all');
              setIsMonthlySummaryOpen(true);
            }}
            onOpenCycleCount={() => requireEditorPermission(() => setIsCycleCountOpen(true))}
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
            records={records}
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
            onUpdateRoll={(updatedRoll) => requireEditorPermission(() => handleUpdateRoll(updatedRoll))}
            onEditRoll={(roll) => requireEditorPermission(() => setEditingRoll(roll))}
            userMode={userMode}
            onRequestUnlock={() => requireEditorPermission(() => {})}
          />
        )}

        {activeTab === 'history' && (
          <CuttingHistoryTable
            records={records}
            rolls={[...rolls, ...archivedRolls]}
            puRecords={puSandwichRecords}
            initialCategory={historyInitialCategory}
            onDeleteRecord={(recId) => requireEditorPermission(() => {
              handleDeleteRecord(recId).catch(() => {});
            })}
            onEditRecord={(rec) =>
              requireEditorPermission(() => setEditingCutRecord(rec))
            }
            onDeleteSandwichRecord={(recId) => requireEditorPermission(() => handleDeletePuSandwichCut(recId))}
            onEditSandwichRecord={(rec) => requireEditorPermission(() => {
              setEditingPuSandwich(rec);
              setIsPuSandwichModalOpen(true);
            })}
            onOpenCutModal={() => {
              requireEditorPermission(() => {
                setPreselectedRollId(null);
                setCutModalInitialMode('so');
                setIsCutModalOpen(true);
              });
            }}
            onOpenPuSandwichModal={() => requireEditorPermission(() => {
              setEditingPuSandwich(null);
              setIsPuSandwichModalOpen(true);
            })}
            userMode={userMode}
            onRequestUnlock={(action) => requireEditorPermission(typeof action === 'function' ? action : () => {})}
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
            onOpenCycleCountHistory={() => setIsCycleCountHistoryOpen(true)}
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
        onClose={() => {
          setIsPuSandwichModalOpen(false);
          setEditingPuSandwich(null);
        }}
        editingRecord={editingPuSandwich}
        records={puSandwichRecords}
        currentUserEmail={currentUserEmail}
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
        existingRecords={records}
        preselectedRollId={preselectedRollId}
        initialCutMode={cutModalInitialMode}
        currentUserEmail={currentUserEmail}
        onConfirmCut={handleConfirmCut}
        onConfirmCutBatch={handleConfirmCutBatch}
        onRollRefreshed={(fresh) => {
          setRolls((prev) => {
            const next = prev.map((r) => (r.id === fresh.id ? { ...r, ...fresh } : r));
            saveStoredRolls(next);
            return next;
          });
        }}
      />

      {/* Daily Production Flow Modal (กดจากแดชบอร์ดแล้วแสดงเป็นป๊อปอัพ) */}
      {isDailyFlowOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-5xl w-full max-h-[92dvh] flex flex-col overflow-hidden animate-in zoom-in-95">
            <div className="px-5 py-3.5 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-900 text-white flex items-center justify-between shrink-0 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-bold">
                  <Workflow className="w-4 h-4 stroke-[2.4]" />
                </div>
                <div>
                  <h3 className="text-base font-bold">ผังการผลิตรายวัน (Daily Production Flow)</h3>
                  <p className="text-[11px] text-slate-300">ติดตามยอดผลิตจริง, แผนลำดับตัด SO และสัดส่วนฟอยล์ vs PU แซนวิช</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDailyFlowOpen(false)}
                className="p-1.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="ปิดหน้าต่างผังผลิตรายวัน"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 sm:p-5">
              <DailyProductionFlow
                records={records}
                rolls={rolls}
                puRecords={puSandwichRecords}
                onOpenCutModal={() => {
                  setIsDailyFlowOpen(false);
                  requireEditorPermission(() => {
                    setPreselectedRollId(null);
                    setCutModalInitialMode('so');
                    setIsCutModalOpen(true);
                  });
                }}
                showToast={(msg, type) =>
                  showToast(msg, type === 'error' ? 'error' : type === 'info' ? 'info' : 'success')
                }
              />
            </div>
          </div>
        </div>
      )}

      {/* Edit existing SO cut record */}
      <EditSOCutModal
        isOpen={Boolean(editingCutRecord)}
        onClose={() => setEditingCutRecord(null)}
        record={editingCutRecord}
        roll={
          editingCutRecord
            ? rolls.find((r) => r.id === editingCutRecord.foilId) || null
            : null
        }
        onSave={handleUpdateCutRecord}
      />

      {/* Comprehensive Roll Usage History Modal */}
      {detailRoll && (
        <RollUsageHistoryModal
          roll={rolls.find((r) => r.id === detailRoll.id) || detailRoll}
          records={records}
          onClose={() => setDetailRoll(null)}
          onOpenCutForThisRoll={handleOpenCutForRoll}
          onEditRoll={(roll) => requireEditorPermission(() => setEditingRoll(roll))}
          onEditCutRecord={(rec) => requireEditorPermission(() => setEditingCutRecord(rec))}
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
        sandwichRecords={puSandwichRecords}
        initialScope={monthlySummaryScope}
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

      {/* Cycle Count History / Compare Modal */}
      <CycleCountHistoryModal
        isOpen={isCycleCountHistoryOpen}
        onClose={() => setIsCycleCountHistoryOpen(false)}
        showToast={showToast}
        canEdit={userMode === 'editor'}
        onRequestUnlock={() => requireEditorPermission(() => {})}
        onDeleteSession={handleDeleteCycleCountSession}
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
