import React, { useState, useMemo, useRef } from 'react';
import { 
  ChemicalStock, 
  ChemicalCutRecord, 
  ChemicalRestockRecord, 
  ChemicalFormula,
  StockCutRecord,
  PuSandwichCutRecord,
  DrumStockCardItem
} from '../types';
import { 
  exportChemicalCutsToCSV, 
  buildDrumStockCards, 
  groupDrumsByChemicalName,
  ChemicalFolderGroup 
} from '../utils/chemicalStock';
import { formatMeters, round2 } from '../utils/formatters';
import { UserMode } from '../utils/auth';
import { DENSITY_K_PRESETS, normalizeDensityK, normalizeDensityList, sortDensityList } from '../utils/density';
import { ChemicalStockCardModal } from './ChemicalStockCardModal';
import { ChemicalEditDrumModal } from './ChemicalEditDrumModal';
import { 
  Beaker, 
  Scissors, 
  PackagePlus, 
  Download, 
  RotateCcw, 
  Search, 
  TrendingDown, 
  Gauge, 
  Timer,
  Scale,
  Sparkles,
  Info,
  Folder,
  FolderOpen,
  Layers,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  FileSpreadsheet,
  Edit3,
  Trash2,
  Check,
  X
} from 'lucide-react';

interface ChemicalStockViewProps {
  stock: ChemicalStock;
  cutRecords: ChemicalCutRecord[];
  restockRecords: ChemicalRestockRecord[];
  formulas: ChemicalFormula[];
  foilRecords: StockCutRecord[];
  puRecords: PuSandwichCutRecord[];
  onOpenDeductModal: () => void;
  onOpenRestockModal: () => void;
  onOpenFormulaModal: () => void;
  onRevertCut: (recordId: string) => void;
  onEditRestock?: (record: ChemicalRestockRecord) => void;
  onDeleteRestock?: (recordId: string) => void;
  onSaveDrum?: (
    oldDrumNumber: string,
    newDrumNumber: string,
    oldChemicalName: string,
    newChemicalName: string,
    supplier?: string,
    initialKg?: number,
    receivedDate?: string
  ) => void;
  onDeleteDrum?: (drumNumber: string, chemicalName: string) => void;
  onUpdateFolderDensities?: (chemicalName: string, densities: string[]) => void;
  showToast: (text: string, type?: 'success' | 'info') => void;
  userMode?: UserMode;
  onRequestUnlock?: () => void;
}

export const ChemicalStockView: React.FC<ChemicalStockViewProps> = ({
  stock,
  cutRecords,
  restockRecords,
  formulas,
  onOpenDeductModal,
  onOpenRestockModal,
  onOpenFormulaModal,
  onRevertCut,
  onEditRestock,
  onDeleteRestock,
  onSaveDrum,
  onDeleteDrum,
  onUpdateFolderDensities,
  showToast,
  userMode = 'visitor',
  onRequestUnlock,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'folders' | 'cuts' | 'restock' | 'formulas'>('folders');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFormulaFilter, setSelectedFormulaFilter] = useState<string>('all');
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);

  // Sub-filter for drum view: all, Poly (part_a), or ISO (part_b)
  const [drumTypeFilter, setDrumTypeFilter] = useState<'all' | 'part_a' | 'part_b'>('all');

  // Folder K Config Modal State (กำหนดค่า K ให้โฟลเดอร์ Poly)
  const [folderCustomK, setFolderCustomK] = useState('');
  const [folderKError, setFolderKError] = useState('');
  const [editingFolderK, setEditingFolderK] = useState<{
    chemicalName: string;
    densities: string[];
  } | null>(null);

  // Sliders for drum rows
  const polySliderRef = useRef<HTMLDivElement>(null);
  const isoSliderRef = useRef<HTMLDivElement>(null);

  const scrollSlider = (ref: React.RefObject<HTMLDivElement | null>, direction: 'left' | 'right') => {
    if (ref.current) {
      const scrollAmount = direction === 'left' ? -280 : 280;
      ref.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  // Selected Drum for Stock Card Modal View
  const [selectedStockCardDrum, setSelectedStockCardDrum] = useState<DrumStockCardItem | null>(null);

  // Drum being edited
  const [editingDrum, setEditingDrum] = useState<DrumStockCardItem | null>(null);

  const handleActionGuarded = (action: () => void) => {
    if (userMode === 'visitor' && onRequestUnlock) {
      onRequestUnlock();
      return;
    }
    action();
  };

  // Drum Stock Cards (คำนวณการใช้ตาม SO แยกแต่ละเบอร์ถัง)
  const allDrumCards = useMemo(() => {
    return buildDrumStockCards(restockRecords, cutRecords);
  }, [restockRecords, cutRecords]);

  // Group into folders by chemical name (เมื่อรับเข้ามาจะอยู่ในโฟลเดอร์เดียวกัน)
  const chemicalFolders = useMemo(() => {
    return groupDrumsByChemicalName(allDrumCards);
  }, [allDrumCards]);

  // Aggregated metrics
  const totalChemicalUsedKg = useMemo(() => {
    return round2(cutRecords.reduce((sum, r) => sum + (Number(r.totalChemicalKg) || 0), 0));
  }, [cutRecords]);

  const totalUsedMetersFromSO = useMemo(() => {
    return round2(cutRecords.reduce((sum, r) => sum + (Number(r.usedMeters) || 0), 0));
  }, [cutRecords]);

  const totalNgMetersFromSO = useMemo(() => {
    return round2(cutRecords.reduce((sum, r) => sum + (Number(r.ngMeters) || 0), 0));
  }, [cutRecords]);

  // Drum estimations: Poly 210 kg/drum, ISO 250 kg/drum
  const polyCapacity = stock.drumCapacityPolyKg || 210;
  const isoCapacity = stock.drumCapacityIsoKg || 250;
  const drumsPartA = round2(stock.partAStockKg / polyCapacity);
  const drumsPartB = round2(stock.partBStockKg / isoCapacity);
  const totalStockKg = round2(stock.partAStockKg + stock.partBStockKg);

  // Filtered cuts
  const filteredCuts = useMemo(() => {
    return cutRecords.filter(r => {
      const matchSearch = !searchQuery.trim() || 
        r.soNumber.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
        r.cutDate.includes(searchQuery.trim()) ||
        (r.formulaName && r.formulaName.toLowerCase().includes(searchQuery.trim().toLowerCase())) ||
        (r.drumNumber && r.drumNumber.toLowerCase().includes(searchQuery.trim().toLowerCase())) ||
        (r.chemicalName && r.chemicalName.toLowerCase().includes(searchQuery.trim().toLowerCase())) ||
        (r.density && r.density.toLowerCase().includes(searchQuery.trim().toLowerCase())) ||
        (r.recordedBy && r.recordedBy.toLowerCase().includes(searchQuery.trim().toLowerCase()));

      const matchFormula = selectedFormulaFilter === 'all' || r.formulaId === selectedFormulaFilter;

      return matchSearch && matchFormula;
    });
  }, [cutRecords, searchQuery, selectedFormulaFilter]);

  // Drums filtered by selected folder (if any)
  const displayedDrums = useMemo(() => {
    return allDrumCards.filter(d => !selectedFolder || d.chemicalName === selectedFolder);
  }, [allDrumCards, selectedFolder]);

  // Separate Poly drums (Part A) and ISO drums (Part B) for dedicated sliders
  const polyDrums = useMemo(() => {
    return displayedDrums.filter(d => d.chemicalType === 'part_a');
  }, [displayedDrums]);

  const isoDrums = useMemo(() => {
    return displayedDrums.filter(d => d.chemicalType === 'part_b');
  }, [displayedDrums]);

  const totalPolyRemainingKg = useMemo(() => {
    return round2(polyDrums.reduce((sum, d) => sum + d.remainingKg, 0));
  }, [polyDrums]);

  const totalIsoRemainingKg = useMemo(() => {
    return round2(isoDrums.reduce((sum, d) => sum + d.remainingKg, 0));
  }, [isoDrums]);

  // Compact Drum Card Renderer (ย่อช่องให้เล็กไม่เกะกะ จัดเลย์เอาท์สะอาดตา)
  const renderCompactDrumCard = (drum: DrumStockCardItem) => {
    const isPoly = drum.chemicalType === 'part_a';
    return (
      <div
        key={`${drum.chemicalName}-${drum.drumNumber}`}
        className="w-52 sm:w-56 shrink-0 bg-white rounded-xl p-3 border border-slate-200/90 hover:border-slate-300 shadow-2xs flex flex-col justify-between select-none space-y-2.5 transition-all hover:shadow-xs"
      >
        <div>
          {/* Row 1: Drum No + Status Pill */}
          <div className="flex items-center justify-between gap-1 mb-1">
            <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
              {drum.drumNumber}
            </span>
            <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
              drum.status === 'empty' 
                ? 'bg-rose-100 text-rose-800' 
                : drum.status === 'low' 
                ? 'bg-amber-100 text-amber-800' 
                : 'bg-emerald-100 text-emerald-800'
            }`}>
              {drum.status === 'empty' ? 'หมด' : drum.status === 'low' ? 'ใกล้หมด' : 'ใช้งาน'}
            </span>
          </div>

          {/* Row 2: Chemical Name + K values if Poly */}
          <div className="min-w-0">
            <h6 className="font-bold text-slate-900 text-xs truncate" title={drum.chemicalName}>
              {drum.chemicalName}
            </h6>
            {drum.supportedDensities && drum.supportedDensities.length > 0 && (
              <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                <span className="text-[10px] text-slate-400">K:</span>
                {drum.supportedDensities.slice(0, 3).map(k => (
                  <span key={k} className="text-[9px] font-mono font-bold px-1 py-0.2 rounded bg-amber-100 text-amber-900 border border-amber-300">
                    {k}
                  </span>
                ))}
                {drum.supportedDensities.length > 3 && (
                  <span className="text-[9px] text-slate-500 font-mono">+{drum.supportedDensities.length - 3}</span>
                )}
              </div>
            )}
          </div>

          {/* Row 3: Mini Level Gauge Bar */}
          <div className="space-y-1 mt-2">
            <div className="flex justify-between text-[10px] font-mono">
              <span className="text-slate-500">คงเหลือ:</span>
              <strong className="text-slate-900 font-bold">{drum.remainingKg}/{drum.initialKg} กก. ({drum.remainingPercent}%)</strong>
            </div>
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-300 ${
                  drum.remainingPercent <= 15
                    ? 'bg-rose-500'
                    : drum.remainingPercent <= 35
                    ? 'bg-amber-500'
                    : isPoly ? 'bg-emerald-500' : 'bg-indigo-500'
                }`}
                style={{ width: `${Math.min(100, Math.max(0, drum.remainingPercent))}%` }}
              />
            </div>
          </div>

          {/* Row 4: Compact Stats Box */}
          <div className="bg-slate-50 rounded-lg p-2 border border-slate-100 text-[10px] font-mono space-y-0.5 mt-2">
            <div className="flex justify-between text-slate-600">
              <span>ใช้:</span>
              <strong>{drum.cuts.length} SO (-{drum.totalCutKg} กก.)</strong>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>ผลิตดี:</span>
              <strong className="text-emerald-700">{formatMeters(drum.totalUsedMeters)} ม.</strong>
            </div>
            {drum.totalNgMeters > 0 && (
              <div className="flex justify-between text-slate-500">
                <span>เสีย NG:</span>
                <strong className="text-rose-600">{formatMeters(drum.totalNgMeters)} ม.</strong>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Action Row */}
        <div className="flex items-center gap-1 pt-1.5 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setSelectedStockCardDrum(drum)}
            className="flex-1 py-1 px-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-300 font-bold text-[11px] flex items-center justify-center gap-1 transition-colors cursor-pointer shadow-2xs active:scale-98"
          >
            <FileSpreadsheet className="w-3 h-3" />
            <span>ดูบัตรสต๊อก</span>
          </button>
          {onSaveDrum && (
            <button
              type="button"
              onClick={() => handleActionGuarded(() => setEditingDrum(drum))}
              className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
              title="แก้ไขข้อมูลถังนี้"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
          )}
          {onDeleteDrum && (
            <button
              type="button"
              onClick={() => handleActionGuarded(() => {
                if (confirm(`คุณต้องการลบถัง "${drum.drumNumber}" (${drum.chemicalName}) ออกจากระบบใช่หรือไม่?`)) {
                  onDeleteDrum(drum.drumNumber, drum.chemicalName);
                  showToast(`ลบถังน้ำยา "${drum.drumNumber}" เรียบร้อย`);
                }
              })}
              className="p-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors cursor-pointer"
              title="ลบถังนี้ออกจากระบบ"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    );
  };

  const handleConfirmRevert = (recordId: string, soNumber: string) => {
    handleActionGuarded(() => {
      if (confirm(`คุณต้องการยกเลิกการตัดสต๊อกน้ำยา SO ${soNumber} และคืนยอดสต๊อกน้ำยาเข้าคลังใช่หรือไม่?`)) {
        onRevertCut(recordId);
        showToast(`ยกเลิกรายการตัด SO ${soNumber} และคืนยอดเข้าคลังเรียบร้อย`);
      }
    });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Hero / Header Section */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200/90 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-200/80">
                PU FOAM CHEMICAL SYSTEM
              </span>
              <span className="text-xs text-slate-500 font-mono">
                โฟลเดอร์ชื่อน้ำยา • บัตรสต๊อกถัง (Stock Card)
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">
              ระบบตัดสต๊อกน้ำยา PU & Stock Card
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
              จัดกลุ่มถังน้ำยาตามโฟลเดอร์ชื่อน้ำยา ดูประวัติการตัดแยกตาม SO สรุปยอดงานดี งานเสีย และคงเหลือในถัง
            </p>
          </div>

          {/* Main Action Buttons */}
          <div className="flex items-center flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleActionGuarded(onOpenDeductModal)}
              className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm flex items-center gap-2 shadow-xs transition-all active:scale-[0.98] cursor-pointer"
            >
              <Scissors className="w-4 h-4 stroke-[2.3]" />
              <span>ตัดสต๊อกน้ำยาจาก SO</span>
            </button>

            <button
              type="button"
              onClick={() => handleActionGuarded(onOpenRestockModal)}
              className="px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-xs transition-all active:scale-[0.98] cursor-pointer"
            >
              <PackagePlus className="w-4 h-4" />
              <span>รับเข้าน้ำยา (เติมถัง)</span>
            </button>

            <button
              type="button"
              onClick={onOpenFormulaModal}
              className="px-3 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-bold text-xs sm:text-sm flex items-center gap-1.5 transition-colors cursor-pointer"
              title="ตั้งค่าและผูกสูตรคำนวณ"
            >
              <Beaker className="w-4 h-4 text-amber-600" />
              <span>ผูกสูตรน้ำยา</span>
            </button>
          </div>
        </div>

        {/* Live Inventory Cards (Stock On Hand) - แดชบอร์ดแสดงเป็นแถวเดียวแบบสไลด์ */}
        <div className="mt-6 relative">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
              สถานะน้ำยาเคมีในคลัง (สไลด์แนวนอน)
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById('chemical-inventory-scroller');
                  if (el) el.scrollBy({ left: -280, behavior: 'smooth' });
                }}
                className="p-1 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 shadow-2xs transition-colors cursor-pointer"
                title="เลื่อนซ้าย"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById('chemical-inventory-scroller');
                  if (el) el.scrollBy({ left: 280, behavior: 'smooth' });
                }}
                className="p-1 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 shadow-2xs transition-colors cursor-pointer"
                title="เลื่อนขวา"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div
            id="chemical-inventory-scroller"
            className="flex gap-3.5 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-3 [-ms-overflow-style:none] [scrollbar-width:thin] scrollbar-thin scrollbar-thumb-slate-300"
          >
            {/* Card 1: Part A (Poly) */}
            <div className="snap-center shrink-0 w-[78vw] max-w-[290px] sm:w-[270px] p-4 rounded-2xl bg-gradient-to-br from-emerald-50/80 to-white border border-emerald-200/90 shadow-2xs space-y-2 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                  <span>น้ำยา Poly (Part A)</span>
                </span>
                <span className="text-[11px] font-mono text-emerald-800 bg-white px-2 py-0.5 rounded border border-emerald-200 font-bold">
                  ~{drumsPartA} ถัง
                </span>
              </div>
              <div>
                <div className="text-2xl font-bold font-mono text-slate-900 tracking-tight">
                  {stock.partAStockKg.toLocaleString()} <span className="text-xs font-normal text-slate-500">กก.</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  ถังละ {polyCapacity} กก. (หรือ 215 กก.)
                </div>
              </div>
              <div className="w-full bg-slate-200/70 h-1.5 rounded-full overflow-hidden">
                <div 
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                  style={{ width: `${Math.min(100, (stock.partAStockKg / 2500) * 100)}%` }}
                />
              </div>
            </div>

            {/* Card 2: Part B (ISO) */}
            <div className="snap-center shrink-0 w-[78vw] max-w-[290px] sm:w-[270px] p-4 rounded-2xl bg-gradient-to-br from-indigo-50/80 to-white border border-indigo-200/90 shadow-2xs space-y-2 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
                  <span>น้ำยา ISO (Part B)</span>
                </span>
                <span className="text-[11px] font-mono text-indigo-800 bg-white px-2 py-0.5 rounded border border-indigo-200 font-bold">
                  ~{drumsPartB} ถัง
                </span>
              </div>
              <div>
                <div className="text-2xl font-bold font-mono text-slate-900 tracking-tight">
                  {stock.partBStockKg.toLocaleString()} <span className="text-xs font-normal text-slate-500">กก.</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  ถังละ {isoCapacity} กก. (มาตรฐาน)
                </div>
              </div>
              <div className="w-full bg-slate-200/70 h-1.5 rounded-full overflow-hidden">
                <div 
                  className="bg-indigo-500 h-full rounded-full transition-all duration-500" 
                  style={{ width: `${Math.min(100, (stock.partBStockKg / 2500) * 100)}%` }}
                />
              </div>
            </div>

            {/* Card 3: Total Chemical Stock */}
            <div className="snap-center shrink-0 w-[78vw] max-w-[290px] sm:w-[270px] p-4 rounded-2xl bg-gradient-to-br from-slate-50 to-white border border-slate-200 shadow-2xs space-y-2 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                  <span>รวมน้ำยาเคมีคงเหลือ</span>
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-900">
                  คลังปัจจุบัน
                </span>
              </div>
              <div>
                <div className="text-2xl font-bold font-mono text-amber-800 tracking-tight">
                  {totalStockKg.toLocaleString()} <span className="text-xs font-normal text-slate-500">กก.</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5 font-mono">
                  Poly: {stock.partAStockKg.toLocaleString()} | ISO: {stock.partBStockKg.toLocaleString()}
                </div>
              </div>
              <div className="w-full bg-slate-200/70 h-1.5 rounded-full overflow-hidden">
                <div 
                  className="bg-amber-500 h-full rounded-full transition-all duration-500" 
                  style={{ width: `${Math.min(100, (totalStockKg / 5000) * 100)}%` }}
                />
              </div>
            </div>

            {/* Card 4: Usage Summary from SOs */}
            <div className="snap-center shrink-0 w-[78vw] max-w-[290px] sm:w-[270px] p-4 rounded-2xl bg-gradient-to-br from-slate-50 to-white border border-slate-200 shadow-2xs space-y-2 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <TrendingDown className="w-4 h-4 text-rose-600" />
                  <span>น้ำยาที่ใช้ผลิตสะสม</span>
                </span>
                <span className="text-[11px] font-mono text-slate-500">
                  {cutRecords.length} SO
                </span>
              </div>
              <div>
                <div className="text-2xl font-bold font-mono text-slate-900 tracking-tight">
                  {totalChemicalUsedKg.toLocaleString()} <span className="text-xs font-normal text-slate-500">กก.</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5 truncate font-mono">
                  จริง {formatMeters(totalUsedMetersFromSO)} ม. · NG {formatMeters(totalNgMetersFromSO)} ม.
                </div>
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                {chemicalFolders.length} โฟลเดอร์ชื่อน้ำยา • {allDrumCards.length} ถัง
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sub Tabs Navigation & Filters */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl text-xs font-semibold overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveSubTab('folders')}
              className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                activeSubTab === 'folders'
                  ? 'bg-white text-slate-950 font-bold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Folder className="w-3.5 h-3.5 text-amber-600" />
              <span>โฟลเดอร์ชื่อน้ำยา & Stock Card ({allDrumCards.length} ถัง)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('cuts')}
              className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                activeSubTab === 'cuts'
                  ? 'bg-white text-slate-950 font-bold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ประวัติตัดสต๊อกน้ำยา ({cutRecords.length} SO)
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('restock')}
              className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                activeSubTab === 'restock'
                  ? 'bg-white text-slate-950 font-bold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ประวัติรับเข้าน้ำยา ({restockRecords.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('formulas')}
              className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                activeSubTab === 'formulas'
                  ? 'bg-white text-slate-950 font-bold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              สูตรคำนวณในระบบ ({formulas.length})
            </button>
          </div>

          {/* Export CSV Button */}
          {activeSubTab === 'cuts' && (
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => exportChemicalCutsToCSV(cutRecords)}
                disabled={cutRecords.length === 0}
                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
              >
                <Download className="w-3.5 h-3.5 text-slate-600" />
                <span>ส่งออก CSV</span>
              </button>
            </div>
          )}
        </div>

        {/* TAB 0: FOLDERS BY CHEMICAL NAME & DRUM STOCK CARDS */}
        {activeSubTab === 'folders' && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-amber-600" />
                  <span>โฟลเดอร์แยกตามชื่อของน้ำยา ({chemicalFolders.length} โฟลเดอร์)</span>
                </h4>
                <p className="text-xs text-slate-500">
                  ถังน้ำยาที่มีชื่อเดียวกันจะรวมอยู่ในโฟลเดอร์เดียวกัน คลิกเพื่อดูบัตรสต๊อก (Stock Card) แยกตาม SO
                </p>
              </div>

              {selectedFolder && (
                <button
                  type="button"
                  onClick={() => setSelectedFolder(null)}
                  className="text-xs text-amber-700 hover:text-amber-800 font-semibold underline cursor-pointer"
                >
                  ← ดูทุกโฟลเดอร์
                </button>
              )}
            </div>

            {/* Folder Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {chemicalFolders.map(folder => {
                const isSelected = selectedFolder === folder.chemicalName;
                return (
                  <div
                    key={folder.chemicalName}
                    onClick={() => setSelectedFolder(isSelected ? null : folder.chemicalName)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer relative ${
                      isSelected
                        ? 'bg-amber-50/70 border-amber-400 ring-2 ring-amber-400/50 shadow-xs'
                        : 'bg-white border-slate-200/90 hover:border-slate-300 hover:shadow-2xs'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                          <Folder className="w-5 h-5 fill-amber-500/20" />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h5 className="text-sm font-bold text-slate-900 line-clamp-1">
                              {folder.chemicalName}
                            </h5>
                            {folder.hasPoly && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-900 border border-emerald-300">
                                Poly (Part A)
                              </span>
                            )}
                            {folder.hasIso && !folder.hasPoly && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-900 border border-indigo-300">
                                ISO (Part B)
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-500">
                            {folder.totalDrums} ถังน้ำยา
                          </span>
                        </div>
                      </div>

                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                        {folder.activeDrums} ถังพร้อมใช้
                      </span>
                    </div>

                    {/* Poly Folder: กำหนดค่า K ที่น้ำยานี้ผลิตได้ */}
                    {folder.hasPoly && (
                      <div className="my-2 p-2 rounded-xl bg-amber-50/90 border border-amber-200 flex items-center justify-between gap-1 flex-wrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Sparkles className="w-3 h-3 text-amber-600 shrink-0" />
                          <span className="text-[10px] font-bold text-amber-950">กำหนดค่า K:</span>
                          {folder.supportedDensities.map(k => (
                            <span key={k} className="px-1.5 py-0.2 rounded bg-amber-200 text-amber-950 font-bold font-mono text-[9px] border border-amber-300">
                              {k}
                            </span>
                          ))}
                        </div>
                        {onUpdateFolderDensities && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleActionGuarded(() => setEditingFolderK({
                                chemicalName: folder.chemicalName,
                                densities: [...folder.supportedDensities],
                              }));
                            }}
                            className="text-[10px] px-2 py-0.5 rounded bg-amber-200/80 hover:bg-amber-300 text-amber-950 font-bold flex items-center gap-1 cursor-pointer transition-colors"
                            title="กำหนดค่า K ของโฟลเดอร์นี้"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>กำหนดค่า K</span>
                          </button>
                        )}
                      </div>
                    )}

                    <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100 space-y-1.5 text-xs font-mono">
                      <div className="flex justify-between text-slate-600">
                        <span>น้ำยาตั้งต้น:</span>
                        <strong className="text-slate-900">{folder.totalInitialKg.toLocaleString()} กก.</strong>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>คงเหลือปัจจุบัน:</span>
                        <strong className="text-amber-800 font-bold">{folder.totalRemainingKg.toLocaleString()} กก.</strong>
                      </div>
                      <div className="pt-1 border-t border-slate-200/60 flex justify-between text-[11px] text-slate-500">
                        <span>ผลิตงานดี: {formatMeters(folder.totalUsedMeters)} ม.</span>
                        <span>เสีย: {formatMeters(folder.totalNgMeters)} ม.</span>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between text-xs text-amber-700 font-bold">
                      <span>{isSelected ? 'กำลังดูถังในโฟลเดอร์นี้' : 'คลิกเปิดดูถังในโฟลเดอร์'}</span>
                      <ChevronRight className={`w-4 h-4 transition-transform ${isSelected ? 'rotate-90' : ''}`} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* รายการถังน้ำยาทำเป็นสไลด์ แยกตามชนิดของน้ำยา (Poly & ISO) และย่อช่องให้เล็กไม่เกะกะ */}
            <div className="pt-4 border-t border-slate-200/80 space-y-4">
              {/* Header and Type Filter Segment */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-emerald-600" />
                    <span>
                      รายการถังน้ำยา {selectedFolder ? `ในโฟลเดอร์ "${selectedFolder}"` : 'ทั้งหมดในคลัง'} ({displayedDrums.length} ถัง)
                    </span>
                  </h4>
                  <p className="text-xs text-slate-500">
                    แสดงเป็นแถวสไลด์แนวนอน แยกตามชนิดน้ำยา Poly และ ISO เพื่อความสะอาดตาและค้นหาง่าย
                  </p>
                </div>

                {/* Filter Tabs by Chemical Type */}
                <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-xl text-xs shrink-0 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setDrumTypeFilter('all')}
                    className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      drumTypeFilter === 'all'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    ทั้งหมด ({displayedDrums.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setDrumTypeFilter('part_a')}
                    className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1 ${
                      drumTypeFilter === 'part_a'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-emerald-700'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                    <span>ถัง Poly ({polyDrums.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDrumTypeFilter('part_b')}
                    className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1 ${
                      drumTypeFilter === 'part_b'
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-indigo-700'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-indigo-400 inline-block" />
                    <span>ถัง ISO ({isoDrums.length})</span>
                  </button>
                </div>
              </div>

              {/* SLIDE ROW 1: ถังน้ำยา Poly (Part A) */}
              {(drumTypeFilter === 'all' || drumTypeFilter === 'part_a') && (
                <div className="bg-emerald-50/40 p-3.5 rounded-2xl border border-emerald-200/70 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                      <h5 className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                        <span>แถวสไลด์ถังน้ำยา Poly (Part A)</span>
                        <span className="text-[10px] font-normal text-slate-500 font-mono">
                          ({polyDrums.length} ถัง • คงเหลือ {totalPolyRemainingKg.toLocaleString()} กก.)
                        </span>
                      </h5>
                    </div>

                    {/* Slide Controls */}
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-slate-400 mr-1 hidden sm:inline">สไลด์เลื่อนดูถัง</span>
                      <button
                        type="button"
                        onClick={() => scrollSlider(polySliderRef, 'left')}
                        className="p-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 shadow-2xs cursor-pointer transition-colors"
                        title="เลื่อนซ้าย"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => scrollSlider(polySliderRef, 'right')}
                        className="p-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 shadow-2xs cursor-pointer transition-colors"
                        title="เลื่อนขวา"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Horizontal Scroll Slider for Poly Drums */}
                  {polyDrums.length === 0 ? (
                    <div className="text-center py-6 text-xs text-slate-400 bg-white/60 rounded-xl border border-dashed border-emerald-200">
                      ยังไม่มีถังน้ำยา Poly (Part A) ในหมวดนี้
                    </div>
                  ) : (
                    <div
                      ref={polySliderRef}
                      className="flex gap-2.5 overflow-x-auto pb-2 pt-0.5 scroll-smooth no-scrollbar"
                    >
                      {polyDrums.map(renderCompactDrumCard)}
                    </div>
                  )}
                </div>
              )}

              {/* SLIDE ROW 2: ถังน้ำยา ISO (Part B) */}
              {(drumTypeFilter === 'all' || drumTypeFilter === 'part_b') && (
                <div className="bg-indigo-50/40 p-3.5 rounded-2xl border border-indigo-200/70 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
                      <h5 className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                        <span>แถวสไลด์ถังน้ำยา ISO (Part B)</span>
                        <span className="text-[10px] font-normal text-slate-500 font-mono">
                          ({isoDrums.length} ถัง • คงเหลือ {totalIsoRemainingKg.toLocaleString()} กก.)
                        </span>
                      </h5>
                    </div>

                    {/* Slide Controls */}
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-slate-400 mr-1 hidden sm:inline">สไลด์เลื่อนดูถัง</span>
                      <button
                        type="button"
                        onClick={() => scrollSlider(isoSliderRef, 'left')}
                        className="p-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 shadow-2xs cursor-pointer transition-colors"
                        title="เลื่อนซ้าย"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => scrollSlider(isoSliderRef, 'right')}
                        className="p-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 shadow-2xs cursor-pointer transition-colors"
                        title="เลื่อนขวา"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Horizontal Scroll Slider for ISO Drums */}
                  {isoDrums.length === 0 ? (
                    <div className="text-center py-6 text-xs text-slate-400 bg-white/60 rounded-xl border border-dashed border-indigo-200">
                      ยังไม่มีถังน้ำยา ISO (Part B) ในหมวดนี้
                    </div>
                  ) : (
                    <div
                      ref={isoSliderRef}
                      className="flex gap-2.5 overflow-x-auto pb-2 pt-0.5 scroll-smooth no-scrollbar"
                    >
                      {isoDrums.map(renderCompactDrumCard)}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 1: CHEMICAL CUT HISTORY */}
        {activeSubTab === 'cuts' && (
          <div className="space-y-4">
            {/* Search and Filter Row */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="ค้นหาเลขที่ SO, วันที่, Density, หรือ No.ถัง..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <span className="text-xs text-slate-500 shrink-0">กรองสูตร:</span>
                <select
                  value={selectedFormulaFilter}
                  onChange={(e) => setSelectedFormulaFilter(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none w-full sm:w-auto"
                >
                  <option value="all">ทุกสูตรคำนวณ</option>
                  {formulas.map(f => (
                    <option key={f.id} value={f.id}>{f.name} ({f.density || 'D32'})</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Table */}
            {filteredCuts.length === 0 ? (
              <div className="text-center py-12 px-4 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50">
                <Scissors className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700">ยังไม่มีประวัติการตัดสต๊อกน้ำยา</p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  กดปุ่ม "ตัดสต๊อกน้ำยาจาก SO" ด้านบน เพื่อดึงข้อมูล SO ที่ผลิตจริงและ NG พร้อมระบุความเร็วสายพาน
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-3">วันที่ / เวลา</th>
                      <th className="py-3 px-3">เลขที่ SO</th>
                      <th className="py-3 px-3">สูตร / Density / นิ้ว</th>
                      <th className="py-3 px-3">No. ถัง</th>
                      <th className="py-3 px-3 text-right">สายพาน (ม./นาที)</th>
                      <th className="py-3 px-3 text-right">ผลิตจริง (ม.)</th>
                      <th className="py-3 px-3 text-right">NG (ม.)</th>
                      <th className="py-3 px-3 text-right">ตัด Poly (กก.)</th>
                      <th className="py-3 px-3 text-right">ตัด ISO (กก.)</th>
                      <th className="py-3 px-3 text-right">รวมตัด (กก.)</th>
                      <th className="py-3 px-3 text-right">คงเหลือหลังตัด</th>
                      <th className="py-3 px-3 text-center">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredCuts.map((cut) => (
                      <tr key={cut.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3 font-mono text-slate-600 whitespace-nowrap">
                          {cut.cutDate}
                          <span className="block text-[10px] text-slate-400">
                            {new Date(cut.createdAt).toLocaleTimeString('th-TH')}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold font-mono text-slate-900 text-xs">
                              {cut.soNumber}
                            </span>
                            {cut.densityK && (
                              <span className="px-1.5 py-0.2 rounded bg-amber-200 text-amber-950 font-bold font-mono text-[10px]">
                                {cut.densityK}
                              </span>
                            )}
                            {cut.soNumbers && cut.soNumbers.length > 1 && (
                              <span className="px-1 py-0.2 rounded bg-amber-100 text-amber-900 font-bold text-[10px]">
                                {cut.soNumbers.length} ใบ
                              </span>
                            )}
                          </div>
                          {cut.source && (
                            <span className="block text-[10px] text-slate-400 mt-0.5">
                              {cut.source === 'sandwich_cut' ? 'PU แซนวิช' : 'ฟอยล์ติดแผ่น'}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-slate-900">
                            {cut.formulaName}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5 text-[10px]">
                            {cut.density && (
                              <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 font-bold">
                                {cut.density}
                              </span>
                            )}
                            {cut.inchSize && (
                              <span className="px-1.5 py-0.2 rounded bg-blue-100 text-blue-900 font-bold">
                                {cut.inchSize}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-700 whitespace-nowrap">
                          {cut.drumNumber || '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-blue-800 whitespace-nowrap">
                          {cut.lineSpeedMPerMin ? `${cut.lineSpeedMPerMin} ม./นาที` : '-'}
                          {cut.ratePerMeterUsed && (
                            <span className="block text-[10px] text-slate-400">
                              ({cut.ratePerMeterUsed} กก./ม.)
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-800 whitespace-nowrap">
                          {formatMeters(cut.usedMeters)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-rose-600 whitespace-nowrap">
                          {cut.ngMeters > 0 ? formatMeters(cut.ngMeters) : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-semibold text-emerald-900 whitespace-nowrap">
                          -{cut.partAKg.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-semibold text-indigo-900 whitespace-nowrap">
                          -{cut.partBKg.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-900 whitespace-nowrap bg-amber-50/40">
                          {cut.totalChemicalKg.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-[11px] text-slate-500 whitespace-nowrap">
                          Poly: {cut.remainingAAfter.toLocaleString()} | ISO: {cut.remainingBAfter.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleConfirmRevert(cut.id, cut.soNumber)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="ยกเลิกรายการตัดนี้และคืนยอดน้ำยาเข้าสต๊อก"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: RESTOCK HISTORY */}
        {activeSubTab === 'restock' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">
                ประวัติการรับเข้าและเติมถังน้ำยา ({restockRecords.length} รายการ)
              </span>
              <button
                type="button"
                onClick={() => handleActionGuarded(onOpenRestockModal)}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <PackagePlus className="w-4 h-4" />
                <span>รับเข้าน้ำยาเพิ่ม</span>
              </button>
            </div>

            {restockRecords.length === 0 ? (
              <div className="text-center py-10 px-4 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50">
                <PackagePlus className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700">ยังไม่มีประวัติการรับเข้าน้ำยา</p>
                <p className="text-xs text-slate-500 mt-1">
                  กดปุ่ม "รับเข้าน้ำยาเพิ่ม" เพื่อบันทึกการเติมถังน้ำยาเคมี (ISO 250 กก., Poly 210/215 กก.)
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-3">วันที่รับเข้า</th>
                      <th className="py-3 px-3">ชื่อน้ำยา (โฟลเดอร์)</th>
                      <th className="py-3 px-3">No. ถัง</th>
                      <th className="py-3 px-3">ชนิดที่รับ</th>
                      <th className="py-3 px-3 text-right">จำนวนถัง</th>
                      <th className="py-3 px-3 text-right">Poly เพิ่ม (กก.)</th>
                      <th className="py-3 px-3 text-right">ISO เพิ่ม (กก.)</th>
                      <th className="py-3 px-3 text-right">รวมที่เพิ่ม (กก.)</th>
                      <th className="py-3 px-3">ผู้จัดจำหน่าย / ผู้บันทึก</th>
                      <th className="py-3 px-3 text-center">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {restockRecords.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3 font-mono text-slate-700 whitespace-nowrap">
                          {r.date}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-bold text-slate-900">
                            {r.chemicalName || 'K-Foam 32'}
                          </span>
                          {r.supportedDensities && r.supportedDensities.length > 0 && (
                            <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                              <span className="text-[10px] text-slate-400">ผลิตได้:</span>
                              {r.supportedDensities.map(k => (
                                <span key={k} className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 border border-amber-200">
                                  {k}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-800">
                          {r.drumNumber || r.lotNumber}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                            {r.chemicalType === 'both' ? 'ทั้งคู่ (Poly+ISO)' : r.chemicalType === 'part_a' ? 'เฉพาะ Poly' : 'เฉพาะ ISO'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                          {r.drumsCount} ถัง
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-emerald-700 font-semibold">
                          +{r.partAKgAdded.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-indigo-700 font-semibold">
                          +{r.partBKgAdded.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-800 bg-amber-50/30">
                          +{r.totalKgAdded.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          <div>{r.supplier || '-'}</div>
                          <span className="text-[10px] text-slate-400">โดย: {r.recordedBy}</span>
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            {onEditRestock && (
                              <button
                                type="button"
                                onClick={() => handleActionGuarded(() => onEditRestock(r))}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-amber-700 hover:bg-amber-50 transition-colors cursor-pointer"
                                title="แก้ไขรายการรับเข้านี้"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {onDeleteRestock && (
                              <button
                                type="button"
                                onClick={() => handleActionGuarded(() => {
                                  if (confirm(`คุณต้องการลบรายการรับเข้าน้ำยา "${r.chemicalName}" (${r.date}) จำนวน ${r.totalKgAdded.toLocaleString()} กก. ใช่หรือไม่?\n(ระบบจะปรับลดยอดน้ำยาคงเหลือในคลังกลับคืน)`)) {
                                    onDeleteRestock(r.id);
                                  }
                                })}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                title="ลบรายการรับเข้านี้"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: FORMULAS LIST */}
        {activeSubTab === 'formulas' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  สูตรคำนวณน้ำยาและผลทดสอบการชั่งน้ำหนัก (Calibration)
                </h4>
                <p className="text-xs text-slate-500">
                  ชั่งน้ำหนัก Poly & ISO (วินาที) → คำนวณ กก./นาที → ผูกความเร็วสายพานผลิตจริง
                </p>
              </div>
              <button
                type="button"
                onClick={onOpenFormulaModal}
                className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Beaker className="w-4 h-4" />
                <span>ผูกสูตรน้ำยาใหม่</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {formulas.map(f => (
                <div key={f.id} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                  <div className="flex items-start justify-between gap-1">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        {(f.densities && f.densities.length > 0
                          ? f.densities
                          : (f.density ? f.density.split(/[,/]/).map(s => s.trim()) : ['Density 32'])
                        ).map((d, dIdx) => (
                          <span key={dIdx} className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-200 text-amber-950">
                            {d}
                          </span>
                        ))}
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-900">
                          {f.inchSize || `${f.foamThicknessMm} มม.`}
                        </span>
                        {f.drumNumber && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-200 text-slate-800">
                            {f.drumNumber}
                          </span>
                        )}
                      </div>
                      <span className="font-bold text-slate-900 text-sm">
                        {f.name}
                      </span>
                    </div>
                    {f.isDefault && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-600 text-white shrink-0">
                        สูตรหลัก
                      </span>
                    )}
                  </div>

                  {f.description && (
                    <p className="text-xs text-slate-500 line-clamp-2">
                      {f.description}
                    </p>
                  )}

                  {/* Calibration summary */}
                  <div className="p-2.5 rounded-lg bg-white border border-slate-100 text-xs font-mono space-y-1.5">
                    <div className="grid grid-cols-2 gap-1 text-[11px]">
                      <div>
                        <span className="text-slate-500 block">Poly (A):</span>
                        <strong className="text-emerald-700">{f.polyFlowRatePerMin || 3.4} กก./นาที</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block">ISO (B):</span>
                        <strong className="text-indigo-700">{f.isoFlowRatePerMin || 3.4} กก./นาที</strong>
                      </div>
                    </div>

                    <div className="pt-1.5 border-t border-slate-100 flex justify-between text-slate-700">
                      <span className="text-slate-500">รวม 1 นาที:</span>
                      <strong className="text-slate-900">{f.totalFlowRatePerMin || 6.8} กก./นาที</strong>
                    </div>

                    <div className="flex justify-between text-blue-900">
                      <span className="text-slate-500">สายพานมาตรฐาน:</span>
                      <strong>{f.defaultLineSpeedMPerMin || 8.0} ม./นาที</strong>
                    </div>

                    <div className="flex justify-between bg-amber-50 p-1 rounded text-amber-900">
                      <span className="text-slate-600">อัตราต่อเมตร:</span>
                      <strong className="font-bold">{f.usageRatePerMeter} กก./ม.</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Drum Stock Card Modal */}
      <ChemicalStockCardModal
        isOpen={!!selectedStockCardDrum}
        onClose={() => setSelectedStockCardDrum(null)}
        drumCard={selectedStockCardDrum}
        onEditDrum={(drum) => {
          setSelectedStockCardDrum(null);
          setEditingDrum(drum);
        }}
        onDeleteDrum={onDeleteDrum ? (drumNum, chemName) => {
          if (confirm(`คุณต้องการลบถัง "${drumNum}" (${chemName}) ออกจากระบบใช่หรือไม่?`)) {
            onDeleteDrum(drumNum, chemName);
            setSelectedStockCardDrum(null);
            showToast(`ลบถังน้ำยา "${drumNum}" เรียบร้อย`);
          }
        } : undefined}
      />

      {/* Edit Chemical Drum Modal */}
      {editingDrum && (
        <ChemicalEditDrumModal
          isOpen={Boolean(editingDrum)}
          onClose={() => setEditingDrum(null)}
          drumCard={editingDrum}
          onSaveDrum={(oldNum, newNum, oldChem, newChem, supp, initKg, recDate) => {
            if (onSaveDrum) {
              onSaveDrum(oldNum, newNum, oldChem, newChem, supp, initKg, recDate);
            }
          }}
          onDeleteDrum={(drumNum, chemName) => {
            if (onDeleteDrum) {
              onDeleteDrum(drumNum, chemName);
            }
          }}
          showToast={showToast}
        />
      )}

      {/* Folder K Config Modal (โฟลเดอร์น้ำยา Poly มีกำหนดค่า K ไว้) */}
      {editingFolderK && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 border border-slate-200 shadow-xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300">
                  โฟลเดอร์ Poly (Part A)
                </span>
                <h4 className="text-base font-bold text-slate-900 mt-1">
                  กำหนดค่า K สำหรับ: {editingFolderK.chemicalName}
                </h4>
                <p className="text-xs text-slate-500">
                  น้ำยาตัวนี้ผลิตได้กี่ K (ติ๊กเลือก Density ที่รองรับ เช่น 25k, 28k, 30k)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingFolderK(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Density K Pills Selection */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 block">
                ค่า K ที่ผลิตได้ (Density):
              </label>
              <div className="flex items-center gap-1.5 flex-wrap">
                {sortDensityList(Array.from(new Set([...DENSITY_K_PRESETS, ...editingFolderK.densities]))).map(k => {
                  const isSelected = editingFolderK.densities.includes(k);
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => {
                        if (isSelected) {
                          setEditingFolderK({
                            ...editingFolderK,
                            densities: editingFolderK.densities.filter(item => item !== k),
                          });
                        } else {
                          setEditingFolderK({
                            ...editingFolderK,
                            densities: [...editingFolderK.densities, k],
                          });
                        }
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1 ${
                        isSelected
                          ? 'bg-amber-500 text-slate-950 border border-amber-500 shadow-2xs'
                          : 'bg-white text-slate-700 border border-slate-300 hover:bg-amber-50'
                      }`}
                    >
                      {isSelected ? <Check className="w-3.5 h-3.5 stroke-[2.5]" /> : '+'}
                      <span>{k}</span>
                    </button>
                  );
                })}
              </div>
              {/* กรอก K เอง */}
              <div className="flex items-center gap-1.5 pt-1">
                <input
                  type="text"
                  inputMode="decimal"
                  value={folderCustomK}
                  onChange={(e) => { setFolderCustomK(e.target.value); setFolderKError(''); }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      (document.getElementById('folder-custom-k-add') as HTMLButtonElement | null)?.click();
                    }
                  }}
                  placeholder="กรอก K เอง เช่น 32"
                  className="w-36 px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold focus:ring-2 focus:ring-amber-500 outline-none"
                />
                <button
                  id="folder-custom-k-add"
                  type="button"
                  onClick={() => {
                    if (!folderCustomK.trim()) return;
                    const k = normalizeDensityK(folderCustomK);
                    if (!k) {
                      setFolderKError('กรุณากรอกเป็นตัวเลข เช่น 32 หรือ 32k');
                      return;
                    }
                    if (!editingFolderK.densities.includes(k)) {
                      setEditingFolderK({
                        ...editingFolderK,
                        densities: sortDensityList([...editingFolderK.densities, k]),
                      });
                    }
                    setFolderCustomK('');
                    setFolderKError('');
                  }}
                  className="px-2.5 py-1 rounded-lg bg-amber-600 text-white text-[11px] font-bold cursor-pointer"
                >
                  + เพิ่ม
                </button>
              </div>
              {folderKError && <p className="text-[11px] text-rose-600">{folderKError}</p>}
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingFolderK(null)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onUpdateFolderDensities) {
                    onUpdateFolderDensities(editingFolderK.chemicalName, sortDensityList(normalizeDensityList(editingFolderK.densities)));
                  }
                  setEditingFolderK(null);
                }}
                className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold shadow-2xs cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-4 h-4 stroke-[2.5]" />
                <span>บันทึกค่า K ของโฟลเดอร์</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
