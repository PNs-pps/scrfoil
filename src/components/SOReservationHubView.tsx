import React, { useState, useMemo } from 'react';
import { FoilRoll, StockCutRecord } from '../types';
import { formatMeters, formatThaiDate } from '../utils/formatters';
import { calculateRollReservationMetrics } from '../utils/reservationHelpers';
import { FoilStatusTube } from './FoilStatusTube';
import { getPatternStyle } from '../utils/patternStyles';
import {
  CalendarClock,
  CheckCircle2,
  Package,
  Scissors,
  Search,
  Filter,
  PlusCircle,
  RefreshCw,
  Ban,
  Clock,
  Layers,
  ChevronRight,
  User,
  ArrowRight
} from 'lucide-react';

interface SOReservationHubViewProps {
  rolls: FoilRoll[];
  records: StockCutRecord[];
  onOpenCutModal: (rollId?: string) => void;
  onConfirmProduction: (recordId: string, soNumber: string) => Promise<void> | void;
  onOpenReallocateModal: (record: StockCutRecord) => void;
  onOpenCancelModal: (record: StockCutRecord) => void;
  onViewSODetail?: (record: StockCutRecord) => void;
}

export const SOReservationHubView: React.FC<SOReservationHubViewProps> = ({
  rolls,
  records,
  onOpenCutModal,
  onConfirmProduction,
  onOpenReallocateModal,
  onOpenCancelModal,
  onViewSODetail,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'queue' | 'rolls' | 'completed'>('queue');
  const [searchQuery, setSearchQuery] = useState('');
  const [processingRecordId, setProcessingRecordId] = useState<string | null>(null);

  // แยกรายการตามสถานะ
  const reservedRecords = useMemo(() => {
    return records
      .filter((r) => r.cutStatus === 'reserved')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [records]);

  const completedRecords = useMemo(() => {
    return records
      .filter((r) => !r.cutStatus || r.cutStatus === 'completed')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [records]);

  // สถิติภาพรวม
  const totalReservedMeters = useMemo(() => {
    return reservedRecords.reduce(
      (sum, r) => sum + (Number(r.usedMeters) || 0) + (Number(r.ngMeters) || 0),
      0
    );
  }, [reservedRecords]);

  const totalCompletedMeters = useMemo(() => {
    return completedRecords.reduce(
      (sum, r) => sum + (Number(r.usedMeters) || 0) + (Number(r.ngMeters) || 0),
      0
    );
  }, [completedRecords]);

  // ม้วนฟอยล์ที่มีการจอง
  const rollsWithReservations = useMemo(() => {
    return rolls
      .map((roll) => ({
        roll,
        metrics: calculateRollReservationMetrics(roll, records),
      }))
      .filter((item) => item.metrics.reservedMeters > 0)
      .sort((a, b) => b.metrics.reservedMeters - a.metrics.reservedMeters);
  }, [rolls, records]);

  // กรองรายการตามคำค้นหา
  const filteredQueueRecords = useMemo(() => {
    if (!searchQuery.trim()) return reservedRecords;
    const q = searchQuery.toLowerCase().trim();
    return reservedRecords.filter(
      (r) =>
        r.soNumber.toLowerCase().includes(q) ||
        r.lotNumber.toLowerCase().includes(q) ||
        r.rollNumber.toLowerCase().includes(q) ||
        (r.recordedBy && r.recordedBy.toLowerCase().includes(q))
    );
  }, [reservedRecords, searchQuery]);

  const filteredCompletedRecords = useMemo(() => {
    if (!searchQuery.trim()) return completedRecords.slice(0, 50);
    const q = searchQuery.toLowerCase().trim();
    return completedRecords
      .filter(
        (r) =>
          r.soNumber.toLowerCase().includes(q) ||
          r.lotNumber.toLowerCase().includes(q) ||
          r.rollNumber.toLowerCase().includes(q) ||
          (r.recordedBy && r.recordedBy.toLowerCase().includes(q))
      )
      .slice(0, 50);
  }, [completedRecords, searchQuery]);

  const handleQuickConfirm = async (record: StockCutRecord) => {
    try {
      setProcessingRecordId(record.id);
      await onConfirmProduction(record.id, record.soNumber);
    } catch (err) {
      console.error('Error confirming production:', err);
    } finally {
      setProcessingRecordId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-2 sm:px-4 py-4 pb-20">
      {/* Header & Quick Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-amber-500 text-slate-950 rounded-xl shadow-xs">
              <CalendarClock className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight">
                ระบบจองม้วนและคิวผลิต SO
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                จัดการคิวรอตัดฟอยล์ ยืนยันผลิตจริง สลับเปลี่ยนม้วน และติดตามหลอดสถานะ 3 สีแบบเรียลไทม์
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onOpenCutModal()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs sm:text-sm transition-all shadow-xs cursor-pointer active:scale-95"
          >
            <PlusCircle className="w-4 h-4" />
            <span>สร้างคิวจอง / ตัดฟอยล์ SO</span>
          </button>
        </div>
      </div>

      {/* KPI Cards: จองรอตัด / ผลิตแล้ว / ม้วนที่มีการจอง */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* คิวรอตัด (สีเหลือง) */}
        <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-amber-600" />
              คิว SO รอตัด (จองฟอยล์)
            </span>
            <div className="text-2xl font-black text-amber-950 font-mono mt-1">
              {reservedRecords.length}{' '}
              <span className="text-xs font-normal text-amber-800">รายการ</span>
            </div>
            <div className="text-xs text-amber-900/80 mt-0.5 font-mono">
              รวมจอง {formatMeters(totalReservedMeters)} เมตร
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-amber-400 text-slate-950 text-xs font-bold font-mono">
            🟡 รอตัด
          </span>
        </div>

        {/* ม้วนที่มีการจอง */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
              <Package className="w-4 h-4 text-slate-500" />
              ม้วนฟอยล์ที่มีการจองคิว
            </span>
            <div className="text-2xl font-black text-slate-900 font-mono mt-1">
              {rollsWithReservations.length}{' '}
              <span className="text-xs font-normal text-slate-500">ม้วน</span>
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              จากทั้งหมด {rolls.length} ม้วนในคลัง
            </div>
          </div>
          <span className="p-2 bg-slate-200 text-slate-700 rounded-xl">
            <Layers className="w-4 h-4" />
          </span>
        </div>

        {/* ผลิตเสร็จสิ้นแล้ว (สีเขียว) */}
        <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ผลิตจริงแล้ว (ตัดเสร็จ)
            </span>
            <div className="text-2xl font-black text-emerald-950 font-mono mt-1">
              {completedRecords.length}{' '}
              <span className="text-xs font-normal text-emerald-800">รายการ</span>
            </div>
            <div className="text-xs text-emerald-900/80 mt-0.5 font-mono">
              รวมผลิต {formatMeters(totalCompletedMeters)} เมตร
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-emerald-500 text-white text-xs font-bold font-mono">
            🟢 ตัดจริง
          </span>
        </div>
      </div>

      {/* Tabs & Search Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveSubTab('queue')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'queue'
                ? 'bg-white text-slate-950 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span>คิว SO รอตัด ({reservedRecords.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('rolls')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'rolls'
                ? 'bg-white text-slate-950 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-amber-600" />
            <span>สถานะม้วนและการจอง ({rollsWithReservations.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('completed')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'completed'
                ? 'bg-white text-slate-950 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>ผลิตจริงแล้ว ({completedRecords.length})</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหา SO, ล็อต, เบอร์ม้วน..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-white"
          />
        </div>
      </div>

      {/* SUBTAB 1: คิว SO รอตัด (Active Queue) */}
      {activeSubTab === 'queue' && (
        <div className="space-y-3">
          {filteredQueueRecords.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-slate-200/80 p-6">
              <Clock className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-700">ไม่มีคิว SO รอตัดในขณะนี้</h3>
              <p className="text-xs text-slate-500 mt-1">
                สร้างรายการ SO ใหม่และเลือก "จองรอตัด" เพื่อเพิ่มลงในคิวผลิต
              </p>
              <button
                type="button"
                onClick={() => onOpenCutModal()}
                className="mt-4 px-4 py-2 bg-amber-500 text-slate-950 font-bold text-xs rounded-xl hover:bg-amber-600 transition-colors shadow-xs"
              >
                + สร้างคิวจอง SO ใหม่
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredQueueRecords.map((record, idx) => {
                const roll = rolls.find((r) => r.id === record.foilId);
                const totalMeters = (Number(record.usedMeters) || 0) + (Number(record.ngMeters) || 0);
                const isProcessing = processingRecordId === record.id;
                const patternStyle = getPatternStyle(record.pattern);

                return (
                  <div
                    key={record.id}
                    className="bg-white rounded-2xl border border-amber-200/90 shadow-2xs hover:shadow-xs transition-all p-4 space-y-3 relative overflow-hidden"
                  >
                    {/* Top Stripe */}
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold">
                          #{idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => onViewSODetail && onViewSODetail(record)}
                          className="font-mono font-black text-sm text-slate-950 hover:text-amber-600 transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <span>{record.soNumber}</span>
                          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                        </button>
                      </div>

                      <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-950 border border-amber-300 text-xs font-bold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                        รอตัด (จอง)
                      </span>
                    </div>

                    {/* Foil Spec & Tube */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 block">ม้วนฟอยล์ที่จอง</span>
                        <span className="font-mono font-bold text-slate-900">
                          LOT {record.lotNumber} #{record.rollNumber}
                        </span>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <span>กว้าง {record.width} มม.</span>
                          <span>·</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${patternStyle.badgeClass}`}>
                            {record.pattern}
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block">ยอดตัด + NG หัวท้าย</span>
                        <div className="font-mono font-black text-amber-950 text-base">
                          {formatMeters(totalMeters)}{' '}
                          <span className="text-xs font-normal text-slate-500">ม.</span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          (ใช้ {formatMeters(record.usedMeters)} + NG {formatMeters(record.ngMeters)})
                        </div>
                      </div>
                    </div>

                    {/* Timeline Tube for the Roll */}
                    {roll && (
                      <div className="bg-slate-50/80 p-2.5 rounded-xl border border-slate-200/80">
                        <span className="text-[10px] font-bold text-slate-500 block mb-1">
                          สถานะม้วน LOT {roll.lotNumber} #{roll.rollNumber}:
                        </span>
                        <FoilStatusTube roll={roll} records={records} size="sm" showStats={true} />
                      </div>
                    )}

                    {/* Recorder & Date */}
                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3 text-slate-400" />
                        {record.recordedBy || 'ไม่ระบุผู้บันทึก'}
                      </span>
                      <span>วันที่จอง: {formatThaiDate(record.usageDate || record.recordedDate)}</span>
                    </div>

                    {/* Action Buttons: 1. Confirm Production (Green) / 2. Change Roll / 3. Cancel */}
                    <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-slate-100">
                      {/* ปุ่ม 1: ยืนยันผลิตจริงแล้ว */}
                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={() => handleQuickConfirm(record)}
                        title="กดยืนยันว่าตัดและผลิตจริงแล้ว เพื่อหักสต๊อกฟอยล์"
                        className="py-2 px-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-[11px] sm:text-xs transition-all shadow-2xs flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50 col-span-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{isProcessing ? 'กำลังยืนยัน...' : 'ยืนยันผลิตจริง'}</span>
                      </button>

                      {/* ปุ่ม 2: เปลี่ยนฟอยล์ */}
                      <button
                        type="button"
                        onClick={() => onOpenReallocateModal(record)}
                        title="สลับเปลี่ยนม้วนฟอยล์ที่จองไว้"
                        className="py-2 px-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 active:scale-95 text-amber-950 font-bold text-[11px] sm:text-xs transition-all border border-amber-300 flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3 text-amber-700" />
                        <span>เปลี่ยนฟอยล์</span>
                      </button>

                      {/* ปุ่ม 3: ยกเลิกการผลิต */}
                      <button
                        type="button"
                        onClick={() => onOpenCancelModal(record)}
                        title="ยกเลิกคิวจองและคืนยอดเมตรกลับม้วน"
                        className="py-2 px-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 active:scale-95 text-rose-800 font-bold text-[11px] sm:text-xs transition-all border border-rose-200 flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Ban className="w-3 h-3 text-rose-600" />
                        <span>ยกเลิกผลิต</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 2: สถานะม้วนฟอยล์ & คิวการจอง (Roll Allocation) */}
      {activeSubTab === 'rolls' && (
        <div className="space-y-3">
          {rollsWithReservations.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-slate-200/80 p-6">
              <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-700">ไม่มีม้วนฟอยล์ที่ติดคิวจองในขณะนี้</h3>
              <p className="text-xs text-slate-500 mt-1">
                ม้วนฟอยล์ทุกม้วนว่างพร้อมใช้งาน 100%
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {rollsWithReservations.map(({ roll, metrics }) => {
                const rollReservations = reservedRecords.filter((r) => r.foilId === roll.id);
                const patternStyle = getPatternStyle(roll.pattern);

                return (
                  <div
                    key={roll.id}
                    className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 shadow-2xs"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-mono font-bold text-sm text-slate-900">
                          LOT {roll.lotNumber} #{roll.rollNumber}
                        </span>
                        <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                          <span>กว้าง {roll.width} มม.</span>
                          <span>·</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${patternStyle.badgeClass}`}>
                            {roll.pattern}
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-mono font-bold text-amber-900 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                          จอง {formatMeters(metrics.reservedMeters)} ม. ({rollReservations.length} คิว)
                        </span>
                      </div>
                    </div>

                    {/* หลอดไทม์ไลน์สถานะ 3 สี */}
                    <FoilStatusTube roll={roll} records={records} size="md" showStats={true} />

                    {/* รายการ SO ที่จองในม้วนนี้ */}
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/70">
                      <span className="text-[10px] font-bold text-slate-500 block mb-1">
                        คิว SO ที่รอตัดในม้วนนี้:
                      </span>
                      <div className="space-y-1">
                        {rollReservations.map((r) => (
                          <div
                            key={r.id}
                            className="flex items-center justify-between text-xs py-1 px-1.5 rounded hover:bg-white transition-colors"
                          >
                            <span className="font-mono font-bold text-slate-900">
                              {r.soNumber}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-amber-900 font-semibold text-[11px]">
                                {formatMeters((Number(r.usedMeters) || 0) + (Number(r.ngMeters) || 0))} ม.
                              </span>
                              <button
                                type="button"
                                onClick={() => handleQuickConfirm(r)}
                                className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 hover:bg-emerald-200 transition-colors"
                              >
                                ยืนยันผลิต
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 3: ผลิตจริงแล้ว (Completed Production) */}
      {activeSubTab === 'completed' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">รหัส SO</th>
                  <th className="py-2.5 px-3">ม้วนฟอยล์</th>
                  <th className="py-2.5 px-3 text-right">ตัดใช้ (ม.)</th>
                  <th className="py-2.5 px-3 text-right">NG หัวท้าย (ม.)</th>
                  <th className="py-2.5 px-3 text-right">ยอดรวม (ม.)</th>
                  <th className="py-2.5 px-3">วันที่ / ผู้บันทึก</th>
                  <th className="py-2.5 px-3 text-center">สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCompletedRecords.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                      <button
                        type="button"
                        onClick={() => onViewSODetail && onViewSODetail(r)}
                        className="hover:text-amber-600 transition-colors"
                      >
                        {r.soNumber}
                      </button>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="font-mono font-bold text-slate-800">
                        LOT {r.lotNumber} #{r.rollNumber}
                      </span>
                      <span className="text-[11px] text-slate-500 ml-1">
                        ({r.width} มม. · {r.pattern})
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                      {formatMeters(r.usedMeters)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-rose-600 font-medium">
                      {formatMeters(r.ngMeters)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-black text-emerald-700">
                      {formatMeters((Number(r.usedMeters) || 0) + (Number(r.ngMeters) || 0))}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500">
                      <div>{formatThaiDate(r.usageDate || r.recordedDate)}</div>
                      <div className="text-[10px] text-slate-400">{r.recordedBy}</div>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold text-[10px]">
                        🟢 ตัดจริง
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
