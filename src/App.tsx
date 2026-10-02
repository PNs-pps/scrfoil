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
  subscribeToChemicalStock,
  saveChemicalStockToFirestore,
  subscribeToChemicalCuts,
  saveChemicalCutToFirestore,
  deleteChemicalCutFromFirestore,
  subscribeToChemicalRestock,
  saveChemicalRestockToFirestore,
  deleteChemicalRestockFromFirestore,
  subscribeToChemicalFormulas,
  saveChemicalFormulaToFirestore,
  deleteChemicalFormulaFromFirestore
} from './lib/firebase';
import { 
  CycleCountSession,
  ChemicalStock,
  ChemicalCutRecord,
  ChemicalRestockRecord,
  ChemicalFormula
} from './types';
import {
  getStoredChemicalStock,
  saveStoredChemicalStock,
  getStoredFormulas,
  saveStoredFormulas,
  getStoredChemicalCutRecords,
  saveStoredChemicalCutRecords,
  getStoredChemicalRestockRecords,
  saveStoredChemicalRestockRecords,
  revertChemicalCut,
  deleteRestockRecord,
  updateRestockRecord,
  updateDrumInRecords,
  updateFolderDensitiesInRecords,
  deleteDrumWithStock,
  normalizeFormulaList,
  normalizeInchSize
} from './utils/chemicalStock';
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
import { ChemicalStockView } from './components/ChemicalStockView';
import { ChemicalDeductModal } from './components/ChemicalDeductModal';
import { ChemicalRestockModal } from './components/ChemicalRestockModal';
import { ChemicalFormulaModal } from './components/ChemicalFormulaModal';
import { MobileBottomNav } from './components/MobileBottomNav';
import { PasswordPromptModal } from './components/PasswordPromptModal';
import { IntegrityCheckModal } from './components/IntegrityCheckModal';
import { SOBugInspectorModal } from './components/SOBugInspectorModal';
import { CycleCountModal } from './components/CycleCountModal';
import { CycleCountHistoryModal } from './components/CycleCountHistoryModal';
import { auditAllRollsSOHistory } from './utils/soHistoryAudit';
import { getUserMode, setUserMode as saveUserMode, UserMode } from './utils/auth';
import { createBackupSnapshot, getAutoBackupConfig, saveAutoBackupConfig, exportFullBackupJSON, getAllDueD1ScheduleSlots, markD1ScheduleSlotRun } from './utils/autoBackup';
import { getD1BackupConfig, uploadBackupToD1 } from './utils/d1Backup';
import { formatMeters, round2 } from './utils/formatters';
import { checkStockIntegrity, shouldRunAutoCheck, markAutoCheckRun, getCheckState, IntegrityMismatch } from './utils/integrityCheck';
import { CheckCircle2, AlertCircle, AlertTriangle, Sparkles, X } from 'lucide-react';

type AppTab = 'dashboard' | 'rolls' | 'history' | 'flow' | 'sandwich' | 'chemical' | 'settings';

export default function App() {
  const [rolls, setRolls] = useState<FoilRoll[]>([]);
  const [archivedRolls, setArchivedRolls] = useState<FoilRoll[]>([]);
  const [archiveLoaded, setArchiveLoaded] = useState(false);
  const [isLoadingArchive, setIsLoadingArchive] = useState(false);
  const [records, setRecords] = useState<StockCutRecord[]>([]);
  const [puSandwichRecords, setPuSandwichRecords] = useState<PuSandwichCutRecord[]>([]);
  
  // Chemical Stock & Formula State (ตัดสต๊อกน้ำยา PU แยกจากฟอยล์)
  const [chemicalStock, setChemicalStock] = useState<ChemicalStock>(() => getStoredChemicalStock());
  const [chemicalCutRecords, setChemicalCutRecords] = useState<ChemicalCutRecord[]>(() => getStoredChemicalCutRecords());
  const [chemicalRestockRecords, setChemicalRestockRecords] = useState<ChemicalRestockRecord[]>(() => getStoredChemicalRestockRecords());
  const [chemicalFormulas, setChemicalFormulas] = useState<ChemicalFormula[]>(() => getStoredFormulas());

  // Chemical Modals
  const [isChemicalDeductOpen, setIsChemicalDeductOpen] = useState(false);
  const [isChemicalRestockOpen, setIsChemicalRestockOpen] = useState(false);
  const [isChemicalFormulaOpen, setIsChemicalFormulaOpen] = useState(false);
  const [editingRestockRecord, setEditingRestockRecord] = useState<ChemicalRestockRecord | null>(null);

  // Persistent activeTab so that reloading keeps the user on the exact page being viewed
  const [activeTab, setActiveTabRaw] = useState<AppTab>(() => {
    try {
      const hash = window.location.hash.replace('#', '') as AppTab;
      if (['dashboard', 'rolls', 'history', 'flow', 'sandwich', 'chemical', 'settings'].includes(hash)) {
        return hash;
      }
      const saved = sessionStorage.getItem('scrfoil_active_tab') as AppTab;
      if (saved && ['dashboard', 'rolls', 'history', 'flow', 'sandwich', 'chemical', 'settings'].includes(saved)) {
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

  // Signed-in Google account (AuthGate guarantees this exists by the time App
  // mounts, but keep it live here too so the Navbar can show who's signed in
  // and offer sign-out).
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(auth.currentUser?.email || null);
  useEffect(() => {
    setCurrentUserEmail(auth.currentUser?.email || null);
  }, []);
  const handleSignOut = async () => {
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
    return soAuditResults.filter((r) =>
      r.issues.some((i) => i.type !== 'SPLIT_PRODUCTION_BATCH')
    ).length;
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
  const [editingPuSandwich, setEditingPuSandwich] = useState<PuSandwichCutRecord | null>(null);
  const [cutModalInitialMode, setCutModalInitialMode] = useState<'so' | 'non_so'>('so');
  const [preselectedRollId, setPreselectedRollId] = useState<string | null>(null);
  const [detailRoll, setDetailRoll] = useState<FoilRoll | null>(null);
  const [editingRoll, setEditingRoll] = useState<FoilRoll | null>(null);
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
        setRolls((prev) => {
          const prevMap = new Map(prev.map((r) => [r.id, r]));
          // ถเพิ่ง realign/ตัดยอด — เก็บยอด local ไว้ ไม่ให้ cache เก่เด้งกลับ
          const mergedServer = firestoreRolls.map((r) => {
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

    // 5. Realtime listener for Chemical Stock (สต๊อกน้ำยา PU)
    const unsubChemicalStock = subscribeToChemicalStock(
      (remoteStock) => {
        if (remoteStock) {
          setChemicalStock(remoteStock);
          saveStoredChemicalStock(remoteStock);
        }
      },
      (err: any) => {
        console.warn('Chemical stock sync note:', err?.message || err);
      }
    );

    // 6. Realtime listener for Chemical Cuts (ประวัติตัดสต๊อกน้ำยา)
    const unsubChemicalCuts = subscribeToChemicalCuts(
      (remoteCuts) => {
        setChemicalCutRecords(remoteCuts);
        saveStoredChemicalCutRecords(remoteCuts);
      },
      (err: any) => {
        console.warn('Chemical cuts sync note:', err?.message || err);
      }
    );

    // 7. Realtime listener for Chemical Restock (ประวัติรับเข้าน้ำยา)
    const unsubChemicalRestock = subscribeToChemicalRestock(
      (remoteRestocks) => {
        setChemicalRestockRecords(remoteRestocks);
        saveStoredChemicalRestockRecords(remoteRestocks);
      },
      (err: any) => {
        console.warn('Chemical restock sync note:', err?.message || err);
      }
    );

    // 8. Realtime listener for Chemical Formulas (สูตรคำนวณน้ำยา)
    const unsubChemicalFormulas = subscribeToChemicalFormulas(
      (remoteFormulas) => {
        if (remoteFormulas && remoteFormulas.length > 0) {
          // ผ่านตัวทำความสะอาดเดียวกับ localStorage (รูปแบบ Density "Nk", นิ้ว 1/2 เท่านั้น)
          const normalized = normalizeFormulaList(remoteFormulas);
          // สูตรตั้งต้น 1.5 นิ้วเดิมที่ค้างบน Cloud → ลบทิ้ง ไม่ให้กลับมาอีก
          remoteFormulas
            .filter(f => f.id === 'formula-1.5inch' && !normalizeInchSize(f.inchSize))
            .forEach(f => { deleteChemicalFormulaFromFirestore(f.id).catch(() => {}); });
          setChemicalFormulas(normalized);
          saveStoredFormulas(normalized);
        }
      },
      (err: any) => {
        console.warn('Chemical formulas sync note:', err?.message || err);
      }
    );

    return () => {
      unsubRolls();
      unsubRecords();
      unsubSandwich();
      unsubChemicalStock();
      unsubChemicalCuts();
      unsubChemicalRestock();
      unsubChemicalFormulas();
    };
  }, []);

  // เก็บข้อมูลล่าสุดไว้ใน ref — ให้ timer อ่านค่าล่าสุดได้โดยไม่ต้องรีเซ็ต interval
  // ทุกครั้งที่ realtime อัปเดต (เดิม interval ถูกสร้างใหม่ทุกครั้งที่ rolls/records
  // เปลี่ยน ทำให้ถ้าข้อมูลอัปเดตถี่กว่ารอบ backup สำรองอัตโนมัติจะไม่ทำงานเลย)
  const latestDataRef = useRef({ rolls, records, puSandwichRecords, syncStatus });
  latestDataRef.current = { rolls, records, puSandwichRecords, syncStatus };
  const hasRolls = rolls.length > 0;
  const d1UploadInFlightRef = useRef(false);

  // Automatic Background Backup (Local Snapshots & Cloud Sync)
  useEffect(() => {
    if (!hasRolls) return;

    const runAutoBackup = () => {
      const config = getAutoBackupConfig();
      if (!config.enabled) return;
      const { rolls: curRolls, records: curRecords, syncStatus: curSync } = latestDataRef.current;
      if (curRolls.length === 0) return;

      if (config.saveLocalSnapshots) {
        createBackupSnapshot(curRolls, curRecords, 'scheduled');
      }

      // Also sync to cloud if enabled and online
      if (config.autoSyncCloud && curSync === 'connected') {
        uploadAllToFirestore(curRolls, curRecords).catch((err) => {
          console.warn('Background auto cloud backup notice:', err);
        });
      }
    };

    const config = getAutoBackupConfig();
    const intervalMs = Math.max(1, config.intervalMinutes || 10) * 60 * 1000;
    const intervalId = setInterval(runAutoBackup, intervalMs);

    return () => clearInterval(intervalId);
  }, [hasRolls]);

  // Cloudflare D1 scheduled backup — fixed times daily (12:30 / 17:30), using
  // the Worker URL + secret already saved in Settings > Backup. Independent
  // of the Firebase interval above. Checks right away on open and once a
  // minute after that; if the device/app was closed at 12:30 or 17:30, the
  // moment it's opened again after that time it treats the slot as still due
  // and backs up immediately (catching up on any slots missed since midnight,
  // in one upload) rather than waiting for the next scheduled time. The
  // person can also always press "สำรองขึ้น D1" in Settings on demand.
  useEffect(() => {
    if (!hasRolls) return;

    const checkD1Schedule = () => {
      if (d1UploadInFlightRef.current) return;
      const config = getAutoBackupConfig();
      if (!config.autoSyncD1) return;
      const { rolls: curRolls, records: curRecords, puSandwichRecords: curSandwich } = latestDataRef.current;
      if (curRolls.length === 0) return;

      const dueSlots = getAllDueD1ScheduleSlots();
      if (dueSlots.length === 0) return;

      const d1Config = getD1BackupConfig();
      if (!d1Config.workerUrl || !d1Config.secret) return;

      d1UploadInFlightRef.current = true;
      uploadBackupToD1({
        rolls: curRolls,
        records: curRecords,
        sandwichRecords: curSandwich,
        label: 'สำรองอัตโนมัติ (ตามเวลาที่ตั้งไว้)',
        reason: 'scheduled',
      })
        .then(() => {
          // ทำเครื่องหมายว่า slot เสร็จ "หลังอัปโหลดสำเร็จ" เท่านั้น
          // (เดิมทำเครื่องหมายก่อน ถ้าอัปโหลดล้มเหลว รอบนั้นจะถูกข้ามทั้งวัน)
          dueSlots.forEach(markD1ScheduleSlotRun);
          saveAutoBackupConfig({ ...getAutoBackupConfig(), lastD1AutoBackupTime: new Date().toISOString() });
        })
        .catch((err) => {
          console.warn('Scheduled D1 backup notice:', err);
        })
        .finally(() => {
          d1UploadInFlightRef.current = false;
        });
    };

    checkD1Schedule();
    const intervalId = setInterval(checkD1Schedule, 60 * 1000);
    return () => clearInterval(intervalId);
  }, [hasRolls]);

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
      isUnused: true,
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
      isUnused: true,
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
    const exists = puSandwichRecords.some((r) => r.id === record.id);
    const updated = exists
      ? puSandwichRecords.map((r) => (r.id === record.id ? record : r))
      : [record, ...puSandwichRecords];
    setPuSandwichRecords(updated);
    saveStoredPuSandwichRecords(updated);

    try {
      await savePuSandwichCutToFirestore(record);
      setSyncStatus('connected');
      setLastSyncedTime(new Date().toLocaleTimeString('th-TH'));
      const metersTxt = record.soLengthMeters ? ` · ${record.soLengthMeters} ม.` : '';
      showToast(
        `${exists ? 'แก้ไข' : 'บันทึก'} SO แซนวิช ${record.soNumber}${metersTxt} สำเร็จ [Cloud]`,
        'success'
      );
    } catch (err: any) {
      console.warn('Notice: PU Sandwich cloud sync pending/offline:', err?.message || err);
      showToast(`บันทึก SO แซนวิช ${record.soNumber} ในเครื่องแล้ว (รอซิงค์ Cloud)`, 'info');
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

  // PU Chemical Stock Handlers (ระบบตัดสต๊อกน้ำยา PU แยกจากฟอยล์)
  const handleConfirmChemicalCut = async (cutRecord: ChemicalCutRecord, updatedStock: ChemicalStock) => {
    // 1. ปรับยอดคงเหลือน้ำยาใน state & LocalStorage
    setChemicalStock(updatedStock);
    saveStoredChemicalStock(updatedStock);

    // 2. เพิ่มใบตัดน้ำยาในประวัติ
    const updatedCuts = [cutRecord, ...chemicalCutRecords];
    setChemicalCutRecords(updatedCuts);
    saveStoredChemicalCutRecords(updatedCuts);

    showToast(`ตัดสต๊อกน้ำยา SO ${cutRecord.soNumber} สำเร็จ (-${cutRecord.totalChemicalKg} กก.) [A: -${cutRecord.partAKg} / B: -${cutRecord.partBKg}]`);

    // 3. บันทึกและซิงค์ Realtime เข้า Firestore
    try {
      await Promise.all([
        saveChemicalStockToFirestore(updatedStock),
        saveChemicalCutToFirestore(cutRecord),
      ]);
      setSyncStatus('connected');
      setLastSyncedTime(new Date().toLocaleTimeString('th-TH'));
    } catch (err: any) {
      console.warn('Notice: Chemical cut cloud sync pending/offline:', err?.message || err);
    }
  };

  const handleRevertChemicalCut = async (recordId: string) => {
    const { updatedStock, remainingRecords, revertedRecord } = revertChemicalCut(
      recordId,
      chemicalCutRecords,
      chemicalStock
    );

    if (!revertedRecord) return;

    setChemicalStock(updatedStock);
    saveStoredChemicalStock(updatedStock);

    setChemicalCutRecords(remainingRecords);
    saveStoredChemicalCutRecords(remainingRecords);

    showToast(`ยกเลิกตัดสต๊อกน้ำยา SO ${revertedRecord.soNumber} และคืนยอด +${revertedRecord.totalChemicalKg} กก. เข้าคลังเรียบร้อย`);

    try {
      await Promise.all([
        saveChemicalStockToFirestore(updatedStock),
        deleteChemicalCutFromFirestore(recordId),
      ]);
      setSyncStatus('connected');
      setLastSyncedTime(new Date().toLocaleTimeString('th-TH'));
    } catch (err: any) {
      console.warn('Notice: Chemical cut revert cloud sync pending/offline:', err?.message || err);
    }
  };

  const handleConfirmChemicalRestock = async (record: ChemicalRestockRecord, updatedStock: ChemicalStock) => {
    setChemicalStock(updatedStock);
    saveStoredChemicalStock(updatedStock);

    const exists = chemicalRestockRecords.some(r => r.id === record.id);
    const updatedRestocks = exists 
      ? chemicalRestockRecords.map(r => r.id === record.id ? record : r)
      : [record, ...chemicalRestockRecords];

    setChemicalRestockRecords(updatedRestocks);
    saveStoredChemicalRestockRecords(updatedRestocks);

    try {
      await Promise.all([
        saveChemicalStockToFirestore(updatedStock),
        saveChemicalRestockToFirestore(record),
      ]);
      setSyncStatus('connected');
      setLastSyncedTime(new Date().toLocaleTimeString('th-TH'));
    } catch (err: any) {
      console.warn('Notice: Chemical restock cloud sync pending/offline:', err?.message || err);
    }
  };

  const handleDeleteChemicalRestock = async (recordId: string) => {
    const { updatedStock, remainingRestocks, deletedRecord } = deleteRestockRecord(
      recordId,
      chemicalRestockRecords,
      chemicalStock
    );

    if (!deletedRecord) return;

    setChemicalStock(updatedStock);
    saveStoredChemicalStock(updatedStock);

    setChemicalRestockRecords(remainingRestocks);
    saveStoredChemicalRestockRecords(remainingRestocks);

    showToast(`ลบรายการรับเข้าน้ำยา "${deletedRecord.chemicalName}" (${deletedRecord.date}) และปรับลดยอดสต๊อกคงเหลือเรียบร้อย`);

    try {
      await Promise.all([
        saveChemicalStockToFirestore(updatedStock),
        deleteChemicalRestockFromFirestore(recordId),
      ]);
      setSyncStatus('connected');
      setLastSyncedTime(new Date().toLocaleTimeString('th-TH'));
    } catch (err: any) {
      console.warn('Notice: Chemical restock deletion cloud sync pending/offline:', err?.message || err);
    }
  };

  const handleSaveDrum = async (
    oldDrumNumber: string,
    newDrumNumber: string,
    oldChemicalName: string,
    newChemicalName: string,
    supplier?: string,
    initialKg?: number,
    receivedDate?: string
  ) => {
    const { updatedRestocks, updatedCuts, updatedStock } = updateDrumInRecords(
      oldDrumNumber,
      newDrumNumber,
      oldChemicalName,
      newChemicalName,
      chemicalRestockRecords,
      chemicalCutRecords,
      { supplier, initialKg, receivedDate },
      chemicalStock
    );

    // บันทึกเฉพาะรายการที่เปลี่ยนจริง (เดิมเขียนทับทุกรายการทุกครั้ง)
    const oldRestockById = new Map(chemicalRestockRecords.map(r => [r.id, JSON.stringify(r)]));
    const changedRestocks = updatedRestocks.filter(r => oldRestockById.get(r.id) !== JSON.stringify(r));
    const oldCutById = new Map(chemicalCutRecords.map(c => [c.id, JSON.stringify(c)]));
    const changedCuts = updatedCuts.filter(c => oldCutById.get(c.id) !== JSON.stringify(c));

    setChemicalRestockRecords(updatedRestocks);
    saveStoredChemicalRestockRecords(updatedRestocks);

    setChemicalCutRecords(updatedCuts);
    saveStoredChemicalCutRecords(updatedCuts);

    if (updatedStock) {
      setChemicalStock(updatedStock);
      saveStoredChemicalStock(updatedStock);
    }

    try {
      await Promise.all([
        ...changedRestocks.map(r => saveChemicalRestockToFirestore(r)),
        ...changedCuts.map(c => saveChemicalCutToFirestore(c)),
        ...(updatedStock ? [saveChemicalStockToFirestore(updatedStock)] : []),
      ]);
      setSyncStatus('connected');
      setLastSyncedTime(new Date().toLocaleTimeString('th-TH'));
    } catch (err: any) {
      console.warn('Notice: Drum update cloud sync pending/offline:', err?.message || err);
    }
  };

  const handleDeleteDrum = async (drumNumber: string, chemicalName: string) => {
    const { updatedRestocks, changedRecordIds, removedRecordIds, updatedStock } = deleteDrumWithStock(
      drumNumber,
      chemicalName,
      chemicalRestockRecords,
      chemicalCutRecords,
      chemicalStock
    );
    setChemicalRestockRecords(updatedRestocks);
    saveStoredChemicalRestockRecords(updatedRestocks);
    // หักยอดคงเหลือของถังที่ลบออกจากสต๊อกรวม
    setChemicalStock(updatedStock);
    saveStoredChemicalStock(updatedStock);

    try {
      await Promise.all([
        saveChemicalStockToFirestore(updatedStock),
        ...updatedRestocks.filter(r => changedRecordIds.includes(r.id)).map(r => saveChemicalRestockToFirestore(r)),
        ...removedRecordIds.map(id => deleteChemicalRestockFromFirestore(id)),
      ]);
      setSyncStatus('connected');
      setLastSyncedTime(new Date().toLocaleTimeString('th-TH'));
    } catch (err: any) {
      console.warn('Notice: Drum deletion cloud sync pending/offline:', err?.message || err);
    }
  };

  const handleUpdateFolderDensities = async (chemicalName: string, densities: string[]) => {
    const updatedRestocks = updateFolderDensitiesInRecords(chemicalName, densities, chemicalRestockRecords);
    setChemicalRestockRecords(updatedRestocks);
    saveStoredChemicalRestockRecords(updatedRestocks);
    showToast(`กำหนดค่า K สำหรับน้ำยา "${chemicalName}" เรียบร้อย (${densities.join(', ')})`);

    try {
      await Promise.all(
        updatedRestocks
          .filter(r => r.chemicalName === chemicalName)
          .map(r => saveChemicalRestockToFirestore(r))
      );
      setSyncStatus('connected');
      setLastSyncedTime(new Date().toLocaleTimeString('th-TH'));
    } catch (err: any) {
      console.warn('Notice: Folder densities sync pending/offline:', err?.message || err);
    }
  };

  const handleSaveChemicalFormulas = async (newFormulas: ChemicalFormula[]) => {
    // สูตรที่ถูกลบออกจากรายการต้องลบบน Cloud ด้วย (เดิมไม่ลบ ทำให้สูตรที่ลบแล้วกลับมาเองหลังซิงค์)
    const keepIds = new Set(newFormulas.map(f => f.id));
    const removedFormulas = chemicalFormulas.filter(f => !keepIds.has(f.id));

    setChemicalFormulas(newFormulas);
    saveStoredFormulas(newFormulas);

    showToast(`บันทึกสูตรคำนวณน้ำยาเรียบร้อย (${newFormulas.length} สูตร)`);

    try {
      await Promise.all([
        ...newFormulas.map(f => saveChemicalFormulaToFirestore(f)),
        ...removedFormulas.map(f => deleteChemicalFormulaFromFirestore(f.id)),
      ]);
      setSyncStatus('connected');
      setLastSyncedTime(new Date().toLocaleTimeString('th-TH'));
    } catch (err: any) {
      console.warn('Notice: Chemical formulas cloud sync pending/offline:', err?.message || err);
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
      createBackupSnapshot(nextRolls, nextRecords, 'realign_chain');

      const newIssues = checkStockIntegrity(nextRolls, nextRecords);
      setStockIntegrityIssues(newIssues);

      showToast(
        `ปรับยอดก่อนตัด–หลังตัดของล็อต ${updatedRoll.lotNumber} #${updatedRoll.rollNumber} ให้ต่อเนื่องแล้ว (คงเหลือ ${formatMeters(updatedRoll.remainingMeters)} ม.)`,
        'success'
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
        chemicalCutsCount={chemicalCutRecords.length}
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
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 pb-24 md:pb-6">
        {activeTab === 'dashboard' && (
          <DashboardOverview
            rolls={rolls}
            records={records}
            archivedRolls={archivedRolls}
            archiveLoaded={archiveLoaded}
            onLoadArchive={async () => {
              if (isLoadingArchive || archiveLoaded) return;
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
            onViewAllRolls={() => setActiveTab('rolls')}
            onViewAllHistory={() => setActiveTab('history')}
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
            rolls={rolls}
            onDeleteRecord={(recId) => requireEditorPermission(() => {
              // handleDeleteRecord now rethrows on failure (so the duplicate-
              // delete confirm dialog elsewhere can detect it); this call site
              // doesn't await the result, so swallow here — the error alert
              // modal triggered inside handleDeleteRecord already informs the user.
              handleDeleteRecord(recId).catch(() => {});
            })}
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
            onOpenCreateModal={() => requireEditorPermission(() => {
              setEditingPuSandwich(null);
              setIsPuSandwichModalOpen(true);
            })}
            onEditRecord={(rec) => requireEditorPermission(() => {
              setEditingPuSandwich(rec);
              setIsPuSandwichModalOpen(true);
            })}
            onDeleteRecord={(recId) => requireEditorPermission(() => handleDeletePuSandwichCut(recId))}
            userMode={userMode}
            onUnlockEditor={() => requireEditorPermission(() => {})}
          />
        )}

        {activeTab === 'chemical' && (
          <ChemicalStockView
            stock={chemicalStock}
            cutRecords={chemicalCutRecords}
            restockRecords={chemicalRestockRecords}
            formulas={chemicalFormulas}
            foilRecords={records}
            puRecords={puSandwichRecords}
            onOpenDeductModal={() => requireEditorPermission(() => setIsChemicalDeductOpen(true))}
            onOpenRestockModal={() => requireEditorPermission(() => {
              setEditingRestockRecord(null);
              setIsChemicalRestockOpen(true);
            })}
            onOpenFormulaModal={() => requireEditorPermission(() => setIsChemicalFormulaOpen(true))}
            onRevertCut={(recordId) => requireEditorPermission(() => handleRevertChemicalCut(recordId))}
            onEditRestock={(record) => requireEditorPermission(() => {
              setEditingRestockRecord(record);
              setIsChemicalRestockOpen(true);
            })}
            onDeleteRestock={(recordId) => requireEditorPermission(() => handleDeleteChemicalRestock(recordId))}
            onSaveDrum={(oldNum, newNum, oldChem, newChem, supp, initKg, recDate) => {
              requireEditorPermission(() => {
                handleSaveDrum(oldNum, newNum, oldChem, newChem, supp, initKg, recDate);
              });
            }}
            onDeleteDrum={(drumNum, chemName) => {
              requireEditorPermission(() => {
                handleDeleteDrum(drumNum, chemName);
              });
            }}
            onUpdateFolderDensities={(chemName, densities) => {
              requireEditorPermission(() => {
                handleUpdateFolderDensities(chemName, densities);
              });
            }}
            showToast={showToast}
            userMode={userMode}
            onRequestUnlock={() => requireEditorPermission(() => {})}
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
            onOpenCycleCountHistory={() => setIsCycleCountHistoryOpen(true)}
            isSaving={isSavingToCloud}
            isFetching={isFetchingFromCloud}
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
        onSaveCut={handleSavePuSandwichCut}
        onDeleteRecord={(recId) => requireEditorPermission(() => handleDeletePuSandwichCut(recId))}
      />

      {/* PU Chemical Stock Deduction Modal (ตัดสต๊อกน้ำยา PU ผูกสูตร & SO) */}
      <ChemicalDeductModal
        isOpen={isChemicalDeductOpen}
        onClose={() => setIsChemicalDeductOpen(false)}
        currentStock={chemicalStock}
        formulas={chemicalFormulas}
        foilRecords={records}
        puRecords={puSandwichRecords}
        chemicalCutRecords={chemicalCutRecords}
        restockRecords={chemicalRestockRecords}
        onConfirmCut={(cutRecord, updatedStock) => {
          requireEditorPermission(() => {
            handleConfirmChemicalCut(cutRecord, updatedStock);
            setIsChemicalDeductOpen(false);
          });
        }}
        onOpenManageFormulas={() => {
          setIsChemicalDeductOpen(false);
          setIsChemicalFormulaOpen(true);
        }}
        showToast={showToast}
      />

      {/* PU Chemical Restock Modal (รับเข้าน้ำยาเข้าสต๊อก) */}
      <ChemicalRestockModal
        isOpen={isChemicalRestockOpen}
        onClose={() => {
          setIsChemicalRestockOpen(false);
          setEditingRestockRecord(null);
        }}
        currentStock={chemicalStock}
        existingRestockRecords={chemicalRestockRecords}
        editingRecord={editingRestockRecord}
        onConfirmRestock={(restockRecord, updatedStock) => {
          requireEditorPermission(() => {
            handleConfirmChemicalRestock(restockRecord, updatedStock);
            setIsChemicalRestockOpen(false);
            setEditingRestockRecord(null);
          });
        }}
        showToast={showToast}
      />

      {/* PU Chemical Formulas Manager Modal (จัดการและผูกสูตรคำนวณ) */}
      <ChemicalFormulaModal
        isOpen={isChemicalFormulaOpen}
        onClose={() => setIsChemicalFormulaOpen(false)}
        formulas={chemicalFormulas}
        onSaveFormulas={(newFormulas) => {
          requireEditorPermission(() => {
            handleSaveChemicalFormulas(newFormulas);
          });
        }}
        showToast={showToast}
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
        existingRecords={records}
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
