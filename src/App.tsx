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
import { CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';

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
  const [detailRoll, setDetailRoll] = useState<FoilRoll | null>(null);
  const [isMonthlySummaryOpen, setIsMonthlySummaryOpen] = useState(false);
  const [isBatchImportOpen, setIsBatchImportOpen] = useState(false);

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
  const handleConfirmCutBatch = (batchData: Omit<StockCutRecord, 'id' | 'createdAt'>[]) => {
    if (!batchData || batchData.length === 0) return;

    // Automatic safety snapshot before cutting
    createBackupSnapshot(rolls, records, 'before_cut');

    const now = new Date().toISOString();
    const createdRecords: StockCutRecord[] = batchData.map((item, idx) => ({
      ...item,
      id: `cut-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: now,
    }));

    // Group deductions by rollId
    const deductionsByRoll = new Map<string, { used: number; ng: number; total: number }>();
    createdRecords.forEach((rec) => {
      const existing = deductionsByRoll.get(rec.foilId) || { used: 0, ng: 0, total: 0 };
      existing.used += rec.usedMeters;
      existing.ng += rec.ngMeters;
      existing.total += rec.totalDeducted;
      deductionsByRoll.set(rec.foilId, existing);
    });

    // Update the corresponding foil rolls
    const updatedRollsList: FoilRoll[] = [];
    const updatedRolls = rolls.map((r) => {
      const deduction = deductionsByRoll.get(r.id);
      if (deduction) {
        const newRemaining = Math.max(0, round2(r.remainingMeters - deduction.total));
        const newUsed = round2(r.usedMeters + deduction.used);
        const newNg = round2(r.ngMeters + deduction.ng);
        const rollObj: FoilRoll = {
          ...r,
          remainingMeters: newRemaining,
          usedMeters: newUsed,
          ngMeters: newNg,
          status: newRemaining <= 0 ? ('depleted' as const) : ('active' as const),
        };
        updatedRollsList.push(rollObj);
        return rollObj;
      }
      return r;
    });

    const updatedRecords = [...records, ...createdRecords];
    updateRollsState(updatedRolls);
    updateRecordsState(updatedRecords);

    // Save batch to Firestore atomically
    if (updatedRollsList.length === 1) {
      executeCutBatchInFirestore(createdRecords, updatedRollsList[0]).catch((err) => {
        console.warn('Notice: Execute cut batch in Firestore pending/offline:', err?.message || err);
        if (err?.code === 'permission-denied' || err?.message?.includes('permission')) {
          setSyncStatus('permission-denied');
        }
      });
    } else if (updatedRollsList.length > 1) {
      executeMultiRollCutBatchInFirestore(createdRecords, updatedRollsList).catch((err) => {
        console.warn('Notice: Multi-roll batch cut in Firestore pending/offline:', err?.message || err);
        if (err?.code === 'permission-denied' || err?.message?.includes('permission')) {
          setSyncStatus('permission-denied');
        }
      });
    }

    const totalDeductedAll = round2(batchData.reduce((sum, r) => sum + r.totalDeducted, 0));
    if (batchData.length === 1) {
      const single = batchData[0];
      const cutDesc = single.cutType === 'non_so' 
        ? `รายการไม่ใช้ SO (${single.nonSoReason || 'สาขายืม/ซ่อม'})`
        : `รหัส SO ${single.soNumber}`;
      showToast(`ตัดสต๊อกสำเร็จ! ${cutDesc} (ใช้ ${formatMeters(single.usedMeters)} ม. + NG ${formatMeters(single.ngMeters)} ม. | คงเหลือ ${formatMeters(single.remainingAfter)} ม.) [Realtime Sync]`);
    } else {
      showToast(`ตัดสต๊อกสำเร็จ ${batchData.length} รายการใบงาน! ยอดตัดรวม ${formatMeters(totalDeductedAll)} ม. (อัปเดต ${updatedRollsList.length} ม้วน) [Realtime Sync]`);
    }
  };

  // Backward compatible single cut handler
  const handleConfirmCut = (cutData: Omit<StockCutRecord, 'id' | 'createdAt'>) => {
    handleConfirmCutBatch([cutData]);
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
            onViewRollHistory={(roll) => setDetailRoll(roll)}
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
        onClose={() => setDetailRoll(null)}
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
        onConfirmBatchCut={(batch) => {
          handleConfirmCutBatch(batch);
          setIsBatchImportOpen(false);
        }}
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
          setPreselectedRollId(null);
          setCutModalInitialMode(mode);
          setIsCutModalOpen(true);
        }}
        hasPermissionNotice={syncStatus === 'permission-denied'}
      />
    </div>
  );
}
