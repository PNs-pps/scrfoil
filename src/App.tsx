import React, { useState, useEffect } from 'react';
import { FoilRoll, StockCutRecord } from './types';
import { 
  getStoredRolls, 
  saveStoredRolls, 
  getStoredCutRecords, 
  saveStoredCutRecords, 
  resetAllDataToDefault,
  exportRollsToCSV,
  exportCutRecordsToCSV
} from './utils/storage';
import { 
  subscribeToFoilRolls, 
  subscribeToStockCutRecords, 
  saveFoilRollToFirestore, 
  deleteFoilRollFromFirestore, 
  executeCutBatchInFirestore, 
  executeMultiRollCutBatchInFirestore,
  revertCutRecordInFirestore, 
  uploadAllToFirestore,
  testFirestoreConnection,
  firebaseConfig,
  activeTarget,
  setActiveTarget
} from './lib/firebase';
import { Navbar } from './components/Navbar';
import { FirebaseSyncBar } from './components/FirebaseSyncBar';
import { FirebaseRulesModal } from './components/FirebaseRulesModal';
import { DashboardOverview } from './components/DashboardOverview';
import { FoilRollTable } from './components/FoilRollTable';
import { CuttingHistoryTable } from './components/CuttingHistoryTable';
import { AddFoilModal } from './components/AddFoilModal';
import { CutStockModal } from './components/CutStockModal';
import { RollUsageHistoryModal } from './components/RollUsageHistoryModal';
import { MonthlySummaryModal } from './components/MonthlySummaryModal';
import { SOBatchImportModal } from './components/SOBatchImportModal';
import { SettingsBackupView } from './components/SettingsBackupView';
import { MobileBottomNav } from './components/MobileBottomNav';
import { createBackupSnapshot, getAutoBackupConfig } from './utils/autoBackup';
import { formatMeters, round2 } from './utils/formatters';
import { CheckCircle2, AlertCircle, Sparkles, X } from 'lucide-react';

export default function App() {
  const [rolls, setRolls] = useState<FoilRoll[]>([]);
  const [records, setRecords] = useState<StockCutRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'rolls' | 'history' | 'settings'>('dashboard');

  // Firebase Realtime Sync State
  const [syncStatus, setSyncStatus] = useState<'connected' | 'syncing' | 'error' | 'offline' | 'permission-denied'>('syncing');
  const [lastSyncedTime, setLastSyncedTime] = useState<string | null>(null);
  const [isSavingToCloud, setIsSavingToCloud] = useState(false);
  const [isFetchingFromCloud, setIsFetchingFromCloud] = useState(false);
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);
  
  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isCutModalOpen, setIsCutModalOpen] = useState(false);
  const [cutModalInitialMode, setCutModalInitialMode] = useState<'so' | 'non_so'>('so');
  const [preselectedRollId, setPreselectedRollId] = useState<string | null>(null);
  const [detailRollId, setDetailRollId] = useState<string | null>(null);
  const [isMonthlySummaryOpen, setIsMonthlySummaryOpen] = useState(false);
  const [isBatchImportOpen, setIsBatchImportOpen] = useState(false);

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

  // Realtime load & Firestore subscription
  useEffect(() => {
    // 1. Initial fast local load from cache
    const loadedRolls = getStoredRolls();
    const loadedRecords = getStoredCutRecords();
    setRolls(loadedRolls);
    setRecords(loadedRecords);

    // 2. Realtime listener for Foil Rolls
    let isInitialRollsFetch = true;
    const unsubRolls = subscribeToFoilRolls(
      (firestoreRolls) => {
        if (firestoreRolls.length > 0) {
          setRolls(firestoreRolls);
          saveStoredRolls(firestoreRolls);
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
      }
    );

    // 3. Realtime listener for Cut Records
    const unsubRecords = subscribeToStockCutRecords(
      (firestoreRecords) => {
        setRecords(firestoreRecords);
        saveStoredCutRecords(firestoreRecords);
        setSyncStatus('connected');
        setLastSyncedTime(new Date().toLocaleTimeString('th-TH'));
      },
      (err: any) => {
        console.warn('Stock cut records sync note:', err?.message || err);
        if (err?.code === 'permission-denied' || err?.message?.includes('permission')) {
          setSyncStatus('permission-denied');
        }
      }
    );

    return () => {
      unsubRolls();
      unsubRecords();
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

  // Cut stock handler (supports single roll batch and multi-roll import batch)
  const handleConfirmCutBatch = async (batchData: Omit<StockCutRecord, 'id' | 'createdAt'>[]): Promise<void> => {
    if (!batchData || batchData.length === 0) return;

    // Strict math sanitization: Ensure all inputs are positive and rounded
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

    // Group deductions by rollId
    const deductionsByRoll = new Map<string, { used: number; ng: number; total: number }>();
    createdRecords.forEach((rec) => {
      const existing = deductionsByRoll.get(rec.foilId) || { used: 0, ng: 0, total: 0 };
      existing.used = round2(existing.used + rec.usedMeters);
      existing.ng = round2(existing.ng + rec.ngMeters);
      existing.total = round2(existing.total + rec.totalDeducted);
      deductionsByRoll.set(rec.foilId, existing);
    });

    // Calculate updated foil rolls without negative values
    const updatedRollsList: FoilRoll[] = [];
    const updatedRolls = rolls.map((r) => {
      const deduction = deductionsByRoll.get(r.id);
      if (deduction) {
        const newRemaining = Math.max(0, round2(r.remainingMeters - deduction.total));
        const newUsed = Math.max(0, round2(r.usedMeters + deduction.used));
        const newNg = Math.max(0, round2(r.ngMeters + deduction.ng));
        const rollObj: FoilRoll = {
          ...r,
          remainingMeters: newRemaining,
          usedMeters: newUsed,
          ngMeters: newNg,
          status: newRemaining <= 0 ? ('out_of_stock' as const) : ('active' as const),
        };
        updatedRollsList.push(rollObj);
        return rollObj;
      }
      return r;
    });

    const updatedRecords = [...records, ...createdRecords];

    // STRICT DIRECTIVE: DO NOT update UI state until batch.commit() has finished completely!
    try {
      if (updatedRollsList.length === 1) {
        await executeCutBatchInFirestore(createdRecords, updatedRollsList[0]);
      } else if (updatedRollsList.length > 1) {
        await executeMultiRollCutBatchInFirestore(createdRecords, updatedRollsList);
      }

      // ✅ batch.commit() has finished successfully! Now update UI state:
      updateRollsState(updatedRolls);
      updateRecordsState(updatedRecords);

      // Automatic safety snapshot after successful cutting
      createBackupSnapshot(updatedRolls, updatedRecords, 'before_cut');

      setSyncStatus('connected');
      setLastSyncedTime(new Date().toLocaleTimeString('th-TH'));

      const totalDeductedAll = round2(createdRecords.reduce((sum, r) => sum + r.totalDeducted, 0));
      if (createdRecords.length === 1) {
        const single = createdRecords[0];
        const cutDesc = single.cutType === 'non_so' 
          ? `รายการไม่ใช้ SO (${single.nonSoReason || 'สาขายืม/ซ่อม'})`
          : `รหัส SO ${single.soNumber}`;
        showToast(`ตัดสต๊อกสำเร็จ! ${cutDesc} (ใช้ ${formatMeters(single.usedMeters)} ม. + NG ${formatMeters(single.ngMeters)} ม. | คงเหลือ ${formatMeters(single.remainingAfter)} ม.) [บันทึกลง Firebase เรียบร้อย]`);
      } else {
        showToast(`ตัดสต๊อกสำเร็จ ${createdRecords.length} รายการใบงาน! ยอดตัดรวม ${formatMeters(totalDeductedAll)} ม. (อัปเดต ${updatedRollsList.length} ม้วน) [บันทึกลง Firebase เรียบร้อย]`);
      }
    } catch (err: any) {
      console.error('Firebase batch commit error during stock cut:', err);
      if (err?.code === 'permission-denied' || err?.message?.includes('permission')) {
        setSyncStatus('permission-denied');
      } else {
        setSyncStatus('error');
      }

      const alertMsg = 'บันทึกไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อ';
      setErrorAlert({
        isOpen: true,
        title: 'แจ้งเตือนการบันทึกข้อมูล',
        message: alertMsg,
        detail: 'ไม่สามารถบันทึกข้อมูลประวัติการตัดสต๊อกลง Firebase ได้ ข้อมูลคงเหลือเดิมยังไม่ถูกเปลี่ยนแปลง กรุณาตรวจสอบสัญญาณอินเทอร์เน็ตหรือสถานะ Cloud แล้วลองใหม่อีกครั้ง',
      });

      // Reject so modal knows not to close
      throw new Error(alertMsg);
    }
  };

  // Backward compatible single cut handler
  const handleConfirmCut = async (cutData: Omit<StockCutRecord, 'id' | 'createdAt'>) => {
    await handleConfirmCutBatch([cutData]);
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
  const handleDeleteRecord = (recordId: string) => {
    const targetRecord = records.find((r) => r.id === recordId);
    if (!targetRecord) return;

    // Restore meters to the roll
    let updatedTargetRoll: FoilRoll | null = null;
    const updatedRolls = rolls.map((r) => {
      if (r.id === targetRecord.foilId) {
        const restoredRemaining = Math.min(r.totalMeters, r.remainingMeters + targetRecord.totalDeducted);
        const restoredUsed = Math.max(0, r.usedMeters - targetRecord.usedMeters);
        const restoredNg = Math.max(0, r.ngMeters - targetRecord.ngMeters);
        const rollObj: FoilRoll = {
          ...r,
          remainingMeters: restoredRemaining,
          usedMeters: restoredUsed,
          ngMeters: restoredNg,
          status: restoredRemaining > 0 ? ('active' as const) : ('depleted' as const),
          // Also drop the voided cut from the embedded recentCuts list so the roll's
          // history view doesn't keep showing a cut that no longer exists.
          recentCuts: (r.recentCuts || []).filter((c) => c.id !== recordId),
        };
        updatedTargetRoll = rollObj;
        return rollObj;
      }
      return r;
    });

    const updatedRecords = records.filter((r) => r.id !== recordId);
    updateRollsState(updatedRolls);
    updateRecordsState(updatedRecords);

    // Revert in Firestore
    if (updatedTargetRoll) {
      revertCutRecordInFirestore(recordId, updatedTargetRoll).catch((err) => {
        console.warn('Notice: Revert cut in Firestore pending/offline:', err?.message || err);
      });
    }

    showToast(`ยกเลิกรายการ SO ${targetRecord.soNumber} และคืนยอด ${targetRecord.totalDeducted.toLocaleString()} เมตร เข้าม้วนเรียบร้อย [ซิงค์ Cloud]`, 'info');
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

  // Reset to default sample
  const handleResetData = () => {
    if (confirm('คุณต้องการรีเซ็ตข้อมูลเป็นตัวอย่างเริ่มต้นของโรงงานหรือไม่? (ระบบจะสร้างจุดสำรองข้อมูลปัจจุบันไว้ให้ก่อนรีเซ็ต)')) {
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

  // Aggregate metrics
  const totalRemainingMeters = rolls.reduce((sum, r) => sum + r.remainingMeters, 0);
  const activeRollsCount = rolls.filter((r) => r.remainingMeters > 0).length;

  // Always derive the roll shown in the detail/history modal from the live `rolls`
  // state (never store a separate snapshot copy of it). Otherwise, cutting stock
  // for a roll while its detail modal is open would update `rolls` correctly but
  // leave the modal showing the old (pre-cut) remaining meters, since a snapshot
  // object never gets refreshed after the cut is saved.
  const detailRoll = detailRollId ? rolls.find((r) => r.id === detailRollId) || null : null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col antialiased selection:bg-amber-200">
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
        onOpenRulesModal={() => setIsRulesModalOpen(true)}
        onSwitchCloud={handleSwitchCloud}
        onNavigateToSettings={() => setActiveTab('settings')}
      />

      {/* Navigation Header */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenAddModal={() => setIsAddModalOpen(true)}
        onOpenCutModal={(mode = 'so') => {
          setPreselectedRollId(null);
          setCutModalInitialMode(mode);
          setIsCutModalOpen(true);
        }}
        totalRemainingMeters={totalRemainingMeters}
        activeRollsCount={activeRollsCount}
        onResetData={handleResetData}
        onExportRolls={() => exportRollsToCSV(rolls)}
        onExportHistory={() => exportCutRecordsToCSV(records)}
        hasPermissionNotice={syncStatus === 'permission-denied'}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 pb-24 md:pb-6">
        {activeTab === 'dashboard' && (
          <DashboardOverview
            rolls={rolls}
            records={records}
            onOpenCutModal={(rollId) => {
              setPreselectedRollId(rollId || null);
              setCutModalInitialMode('so');
              setIsCutModalOpen(true);
            }}
            onOpenAddModal={() => setIsAddModalOpen(true)}
            onViewAllRolls={() => setActiveTab('rolls')}
            onViewAllHistory={() => setActiveTab('history')}
            onOpenMonthlySummary={() => setIsMonthlySummaryOpen(true)}
            onOpenBatchImport={() => setIsBatchImportOpen(true)}
          />
        )}

        {activeTab === 'rolls' && (
          <FoilRollTable
            rolls={rolls}
            onOpenCutModal={handleOpenCutForRoll}
            onOpenAddModal={() => setIsAddModalOpen(true)}
            onViewRollHistory={(roll) => setDetailRollId(roll.id)}
            onDeleteRoll={handleDeleteRoll}
            onExportRolls={() => exportRollsToCSV(rolls)}
            onToggleZeroOut={handleToggleZeroOut}
            onOpenBatchImport={() => setIsBatchImportOpen(true)}
            onOpenMonthlySummary={() => setIsMonthlySummaryOpen(true)}
          />
        )}

        {activeTab === 'history' && (
          <CuttingHistoryTable
            records={records}
            onDeleteRecord={handleDeleteRecord}
            onOpenCutModal={() => {
              setPreselectedRollId(null);
              setCutModalInitialMode('so');
              setIsCutModalOpen(true);
            }}
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
            onManualSaveToCloud={handleManualSaveToCloud}
            onManualFetchFromCloud={handleManualFetchFromCloud}
            onRestoreData={(newRolls, newRecords) => {
              updateRollsState(newRolls);
              updateRecordsState(newRecords);
            }}
            onResetData={handleResetData}
            showToast={showToast}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2 font-mono">
          <div>
            หลังคาเย็นสยาม (ร่มเกล้า) • ระบบตัดสต๊อกฟอยล์หลังคา PU Foam เมทัลชีท หน้ากว้าง 830, 850, 880, 900 มม.
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
      <RollUsageHistoryModal
        roll={detailRoll}
        records={records}
        onClose={() => setDetailRollId(null)}
        onOpenCutForThisRoll={handleOpenCutForRoll}
      />

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
          setPreselectedRollId(null);
          setCutModalInitialMode(mode);
          setIsCutModalOpen(true);
        }}
        hasPermissionNotice={syncStatus === 'permission-denied'}
      />
    </div>
  );
}
