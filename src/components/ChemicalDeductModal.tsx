import React, { useState, useMemo, useEffect } from 'react';
import { 
  ChemicalFormula, 
  ChemicalStock, 
  StockCutRecord, 
  PuSandwichCutRecord,
  ChemicalCutRecord,
  ChemicalRestockRecord 
} from '../types';
import { 
  extractProductionSOList, 
  ExtractedProductionSO, 
  calculateChemicalUsage, 
  executeChemicalCut,
  buildDrumStockCards,
  sortDrumsByLowestNumber,
  findDrumInStock
} from '../utils/chemicalStock';
import { round2, formatMeters, todayLocalYMD } from '../utils/formatters';
import { DENSITY_K_PRESETS, normalizeDensityK, normalizeDensityList, densityListSupports } from '../utils/density';
import { 
  X, 
  Scissors, 
  Beaker, 
  Search, 
  Check, 
  AlertTriangle, 
  AlertCircle,
  Layers, 
  ArrowRight, 
  History, 
  Calendar,
  Sparkles,
  Info,
  ChevronRight,
  Gauge,
  Timer,
  Scale,
  CheckSquare,
  Square
} from 'lucide-react';

interface ChemicalDeductModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentStock: ChemicalStock;
  formulas: ChemicalFormula[];
  foilRecords: StockCutRecord[];
  puRecords: PuSandwichCutRecord[];
  chemicalCutRecords: ChemicalCutRecord[];
  restockRecords?: ChemicalRestockRecord[];
  onConfirmCut: (cutRecord: ChemicalCutRecord, updatedStock: ChemicalStock) => void;
  onOpenManageFormulas?: () => void;
  showToast: (text: string, type?: 'success' | 'info') => void;
}

export const ChemicalDeductModal: React.FC<ChemicalDeductModalProps> = ({
  isOpen,
  onClose,
  currentStock,
  formulas,
  foilRecords,
  puRecords,
  chemicalCutRecords,
  restockRecords = [],
  onConfirmCut,
  onOpenManageFormulas,
  showToast,
}) => {
  const [activeInputMode, setActiveInputMode] = useState<'pick_so' | 'manual'>('pick_so');

  // Search filter for available SO list
  const [soSearchQuery, setSoSearchQuery] = useState('');
  const [selectedSoItem, setSelectedSoItem] = useState<ExtractedProductionSO | null>(null);
  // รายการ SO ที่ติ๊กเลือกหลายใบพร้อมกัน
  const [selectedSoItems, setSelectedSoItems] = useState<ExtractedProductionSO[]>([]);

  // Density K ของใบงาน (25k, 28k, 30k, 35k, 40k)
  const COMMON_DENSITY_K = DENSITY_K_PRESETS;
  const [selectedDensityK, setSelectedDensityK] = useState<string>('30k');
  const [customKInput, setCustomKInput] = useState('');

  // Selected or manual SO parameters
  const [soNumber, setSoNumber] = useState('');
  const [cutDate, setCutDate] = useState(() => todayLocalYMD());
  const [usedMeters, setUsedMeters] = useState<number>(0);
  const [ngMeters, setNgMeters] = useState<number>(0);
  const [recordedBy, setRecordedBy] = useState('ช่างคุมเครื่อง');
  const [notes, setNotes] = useState('');
  const [source, setSource] = useState<'foil_cut' | 'sandwich_cut' | 'manual'>('foil_cut');

  // Selected formula
  const defaultFormula = useMemo(() => {
    return formulas.find(f => f.isDefault) || formulas[0] || {
      id: 'default',
      name: 'โฟมมาตรฐาน 1 นิ้ว (25 มม.)',
      density: 'Density 32',
      densities: ['Density 32'],
      inchSize: '1 นิ้ว',
      drumNumber: 'ถัง #A01 / #B01',
      foamThicknessMm: 25,
      polyWeightKg: 0.283,
      polySeconds: 5,
      polyFlowRatePerMin: 3.40,
      isoWeightKg: 0.283,
      isoSeconds: 5,
      isoFlowRatePerMin: 3.40,
      totalFlowRatePerMin: 6.80,
      defaultLineSpeedMPerMin: 8.0,
      usageRatePerMeter: 0.85,
      ngRatePerMeter: 0.85,
      partARatioPercent: 50,
      partBRatioPercent: 50,
    };
  }, [formulas]);

  const [selectedFormulaId, setSelectedFormulaId] = useState<string>(() => defaultFormula.id);
  const activeFormula = useMemo(() => {
    return formulas.find(f => f.id === selectedFormulaId) || defaultFormula;
  }, [formulas, selectedFormulaId, defaultFormula]);

  // ---- ผูก Density (K) ของใบงาน ↔ สูตร ↔ ถัง Poly ----
  const densitiesOfFormula = (f: ChemicalFormula): string[] =>
    normalizeDensityList(f.densities && f.densities.length > 0 ? f.densities : f.density);
  const formulaDensities = useMemo(() => densitiesOfFormula(activeFormula), [activeFormula]);
  const formulaSupportsK = densityListSupports(formulaDensities, selectedDensityK);

  // เลือก K ของใบงาน: ถ้าสูตรปัจจุบันไม่รองรับ K นี้ ให้สลับไปสูตรที่รองรับ (นิ้วเดียวกันก่อน)
  const handlePickDensityK = (kRaw: string) => {
    const k = normalizeDensityK(kRaw);
    if (!k) return;
    setSelectedDensityK(k);
    if (!densityListSupports(formulaDensities, k)) {
      const candidates = formulas.filter(f => densitiesOfFormula(f).includes(k));
      const alt = candidates.find(f => f.inchSize === activeFormula.inchSize) || candidates[0];
      if (alt && alt.id !== activeFormula.id) {
        setSelectedFormulaId(alt.id);
        showToast(`สลับสูตรเป็น "${alt.name}" ให้ตรงกับใบงาน ${k}`, 'info');
      }
    }
  };

  const commitCustomK = () => {
    const raw = customKInput.trim();
    if (!raw) return;
    const k = normalizeDensityK(raw);
    if (!k) {
      showToast('กรุณากรอก K เป็นตัวเลข เช่น 32 หรือ 32k', 'info');
      return;
    }
    handlePickDensityK(k);
    setCustomKInput('');
  };

  // ค่า Density ที่เลือกใช้สำหรับใบงานนี้ (กรณีสูตรรองรับมากกว่า 1 ค่า)
  const [selectedDensity, setSelectedDensity] = useState<string>(() => {
    return activeFormula.densities?.[0] || activeFormula.density || 'Density 32';
  });

  // ความเร็วสายพานที่ใช้ผลิตจริง (Conveyor Line Speed: เมตร/นาที)
  const [actualLineSpeed, setActualLineSpeed] = useState<number>(() => {
    return activeFormula.defaultLineSpeedMPerMin || 8.0;
  });

  // ถังน้ำยาพร้อมใช้ในคลัง (แยกตาม Poly และ ISO)
  const availableDrumCards = useMemo(() => {
    return buildDrumStockCards(restockRecords, chemicalCutRecords);
  }, [restockRecords, chemicalCutRecords]);

  // ตัวเลือกชนิด/ยี่ห้อของน้ำยา Poly และ ISO ก่อนตัด
  const availablePolyBrands = useMemo(() => {
    const list = availableDrumCards.filter(d => d.chemicalType === 'part_a').map(d => d.chemicalName);
    return Array.from(new Set(list));
  }, [availableDrumCards]);

  const availableIsoBrands = useMemo(() => {
    const list = availableDrumCards.filter(d => d.chemicalType === 'part_b').map(d => d.chemicalName);
    return Array.from(new Set(list));
  }, [availableDrumCards]);

  const [selectedPolyBrand, setSelectedPolyBrand] = useState<string>('all');
  const [selectedIsoBrand, setSelectedIsoBrand] = useState<string>('all');

  // ปุ่มติ๊กให้กรอกเลขถังเอง (หากไม่ติ๊ก ระบบจะตัดถังเบอร์น้อยที่สุดก่อนโดยอัตโนมัติ FIFO)
  const [isManualDrumEntry, setIsManualDrumEntry] = useState<boolean>(false);

  // ถังน้ำยา Poly ที่พร้อมใช้ เรียงตามเบอร์น้อยที่สุดก่อน (FIFO)
  const sortedPolyDrums = useMemo(() => {
    const list = availableDrumCards.filter(d => 
      d.chemicalType === 'part_a' && 
      d.status !== 'empty' && 
      (selectedPolyBrand === 'all' || d.chemicalName === selectedPolyBrand) &&
      densityListSupports(d.supportedDensities, selectedDensityK)
    );
    return sortDrumsByLowestNumber(list);
  }, [availableDrumCards, selectedPolyBrand, selectedDensityK]);

  // ถังน้ำยา ISO ที่พร้อมใช้ เรียงตามเบอร์น้อยที่สุดก่อน (FIFO)
  const sortedIsoDrums = useMemo(() => {
    const list = availableDrumCards.filter(d => 
      d.chemicalType === 'part_b' && 
      d.status !== 'empty' && 
      (selectedIsoBrand === 'all' || d.chemicalName === selectedIsoBrand)
    );
    return sortDrumsByLowestNumber(list);
  }, [availableDrumCards, selectedIsoBrand]);

  const lowestPolyDrum = sortedPolyDrums[0] || null;
  const lowestIsoDrum = sortedIsoDrums[0] || null;

  // No. ถังน้ำยาที่ใช้ในไลน์ผลิตจริง
  const [polyDrumNumber, setPolyDrumNumber] = useState<string>('ถัง #A01');
  const [isoDrumNumber, setIsoDrumNumber] = useState<string>('ถัง #B01');

  // เมื่อไม่ได้ติ๊กกรอกเอง ให้เลือกลงถังที่เบอร์น้อยที่สุดก่อนเสมอ (FIFO)
  useEffect(() => {
    if (!isManualDrumEntry) {
      if (lowestPolyDrum) {
        setPolyDrumNumber(lowestPolyDrum.drumNumber);
      }
      if (lowestIsoDrum) {
        setIsoDrumNumber(lowestIsoDrum.drumNumber);
      }
    }
  }, [isManualDrumEntry, lowestPolyDrum, lowestIsoDrum, selectedPolyBrand, selectedIsoBrand]);

  // อัปเดตความเร็วสายพานและ density เมื่อเปลี่ยนสูตร
  useEffect(() => {
    if (activeFormula.defaultLineSpeedMPerMin) {
      setActualLineSpeed(activeFormula.defaultLineSpeedMPerMin);
    }
    // เปลี่ยนสูตรแล้ว K เดิมไม่อยู่ในรายการของสูตรใหม่ → เปลี่ยนเป็น K แรกของสูตร
    const list = normalizeDensityList(
      activeFormula.densities && activeFormula.densities.length > 0 ? activeFormula.densities : activeFormula.density
    );
    setSelectedDensityK(prev => (list.length === 0 || list.includes(prev) ? prev : list[0]));
  }, [selectedFormulaId, activeFormula]);

  // ตรวจสอบความถูกต้องของเลขถังในระบบ (Validation)
  const polyValidation = useMemo(() => {
    return findDrumInStock(
      polyDrumNumber,
      'part_a',
      availableDrumCards,
      selectedPolyBrand === 'all' ? undefined : selectedPolyBrand
    );
  }, [polyDrumNumber, availableDrumCards, selectedPolyBrand]);

  const isoValidation = useMemo(() => {
    return findDrumInStock(
      isoDrumNumber,
      'part_b',
      availableDrumCards,
      selectedIsoBrand === 'all' ? undefined : selectedIsoBrand
    );
  }, [isoDrumNumber, availableDrumCards, selectedIsoBrand]);

  const hasDrumValidationError = !polyValidation.hasStock || !isoValidation.hasStock;

  // ถัง Poly ที่เลือกต้องรองรับ K ของใบงาน (ISO ไม่ผูก K) — ต้องประกาศหลัง polyValidation
  const polyKWarning = polyValidation.drum && !densityListSupports(polyValidation.drum.supportedDensities, selectedDensityK)
    ? `ถัง Poly "${polyValidation.drum.drumNumber}" ระบุรองรับ ${(polyValidation.drum.supportedDensities || []).join(', ')} แต่ใบงานเป็น ${selectedDensityK}`
    : '';

  // Extract all SOs from production records
  const availableSOs = useMemo(() => {
    return extractProductionSOList(foilRecords, puRecords, chemicalCutRecords);
  }, [foilRecords, puRecords, chemicalCutRecords]);

  // Filtered SOs based on user search
  const filteredSOs = useMemo(() => {
    if (!soSearchQuery.trim()) return availableSOs.slice(0, 30);
    const q = soSearchQuery.trim().toLowerCase();
    return availableSOs.filter(so => 
      so.soNumber.toLowerCase().includes(q) || 
      so.date.includes(q) ||
      (so.lotOrCoil && so.lotOrCoil.toLowerCase().includes(q))
    ).slice(0, 30);
  }, [availableSOs, soSearchQuery]);

  // คำนวณการใช้น้ำยาตามความเร็วสายพานจริง
  const calculationResult = useMemo(() => {
    return calculateChemicalUsage(usedMeters, ngMeters, activeFormula, actualLineSpeed);
  }, [usedMeters, ngMeters, activeFormula, actualLineSpeed]);

  if (!isOpen) return null;

  // Handle picking or toggling an SO from the production history
  const handleToggleSO = (soItem: ExtractedProductionSO) => {
    setSelectedSoItems(prev => {
      const exists = prev.some(item => item.id === soItem.id);
      let next: ExtractedProductionSO[];
      if (exists) {
        next = prev.filter(item => item.id !== soItem.id);
      } else {
        next = [...prev, soItem];
      }

      if (next.length > 0) {
        const combinedSo = next.map(i => i.soNumber).join(', ');
        const totalUsed = round2(next.reduce((sum, i) => sum + i.usedMeters, 0));
        const totalNg = round2(next.reduce((sum, i) => sum + i.ngMeters, 0));
        setSoNumber(combinedSo);
        setUsedMeters(totalUsed);
        setNgMeters(totalNg);
        setCutDate(next[0].date || todayLocalYMD());
        setSource(next[0].source);
        setSelectedSoItem(next[0]);
      } else {
        setSoNumber('');
        setUsedMeters(0);
        setNgMeters(0);
        setSelectedSoItem(null);
      }
      return next;
    });
  };

  const handleSelectSingleSO = (soItem: ExtractedProductionSO) => {
    setSelectedSoItems([soItem]);
    setSelectedSoItem(soItem);
    setSoNumber(soItem.soNumber);
    setUsedMeters(soItem.usedMeters);
    setNgMeters(soItem.ngMeters);
    setCutDate(soItem.date || todayLocalYMD());
    setSource(soItem.source);
    showToast(`ดึงข้อมูล ${soItem.soNumber}: ผลิตจริง ${soItem.usedMeters} ม., NG ${soItem.ngMeters} ม.`);
  };

  const handleSelectAllFilteredSOs = () => {
    if (filteredSOs.length === 0) return;
    setSelectedSoItems(filteredSOs);
    const combinedSo = filteredSOs.map(i => i.soNumber).join(', ');
    const totalUsed = round2(filteredSOs.reduce((sum, i) => sum + i.usedMeters, 0));
    const totalNg = round2(filteredSOs.reduce((sum, i) => sum + i.ngMeters, 0));
    setSoNumber(combinedSo);
    setUsedMeters(totalUsed);
    setNgMeters(totalNg);
    setCutDate(filteredSOs[0].date || todayLocalYMD());
    setSource(filteredSOs[0].source);
    setSelectedSoItem(filteredSOs[0]);
    showToast(`เลือกตัดพร้อมกันทั้งหมด ${filteredSOs.length} ใบงาน (รวม ${totalUsed} ม.)`);
  };

  const handleClearSelectedSOs = () => {
    setSelectedSoItems([]);
    setSelectedSoItem(null);
    setSoNumber('');
    setUsedMeters(0);
    setNgMeters(0);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!soNumber.trim()) {
      showToast('กรุณาระบุเลขที่ SO', 'info');
      return;
    }
    if (usedMeters <= 0 && ngMeters <= 0) {
      showToast('กรุณาระบุเมตรที่ผลิตจริงหรือเมตร NG', 'info');
      return;
    }
    if (actualLineSpeed <= 0) {
      showToast('กรุณาระบุความเร็วสายพานที่ใช้ผลิตจริง (เมตร/นาที)', 'info');
      return;
    }

    if (hasDrumValidationError) {
      const err = polyValidation.errorMsg || isoValidation.errorMsg || 'ไม่พบข้อมูลถังในระบบ หรือไม่มีน้ำยาเหลือ ไม่สามารถตัดสต๊อกได้';
      showToast(err, 'info');
      return;
    }

    // คำเตือนที่ไม่ใช่ error แต่ควรให้ผู้ใช้ยืนยันก่อนตัด (กันสต๊อกติดลบ / K ไม่ตรง)
    const warnings: string[] = [];
    if (!formulaSupportsK) {
      warnings.push(`สูตร "${activeFormula.name}" ระบุรองรับ ${formulaDensities.join(', ')} แต่ใบงานเป็น ${selectedDensityK}`);
    }
    if (polyKWarning) warnings.push(polyKWarning);
    if (calculationResult.partAKg > currentStock.partAStockKg) {
      warnings.push(`Poly ไม่พอ: ต้องใช้ ${calculationResult.partAKg} กก. แต่คงเหลือ ${currentStock.partAStockKg} กก. (สต๊อกจะติดลบ)`);
    }
    if (calculationResult.partBKg > currentStock.partBStockKg) {
      warnings.push(`ISO ไม่พอ: ต้องใช้ ${calculationResult.partBKg} กก. แต่คงเหลือ ${currentStock.partBStockKg} กก. (สต๊อกจะติดลบ)`);
    }
    if (polyValidation.drum && calculationResult.partAKg > polyValidation.drum.remainingKg) {
      warnings.push(`ถัง Poly "${polyValidation.drum.drumNumber}" เหลือ ${polyValidation.drum.remainingKg} กก. น้อยกว่าที่ต้องใช้ ${calculationResult.partAKg} กก.`);
    }
    if (isoValidation.drum && calculationResult.partBKg > isoValidation.drum.remainingKg) {
      warnings.push(`ถัง ISO "${isoValidation.drum.drumNumber}" เหลือ ${isoValidation.drum.remainingKg} กก. น้อยกว่าที่ต้องใช้ ${calculationResult.partBKg} กก.`);
    }
    if (warnings.length > 0) {
      const ok = window.confirm(`⚠️ พบข้อควรตรวจสอบ:\n\n- ${warnings.join('\n- ')}\n\nต้องการบันทึกการตัดสต๊อกต่อหรือไม่?`);
      if (!ok) return;
    }

    const { updatedStock, cutRecord } = executeChemicalCut({
      soNumber: soNumber.trim(),
      soNumbers: selectedSoItems.length > 0 ? selectedSoItems.map(s => s.soNumber) : undefined,
      cutDate,
      usedMeters,
      ngMeters,
      formula: activeFormula,
      chemicalName: activeFormula.name,
      density: selectedDensityK,
      densityK: selectedDensityK,
      polyChemicalName: polyValidation.drum?.chemicalName,
      isoChemicalName: isoValidation.drum?.chemicalName,
      polyDrumNumber: polyDrumNumber.trim() || undefined,
      isoDrumNumber: isoDrumNumber.trim() || undefined,
      drumNumber: polyDrumNumber.trim() && isoDrumNumber.trim() 
        ? `${polyDrumNumber.trim()} / ${isoDrumNumber.trim()}`
        : (polyDrumNumber.trim() || isoDrumNumber.trim() || activeFormula.drumNumber),
      actualLineSpeedMPerMin: Number(actualLineSpeed) || 8.0,
      recordedBy,
      notes,
      source,
      currentStock,
    });

    onConfirmCut(cutRecord, updatedStock);
    const countText = selectedSoItems.length > 1 ? ` (${selectedSoItems.length} ใบงาน)` : '';
    showToast(`ตัดสต๊อกน้ำยา SO ${soNumber}${countText} เรียบร้อยแล้ว (รวม ${calculationResult.totalChemicalKg} กก.)`);
    onClose();
  };

  const isLowStockA = currentStock.partAStockKg < calculationResult.partAKg;
  const isLowStockB = currentStock.partBStockKg < calculationResult.partBKg;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 bg-amber-500/10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold shadow-xs">
              <Scissors className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-slate-900">
                  ตัดสต๊อกน้ำยา PU จากเลข SO
                </h3>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-200 text-amber-950">
                  แยกจากสต๊อกฟอยล์
                </span>
              </div>
              <p className="text-xs text-slate-500">
                ดึงข้อมูล SO ผลิตจริง + NG → ผูกความเร็วสายพานผลิตจริง → คำนวณตัดสต็อกน้ำยาอัตโนมัติ
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

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5">
          {/* Section 1: Mode Switcher (Pick SO vs Manual Input) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-[11px] font-bold flex items-center justify-center">1</span>
                <span>เลือกหรือระบุเลขที่ SO ที่ผลิตจริง</span>
              </span>
              <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg text-xs">
                <button
                  type="button"
                  onClick={() => setActiveInputMode('pick_so')}
                  className={`px-3 py-1 rounded-md font-bold transition-all cursor-pointer ${
                    activeInputMode === 'pick_so'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  ดึงจาก SO ที่ผลิตจริง ({availableSOs.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveInputMode('manual');
                    setSelectedSoItem(null);
                    setSource('manual');
                  }}
                  className={`px-3 py-1 rounded-md font-bold transition-all cursor-pointer ${
                    activeInputMode === 'manual'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  คีย์เองอิสระ
                </button>
              </div>
            </div>

            {/* Sub-view: Pick from SO list */}
            {activeInputMode === 'pick_so' && (
              <div className="bg-slate-50/80 rounded-2xl p-3.5 border border-slate-200/80 space-y-2.5">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="ค้นหาเลขที่ SO, วันที่, หรือม้วนฟอยล์..."
                      value={soSearchQuery}
                      onChange={(e) => setSoSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                    />
                  </div>

                  {/* Multi-SO Action Buttons */}
                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                    <button
                      type="button"
                      onClick={handleSelectAllFilteredSOs}
                      className="px-2.5 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-bold transition-colors cursor-pointer"
                      title="เลือกทุกใบงานที่แสดงในตาราง"
                    >
                      ✓ เลือกทั้งหมด ({filteredSOs.length})
                    </button>
                    {selectedSoItems.length > 0 && (
                      <button
                        type="button"
                        onClick={handleClearSelectedSOs}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                      >
                        ล้างที่เลือก
                      </button>
                    )}
                  </div>
                </div>

                {/* Selected Multi-SO Banner */}
                {selectedSoItems.length > 0 && (
                  <div className="p-2.5 rounded-xl bg-amber-100 border border-amber-300 text-amber-950 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 font-bold flex items-center justify-center text-[11px] shrink-0">
                        {selectedSoItems.length}
                      </span>
                      <span>
                        ติ๊กเลือกตัดพร้อมกัน <strong>{selectedSoItems.length} ใบงาน</strong>: ผลิตจริงรวม <strong>{usedMeters} ม.</strong> (NG รวม {ngMeters} ม.)
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-amber-800 line-clamp-1 truncate max-w-xs">
                      {selectedSoItems.map(s => s.soNumber).join(', ')}
                    </span>
                  </div>
                )}

                <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
                  {filteredSOs.length === 0 ? (
                    <div className="text-center py-6 text-xs text-slate-400">
                      ไม่พบรายการ SO ตามคำค้นหา หรือยังไม่มีประวัติการผลิต
                    </div>
                  ) : (
                    filteredSOs.map((soItem) => {
                      const isTicked = selectedSoItems.some(item => item.id === soItem.id);
                      return (
                        <div
                          key={soItem.id}
                          onClick={() => handleToggleSO(soItem)}
                          className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer select-none ${
                            isTicked
                              ? 'bg-amber-100/90 border-amber-400 shadow-2xs ring-1 ring-amber-400/50'
                              : 'bg-white border-slate-200/70 hover:border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {/* Checkbox ติ๊กเพื่อเลือกตัดได้ทีละหลายใบ */}
                            <input
                              type="checkbox"
                              checked={isTicked}
                              onChange={() => handleToggleSO(soItem)}
                              onClick={(e) => e.stopPropagation()}
                              className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500 cursor-pointer shrink-0"
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono font-bold text-xs sm:text-sm text-slate-900">
                                  {soItem.soNumber}
                                </span>
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-mono">
                                  {soItem.sourceTitle}
                                </span>
                                {soItem.alreadyDeducted && (
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-semibold flex items-center gap-0.5">
                                    <Check className="w-2.5 h-2.5" /> ตัดน้ำยาแล้ว
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5 font-mono">
                                <span>{soItem.date}</span>
                                {soItem.lotOrCoil && <span>• {soItem.lotOrCoil}</span>}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <div className="text-right font-mono text-xs">
                              <div className="font-bold text-slate-900">
                                {formatMeters(soItem.totalMeters)} ม.
                              </div>
                              <div className="text-[10px] text-slate-500">
                                จริง {soItem.usedMeters} + NG {soItem.ngMeters} ม.
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectSingleSO(soItem);
                              }}
                              className="px-2 py-1 rounded-md text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer hidden sm:inline-block"
                              title="เลือกตัดเฉพาะใบนี้ใบเดียว"
                            >
                              เฉพาะใบนี้
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* Selected or Manual SO Form Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="sm:col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700">
                    เลขที่ SO <span className="text-rose-500">*</span>
                  </label>
                  {selectedSoItems.length > 1 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-200 text-amber-950 font-mono">
                      ตัดรวม {selectedSoItems.length} ใบงาน
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  required
                  placeholder="เช่น so2608123 หรือเลือกจากรายการด้านบน"
                  value={soNumber}
                  onChange={(e) => setSoNumber(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-mono font-bold focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  เมตรผลิตจริง <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={usedMeters}
                  onChange={(e) => setUsedMeters(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-mono font-bold text-emerald-800 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  เมตรเสีย NG
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={ngMeters}
                  onChange={(e) => setNgMeters(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-mono font-bold text-rose-800 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Density (K) ของใบงานที่ตัด: 25k, 28k, 30k, 35k, 40k */}
            <div className="bg-amber-50/70 p-3.5 rounded-xl border border-amber-200/90 space-y-2 mt-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <label className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <span>ใบงานที่ตัดใช้กี่ K (Density ของใบงาน)</span>
                  <span className="text-rose-500">*</span>
                </label>
                <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-amber-200 text-amber-950">
                  สเปคใบงาน: {selectedDensityK}
                </span>
              </div>
              <p className="text-[11px] text-slate-600">
                ใบงานส่วนใหญ่จะใช้ <strong>25k · 28k · 30k · 35k · 40k</strong> คลิกเลือก K ที่ระบุในใบสั่งผลิต:
              </p>
              <div className="flex items-center gap-2 flex-wrap pt-0.5">
                {COMMON_DENSITY_K.map((k) => {
                  const isSelected = selectedDensityK === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => { handlePickDensityK(k); setCustomKInput(''); }}
                      className={`px-3.5 py-1.5 rounded-xl font-mono text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-amber-500 text-slate-950 border border-amber-500 shadow-2xs scale-102'
                          : 'bg-white text-slate-700 border border-slate-300 hover:bg-amber-100/60'
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                      <span>{k}</span>
                    </button>
                  );
                })}

                {/* K ที่กรอกเอง (ไม่อยู่ในรายการมาตรฐาน) */}
                {!COMMON_DENSITY_K.includes(selectedDensityK) && (
                  <span className="px-3.5 py-1.5 rounded-xl font-mono text-xs font-bold bg-amber-500 text-slate-950 border border-amber-500 flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>{selectedDensityK} (กรอกเอง)</span>
                  </span>
                )}

                {/* ช่องกรอก K เอง — กด Enter / ปุ่มใช้ / ออกจากช่อง เพื่อยืนยัน */}
                <div className="flex items-center gap-1 ml-auto">
                  <span className="text-[11px] text-slate-500">หรือกรอก K เอง:</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="เช่น 32"
                    value={customKInput}
                    onChange={(e) => setCustomKInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        commitCustomK();
                      }
                    }}
                    onBlur={commitCustomK}
                    className="w-20 px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                  <button
                    type="button"
                    onClick={commitCustomK}
                    className="px-2 py-1 rounded-lg bg-amber-600 text-white text-[10px] font-bold cursor-pointer"
                  >
                    ใช้
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Choose Formula, Density, and Actual Line Speed */}
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-[11px] font-bold flex items-center justify-center">2</span>
                <span>เลือกสูตรน้ำยา & ใส่ความเร็วสายพานที่ใช้ผลิตจริง</span>
              </span>

              {onOpenManageFormulas && (
                <button
                  type="button"
                  onClick={onOpenManageFormulas}
                  className="text-xs text-amber-700 hover:text-amber-800 font-medium underline flex items-center gap-1 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>จัดการ/ผูกสูตรใหม่</span>
                </button>
              )}
            </div>

            {/* Formula Selector: ทำเป็นการเลือก dropdown สวยงาม สะอาดตา เหมือนการเลือกชนิดน้ำยาที่ใช้ตัด */}
            <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-200/90 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span>สูตรน้ำยา PU ที่ใช้ตัดสต๊อก</span>
                  <span className="text-rose-500">*</span>
                </label>
                <span className="text-[10px] text-slate-500 font-mono">
                  {formulas.length} สูตรในระบบ
                </span>
              </div>

              {/* Dropdown เหมือนกับการเลือกชนิดน้ำยาที่ใช้ตัด */}
              <select
                value={selectedFormulaId}
                onChange={(e) => setSelectedFormulaId(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 outline-none cursor-pointer"
              >
                {formulas.map((formula) => (
                  <option key={formula.id} value={formula.id}>
                    {formula.name} — {formula.density || 'Density 32'} ({formula.inchSize || `${formula.foamThicknessMm} มม.`}) | ไหล: {formula.totalFlowRatePerMin || 6.8} กก./นาที
                  </option>
                ))}
              </select>

              {/* Active Formula Quick Preview Info Bar */}
              <div className="flex items-center justify-between flex-wrap gap-2 pt-1 text-xs bg-white rounded-lg p-2 border border-slate-200/80 font-mono">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 text-[11px]">
                    {activeFormula.inchSize || `${activeFormula.foamThicknessMm} มม.`}
                  </span>
                  <span className="font-bold text-slate-800 text-[11px]">
                    {activeFormula.name}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-bold text-[10px]">
                    {activeFormula.density || 'D32'}
                  </span>
                  {activeFormula.drumNumber && (
                    <span className="text-[10px] text-slate-400">
                      ({activeFormula.drumNumber})
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-600">
                  ไหล: <strong className="text-amber-900">{activeFormula.totalFlowRatePerMin || 6.8} กก./นาที</strong>
                  {activeFormula.defaultLineSpeedMPerMin && (
                    <span className="ml-1.5 text-slate-400">(แนะนำ {activeFormula.defaultLineSpeedMPerMin} ม./นาที)</span>
                  )}
                </div>
              </div>
            </div>

            {/* สถานะการผูก Density: ใบงาน ↔ สูตร ↔ ถัง Poly */}
            <div className={`rounded-xl p-2.5 border text-[11px] space-y-1 ${
              formulaSupportsK && !polyKWarning
                ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border-rose-300 text-rose-900'
            }`}>
              <div className="flex items-center gap-1.5 font-bold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>ใบงาน {selectedDensityK} · สูตรรองรับ: {formulaDensities.length > 0 ? formulaDensities.join(', ') : 'ไม่จำกัด'}</span>
                <span>{formulaSupportsK ? '✓ ตรงกัน' : '✗ ไม่ตรง'}</span>
              </div>
              {!formulaSupportsK && (
                <div>สูตรนี้ไม่รองรับ {selectedDensityK} — เลือกสูตรอื่น หรือไปที่ "จัดการ/ผูกสูตรใหม่" เพื่อเพิ่ม {selectedDensityK} ให้สูตรนี้</div>
              )}
              {polyKWarning && <div>{polyKWarning}</div>}
            </div>

            {/* Conveyor Line Speed Input (ความเร็วสายพานที่ใช้ผลิตจริง) */}
            <div className="bg-blue-50/60 rounded-xl p-3.5 border border-blue-200/80 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                  <Gauge className="w-4 h-4 text-blue-600" />
                  <span>ความเร็วสายพานที่ใช้ผลิตจริง (Conveyor Line Speed)</span>
                </span>
                <span className="text-[11px] font-mono text-blue-800">
                  สูตรตั้งไว้: {activeFormula.defaultLineSpeedMPerMin || 8.0} ม./นาที
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                <div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.1"
                      min="1"
                      max="30"
                      required
                      value={actualLineSpeed}
                      onChange={(e) => setActualLineSpeed(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-white border border-blue-300 rounded-xl text-sm font-mono font-bold text-blue-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    />
                    <span className="text-xs font-bold text-slate-600 shrink-0">เมตร/นาที</span>
                  </div>
                  <div className="flex gap-1.5 mt-1.5">
                    {[7.5, 8.0, 8.5, 9.0, 9.5, 10.0].map(speed => (
                      <button
                        key={speed}
                        type="button"
                        onClick={() => setActualLineSpeed(speed)}
                        className={`text-[10px] px-2 py-0.5 rounded cursor-pointer transition-colors ${
                          actualLineSpeed === speed
                            ? 'bg-blue-600 text-white font-bold'
                            : 'bg-white border border-blue-200 text-blue-900 hover:bg-blue-100'
                        }`}
                      >
                        {speed}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-xl p-2.5 border border-blue-200 text-xs font-mono">
                  <div className="text-slate-500 text-[11px]">อัตราการใช้น้ำยาตามความเร็วสายพานจริง:</div>
                  <div className="text-amber-800 font-bold text-base mt-0.5">
                    {calculationResult.ratePerMeter} กก./เมตร
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    (= {activeFormula.totalFlowRatePerMin || 6.8} กก./นาที ÷ {actualLineSpeed} ม./นาที)
                  </div>
                </div>
              </div>
            </div>

            {/* Section: เลือกชนิดน้ำยา Poly และ ISO ก่อนตัด */}
            <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Beaker className="w-4 h-4 text-amber-600" />
                  <span>เลือกชนิด / ยี่ห้อของน้ำยา Poly & ISO ก่อนตัดสต๊อก</span>
                </span>
                <span className="text-[10px] text-slate-500">
                  แยกตามยี่ห้อในคลัง
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Poly Brand Selector */}
                <div>
                  <label className="text-[11px] font-bold text-emerald-950 block mb-1">
                    ชนิดน้ำยา Poly (Part A)
                  </label>
                  <select
                    value={selectedPolyBrand}
                    onChange={(e) => setSelectedPolyBrand(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-emerald-900 focus:ring-2 focus:ring-emerald-500 outline-none"
                  >
                    <option value="all">ทุกยี่ห้อ Poly ({availableDrumCards.filter(d => d.chemicalType === 'part_a').length} ถัง)</option>
                    {availablePolyBrands.map(b => (
                      <option key={b} value={b}>
                        {b} ({availableDrumCards.filter(d => d.chemicalType === 'part_a' && d.chemicalName === b).length} ถัง)
                      </option>
                    ))}
                  </select>
                </div>

                {/* ISO Brand Selector */}
                <div>
                  <label className="text-[11px] font-bold text-indigo-950 block mb-1">
                    ชนิดน้ำยา ISO (Part B)
                  </label>
                  <select
                    value={selectedIsoBrand}
                    onChange={(e) => setSelectedIsoBrand(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-indigo-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value="all">ทุกยี่ห้อ ISO ({availableDrumCards.filter(d => d.chemicalType === 'part_b').length} ถัง)</option>
                    {availableIsoBrands.map(b => (
                      <option key={b} value={b}>
                        {b} ({availableDrumCards.filter(d => d.chemicalType === 'part_b' && d.chemicalName === b).length} ถัง)
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Drum Number Selection for Stock Card Tracking */}
            <div className="bg-amber-50/50 rounded-xl p-3.5 border border-amber-200/80 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-amber-600" />
                    <span>No. ถังน้ำยาที่ตัด (ตัดถังเบอร์น้อยที่สุดก่อน / หรือกรอกเอง)</span>
                  </span>
                  <p className="text-[11px] text-slate-500">
                    {isManualDrumEntry 
                      ? 'โหมดระบุเอง: หากไม่มีข้อมูลในระบบจะแจ้งเตือนและกดตัดไม่ได้' 
                      : 'โหมดอัตโนมัติ: เลือกลงถังที่เบอร์น้อยที่สุดก่อนเสมอ (FIFO)'}
                  </p>
                </div>

                {/* ปุ่มติ๊กให้กรอกเลขถังเอง */}
                <label className="flex items-center gap-2 p-1.5 px-2.5 rounded-lg bg-white border border-amber-300 shadow-2xs cursor-pointer select-none text-xs font-bold text-slate-800 hover:bg-amber-50/50 transition-colors">
                  <input
                    type="checkbox"
                    checked={isManualDrumEntry}
                    onChange={(e) => setIsManualDrumEntry(e.target.checked)}
                    className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500"
                  />
                  <span>ติ๊กเพื่อกรอกเลขถังเอง</span>
                </label>
              </div>

              {/* Status Banner for Auto vs Manual */}
              {!isManualDrumEntry && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-50 text-emerald-900 border border-emerald-200 text-xs">
                  <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    ระบบเลือก <strong>ถังเบอร์น้อยที่สุดก่อน (FIFO)</strong> ให้อัตโนมัติ: Poly ({lowestPolyDrum?.drumNumber || 'ไม่มีถัง'}), ISO ({lowestIsoDrum?.drumNumber || 'ไม่มีถัง'})
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Poly Drum Field */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-emerald-950 flex items-center gap-1">
                      <span>No. ถัง Poly (Part A)</span>
                      {!isManualDrumEntry && lowestPolyDrum && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-200 text-emerald-950 font-mono font-bold">
                          เบอร์น้อยสุด
                        </span>
                      )}
                    </label>
                  </div>
                  <input
                    type="text"
                    value={polyDrumNumber}
                    disabled={!isManualDrumEntry}
                    onChange={(e) => setPolyDrumNumber(e.target.value)}
                    placeholder="เช่น ถัง #A01 หรือ ถัง #12"
                    className={`w-full px-3 py-2 border rounded-xl text-xs font-mono font-bold transition-all ${
                      !isManualDrumEntry 
                        ? 'bg-slate-100 text-slate-700 border-slate-300 cursor-not-allowed'
                        : !polyValidation.hasStock 
                        ? 'bg-rose-50 border-rose-400 text-rose-900 focus:ring-2 focus:ring-rose-500' 
                        : 'bg-white border-emerald-400 text-emerald-950 focus:ring-2 focus:ring-emerald-500'
                    }`}
                  />

                  {/* Validation text */}
                  {isManualDrumEntry && (
                    <div className="mt-1 text-[11px] font-mono">
                      {polyValidation.hasStock ? (
                        <span className="text-emerald-700 flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" />
                          <span>พบถังในระบบ (เหลือ {polyValidation.drum?.remainingKg} กก.)</span>
                        </span>
                      ) : (
                        <span className="text-rose-600 font-bold flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>{polyValidation.errorMsg}</span>
                        </span>
                      )}
                    </div>
                  )}

                  {/* Available Drums Pills */}
                  {sortedPolyDrums.length > 0 && (
                    <div className="mt-1.5 flex items-center gap-1 flex-wrap">
                      <span className="text-[10px] text-slate-400">ถังพร้อมใช้ ({sortedPolyDrums.length}):</span>
                      {sortedPolyDrums.slice(0, 4).map((d, idx) => (
                        <button
                          key={d.drumNumber}
                          type="button"
                          onClick={() => {
                            setPolyDrumNumber(d.drumNumber);
                            setIsManualDrumEntry(true);
                          }}
                          className={`text-[10px] px-1.5 py-0.5 rounded cursor-pointer font-mono transition-colors ${
                            polyDrumNumber === d.drumNumber
                              ? 'bg-emerald-600 text-white font-bold'
                              : idx === 0
                              ? 'bg-emerald-100 text-emerald-950 font-bold border border-emerald-300'
                              : 'bg-white border border-emerald-200 text-emerald-900 hover:bg-emerald-50'
                          }`}
                        >
                          {d.drumNumber} ({d.remainingKg}กก.)
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* ISO Drum Field */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-indigo-950 flex items-center gap-1">
                      <span>No. ถัง ISO (Part B)</span>
                      {!isManualDrumEntry && lowestIsoDrum && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-200 text-indigo-950 font-mono font-bold">
                          เบอร์น้อยสุด
                        </span>
                      )}
                    </label>
                  </div>
                  <input
                    type="text"
                    value={isoDrumNumber}
                    disabled={!isManualDrumEntry}
                    onChange={(e) => setIsoDrumNumber(e.target.value)}
                    placeholder="เช่น ถัง #B01 หรือ ถัง #15"
                    className={`w-full px-3 py-2 border rounded-xl text-xs font-mono font-bold transition-all ${
                      !isManualDrumEntry 
                        ? 'bg-slate-100 text-slate-700 border-slate-300 cursor-not-allowed'
                        : !isoValidation.hasStock 
                        ? 'bg-rose-50 border-rose-400 text-rose-900 focus:ring-2 focus:ring-rose-500' 
                        : 'bg-white border-indigo-400 text-indigo-950 focus:ring-2 focus:ring-indigo-500'
                    }`}
                  />

                  {/* Validation text */}
                  {isManualDrumEntry && (
                    <div className="mt-1 text-[11px] font-mono">
                      {isoValidation.hasStock ? (
                        <span className="text-emerald-700 flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" />
                          <span>พบถังในระบบ (เหลือ {isoValidation.drum?.remainingKg} กก.)</span>
                        </span>
                      ) : (
                        <span className="text-rose-600 font-bold flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>{isoValidation.errorMsg}</span>
                        </span>
                      )}
                    </div>
                  )}

                  {/* Available Drums Pills */}
                  {sortedIsoDrums.length > 0 && (
                    <div className="mt-1.5 flex items-center gap-1 flex-wrap">
                      <span className="text-[10px] text-slate-400">ถังพร้อมใช้ ({sortedIsoDrums.length}):</span>
                      {sortedIsoDrums.slice(0, 4).map((d, idx) => (
                        <button
                          key={d.drumNumber}
                          type="button"
                          onClick={() => {
                            setIsoDrumNumber(d.drumNumber);
                            setIsManualDrumEntry(true);
                          }}
                          className={`text-[10px] px-1.5 py-0.5 rounded cursor-pointer font-mono transition-colors ${
                            isoDrumNumber === d.drumNumber
                              ? 'bg-indigo-600 text-white font-bold'
                              : idx === 0
                              ? 'bg-indigo-100 text-indigo-950 font-bold border border-indigo-300'
                              : 'bg-white border border-indigo-200 text-indigo-900 hover:bg-indigo-50'
                          }`}
                        >
                          {d.drumNumber} ({d.remainingKg}กก.)
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Warning Alert if drum is not found or has no stock (กดตัดไม่ได้) */}
              {hasDrumValidationError && (
                <div className="p-3 rounded-xl bg-rose-100 border border-rose-300 text-rose-900 text-xs space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-rose-800">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>แจ้งเตือน: ไม่สามารถกดตัดสต๊อกได้ (ไม่มีข้อมูลถังในระบบ หรือไม่มีน้ำยาเหลือ)</span>
                  </div>
                  <ul className="list-disc pl-5 text-[11px] space-y-0.5 text-rose-700">
                    {!polyValidation.hasStock && <li>{polyValidation.errorMsg}</li>}
                    {!isoValidation.hasStock && <li>{isoValidation.errorMsg}</li>}
                  </ul>
                  <p className="text-[10px] text-rose-600 pt-0.5">
                    * กรุณาเลือกถังที่มีอยู่ในระบบ หรือยกเลิกการติ๊กกรอกเองเพื่อให้ระบบเลือกถังเบอร์น้อยสุดให้อัตโนมัติ
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Live Calculation Summary & Stock Deductions */}
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-[11px] font-bold flex items-center justify-center">3</span>
              <span>สรุปยอดคำนวณน้ำยาและยอดคงเหลือหลังตัดสต๊อก</span>
            </span>

            {/* Summary Metrics Banner */}
            <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center sm:text-left border-b border-slate-800 pb-3 font-mono">
                <div>
                  <span className="text-[11px] text-slate-400 block">เมตรผลิตจริง:</span>
                  <span className="text-sm sm:text-base font-bold text-emerald-400">
                    {calculationResult.usedMeters} ม.
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block">เมตรเสีย NG:</span>
                  <span className="text-sm sm:text-base font-bold text-rose-400">
                    {calculationResult.ngMeters} ม.
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block">ความเร็วสายพาน:</span>
                  <span className="text-sm sm:text-base font-bold text-blue-400">
                    {calculationResult.lineSpeedMPerMin} ม./นาที
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block">รวมน้ำยาทั้งหมด:</span>
                  <span className="text-base sm:text-lg font-bold text-amber-300">
                    {calculationResult.totalChemicalKg} กก.
                  </span>
                </div>
              </div>

              {/* Work order Density K and Batch SO summary */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 pb-1 border-b border-slate-800 text-xs font-mono">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Density ใบงานที่ตัด:</span>
                  <span className="px-2.5 py-0.5 rounded-lg bg-amber-400 text-slate-950 font-bold text-xs">
                    {selectedDensityK}
                  </span>
                  <span className="text-slate-400 text-[11px]">({activeFormula.name})</span>
                </div>
                {selectedSoItems.length > 0 && (
                  <div className="text-[11px] text-amber-300 flex items-center gap-1.5">
                    <span>ใบงานที่เลือก:</span>
                    <strong className="text-white">{selectedSoItems.length} ใบงาน</strong>
                    <span className="text-slate-400">({selectedSoItems.map(s => s.soNumber).join(', ')})</span>
                  </div>
                )}
              </div>

              {/* Chemical Part A & Part B Breakdown */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {/* Part A: Poly */}
                <div className="bg-slate-800/80 rounded-xl p-3 border border-slate-700/80 space-y-1.5">
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="font-bold flex items-center gap-1.5 text-emerald-400">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span>น้ำยา Poly (Part A):</span>
                    </span>
                    <span className="font-mono text-emerald-300 font-bold text-sm">
                      -{calculationResult.partAKg} กก.
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-1 border-t border-slate-700">
                    <span>คงเหลือในคลัง: {currentStock.partAStockKg} กก.</span>
                    <span className={isLowStockA ? 'text-rose-400 font-bold' : 'text-slate-300'}>
                      → เหลือ {round2(currentStock.partAStockKg - calculationResult.partAKg)} กก.
                    </span>
                  </div>
                </div>

                {/* Part B: ISO */}
                <div className="bg-slate-800/80 rounded-xl p-3 border border-slate-700/80 space-y-1.5">
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="font-bold flex items-center gap-1.5 text-indigo-400">
                      <span className="w-2 h-2 rounded-full bg-indigo-400" />
                      <span>น้ำยา ISO (Part B):</span>
                    </span>
                    <span className="font-mono text-indigo-300 font-bold text-sm">
                      -{calculationResult.partBKg} กก.
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-1 border-t border-slate-700">
                    <span>คงเหลือในคลัง: {currentStock.partBStockKg} กก.</span>
                    <span className={isLowStockB ? 'text-rose-400 font-bold' : 'text-slate-300'}>
                      → เหลือ {round2(currentStock.partBStockKg - calculationResult.partBKg)} กก.
                    </span>
                  </div>
                </div>
              </div>

              {(isLowStockA || isLowStockB) && (
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-rose-950/80 text-rose-300 text-xs border border-rose-800">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>แจ้งเตือน: ยอดน้ำยาในสต๊อกเหลือน้อยกว่าปริมาณที่จะตัด</span>
                </div>
              )}
            </div>

            {/* Note & Operator */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ผู้บันทึกการตัดสต๊อก
                </label>
                <input
                  type="text"
                  value={recordedBy}
                  onChange={(e) => setRecordedBy(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  หมายเหตุเพิ่มเติม (ถ้ามี)
                </label>
                <input
                  type="text"
                  placeholder="เช่น ผลิตรอบเช้า หรือ ตัดแก้งาน"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            ยกเลิก
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!soNumber.trim() || calculationResult.totalChemicalKg <= 0 || hasDrumValidationError}
            className={`px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm shadow-xs transition-all flex items-center gap-2 ${
              hasDrumValidationError || !soNumber.trim() || calculationResult.totalChemicalKg <= 0
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-60'
                : 'bg-amber-500 hover:bg-amber-600 text-slate-950 cursor-pointer active:scale-95'
            }`}
          >
            {hasDrumValidationError ? (
              <>
                <AlertCircle className="w-4 h-4 text-rose-500" />
                <span>ไม่พบข้อมูลถังในระบบ (กดตัดไม่ได้)</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4 stroke-[2.5]" />
                <span>ยืนยันตัดสต๊อกน้ำยา ({calculationResult.totalChemicalKg} กก.)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
