import React, { useState, useEffect, useMemo } from 'react';
import { useModalA11y } from '../hooks/useModalA11y';
import { FoilRoll, StockCutRecord, CutHistoryItem } from '../types';
import { reservedMetersOf } from '../utils/rollAggregates';
import { 
  X, 
  Layers, 
  Scissors, 
  Calendar, 
  User, 
  FileText, 
  Clock, 
  Download, 
  AlertCircle,
  Tag,
  ArrowRight,
  Printer,
  RefreshCw,
  ExternalLink,
  Edit2,
  Bug,
  CheckCircle2,
  AlertTriangle,
  Wrench,
  Sparkles,
  ShieldCheck,
  Info,
  ArrowLeft,
  RotateCcw
} from 'lucide-react';
import { formatMeters, isRollDepleted, getRollDepletionDate, formatThaiDate } from '../utils/formatters';
import { getRestorableZeroedMeters } from '../utils/rollZeroRestore';
import { isRecordSpecCompatibleWithRoll } from '../utils/rollIdentity';
import {
  detectTimelineAnomalies,
  MergedCutHistoryRow,
  mergeRollCutHistory,
} from '../utils/rollHistoryMerge';
import { cleanupStaleCutHistoryInFirestore, subscribeToRollCutHistory } from '../lib/firebase';
import { auditRollSOHistory } from '../utils/soHistoryAudit';
import { FoilStatusTube } from './FoilStatusTube';
import { RollIdentityBadges } from './RollIdentityBadges';

interface RollUsageHistoryModalProps {
  roll: FoilRoll | null;
  records: StockCutRecord[];
  onClose: () => void;
  onOpenCutForThisRoll: (rollId: string) => void;
  onEditRoll?: (roll: FoilRoll) => void;
  onEditCutRecord?: (record: StockCutRecord) => void;
  onFixRoll?: (rollId: string, correctRemaining: number, sumUsed?: number, sumNg?: number) => Promise<void>;
  onRealignChain?: (
    rollId: string,
    recordIds: string[]
  ) => Promise<{ updatedRecords?: StockCutRecord[] } | void>;
  onSeparateCrossSpec?: (rollId: string) => Promise<void> | void;
  onToggleZeroOut?: (rollId: string, zeroOut: boolean) => void;
  canEdit?: boolean;
  onOpenFullAudit?: (rollId?: string) => void;
}

export const RollUsageHistoryModal: React.FC<RollUsageHistoryModalProps> = ({
  roll,
  records,
  onClose,
  onOpenCutForThisRoll,
  onEditRoll,
  onEditCutRecord,
  onFixRoll,
  onRealignChain,
  onSeparateCrossSpec,
  onToggleZeroOut,
  canEdit = true,
  onOpenFullAudit,
}) => {
  const panelRef = useModalA11y(Boolean(roll), onClose, 'ประวัติการใช้งานม้วนฟอยล์');

  const [subItemsSnapshot, setSubItemsSnapshot] = useState<CutHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [indexWarning, setIndexWarning] = useState<string | null>(null);
  const [isFixingThisRoll, setIsFixingThisRoll] = useState(false);
  const [isSeparatingThisRoll, setIsSeparatingThisRoll] = useState(false);
  const [isCleaningStale, setIsCleaningStale] = useState(false);
  const [cleanupNotice, setCleanupNotice] = useState<string | null>(null);
  const [showConfirmFix, setShowConfirmFix] = useState(false);
  const [realignedOverrides, setRealignedOverrides] = useState<StockCutRecord[] | null>(null);

  const effectiveRootRecords = useMemo(() => {
    if (!realignedOverrides || realignedOverrides.length === 0) return records;
    const map = new Map(records.map((r) => [r.id, r]));
    realignedOverrides.forEach((r) => map.set(r.id, r));
    return Array.from(map.values());
  }, [records, realignedOverrides]);

  useEffect(() => {
    if (!roll?.id) {
      setSubItemsSnapshot([]);
      setRealignedOverrides(null);
      setCleanupNotice(null);
      return;
    }
    setSubItemsSnapshot([]);
    setRealignedOverrides(null);
    setCleanupNotice(null);
    setIsLoading(true);

    const unsubscribe = subscribeToRollCutHistory(
      roll.id,
      (subItems) => {
        setIsLoading(false);
        setSubItemsSnapshot(subItems || []);
      },
      (err: any) => {
        setIsLoading(false);
        if (err?.message && err.message.includes('https://console.firebase.google.com')) {
          setIndexWarning(err.message);
        }
      }
    );

    return () => {
      unsubscribe();
    };
  }, [roll?.id]);

  const mergeResult = useMemo(
    () => mergeRollCutHistory(roll, effectiveRootRecords, subItemsSnapshot),
    [roll, effectiveRootRecords, subItemsSnapshot]
  );

  const historyItems: MergedCutHistoryRow[] = mergeResult.items;

  const timelineAnomaly = useMemo(
    () => detectTimelineAnomalies(historyItems, roll),
    [historyItems, roll]
  );

  const staleIdsToClean = useMemo(
    () =>
      Array.from(
        new Set([
          ...mergeResult.staleSubItemIds,
          ...mergeResult.crossSpecSubItemIds,
          ...mergeResult.cancelledSubItemIds,
        ])
      ),
    [mergeResult]
  );

  const handleCleanupStaleSubcollection = async () => {
    if (!roll?.id || staleIdsToClean.length === 0) return;
    setIsCleaningStale(true);
    try {
      const { removedIds } = await cleanupStaleCutHistoryInFirestore(roll.id, staleIdsToClean);
      setCleanupNotice(
        removedIds.length > 0
          ? `ล้างประวัติเก่า/ข้ามม้วนที่ค้างบน Cloud ออกแล้ว ${removedIds.length} รายการ ✅`
          : 'ไม่พบประวัติค้างในฐานข้อมูลแล้ว'
      );
    } catch (err: any) {
      setCleanupNotice(`ล้างประวัติค้างไม่สำเร็จ: ${err?.message || err}`);
    } finally {
      setIsCleaningStale(false);
    }
  };

  // Run SO History Audit specifically for this roll
  const audit = useMemo(() => {
    if (!roll) return null;
    return auditRollSOHistory(roll, effectiveRootRecords);
  }, [roll, effectiveRootRecords]);

  // แยกรายการที่ตัดจริง vs รายการจองรอตัด
  const actualHistoryItems = historyItems.filter((r) => r.cutStatus !== 'reserved' && r.cutStatus !== 'cancelled');
  const reservedHistoryItems = historyItems.filter((r) => r.cutStatus === 'reserved');

  const totalUsed = actualHistoryItems.reduce((sum, r) => sum + Number(r.cutMeters ?? r.usedMeters ?? 0), 0);
  const totalNg = actualHistoryItems.reduce((sum, r) => sum + Number(r.ngMeters || 0), 0);
  // ยอดตัดออกจริง (เฉพาะบวก) ไม่รวมใบคืนสต๊อกจากนับสต๊อก
  const totalDeducted = actualHistoryItems.reduce((sum, r) => {
    const td = Number(r.totalDeducted ?? ((r.cutMeters ?? r.usedMeters ?? 0) + (r.ngMeters || 0)));
    return sum + (td > 0 ? td : 0);
  }, 0);
  const totalReserved = reservedMetersOf(reservedHistoryItems);
  // ยอดคืนสต๊อกจากนับสต๊อก (ค่าติดลบใน totalDeducted)
  const totalStockIn = historyItems.reduce((sum, r) => {
    const td = Number(r.totalDeducted ?? 0);
    return sum + (td < 0 ? Math.abs(td) : 0);
  }, 0);

  // ลำดับรอบของ SO เดียวกันบนม้วนนี้ → แสดงเป็น "รอบที่ 1", "รอบที่ 2"
  const soRoundLabelById = useMemo(() => {
    const bySo = new Map<string, CutHistoryItem[]>();
    historyItems.forEach((item) => {
      if (item.cutType === 'non_so') return;
      const key = (item.soNumber || '').trim().toUpperCase();
      if (!key) return;
      const list = bySo.get(key) || [];
      list.push(item);
      bySo.set(key, list);
    });
    const labels = new Map<string, string>();
    bySo.forEach((list) => {
      if (list.length < 2) return;
      // เรียงตามเวลาตัด แล้วติดป้ายรอบที่ 1, 2, ...
      const sorted = [...list].sort((a, b) => {
        const da = a.cutDate || a.usageDate || a.recordedDate || a.createdAt || '';
        const db = b.cutDate || b.usageDate || b.recordedDate || b.createdAt || '';
        return String(da).localeCompare(String(db));
      });
      sorted.forEach((item, i) => {
        const explicit = (item.productionRound || '').trim();
        labels.set(item.id, explicit || `รอบที่ ${i + 1}`);
      });
    });
    return labels;
  }, [historyItems]);
  
  // Accurately show remaining meters matching the roll inventory state
  const effectiveRemaining = roll?.isZeroedOut
    ? 0
    : Math.max(0, Number(roll?.remainingMeters ?? 0));

  const percentLeft = (roll?.totalMeters ?? 0) > 0 
    ? Math.max(0, Math.round((effectiveRemaining / roll!.totalMeters) * 100)) 
    : 0;

  const isDepleted = roll ? isRollDepleted(roll) : false;
  const depletionDate = roll ? getRollDepletionDate(roll, records) : null;

  // Handle single roll fix with consent
  const handleFixCurrentRoll = async () => {
    if (!roll || !audit || !onFixRoll) return;
    setIsFixingThisRoll(true);
    try {
      await onFixRoll(
        roll.id,
        audit.calculatedRemaining,
        audit.totalUsedMeters,
        audit.totalNgMeters
      );
      setShowConfirmFix(false);
    } finally {
      setIsFixingThisRoll(false);
    }
  };

  // Export single roll history to CSV
  const handleExportThisRoll = () => {
    if (!roll || historyItems.length === 0) return;

    const headers = [
      'ลำดับ',
      'รหัส SO / ใบงาน',
      'ประเภทการตัด',
      'เหตุผล (ถ้าไม่ระบุ SO)',
      'ล็อตฟอยล์',
      'เบอร์ม้วน',
      'หน้ากว้าง (มม.)',
      'ลายฟอยล์',
      'ตัดใช้งาน (ม.)',
      'NG เสีย (ม.)',
      'รวมตัดออก (ม.)',
      'ยอดคงเหลือก่อนตัด (ม.)',
      'ยอดคงเหลือหลังตัด (ม.)',
      'วันที่ใช้งาน/ตัด',
      'ผู้บันทึก',
      'หมายเหตุ'
    ];

    const rows = historyItems.map((item, idx) => [
      idx + 1,
      `"${item.soNumber || '-'}"`,
      `"${item.cutType === 'non_so' ? 'ไม่ระบุ SO' : 'มี SO'}"`,
      `"${item.nonSoReason || '-'}"`,
      `"${roll.lotNumber}"`,
      `"${roll.rollNumber}"`,
      roll.width,
      `"${roll.pattern}"`,
      item.cutMeters ?? item.usedMeters ?? 0,
      item.ngMeters || 0,
      item.totalDeducted || ((item.cutMeters ?? item.usedMeters ?? 0) + (item.ngMeters || 0)),
      item.remainingBefore ?? '-',
      item.remainingAfter ?? '-',
      `"${item.cutDate || item.usageDate || item.recordedDate || '-'}"`,
      `"${item.recordedBy || '-'}"`,
      `"${(item.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = '\uFEFF' + [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `ประวัติการตัด_${roll.width}mm_${roll.pattern}_ล็อต_${roll.lotNumber}_เบอร์_${roll.rollNumber}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!roll) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs">
      <div
        ref={panelRef}
        tabIndex={-1} 
        id="modal-roll-usage-history"
        className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92dvh] animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 bg-slate-900 text-white flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-medium text-xs transition-colors cursor-pointer shrink-0"
              title="ย้อนกลับ / ปิด"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>ย้อนกลับ</span>
            </button>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold shadow-xs shrink-0">
              <Layers className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] sm:text-xs px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-bold shrink-0">
                  ประวัติการใช้งานฟอยล์รายลูก
                </span>
                <RollIdentityBadges
                  variant="header"
                  width={roll.width}
                  pattern={roll.pattern}
                  lotNumber={roll.lotNumber}
                  rollNumber={roll.rollNumber}
                />
              </div>
              <h2 className="text-sm sm:text-lg font-bold text-white leading-tight mt-1 truncate">
                ประวัติใบสั่งซื้อ / ใบงานที่ใช้ตัดม้วนนี้
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            title="ปิดหน้าต่าง"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4">
          
          {/* Roll Profile Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              
              {/* Basic Roll Specs */}
              <div className="space-y-2">
                <RollIdentityBadges
                  variant="card"
                  width={roll.width}
                  pattern={roll.pattern}
                  lotNumber={roll.lotNumber}
                  rollNumber={roll.rollNumber}
                  showWidthDesc={true}
                />
                <div className="flex flex-wrap items-center gap-2">
                  {roll.isReverseSideOnly && (
                    <span className="px-2.5 py-1 bg-amber-500 text-slate-950 border border-amber-600 text-xs rounded-lg font-bold inline-flex items-center gap-1 shadow-2xs">
                      <span>ใช้ได้เฉพาะอีกด้าน (หน้าหลักเสีย)</span>
                    </span>
                  )}
                  {isDepleted ? (
                    <span className="px-2.5 py-1 bg-slate-800 text-amber-300 border border-slate-700 text-xs rounded-lg font-bold inline-flex items-center gap-1.5 shadow-2xs">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{roll.isZeroedOut ? 'ตัดสล็อตเป็น 0 แล้ว' : 'ตัดหมดสต๊อกแล้ว'}</span>
                      {depletionDate && (
                        <span className="text-white font-mono font-semibold">
                          · หมดเมื่อ: {formatThaiDate(depletionDate)}
                        </span>
                      )}
                    </span>
                  ) : effectiveRemaining <= 50 ? (
                    <span className="px-2 py-0.5 bg-rose-100 text-rose-700 border border-rose-300 text-xs rounded-md font-bold animate-pulse">
                      เหลือ &le; 50 ม. (ใกล้หมด สีแดง)
                    </span>
                  ) : effectiveRemaining <= 200 ? (
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-800 border border-amber-300 text-xs rounded-md font-bold">
                      เหลือ &le; 200 ม. (เหลือน้อย สีเหลือง)
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs rounded-md font-semibold">
                      พร้อมใช้งาน
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 font-mono">
                  วันที่รับเข้า: {roll.dateReceived} | บันทึกครั้งแรก: {roll.createdAt ? new Date(roll.createdAt).toLocaleDateString('th-TH') : '-'}
                  {depletionDate && (
                    <span className="text-rose-700 font-bold block sm:inline sm:ml-2">
                      | วันที่ม้วนหมด: {formatThaiDate(depletionDate)} ({depletionDate})
                    </span>
                  )}
                  {roll.notes && <span className="text-slate-600 block sm:inline sm:ml-2">หมายเหตุ: {roll.notes}</span>}
                </p>
                {roll.isReverseSideOnly && (
                  <div className="mt-2 p-2.5 bg-amber-100/90 border border-amber-300 rounded-lg text-amber-950 text-xs flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <div>
                      <strong className="font-bold">ฟอยล์เก่า / มีปัญหา:</strong> หน้าหลักใช้ไม่ได้แล้ว ใช้ได้เฉพาะอีกด้านเท่านั้น (เช่น ด้านเงิน)
                      {roll.reverseSideReason && (
                        <div className="text-amber-800 font-medium mt-0.5">
                          สภาพ: {roll.reverseSideReason}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 self-start lg:self-center shrink-0">
                {onEditRoll && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onEditRoll(roll);
                    }}
                    className="px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50/80 hover:bg-blue-100 text-blue-800 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="แก้ไขข้อมูลล็อต, เบอร์, หรือยอดคงเหลือของม้วนนี้"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-blue-600" />
                    <span>แก้ไขม้วนนี้</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleExportThisRoll}
                  disabled={historyItems.length === 0}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                  title="ดาวน์โหลดรายการตัดของม้วนนี้เป็น CSV"
                >
                  <Download className="w-3.5 h-3.5 text-slate-500" />
                  <span>ส่งออก CSV ลูกนี้</span>
                </button>

                {roll.isZeroedOut && onToggleZeroOut && (
                  <button
                    type="button"
                    onClick={() => onToggleZeroOut(roll.id, false)}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                    title="คืนค่าฟอยล์จากตัดสต๊อกเป็น 0 กลับมาใช้งานต่อ (กรณี กดผิด)"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>คืนค่าฟอยล์ ({formatMeters(getRestorableZeroedMeters(roll, records))} ม.)</span>
                  </button>
                )}

                {effectiveRemaining > 0 && !roll.isZeroedOut && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenCutForThisRoll(roll.id);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                  >
                    <Scissors className="w-3.5 h-3.5" />
                    <span>ตัดสต๊อกม้วนนี้เพิ่ม</span>
                  </button>
                )}
              </div>
            </div>

            {/* Meters Summary 4-Col Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-200 text-center">
              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <span className="text-[11px] text-slate-500 block">จำนวนลูกเต็ม</span>
                <span className="font-mono font-bold text-slate-900 text-base">
                  {formatMeters(roll.totalMeters)} <span className="text-xs font-normal text-slate-400">ม.</span>
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <span className="text-[11px] text-slate-500 block">ลงแผ่นจริงสะสม</span>
                <span className="font-mono font-bold text-blue-700 text-base">
                  {formatMeters(totalUsed)} <span className="text-xs font-normal text-slate-400">ม.</span>
                </span>
                {totalReserved > 0 && (
                  <span className="text-[10px] text-amber-700 font-semibold block">
                    (จอง {formatMeters(totalReserved)} ม.)
                  </span>
                )}
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <span className="text-[11px] text-slate-500 block">NG เสียสะสม</span>
                <span className="font-mono font-bold text-rose-600 text-base">
                  {formatMeters(totalNg)} <span className="text-xs font-normal text-slate-400">ม.</span>
                </span>
              </div>
              <div className={`p-2.5 rounded-lg border ${
                effectiveRemaining <= 50 
                  ? 'bg-rose-50 border-rose-200 text-rose-900' 
                  : effectiveRemaining <= 200 
                    ? 'bg-amber-50 border-amber-200 text-amber-900' 
                    : 'bg-emerald-50 border-emerald-200 text-emerald-900'
              }`}>
                <span className="text-[11px] text-slate-500 block">คงเหลือปัจจุบัน</span>
                <span className="font-mono font-bold text-base">
                  {formatMeters(effectiveRemaining)} <span className="text-xs font-normal text-slate-400">ม.</span>
                </span>
                {totalReserved > 0 && (
                  <span className="text-[10px] text-emerald-800 font-semibold block">
                    ผลิตแล้วจะเหลือ {formatMeters(Math.max(0, effectiveRemaining - totalReserved))} ม.
                  </span>
                )}
              </div>
            </div>

            {/* หลอดไทม์ไลน์สถานะ 3 สี: เขียว (เหลือว่าง) / เหลือง (จองรอตัด) / เทา (ตัดใช้แล้ว) */}
            <div className="mt-3.5 pt-3 border-t border-slate-200">
              <FoilStatusTube
                roll={roll}
                records={records}
                size="md"
                showStats={false}
                showLabels={true}
              />
            </div>
          </div>

          {/* SO History Audit & Diagnostics Banner (Visible only to editors/staff, hidden from visitors) */}
          {canEdit && audit && (
            <div className={`rounded-xl border p-3.5 space-y-2.5 ${
              audit.issues.some((i) => i.severity === 'error')
                ? 'bg-rose-50/70 border-rose-300 text-rose-950'
                : audit.issues.some((i) => i.severity === 'warning')
                  ? 'bg-amber-50/70 border-amber-300 text-amber-950'
                  : 'bg-emerald-50/70 border-emerald-300 text-emerald-950'
            }`}>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Bug className={`w-4 h-4 ${
                    audit.hasErrors ? 'text-rose-600' : audit.hasWarnings ? 'text-amber-600' : 'text-emerald-600'
                  }`} />
                  <span className="font-bold text-xs">
                    ผลการตรวจสอบประวัติ SO ของม้วนนี้:
                  </span>
                  {audit.issues.length === 0 ? (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-semibold">
                      สมบูรณ์ ไม่พบบัค ✅
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[11px] font-bold">
                      พบข้อสังเกต {audit.issues.length} รายการ
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {onOpenFullAudit && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenFullAudit(roll.id);
                      }}
                      className="text-xs font-semibold text-slate-700 hover:text-amber-800 underline flex items-center gap-1 cursor-pointer"
                    >
                      <span>ดูไทม์ไลน์วิเคราะห์บัคเต็ม</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Issues List */}
              {audit.issues.length > 0 && (
                <div className="space-y-1.5 pt-1 text-xs">
                  {audit.issues.map((iss) => (
                    <div 
                      key={iss.id} 
                      className={`p-2 rounded-lg border flex items-start gap-2 ${
                        iss.type === 'RESERVED_SO_QUEUE'
                          ? 'bg-amber-50/90 border-amber-300 text-amber-950'
                          : iss.severity === 'error'
                            ? 'bg-rose-50/90 border-rose-200 text-rose-950'
                            : iss.severity === 'warning'
                              ? 'bg-amber-50/80 border-amber-200 text-amber-950'
                              : 'bg-white/80 border-slate-200/80 text-slate-900'
                      }`}
                    >
                      <AlertCircle className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${
                        iss.type === 'RESERVED_SO_QUEUE'
                          ? 'text-amber-600'
                          : iss.severity === 'error'
                            ? 'text-rose-600'
                            : 'text-amber-600'
                      }`} />
                      <div className="flex-1 leading-snug">
                        <span className="font-bold block">{iss.title}</span>
                        <span className="text-[11px] opacity-80">{iss.description}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Cross-spec contamination recovery trigger */}
              {canEdit && onSeparateCrossSpec && (audit.contaminatedRecords?.length ?? 0) > 0 && (
                <div className="pt-2 border-t border-rose-200/80 flex items-center justify-between flex-wrap gap-2">
                  <div className="text-xs text-rose-800 font-semibold">
                    🔒 พบใบตัดต่างหน้ากว้าง/ลายปนอยู่ในม้วนนี้ ({audit.contaminatedRecords!.length} รายการ) — กันออกจากการคำนวณแล้ว
                  </div>
                  <button
                    type="button"
                    disabled={isSeparatingThisRoll}
                    onClick={async () => {
                      if (!onSeparateCrossSpec || !roll) return;
                      setIsSeparatingThisRoll(true);
                      try {
                        await onSeparateCrossSpec(roll.id);
                      } finally {
                        setIsSeparatingThisRoll(false);
                      }
                    }}
                    className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-50"
                  >
                    {isSeparatingThisRoll ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Wrench className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {isSeparatingThisRoll
                        ? 'กำลังแยกใบตัดกลับม้วนที่ถูกต้อง...'
                        : 'แยกใบตัดข้ามหน้ากว้าง/ลายกลับม้วนที่ถูกต้อง'}
                    </span>
                  </button>
                </div>
              )}

              {/* Accept button if chain jump detected */}
              {canEdit && onRealignChain && audit.timeline.some((step) => !step.isChainValid) && (
                <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between flex-wrap gap-2">
                  <div className="text-xs text-rose-800 font-medium">
                    ⚠️ ตรวจพบยอดคงเหลือก่อนตัด-หลังตัดกระโดด ไม่ต่อเนื่องกัน ({audit.timeline.filter(t => !t.isChainValid).length} จุด)
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!onRealignChain || !roll || !audit) return;
                      setIsFixingThisRoll(true);
                      try {
                        const result = await onRealignChain(
                          roll.id,
                          audit.timeline.map((s) => s.record.id)
                        );
                        // ใช้ updatedRecords จาก realign ทันที (ไม่รอ React re-render / snapshot)
                        if (result && typeof result === 'object' && result.updatedRecords && result.updatedRecords.length > 0) {
                          setRealignedOverrides(result.updatedRecords);
                        }
                      } finally {
                        setIsFixingThisRoll(false);
                      }
                    }}
                    disabled={isFixingThisRoll}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-50"
                  >
                    {isFixingThisRoll ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    )}
                    <span>⚡ Accept ปรับยอดความต่อเนื่อง SO</span>
                  </button>
                </div>
              )}

              {/* Auto Fix / Consent Trigger if roll can be adjusted */}
              {canEdit && audit.canAutoAdjust && (
                <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between flex-wrap gap-2">
                  <div className="text-xs text-slate-700">
                    คำนวณจากยอดตัด SO จริง ควรเหลือ: <strong className="text-emerald-700 font-mono">{formatMeters(audit.calculatedRemaining)} ม.</strong> (ต่างจากปัจจุบัน {audit.diff > 0 ? `+${formatMeters(audit.diff)}` : formatMeters(audit.diff)} ม.)
                  </div>

                  {!showConfirmFix ? (
                    <button
                      type="button"
                      onClick={() => setShowConfirmFix(true)}
                      className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <Wrench className="w-3.5 h-3.5" />
                      <span>ปรับยอดม้วนนี้ให้ตรงกับ SO ({formatMeters(audit.calculatedRemaining)} ม.)</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-amber-300">
                      <span className="text-xs font-bold text-slate-800">
                        ยืนยันปรับยอดเป็น {formatMeters(audit.calculatedRemaining)} ม.?
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowConfirmFix(false)}
                        className="px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 rounded"
                      >
                        ยกเลิก
                      </button>
                      <button
                        type="button"
                        onClick={handleFixCurrentRoll}
                        disabled={isFixingThisRoll}
                        className="px-3 py-1 bg-slate-900 text-white rounded text-xs font-bold hover:bg-slate-800 flex items-center gap-1 cursor-pointer"
                      >
                        {isFixingThisRoll ? (
                          <RefreshCw className="w-3 h-3 animate-spin" />
                        ) : (
                          <Sparkles className="w-3 h-3 text-amber-400" />
                        )}
                        <span>ยืนยัน</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {audit.isZeroedOut && (
                <div className="pt-1 text-xs text-slate-600 flex items-center gap-1.5 font-medium">
                  <Info className="w-3.5 h-3.5 text-slate-500" />
                  <span>ม้วนนี้ถูกกดตัดเป็น 0 แล้ว (isZeroedOut) — ระบบยกเว้นการปรับยอดอัตโนมัติ เพื่อคงค่าเดิมตามที่ผู้ใช้งานระบุ</span>
                </div>
              )}
            </div>
          )}

          {/* Timeline Integrity & Stale Cache Guard Banner */}
          {(mergeResult.rejectedSubCount > 0 || timelineAnomaly.hasMixedOrCorruptTimeline || cleanupNotice) && (
            <div
              className={`p-3.5 rounded-xl border text-xs space-y-2 ${
                timelineAnomaly.hasMixedOrCorruptTimeline
                  ? 'bg-rose-50 border-rose-300 text-rose-950'
                  : 'bg-sky-50 border-sky-200 text-sky-950'
              }`}
            >
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="flex items-start gap-2">
                  <ShieldCheck
                    className={`w-4 h-4 shrink-0 mt-0.5 ${
                      timelineAnomaly.hasMixedOrCorruptTimeline ? 'text-rose-600' : 'text-sky-600'
                    }`}
                  />
                  <div className="space-y-1">
                    <div className="font-bold">
                      {timelineAnomaly.hasMixedOrCorruptTimeline
                        ? '⚠️ ตรวจพบความผิดปกติของโซ่ประวัติในม้วนนี้ (แยกแสดงป้าย หน้ากว้าง · ลาย · ล็อต · เบอร์ ทุกแถวแล้ว)'
                        : '🛡️ กรองแยกรายการประวัติค้าง/ต่างม้วนออกให้แล้ว'}
                    </div>
                    {mergeResult.rejectedSubCount > 0 && (
                      <p className="text-[11px] opacity-90">
                        ซ่อนรายการค้างเก่าใน sub-collection ที่ไม่ได้เป็นของม้วนนี้แล้ว ({mergeResult.rejectedSubCount} รายการ
                        {mergeResult.crossSpecSubItemIds.length > 0 ? ` · ต่างหน้ากว้าง/ลาย ${mergeResult.crossSpecSubItemIds.length}` : ''}
                        {mergeResult.staleSubItemIds.length > 0 ? ` · ย้าย/ต่างม้วน ${mergeResult.staleSubItemIds.length}` : ''}
                        {mergeResult.cancelledSubItemIds.length > 0 ? ` · ยกเลิกแล้ว ${mergeResult.cancelledSubItemIds.length}` : ''})
                      </p>
                    )}
                    {timelineAnomaly.summaryMessages.map((msg, i) => (
                      <p key={i} className="text-[11px] opacity-90 leading-snug">
                        • {msg}
                      </p>
                    ))}
                    {cleanupNotice && (
                      <p className="text-[11px] font-bold text-emerald-800">{cleanupNotice}</p>
                    )}
                  </div>
                </div>

                {canEdit && mergeResult.rejectedSubCount > 0 && (
                  <button
                    type="button"
                    disabled={isCleaningStale}
                    onClick={handleCleanupStaleSubcollection}
                    className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] inline-flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-50 shrink-0"
                  >
                    {isCleaningStale ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Wrench className="w-3.5 h-3.5 text-amber-400" />
                    )}
                    <span>ล้างประวัติเก่าที่ปน/ค้างบน Cloud ({mergeResult.rejectedSubCount})</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Index Creation Notice if orderBy failed */}
          {indexWarning && (
            <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1 overflow-hidden">
                <p className="font-semibold text-amber-950">
                  กำลังแสดงผลแบบเรียงลำดับในเครื่อง (In-Memory Sort Fallback)
                </p>
                <p className="text-slate-600 text-[11px]">
                  หากต้องการให้ Firestore เรียงลำดับจากเซิร์ฟเวอร์โดยตรง สามารถกดดูลิงก์สร้าง Index ที่แจ้งไว้ใน Browser Console ได้ครับ
                </p>
              </div>
            </div>
          )}

          {/* Cuts History Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-600" />
                <span>รายการใบงาน/SO ที่ตัดจากลูกนี้ทั้งหมด ({historyItems.length} รายการ)</span>
                {isLoading && (
                  <RefreshCw className="w-3.5 h-3.5 text-amber-500 animate-spin" />
                )}
              </h3>
              <span className="text-xs text-slate-500 font-mono">
                ตัดรวมทั้งหมด: {formatMeters(totalDeducted)} เมตร
              </span>
            </div>

            {/* แสดงสถานะและวันที่หมดในประวัติไทม์ไลน์ */}
            {isDepleted && (
              <div className="p-3.5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-slate-700 rounded-xl text-white flex items-center justify-between flex-wrap gap-2.5 shadow-xs animate-in fade-in">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-4 h-4 text-rose-400" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-2">
                      <span>ประวัติไทม์ไลน์: ม้วนฟอยล์หมดสต๊อกแล้ว (เหลือ 0.00 ม.)</span>
                      {roll.isZeroedOut && (
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-900/80 text-rose-200 border border-rose-700">
                          ตัดสล็อตเป็น 0
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-amber-300 font-mono mt-0.5 flex items-center gap-1.5 font-bold">
                      <Calendar className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>วันที่หมดสต๊อก: <span className="text-white underline decoration-amber-400 decoration-2">{formatThaiDate(depletionDate)}</span></span>
                      <span className="text-slate-400 text-[11px] font-normal">({depletionDate || '-'})</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="text-right text-xs text-slate-300 font-mono">
                    ตัดใช้รวม {formatMeters(totalUsed)} ม. · NG {formatMeters(totalNg)} ม.
                  </div>
                  {roll.isZeroedOut && onToggleZeroOut && (
                    <button
                      type="button"
                      onClick={() => onToggleZeroOut(roll.id, false)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                      title="คืนค่าฟอยล์จากตัดสต๊อกเป็น 0 กลับมาใช้งานต่อ (กรณี กดผิด)"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>คืนค่า ({formatMeters(getRestorableZeroedMeters(roll, records))} ม.)</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {historyItems.length === 0 ? (
              <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-8 text-center">
                <Scissors className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700">ยังไม่มีประวัติการตัดฟอยล์จากลูกนี้</p>
                <p className="text-xs text-slate-400 mt-1">
                  เมื่อมีการกดตัดสต๊อกและระบุใบสั่งผลิต SO ระบบจะบันทึกประวัติไว้ที่นี่
                </p>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 text-[11px]">
                        <th className="py-2.5 px-3">ลำดับ</th>
                        <th className="py-2.5 px-3 sticky left-0 z-20 bg-slate-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">รหัส SO / ใบงาน (ตรึงซ้าย)</th>
                        <th className="py-2.5 px-3">ป้ายกำกับ (กว้าง · ลาย · ล็อต · เบอร์)</th>
                        <th className="py-2.5 px-3 text-right">ตัดลงแผ่น</th>
                        <th className="py-2.5 px-3 text-right">NG</th>
                        <th className="py-2.5 px-3 text-right">รวมตัดออก</th>
                        <th className="py-2.5 px-3 text-right">คงเหลือก่อน &rarr; หลัง</th>
                        <th className="py-2.5 px-3">วันที่ใช้งาน</th>
                        <th className="py-2.5 px-3">ผู้บันทึก</th>
                        <th className="py-2.5 px-3">หมายเหตุ</th>
                        {onEditCutRecord && <th className="py-2.5 px-3 text-center">จัดการ</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {historyItems.map((item, idx) => {
                        const targetRecord = effectiveRootRecords.find((r) => r.id === item.id) || {
                          id: item.id,
                          foilId: roll.id,
                          lotNumber: item.rawLotNumber || roll.lotNumber,
                          rollNumber: item.rawRollNumber || roll.rollNumber,
                          width: item.rawWidth ?? roll.width,
                          pattern: item.rawPattern || roll.pattern,
                          soNumber: item.soNumber,
                          cutType: item.cutType,
                          nonSoReason: item.nonSoReason,
                          productionRound: item.productionRound,
                          roundNumber: item.roundNumber,
                          usedMeters: item.cutMeters ?? item.usedMeters ?? 0,
                          ngMeters: item.ngMeters ?? 0,
                          totalDeducted: item.totalDeducted ?? ((item.cutMeters ?? item.usedMeters ?? 0) + (item.ngMeters || 0)),
                          remainingBefore: item.remainingBefore,
                          remainingAfter: item.remainingAfter ?? 0,
                          usageDate: item.cutDate || item.usageDate || item.recordedDate || '',
                          recordedDate: item.recordedDate || '',
                          recordedBy: item.recordedBy || '',
                          notes: item.notes || '',
                          createdAt: item.createdAt || '',
                          isSilverSide: item.isSilverSide,
                          isWhiteSide: item.isWhiteSide,
                        };

                        return (
                        <tr 
                          key={item.id} 
                          className={`transition-colors ${
                            item.cutStatus === 'reserved'
                              ? 'bg-amber-50/70 hover:bg-amber-100/60 border-l-4 border-l-amber-400'
                              : item.hasNegativeBalance || item.hasLotRollConflict
                                ? 'bg-rose-50/60 hover:bg-rose-100/50 border-l-4 border-l-rose-500'
                                : 'hover:bg-slate-50/80'
                          }`}
                        >
                          <td className="py-2.5 px-3 font-mono text-slate-400 text-[11px]">
                            {idx + 1}
                          </td>
                          <td className={`py-2.5 px-3 font-mono font-bold text-slate-900 sticky left-0 z-10 ${
                            item.cutStatus === 'reserved'
                              ? 'bg-amber-50/90'
                              : item.hasNegativeBalance || item.hasLotRollConflict
                                ? 'bg-rose-50/95'
                                : 'bg-white group-hover:bg-slate-50'
                          } shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]`}>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span>{item.soNumber || '-'}</span>
                              {item.cutStatus === 'reserved' && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-100 text-amber-950 border border-amber-300 rounded-md text-[10px] font-bold">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                  <span>รอตัด</span>
                                </span>
                              )}
                              {item.cutStatus === 'cancelled' && (
                                <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 border border-slate-300 rounded-md text-[10px] font-bold">
                                  ยกเลิก
                                </span>
                              )}
                              {item.isSilverSide && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-gradient-to-r from-slate-200 via-zinc-100 to-slate-200 text-slate-900 rounded-md text-[10px] font-black border border-slate-400 shadow-2xs">
                                  <span className="w-2 h-2 rounded-full bg-gradient-to-br from-slate-400 via-white to-slate-600 ring-1 ring-slate-500 shrink-0" />
                                  <span>ท้องเงิน</span>
                                </span>
                              )}
                              {item.isWhiteSide && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-gradient-to-r from-white via-slate-50 to-slate-100 text-slate-900 rounded-md text-[10px] font-black border border-slate-400 shadow-2xs">
                                  <span className="w-2 h-2 rounded-full bg-white ring-1 ring-slate-400 shrink-0" />
                                  <span>ท้องขาว</span>
                                </span>
                              )}
                              {item.cutType === 'non_so' && (
                                <span className="px-1.5 py-0.2 bg-slate-200 text-slate-700 rounded text-[10px] font-normal">
                                  ไม่มี SO
                                </span>
                              )}
                              {soRoundLabelById.get(item.id) && (
                                <span
                                  className="px-1.5 py-0.5 bg-sky-50 text-sky-700 border border-sky-200 rounded text-[10px] font-semibold"
                                  title="แบ่งรอบการผลิตของ SO นี้"
                                >
                                  {soRoundLabelById.get(item.id)}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <RollIdentityBadges
                              variant="row"
                              width={item.rawWidth ?? item.width}
                              pattern={item.rawPattern ?? item.pattern}
                              lotNumber={item.rawLotNumber ?? item.lotNumber}
                              rollNumber={item.rawRollNumber ?? item.rollNumber}
                              isSpecVerified={item.isSpecVerified}
                              hasLotRollConflict={item.hasLotRollConflict}
                            />
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800">
                            {formatMeters(item.cutMeters ?? item.usedMeters ?? 0)} ม.
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-rose-600">
                            {(item.ngMeters || 0) > 0 ? `${formatMeters(item.ngMeters)} ม.` : '-'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold">
                            {(() => {
                              const raw = Number(
                                item.totalDeducted ??
                                  ((item.cutMeters ?? item.usedMeters ?? 0) + (item.ngMeters || 0))
                              );
                              if (item.cutStatus === 'reserved') {
                                return (
                                  <span className="text-amber-800 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                    จอง {formatMeters(raw)} ม.
                                  </span>
                                );
                              }
                              if (item.cutStatus === 'cancelled') {
                                return (
                                  <span className="text-slate-400 line-through">
                                    {formatMeters(raw)} ม.
                                  </span>
                                );
                              }
                              // ติดลบ = คืนสต๊อก (นับสต๊อก) แสดงเป็น + สีเขียว
                              if (raw < 0) {
                                return (
                                  <span className="text-emerald-700">
                                    +{formatMeters(Math.abs(raw))} ม.
                                  </span>
                                );
                              }
                              return (
                                <span className="text-amber-900">
                                  -{formatMeters(raw)} ม.
                                </span>
                              );
                            })()}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-[11px] whitespace-nowrap">
                            {item.cutStatus === 'reserved' ? (
                              <div className="text-right">
                                <span className="text-slate-700 font-bold">{formatMeters(roll.remainingMeters)} ม.</span>
                                <div className="text-[10px] text-amber-800 font-sans font-medium">
                                  (ตัดแล้วจะเหลือ {formatMeters(Math.max(0, Number(roll.remainingMeters || 0) - (Number(item.totalDeducted) || (Number(item.cutMeters ?? item.usedMeters ?? 0) + Number(item.ngMeters || 0)))))} ม.)
                                </div>
                              </div>
                            ) : (
                              <>
                                <span className={Number(item.remainingBefore) < -0.01 ? 'text-rose-700 font-bold' : 'text-slate-400'}>
                                  {formatMeters(item.remainingBefore ?? 0)}
                                </span>
                                <span className="text-slate-300 mx-1">&rarr;</span>
                                <span className={`font-bold ${Number(item.remainingAfter) < -0.01 ? 'text-rose-700' : 'text-emerald-700'}`}>
                                  {formatMeters(item.remainingAfter ?? 0)} ม.
                                </span>
                                {item.hasNegativeBalance ? (
                                  <div className="text-[10px] text-rose-700 font-bold font-sans mt-0.5 flex items-center justify-end gap-1">
                                    <span>⚠️ ยอดติดลบ (ปนสายม้วนอื่น)</span>
                                  </div>
                                ) : Number(item.remainingAfter) <= 0 ? (
                                  <div className="text-[10px] text-rose-700 font-bold font-sans mt-0.5 flex items-center justify-end gap-1">
                                    <span>🏁 หมดม้วน</span>
                                    <span className="font-mono text-slate-500 font-normal">
                                      ({formatThaiDate(item.cutDate || item.usageDate || item.recordedDate)})
                                    </span>
                                  </div>
                                ) : null}
                              </>
                            )}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap text-[11px]">
                            <div className="flex items-center gap-1 font-mono font-bold text-slate-800">
                              <Calendar className="w-3 h-3 text-amber-600 shrink-0" />
                              <span>{formatThaiDate(item.cutDate || item.usageDate || item.recordedDate) || '-'}</span>
                            </div>
                            {(item.cutDate || item.usageDate || item.recordedDate) && (
                              <div className="text-[10px] text-slate-400 font-mono pl-4">
                                {item.cutDate || item.usageDate || item.recordedDate}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 max-w-[120px] truncate text-[11px]">
                            {item.recordedBy || '-'}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 max-w-[150px] truncate text-[11px]">
                            {item.notes || (item.nonSoReason ? `เหตุผล: ${item.nonSoReason}` : '-')}
                          </td>
                          {onEditCutRecord && (
                            <td className="py-2.5 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => {
                                  onClose();
                                  onEditCutRecord(targetRecord);
                                }}
                                title="แก้ไขรายการตัด SO นี้"
                                className="p-1 rounded text-slate-400 hover:text-amber-700 hover:bg-amber-50 transition-colors cursor-pointer"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          )}
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>ซิงค์ข้อมูลกับคลาวด์กลางอัตโนมัติ</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold transition-colors cursor-pointer"
            >
              ปิดหน้าต่าง
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
