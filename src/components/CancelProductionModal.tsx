import React, { useState } from 'react';
import { FoilRoll, StockCutRecord } from '../types';
import { formatMeters } from '../utils/formatters';
import { X, Ban, AlertTriangle, RotateCcw } from 'lucide-react';

interface CancelProductionModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: StockCutRecord | null;
  roll?: FoilRoll | null;
  onConfirmCancel: (recordId: string, reason?: string) => Promise<void> | void;
}

export const CancelProductionModal: React.FC<CancelProductionModalProps> = ({
  isOpen,
  onClose,
  record,
  roll,
  onConfirmCancel,
}) => {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !record) return null;

  const totalMeters = (Number(record.usedMeters) || 0) + (Number(record.ngMeters) || 0);
  const isReserved = record.cutStatus === 'reserved';

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      await onConfirmCancel(record.id, reason.trim() || undefined);
      onClose();
    } catch (err) {
      console.error('Error cancelling production:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-rose-50/70">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-rose-100 rounded-xl text-rose-700">
              <Ban className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {isReserved ? 'ยกเลิกคิวจองฟอยล์ SO' : 'ยกเลิกรายการผลิต SO'}
              </h3>
              <p className="text-xs text-slate-500 font-mono">SO: {record.soNumber}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <div className="p-3.5 bg-rose-50/50 rounded-xl border border-rose-200 text-xs text-rose-950 space-y-2">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">
                  {isReserved
                    ? 'คืนยอดจองกลับสู่ม้วนฟอยล์ทันที'
                    : 'ยกเลิกรายการตัดและคืนสต๊อกกลับม้วนฟอยล์'}
                </p>
                <p className="text-rose-800 text-[11px] mt-0.5">
                  ยอดจำนวน <span className="font-bold font-mono text-rose-950">{formatMeters(totalMeters)} เมตร</span>{' '}
                  จะถูกคืนกลับเข้าม้วน LOT {record.lotNumber} #{record.rollNumber} และหลอดสถานะสีเขียวจะกลับมาเต็มตามเดิม
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              เหตุผลการยกเลิก (ถ้ามี):
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="เช่น ลูกค้ายกเลิกออเดอร์, ยอดสั่งผิด, คิวย้ายวัน"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors"
          >
            ปิด
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleSubmit}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white transition-colors shadow-xs flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            {isSubmitting ? 'กำลังยกเลิก...' : 'ยืนยันยกเลิกการผลิต'}
          </button>
        </div>
      </div>
    </div>
  );
};
