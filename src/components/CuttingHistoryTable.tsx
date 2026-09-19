import React, { useState, useMemo } from 'react';
import { StockCutRecord } from '../types';
import { 
  Search, 
  Download, 
  Trash2, 
  Calendar, 
  User, 
  FileText, 
  AlertCircle, 
  X, 
  Tag, 
  Folder, 
  FolderOpen, 
  Lock,
  Layers,
  ChevronDown,
  ChevronRight,
  Filter
} from 'lucide-react';
import { exportCutRecordsToCSV } from '../utils/storage';
import { formatMeters } from '../utils/formatters';
import { UserMode } from '../utils/auth';
import { groupCutsByDate, exportCutsDateCSV } from '../utils/dateGrouping';

interface CuttingHistoryTableProps {
  records: StockCutRecord[];
  onDeleteRecord: (recordId: string) => void;
  onOpenCutModal: () => void;
  userMode?: UserMode;
  onRequestUnlock?: () => void;
}

export const CuttingHistoryTable: React.FC<CuttingHistoryTableProps> = ({
  records,
  onDeleteRecord,
  onOpenCutModal,
  userMode = 'visitor',
  onRequestUnlock,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchScope, setSearchScope] = useState<'all' | 'so' | 'employee' | 'lot_roll'>('all');
  const [selectedPattern, setSelectedPattern] = useState('all');
  const [viewMode, setViewMode] = useState<'flat' | 'date_folder'>('flat');
  const [collapsedDates, setCollapsedDates] = useState<Record<string, boolean>>({});

  // Unique SO numbers and Employee names for quick filter pills
  const quickFilters = useMemo(() => {
    const sos = Array.from(new Set(records.map(r => r.soNumber).filter(Boolean))).slice(-8).reverse();
    const employees = Array.from(new Set(records.map(r => r.recordedBy).filter(Boolean))).slice(0, 6);
    return { sos, employees };
  }, [records]);

  // Filter records
  const filteredRecords = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return records
      .slice()
      .reverse()
      .filter((r) => {
        // Pattern filter
        if (selectedPattern !== 'all' && r.pattern !== selectedPattern) {
          return false;
        }

        if (!q) return true;

        if (searchScope === 'so') {
          return r.soNumber.toLowerCase().includes(q);
        }

        if (searchScope === 'employee') {
          return r.recordedBy.toLowerCase().includes(q);
        }

        if (searchScope === 'lot_roll') {
          return (
            r.lotNumber.toLowerCase().includes(q) ||
            r.rollNumber.toLowerCase().includes(q)
          );
        }

        // 'all'
        return (
          r.soNumber.toLowerCase().includes(q) ||
          r.recordedBy.toLowerCase().includes(q) ||
          r.lotNumber.toLowerCase().includes(q) ||
          r.rollNumber.toLowerCase().includes(q) ||
          (r.notes && r.notes.toLowerCase().includes(q))
        );
      });
  }, [records, searchQuery, searchScope, selectedPattern]);

  // Date grouped records
  const dateGroups = useMemo(() => {
    return groupCutsByDate(filteredRecords);
  }, [filteredRecords]);

  const totalUsedFiltered = filteredRecords.reduce((sum, r) => sum + r.usedMeters, 0);
  const totalNgFiltered = filteredRecords.reduce((sum, r) => sum + r.ngMeters, 0);

  const toggleDateCollapse = (date: string) => {
    setCollapsedDates(prev => ({ ...prev, [date]: !prev[date] }));
  };

  const handleActionGuarded = (action: () => void) => {
    if (userMode === 'visitor' && onRequestUnlock) {
      onRequestUnlock();
      return;
    }
    action();
  };

  const highlightMatch = (text: string, query: string) => {
    if (!query.trim()) return text;
    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={i} className="bg-amber-300 text-slate-950 font-bold px-0.5 rounded">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <div className="space-y-4">
      {/* Control Header */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        {/* Row 1: Search Bar & Scope Selection */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          {/* Main Search Box */}
          <div className="relative flex-1">
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-amber-500 absolute left-3.5 pointer-events-none" />
              <input
                id="history-search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setSearchQuery('');
                }}
                placeholder={
                  searchScope === 'so'
                    ? 'ค้นหาเฉพาะรหัส SO เช่น so6909500...'
                    : searchScope === 'employee'
                    ? 'ค้นหาเฉพาะชื่อพนักงานผู้ตัด เช่น สมชาย, ช่างคุม...'
                    : searchScope === 'lot_roll'
                    ? 'ค้นหาเฉพาะเลขล็อต หรือ เบอร์ม้วน...'
                    : 'ค้นหารหัส SO หรือ ชื่อพนักงานผู้บันทึก หรือ ล็อต/เบอร์ม้วน...'
                }
                className="w-full pl-10 pr-24 py-2.5 text-sm bg-slate-50 hover:bg-slate-100/60 border border-slate-200 rounded-xl focus:bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all font-medium placeholder:text-slate-400"
              />
              <div className="absolute right-2.5 flex items-center gap-1.5">
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    title="ล้างคำค้นหา"
                    className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                ) : null}
                <span className="text-[11px] font-mono text-slate-500 bg-slate-100/90 px-2 py-0.5 rounded-md border border-slate-200 hidden sm:inline">
                  {filteredRecords.length}/{records.length} รายการ
                </span>
              </div>
            </div>
          </div>

          {/* Search Scope Buttons */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs shrink-0">
            <button
              type="button"
              onClick={() => setSearchScope('all')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                searchScope === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ทั้งหมด
            </button>
            <button
              type="button"
              onClick={() => setSearchScope('so')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
                searchScope === 'so'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-3 h-3" />
              <span>รหัส SO</span>
            </button>
            <button
              type="button"
              onClick={() => setSearchScope('employee')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
                searchScope === 'employee'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <User className="w-3 h-3" />
              <span>ชื่อพนักงาน</span>
            </button>
            <button
              type="button"
              onClick={() => setSearchScope('lot_roll')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
                searchScope === 'lot_roll'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Tag className="w-3 h-3" />
              <span>ล็อต/ม้วน</span>
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => exportCutRecordsToCSV(filteredRecords)}
              className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="ส่งออกรายการที่กรองเป็น CSV"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">ส่งออก CSV</span>
            </button>

            <button
              type="button"
              onClick={() => handleActionGuarded(onOpenCutModal)}
              className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
            >
              {userMode === 'visitor' ? (
                <Lock className="w-3.5 h-3.5 text-slate-900" />
              ) : null}
              <span>+ บันทึกตัดสต๊อก</span>
            </button>
          </div>
        </div>

        {/* Row 1.5: Quick Filter Chips (SO Numbers & Employees) */}
        <div className="flex items-center flex-wrap gap-1.5 pt-1 text-xs border-t border-slate-100">
          <span className="text-slate-400 text-[11px] font-medium mr-1 flex items-center gap-1">
            <Filter className="w-3 h-3 text-slate-400" />
            <span>คลิกกรองด่วน:</span>
          </span>

          {/* Quick SO Chips */}
          {quickFilters.sos.map((so) => (
            <button
              key={so}
              type="button"
              onClick={() => {
                if (searchQuery === so) {
                  setSearchQuery('');
                } else {
                  setSearchQuery(so);
                  setSearchScope('so');
                }
              }}
              className={`px-2 py-0.5 rounded-md font-mono text-[11px] transition-all cursor-pointer border ${
                searchQuery === so
                  ? 'bg-amber-100 text-amber-900 border-amber-300 font-bold ring-1 ring-amber-400'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              {so}
            </button>
          ))}

          {/* Quick Employee Chips */}
          {quickFilters.employees.map((emp) => (
            <button
              key={emp}
              type="button"
              onClick={() => {
                if (searchQuery === emp) {
                  setSearchQuery('');
                } else {
                  setSearchQuery(emp);
                  setSearchScope('employee');
                }
              }}
              className={`px-2 py-0.5 rounded-md text-[11px] transition-all cursor-pointer border flex items-center gap-1 ${
                searchQuery === emp
                  ? 'bg-blue-100 text-blue-900 border-blue-300 font-bold ring-1 ring-blue-400'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              <User className="w-2.5 h-2.5 text-slate-400" />
              <span>{emp}</span>
            </button>
          ))}

          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="text-[11px] text-rose-600 hover:underline ml-1 font-medium cursor-pointer"
            >
              ล้างคำค้น
            </button>
          )}
        </div>

        {/* Row 2: View Mode (Flat Table vs Date Folder Grouping) & Pattern Filter */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setViewMode('flat')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                  viewMode === 'flat'
                    ? 'bg-white text-slate-900 font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ตารางทั้งหมด ({filteredRecords.length})
              </button>
              <button
                type="button"
                onClick={() => setViewMode('date_folder')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                  viewMode === 'date_folder'
                    ? 'bg-white text-slate-900 font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Folder className="w-3.5 h-3.5 text-amber-600" />
                <span>แยกโฟลเดอร์ตามวันที่ ({dateGroups.length} วัน)</span>
              </button>
            </div>

            {/* Pattern Filter */}
            <select
              value={selectedPattern}
              onChange={(e) => setSelectedPattern(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:border-amber-500 cursor-pointer"
            >
              <option value="all">เลือกลาย: ทั้งหมด</option>
              {Array.from(new Set(records.map((r) => r.pattern))).map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono text-slate-600">
            <div>
              ผลิตลงแผ่นรวม: <strong className="text-slate-900 font-bold">{formatMeters(totalUsedFiltered)}</strong> ม.
            </div>
            <div>
              NG เสีย: <strong className="text-rose-600 font-bold">{formatMeters(totalNgFiltered)}</strong> ม.
            </div>
          </div>
        </div>
      </div>

      {/* Main Content: Flat Table or Date Folders */}
      {filteredRecords.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-12 text-center text-slate-500 space-y-2">
          <AlertCircle className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="font-semibold text-slate-700">ไม่พบประวัติการตัดสต๊อกตามที่ค้นหา</p>
          <p className="text-xs text-slate-400">
            คำค้น "{searchQuery}" ไม่ตรงกับรหัส SO, ชื่อพนักงาน หรือเลขล็อตใดๆ
          </p>
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="mt-2 text-xs font-semibold text-amber-700 hover:underline cursor-pointer"
            >
              ล้างคำค้นหาทั้งหมด
            </button>
          )}
        </div>
      ) : viewMode === 'flat' ? (
        /* Flat Table View */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase border-b border-slate-200 font-semibold">
                <tr>
                  <th className="px-4 py-3.5">รหัสคำสั่งซื้อ SO</th>
                  <th className="px-4 py-3.5">ล็อต & เบอร์ม้วน</th>
                  <th className="px-4 py-3.5">ลาย & ขนาด</th>
                  <th className="px-4 py-3.5 text-right">เมตรที่ใช้</th>
                  <th className="px-4 py-3.5 text-right">NG ที่เสีย</th>
                  <th className="px-4 py-3.5 text-right">รวมตัดออก</th>
                  <th className="px-4 py-3.5 text-right">คงเหลือหลังตัด</th>
                  <th className="px-4 py-3.5">วันที่ใช้งาน</th>
                  <th className="px-4 py-3.5">ผู้บันทึก</th>
                  <th className="px-4 py-3.5 text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRecords.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* SO Number with prominent styling */}
                    <td className="px-4 py-3.5">
                      <div className="font-mono font-black text-amber-900 text-sm bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 inline-block shadow-2xs">
                        {highlightMatch(item.soNumber, searchQuery)}
                      </div>
                      {item.notes && (
                        <div className="text-[11px] text-slate-500 mt-1 truncate max-w-[200px]" title={item.notes}>
                          {item.notes}
                        </div>
                      )}
                    </td>

                    {/* Lot & Roll - Enhanced Prominence */}
                    <td className="px-4 py-3.5">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-400 text-slate-950 font-black text-xs font-mono border border-amber-500 shadow-2xs">
                            #{highlightMatch(item.rollNumber, searchQuery)}
                          </span>
                        </div>
                        <div className="text-xs">
                          <span className="text-slate-400 mr-1">ล็อต:</span>
                          <span className="font-mono font-bold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                            {highlightMatch(item.lotNumber, searchQuery)}
                          </span>
                        </div>
                      </div>
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

                    {/* Recorded By with Highlight */}
                    <td className="px-4 py-3.5 text-xs text-slate-700">
                      <div className="flex items-center gap-1.5 font-medium">
                        <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate max-w-[140px]">
                          {highlightMatch(item.recordedBy, searchQuery)}
                        </span>
                      </div>
                    </td>

                    {/* Delete / Void Action */}
                    <td className="px-4 py-3.5 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          handleActionGuarded(() => {
                            if (
                              confirm(
                                `ต้องการยกเลิกรายการตัดสต๊อก ${item.soNumber} หรือไม่?\n(ระบบจะคืนยอด ${item.totalDeducted.toLocaleString()} เมตร กลับเข้าม้วน ${item.lotNumber} เบอร์ ${item.rollNumber} อัตโนมัติ)`
                              )
                            ) {
                              onDeleteRecord(item.id);
                            }
                          });
                        }}
                        title={
                          userMode === 'visitor'
                            ? 'ต้องปลดล็อคโหมดคีย์ข้อมูลก่อนยกเลิกรายการ'
                            : 'ยกเลิกรายการนี้และคืนยอดกลับม้วนฟอยล์'
                        }
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      >
                        {userMode === 'visitor' ? (
                          <Lock className="w-3.5 h-3.5 text-slate-300" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

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
      ) : (
        /* Date Folder Grouped View */
        <div className="space-y-3">
          {dateGroups.map((group) => {
            const isCollapsed = !!collapsedDates[group.date];
            return (
              <div
                key={group.date}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden transition-all"
              >
                {/* Folder Header */}
                <div
                  onClick={() => toggleDateCollapse(group.date)}
                  className="px-5 py-3.5 bg-slate-50/90 hover:bg-slate-100/80 cursor-pointer flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 select-none"
                >
                  <div className="flex items-center gap-2.5">
                    {isCollapsed ? (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-600" />
                    )}
                    <FolderOpen className="w-5 h-5 text-amber-500" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm sm:text-base">
                          {group.displayDate}
                        </span>
                        <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                          {group.records.length} รายการตัด
                        </span>
                        <span className="text-[11px] font-mono text-slate-500 hidden sm:inline">
                          ({group.soCount} รหัส SO)
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                        <span>SO: {group.uniqueSoList.slice(0, 5).join(', ')}{group.uniqueSoList.length > 5 ? '...' : ''}</span>
                      </div>
                    </div>
                  </div>

                  {/* Folder Summary & Export Button */}
                  <div className="flex items-center gap-4 self-end sm:self-auto font-mono text-xs">
                    <div className="text-right">
                      <span className="text-slate-400 block text-[10px]">ตัดใช้</span>
                      <span className="font-bold text-slate-900 text-sm">
                        {formatMeters(group.totalUsedMeters)} ม.
                      </span>
                    </div>
                    {group.totalNgMeters > 0 && (
                      <div className="text-right">
                        <span className="text-slate-400 block text-[10px]">NG</span>
                        <span className="font-bold text-rose-600 text-sm">
                          {formatMeters(group.totalNgMeters)} ม.
                        </span>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        exportCutsDateCSV(group.date, group.records);
                      }}
                      title="ดาวน์โหลด CSV สำหรับวันนี้"
                      className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 flex items-center gap-1 font-sans text-xs font-semibold cursor-pointer shadow-2xs"
                    >
                      <Download className="w-3.5 h-3.5 text-slate-500" />
                      <span className="hidden md:inline">CSV วันนี้</span>
                    </button>
                  </div>
                </div>

                {/* Folder Content Table */}
                {!isCollapsed && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50/50 text-slate-400 text-[11px] uppercase border-b border-slate-100 font-semibold">
                        <tr>
                          <th className="px-4 py-2.5">รหัส SO</th>
                          <th className="px-4 py-2.5">ล็อต & เบอร์ม้วน</th>
                          <th className="px-4 py-2.5">ลาย & ขนาด</th>
                          <th className="px-4 py-2.5 text-right">เมตรที่ใช้</th>
                          <th className="px-4 py-2.5 text-right">NG</th>
                          <th className="px-4 py-2.5 text-right">รวมตัดออก</th>
                          <th className="px-4 py-2.5">ผู้บันทึก</th>
                          <th className="px-4 py-2.5 text-center">จัดการ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {group.records.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="px-4 py-3">
                              <span className="font-mono font-bold text-amber-900 text-xs bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                {highlightMatch(item.soNumber, searchQuery)}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1.5 text-xs">
                                <span className="inline-flex items-center px-1.5 py-0.2 rounded bg-amber-400 text-slate-950 font-black font-mono text-[11px]">
                                  #{highlightMatch(item.rollNumber, searchQuery)}
                                </span>
                                <span className="font-mono text-slate-700">
                                  {highlightMatch(item.lotNumber, searchQuery)}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-xs">
                              <span className="font-medium text-slate-800">{item.pattern}</span>{' '}
                              <span className="text-slate-400 font-mono">({item.width} มม.)</span>
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 text-xs">
                              {formatMeters(item.usedMeters)} ม.
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-xs text-rose-600">
                              {item.ngMeters > 0 ? `${formatMeters(item.ngMeters)} ม.` : '-'}
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-bold text-amber-800 text-xs">
                              -{formatMeters(item.totalDeducted)} ม.
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-700">
                              <div className="flex items-center gap-1">
                                <User className="w-3 h-3 text-slate-400" />
                                <span>{highlightMatch(item.recordedBy, searchQuery)}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                type="button"
                                onClick={() => {
                                  handleActionGuarded(() => {
                                    if (
                                      confirm(
                                        `ต้องการยกเลิกรายการตัดสต๊อก ${item.soNumber} หรือไม่?\n(ระบบจะคืนยอด ${item.totalDeducted.toLocaleString()} เมตร กลับเข้าม้วน ${item.lotNumber} เบอร์ ${item.rollNumber} อัตโนมัติ)`
                                      )
                                    ) {
                                      onDeleteRecord(item.id);
                                    }
                                  });
                                }}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                                title="ยกเลิกรายการ"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
