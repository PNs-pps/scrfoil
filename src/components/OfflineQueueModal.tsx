import React, { useState, useEffect } from 'react';
import {
  X,
  Wifi,
  WifiOff,
  RefreshCw,
  Trash2,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Scissors,
  FileEdit,
  Send,
  Database,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { FoilRoll, StockCutRecord } from '../types';
import {
  PendingCutEntry,
  loadPendingCuts,
  removePendingCut,
} from '../utils/pendingCutQueue';
import {
  PendingRecordEdit,
  loadPendingRecordEdits,
  removePendingRecordEdit,
} from '../utils/pendingRecordEditQueue';
import { formatMeters, formatThaiDateTime, round2 } from '../utils/formatters';

interface OfflineQueueModalProps {
  isOpen: boolean;
  onClose: () => void;
  isOnline: boolean;
  onFlushPendingCuts: () => Promise<void>;
  onCancelPendingCut: (queueId: string) => Promise<void> | void;
  onCancelPendingRecordEdit?: (recordId: string) => Promise<void> | void;
  rolls?: FoilRoll[];
}

export const OfflineQueueModal: React.FC<OfflineQueueModalProps> = ({
  isOpen,
  onClose,
  isOnline,
  onFlushPendingCuts,
  onCancelPendingCut,
  onCancelPendingRecordEdit,
  rolls = [],
}) => {
  const [pendingCuts, setPendingCuts] = useState<PendingCutEntry[]>([]);
  const [pendingEdits, setPendingEdits] = useState<PendingRecordEdit[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDeleteType, setConfirmDeleteType] = useState<'cut' | 'edit'>('cut');

  const refreshQueueData = () => {
    setPendingCuts(loadPendingCuts());
    setPendingEdits(loadPendingRecordEdits());
  };

  useEffect(() => {
    if (isOpen) {
      refreshQueueData();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const totalPendingCutsCount = pendingCuts.reduce(
    (sum, entry) => sum + (entry.records?.length || 0),
    0
  );
  const totalPendingEditsCount = pendingEdits.length;
  const totalItemsCount = totalPendingCutsCount + totalPendingEditsCount;

  const handleManualSync = async () => {
    if (!isOnline || isSyncing) return;
    setIsSyncing(true);
    try {
      await onFlushPendingCuts();
      refreshQueueData();
    } finally {
      setIsSyncing(false);
      refreshQueueData();
    }
  };

  const handleConfirmCancel = async () => {
    if (!confirmDeleteId) return;
    if (confirmDeleteType === 'cut') {
      await onCancelPendingCut(confirmDeleteId);
    } else if (onCancelPendingRecordEdit) {
      await onCancelPendingRecordEdit(confirmDeleteId);
    }
    setConfirmDeleteId(null);
    refreshQueueData();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[92dvh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center shrink-0">
              <Database className="w-5 h-5 text-amber-800" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 leading-tight">
                  คิวตัดสต๊อกค้างส่ง (Offline Queue)
                </h2>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                    isOnline
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-rose-100 text-rose-800 border border-rose-300'
                  }`}
                >
                  {isOnline ? (
                    <>
                      <Wifi className="w-3 h-3 text-emerald-600" /> ออนไลน์
                    </>
                  ) : (
                    <>
                      <WifiOff className="w-3 h-3 text-rose-600" /> ออฟไลน์
                    </>
                  )}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                รายการที่บันทึกขณะไม่มีเน็ต จัดเก็บปลอดภัยในเครื่องและรอขึ้น Cloud กลาง
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
            aria-label="ปิด"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sync Status Banner */}
        <div className="px-5 py-3 bg-amber-50/70 border-b border-amber-200/60 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-amber-950 flex items-center gap-2 font-medium">
            <Clock className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              มีรายการค้างส่งทั้งหมด{' '}
              <strong className="text-amber-900 font-bold underline">
                {totalItemsCount} รายการ
              </strong>{' '}
              {totalPendingCutsCount > 0 && `(ตัดสต๊อก ${totalPendingCutsCount} รายการ)`}
              {totalPendingEditsCount > 0 && `(แก้ไข SO ${totalPendingEditsCount} รายการ)`}
            </span>
          </div>

          <button
            type="button"
            onClick={handleManualSync}
            disabled={!isOnline || isSyncing || totalItemsCount === 0}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs ${
              !isOnline || totalItemsCount === 0
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
                : isSyncing
                  ? 'bg-amber-400 text-slate-900 cursor-wait'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer active:scale-95'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'กำลังส่งขึ้น Cloud...' : 'ส่งขึ้น Cloud ตอนนี้'}</span>
          </button>
        </div>

        {/* Queue Items List */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {totalItemsCount === 0 ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">
                  ไม่มีรายการค้างส่งในเครื่อง
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                  ข้อมูลการตัดสต๊อกและการแก้ไขทั้งหมดถูกซิงก์ขึ้น Firebase Cloud กลางเรียบร้อยแล้ว
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* รายการตัดสต๊อกค้างส่ง */}
              {pendingCuts.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wide">
                    <Scissors className="w-4 h-4 text-amber-600" />
                    <span>รายการตัดสต๊อกรอขึ้นคลาวด์ ({pendingCuts.length} ชุด)</span>
                  </div>

                  <div className="space-y-3">
                    {pendingCuts.map((entry, index) => {
                      const totalMeters = entry.records.reduce(
                        (sum, r) => sum + (Number(r.totalDeducted) || 0),
                        0
                      );
                      const rollSample = entry.records[0];
                      const matchedRoll = rolls.find((r) => r.id === rollSample?.foilId);
                      const lotNumber = rollSample?.lotNumber || matchedRoll?.lotNumber || '-';
                      const rollNumber = rollSample?.rollNumber || matchedRoll?.rollNumber || '-';
                      const width = rollSample?.width || matchedRoll?.width || '-';
                      const pattern = rollSample?.pattern || matchedRoll?.pattern || '-';

                      return (
                        <div
                          key={entry.queueId}
                          className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs hover:border-amber-300 transition-colors space-y-3"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="px-2 py-0.5 rounded-md bg-slate-900 text-amber-300 text-xs font-bold">
                                  ล็อต {lotNumber}
                                </span>
                                <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 text-xs font-bold border border-amber-300">
                                  ม้วน #{rollNumber}
                                </span>
                                <span className="text-xs text-slate-600 font-medium">
                                  {pattern} · {width} มม.
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-400 flex items-center gap-2">
                                <span>บันทึกเมื่อ: {formatThaiDateTime(entry.enqueuedAt)}</span>
                                {entry.attempts > 1 && (
                                  <span className="text-amber-700 font-medium">
                                    · ลองส่งแล้ว {entry.attempts} ครั้ง
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <div className="text-right">
                                <div className="text-[10px] text-slate-400 uppercase font-semibold">
                                  ตัดรวม
                                </div>
                                <div className="text-sm font-bold text-rose-600 font-mono">
                                  -{formatMeters(totalMeters)} ม.
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setConfirmDeleteId(entry.queueId);
                                  setConfirmDeleteType('cut');
                                }}
                                title="ยกเลิกรายการนี้และคืนยอดสต๊อกในเครื่อง"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer border border-transparent hover:border-rose-200"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* Records inside batch */}
                          <div className="space-y-1.5">
                            {entry.records.map((rec, rIdx) => (
                              <div
                                key={rec.id || rIdx}
                                className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg bg-slate-50 border border-slate-100"
                              >
                                <div className="min-w-0">
                                  <div className="font-bold text-slate-800 font-mono truncate">
                                    {rec.cutType === 'so'
                                      ? rec.soNumber || 'SO ไม่ระบุ'
                                      : rec.nonSoReason || 'ตัดใช้งานทั่วไป'}
                                  </div>
                                  <div className="text-[10px] text-slate-400">
                                    ช่าง: {rec.recordedBy || 'ไม่ระบุ'} {rec.notes ? `· ${rec.notes}` : ''}
                                  </div>
                                </div>
                                <div className="text-right font-mono text-xs shrink-0">
                                  <span className="text-slate-800 font-semibold">
                                    ใช้ {formatMeters(rec.usedMeters)}
                                  </span>
                                  {Number(rec.ngMeters || 0) > 0 && (
                                    <span className="text-rose-600 ml-1">
                                      +NG {formatMeters(rec.ngMeters)}
                                    </span>
                                  )}
                                  <span className="text-slate-400"> ม.</span>
                                </div>
                              </div>
                            ))}
                          </div>

                          {entry.lastError && (
                            <div className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2 flex items-start gap-1.5">
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-600 mt-0.5" />
                              <span className="leading-tight truncate">
                                ปัญหาล่าสุด: {entry.lastError}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* รายการแก้ไข SO ค้างส่ง */}
              {pendingEdits.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wide">
                    <FileEdit className="w-4 h-4 text-blue-600" />
                    <span>รายการแก้ไขใบ SO รอขึ้นคลาวด์ ({pendingEdits.length} รายการ)</span>
                  </div>

                  <div className="space-y-3">
                    {pendingEdits.map((edit) => (
                      <div
                        key={edit.recordId}
                        className="rounded-xl border border-blue-200 bg-white p-3.5 shadow-xs space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2 border-b border-blue-50 pb-2">
                          <div>
                            <span className="font-bold text-blue-900 font-mono text-xs">
                              SO {edit.record.soNumber || '-'}
                            </span>
                            <div className="text-[11px] text-slate-400">
                              แก้ไขเมื่อ: {formatThaiDateTime(edit.enqueuedAt)}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmDeleteId(edit.recordId);
                              setConfirmDeleteType('edit');
                            }}
                            title="ยกเลิกการแก้ไขนี้"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="text-xs text-slate-600 flex items-center justify-between">
                          <span>ม้วน: {edit.record.lotNumber || '-'} #{edit.record.rollNumber || '-'}</span>
                          <span className="font-bold text-blue-700">
                            ยอดตัดที่แก้: {formatMeters(edit.record.usedMeters)} ม.
                            {Number(edit.record.ngMeters || 0) > 0 && ` (+NG ${formatMeters(edit.record.ngMeters)} ม.)`}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500">
            ระบบจะส่งคิวอัตโนมัติเมื่อมีสัญญาณอินเทอร์เน็ต
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-200/60 text-xs font-bold transition-colors cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>

      {/* Confirmation Dialog for Deletion */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-rose-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 border border-rose-300 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  ยกเลิกรายการนี้ออกจากคิว?
                </h4>
                <p className="text-xs text-slate-500">
                  {confirmDeleteType === 'cut'
                    ? 'ยอดฟอยล์ที่ตัดไปจะถูกคืนกลับเข้าสต๊อกในเครื่องทันที'
                    : 'การแก้ไขจะถูกยกเลิกและคืนค่าเดิม'}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="px-3.5 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold transition-colors cursor-pointer"
              >
                ไม่ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
              >
                ยืนยันยกเลิกรายการ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
