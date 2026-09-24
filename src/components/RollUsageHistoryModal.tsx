import React, { useState, useEffect, useMemo } from 'react';
import { FoilRoll, StockCutRecord, CutHistoryItem } from '../types';
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
  Info
} from 'lucide-react';
import { formatMeters } from '../utils/formatters';
import { subscribeToRollCutHistory } from '../lib/firebase';
import { auditRollSOHistory } from '../utils/soHistoryAudit';

interface RollUsageHistoryModalProps {
  roll: FoilRoll | null;
  records: StockCutRecord[];
  onClose: () => void;
  onOpenCutForThisRoll: (rollId: string) => void;
  onEditRoll?: (roll: FoilRoll) => void;
  onFixRoll?: (rollId: string, correctRemaining: number, sumUsed?: number, sumNg?: number) => Promise<void>;
  canEdit?: boolean;
  onOpenFullAudit?: (rollId?: string) => void;
}

export const RollUsageHistoryModal: React.FC<RollUsageHistoryModalProps> = ({
  roll,
  records,
  onClose,
  onOpenCutForThisRoll,
  onEditRoll,
  onFixRoll,
  canEdit = true,
  onOpenFullAudit,
}) => {
  // Initialize with in-memory or embedded data first for instant render
  const [historyItems, setHistoryItems] = useState<CutHistoryItem[]>(() => {
    if (!roll) return [];
    const rollCuts = records.filter((r) => r.foilId === roll.id);
    if (rollCuts.length > 0) {
      return rollCuts.map((r) => ({
        id: r.id,
        soNumber: r.soNumber,
        cutMeters: r.usedMeters,
        usedMeters: r.usedMeters,
        ngMeters: r.ngMeters,
        totalDeducted: r.totalDeducted,
        remainingBefore: r.remainingBefore ?? 0,
        remainingAfter: r.remainingAfter,
        cutDate: r.usageDate || r.recordedDate,
        usageDate: r.usageDate,
        recordedDate: r.recordedDate,
        recordedBy: r.recordedBy,
        notes: r.notes,
        createdAt: r.createdAt || r.recordedDate,
        cutType: r.cutType || 'so',
        nonSoReason: r.nonSoReason,
        rollId: roll.id,
        lotNumber: roll.lotNumber,
        rollNumber: roll.rollNumber,
      }));
    }
    return [];
  });

  const [isLoading, setIsLoading] = useState(false);
  const [indexWarning, setIndexWarning] = useState<string | null>(null);
  const [isFixingThisRoll, setIsFixingThisRoll] = useState(false);
  const [showConfirmFix, setShowConfirmFix] = useState(false);

  // Realtime subscription to Firestore sub-collection: foil_rolls/{rollId}/cut_history
  // Merging both the root collection records and the subcollection items so no SO is ever lost!
  useEffect(() => {
    if (!roll?.id) return;
    setIsLoading(true);

    const unsubscribe = subscribeToRollCutHistory(
      roll.id,
      (subItems) => {
        setIsLoading(false);
        
        // Merge records: Map by ID to prevent duplicates
        const map = new Map<string, CutHistoryItem>();

        // 1. Root records
        const rootItems = records
          .filter((r) => r.foilId === roll.id)
          .map((r) => ({
            id: r.id,
            soNumber: r.soNumber,
            cutMeters: r.usedMeters,
            usedMeters: r.usedMeters,
            ngMeters: r.ngMeters,
            totalDeducted: r.totalDeducted,
            remainingBefore: r.remainingBefore ?? 0,
            remainingAfter: r.remainingAfter,
            cutDate: r.usageDate || r.recordedDate,
            usageDate: r.usageDate,
            recordedDate: r.recordedDate,
            recordedBy: r.recordedBy,
            notes: r.notes,
            createdAt: r.createdAt || r.recordedDate,
            cutType: r.cutType || 'so',
            nonSoReason: r.nonSoReason,
            rollId: roll.id,
            lotNumber: roll.lotNumber,
            rollNumber: roll.rollNumber,
          }));
        rootItems.forEach((item) => map.set(item.id, item));

        // 2. Sub-collection items
        (subItems || []).forEach((item) => {
          map.set(item.id, item);
        });

        const merged = Array.from(map.values()).sort((a, b) => {
          const timeB = new Date(b.createdAt || b.cutDate || b.usageDate || 0).getTime();
          const timeA = new Date(a.createdAt || a.cutDate || a.usageDate || 0).getTime();
          return timeB - timeA;
        });

        setHistoryItems(merged);
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
  }, [roll?.id, records]);

  // Run SO History Audit specifically for this roll
  const audit = useMemo(() => {
    if (!roll) return null;
    return auditRollSOHistory(roll, records);
  }, [roll, records]);

  const totalUsed = historyItems.reduce((sum, r) => sum + Number(r.cutMeters ?? r.usedMeters ?? 0), 0);
  const totalNg = historyItems.reduce((sum, r) => sum + Number(r.ngMeters || 0), 0);
  const totalDeducted = historyItems.reduce((sum, r) => sum + Number(r.totalDeducted ?? ((r.cutMeters ?? r.usedMeters ?? 0) + (r.ngMeters || 0))), 0);
  
  // Accurately show remaining meters matching the roll inventory state
  const effectiveRemaining = roll?.isZeroedOut
    ? 0
    : Math.max(0, Number(roll?.remainingMeters ?? 0));

  const percentLeft = (roll?.totalMeters ?? 0) > 0 
    ? Math.max(0, Math.round((effectiveRemaining / roll!.totalMeters) * 100)) 
    : 0;

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
    link.setAttribute('download', `ประวัติการตัด_ล็อต_${roll.lotNumber}_เบอร์_${roll.rollNumber}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!roll) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs">
      <div 
        id="modal-roll-usage-history"
        className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold shadow-xs">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-bold">
                  ประวัติการใช้งานฟอยล์รายลูก
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  ล็อต {roll.lotNumber} | เบอร์ #{roll.rollNumber}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-white leading-tight mt-0.5">
                ประวัติใบสั่งซื้อ / ใบงานที่ใช้ตัดม้วนนี้
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
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
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-base font-bold font-mono text-slate-900">
                    ล็อต: {roll.lotNumber}
                  </span>
                  <span className="px-2.5 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 font-mono font-bold text-xs rounded-md">
                    เบอร์ #{roll.rollNumber}
                  </span>
                  <span className="px-2 py-0.5 bg-white text-slate-700 border border-slate-200 text-xs rounded-md font-medium">
                    ลาย {roll.pattern}
                  </span>
                  <span className="px-2 py-0.5 bg-white text-slate-700 border border-slate-200 text-xs rounded-md font-mono">
                    กว้าง {roll.width} มม.
                  </span>
                  {roll.isZeroedOut || effectiveRemaining <= 0 ? (
                    <span className="px-2 py-0.5 bg-slate-200 text-slate-700 text-xs rounded-md font-semibold">
                      {roll.isZeroedOut ? 'ตัดเป็น 0 แล้ว' : 'ตัดหมดแล้ว'}
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
                  {roll.notes && <span className="text-slate-600 block sm:inline sm:ml-2">หมายเหตุ: {roll.notes}</span>}
                </p>
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
              </div>
            </div>

            {/* Gauge progress bar */}
            <div className="mt-3">
              <div className="flex justify-between text-xs text-slate-500 mb-1 font-mono">
                <span>คงเหลือ: {percentLeft}%</span>
                <span>ตัดออกแล้ว: {formatMeters(totalDeducted)} ม.</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                <div 
                  className={`h-2 rounded-full transition-all duration-300 ${
                    effectiveRemaining <= 50 ? 'bg-rose-500' :
                    effectiveRemaining <= 200 ? 'bg-amber-500' :
                    'bg-emerald-500'
                  }`}
                  style={{ width: `${percentLeft}%` }}
                />
              </div>
            </div>
          </div>

          {/* SO History Audit & Diagnostics Banner */}
          {audit && (
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
                    <div key={iss.id} className="p-2 rounded-lg bg-white/80 border border-slate-200/80 flex items-start gap-2">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                      <div className="flex-1 leading-snug">
                        <span className="font-bold text-slate-900 block">{iss.title}</span>
                        <span className="text-[11px] text-slate-600">{iss.description}</span>
                      </div>
                    </div>
                  ))}
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
                        <th className="py-2.5 px-3">รหัส SO / ใบงาน</th>
                        <th className="py-2.5 px-3 text-right">ตัดลงแผ่น</th>
                        <th className="py-2.5 px-3 text-right">NG</th>
                        <th className="py-2.5 px-3 text-right">รวมตัดออก</th>
                        <th className="py-2.5 px-3 text-right">คงเหลือก่อน &rarr; หลัง</th>
                        <th className="py-2.5 px-3">วันที่ใช้งาน</th>
                        <th className="py-2.5 px-3">ผู้บันทึก</th>
                        <th className="py-2.5 px-3">หมายเหตุ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {historyItems.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2.5 px-3 font-mono text-slate-400 text-[11px]">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                            <div className="flex items-center gap-1.5">
                              <span>{item.soNumber || '-'}</span>
                              {item.cutType === 'non_so' && (
                                <span className="px-1.5 py-0.2 bg-slate-200 text-slate-700 rounded text-[10px] font-normal">
                                  ไม่มี SO
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800">
                            {formatMeters(item.cutMeters ?? item.usedMeters ?? 0)} ม.
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-rose-600">
                            {(item.ngMeters || 0) > 0 ? `${formatMeters(item.ngMeters)} ม.` : '-'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-900">
                            -{formatMeters(item.totalDeducted || ((item.cutMeters ?? item.usedMeters ?? 0) + (item.ngMeters || 0)))} ม.
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-[11px] whitespace-nowrap">
                            <span className="text-slate-400">{formatMeters(item.remainingBefore ?? 0)}</span>
                            <span className="text-slate-300 mx-1">&rarr;</span>
                            <span className="font-bold text-emerald-700">{formatMeters(item.remainingAfter ?? 0)} ม.</span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-600 whitespace-nowrap text-[11px]">
                            {item.cutDate || item.usageDate || item.recordedDate || (item.createdAt ? item.createdAt.slice(0, 10) : '-')}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 max-w-[120px] truncate text-[11px]">
                            {item.recordedBy || '-'}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 max-w-[150px] truncate text-[11px]">
                            {item.notes || (item.nonSoReason ? `เหตุผล: ${item.nonSoReason}` : '-')}
                          </td>
                        </tr>
                      ))}
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
            <span>ซิงค์ข้อมูลกับ Cloud Firestore กลางอัตโนมัติ</span>
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
