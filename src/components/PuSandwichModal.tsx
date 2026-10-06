import React, { useState, useEffect } from 'react';
import { confirmAction } from '../utils/confirmAction';
import { useModalA11y } from '../hooks/useModalA11y';
import { todayLocalISO } from '../utils/formatters';
import { PuSandwichCutRecord, SteelOriginType } from '../types';
import { getCurrentThaiYearBE2Digits, getCurrentMonth2Digits } from '../utils/soFormatter';
import { getRecentOperators, saveRecentOperator, exportPuSandwichRecordsToCSV } from '../utils/storage';
import { isStaffEmail, getStaffEmails } from '../utils/auth';
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
  Factory,
  Ruler,
  RotateCcw,
  Sparkles,
  ShieldAlert,
  Lock
} from 'lucide-react';
import { 
  COMMON_THICKNESSES,
  FACTORY_THICKNESS_SPECS, 
  getSteelKgPerMeter 
} from '../utils/steelCalculations';

interface PuSandwichModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveRecord?: (record: Omit<PuSandwichCutRecord, 'id' | 'createdAt'>) => Promise<void> | void;
  onSaveCut?: (record: PuSandwichCutRecord) => Promise<void> | void;
  records?: PuSandwichCutRecord[];
  onDeleteRecord?: (recordId: string) => Promise<void> | void;
  initialMode?: 'create' | 'history';
  editingRecord?: PuSandwichCutRecord | null;
  currentUserEmail?: string | null;
}

const COMMON_COIL_COLORS = ['สีขาว', 'สีดำ', 'สีน้ำตาล', 'สีเขียว', 'สีฟ้า', 'สีเทา', 'อลูซิงค์ (ซิงค์)'];

export const PuSandwichModal: React.FC<PuSandwichModalProps> = ({
  isOpen,
  onClose,
  onSaveRecord,
  onSaveCut,
  records = [],
  onDeleteRecord,
  initialMode = 'create',
  editingRecord = null,
  currentUserEmail,
}) => {
  const isStaff = isStaffEmail(currentUserEmail);
  const [activeTab, setActiveTab] = useState<'create' | 'history'>(initialMode);
  const panelRef = useModalA11y(isOpen, onClose, 'บันทึกการตัดสต๊อกแซนวิช');
  const recentOperators = getRecentOperators();

  // Form State
  const [soNumber, setSoNumber] = useState('');
  const [productionDate, setProductionDate] = useState(() => todayLocalISO());
  const [soLengthMeters, setSoLengthMeters] = useState<string>('');
  const [coilColor, setCoilColor] = useState('');
  const [thickness, setThickness] = useState('0.35');
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
  const [isNgManuallyEdited, setIsNgManuallyEdited] = useState(false);
  const [customKgPerMeter, setCustomKgPerMeter] = useState<string>('');
  const [showCustomFactor, setShowCustomFactor] = useState(false);
  /** หน้าต่างยืนยันก่อนบันทึกตัดแซนวิช */
  const [showConfirmSummary, setShowConfirmSummary] = useState(false);

  // History search state
  const [historySearch, setHistorySearch] = useState('');
  const [historySteelFilter, setHistorySteelFilter] = useState<string>('all');

  // เปิดฟอร์ม: สร้างใหม่ หรือโหลดรายการแก้ไข
  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setCustomKgPerMeter('');
    setShowCustomFactor(false);
    setShowConfirmSummary(false);
    setIsSubmitting(false);

    if (editingRecord) {
      setActiveTab('create');
      setSoNumber(editingRecord.soNumber || '');
      setProductionDate(editingRecord.productionDate || todayLocalISO());
      setSoLengthMeters(
        editingRecord.soLengthMeters != null ? String(editingRecord.soLengthMeters) : ''
      );
      setCoilColor(editingRecord.coilColor || '');
      setThickness(editingRecord.thickness || '0.35');
      setCoilNumber(editingRecord.coilNumber || '');
      setWeightBefore(
        editingRecord.weightBefore != null ? String(editingRecord.weightBefore) : ''
      );
      setWeightAfter(
        editingRecord.weightAfter != null ? String(editingRecord.weightAfter) : ''
      );
      setNgKg(editingRecord.ngKg != null ? String(editingRecord.ngKg) : '0');
      setNgMeters(editingRecord.ngMeters != null ? String(editingRecord.ngMeters) : '0');
      setSteelOrigin(editingRecord.steelOrigin || 'เหล็กนอก');
      setCustomSteelOrigin(editingRecord.customSteelOrigin || '');
      setLengthMeters(
        editingRecord.lengthMeters != null ? String(editingRecord.lengthMeters) : ''
      );
      setRecordedBy(editingRecord.recordedBy || recentOperators[0] || '');
      setNotes(editingRecord.notes || '');
      setIsNgManuallyEdited(true);
      return;
    }

    setActiveTab(initialMode);
    const yy = getCurrentThaiYearBE2Digits();
    const mm = getCurrentMonth2Digits();
    setSoNumber(`so${yy}${mm}`);
    setProductionDate(todayLocalISO());
    setNgKg('0');
    setNgMeters('0');
    setSoLengthMeters('');
    setThickness('0.35');
    setIsNgManuallyEdited(false);
    setCoilColor('');
    setCoilNumber('');
    setWeightBefore('');
    setWeightAfter('');
    setNotes('');
    setLengthMeters('');
    if (!recordedBy && recentOperators.length > 0) {
      setRecordedBy(recentOperators[0]);
    }
  }, [isOpen, initialMode, editingRecord]);

  // Helper function to safely parse numbers with comma support (e.g. "2,450.50")
  const parseCleanNum = (val: string | number | undefined | null): number => {
    if (val == null) return 0;
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    const cleaned = String(val).replace(/,/g, '').trim();
    const n = parseFloat(cleaned);
    return isNaN(n) ? 0 : n;
  };

  // Weight per meter from thickness according to factory standards:
  // 0.30 -> 2.1 kg/m, 0.35 -> 2.3 kg/m, 0.40 -> 2.7 kg/m, 0.47 -> 3.1 kg/m, 0.51 -> 3.2 kg/m
  const standardKgPerMeter = getSteelKgPerMeter(thickness || '0.35');

  const customRateNum = parseCleanNum(customKgPerMeter);
  const effectiveKgPerMeter = customRateNum > 0
    ? customRateNum
    : standardKgPerMeter;

  const numSoLength = parseCleanNum(soLengthMeters);

  // Real-time calculation of used weight (น้ำหนักขึ้น - ลง)
  const numBefore = parseCleanNum(weightBefore);
  const numAfter = parseCleanNum(weightAfter);
  const calculatedUsed = (weightBefore !== '' && weightAfter !== '')
    ? Math.max(0, Math.round((numBefore - numAfter) * 100) / 100)
    : 0;

  // Auto-calculated theoretical SO steel weight (กก.)
  const theoreticalSoWeight = numSoLength > 0
    ? Math.round(numSoLength * effectiveKgPerMeter * 100) / 100
    : 0;

  // Auto-calculated ตัดตก / NG (กก.) = น้ำหนักขึ้น-ลง - น้ำหนักงาน SO
  const autoCalculatedNgKg = (calculatedUsed > 0 && numSoLength > 0)
    ? Math.max(0, Math.round((calculatedUsed - theoreticalSoWeight) * 100) / 100)
    : 0;

  // Auto-calculated ตัดตก / NG (เมตร) = autoCalculatedNgKg / effectiveKgPerMeter
  const autoCalculatedNgMeters = (effectiveKgPerMeter > 0 && autoCalculatedNgKg > 0)
    ? Math.max(0, Math.round((autoCalculatedNgKg / effectiveKgPerMeter) * 10) / 10)
    : 0;

  // Automatically update ngKg & ngMeters fields when weight or SO length changes unless manually overridden
  useEffect(() => {
    if (!isNgManuallyEdited && calculatedUsed > 0 && numSoLength > 0) {
      setNgKg(autoCalculatedNgKg > 0 ? autoCalculatedNgKg.toFixed(2) : '0.00');
      setNgMeters(autoCalculatedNgMeters > 0 ? autoCalculatedNgMeters.toFixed(1) : '0.0');
    }
  }, [calculatedUsed, numSoLength, effectiveKgPerMeter, autoCalculatedNgKg, autoCalculatedNgMeters, isNgManuallyEdited]);

  // Two-way synchronized setters for ตัดตก / NG กก. <-> เมตร
  const handleNgKgChange = (val: string) => {
    setNgKg(val);
    setIsNgManuallyEdited(true);
    const n = parseCleanNum(val);
    if (effectiveKgPerMeter > 0 && n >= 0) {
      const m = n > 0 ? Math.round((n / effectiveKgPerMeter) * 10) / 10 : 0;
      setNgMeters(m > 0 ? m.toFixed(1) : '0.0');
    }
  };

  const handleNgMetersChange = (val: string) => {
    setNgMeters(val);
    setIsNgManuallyEdited(true);
    const m = parseCleanNum(val);
    if (effectiveKgPerMeter > 0 && m >= 0) {
      const kg = m > 0 ? Math.round(m * effectiveKgPerMeter * 100) / 100 : 0;
      setNgKg(kg > 0 ? kg.toFixed(2) : '0.00');
    }
  };

  const handleResetToAutoNg = () => {
    setIsNgManuallyEdited(false);
    if (calculatedUsed > 0 && numSoLength > 0) {
      setNgKg(autoCalculatedNgKg > 0 ? autoCalculatedNgKg.toFixed(2) : '0.00');
      setNgMeters(autoCalculatedNgMeters > 0 ? autoCalculatedNgMeters.toFixed(1) : '0.0');
    } else {
      setNgKg('0.00');
      setNgMeters('0.0');
    }
  };

  const validateSandwichForm = (): boolean => {
    setError(null);
    if (!soNumber.trim()) {
      setError('กรุณาระบุรหัส SO');
      return false;
    }
    if (soLengthMeters !== '' && numSoLength < 0) {
      setError('ความยาวตามใบงาน SO (เมตร) ต้องไม่ติดลบ');
      return false;
    }
    if (!coilColor.trim()) {
      setError('กรุณาระบุสีคอล์ย');
      return false;
    }
    if (!thickness.trim()) {
      setError('กรุณาระบุความหนา');
      return false;
    }
    if (!coilNumber.trim()) {
      setError('กรุณาระบุเบอร์คอล์ย');
      return false;
    }
    if ((weightBefore === '' || numBefore <= 0) && numSoLength <= 0) {
      setError('กรุณาระบุน้ำหนักคอล์ยก่อนใช้ (กก.) หรือความยาวตามใบงาน SO (เมตร)');
      return false;
    }
    if (numBefore > 0 && weightAfter !== '' && numAfter > numBefore) {
      setError('น้ำหนักหลังใช้ (กก.) ไม่สามารถมากกว่าน้ำหนักก่อนใช้ได้');
      return false;
    }
    if (steelOrigin === 'อื่นๆ' && !customSteelOrigin.trim()) {
      setError('กรุณาระบุรายละเอียดชนิดเหล็ก (กรณีเลือกอื่นๆ)');
      return false;
    }

    const numNgKg = parseCleanNum(ngKg);
    const numNgMeters = parseCleanNum(ngMeters);
    if (numNgKg < 0) {
      setError('ยอดตัดตก / NG (กก.) ต้องไม่ติดลบ');
      return false;
    }
    if (numNgMeters < 0) {
      setError('ยอดตัดตก / NG (เมตร) ต้องไม่ติดลบ');
      return false;
    }
    if (calculatedUsed > 0 && numNgKg > calculatedUsed + 0.05) {
      setError('ยอดตัดตก / NG (กก.) ต้องไม่เกินน้ำหนักเหล็กที่ใช้จริง');
      return false;
    }
    return true;
  };

  const executeSandwichSave = async () => {
    if (!isStaff) {
      setShowConfirmSummary(false);
      setError(`บัญชีปัจจุบัน (${currentUserEmail || 'ยังไม่ได้เข้าสู่ระบบ'}) ไม่มีสิทธิ์บันทึกตัดแซนวิช — เฉพาะอีเมลเจ้าหน้าที่ (${getStaffEmails().join(', ')})`);
      return;
    }

    const numNgKg = parseCleanNum(ngKg);
    const numNgMeters = parseCleanNum(ngMeters);

    // ป้องกันกรณีไม่มีฟังก์ชันบันทึก: แจ้งเตือนแทนการปิดหน้าต่างเงียบๆ โดยไม่บันทึก
    const canSave = editingRecord ? !!onSaveCut : !!(onSaveRecord || onSaveCut);
    if (!canSave) {
      setShowConfirmSummary(false);
      setError('ไม่สามารถบันทึกได้: ระบบยังไม่ได้เชื่อมต่อฟังก์ชันบันทึก กรุณาแจ้งผู้ดูแล');
      return;
    }

    try {
      setIsSubmitting(true);
      setShowConfirmSummary(false);
      if (recordedBy.trim()) {
        saveRecentOperator(recordedBy.trim());
      }

      const finalWeightUsed = calculatedUsed > 0
        ? calculatedUsed
        : numSoLength > 0
          ? theoreticalSoWeight
          : 0;

      const cleanPayload: any = {
        soNumber: soNumber.trim(),
        productionDate,
        coilColor: coilColor.trim(),
        thickness: thickness.trim(),
        coilNumber: coilNumber.trim(),
        weightBefore: numBefore > 0 ? numBefore : theoreticalSoWeight,
        weightAfter: weightAfter !== '' && numAfter >= 0 ? numAfter : 0,
        weightUsed: finalWeightUsed,
        ngKg: numNgKg,
        ngMeters: numNgMeters,
        steelOrigin,
        recordedBy: recordedBy.trim() || 'ช่างคุมเครื่อง PU',
        createdAt: editingRecord?.createdAt || new Date().toISOString(),
      };

      if (numSoLength > 0) cleanPayload.soLengthMeters = numSoLength;
      if (steelOrigin === 'อื่นๆ' && customSteelOrigin.trim()) {
        cleanPayload.customSteelOrigin = customSteelOrigin.trim();
      }
      if (lengthMeters && parseFloat(lengthMeters) > 0) {
        cleanPayload.lengthMeters = parseFloat(lengthMeters);
      }
      if (notes.trim()) cleanPayload.notes = notes.trim();

      if (onSaveRecord && !editingRecord) {
        await onSaveRecord(cleanPayload);
      } else if (onSaveCut) {
        await onSaveCut({
          id: editingRecord?.id || `pusw_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          ...cleanPayload,
        } as PuSandwichCutRecord);
      }

      if (editingRecord) {
        onClose();
      } else {
        const yy = getCurrentThaiYearBE2Digits();
        const mm = getCurrentMonth2Digits();
        setSoNumber(`so${yy}${mm}`);
        setWeightBefore('');
        setWeightAfter('');
        setSoLengthMeters('');
        setNgKg('0');
        setNgMeters('0');
        setIsNgManuallyEdited(false);
        setCustomKgPerMeter('');
        setShowCustomFactor(false);
        setNotes('');
        setLengthMeters('');
        setActiveTab('history');
      }
    } catch (err: any) {
      setError(err?.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateSandwichForm()) return;
    // แสดงสรุปยืนยันก่อนบันทึกจริง
    setShowConfirmSummary(true);
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        ref={panelRef}
        tabIndex={-1} 
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92dvh] flex flex-col overflow-hidden"
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
                <h2 className="text-lg font-bold">
                  {editingRecord ? 'แก้ไข SO แซนวิช' : 'ตัด SO ไม่ใช้ฟอยล์ (ผลิต PU Sandwich)'}
                </h2>
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
              aria-label="ปิดหน้าต่าง"
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
              {!isStaff && (
                <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-2xl flex items-start gap-2.5 text-xs text-rose-900 animate-in fade-in">
                  <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <div className="font-bold text-rose-950 text-sm">
                      ไม่มีสิทธิ์บันทึกตัดแซนวิช / คีย์ข้อมูล (เฉพาะบัญชีที่ได้รับอนุญาต)
                    </div>
                    <p className="text-rose-800 leading-relaxed">
                      บัญชีที่เข้าสู่ระบบปัจจุบัน ({currentUserEmail || 'ยังไม่ได้เข้าสู่ระบบ'}) ไม่มีสิทธิ์บันทึกข้อมูลขึ้น Cloud ระบบเปิดสิทธิ์ให้เฉพาะอีเมลเจ้าหน้าที่ที่ได้รับอนุญาต ({getStaffEmails().join(', ')})
                    </p>
                  </div>
                </div>
              )}

              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2.5 text-xs text-rose-800 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Top Row: SO Number, Production Date & SO Length */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
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
                    รูปแบบ: so + ปี พ.ศ. + เดือน + ลำดับ
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
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    วันที่ดำเนินการผลิตแผ่นแซนวิช
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Ruler className="w-3.5 h-3.5 text-emerald-600" />
                      ความยาวตามใบงาน SO (ม.) <span className="text-rose-500">*</span>
                    </span>
                    <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                      ใช้คำนวณ NG
                    </span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={soLengthMeters}
                    onChange={(e) => {
                      setSoLengthMeters(e.target.value);
                      setIsNgManuallyEdited(false);
                    }}
                    placeholder="เช่น 120.00 หรือ 250"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono font-bold text-slate-900 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all"
                    required
                  />
                  {/* Quick Chips for SO Length */}
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {['50', '100', '120', '150', '200', '300'].map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => {
                          setSoLengthMeters(chip);
                          setIsNgManuallyEdited(false);
                        }}
                        className={`text-[10px] px-1.5 py-0.5 rounded-md border cursor-pointer transition-colors ${
                          soLengthMeters === chip
                            ? 'bg-emerald-600 text-white border-emerald-600 font-bold'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {chip}ม.
                      </button>
                    ))}
                  </div>
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

                {/* ยอดตัดตก / NG ของ PU Sandwich: คำนวณอัตโนมัติจาก (น้ำหนักขึ้น-ลง ลบงาน SO เป็นเมตร) */}
                <div className="p-4 bg-rose-50/80 rounded-2xl border border-rose-200 mt-3 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-rose-200/80 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-rose-600 text-white flex items-center justify-center text-xs font-black shadow-2xs">
                        NG
                      </span>
                      <div>
                        <h4 className="text-xs sm:text-sm font-bold text-rose-950 flex items-center gap-1.5">
                          <AlertTriangle className="w-4 h-4 text-rose-600" />
                          ยอดตัดตก / NG ของ PU Sandwich (คำนวณอัตโนมัติ)
                        </h4>
                        <span className="text-[11px] text-rose-700">
                          คำนวณจาก: น้ำหนักขึ้น-ลง (กก.) ลบงาน SO เป็นเมตร (ตัดตกเศษหัวท้าย / แผ่นเสีย)
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {!isNgManuallyEdited && (calculatedUsed > 0 && numSoLength > 0) && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1 shadow-2xs">
                          <Sparkles className="w-3 h-3 text-emerald-600" />
                          ระบบคำนวณให้อัตโนมัติ
                        </span>
                      )}
                      {isNgManuallyEdited && (
                        <button
                          type="button"
                          onClick={handleResetToAutoNg}
                          className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-white hover:bg-rose-100 text-rose-800 border border-rose-300 cursor-pointer shadow-2xs flex items-center gap-1 transition-colors"
                          title="คลิกเพื่อนำค่าคำนวณอัตโนมัติกลับมาใส่"
                        >
                          <RotateCcw className="w-3 h-3" />
                          ดึงค่าคำนวณอัตโนมัติกลับมา
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Auto-calculation breakdown card */}
                  <div className="bg-white p-3 sm:p-4 rounded-xl border border-rose-200/90 shadow-2xs space-y-2.5">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                        <span className="text-[10px] font-semibold text-slate-500 block">1. น้ำหนักขึ้น-ลง (ใช้จริง)</span>
                        <div className="font-mono font-bold text-slate-900 text-base">
                          {calculatedUsed.toLocaleString('th-TH', { minimumFractionDigits: 2 })} <span className="text-xs font-normal text-slate-500">กก.</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono block truncate">
                          ({numBefore.toLocaleString()} - {numAfter.toLocaleString()})
                        </span>
                      </div>

                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-semibold text-slate-500 block">2. งาน SO เป็นเมตร</span>
                          <button
                            type="button"
                            onClick={() => setShowCustomFactor(!showCustomFactor)}
                            className="text-[11px] text-emerald-700 hover:underline cursor-pointer font-sans"
                            title="คลิกเพื่อตรวจสอบหรือปรับอัตรา กก./ม."
                          >
                            {effectiveKgPerMeter.toFixed(2)} กก./ม.
                          </button>
                        </div>
                        <div className="font-mono font-bold text-slate-900 text-base">
                          {numSoLength.toLocaleString('th-TH', { minimumFractionDigits: 1 })} <span className="text-xs font-normal text-slate-500">ม.</span>
                        </div>
                        <span className="text-[10px] text-emerald-700 font-mono block truncate">
                          ≈ {theoreticalSoWeight.toLocaleString('th-TH', { minimumFractionDigits: 2 })} กก. (เหล็ก {thickness || '0.35'} มม.)
                        </span>
                      </div>

                      <div className="bg-rose-50/90 p-2.5 rounded-xl border border-rose-300">
                        <span className="text-[10px] font-bold text-rose-900 block">3. ยอดตัดตก / NG คำนวณได้</span>
                        <div className="font-mono font-black text-rose-700 text-base">
                          {autoCalculatedNgKg.toLocaleString('th-TH', { minimumFractionDigits: 2 })}{' '}
                          <span className="text-xs font-bold text-rose-600">กก.</span>
                        </div>
                        <span className="text-[10px] text-rose-800 font-mono block truncate">
                          ≈ {autoCalculatedNgMeters.toLocaleString('th-TH', { minimumFractionDigits: 1 })} เมตรตัดตก/เสีย
                        </span>
                      </div>
                    </div>

                    {/* Fine-tune factor option */}
                    {showCustomFactor && (
                      <div className="p-2.5 bg-emerald-50/80 border border-emerald-200 rounded-xl text-xs space-y-1.5 animate-in fade-in">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-emerald-900 text-[11px]">
                            อัตราน้ำหนักเหล็กต่อเมตร (กก./เมตร):
                          </span>
                          <span className="text-[10px] text-emerald-700">
                            มาตรฐานความหนา {thickness || '0.35'} มม. = {standardKgPerMeter.toFixed(2)} กก./ม.
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            step="0.01"
                            min="0.1"
                            value={customKgPerMeter}
                            onChange={(e) => setCustomKgPerMeter(e.target.value)}
                            placeholder={standardKgPerMeter.toFixed(2)}
                            className="w-28 px-2 py-1 bg-white border border-emerald-300 rounded-lg text-xs font-mono font-bold"
                          />
                          <span className="text-xs text-slate-600">กก./ม.</span>
                          {customKgPerMeter && (
                            <button
                              type="button"
                              onClick={() => setCustomKgPerMeter('')}
                              className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-medium text-slate-600 hover:bg-slate-100 cursor-pointer"
                            >
                              รีเซ็ตค่ามาตรฐาน
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {numSoLength === 0 && (
                      <p className="text-[11px] text-amber-800 bg-amber-50 p-2 rounded-lg border border-amber-200 flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                        <span>กรุณาระบุ <strong>ความยาวตามใบงาน SO (เมตร)</strong> ด้านบนเพื่อเปิดใช้งานการคำนวณอัตโนมัติ (หรือระบุยอดตัดตกด้านล่างได้โดยตรง)</span>
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    {/* ยอดตัดตก / NG (กก.) */}
                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
                          ยอดตัดตก / NG (กก.) <span className="text-emerald-700 text-[10px] font-bold">[เชื่อมโยง 2 ทาง]</span>
                        </span>
                        <span className="text-[10px] text-slate-500 font-normal">แก้ไขเพิ่มเติมได้</span>
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={ngKg}
                        onChange={(e) => handleNgKgChange(e.target.value)}
                        placeholder="0.00"
                        className="w-full px-3 py-2.5 bg-white border border-rose-300 rounded-xl text-base font-mono font-bold text-slate-900 focus:border-rose-500 focus:ring-2 focus:ring-rose-200 outline-none transition-all shadow-2xs"
                      />
                      {/* Quick Chips for NG กก. */}
                      <div className="flex flex-wrap gap-1 mt-2">
                        {['0', '5', '10', '15', '20', '30'].map((chip) => (
                          <button
                            key={chip}
                            type="button"
                            onClick={() => handleNgKgChange(chip)}
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

                    {/* ยอดตัดตก / NG (เมตร) */}
                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
                          ยอดตัดตก / NG (เมตร) <span className="text-emerald-700 text-[10px] font-bold">[เชื่อมโยง 2 ทาง]</span>
                        </span>
                        <span className="text-[10px] text-slate-500 font-normal">ความยาวแผ่นตัดตก</span>
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={ngMeters}
                        onChange={(e) => handleNgMetersChange(e.target.value)}
                        placeholder="0.0"
                        className="w-full px-3 py-2.5 bg-white border border-rose-300 rounded-xl text-base font-mono font-bold text-slate-900 focus:border-rose-500 focus:ring-2 focus:ring-rose-200 outline-none transition-all shadow-2xs"
                      />
                      {/* Quick Chips for NG เมตร */}
                      <div className="flex flex-wrap gap-1 mt-2">
                        {['0', '1', '2', '3', '5', '10'].map((chip) => (
                          <button
                            key={chip}
                            type="button"
                            onClick={() => handleNgMetersChange(chip)}
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
                  aria-label="ปิดหน้าต่าง"
                  className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !isStaff}
                  className={`px-6 py-2.5 rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-2 cursor-pointer ${
                    !isStaff
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
                      : 'bg-linear-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white hover:shadow-lg disabled:opacity-50'
                  }`}
                >
                  {!isStaff ? (
                    <>
                      <Lock className="w-4 h-4" />
                      <span>ไม่มีสิทธิ์บันทึก (เฉพาะเจ้าหน้าที่)</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      {isSubmitting
                        ? 'กำลังบันทึก...'
                        : editingRecord
                          ? 'ตรวจสอบก่อนบันทึกแก้ไข'
                          : 'ตรวจสอบก่อนตัด SO แซนวิช'}
                    </>
                  )}
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
                          <th className="py-2.5 px-3 text-right font-bold text-teal-800">งาน SO (ม.)</th>
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
                            <td className="py-2.5 px-3 text-right font-bold text-teal-700">
                              {rec.soLengthMeters ? `${rec.soLengthMeters.toLocaleString('th-TH', { minimumFractionDigits: 1 })} ม.` : '-'}
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
                                  onClick={async () => {
                                    if (
                                      await confirmAction({
                                        title: 'ลบรายการตัด SO',
                                        message: `ยืนยันการลบรายการตัด SO ${rec.soNumber}?`,
                                        confirmLabel: 'ลบรายการ',
                                      })
                                    ) {
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

      {/* ========== ยืนยันก่อนตัด SO แซนวิช ========== */}
      {showConfirmSummary && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-emerald-200 space-y-4 animate-in zoom-in-95 duration-150 max-h-[90dvh] overflow-y-auto">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 border border-emerald-300 flex items-center justify-center shrink-0">
                <Factory className="w-5 h-5 text-emerald-800" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 leading-tight">
                  {editingRecord ? 'ยืนยันก่อนบันทึกการแก้ไข' : 'ยืนยันก่อนตัด SO แซนวิช'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  ตรวจสอบสรุปด้านล่างก่อนบันทึกจริง
                </p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl border border-slate-200 p-3.5 space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <span className="text-slate-500 text-xs">รหัส SO</span>
                <span className="font-bold text-slate-900 font-mono text-xs">{soNumber.trim()}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500 text-xs">วันที่ผลิต</span>
                <span className="font-semibold text-slate-800 text-xs">{productionDate}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500 text-xs">คอล์ย</span>
                <span className="font-semibold text-slate-800 text-xs text-right">
                  {coilColor.trim()} · {thickness.trim()} มม. · #{coilNumber.trim()}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500 text-xs">ชนิดเหล็ก</span>
                <span className="font-semibold text-slate-800 text-xs">
                  {steelOrigin}
                  {steelOrigin === 'อื่นๆ' && customSteelOrigin.trim()
                    ? ` (${customSteelOrigin.trim()})`
                    : ''}
                </span>
              </div>
              <div className="pt-2 border-t border-slate-200 grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-[10px] text-slate-400 uppercase">ก่อนใช้</div>
                  <div className="font-mono font-bold text-slate-800 text-xs">
                    {numBefore.toLocaleString('th-TH', { maximumFractionDigits: 2 })} กก.
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-emerald-600 uppercase">ใช้จริง</div>
                  <div className="font-mono font-bold text-emerald-700 text-xs">
                    {calculatedUsed.toLocaleString('th-TH', { maximumFractionDigits: 2 })} กก.
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase">หลังใช้</div>
                  <div className="font-mono font-bold text-slate-800 text-xs">
                    {numAfter.toLocaleString('th-TH', { maximumFractionDigits: 2 })} กก.
                  </div>
                </div>
              </div>
              <div className="flex justify-between gap-2 pt-1">
                <span className="text-slate-500 text-xs">ความยาวตาม SO</span>
                <span className="font-mono font-bold text-teal-800 text-xs">
                  {numSoLength > 0 ? `${numSoLength.toLocaleString('th-TH')} ม.` : '—'}
                </span>
              </div>
              {(parseFloat(ngKg) > 0 || parseFloat(ngMeters) > 0) && (
                <div className="flex justify-between gap-2">
                  <span className="text-rose-600 text-xs font-semibold">ยอด NG</span>
                  <span className="font-mono font-bold text-rose-700 text-xs">
                    {(parseFloat(ngKg) || 0).toLocaleString('th-TH', { maximumFractionDigits: 2 })} กก.
                    {(parseFloat(ngMeters) || 0) > 0
                      ? ` / ${(parseFloat(ngMeters) || 0).toLocaleString('th-TH')} ม.`
                      : ''}
                  </span>
                </div>
              )}
              {recordedBy.trim() && (
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500 text-xs">ผู้บันทึก</span>
                  <span className="text-xs font-semibold text-slate-800">{recordedBy.trim()}</span>
                </div>
              )}
            </div>

            <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-950">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-600 mt-0.5" />
              <span className="leading-relaxed">
                กดยืนยันแล้วระบบจะบันทึกลงเครื่องและซิงค์ Cloud — ตรวจสอบตัวเลขให้ถูกต้องก่อนบันทึก
              </span>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setShowConfirmSummary(false)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              >
                กลับไปแก้
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => executeSandwichSave()}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-2 disabled:opacity-60"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    กำลังบันทึก...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    ยืนยันบันทึก
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
