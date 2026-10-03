import React, { useState, useEffect, useMemo } from 'react';
import { ChemicalStock, ChemicalRestockRecord } from '../types';
import { X, Plus, PackagePlus, AlertCircle, Info, Check, Sparkles, Layers, Edit3 } from 'lucide-react';
import { round2, todayLocalYMD } from '../utils/formatters';
import { parseAndGenerateConsecutiveNumbers, suggestNextDrumNumber } from '../utils/chemicalStock';
import { DENSITY_K_PRESETS, normalizeDensityK, normalizeDensityList, sortDensityList } from '../utils/density';

interface ChemicalRestockModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentStock: ChemicalStock;
  existingRestockRecords?: ChemicalRestockRecord[];
  editingRecord?: ChemicalRestockRecord | null;
  onConfirmRestock: (record: ChemicalRestockRecord, updatedStock: ChemicalStock) => void;
  showToast: (text: string, type?: 'success' | 'info') => void;
}

export const ChemicalRestockModal: React.FC<ChemicalRestockModalProps> = ({
  isOpen,
  onClose,
  currentStock,
  existingRestockRecords = [],
  editingRecord = null,
  onConfirmRestock,
  showToast,
}) => {
  const [chemicalName, setChemicalName] = useState('K-Foam 32');
  const [chemicalType, setChemicalType] = useState<'both' | 'part_a' | 'part_b'>('both');
  const [date, setDate] = useState(() => todayLocalYMD());

  // ดึงหมายเลขถังที่เคยมีในระบบเพื่อแนะนำเลขถังถัดไป
  const allExistingDrums = useMemo(() => {
    const list: string[] = [];
    existingRestockRecords.forEach(r => {
      if (r.polyDrumNumbers) list.push(...r.polyDrumNumbers);
      if (r.isoDrumNumbers) list.push(...r.isoDrumNumbers);
      if (r.drumNumbers) list.push(...r.drumNumbers);
      if (r.drumNumber) list.push(r.drumNumber);
    });
    return list;
  }, [existingRestockRecords]);

  // ดึงรายชื่อยี่ห้อ/ชื่อน้ำยาทั้งหมดที่มีในระบบ
  const allExistingBrands = useMemo(() => {
    const defaultBrands = ['K-Foam 32', 'Polyol Dow 210', 'ISO Wanhua 250', 'Huntsman Suprasec', 'BASF Elastopor', 'PU Sandwich Grade', 'โฟมแน่นพิเศษ D40'];
    const fromRecords = existingRestockRecords.map(r => r.chemicalName?.trim()).filter(Boolean);
    return Array.from(new Set([...defaultBrands, ...fromRecords]));
  }, [existingRestockRecords]);

  // Poly (Part A) - ค่าเริ่มต้น 210 กก./ถัง (หรือ 215 กก.)
  const [drumsCountA, setDrumsCountA] = useState<number>(2);
  const [kgPerDrumPoly, setKgPerDrumPoly] = useState<number>(currentStock.drumCapacityPolyKg || 210);
  const [polyDrumStart, setPolyDrumStart] = useState<string>('ถัง #A01');
  const [customPolyDrums, setCustomPolyDrums] = useState<string[]>([]);
  const [isEditingPolyList, setIsEditingPolyList] = useState(false);

  // ISO (Part B) - ค่าเริ่มต้น 250 กก./ถัง
  const [drumsCountB, setDrumsCountB] = useState<number>(2);
  const [kgPerDrumIso, setKgPerDrumIso] = useState<number>(currentStock.drumCapacityIsoKg || 250);
  const [isoDrumStart, setIsoDrumStart] = useState<string>('ถัง #B01');
  const [customIsoDrums, setCustomIsoDrums] = useState<string[]>([]);
  const [isEditingIsoList, setIsEditingIsoList] = useState(false);

  const [supplier, setSupplier] = useState('');
  const [recordedBy, setRecordedBy] = useState('ผู้ดูแลสต๊อก');
  const [notes, setNotes] = useState('');

  // Density (K) ที่น้ำยาตัวนี้ผลิตได้ (เช่น 25k, 28k, 30k, 35k, 40k)
  const [supportedDensities, setSupportedDensities] = useState<string[]>(['30k']);
  const [customDensityInput, setCustomDensityInput] = useState('');

  // เมื่อเปิด modal โหลดข้อมูลเดิมกรณีแก้ไข หรือตรวจหาเลขเริ่มต้นของถังให้อัตโนมัติกรณีเพิ่มใหม่
  useEffect(() => {
    if (!isOpen) return;

    if (editingRecord) {
      setChemicalName(editingRecord.chemicalName || 'K-Foam 32');
      setChemicalType(editingRecord.chemicalType || 'both');
      setDate(editingRecord.date || todayLocalYMD());
      setSupplier(editingRecord.supplier || '');
      setRecordedBy(editingRecord.recordedBy || 'ผู้ดูแลสต๊อก');
      setNotes(editingRecord.notes || '');
      {
        const list = normalizeDensityList(editingRecord.supportedDensities);
        setSupportedDensities(list.length > 0 ? sortDensityList(list) : ['30k']);
      }

      if (editingRecord.polyDrumNumbers && editingRecord.polyDrumNumbers.length > 0) {
        setDrumsCountA(editingRecord.polyDrumNumbers.length);
        setCustomPolyDrums(editingRecord.polyDrumNumbers);
        setIsEditingPolyList(true);
        setPolyDrumStart(editingRecord.polyDrumNumbers[0] || 'ถัง #A01');
      } else {
        setDrumsCountA(editingRecord.chemicalType === 'part_b' ? 0 : 2);
      }

      if (editingRecord.isoDrumNumbers && editingRecord.isoDrumNumbers.length > 0) {
        setDrumsCountB(editingRecord.isoDrumNumbers.length);
        setCustomIsoDrums(editingRecord.isoDrumNumbers);
        setIsEditingIsoList(true);
        setIsoDrumStart(editingRecord.isoDrumNumbers[0] || 'ถัง #B01');
      } else {
        setDrumsCountB(editingRecord.chemicalType === 'part_a' ? 0 : 2);
      }
    } else {
      const nextA = suggestNextDrumNumber(allExistingDrums, 'part_a', chemicalName);
      const nextB = suggestNextDrumNumber(allExistingDrums, 'part_b', chemicalName);
      setPolyDrumStart(nextA);
      setIsoDrumStart(nextB);
      setIsEditingPolyList(false);
      setIsEditingIsoList(false);
    }
  }, [isOpen, editingRecord]);

  // คำนวณรายการหมายเลขถังที่รันต่อกันโดยอัตโนมัติ
  const generatedPolyDrums = useMemo(() => {
    return parseAndGenerateConsecutiveNumbers(polyDrumStart, drumsCountA, 'ถัง #A01');
  }, [polyDrumStart, drumsCountA]);

  const generatedIsoDrums = useMemo(() => {
    return parseAndGenerateConsecutiveNumbers(isoDrumStart, drumsCountB, 'ถัง #B01');
  }, [isoDrumStart, drumsCountB]);

  // รายการถังที่จะบันทึกจริง (ถ้าผู้ใช้ปรับแต่งเองให้ใช้ custom มิฉะนั้นใช้ generated)
  const finalPolyDrums = useMemo(() => {
    if (isEditingPolyList && customPolyDrums.length === drumsCountA) {
      return customPolyDrums;
    }
    return generatedPolyDrums;
  }, [isEditingPolyList, customPolyDrums, generatedPolyDrums, drumsCountA]);

  const finalIsoDrums = useMemo(() => {
    if (isEditingIsoList && customIsoDrums.length === drumsCountB) {
      return customIsoDrums;
    }
    return generatedIsoDrums;
  }, [isEditingIsoList, customIsoDrums, generatedIsoDrums, drumsCountB]);

  if (!isOpen) return null;

  // Real-time calculation
  const totalKgA = (chemicalType === 'both' || chemicalType === 'part_a') ? drumsCountA * kgPerDrumPoly : 0;
  const totalKgB = (chemicalType === 'both' || chemicalType === 'part_b') ? drumsCountB * kgPerDrumIso : 0;
  const grandTotalKg = totalKgA + totalKgB;

  const handleUpdateSinglePolyDrum = (index: number, val: string) => {
    const list = [...finalPolyDrums];
    list[index] = val;
    setCustomPolyDrums(list);
    setIsEditingPolyList(true);
  };

  const handleUpdateSingleIsoDrum = (index: number, val: string) => {
    const list = [...finalIsoDrums];
    list[index] = val;
    setCustomIsoDrums(list);
    setIsEditingIsoList(true);
  };

  const addCustomDensity = () => {
    const raw = customDensityInput.trim();
    if (!raw) return;
    const k = normalizeDensityK(raw);
    if (!k) {
      showToast('กรุณากรอก Density เป็นตัวเลข เช่น 32 หรือ 32k', 'info');
      return;
    }
    if (!supportedDensities.includes(k)) {
      setSupportedDensities(sortDensityList([...supportedDensities, k]));
    }
    setCustomDensityInput('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chemicalName.trim()) {
      showToast('กรุณาระบุชื่อของน้ำยา', 'info');
      return;
    }
    if (grandTotalKg <= 0) {
      showToast('กรุณาระบุจำนวนถังน้ำยาที่รับเข้า', 'info');
      return;
    }

    const hasPoly = chemicalType === 'both' || chemicalType === 'part_a';
    const hasIso = chemicalType === 'both' || chemicalType === 'part_b';

    const recordedPolyDrums = hasPoly ? finalPolyDrums : [];
    const recordedIsoDrums = hasIso ? finalIsoDrums : [];
    const allDrums = [...recordedPolyDrums, ...recordedIsoDrums];

    const drumSummaryStr = allDrums.length > 0 
      ? allDrums.length <= 4 
        ? allDrums.join(', ')
        : `${allDrums[0]} ถึง ${allDrums[allDrums.length - 1]} (${allDrums.length} ถัง)`
      : `ถัง-${date.replace(/-/g, '').slice(2)}`;

    const isEditing = Boolean(editingRecord);
    const restockRecord: ChemicalRestockRecord = {
      id: editingRecord ? editingRecord.id : `restock-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      chemicalName: chemicalName.trim(),
      date,
      drumNumber: drumSummaryStr,
      drumNumbers: allDrums,
      polyDrumNumbers: recordedPolyDrums,
      isoDrumNumbers: recordedIsoDrums,
      lotNumber: drumSummaryStr,
      chemicalType,
      drumsCount: (chemicalType === 'both' ? drumsCountA + drumsCountB : chemicalType === 'part_a' ? drumsCountA : drumsCountB),
      kgPerDrum: chemicalType === 'part_b' ? kgPerDrumIso : kgPerDrumPoly,
      totalKgAdded: grandTotalKg,
      partAKgAdded: totalKgA,
      partBKgAdded: totalKgB,
      supplier: supplier.trim(),
      supportedDensities: supportedDensities.length > 0 ? sortDensityList(normalizeDensityList(supportedDensities)) : ['30k'],
      recordedBy: recordedBy.trim() || 'ผู้ดูแลสต๊อก',
      notes: notes.trim(),
      createdAt: editingRecord ? editingRecord.createdAt : new Date().toISOString(),
    };

    let updatedStock: ChemicalStock;
    if (editingRecord) {
      const diffA = totalKgA - (editingRecord.partAKgAdded || 0);
      const diffB = totalKgB - (editingRecord.partBKgAdded || 0);
      updatedStock = {
        ...currentStock,
        partAStockKg: round2(Math.max(0, currentStock.partAStockKg + diffA)),
        partBStockKg: round2(Math.max(0, currentStock.partBStockKg + diffB)),
        drumCapacityPolyKg: kgPerDrumPoly,
        drumCapacityIsoKg: kgPerDrumIso,
        updatedAt: new Date().toISOString(),
      };
      onConfirmRestock(restockRecord, updatedStock);
      showToast(`บันทึกการแก้ไขรายการรับเข้าน้ำยาเรียบร้อยแล้ว`, 'success');
    } else {
      updatedStock = {
        ...currentStock,
        partAStockKg: round2(currentStock.partAStockKg + totalKgA),
        partBStockKg: round2(currentStock.partBStockKg + totalKgB),
        drumCapacityPolyKg: kgPerDrumPoly,
        drumCapacityIsoKg: kgPerDrumIso,
        updatedAt: new Date().toISOString(),
      };
      onConfirmRestock(restockRecord, updatedStock);
      showToast(`รับเข้าน้ำยาสำเร็จ (+${grandTotalKg.toLocaleString()} กก.) รันเลขถัง ${allDrums.length} ถัง แยก Stock Card เรียบร้อย`);
    }

    onClose();
  };

  const isEditing = Boolean(editingRecord);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className={`flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 ${isEditing ? 'bg-amber-500/10' : 'bg-emerald-50/70'}`}>
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold shadow-xs ${isEditing ? 'bg-amber-500 text-slate-950' : 'bg-emerald-600 text-white'}`}>
              {isEditing ? <Edit3 className="w-5 h-5" /> : <PackagePlus className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                {isEditing ? 'แก้ไขรายการรับเข้าน้ำยา PU' : 'รับเข้าน้ำยา PU (เพิ่มสต๊อกถัง)'}
              </h3>
              <p className="text-xs text-slate-500">
                {isEditing ? 'แก้ไขข้อมูลการรับเข้า • อัปเดต No. ถังและยอดสต๊อกอัตโนมัติ' : 'รัน No. ถังต่อกันอัตโนมัติ • แยกบัตรสต๊อก (Stock Card) แต่ละถัง'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {/* Chemical Type Selector */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">
              เลือกชนิดน้ำยาที่รับเข้า
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setChemicalType('both')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  chemicalType === 'both'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                รับทั้งคู่ (Poly + ISO)
              </button>
              <button
                type="button"
                onClick={() => setChemicalType('part_a')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  chemicalType === 'part_a'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                เฉพาะ Poly (210/215 กก.)
              </button>
              <button
                type="button"
                onClick={() => setChemicalType('part_b')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  chemicalType === 'part_b'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                เฉพาะ ISO (250 กก.)
              </button>
            </div>
          </div>

          {/* Chemical Name (ชื่อของน้ำยา - ยี่ห้อแยกอิสระ) */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <span>ชื่อของน้ำยา / ยี่ห้อ (Chemical Name / Brand)</span>
                <span className="text-rose-500">*</span>
              </label>
              <span className="text-[10px] text-slate-500">
                แยกตามยี่ห้อ ไม่เขียนทับข้อมูลเดิม
              </span>
            </div>
            <input
              type="text"
              required
              placeholder="เช่น K-Foam 32, Dow Voranol, Wanhua PM-200, Huntsman"
              value={chemicalName}
              onChange={(e) => setChemicalName(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
            />
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-slate-400">ยี่ห้อในระบบ:</span>
              {allExistingBrands.map(name => (
                <button
                  key={name}
                  type="button"
                  onClick={() => {
                    setChemicalName(name);
                    if (!isEditingPolyList) {
                      setPolyDrumStart(suggestNextDrumNumber(allExistingDrums, 'part_a', name));
                    }
                    if (!isEditingIsoList) {
                      setIsoDrumStart(suggestNextDrumNumber(allExistingDrums, 'part_b', name));
                    }
                  }}
                  className={`text-[10px] px-2 py-0.5 rounded cursor-pointer transition-colors ${
                    chemicalName === name
                      ? 'bg-emerald-600 text-white font-bold'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>

          {/* Density K Support (น้ำยาตัวนี้ผลิตได้กี่ K - บางตัวผลิตได้ 3 density) */}
          <div className="bg-amber-50/70 p-3.5 rounded-xl border border-amber-200 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-600" />
                <span>น้ำยาตัวนี้ผลิตได้กี่ K (รองรับ Density)</span>
              </label>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-950 font-mono">
                {supportedDensities.length > 0 ? `รองรับ ${supportedDensities.length} Density` : 'ยังไม่ได้เลือก'}
              </span>
            </div>
            <p className="text-[11px] text-slate-600">
              น้ำยาบางรุ่นผลิตได้ 1 - 3 density (เช่น 25k, 28k, 30k) ติ๊กเลือก K ที่น้ำยานี้รองรับเพื่อใช้จับคู่กับใบงานตอนตัดสต๊อก:
            </p>
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              {sortDensityList(Array.from(new Set([...DENSITY_K_PRESETS, ...supportedDensities]))).map((k) => {
                const isSelected = supportedDensities.includes(k);
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        setSupportedDensities(supportedDensities.filter(item => item !== k));
                      } else {
                        setSupportedDensities(sortDensityList([...supportedDensities, k]));
                      }
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-amber-500 text-slate-950 border border-amber-500 shadow-2xs'
                        : 'bg-white text-slate-700 border border-slate-300 hover:bg-amber-50 hover:border-amber-300'
                    }`}
                  >
                    {isSelected ? <Check className="w-3.5 h-3.5 stroke-[2.5]" /> : <span className="w-3.5 text-center text-slate-300">+</span>}
                    <span>{k}</span>
                  </button>
                );
              })}
              {/* กรอก K เอง */}
              <div className="flex items-center gap-1 ml-auto">
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="K อื่น เช่น 32"
                  value={customDensityInput}
                  onChange={(e) => setCustomDensityInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addCustomDensity();
                    }
                  }}
                  className="w-24 px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold focus:ring-2 focus:ring-amber-500 outline-none"
                />
                <button
                  type="button"
                  onClick={addCustomDensity}
                  className="px-2 py-1 rounded-lg bg-amber-600 text-white text-[10px] font-bold cursor-pointer"
                >
                  + เพิ่ม
                </button>
              </div>
            </div>
            {supportedDensities.length > 0 && (
              <div className="text-[11px] text-amber-900 font-semibold pt-0.5">
                ✓ ถังน้ำยานี้พร้อมตัดสำหรับใบงาน: <strong className="font-mono text-amber-950">{supportedDensities.join(', ')}</strong>
              </div>
            )}
          </div>

          {/* Date */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              วันที่รับเข้า <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
            />
          </div>

          {/* Part A: Poly Controls with Auto-run Drum Numbers */}
          {(chemicalType === 'both' || chemicalType === 'part_a') && (
            <div className="bg-emerald-50/50 rounded-xl p-3.5 border border-emerald-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                  <span>น้ำยา Poly (Part A)</span>
                </span>
                <span className="text-xs font-mono font-bold text-emerald-800">
                  รวม: {totalKgA.toLocaleString()} กก. ({drumsCountA} ถัง)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    จำนวนถัง Poly
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={drumsCountA}
                    onChange={(e) => {
                      const count = Math.max(1, Number(e.target.value));
                      setDrumsCountA(count);
                      setIsEditingPolyList(false);
                    }}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-emerald-900 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    ขนาดต่อถัง (กก.)
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="50"
                      max="1000"
                      required
                      value={kgPerDrumPoly}
                      onChange={(e) => setKgPerDrumPoly(Number(e.target.value))}
                      className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-emerald-900 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                    />
                  </div>
                  <div className="flex gap-1 mt-1">
                    <button
                      type="button"
                      onClick={() => setKgPerDrumPoly(210)}
                      className={`text-[10px] px-2 py-0.5 rounded cursor-pointer ${kgPerDrumPoly === 210 ? 'bg-emerald-600 text-white font-bold' : 'bg-white border border-emerald-300 text-emerald-900'}`}
                    >
                      210 กก.
                    </button>
                    <button
                      type="button"
                      onClick={() => setKgPerDrumPoly(215)}
                      className={`text-[10px] px-2 py-0.5 rounded cursor-pointer ${kgPerDrumPoly === 215 ? 'bg-emerald-600 text-white font-bold' : 'bg-white border border-emerald-300 text-emerald-900'}`}
                    >
                      215 กก.
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    No. ถัง Poly เริ่มต้น
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="เช่น ถัง #A01 หรือ A01"
                    value={polyDrumStart}
                    onChange={(e) => {
                      setPolyDrumStart(e.target.value);
                      setIsEditingPolyList(false);
                    }}
                    className="w-full px-2.5 py-1.5 bg-white border border-emerald-400 rounded-lg text-xs font-mono font-bold text-emerald-900 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                  <span className="text-[10px] text-emerald-700 block mt-0.5">
                    ระบบจะรัน No. ต่อจากนี้
                  </span>
                </div>
              </div>

              {/* Sequential Drum Number Badges (Preview & Individual Edit) */}
              <div className="bg-white rounded-lg p-2.5 border border-emerald-200 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-emerald-950 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    <span>หมายเลขถังที่จะถูกสร้างในระบบ ({finalPolyDrums.length} ถัง):</span>
                  </span>
                  <span className="text-[10px] text-slate-500">
                    แยกบัตรสต๊อก 1 ถัง = 1 Stock Card
                  </span>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {finalPolyDrums.map((drumNo, idx) => (
                    <div
                      key={idx}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs font-mono font-bold shadow-2xs"
                    >
                      <span>{drumNo}</span>
                      <span className="text-[10px] text-emerald-700 font-normal">({kgPerDrumPoly}กก.)</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Part B: ISO Controls with Auto-run Drum Numbers */}
          {(chemicalType === 'both' || chemicalType === 'part_b') && (
            <div className="bg-indigo-50/50 rounded-xl p-3.5 border border-indigo-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
                  <span>น้ำยา ISO (Part B)</span>
                </span>
                <span className="text-xs font-mono font-bold text-indigo-800">
                  รวม: {totalKgB.toLocaleString()} กก. ({drumsCountB} ถัง)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    จำนวนถัง ISO
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={drumsCountB}
                    onChange={(e) => {
                      const count = Math.max(1, Number(e.target.value));
                      setDrumsCountB(count);
                      setIsEditingIsoList(false);
                    }}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-indigo-900 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    ขนาดต่อถัง (กก.)
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="50"
                      max="1000"
                      required
                      value={kgPerDrumIso}
                      onChange={(e) => setKgPerDrumIso(Number(e.target.value))}
                      className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-indigo-900 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                    />
                  </div>
                  <div className="flex gap-1 mt-1">
                    <button
                      type="button"
                      onClick={() => setKgPerDrumIso(250)}
                      className={`text-[10px] px-2 py-0.5 rounded cursor-pointer ${kgPerDrumIso === 250 ? 'bg-indigo-600 text-white font-bold' : 'bg-white border border-indigo-300 text-indigo-900'}`}
                    >
                      250 กก. (มาตรฐาน)
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    No. ถัง ISO เริ่มต้น
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="เช่น ถัง #B01 หรือ B01"
                    value={isoDrumStart}
                    onChange={(e) => {
                      setIsoDrumStart(e.target.value);
                      setIsEditingIsoList(false);
                    }}
                    className="w-full px-2.5 py-1.5 bg-white border border-indigo-400 rounded-lg text-xs font-mono font-bold text-indigo-900 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                  <span className="text-[10px] text-indigo-700 block mt-0.5">
                    ระบบจะรัน No. ต่อจากนี้
                  </span>
                </div>
              </div>

              {/* Sequential Drum Number Badges (Preview & Individual Edit) */}
              <div className="bg-white rounded-lg p-2.5 border border-indigo-200 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-indigo-950 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    <span>หมายเลขถัง ISO ที่จะถูกสร้างในระบบ ({finalIsoDrums.length} ถัง):</span>
                  </span>
                  <span className="text-[10px] text-slate-500">
                    แยกบัตรสต๊อก 1 ถัง = 1 Stock Card
                  </span>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {finalIsoDrums.map((drumNo, idx) => (
                    <div
                      key={idx}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-900 border border-indigo-300 text-xs font-mono font-bold shadow-2xs"
                    >
                      <span>{drumNo}</span>
                      <span className="text-[10px] text-indigo-700 font-normal">({kgPerDrumIso}กก.)</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Real-time Summary Card */}
          <div className="bg-slate-900 text-white rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">ยอดน้ำยารวมที่จะรับเข้า:</span>
              <span className="text-base font-bold text-amber-300 font-mono">
                +{grandTotalKg.toLocaleString()} กก.
              </span>
            </div>

            <div className="pt-2 border-t border-slate-800 grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-300">
              <div>
                <span>Poly: </span>
                <strong className="text-emerald-400">+{totalKgA} กก.</strong>
                <span className="text-slate-400 text-[10px] block">
                  ({drumsCountA} ถัง • สต๊อกใหม่: {round2(currentStock.partAStockKg + totalKgA)} กก.)
                </span>
              </div>
              <div>
                <span>ISO: </span>
                <strong className="text-indigo-400">+{totalKgB} กก.</strong>
                <span className="text-slate-400 text-[10px] block">
                  ({drumsCountB} ถัง • สต๊อกใหม่: {round2(currentStock.partBStockKg + totalKgB)} กก.)
                </span>
              </div>
            </div>
          </div>

          {/* Supplier & Operator */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                ผู้จัดจำหน่าย / ยี่ห้อ
              </label>
              <input
                type="text"
                placeholder="เช่น Dow, Huntsman, BASF, Wanhua"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                ผู้บันทึกรับเข้า
              </label>
              <input
                type="text"
                value={recordedBy}
                onChange={(e) => setRecordedBy(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              หมายเหตุเพิ่มเติม
            </label>
            <input
              type="text"
              placeholder="เช่น รถส่งสินค้าเที่ยวเช้า ตรวจสภาพถังสมบูรณ์"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
            />
          </div>

          {/* Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={grandTotalKg <= 0}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs shadow-xs transition-all cursor-pointer active:scale-95 flex items-center gap-1.5"
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span>{editingRecord ? 'บันทึกแก้ไขรายการรับเข้า' : `บันทึกรับเข้าน้ำยา (+${grandTotalKg.toLocaleString()} กก.)`}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
