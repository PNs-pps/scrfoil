import React, { useState, useEffect } from 'react';
import { PuSandwichCutRecord, SteelOriginType } from '../types';
import { getCurrentThaiYearBE2Digits, getCurrentMonth2Digits } from '../utils/soFormatter';
import { getRecentOperators, saveRecentOperator, exportPuSandwichRecordsToCSV } from '../utils/storage';
import { 
  X, 
  Layers, 
  PlusCircle, 
  Calendar, 
  User, 
  Scale, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle,
  History, 
  Download, 
  Trash2, 
  Search,
  Hash,
  Palette,
  Gauge,
  Factory
} from 'lucide-react';

interface PuSandwichModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveRecord?: (record: Omit<PuSandwichCutRecord, 'id' | 'createdAt'>) => Promise<void> | void;
  onSaveCut?: (record: PuSandwichCutRecord) => Promise<void> | void;
  records?: PuSandwichCutRecord[];
  onDeleteRecord?: (recordId: string) => Promise<void> | void;
  initialMode?: 'create' | 'history';
}

const COMMON_COIL_COLORS = ['สีขาว', 'สีดำ', 'สีน้ำตาล', 'สีเขียว', 'สีฟ้า', 'สีเทา', 'อลูซิงค์ (ซิงค์)'];
const COMMON_THICKNESSES = ['0.28', '0.30', '0.35', '0.40', '0.45', '0.50'];

export const PuSandwichModal: React.FC<PuSandwichModalProps> = ({
  isOpen,
  onClose,
  onSaveRecord,
  onSaveCut,
  records = [],
  onDeleteRecord,
  initialMode = 'create'
}) => {
  const [activeTab, setActiveTab] = useState<'create' | 'history'>(initialMode);
  const recentOperators = getRecentOperators();

  // Form State
  const [soNumber, setSoNumber] = useState('');
  const [productionDate, setProductionDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [coilColor, setCoilColor] = useState('');
  const [thickness, setThickness] = useState('');
  const [coilNumber, setCoilNumber] = useState('');
  const [weightBefore, setWeightBefore] = useState<string>('');
  const [weightAfter, setWeightAfter] = useState<string>('');
  const [ngKg, setNgKg] = useState<string>('0');
  const [ngMeters, setNgMeters] = useState<string>('0');
  const [steelOrigin, setSteelOrigin] = useState<SteelOriginType>('เหล็กนอก');
  const [customSteelOrigin, setCustomSteelOrigin] = useState('');
  const [lengthMeters, setLengthMeters] = useState<string>('');
  const [recordedBy, setRecordedBy] = useState(recentOperators[0] || '');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // History search state
  const [historySearch, setHistorySearch] = useState('');
  const [historySteelFilter, setHistorySteelFilter] = useState<string>('all');

  // Initialize SO number template when opening
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialMode);
      const yy = getCurrentThaiYearBE2Digits();
      const mm = getCurrentMonth2Digits();
      setSoNumber(`so${yy}${mm}`);
      setNgKg('0');
      setNgMeters('0');
      setError(null);
      if (!recordedBy && recentOperators.length > 0) {
        setRecordedBy(recentOperators[0]);
      }
    }
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  // Real-time calculation of used weight
  const numBefore = parseFloat(weightBefore) || 0;
  const numAfter = parseFloat(weightAfter) || 0;
  const calculatedUsed = (weightBefore !== '' && weightAfter !== '')
    ? Math.max(0, Math.round((numBefore - numAfter) * 100) / 100)
    : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validations
    if (!soNumber.trim()) {
      setError('กรุณาระบุรหัส SO');
      return;
    }
    if (!coilColor.trim()) {
      setError('กรุณาระบุสีคอล์ย');
      return;
    }
    if (!thickness.trim()) {
      setError('กรุณาระบุความหนา');
      return;
    }
    if (!coilNumber.trim()) {
      setError('กรุณาระบุเบอร์คอล์ย');
      return;
    }
    if (weightBefore === '' || numBefore <= 0) {
      setError('กรุณาระบุน้ำหนักก่อนใช้ (กก.) ให้ถูกต้องมากกว่า 0');
      return;
    }
    if (weightAfter === '' || numAfter < 0) {
      setError('กรุณาระบุน้ำหนักหลังใช้ (กก.) ให้ถูกต้อง');
      return;
    }
    if (numAfter > numBefore) {
      setError('น้ำหนักหลังใช้ไม่สามารถมากกว่าน้ำหนักก่อนใช้ได้');
      return;
    }
    if (steelOrigin === 'อื่นๆ' && !customSteelOrigin.trim()) {
      setError('กรุณาระบุรายละเอียดชนิดเหล็ก (กรณีเลือกอื่นๆ)');
      return;
    }

    const numNgKg = parseFloat(ngKg) || 0;
    const numNgMeters = parseFloat(ngMeters) || 0;
    if (numNgKg < 0) {
      setError('ยอด NG (กก.) ต้องไม่ติดลบ');
      return;
    }
    if (numNgMeters < 0) {
      setError('ยอด NG (เมตร) ต้องไม่ติดลบ');
      return;
    }
    if (numNgKg > calculatedUsed && calculatedUsed > 0) {
      setError('ยอด NG (กก.) ต้องไม่เกินน้ำหนักเหล็กที่ใช้จริง');
      return;
    }

    try {
      setIsSubmitting(true);
      if (recordedBy.trim()) {
        saveRecentOperator(recordedBy.trim());
      }

      const recordPayload = {
        soNumber: soNumber.trim(),
        productionDate,
        coilColor: coilColor.trim(),
        thickness: thickness.trim(),
        coilNumber: coilNumber.trim(),
        weightBefore: numBefore,
        weightAfter: numAfter,
        weightUsed: calculatedUsed,
        ngKg: numNgKg,
        ngMeters: numNgMeters,
        steelOrigin,
        customSteelOrigin: steelOrigin === 'อื่นๆ' ? customSteelOrigin.trim() : undefined,
        lengthMeters: lengthMeters ? parseFloat(lengthMeters) : undefined,
        recordedBy: recordedBy.trim() || 'ช่างคุมเครื่อง PU',
        notes: notes.trim() || undefined,
      };

      if (onSaveRecord) {
        await onSaveRecord(recordPayload);
      } else if (onSaveCut) {
        await onSaveCut({
          ...recordPayload,
          id: `pusw_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          createdAt: new Date().toISOString(),
        });
      }

      // Reset for next entry
      const yy = getCurrentThaiYearBE2Digits();
      const mm = getCurrentMonth2Digits();
      setSoNumber(`so${yy}${mm}`);
      setWeightBefore('');
      setWeightAfter('');
      setNgKg('0');
      setNgMeters('0');
      setNotes('');
      setLengthMeters('');
      // Switch to history or stay
      setActiveTab('history');
    } catch (err: any) {
      setError(err?.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Safe records array
  const safeRecords = Array.isArray(records) ? records : [];

  // Filtered History
  const filteredHistory = safeRecords.filter(r => {
    const matchesSearch = 
      !historySearch ||
      r.soNumber.toLowerCase().includes(historySearch.toLowerCase()) ||
      r.coilNumber.toLowerCase().includes(historySearch.toLowerCase()) ||
      r.coilColor.toLowerCase().includes(historySearch.toLowerCase()) ||
      (r.recordedBy || '').toLowerCase().includes(historySearch.toLowerCase());
    
    const matchesSteel = historySteelFilter === 'all' || r.steelOrigin === historySteelFilter;
    return matchesSearch && matchesSteel;
  });

  const totalWeightUsedAll = safeRecords.reduce((sum, r) => sum + (r.weightUsed || 0), 0);
  const totalNgKgAll = safeRecords.reduce((sum, r) => sum + (r.ngKg || 0), 0);
  const totalNgMetersAll = safeRecords.reduce((sum, r) => sum + (r.ngMeters || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-linear-to-r from-emerald-600 via-teal-700 to-slate-900 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20">
              <Factory className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold">ตัด SO ไม่ใช้ฟอยล์ (ผลิต PU Sandwich)</h2>
                <span className="text-[10px] bg-emerald-500/30 text-emerald-200 px-2 py-0.5 rounded-full border border-emerald-400/30 font-medium">
                  ฉีด PU แซนวิช
                </span>
              </div>
              <p className="text-xs text-emerald-100/80">
                บันทึกการตัดเหล็กคอล์ยสำหรับงานแซนวิชโดยไม่ตัดเบิกม้วนฟอยล์
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Tab switch buttons */}
            <div className="flex items-center bg-black/20 p-1 rounded-xl border border-white/10 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('create')}
                className={`px-3 py-1 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'create'
                    ? 'bg-white text-slate-900 font-bold shadow-xs'
                    : 'text-white/80 hover:text-white'
                }`}
              >
                <PlusCircle className="w-3.5 h-3.5" />
                คีย์ตัด SO
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className={`px-3 py-1 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'history'
                    ? 'bg-white text-slate-900 font-bold shadow-xs'
                    : 'text-white/80 hover:text-white'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                ประวัติย้อนหลัง ({records.length})
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/50">
          {activeTab === 'create' ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2.5 text-xs text-rose-800 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Top Row: SO Number & Production Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5 text-emerald-600" />
                    รหัสใบสั่งตัด (SO Number) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={soNumber}
                    onChange={(e) => setSoNumber(e.target.value.toLowerCase())}
                    placeholder="เช่น so6909001"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono font-bold text-slate-900 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all"
                    required
                  />
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    รูปแบบมาตรฐาน: so + ปี พ.ศ. 2 หลัก + เดือน 2 หลัก + ลำดับ
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                    วันที่ตัด / ผลิต <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={productionDate}
                    onChange={(e) => setProductionDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all"
                    required
                  />
                </div>
              </div>

              {/* 5 Input Fields as requested by user */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center text-xs font-black">
                      5
                    </span>
                    ช่องคีย์ข้อมูลคอล์ยเหล็ก & น้ำหนัก
                  </h3>
                  <span className="text-xs text-slate-500">สำหรับฉีด PU Sandwich (ไม่ใช้ฟอยล์)</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* 1. สีคอล์ย */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                      <Palette className="w-3.5 h-3.5 text-emerald-600" />
                      1. สีคอล์ย <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={coilColor}
                      onChange={(e) => setCoilColor(e.target.value)}
                      placeholder="เช่น สีขาว, สีดำ, สีน้ำตาล"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all"
                      required
                    />
                    {/* Quick color chips */}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {COMMON_COIL_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setCoilColor(c)}
                          className={`text-[10px] px-2 py-0.5 rounded-lg border cursor-pointer transition-colors ${
                            coilColor === c
                              ? 'bg-emerald-600 text-white border-emerald-600 font-bold'
                              : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 2. ความหนา */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                      <Gauge className="w-3.5 h-3.5 text-emerald-600" />
                      2. ความหนา (มม.) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={thickness}
                      onChange={(e) => setThickness(e.target.value)}
                      placeholder="เช่น 0.35, 0.40"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all"
                      required
                    />
                    {/* Quick thickness chips */}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {COMMON_THICKNESSES.map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setThickness(t)}
                          className={`text-[10px] px-2 py-0.5 rounded-lg border cursor-pointer transition-colors ${
                            thickness === t
                              ? 'bg-emerald-600 text-white border-emerald-600 font-bold'
                              : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                          }`}
                        >
                          {t} มม.
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 3. เบอร์คอล์ย */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                      <Hash className="w-3.5 h-3.5 text-emerald-600" />
                      3. เบอร์คอล์ย <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={coilNumber}
                      onChange={(e) => setCoilNumber(e.target.value)}
                      placeholder="เช่น COIL-01, C-6909-05"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono font-bold text-slate-900 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all"
                      required
                    />
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      เลขรหัสระบุประจำม้วนคอล์ยเหล็ก
                    </span>
                  </div>
                </div>

                {/* Weight Inputs: 4. น้ำหนักก่อนใช้ & 5. น้ำหนักหลังใช้ */}
                <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-200/80 mt-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 items-end">
                    {/* 4. น้ำหนักก่อนใช้ */}
                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
                        <Scale className="w-3.5 h-3.5 text-emerald-700" />
                        4. น้ำหนักก่อนใช้ (กก.) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={weightBefore}
                        onChange={(e) => setWeightBefore(e.target.value)}
                        placeholder="เช่น 2450.00"
                        className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-base font-mono font-bold text-slate-900 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200 outline-none transition-all"
                        required
                      />
                    </div>

                    {/* 5. น้ำหนักหลังใช้ */}
                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
                        <Scale className="w-3.5 h-3.5 text-emerald-700" />
                        5. น้ำหนักหลังใช้ (กก.) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={weightAfter}
                        onChange={(e) => setWeightAfter(e.target.value)}
                        placeholder="เช่น 2120.00"
                        className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-base font-mono font-bold text-slate-900 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200 outline-none transition-all"
                        required
                      />
                    </div>

                    {/* Auto Calculated Used Weight Result */}
                    <div className="bg-white p-3 rounded-xl border border-emerald-300 shadow-2xs">
                      <span className="text-[11px] font-semibold text-emerald-800 block">
                        น้ำหนักที่ใช้จริง (คำนวณอัตโนมัติ)
                      </span>
                      <div className="text-xl font-black font-mono text-emerald-700">
                        {calculatedUsed.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                        <span className="text-xs font-normal text-slate-500">กก.</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        (ก่อนใช้ - หลังใช้)
                      </span>
                    </div>
                  </div>
                </div>

                {/* ยอด NG ของ PU Sandwich: NG (กก.) และ NG (เมตร) */}
                <div className="p-4 bg-rose-50/70 rounded-2xl border border-rose-200/90 mt-3">
                  <div className="flex items-center justify-between mb-3 border-b border-rose-200/70 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-rose-600 text-white flex items-center justify-center text-xs font-black shadow-2xs">
                        NG
                      </span>
                      <h4 className="text-xs sm:text-sm font-bold text-rose-950 flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-rose-600" />
                        ยอด NG ของ PU Sandwich (ของเสีย/เศษหัวท้าย)
                      </h4>
                    </div>
                    <span className="text-[11px] text-rose-700 font-medium">
                      ถ้าไม่มีของเสีย ให้ใส่ 0
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* ยอด NG (กก.) */}
                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
                          ยอด NG (กก.)
                        </span>
                        <span className="text-[10px] text-slate-500 font-normal">เศษเหล็ก/โฟมเสีย</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={ngKg}
                        onChange={(e) => setNgKg(e.target.value)}
                        placeholder="0.00"
                        className="w-full px-3 py-2.5 bg-white border border-rose-300 rounded-xl text-base font-mono font-bold text-slate-900 focus:border-rose-500 focus:ring-2 focus:ring-rose-200 outline-none transition-all"
                      />
                      {/* Quick Chips for NG กก. */}
                      <div className="flex flex-wrap gap-1 mt-2">
                        {['0', '5', '10', '15', '20', '30'].map((chip) => (
                          <button
                            key={chip}
                            type="button"
                            onClick={() => setNgKg(chip)}
                            className={`text-[10px] px-2 py-0.5 rounded-lg border cursor-pointer transition-colors ${
                              ngKg === chip
                                ? 'bg-rose-600 text-white border-rose-600 font-bold'
                                : 'bg-white text-slate-600 border-rose-200 hover:bg-rose-100'
                            }`}
                          >
                            {chip} กก.
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* ยอด NG (เมตร) */}
                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
                          ยอด NG (เมตร)
                        </span>
                        <span className="text-[10px] text-slate-500 font-normal">ความยาวแผ่นที่เสีย</span>
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={ngMeters}
                        onChange={(e) => setNgMeters(e.target.value)}
                        placeholder="0.0"
                        className="w-full px-3 py-2.5 bg-white border border-rose-300 rounded-xl text-base font-mono font-bold text-slate-900 focus:border-rose-500 focus:ring-2 focus:ring-rose-200 outline-none transition-all"
                      />
                      {/* Quick Chips for NG เมตร */}
                      <div className="flex flex-wrap gap-1 mt-2">
                        {['0', '1', '2', '3', '5', '10'].map((chip) => (
                          <button
                            key={chip}
                            type="button"
                            onClick={() => setNgMeters(chip)}
                            className={`text-[10px] px-2 py-0.5 rounded-lg border cursor-pointer transition-colors ${
                              ngMeters === chip
                                ? 'bg-rose-600 text-white border-rose-600 font-bold'
                                : 'bg-white text-slate-600 border-rose-200 hover:bg-rose-100'
                            }`}
                          >
                            {chip} ม.
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 1 Choice / Selection Field: 1. เหล็กนอก, 2. เหล็กBlue Scope, 3. อื่นๆ */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-teal-100 text-teal-800 flex items-center justify-center text-xs font-black">
                      1
                    </span>
                    ช่องตัวเลือกชนิดเหล็ก (แหล่งที่มา) <span className="text-rose-500">*</span>
                  </h3>
                  <span className="text-xs text-slate-500">เลือก 1 รายการ</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  {/* Choice 1: เหล็กนอก */}
                  <label
                    className={`flex items-center gap-3 p-3.5 rounded-2xl border cursor-pointer transition-all ${
                      steelOrigin === 'เหล็กนอก'
                        ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-200 shadow-2xs'
                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <input
                      type="radio"
                      name="steelOrigin"
                      checked={steelOrigin === 'เหล็กนอก'}
                      onChange={() => setSteelOrigin('เหล็กนอก')}
                      className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <span className="text-sm font-bold text-slate-900 block">1. เหล็กนอก</span>
                      <span className="text-[11px] text-slate-500">เหล็กนำเข้าต่างประเทศ</span>
                    </div>
                  </label>

                  {/* Choice 2: เหล็กBlue Scope */}
                  <label
                    className={`flex items-center gap-3 p-3.5 rounded-2xl border cursor-pointer transition-all ${
                      steelOrigin === 'เหล็กBlue Scope'
                        ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-200 shadow-2xs'
                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <input
                      type="radio"
                      name="steelOrigin"
                      checked={steelOrigin === 'เหล็กBlue Scope'}
                      onChange={() => setSteelOrigin('เหล็กBlue Scope')}
                      className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <span className="text-sm font-bold text-slate-900 block">2. เหล็กBlue Scope</span>
                      <span className="text-[11px] text-slate-500">BlueScope มาตรฐานสูง</span>
                    </div>
                  </label>

                  {/* Choice 3: อื่นๆ */}
                  <label
                    className={`flex items-center gap-3 p-3.5 rounded-2xl border cursor-pointer transition-all ${
                      steelOrigin === 'อื่นๆ'
                        ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-200 shadow-2xs'
                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <input
                      type="radio"
                      name="steelOrigin"
                      checked={steelOrigin === 'อื่นๆ'}
                      onChange={() => setSteelOrigin('อื่นๆ')}
                      className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <span className="text-sm font-bold text-slate-900 block">3. อื่นๆ</span>
                      <span className="text-[11px] text-slate-500">ระบุรายละเอียดเพิ่มเติม</span>
                    </div>
                  </label>
                </div>

                {/* Sub input if Other is selected */}
                {steelOrigin === 'อื่นๆ' && (
                  <div className="pt-2 animate-in fade-in">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      โปรดระบุชนิดเหล็กอื่นๆ:
                    </label>
                    <input
                      type="text"
                      value={customSteelOrigin}
                      onChange={(e) => setCustomSteelOrigin(e.target.value)}
                      placeholder="เช่น เหล็กในประเทศ, เหล็กคอยล์พิเศษ..."
                      className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-xl text-sm font-medium text-slate-900 focus:ring-2 focus:ring-emerald-200 outline-none"
                      required
                    />
                  </div>
                )}
              </div>

              {/* Extra details: Length produced, Operator, Notes */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ความยาวที่ผลิตได้ (เมตร) <span className="text-slate-400 font-normal">(ถ้ามี)</span>
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={lengthMeters}
                    onChange={(e) => setLengthMeters(e.target.value)}
                    placeholder="เช่น 150.5"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:border-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-slate-500" />
                    ผู้บันทึก <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={recordedBy}
                    onChange={(e) => setRecordedBy(e.target.value)}
                    placeholder="ชื่อช่างคุมเครื่อง"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:border-emerald-500 outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    หมายเหตุ
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="รายละเอียดเพิ่มเติม (ถ้ามี)"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:border-emerald-500 outline-none"
                  />
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-xl bg-linear-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {isSubmitting ? 'กำลังบันทึก...' : 'บันทึกตัด SO แซนวิช (ไม่ใช้ฟอยล์)'}
                </button>
              </div>
            </form>
          ) : (
            /* Tab: History View (เรียกดูรายการย้อนหลังได้) */
            <div className="space-y-4">
              {/* History Toolbar & Stats */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200">
                <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={historySearch}
                      onChange={(e) => setHistorySearch(e.target.value)}
                      placeholder="ค้นหา SO, เบอร์คอล์ย, สี, ผู้บันทึก..."
                      className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 outline-none"
                    />
                  </div>

                  <select
                    value={historySteelFilter}
                    onChange={(e) => setHistorySteelFilter(e.target.value)}
                    className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 font-medium text-slate-700 outline-none cursor-pointer"
                  >
                    <option value="all">ชนิดเหล็กทั้งหมด</option>
                    <option value="เหล็กนอก">เหล็กนอก</option>
                    <option value="เหล็กBlue Scope">เหล็กBlue Scope</option>
                    <option value="อื่นๆ">อื่นๆ</option>
                  </select>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="px-3 py-1.5 bg-emerald-50 rounded-xl border border-emerald-200 text-xs font-mono">
                    <span className="text-slate-500">รวมใช้น้ำหนัก: </span>
                    <strong className="text-emerald-700 font-bold">
                      {totalWeightUsedAll.toLocaleString('th-TH', { minimumFractionDigits: 2 })} กก.
                    </strong>
                  </div>

                  <div className="px-3 py-1.5 bg-rose-50 rounded-xl border border-rose-200 text-xs font-mono">
                    <span className="text-rose-600 font-semibold">รวม NG: </span>
                    <strong className="text-rose-700 font-bold">
                      {totalNgKgAll.toLocaleString('th-TH', { minimumFractionDigits: 2 })} กก.
                    </strong>
                    {totalNgMetersAll > 0 && (
                      <span className="text-rose-600 text-[11px] ml-1">
                        ({totalNgMetersAll.toLocaleString('th-TH', { minimumFractionDigits: 1 })} ม.)
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => exportPuSandwichRecordsToCSV(records)}
                    disabled={records.length === 0}
                    className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium flex items-center gap-1.5 cursor-pointer disabled:opacity-40 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    ส่งออก CSV
                  </button>
                </div>
              </div>

              {/* Records Table */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
                {filteredHistory.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-xs">
                    <Layers className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    ไม่พบรายการตัด SO ผลิต PU Sandwich
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
                        <tr>
                          <th className="py-2.5 px-3">รหัส SO</th>
                          <th className="py-2.5 px-3">วันที่</th>
                          <th className="py-2.5 px-3">สีคอล์ย</th>
                          <th className="py-2.5 px-3">ความหนา</th>
                          <th className="py-2.5 px-3">เบอร์คอล์ย</th>
                          <th className="py-2.5 px-3">ชนิดเหล็ก</th>
                          <th className="py-2.5 px-3 text-right">ก่อนใช้ (กก.)</th>
                          <th className="py-2.5 px-3 text-right">หลังใช้ (กก.)</th>
                          <th className="py-2.5 px-3 text-right font-bold text-emerald-800">ใช้จริง (กก.)</th>
                          <th className="py-2.5 px-3 text-right text-rose-700 font-bold">NG (กก.)</th>
                          <th className="py-2.5 px-3 text-right text-rose-700 font-bold">NG (ม.)</th>
                          <th className="py-2.5 px-3">ผู้บันทึก</th>
                          <th className="py-2.5 px-3 text-center">จัดการ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono">
                        {filteredHistory.map((rec) => (
                          <tr key={rec.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-2.5 px-3 font-bold text-slate-900">{rec.soNumber}</td>
                            <td className="py-2.5 px-3 font-sans text-slate-600">{rec.productionDate}</td>
                            <td className="py-2.5 px-3 font-sans">
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 text-[11px] font-medium border border-slate-200">
                                {rec.coilColor}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-700">{rec.thickness} มม.</td>
                            <td className="py-2.5 px-3 font-bold text-slate-800">{rec.coilNumber}</td>
                            <td className="py-2.5 px-3 font-sans">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                                  rec.steelOrigin === 'เหล็กBlue Scope'
                                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                                    : rec.steelOrigin === 'เหล็กนอก'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-amber-50 text-amber-700 border-amber-200'
                                }`}
                              >
                                {rec.steelOrigin}
                                {rec.customSteelOrigin ? ` (${rec.customSteelOrigin})` : ''}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right text-slate-600">
                              {rec.weightBefore.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-2.5 px-3 text-right text-slate-600">
                              {rec.weightAfter.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-2.5 px-3 text-right font-black text-emerald-600">
                              {rec.weightUsed.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              {(rec.ngKg || 0) > 0 ? (
                                <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 font-bold text-[11px]">
                                  {rec.ngKg?.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                                </span>
                              ) : (
                                <span className="text-slate-400 text-[11px]">0.00</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              {(rec.ngMeters || 0) > 0 ? (
                                <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 font-bold text-[11px]">
                                  {rec.ngMeters?.toLocaleString('th-TH', { minimumFractionDigits: 1 })}
                                </span>
                              ) : (
                                <span className="text-slate-400 text-[11px]">0.0</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 font-sans text-slate-600 text-[11px]">
                              {rec.recordedBy}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {onDeleteRecord && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (window.confirm(`ยืนยันการลบรายการตัด SO ${rec.soNumber}?`)) {
                                      onDeleteRecord(rec.id);
                                    }
                                  }}
                                  className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                  title="ลบรายการ"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
