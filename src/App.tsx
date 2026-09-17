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
  revertCutRecordInFirestore, 
  uploadAllToFirestore,
  testFirestoreConnection,
  firebaseConfig
} from './lib/firebase';
import { Navbar } from './components/Navbar';
import { FirebaseSyncBar } from './components/FirebaseSyncBar';
import { DashboardOverview } from './components/DashboardOverview';
import { FoilRollTable } from './components/FoilRollTable';
import { CuttingHistoryTable } from './components/CuttingHistoryTable';
import { AddFoilModal } from './components/AddFoilModal';
import { CutStockModal } from './components/CutStockModal';
import { RollDetailModal } from './components/RollDetailModal';
import { formatMeters, round2 } from './utils/formatters';
import { CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';

export default function App() {
  const [rolls, setRolls] = useState<FoilRoll[]>([]);
  const [records, setRecords] = useState<StockCutRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'rolls' | 'history'>('dashboard');

  // Firebase Realtime Sync State
  const [syncStatus, setSyncStatus] = useState<'connected' | 'syncing' | 'error' | 'offline'>('syncing');
  const [lastSyncedTime, setLastSyncedTime] = useState<string | null>(null);
  const [isSavingToCloud, setIsSavingToCloud] = useState(false);
  const [isFetchingFromCloud, setIsFetchingFromCloud] = useState(false);
  
  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isCutModalOpen, setIsCutModalOpen] = useState(false);
  const [cutModalInitialMode, setCutModalInitialMode] = useState<'so' | 'non_so'>('so');
  const [preselectedRollId, setPreselectedRollId] = useState<string | null>(null);
  const [detailRoll, setDetailRoll] = useState<FoilRoll | null>(null);

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
      (err) => {
        console.warn('Foil rolls sync note:', err);
        setSyncStatus('offline');
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
      (err) => {
        console.warn('Stock cut records sync note:', err);
      }
    );

    return () => {
      unsubRolls();
      unsubRecords();
    };
  }, []);

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
    } catch (err) {
      console.error('Failed to upload to Firestore:', err);
      setSyncStatus('error');
      showToast('เกิดข้อผิดพลาดในการบันทึกข้อมูลขึ้น Firebase', 'info');
    } finally {
      setIsSavingToCloud(false);
    }
  };

  // Manual fetch / refresh from Firebase Firestore
  const handleManualFetchFromCloud = async () => {
    try {
      setIsFetchingFromCloud(true);
      setSyncStatus('syncing');
      await testFirestoreConnection();
      setSyncStatus('connected');
      setLastSyncedTime(new Date().toLocaleTimeString('th-TH'));
      showToast(`ดึงข้อมูลเรียลไทม์ล่าสุดจาก Firebase สำเร็จ (${rolls.length} ม้วน, ${records.length} รายการ)`);
    } catch (err) {
      console.error('Failed to fetch from Firestore:', err);
      setSyncStatus('error');
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
      console.error('Error saving new roll to Firestore:', err);
    });

    showToast(`เพิ่มฟอยล์รับเข้าสำเร็จ: ล็อต ${newRoll.lotNumber} #${newRoll.rollNumber} (${newRoll.totalMeters.toLocaleString()} ม.) [บันทึกลง Cloud]`);
  };

  // Cut stock handler (supports single or multi-order batch)
  const handleConfirmCutBatch = (batchData: Omit<StockCutRecord, 'id' | 'createdAt'>[]) => {
    if (!batchData || batchData.length === 0) return;

    const foilId = batchData[0].foilId;
    const targetRoll = rolls.find(r => r.id === foilId);
    const now = new Date().toISOString();

    const createdRecords: StockCutRecord[] = batchData.map((item, idx) => ({
      ...item,
      id: `cut-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: now,
    }));

    const totalDeductedAll = round2(batchData.reduce((sum, r) => sum + r.totalDeducted, 0));
    const totalUsedAll = round2(batchData.reduce((sum, r) => sum + r.usedMeters, 0));
    const totalNgAll = round2(batchData.reduce((sum, r) => sum + r.ngMeters, 0));

    // Update the corresponding foil roll
    let updatedTargetRoll: FoilRoll | null = null;
    const updatedRolls = rolls.map((r) => {
      if (r.id === foilId) {
        const newRemaining = Math.max(0, round2(r.remainingMeters - totalDeductedAll));
        const newUsed = round2(r.usedMeters + totalUsedAll);
        const newNg = round2(r.ngMeters + totalNgAll);
        const rollObj: FoilRoll = {
          ...r,
          remainingMeters: newRemaining,
          usedMeters: newUsed,
          ngMeters: newNg,
          status: newRemaining <= 0 ? ('depleted' as const) : ('active' as const),
        };
        updatedTargetRoll = rollObj;
        return rollObj;
      }
      return r;
    });

    const updatedRecords = [...records, ...createdRecords];
    updateRollsState(updatedRolls);
    updateRecordsState(updatedRecords);

    // Save batch to Firestore atomically
    if (updatedTargetRoll) {
      executeCutBatchInFirestore(createdRecords, updatedTargetRoll).catch((err) => {
        console.error('Error executing cut batch in Firestore:', err);
      });
    }

    if (batchData.length === 1) {
      const single = batchData[0];
      const cutDesc = single.cutType === 'non_so' 
        ? `รายการไม่ใช้ SO (${single.nonSoReason || 'สาขายืม/ซ่อม'})`
        : `รหัส SO ${single.soNumber}`;
      showToast(`ตัดสต๊อกสำเร็จ! ${cutDesc} (ใช้ ${formatMeters(single.usedMeters)} ม. + NG ${formatMeters(single.ngMeters)} ม. | คงเหลือ ${formatMeters(single.remainingAfter)} ม.) [Realtime Sync]`);
    } else {
      showToast(`ตัดสต๊อกสำเร็จ ${batchData.length} ใบงาน! ยอดตัดรวม ${formatMeters(totalDeductedAll)} ม. (ล็อต ${targetRoll?.lotNumber || ''} #${targetRoll?.rollNumber || ''} คงเหลือ ${formatMeters(batchData[batchData.length - 1].remainingAfter)} ม.) [Realtime Sync]`);
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
        console.error('Error updating zero-out in Firestore:', err);
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
        console.error('Error reverting cut in Firestore:', err);
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
      console.error('Error deleting roll in Firestore:', err);
    });

    showToast('ลบม้วนฟอยล์ออกจากรายการและ Cloud แล้ว', 'info');
  };

  // Reset to default sample
  const handleResetData = () => {
    if (confirm('คุณต้องการรีเซ็ตข้อมูลเป็นตัวอย่างเริ่มต้นของโรงงานหรือไม่? (ข้อมูลที่บันทึกไว้จะถูกรีเซ็ต)')) {
      const { rolls: initR, records: initC } = resetAllDataToDefault();
      setRolls(initR);
      setRecords(initC);
      showToast('รีเซ็ตข้อมูลตัวอย่างเรียบร้อย', 'info');
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
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
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
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2 font-mono">
          <div>
            ระบบตัดสต๊อกฟอยล์สำหรับหลังคา PU Foam เมทัลชีท • หน้ากว้าง 830 (5 ลอน 1 นิ้ว), 850 (3 ลอน 1 นิ้ว), 880 (5 ลอน 2 นิ้ว), 900 (3 ลอน 2 นิ้ว)
          </div>
          <div className="flex items-center gap-2">
            <span>รองรับคำสั่งซื้อรูปแบบ <strong className="text-amber-700">soxxyyzzz</strong> และตัดไม่ใช้ SO</span>
            <span className="text-slate-300">•</span>
            <span>คำนวณคงเหลืออัตโนมัติ</span>
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

      <RollDetailModal
        roll={detailRoll}
        records={records}
        onClose={() => setDetailRoll(null)}
        onOpenCutForThisRoll={handleOpenCutForRoll}
      />
    </div>
  );
}
