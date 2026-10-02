import React, { useState } from 'react';
import { ChemicalFormula } from '../types';
import { 
  X, 
  Plus, 
  Check, 
  Beaker, 
  Trash2, 
  Edit2, 
  Info, 
  Gauge, 
  Timer, 
  Scale, 
  Flame, 
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import { round2 } from '../utils/formatters';
import { calculateFlowRatePerMin, calculateRatePerMeter, PU_INCH_OPTIONS, normalizeInchSize } from '../utils/chemicalStock';
import { DENSITY_K_PRESETS, normalizeDensityK, normalizeDensityList, sortDensityList } from '../utils/density';

interface ChemicalFormulaModalProps {
  isOpen: boolean;
  onClose: () => void;
  formulas: ChemicalFormula[];
  onSaveFormulas: (newFormulas: ChemicalFormula[]) => void;
  showToast: (text: string, type?: 'success' | 'info') => void;
}

export const ChemicalFormulaModal: React.FC<ChemicalFormulaModalProps> = ({
  isOpen,
  onClose,
  formulas,
  onSaveFormulas,
  showToast,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // ข้อมูลระบุสูตร
  const [name, setName] = useState('');
  const [density, setDensity] = useState('30k');
  const [densities, setDensities] = useState<string[]>(['30k']);
  const [customDensityInput, setCustomDensityInput] = useState('');
  const [inchSize, setInchSize] = useState('1 นิ้ว');
  const [drumNumber, setDrumNumber] = useState('');
  const [description, setDescription] = useState('');
  const [foamThicknessMm, setFoamThicknessMm] = useState<number>(25);

  // น้ำหนักที่ชั่งได้ & เวลา (วินาที) สำหรับ Poly (Part A)
  const [polyWeightInput, setPolyWeightInput] = useState<number>(0.283);
  const [polyWeightUnit, setPolyWeightUnit] = useState<'kg' | 'g'>('kg');
  const [polySeconds, setPolySeconds] = useState<number>(5);

  // น้ำหนักที่ชั่งได้ & เวลา (วินาที) สำหรับ ISO (Part B)
  const [isoWeightInput, setIsoWeightInput] = useState<number>(0.283);
  const [isoWeightUnit, setIsoWeightUnit] = useState<'kg' | 'g'>('kg');
  const [isoSeconds, setIsoSeconds] = useState<number>(5);

  // ความเร็วสายพานมาตรฐาน (เมตร/นาที)
  const [defaultLineSpeed, setDefaultLineSpeed] = useState<number>(8.0);
  const [wasteFactorPercent, setWasteFactorPercent] = useState<number>(0);

  if (!isOpen) return null;

  // ฟังก์ชันเพิ่มค่า Density (รองรับมากกว่า 1 ค่า) — เก็บเป็นรูปแบบ "Nk" เช่น 25k, 28k, 30k, 35k, 40k หรือค่าที่กรอกเอง
  const handleAddDensity = (val: string) => {
    const clean = val.trim();
    if (!clean) return;
    const formatted = normalizeDensityK(clean);
    if (!formatted) {
      showToast('กรุณากรอก Density เป็นตัวเลข เช่น 32 หรือ 32k', 'info');
      return;
    }
    if (!densities.includes(formatted)) {
      const updated = sortDensityList([...densities, formatted]);
      setDensities(updated);
      setDensity(updated.join(', '));
    }
    setCustomDensityInput('');
  };

  const handleRemoveDensity = (indexToRemove: number) => {
    if (densities.length <= 1) {
      showToast('ต้องมีค่า Density กำกับอย่างน้อย 1 ค่า', 'info');
      return;
    }
    const updated = densities.filter((_, idx) => idx !== indexToRemove);
    setDensities(updated);
    setDensity(updated.join(', '));
  };

  // กดปุ่มเลือกด่วน: ถ้ามีอยู่แล้วให้เอาออก (ต้องเหลืออย่างน้อย 1 ค่า) ถ้ายังไม่มีให้เพิ่ม
  const handleTogglePresetDensity = (k: string) => {
    const idx = densities.indexOf(k);
    if (idx >= 0) handleRemoveDensity(idx);
    else handleAddDensity(k);
  };

  // แปลงหน่วยเป็นกิโลกรัมเพื่อคำนวณ
  const polyWeightKg = polyWeightUnit === 'g' ? (polyWeightInput / 1000) : polyWeightInput;
  const isoWeightKg = isoWeightUnit === 'g' ? (isoWeightInput / 1000) : isoWeightInput;

  // การคำนวณอัตราไหลใน 1 นาที (กก./นาที)
  const polyFlowRatePerMin = calculateFlowRatePerMin(polyWeightKg, polySeconds);
  const isoFlowRatePerMin = calculateFlowRatePerMin(isoWeightKg, isoSeconds);
  const totalFlowRatePerMin = round2(polyFlowRatePerMin + isoFlowRatePerMin);

  // สัดส่วน %
  const partARatio = totalFlowRatePerMin > 0 ? round2((polyFlowRatePerMin / totalFlowRatePerMin) * 100) : 50;
  const partBRatio = totalFlowRatePerMin > 0 ? round2((isoFlowRatePerMin / totalFlowRatePerMin) * 100) : 50;

  // คำนวณอัตรา กก./เมตร เมื่อวิ่งด้วยความเร็วสายพานมาตรฐาน
  const usageRatePerMeter = calculateRatePerMeter(totalFlowRatePerMin, defaultLineSpeed);
  const ngRatePerMeter = usageRatePerMeter;

  const handleStartCreate = () => {
    setIsCreating(true);
    setEditingId(null);
    setName('');
    setDensities(['30k']);
    setDensity('30k');
    setCustomDensityInput('');
    setInchSize('1 นิ้ว');
    setDrumNumber('');
    setDescription('');
    setFoamThicknessMm(25);
    setPolyWeightInput(0.283);
    setPolyWeightUnit('kg');
    setPolySeconds(5);
    setIsoWeightInput(0.283);
    setIsoWeightUnit('kg');
    setIsoSeconds(5);
    setDefaultLineSpeed(8.0);
    setWasteFactorPercent(0);
  };

  const handleStartEdit = (formula: ChemicalFormula) => {
    setEditingId(formula.id);
    setIsCreating(false);
    setName(formula.name);
    // รวมรูปแบบเก่า ("Density 32") ให้เป็น "32k"
    const parsedDensities = normalizeDensityList(
      formula.densities && formula.densities.length > 0 ? formula.densities : formula.density
    );
    const safeDensities = sortDensityList(parsedDensities.length > 0 ? parsedDensities : ['30k']);
    setDensities(safeDensities);
    setDensity(safeDensities.join(', '));
    setCustomDensityInput('');

    // PU มีแค่ 1 / 2 นิ้ว — สูตรเก่าที่เป็นขนาดอื่นให้เลือกใหม่ (ค่าเริ่มต้น 1 นิ้ว)
    const normInch = normalizeInchSize(formula.inchSize) || '1 นิ้ว';
    setInchSize(normInch);
    setDrumNumber(formula.drumNumber || '');
    setDescription(formula.description || '');
    setFoamThicknessMm(normInch === '2 นิ้ว' ? 50 : 25);

    setPolyWeightInput(formula.polyWeightKg || 0.283);
    setPolyWeightUnit('kg');
    setPolySeconds(formula.polySeconds || 5);

    setIsoWeightInput(formula.isoWeightKg || 0.283);
    setIsoWeightUnit('kg');
    setIsoSeconds(formula.isoSeconds || 5);

    setDefaultLineSpeed(formula.defaultLineSpeedMPerMin || 8.0);
    setWasteFactorPercent(formula.wasteFactorPercent || 0);
  };

  const handleCancelForm = () => {
    setIsCreating(false);
    setEditingId(null);
  };

  const handleSaveFormula = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('กรุณาระบุชื่อน้ำยา / ชื่อสูตร', 'info');
      return;
    }
    if (totalFlowRatePerMin <= 0) {
      showToast('กรุณาระบุน้ำหนักและเวลาทดสอบน้ำยาให้ถูกต้อง (อัตราไหลต้องมากกว่า 0)', 'info');
      return;
    }
    if (defaultLineSpeed <= 0) {
      showToast('ความเร็วสายพานต้องมากกว่า 0 เมตร/นาที', 'info');
      return;
    }

    const finalInch = normalizeInchSize(inchSize);
    if (!finalInch) {
      showToast('PU มีเฉพาะความหนา 1 นิ้ว หรือ 2 นิ้ว กรุณาเลือกอย่างใดอย่างหนึ่ง', 'info');
      return;
    }
    const finalDensities = sortDensityList(densities.length > 0 ? normalizeDensityList(densities) : [normalizeDensityK(density) || '30k']);

    const formulaData: Omit<ChemicalFormula, 'id' | 'isDefault'> = {
      name: name.trim(),
      density: finalDensities.join(', '),
      densities: finalDensities,
      inchSize: finalInch,
      drumNumber: drumNumber.trim() || undefined,
      description: description.trim(),
      foamThicknessMm: finalInch === '2 นิ้ว' ? 50 : 25,
      polyWeightKg: round2(polyWeightKg),
      polySeconds: Number(polySeconds) || 5,
      polyFlowRatePerMin,
      isoWeightKg: round2(isoWeightKg),
      isoSeconds: Number(isoSeconds) || 5,
      isoFlowRatePerMin,
      totalFlowRatePerMin,
      defaultLineSpeedMPerMin: Number(defaultLineSpeed) || 8.0,
      usageRatePerMeter,
      ngRatePerMeter,
      partARatioPercent: partARatio,
      partBRatioPercent: partBRatio,
      wasteFactorPercent: Number(wasteFactorPercent) || 0,
    };

    if (isCreating) {
      const newFormula: ChemicalFormula = {
        id: `formula-${Date.now()}`,
        ...formulaData,
        isDefault: formulas.length === 0,
      };
      const updated = [...formulas, newFormula];
      onSaveFormulas(updated);
      showToast(`สร้างสูตรผูกน้ำยา "${newFormula.name}" สำเร็จ`);
    } else if (editingId) {
      const updated = formulas.map(f => {
        if (f.id === editingId) {
          return {
            ...f,
            ...formulaData,
          };
        }
        return f;
      });
      onSaveFormulas(updated);
      showToast('บันทึกการปรับสูตรน้ำยาเรียบร้อย');
    }

    setIsCreating(false);
    setEditingId(null);
  };

  const handleDeleteFormula = (formulaId: string, formulaName: string) => {
    if (formulas.length <= 1) {
      showToast('ต้องมีสูตรคำนวณอย่างน้อย 1 สูตรในระบบ', 'info');
      return;
    }
    if (confirm(`คุณต้องการลบสูตร "${formulaName}" ใช่หรือไม่?`)) {
      const updated = formulas.filter(f => f.id !== formulaId);
      onSaveFormulas(updated);
      showToast(`ลบสูตร "${formulaName}" แล้ว`);
    }
  };

  const handleSetDefault = (formulaId: string) => {
    const updated = formulas.map(f => ({
      ...f,
      isDefault: f.id === formulaId,
    }));
    onSaveFormulas(updated);
    showToast('ตั้งเป็นสูตรหลักเริ่มต้นสำเร็จ');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold shadow-xs">
              <Beaker className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                ผูกสูตรคำนวณน้ำยา PU (Calibration & Speed)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                กรอกผลชั่งน้ำหนัก Poly / ISO (วินาที) → คำนวณ กก./นาที → ผูกความเร็วสายพานผลิตจริง
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Action Row */}
          {!isCreating && !editingId && (
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                สูตรที่บันทึกไว้ในระบบ ({formulas.length} สูตร)
              </span>
              <button
                type="button"
                onClick={handleStartCreate}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-xs transition-all cursor-pointer active:scale-95"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>เพิ่มสูตรน้ำยาใหม่</span>
              </button>
            </div>
          )}

          {/* Form: Add or Edit Formula */}
          {(isCreating || editingId) && (
            <form onSubmit={handleSaveFormula} className="bg-amber-50/40 rounded-2xl p-4 sm:p-5 border border-amber-200/80 space-y-5 animate-in fade-in duration-150">
              <div className="flex items-center justify-between border-b border-amber-200/60 pb-3">
                <h4 className="text-sm font-bold text-amber-950 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <span>{isCreating ? 'ผูกสูตรน้ำยาใหม่ (ทดสอบยิงชั่งน้ำหนัก)' : 'แก้ไขข้อมูลและสูตรทดสอบน้ำยา'}</span>
                </h4>
                <button
                  type="button"
                  onClick={handleCancelForm}
                  className="text-xs text-slate-500 hover:text-slate-800 underline cursor-pointer"
                >
                  ยกเลิก
                </button>
              </div>

              {/* 1. ข้อมูลชื่อน้ำยา, Density, นิ้ว, No. ถัง */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ชื่อน้ำยา / ชื่อสูตร <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="เช่น น้ำยา K-Foam 32 หรือ Polyol System A"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                  />
                </div>

                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                      <span>ป้ายกำกับค่า Density (ใส่ได้มากกว่า 1 ค่า)</span>
                      <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[10px] text-amber-800 font-mono font-bold">
                      {densities.length} ค่าที่ระบุ
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 flex-wrap min-h-[34px] p-1.5 bg-white border border-slate-300 rounded-xl">
                      {densities.map((d, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500 text-slate-950 font-bold text-xs shadow-2xs"
                        >
                          <span>{d}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveDensity(idx)}
                            className="w-3.5 h-3.5 rounded-full hover:bg-amber-600 flex items-center justify-center cursor-pointer text-slate-900"
                            title="ลบค่านี้"
                          >
                            ✕
                          </button>
                        </span>
                      ))}
                      <input
                        type="text"
                        value={customDensityInput}
                        onChange={(e) => setCustomDensityInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddDensity(customDensityInput);
                          }
                        }}
                        placeholder="กรอกเอง เช่น 32 หรือ 32k แล้วกด Enter"
                        className="flex-1 min-w-[140px] px-1 py-0.5 text-xs text-slate-900 outline-none bg-transparent"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddDensity(customDensityInput)}
                        className="px-2 py-0.5 rounded bg-amber-600 text-white text-[10px] font-bold cursor-pointer"
                      >
                        + เพิ่ม
                      </button>
                    </div>

                    <div className="flex gap-1 flex-wrap items-center">
                      <span className="text-[10px] text-slate-400">เลือกด่วน:</span>
                      {DENSITY_K_PRESETS.map(d => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => handleTogglePresetDensity(d)}
                          className={`text-[10px] px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                            densities.includes(d)
                              ? 'bg-amber-500 text-slate-950 font-bold'
                              : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                          }`}
                        >
                          {densities.includes(d) ? '✓ ' : '+'}{d}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ใช้กับกี่นิ้ว <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex gap-1.5">
                    {PU_INCH_OPTIONS.map(opt => (
                      <button
                        key={opt.label}
                        type="button"
                        onClick={() => {
                          setInchSize(opt.label);
                          setFoamThicknessMm(opt.thicknessMm);
                        }}
                        className={`flex-1 px-3 py-2 rounded-xl text-xs sm:text-sm font-bold cursor-pointer border transition-colors ${
                          normalizeInchSize(inchSize) === opt.label
                            ? 'bg-amber-500 text-slate-950 border-amber-500'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-amber-50'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">PU มีเฉพาะความหนา 1 นิ้ว (25 มม.) และ 2 นิ้ว (50 มม.)</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    No. ถังน้ำยา (แทนล็อต)
                  </label>
                  <input
                    type="text"
                    value={drumNumber}
                    onChange={(e) => setDrumNumber(e.target.value)}
                    placeholder="เช่น ถัง #A-10 / #B-12"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ความหนาโฟม (มม.)
                  </label>
                  <input
                    type="number"
                    readOnly
                    value={foamThicknessMm}
                    title="กำหนดอัตโนมัติตามนิ้วที่เลือก"
                    className="w-full px-3 py-2 bg-slate-100 text-slate-600 border border-slate-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    คำอธิบาย / บันทึกสูตร
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="เช่น สูตรสำหรับแผ่นลอนสเปน หรือ แผ่นแซนวิชพาเนล"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* 2. การผูกสูตรชั่งน้ำหนัก Poly & ISO + วินาที */}
              <div className="bg-white rounded-xl p-4 border border-slate-200 space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
                  <Scale className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-bold text-slate-900">
                    ข้อมูลการชั่งน้ำหนักทดสอบน้ำยา (Calibration Weight & Time)
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* ฝั่ง Poly (Part A) */}
                  <div className="bg-emerald-50/50 rounded-xl p-3.5 border border-emerald-200/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-600" />
                        <span>น้ำยา Poly (Part A)</span>
                      </span>
                      <div className="flex items-center bg-white rounded-lg p-0.5 border border-emerald-300 text-[10px]">
                        <button
                          type="button"
                          onClick={() => setPolyWeightUnit('kg')}
                          className={`px-2 py-0.5 rounded cursor-pointer ${polyWeightUnit === 'kg' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-600'}`}
                        >
                          กก. (kg)
                        </button>
                        <button
                          type="button"
                          onClick={() => setPolyWeightUnit('g')}
                          className={`px-2 py-0.5 rounded cursor-pointer ${polyWeightUnit === 'g' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-600'}`}
                        >
                          กรัม (g)
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          น้ำหนักที่ชั่งได้ ({polyWeightUnit})
                        </label>
                        <input
                          type="number"
                          step={polyWeightUnit === 'kg' ? '0.001' : '1'}
                          min="0"
                          required
                          value={polyWeightInput}
                          onChange={(e) => setPolyWeightInput(Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-emerald-900 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          จำนวนวินาที (sec)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          min="0.5"
                          required
                          value={polySeconds}
                          onChange={(e) => setPolySeconds(Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                        />
                      </div>
                    </div>

                    <div className="bg-white rounded-lg p-2 border border-emerald-200/80 flex items-center justify-between text-xs font-mono">
                      <span className="text-slate-500 text-[11px]">อัตราการใช้ Poly ใน 1 นาที:</span>
                      <span className="font-bold text-emerald-700 text-sm">{polyFlowRatePerMin} กก./นาที</span>
                    </div>

                    {/* ช่องใส่กำกับค่า density ในหน้า Poly สามารถใส่ได้มากกว่า 1 ค่า */}
                    <div className="bg-white/90 rounded-xl p-2.5 border border-emerald-300 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold text-emerald-950 flex items-center gap-1">
                          <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                          <span>ช่องกำกับค่า Density (ใส่ได้มากกว่า 1 ค่า)</span>
                          <span className="text-rose-500">*</span>
                        </label>
                        <span className="text-[10px] font-mono text-emerald-700">{densities.length} ค่า</span>
                      </div>

                      {/* Density Chips */}
                      <div className="flex items-center gap-1.5 flex-wrap min-h-[30px] p-1.5 bg-emerald-50/50 rounded-lg border border-emerald-200">
                        {densities.map((d, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-600 text-white font-mono font-bold text-xs shadow-2xs"
                          >
                            <span>{d}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveDensity(idx)}
                              className="w-3.5 h-3.5 rounded-full hover:bg-emerald-700 flex items-center justify-center cursor-pointer text-white/90"
                              title="ลบค่านี้"
                            >
                              ✕
                            </button>
                          </span>
                        ))}
                      </div>

                      {/* Input for custom density */}
                      <div className="flex gap-1.5 pt-0.5">
                        <input
                          type="text"
                          value={customDensityInput}
                          onChange={(e) => setCustomDensityInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddDensity(customDensityInput);
                            }
                          }}
                          placeholder="กรอกเอง เช่น 32 หรือ 32k แล้ว Enter หรือกดเพิ่ม"
                          className="flex-1 px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddDensity(customDensityInput)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center gap-0.5 cursor-pointer shadow-2xs"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>เพิ่ม</span>
                        </button>
                      </div>

                      {/* Quick preset buttons */}
                      <div className="flex items-center gap-1 flex-wrap pt-0.5">
                        <span className="text-[10px] text-emerald-900 font-semibold">เลือกด่วน:</span>
                        {DENSITY_K_PRESETS.map(preset => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => handleTogglePresetDensity(preset)}
                            className={`text-[10px] px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                              densities.includes(preset)
                                ? 'bg-emerald-200 text-emerald-950 font-bold border border-emerald-400'
                                : 'bg-white border border-emerald-200 text-emerald-800 hover:bg-emerald-50'
                            }`}
                          >
                            {densities.includes(preset) ? '✓ ' : '+'}{preset}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* ฝั่ง ISO (Part B) */}
                  <div className="bg-indigo-50/50 rounded-xl p-3.5 border border-indigo-200/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-indigo-600" />
                        <span>น้ำยา ISO (Part B)</span>
                      </span>
                      <div className="flex items-center bg-white rounded-lg p-0.5 border border-indigo-300 text-[10px]">
                        <button
                          type="button"
                          onClick={() => setIsoWeightUnit('kg')}
                          className={`px-2 py-0.5 rounded cursor-pointer ${isoWeightUnit === 'kg' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-600'}`}
                        >
                          กก. (kg)
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsoWeightUnit('g')}
                          className={`px-2 py-0.5 rounded cursor-pointer ${isoWeightUnit === 'g' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-600'}`}
                        >
                          กรัม (g)
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          น้ำหนักที่ชั่งได้ ({isoWeightUnit})
                        </label>
                        <input
                          type="number"
                          step={isoWeightUnit === 'kg' ? '0.001' : '1'}
                          min="0"
                          required
                          value={isoWeightInput}
                          onChange={(e) => setIsoWeightInput(Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-indigo-900 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          จำนวนวินาที (sec)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          min="0.5"
                          required
                          value={isoSeconds}
                          onChange={(e) => setIsoSeconds(Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                        />
                      </div>
                    </div>

                    <div className="bg-white rounded-lg p-2 border border-indigo-200/80 flex items-center justify-between text-xs font-mono">
                      <span className="text-slate-500 text-[11px]">อัตราการใช้ ISO ใน 1 นาที:</span>
                      <span className="font-bold text-indigo-700 text-sm">{isoFlowRatePerMin} กก./นาที</span>
                    </div>
                  </div>
                </div>

                {/* สรุปรวม 1 นาที */}
                <div className="bg-slate-900 text-white rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <Timer className="w-4 h-4 text-amber-400" />
                    <span>รวมน้ำยาที่ใช้ใน 1 นาที (Flow Rate):</span>
                    <strong className="text-amber-300 font-mono text-base">{totalFlowRatePerMin} กก./นาที</strong>
                  </div>
                  <div className="flex items-center gap-3 text-slate-300 font-mono text-[11px]">
                    <span>สัดส่วน: Poly <strong className="text-emerald-400">{partARatio}%</strong></span>
                    <span>:</span>
                    <span>ISO <strong className="text-indigo-400">{partBRatio}%</strong></span>
                  </div>
                </div>
              </div>

              {/* 3. ผูกความเร็วสายพานมาตรฐาน (เมตร/นาที) */}
              <div className="bg-white rounded-xl p-4 border border-slate-200 space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                  <Gauge className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-bold text-slate-900">
                    ผูกความเร็วสายพานผลิตจริง (Conveyor Line Speed)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 items-end">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      ความเร็วสายพานมาตรฐาน (ม./นาที)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="1"
                      max="30"
                      required
                      value={defaultLineSpeed}
                      onChange={(e) => setDefaultLineSpeed(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-mono font-bold text-blue-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    />
                    <div className="flex gap-1 mt-1">
                      {[7.5, 8.0, 8.5, 9.0, 10.0].map(s => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setDefaultLineSpeed(s)}
                          className={`text-[10px] px-1.5 py-0.5 rounded cursor-pointer ${defaultLineSpeed === s ? 'bg-blue-600 text-white font-bold' : 'bg-slate-200 text-slate-700'}`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      อัตราการใช้น้ำยาที่คำนวณได้
                    </label>
                    <div className="px-3 py-2 bg-amber-50 border border-amber-300 rounded-xl text-xs sm:text-sm font-mono font-bold text-amber-900">
                      {usageRatePerMeter} กก./เมตร
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      = {totalFlowRatePerMin} กก./นาที ÷ {defaultLineSpeed} ม./นาที
                    </span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      % เผื่อสูญเสีย / ล้นโฟม (ถ้ามี)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="20"
                      value={wasteFactorPercent}
                      onChange={(e) => setWasteFactorPercent(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-mono focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                      placeholder="0%"
                    />
                  </div>
                </div>
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={handleCancelForm}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-xs transition-all cursor-pointer active:scale-95 flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4 stroke-[2.5]" />
                  <span>{isCreating ? 'บันทึกสูตรใหม่' : 'บันทึกการแก้ไข'}</span>
                </button>
              </div>
            </form>
          )}

          {/* List of Formulas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {formulas.map((formula) => {
              return (
                <div
                  key={formula.id}
                  className={`rounded-2xl p-4 sm:p-5 border transition-all relative flex flex-col justify-between ${
                    formula.isDefault
                      ? 'bg-amber-50/30 border-amber-300 shadow-sm'
                      : 'bg-white border-slate-200/80 hover:border-slate-300 hover:shadow-xs'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          {(formula.densities && formula.densities.length > 0
                            ? formula.densities
                            : (formula.density ? formula.density.split(/[,/]/).map(s => s.trim()) : ['Density 32'])
                          ).map((d, dIdx) => (
                            <span key={dIdx} className="text-xs font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-200">
                              {d}
                            </span>
                          ))}
                          <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-blue-100 text-blue-900 border border-blue-200">
                            {formula.inchSize || `${formula.foamThicknessMm} มม.`}
                          </span>
                          {formula.drumNumber && (
                            <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                              {formula.drumNumber}
                            </span>
                          )}
                          {formula.isDefault && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white">
                              สูตรหลัก
                            </span>
                          )}
                        </div>

                        <h4 className="text-sm font-bold text-slate-900 leading-snug">
                          {formula.name}
                        </h4>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(formula)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                          title="แก้ไขสูตร"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteFormula(formula.id, formula.name)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="ลบสูตร"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {formula.description && (
                      <p className="text-xs text-slate-500 mb-3 leading-relaxed">
                        {formula.description}
                      </p>
                    )}

                    {/* Calibration Values Card */}
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-2 mb-3">
                      <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                        <div>
                          <span className="text-[11px] text-slate-500 block">Poly (A):</span>
                          <span className="font-bold text-emerald-700">
                            {formula.polyFlowRatePerMin ? `${formula.polyFlowRatePerMin} กก./นาที` : `${formula.partARatioPercent}%`}
                          </span>
                          {formula.polyWeightKg && formula.polySeconds && (
                            <span className="text-[10px] text-slate-400 block">
                              (ชั่ง {formula.polyWeightKg} กก. / {formula.polySeconds}s)
                            </span>
                          )}
                        </div>
                        <div>
                          <span className="text-[11px] text-slate-500 block">ISO (B):</span>
                          <span className="font-bold text-indigo-700">
                            {formula.isoFlowRatePerMin ? `${formula.isoFlowRatePerMin} กก./นาที` : `${formula.partBRatioPercent}%`}
                          </span>
                          {formula.isoWeightKg && formula.isoSeconds && (
                            <span className="text-[10px] text-slate-400 block">
                              (ชั่ง {formula.isoWeightKg} กก. / {formula.isoSeconds}s)
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs font-mono">
                        <span className="text-slate-500 text-[11px]">อัตราไหลรวม (1 นาที):</span>
                        <strong className="text-slate-900 font-bold">
                          {formula.totalFlowRatePerMin || round2((formula.polyFlowRatePerMin || 0) + (formula.isoFlowRatePerMin || 0))} กก./นาที
                        </strong>
                      </div>
                    </div>

                    {/* Speed & Rate Result */}
                    <div className="flex items-center justify-between text-xs font-mono bg-amber-50/70 p-2.5 rounded-xl border border-amber-200">
                      <div>
                        <span className="text-[11px] text-slate-500 block">สายพานมาตรฐาน:</span>
                        <span className="font-bold text-blue-800">{formula.defaultLineSpeedMPerMin || 8.0} ม./นาที</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[11px] text-slate-500 block">อัตราฉีดต่อเมตร:</span>
                        <span className="font-bold text-amber-900 text-sm">{formula.usageRatePerMeter} กก./ม.</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    {!formula.isDefault ? (
                      <button
                        type="button"
                        onClick={() => handleSetDefault(formula.id)}
                        className="text-xs text-slate-500 hover:text-amber-700 font-medium underline cursor-pointer"
                      >
                        ตั้งเป็นสูตรหลัก
                      </button>
                    ) : (
                      <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>สูตรหลักสำหรับตัดสต๊อก</span>
                      </span>
                    )}

                    <span className="text-[11px] text-slate-400 font-mono">
                      A: {formula.partARatioPercent}% / B: {formula.partBRatioPercent}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <Info className="w-4 h-4 text-slate-400" />
            <span>สูตรที่ตั้งไว้จะถูกนำไปใช้ในหน้าตัดสต๊อกน้ำยา และปรับความเร็วสายพานจริงได้</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
};
