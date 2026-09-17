import React, { useState, useMemo } from 'react';
import { StockCutRecord } from '../types';
import { Search, Download, Trash2, Calendar, User, FileText, AlertCircle } from 'lucide-react';
import { exportCutRecordsToCSV } from '../utils/storage';
import { formatMeters } from '../utils/formatters';

interface CuttingHistoryTableProps {
  records: StockCutRecord[];
  onDeleteRecord: (recordId: string) => void;
  onOpenCutModal: () => void;
}

export const CuttingHistoryTable: React.FC<CuttingHistoryTableProps> = ({
  records,
  onDeleteRecord,
  onOpenCutModal,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPattern, setSelectedPattern] = useState('all');

  const filteredRecords = useMemo(() => {
    return records
      .slice()
      .reverse()
      .filter((r) => {
        const q = searchQuery.toLowerCase().trim();
        const matchQuery =
          !q ||
          r.soNumber.toLowerCase().includes(q) ||
          r.lotNumber.toLowerCase().includes(q) ||
          r.rollNumber.toLowerCase().includes(q) ||
          r.recordedBy.toLowerCase().includes(q) ||
          (r.notes && r.notes.toLowerCase().includes(q));

        const matchPattern = selectedPattern === 'all' || r.pattern === selectedPattern;

        return matchQuery && matchPattern;
      });
  }, [records, searchQuery, selectedPattern]);

  const totalUsedFiltered = filteredRecords.reduce((sum, r) => sum + r.usedMeters, 0);
  const totalNgFiltered = filteredRecords.reduce((sum, r) => sum + r.ngMeters, 0);

  return (
    <div className="space-y-4">
      {/* Control Header */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-1">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหารหัส SO (เช่น so6909500), ล็อต, ผู้บันทึก..."
              className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors"
            />
          </div>

          {/* Pattern Filter */}
          <select
            value={selectedPattern}
            onChange={(e) => setSelectedPattern(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:border-amber-500 cursor-pointer"
          >
            <option value="all">เลือกลาย: ทั้งหมด</option>
            {Array.from(new Set(records.map((r) => r.pattern))).map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        {/* Export & Action */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportCutRecordsToCSV(records)}
            className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>ส่งออกประวัติ CSV</span>
          </button>

          <button
            onClick={onOpenCutModal}
            className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
          >
            <span>+ บันทึกตัดสต๊อกเพิ่ม</span>
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {filteredRecords.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <AlertCircle className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="font-semibold text-slate-700">ไม่พบประวัติการตัดสต๊อกตามที่ค้นหา</p>
            <p className="text-xs text-slate-400">กรุณาตรวจสอบคำค้นหา หรือบันทึกการตัดใหม่</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase border-b border-slate-200 font-semibold">
                <tr>
                  <th className="px-4 py-3.5">รหัสคำสั่งซื้อ SO</th>
                  <th className="px-4 py-3.5">ล็อต & ม้วน</th>
                  <th className="px-4 py-3.5">ลาย & ขนาด</th>
                  <th className="px-4 py-3.5 text-right">เมตรที่ใช้</th>
                  <th className="px-4 py-3.5 text-right">NG ที่เสีย</th>
                  <th className="px-4 py-3.5 text-right">รวมตัดออก</th>
                  <th className="px-4 py-3.5 text-right">คงเหลือหลังตัด</th>
                  <th className="px-4 py-3.5">วันที่ใช้งาน</th>
                  <th className="px-4 py-3.5">ผู้บันทึก</th>
                  <th className="px-4 py-3.5 text-center">ยกเลิกรายการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRecords.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* SO Number with highlight */}
                    <td className="px-4 py-3.5">
                      <div className="font-mono font-bold text-amber-800 text-sm bg-amber-50 px-2 py-0.5 rounded border border-amber-200 inline-block">
                        {item.soNumber}
                      </div>
                      {item.notes && (
                        <div className="text-[11px] text-slate-500 mt-1 truncate max-w-[200px]" title={item.notes}>
                          {item.notes}
                        </div>
                      )}
                    </td>

                    {/* Lot & Roll */}
                    <td className="px-4 py-3.5 font-mono text-xs text-slate-800">
                      <div className="font-bold">{item.lotNumber}</div>
                      <div className="text-slate-500">เบอร์ #{item.rollNumber}</div>
                    </td>

                    {/* Pattern & Width */}
                    <td className="px-4 py-3.5 text-xs">
                      <div className="font-medium text-slate-900">{item.pattern}</div>
                      <div className="text-slate-500 font-mono">{item.width} มม.</div>
                    </td>

                    {/* Used Meters */}
                    <td className="px-4 py-3.5 text-right font-mono font-bold text-slate-900">
                      {formatMeters(item.usedMeters)}{' '}
                      <span className="text-[11px] font-normal text-slate-400">ม.</span>
                    </td>

                    {/* NG Meters */}
                    <td className="px-4 py-3.5 text-right font-mono text-xs font-semibold text-rose-600">
                      {item.ngMeters > 0 ? (
                        <>
                          {formatMeters(item.ngMeters)}{' '}
                          <span className="text-[11px] font-normal text-slate-400">ม.</span>
                        </>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>

                    {/* Total Deducted */}
                    <td className="px-4 py-3.5 text-right font-mono text-xs font-bold text-amber-800">
                      -{formatMeters(item.totalDeducted)}{' '}
                      <span className="text-[11px] font-normal text-slate-400">ม.</span>
                    </td>

                    {/* Remaining After */}
                    <td className="px-4 py-3.5 text-right font-mono text-xs font-bold text-emerald-700">
                      {formatMeters(item.remainingAfter)}{' '}
                      <span className="text-[11px] font-normal text-slate-400">ม.</span>
                    </td>

                    {/* Usage & Record Date */}
                    <td className="px-4 py-3.5 text-xs">
                      <div className="font-mono text-slate-800 font-medium">{item.usageDate}</div>
                      <div className="text-[10px] text-slate-400 font-mono">บันทึก: {item.recordedDate}</div>
                    </td>

                    {/* Recorded By */}
                    <td className="px-4 py-3.5 text-xs text-slate-700">
                      <div className="flex items-center gap-1">
                        <User className="w-3 h-3 text-slate-400" />
                        <span className="truncate max-w-[140px]">{item.recordedBy}</span>
                      </div>
                    </td>

                    {/* Delete / Void Action */}
                    <td className="px-4 py-3.5 text-center">
                      <button
                        onClick={() => {
                          if (
                            confirm(
                              `ต้องการยกเลิกรายการตัดสต๊อก ${item.soNumber} หรือไม่?\n(ระบบจะคืนยอด ${item.totalDeducted.toLocaleString()} เมตร กลับเข้าม้วน ${item.lotNumber} เบอร์ ${item.rollNumber} อัตโนมัติ)`
                            )
                          ) {
                            onDeleteRecord(item.id);
                          }
                        }}
                        title="ยกเลิกรายการนี้และคืนยอดกลับม้วนฟอยล์"
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer Summary */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs text-slate-600 gap-2 font-mono">
          <div>
            รวมประวัติการตัด: <span className="font-bold text-slate-900">{filteredRecords.length}</span> รายการ
          </div>
          <div className="flex items-center gap-4">
            <div>
              ผลิตลงแผ่นรวม:{' '}
              <span className="font-bold text-slate-900 text-sm">
                {totalUsedFiltered.toLocaleString()}
              </span>{' '}
              ม.
            </div>
            <div>
              NG เสียรวม:{' '}
              <span className="font-bold text-rose-600 text-sm">
                {totalNgFiltered.toLocaleString()}
              </span>{' '}
              ม.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
