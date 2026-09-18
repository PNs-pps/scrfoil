import React, { useState } from 'react';
import { FoilRoll, StockCutRecord } from '../types';
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
  Printer
} from 'lucide-react';
import { formatMeters } from '../utils/formatters';

interface RollUsageHistoryModalProps {
  roll: FoilRoll | null;
  records: StockCutRecord[];
  onClose: () => void;
  onOpenCutForThisRoll: (rollId: string) => void;
}

export const RollUsageHistoryModal: React.FC<RollUsageHistoryModalProps> = ({
  roll,
  records,
  onClose,
  onOpenCutForThisRoll,
}) => {
  if (!roll) return null;

  // Filter all cut records belonging to this specific roll
  const rollRecords = records
    .filter((r) => r.foilId === roll.id)
    .sort((a, b) => new Date(b.createdAt || b.recordedDate).getTime() - new Date(a.createdAt || a.recordedDate).getTime());

  const totalUsed = rollRecords.reduce((sum, r) => sum + r.usedMeters, 0);
  const totalNg = rollRecords.reduce((sum, r) => sum + r.ngMeters, 0);
  const totalDeducted = totalUsed + totalNg;
  const percentLeft = roll.totalMeters > 0 
    ? Math.max(0, Math.round((roll.remainingMeters / roll.totalMeters) * 100)) 
    : 0;

  // Export single roll history to CSV
  const handleExportThisRoll = () => {
    const headers = [
      'ลำดับ',
      'รหัสใบงาน / SO',
      'ชนิดการตัด',
      'เลขล็อต',
      'เบอร์ม้วน',
      'หน้ากว้าง (มม.)',
      'ลายฟอยล์',
      'เมตรที่ใช้ลงแผ่นจริง (ม.)',
      'NG ที่เสีย (ม.)',
      'รวมตัดออก (ม.)',
      'คงเหลือก่อนตัด (ม.)',
      'คงเหลือหลังตัด (ม.)',
      'วันที่ใช้งาน',
      'วันที่บันทึก',
      'ผู้บันทึก',
      'หมายเหตุ'
    ];

    const rows = rollRecords.map((r, idx) => [
      idx + 1,
      r.soNumber,
      r.cutType === 'non_so' ? `ไม่ใช้ SO (${r.nonSoReason || 'สาขายืม/ซ่อม'})` : 'มี SO',
      r.lotNumber,
      r.rollNumber,
      r.width,
      r.pattern,
      r.usedMeters,
      r.ngMeters,
      r.totalDeducted,
      r.remainingBefore,
      r.remainingAfter,
      r.usageDate,
      r.recordedDate,
      `"${(r.recordedBy || '').replace(/"/g, '""')}"`,
      `"${(r.notes || '').replace(/"/g, '""')}"`
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
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
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
                  {roll.status === 'depleted' || roll.remainingMeters <= 0 ? (
                    <span className="px-2 py-0.5 bg-slate-200 text-slate-700 text-xs rounded-md font-semibold">
                      ตัดหมดแล้ว
                    </span>
                  ) : roll.remainingMeters <= 200 ? (
                    <span className="px-2 py-0.5 bg-rose-100 text-rose-700 border border-rose-300 text-xs rounded-md font-bold animate-pulse">
                      เหลือ &le; 200 ม. (วิกฤต)
                    </span>
                  ) : roll.remainingMeters <= 500 ? (
                    <span className="px-2 py-0.5 bg-orange-100 text-orange-800 border border-orange-300 text-xs rounded-md font-bold">
                      เหลือ &le; 500 ม. (ใกล้หมด)
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
                <button
                  type="button"
                  onClick={handleExportThisRoll}
                  disabled={rollRecords.length === 0}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                  title="ดาวน์โหลดรายการตัดของม้วนนี้เป็น CSV"
                >
                  <Download className="w-3.5 h-3.5 text-slate-500" />
                  <span>ส่งออก CSV ลูกนี้</span>
                </button>

                {roll.remainingMeters > 0 && !roll.isZeroedOut && (
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
                  {formatMeters(roll.usedMeters)} <span className="text-xs font-normal text-slate-400">ม.</span>
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <span className="text-[11px] text-slate-500 block">NG เสียสะสม</span>
                <span className="font-mono font-bold text-rose-600 text-base">
                  {formatMeters(roll.ngMeters)} <span className="text-xs font-normal text-slate-400">ม.</span>
                </span>
              </div>
              <div className={`p-2.5 rounded-lg border ${
                roll.remainingMeters <= 200 
                  ? 'bg-rose-50 border-rose-200 text-rose-900' 
                  : roll.remainingMeters <= 500 
                    ? 'bg-orange-50 border-orange-200 text-orange-900' 
                    : 'bg-emerald-50 border-emerald-200 text-emerald-900'
              }`}>
                <span className="text-[11px] text-slate-500 block">คงเหลือปัจจุบัน</span>
                <span className="font-mono font-bold text-base">
                  {formatMeters(roll.remainingMeters)} <span className="text-xs font-normal text-slate-400">ม.</span>
                </span>
              </div>
            </div>

            {/* Gauge progress bar */}
            <div className="mt-3">
              <div className="flex justify-between text-xs text-slate-500 mb-1 font-mono">
                <span>คงเหลือ: {percentLeft}%</span>
                <span>ตัดออกแล้ว: {formatMeters(roll.usedMeters + roll.ngMeters)} ม.</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                <div 
                  className={`h-2 rounded-full transition-all duration-300 ${
                    roll.remainingMeters <= 200 ? 'bg-rose-500' :
                    roll.remainingMeters <= 500 ? 'bg-orange-500' :
                    'bg-emerald-500'
                  }`}
                  style={{ width: `${percentLeft}%` }}
                />
              </div>
            </div>
          </div>

          {/* Cuts History Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-600" />
                <span>รายการใบงาน/SO ที่ตัดจากลูกนี้ทั้งหมด ({rollRecords.length} รายการ)</span>
              </h3>
              <span className="text-xs text-slate-500 font-mono">
                ตัดรวมทั้งหมด: {formatMeters(totalDeducted)} เมตร
              </span>
            </div>

            {rollRecords.length === 0 ? (
              <div className="p-8 text-center text-slate-500 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <Scissors className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="font-semibold text-slate-700">ม้วนนี้ยังไม่มีประวัติการตัดสต๊อก</p>
                <p className="text-xs text-slate-400">เป็นม้วนใหม่ลูกเต็ม {formatMeters(roll.totalMeters)} เมตร พร้อมใช้งาน</p>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                      <tr>
                        <th className="p-3">ลำดับ</th>
                        <th className="p-3">รหัสใบงาน / SO</th>
                        <th className="p-3">ประเภท</th>
                        <th className="p-3 text-right">ตัดลงแผ่นจริง</th>
                        <th className="p-3 text-right">NG ที่เสีย</th>
                        <th className="p-3 text-right">รวมตัดออก</th>
                        <th className="p-3 text-right">ก่อนตัด &rarr; หลังตัด</th>
                        <th className="p-3">วันที่ใช้งาน</th>
                        <th className="p-3">วันที่/เวลาบันทึก</th>
                        <th className="p-3">ผู้บันทึก</th>
                        <th className="p-3">หมายเหตุ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rollRecords.map((item, idx) => {
                        const isNonSo = item.cutType === 'non_so';
                        return (
                          <tr key={item.id} className="hover:bg-amber-50/40 transition-colors">
                            <td className="p-3 text-slate-400 font-mono font-medium">
                              {idx + 1}
                            </td>
                            <td className="p-3">
                              <span className={`font-mono font-bold text-xs px-2 py-0.5 rounded border inline-block ${
                                isNonSo
                                  ? 'bg-slate-100 text-slate-800 border-slate-300'
                                  : 'bg-amber-50 text-amber-900 border-amber-300'
                              }`}>
                                {item.soNumber}
                              </span>
                            </td>
                            <td className="p-3 text-slate-600">
                              {isNonSo ? (
                                <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                                  {item.nonSoReason || 'ไม่ใช้ SO'}
                                </span>
                              ) : (
                                <span className="text-[11px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                                  ใบสั่งผลิต SO
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-right font-mono font-bold text-slate-900">
                              {formatMeters(item.usedMeters)} <span className="text-slate-400 font-normal">ม.</span>
                            </td>
                            <td className="p-3 text-right font-mono text-rose-600">
                              {item.ngMeters > 0 ? `${formatMeters(item.ngMeters)} ม.` : '-'}
                            </td>
                            <td className="p-3 text-right font-mono font-bold text-amber-800">
                              -{formatMeters(item.totalDeducted)} <span className="text-slate-400 font-normal">ม.</span>
                            </td>
                            <td className="p-3 text-right font-mono text-[11px]">
                              <span className="text-slate-500">{formatMeters(item.remainingBefore)}</span>
                              <span className="text-slate-300 mx-1">&rarr;</span>
                              <span className="font-bold text-emerald-700">{formatMeters(item.remainingAfter)} ม.</span>
                            </td>
                            <td className="p-3 font-mono text-slate-800 whitespace-nowrap font-medium">
                              {item.usageDate}
                            </td>
                            <td className="p-3 font-mono text-slate-500 text-[11px] whitespace-nowrap">
                              {item.recordedDate}
                              {item.createdAt && (
                                <span className="text-[10px] text-slate-400 block">
                                  {new Date(item.createdAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-slate-700 truncate max-w-[120px]">
                              {item.recordedBy || '-'}
                            </td>
                            <td className="p-3 text-slate-500 text-[11px] truncate max-w-[150px]" title={item.notes}>
                              {item.notes || '-'}
                            </td>
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
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-xs text-slate-500 hidden sm:inline">
            ข้อมูลถูกซิงค์เรียลไทม์กับ Firebase Firestore ทุกครั้งที่มีการตัด
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold transition-colors cursor-pointer ml-auto"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
};
