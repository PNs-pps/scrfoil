import React, { useState, useEffect, useRef } from 'react';
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
  ShieldAlert,
  Lock,
  Calculator
} from 'lucide-react';
import { TouchNumpad, TouchNumpadTarget } from './TouchNumpad';
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
  /** บันทึกหลาย SO พร้อมกันเป็น batch (เรียกเมื่อมีมากกว่า 1 แถว) */
  onSaveBatch?: (records: PuSandwichCutRecord[]) => Promise<void> | void;
  records?: PuSandwichCutRecord[];
  onDeleteRecord?: (recordId: string) => Promise<void> | void;
  initialMode?: 'create' | 'history';
  editingRecord?: PuSandwichCutRecord | null;
  currentUserEmail?: string | null;
}

const COMMON_COIL_COLORS = ['สีขาว', 'สีดำ', 'สีน้ำตาล', 'สีเขียว', 'สีฟ้า', 'สีเทา', 'อลูซิงค์ (ซิงค์)'];

/**
 * แถวข้อมูลต่อ 1 SO (per-row) — ข้อมูลระดับม้วนคอล์ย (lot-level)
 * เช่น สีคอล์ย / ความหนา / เบอร์คอล์ย / แหล่งเหล็ก / วันที่ผลิต / ผู้บันทึก
 * เก็บแยกต่างหากและใช้ร่วมกันทุกแถวใน batch เดียวกัน
 */
export interface SandwichRow {
  id: string;
  soNumber: string;
  soLengthMeters: string;
  lengthMeters: string;
  ngKg: string;
  ngMeters: string;
  notes: string;
}

export const PuSandwichModal: React.FC<PuSandwichModalProps> = ({
  isOpen,
  onClose,
  onSaveRecord,
  onSaveCut,
  onSaveBatch,
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

  // ===== Lot-level Form State (ใช้ร่วมกันทุกแถวใน batch) =====
  const [productionDate, setProductionDate] = useState(() => todayLocalISO());
  const [coilColor, setCoilColor] = useState('');
  const [thickness, setThickness] = useState('0.35');
  const [coilNumber, setCoilNumber] = useState('');
  // น้ำหนักขึ้น-ลง (ก่อนใช้ / หลังใช้) ระดับม้วน — ชั่งครั้งเดียวต่อม้วน ใช้ร่วมทุกแถว SO
  const [weightBefore, setWeightBefore] = useState('');
  const [weightAfter, setWeightAfter] = useState('');
  const [steelOrigin, setSteelOrigin] = useState<SteelOriginType>('เหล็กนอก');
  const [customSteelOrigin, setCustomSteelOrigin] = useState('');
  const [recordedBy, setRecordedBy] = useState(recentOperators[0] || '');
  const [customKgPerMeter, setCustomKgPerMeter] = useState<string>('');
  const [showCustomFactor, setShowCustomFactor] = useState(false);

  // ===== Per-row Form State (1 แถว = 1 SO) =====
  const createRowId = (index: number): string =>
    `sandwich-row-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`;

  const createEmptyRow = (index: number): SandwichRow => ({
    id: createRowId(index),
    soNumber: `so${getCurrentThaiYearBE2Digits()}${getCurrentMonth2Digits()}`,
    soLengthMeters: '',
    lengthMeters: '',
    ngKg: '',
    ngMeters: '',
    notes: '',
  });

  const [rows, setRows] = useState<SandwichRow[]>(() => [createEmptyRow(1)]);
  /** แถวกำลังถูกโต้ตอบ (numpad / Enter flow) — ค่าเริ่มต้นคือแถวแรก */
  const [activeRowId, setActiveRowId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  /** หน้าต่างยืนยันก่อนบันทึกตัดแซนวิช */
  const [showConfirmSummary, setShowConfirmSummary] = useState(false);

  // Tablet Numpad State
  const [showTabletNumpad, setShowTabletNumpad] = useState<boolean>(() => {
    try {
      return localStorage.getItem('pufoam_tablet_numpad_enabled') === 'true';
    } catch {
      return false;
    }
  });
  const [activeNumpadTargetId, setActiveNumpadTargetId] = useState<string>('weightBefore');

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
      setProductionDate(editingRecord.productionDate || todayLocalISO());
      setCoilColor(editingRecord.coilColor || '');
      setThickness(editingRecord.thickness || '0.35');
      setCoilNumber(editingRecord.coilNumber || '');
      setWeightBefore(editingRecord.weightBefore != null ? String(editingRecord.weightBefore) : '');
      setWeightAfter(editingRecord.weightAfter != null ? String(editingRecord.weightAfter) : '');
      setSteelOrigin(editingRecord.steelOrigin || 'เหล็กนอก');
      setCustomSteelOrigin(editingRecord.customSteelOrigin || '');
      setRecordedBy(editingRecord.recordedBy || recentOperators[0] || '');

      // โหมดแก้ไขยังคงเป็น record เดียวเสมอ
      // ระเบียนเก่าที่เคยกรอก NG เป็น กก. แต่ไม่มี ngMeters — แปลงกลับเป็น เมตร เพื่อไม่ให้ NG หายตอนกดบันทึก
      const editRateKgPerMeter =
        editingRecord.thickness ? getSteelKgPerMeter(editingRecord.thickness) : 0;
      const editNgMeters =
        editingRecord.ngMeters != null && editingRecord.ngMeters > 0
          ? String(editingRecord.ngMeters)
          : editingRecord.ngKg != null && editingRecord.ngKg > 0 && editRateKgPerMeter > 0
            ? String(Math.round((editingRecord.ngKg / editRateKgPerMeter) * 10) / 10)
            : '';
      const editRow: SandwichRow = {
        id: createRowId(1),
        soNumber: editingRecord.soNumber || '',
        soLengthMeters:
          editingRecord.soLengthMeters != null ? String(editingRecord.soLengthMeters) : '',
        lengthMeters:
          editingRecord.lengthMeters != null ? String(editingRecord.lengthMeters) : '',
        ngKg:
          editingRecord.ngKg != null && editingRecord.ngKg > 0 ? String(editingRecord.ngKg) : '',
        ngMeters: editNgMeters,
        notes: editingRecord.notes || '',
      };
      setRows([editRow]);
      setActiveRowId(editRow.id);
      return;
    }

    setActiveTab(initialMode);
    const firstRow = createEmptyRow(1);
    setRows([firstRow]);
    setActiveRowId(firstRow.id);
    setProductionDate(todayLocalISO());
    setThickness('0.35');
    setCoilColor('');
    setCoilNumber('');
    setWeightBefore('');
    setWeightAfter('');
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

  // ===== ส่วนที่ 1 (ระดับม้วน): น้ำหนักขึ้น-ลง ใช้ร่วมทุกแถว SO =====
  const numWeightBefore = parseCleanNum(weightBefore);
  const numWeightAfter = parseCleanNum(weightAfter);
  // น้ำหนักที่ใช้จริงของม้วน (ก่อนใช้ - หลังใช้)
  const coilUsedWeight = (weightBefore !== '' && weightAfter !== '')
    ? Math.max(0, Math.round((numWeightBefore - numWeightAfter) * 100) / 100)
    : 0;

  // ===== ส่วนที่ 2 (ต่อ 1 SO): ความยาวตามใบงาน + น้ำหนักตามทฤษฎีของแถวนั้น =====
  const computeRowCalc = (row: SandwichRow) => {
    const numSoLength = parseCleanNum(row.soLengthMeters);
    const theoreticalSoWeight = numSoLength > 0
      ? Math.round(numSoLength * effectiveKgPerMeter * 100) / 100
      : 0;
    // ผู้ใช้กรอก NG เป็น "เมตร" — แปลงเป็น กก. เพื่อเทียบกับเศษหัวท้ายม้วนที่คำนวณเป็น กก.
    const explicitNgMeters = parseCleanNum(row.ngMeters);
    const explicitNgKg = (effectiveKgPerMeter > 0 && explicitNgMeters > 0)
      ? Math.round(explicitNgMeters * effectiveKgPerMeter * 100) / 100
      : 0;
    return { numSoLength, theoreticalSoWeight, explicitNgKg, explicitNgMeters };
  };

  const rowCalcs = rows.map((row) => ({ row, calc: computeRowCalc(row) }));

  // SO ใบแรกที่กรอก (มีรหัส SO) — เป็นใบที่รวมเศษหัวท้ายม้วน
  const primaryRowIndex = (() => {
    const i = rows.findIndex((r) => r.soNumber.trim() !== '');
    return i >= 0 ? i : 0;
  })();
  const primaryRowId = rows[primaryRowIndex]?.id ?? '';

  // ===== ส่วนที่ 3: รวมน้ำหนักที่ใช้จริงกับความยาวตามใบงานทั้งหมด -> NG (กก. / เมตร) =====
  const totalSoLength = rowCalcs.reduce((sum, { calc }) => sum + calc.numSoLength, 0);
  const totalTheoreticalWeight = rowCalcs.reduce((sum, { calc }) => sum + calc.theoreticalSoWeight, 0);

  // NG (กก.) รวมทั้งม้วน = น้ำหนักขึ้น-ลงรวมทั้งม้วน − น้ำหนักตามทฤษฎีของงาน SO รวมทุกแถว
  const autoNgKg = coilUsedWeight > 0
    ? Math.max(0, Math.round((coilUsedWeight - totalTheoreticalWeight) * 100) / 100)
    : 0;
  const autoNgMeters = (effectiveKgPerMeter > 0 && autoNgKg > 0)
    ? Math.max(0, Math.round((autoNgKg / effectiveKgPerMeter) * 10) / 10)
    : 0;

  // ผลรวมของเสียที่ระบุเฉพาะในแต่ละแถว
  const totalExplicitNgKg = rowCalcs.reduce((sum, { calc }) => sum + calc.explicitNgKg, 0);

  // เศษหัวท้ายม้วน (Head/Tail scrap) ที่ยังไม่ได้เจาะจงใบงาน = autoNgKg - totalExplicitNgKg
  const unassignedHeadTailNgKg = Math.max(0, Math.round((autoNgKg - totalExplicitNgKg) * 100) / 100);

  // ยอด NG ที่จะบันทึกจริงรวมทุกแถว = ผลรวม NG รายแถว (explicit + เศษหัวท้ายที่ลงใบแรก)
  // = max(autoNgKg, totalExplicitNgKg) เพื่อให้ยอดรวมท้ายตารางตรงกับผลรวมรายแถวเสมอ
  const recordedNgKg = Math.round(Math.max(autoNgKg, totalExplicitNgKg) * 100) / 100;
  const recordedNgMeters = (effectiveKgPerMeter > 0 && recordedNgKg > 0)
    ? Math.max(0, Math.round((recordedNgKg / effectiveKgPerMeter) * 10) / 10)
    : 0;

  // คำนวณน้ำหนักเหล็กใช้จริง (weightUsed) เฉลี่ยตามความยาวของแต่ละแถว และเกลี่ยเศษทศนิยมให้รวมเท่ากับ coilUsedWeight เป๊ะ
  const allocatedRowWeights = (() => {
    if (coilUsedWeight <= 0) return rows.map(() => 0);
    if (totalSoLength <= 0) {
      return rows.map((r) => (r.id === primaryRowId ? coilUsedWeight : 0));
    }
    const weights = rows.map((r) => {
      const len = parseCleanNum(r.soLengthMeters);
      return Math.round((len / totalSoLength) * coilUsedWeight * 100) / 100;
    });
    const sumW = weights.reduce((s, w) => s + w, 0);
    const diffW = Math.round((coilUsedWeight - sumW) * 100) / 100;
    if (diffW !== 0 && weights[primaryRowIndex] !== undefined) {
      weights[primaryRowIndex] = Math.round((weights[primaryRowIndex] + diffW) * 100) / 100;
    }
    return weights;
  })();

  const activeRow = rows.find((r) => r.id === activeRowId) || rows[0] || null;
  const activeRowIndex = activeRow ? rows.findIndex((r) => r.id === activeRow.id) : 0;

  /** ค่าที่จะบันทึกลง record ของแต่ละแถว */
  const computeRowSaveValues = (row: SandwichRow) => {
    const calc = computeRowCalc(row);
    const rIdx = rows.findIndex((r) => r.id === row.id);
    const isPrimary = row.id === primaryRowId;
    const rowWeightUsed = allocatedRowWeights[rIdx] ?? (isPrimary ? coilUsedWeight : 0);

    // NG (กก.): ใช้ค่าที่ระบุจริงของใบงานนี้ + ถ้าเป็นใบแรกให้รวมเศษหัวท้ายม้วนเข้าไปด้วย
    let numNgKg = calc.explicitNgKg;
    if (isPrimary) {
      numNgKg = Math.round((numNgKg + unassignedHeadTailNgKg) * 100) / 100;
    }
    const numNgMeters = (effectiveKgPerMeter > 0 && numNgKg > 0)
      ? Math.max(0, Math.round((numNgKg / effectiveKgPerMeter) * 10) / 10)
      : 0;

    return {
      ...calc,
      isPrimary,
      weightBefore: numWeightBefore,
      weightAfter: numWeightAfter,
      weightUsed: rowWeightUsed,
      numNgKg,
      numNgMeters,
      headTailNgKgPortion: isPrimary ? unassignedHeadTailNgKg : 0,
    };
  };

  // ===== Row management =====
  const handleAddRow = () => {
    // โหมดแก้ไขยังคงเป็น record เดียว จึงไม่อนุญาตให้เพิ่มแถว
    if (editingRecord) return;
    const newRow = createEmptyRow(rows.length + 1);
    setRows((prev) => [...prev, newRow]);
    setActiveRowId(newRow.id);
    setTimeout(() => {
      const el = soNumberInputRefs.current[newRow.id];
      if (el) {
        el.focus();
        const len = el.value.length;
        el.setSelectionRange(len, len);
      }
    }, 100);
  };

  const handleRemoveRow = (rowId: string) => {
    if (rows.length <= 1) return;
    const next = rows.filter((r) => r.id !== rowId);
    setRows(next);
    if (activeRowId === rowId) {
      setActiveRowId(next[0]?.id || '');
    }
  };

  const handleUpdateRow = (rowId: string, updates: Partial<SandwichRow>) => {
    setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, ...updates } : r)));
  };

  /** ตั้งแถวที่กำลังทำงาน (และหัวข้อ numpad ถ้าระบุ field) */
  const activateRow = (rowId: string, numpadField?: string) => {
    setActiveRowId(rowId);
    if (numpadField) setActiveNumpadTargetId(numpadField);
  };

  const handleSoLengthChange = (rowId: string, val: string) => {
    handleUpdateRow(rowId, { soLengthMeters: val });
  };

  const handleRowNgMetersChange = (rowId: string, val: string) => {
    const num = parseCleanNum(val);
    const kg = (effectiveKgPerMeter > 0 && num > 0)
      ? String(Math.round(num * effectiveKgPerMeter * 100) / 100)
      : '';
    handleUpdateRow(rowId, { ngMeters: val, ngKg: kg });
  };

  // ===== Input refs สำหรับ focus navigation (Enter flow) =====
  const lotWeightBeforeRef = useRef<HTMLInputElement | null>(null);
  const lotWeightAfterRef = useRef<HTMLInputElement | null>(null);
  const soNumberInputRefs = useRef<{ [rowId: string]: HTMLInputElement | null }>({});
  const soLengthInputRefs = useRef<{ [rowId: string]: HTMLInputElement | null }>({});
  const soNgInputRefs = useRef<{ [rowId: string]: HTMLInputElement | null }>({});

  const focusRowInput = (
    refs: React.RefObject<{ [rowId: string]: HTMLInputElement | null }>,
    rowId: string
  ) => {
    setTimeout(() => {
      const el = refs.current[rowId];
      if (!el) return;
      el.focus();
      if (el.type === 'text') {
        const len = el.value.length;
        el.setSelectionRange(len, len);
      }
    }, 0);
  };

  /**
   * Enter flow:
   * (ส่วน 1) ก่อนใช้ -> หลังใช้  (ส่วน 2) รหัส SO -> ยาว SO -> NG (ถ้ามี) -> แถวถัดไป / เพิ่มแถวใหม่
   */
  const handleLotWeightKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    field: 'before' | 'after'
  ) => {
    if (e.key !== 'Enter' || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    if (field === 'before') {
      lotWeightAfterRef.current?.focus();
    } else {
      const first = rows[0];
      if (first) focusRowInput(soNumberInputRefs, first.id);
    }
  };

  const handleRowKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    row: SandwichRow,
    field: 'soNumber' | 'soLengthMeters' | 'ngMeters'
  ) => {
    if (e.key !== 'Enter' || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    if (field === 'soNumber') {
      focusRowInput(soLengthInputRefs, row.id);
      return;
    }
    if (field === 'soLengthMeters') {
      focusRowInput(soNgInputRefs, row.id);
      return;
    }
    // field === 'ngMeters': ไปแถวถัดไป หรือเพิ่มแถวใหม่
    const idx = rows.findIndex((r) => r.id === row.id);
    const nextRow = idx >= 0 ? rows[idx + 1] : undefined;
    if (nextRow) {
      focusRowInput(soNumberInputRefs, nextRow.id);
    } else {
      handleAddRow();
    }
  };

  // ===== Tablet Numpad: น้ำหนักระดับม้วน + ความยาว SO + NG ของแถวที่ active =====
  const numpadRowPrefix = rows.length > 1 ? `แถว ${activeRowIndex + 1} · ` : '';
  const numpadTargets: TouchNumpadTarget[] = [
    { id: 'weightBefore', label: 'ก่อนใช้ (ม้วน)', value: weightBefore, unit: 'กก.', isAccent: false },
    { id: 'weightAfter', label: 'หลังใช้ (ม้วน)', value: weightAfter, unit: 'กก.', isAccent: false },
    ...(activeRow
      ? [
          { id: 'soLengthMeters', label: `${numpadRowPrefix}ยาว SO`, value: activeRow.soLengthMeters, unit: 'ม.', isAccent: false },
          { id: 'rowNgMeters', label: `${numpadRowPrefix}NG ใบนี้`, value: activeRow.ngMeters || '', unit: 'ม.', isAccent: true },
        ]
      : []),
  ];

  const handleNumpadValueChange = (targetId: string, val: string) => {
    if (targetId === 'weightBefore') setWeightBefore(val);
    else if (targetId === 'weightAfter') setWeightAfter(val);
    else if (targetId === 'soLengthMeters' && activeRow) handleSoLengthChange(activeRow.id, val);
    else if (targetId === 'rowNgMeters' && activeRow) handleRowNgMetersChange(activeRow.id, val);
  };

  const handleNextNumpadTarget = () => {
    if (numpadTargets.length === 0) return;
    const curIdx = numpadTargets.findIndex(t => t.id === activeNumpadTargetId);
    const nextIdx = (curIdx + 1) % numpadTargets.length;
    setActiveNumpadTargetId(numpadTargets[nextIdx].id);
  };

  /**
   * Keyboard ระดับ modal:
   * - Ctrl/Cmd+Enter ที่ไหนก็ได้ใน modal -> submit ทั้ง batch (เส้นทางเดียวกับปุ่มบันทึก)
   * - Enter ปกติใน input -> กันฟอร์ม submit (แต่ละแถวมี Enter flow ของตัวเอง)
   */
  const handleModalKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Enter') return;
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      if (activeTab === 'create' && !showConfirmSummary && !isSubmitting) {
        void handleSubmit();
      }
      return;
    }
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
      e.preventDefault();
    }
  };

  const validateSandwichForm = (): boolean => {
    setError(null);

    // 1) ข้อมูลระดับม้วน (lot-level) ก่อน
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
    if (steelOrigin === 'อื่นๆ' && !customSteelOrigin.trim()) {
      setError('กรุณาระบุรายละเอียดชนิดเหล็ก (กรณีเลือกอื่นๆ)');
      return false;
    }
    // น้ำหนักขึ้น-ลง ระดับม้วน (ส่วนที่ 1)
    if (weightBefore === '' || numWeightBefore <= 0) {
      setError('กรุณาระบุน้ำหนักคอล์ยก่อนใช้ (กก.)');
      return false;
    }
    if (weightAfter === '' || numWeightAfter < 0) {
      setError('กรุณาระบุน้ำหนักคอล์ยหลังใช้ (กก.)');
      return false;
    }
    if (numWeightAfter > numWeightBefore) {
      setError('น้ำหนักหลังใช้ (กก.) ไม่สามารถมากกว่าน้ำหนักก่อนใช้ได้');
      return false;
    }

    // 2) ทีละแถวตามลำดับ หยุดที่ error แรก
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const c = computeRowCalc(row);
      const rowLabel = `แถวที่ ${i + 1}: `;

      if (!row.soNumber.trim()) {
        setError(`${rowLabel}กรุณาระบุรหัส SO`);
        return false;
      }
      if (c.numSoLength <= 0) {
        setError(`${rowLabel}กรุณาระบุความยาวตามใบงาน SO (เมตร) มากกว่า 0`);
        return false;
      }
    }
    return true;
  };

  const buildRowRecord = (
    row: SandwichRow,
    overrides?: { id?: string; createdAt?: string }
  ): PuSandwichCutRecord => {
    const s = computeRowSaveValues(row);

    const payload: PuSandwichCutRecord = {
      id: overrides?.id || `pusw_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      soNumber: row.soNumber.trim(),
      productionDate,
      coilColor: coilColor.trim(),
      thickness: thickness.trim(),
      coilNumber: coilNumber.trim(),
      weightBefore: s.weightBefore,
      weightAfter: s.weightAfter,
      weightUsed: s.weightUsed,
      ngKg: s.numNgKg,
      ngMeters: s.numNgMeters,
      steelOrigin,
      recordedBy: recordedBy.trim() || 'ช่างคุมเครื่อง PU',
      createdAt: overrides?.createdAt || new Date().toISOString(),
    };

    if (s.numSoLength > 0) payload.soLengthMeters = s.numSoLength;
    if (steelOrigin === 'อื่นๆ' && customSteelOrigin.trim()) {
      payload.customSteelOrigin = customSteelOrigin.trim();
    }
    if (row.lengthMeters && parseFloat(row.lengthMeters) > 0) {
      payload.lengthMeters = parseFloat(row.lengthMeters);
    }
    if (row.notes.trim()) payload.notes = row.notes.trim();
    return payload;
  };

  const stripRecordMeta = (
    record: PuSandwichCutRecord
  ): Omit<PuSandwichCutRecord, 'id' | 'createdAt'> => {
    const { id: _id, createdAt: _createdAt, ...rest } = record;
    return rest;
  };

  const executeSandwichSave = async () => {
    if (!isStaff) {
      setShowConfirmSummary(false);
      setError(`บัญชีปัจจุบัน (${currentUserEmail || 'ยังไม่ได้เข้าสู่ระบบ'}) ไม่มีสิทธิ์บันทึกตัดแซนวิช — เฉพาะอีเมลเจ้าหน้าที่ (${getStaffEmails().join(', ')})`);
      return;
    }

    // ป้องกันกรณีไม่มีฟังก์ชันบันทึก: แจ้งเตือนแทนการปิดหน้าต่างเงียบๆ โดยไม่บันทึก
    const canSave = editingRecord
      ? !!onSaveCut
      : !!(onSaveRecord || onSaveCut || onSaveBatch);
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

      // โหมดแก้ไข: คงพฤติกรรม record เดียวไว้เหมือนเดิมทุกประการ
      if (editingRecord) {
        const record = buildRowRecord(rows[0], {
          id: editingRecord.id,
          createdAt: editingRecord.createdAt || new Date().toISOString(),
        });
        if (onSaveCut) await onSaveCut(record);
        onClose();
        return;
      }

      const recordsToSave = rows.map((row) => buildRowRecord(row));

      if (recordsToSave.length === 1) {
        // แถวเดียว: พฤติกรรมเดิม (onSaveCut ก่อนเพื่อคง behavior เดิมของ parent)
        const record = recordsToSave[0];
        if (onSaveCut) {
          await onSaveCut(record);
        } else if (onSaveRecord) {
          await onSaveRecord(stripRecordMeta(record));
        } else if (onSaveBatch) {
          await onSaveBatch(recordsToSave);
        }
      } else if (onSaveBatch) {
        await onSaveBatch(recordsToSave);
      } else {
        // ไม่มี onSaveBatch: เรียก onSaveCut ทีละแถวตามลำดับ
        for (const record of recordsToSave) {
          if (onSaveCut) {
            await onSaveCut(record);
          } else if (onSaveRecord) {
            await onSaveRecord(stripRecordMeta(record));
          }
        }
      }

      if (recordsToSave.length === 1) {
        // พฤติกรรมเดิมของแถวเดียว: รีเซ็ตฟอร์มแล้วสลับไปแท็บประวัติ
        const freshRow = createEmptyRow(1);
        setRows([freshRow]);
        setActiveRowId(freshRow.id);
        setShowConfirmSummary(false);
        setActiveTab('history');
      } else {
        // บันทึกหลายแถว: คงข้อมูลระดับม้วนไว้ (ม้วนเดียวกันตัดหลาย SO)
        // แล้วเริ่มแถวว่างใหม่บนแท็บคีย์ตัด SO เพื่อ batch ถัดไป
        const freshRow = createEmptyRow(1);
        setRows([freshRow]);
        setActiveRowId(freshRow.id);
        setError(null);
      }
    } catch (err: any) {
      setError(err?.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
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

  // ยอดรวมทั้ง batch สำหรับหน้าต่างยืนยัน (น้ำหนัก/NG เป็นระดับม้วน)
  const batchTotals = {
    weightBefore: numWeightBefore,
    weightAfter: numWeightAfter,
    weightUsed: coilUsedWeight,
    soLength: totalSoLength,
    theoreticalWeight: totalTheoreticalWeight,
    ngKg: recordedNgKg,
    ngMeters: recordedNgMeters,
    totalExplicitNgKg,
    headTailNgKg: unassignedHeadTailNgKg,
  };

  const format2 = (n: number) => n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200"
      onKeyDown={handleModalKeyDown}
    >
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

            {activeTab === 'create' && (
              <button
                type="button"
                onClick={() => {
                  const next = !showTabletNumpad;
                  setShowTabletNumpad(next);
                  try {
                    localStorage.setItem('pufoam_tablet_numpad_enabled', String(next));
                  } catch {}
                }}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs ${
                  showTabletNumpad
                    ? 'bg-white text-emerald-900 shadow-md ring-2 ring-white/50'
                    : 'bg-black/25 hover:bg-black/35 text-emerald-100 border border-white/15'
                }`}
                title="เปิด/ปิด แป้นพิมพ์ตัวเลขแท็บเล็ตขนาดใหญ่"
              >
                <Calculator className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">แป้นตัวเลขแท็บเล็ต</span>
                <span className="sm:hidden">Numpad</span>
              </button>
            )}

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
            <form onSubmit={handleSubmit} noValidate className="space-y-5">
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

              {/* ========== ส่วนที่ 1: ข้อมูลม้วนคอล์ย (เบอร์คอยล์/น้ำหนัก/สี/ความหนา/น้ำหนักขึ้นลง) ========== */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 gap-2 flex-wrap">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center text-xs font-black">
                      1
                    </span>
                    ข้อมูลม้วนคอล์ย (เบอร์คอยล์ · น้ำหนัก · สี · ความหนา)
                  </h3>
                  <span className="text-[11px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    ใช้ร่วมกันทุกแถว SO
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                      <Palette className="w-3.5 h-3.5 text-emerald-600" />
                      สีคอล์ย <span className="text-rose-500">*</span>
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

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                      <Gauge className="w-3.5 h-3.5 text-emerald-600" />
                      ความหนา (มม.) <span className="text-rose-500">*</span>
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

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                      <Hash className="w-3.5 h-3.5 text-emerald-600" />
                      เบอร์คอล์ย <span className="text-rose-500">*</span>
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

                  {/* น้ำหนักขึ้น-ลง (ระดับม้วน · ชั่งครั้งเดียวต่อม้วน) */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                      <Scale className="w-3.5 h-3.5 text-emerald-700" />
                      น้ำหนักก่อนใช้ (กก.) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      ref={lotWeightBeforeRef}
                      type="number"
                      step="0.01"
                      min="0"
                      value={weightBefore}
                      onChange={(e) => setWeightBefore(e.target.value)}
                      onFocus={() => setActiveNumpadTargetId('weightBefore')}
                      onKeyDown={(e) => handleLotWeightKeyDown(e, 'before')}
                      placeholder="เช่น 2450.00"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-base font-mono font-bold text-slate-900 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all"
                      required
                    />
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      น้ำหนักคอล์ยก่อนเริ่มตัด (ชั่งครั้งเดียวต่อม้วน)
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                      <Scale className="w-3.5 h-3.5 text-emerald-700" />
                      น้ำหนักหลังใช้ (กก.) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      ref={lotWeightAfterRef}
                      type="number"
                      step="0.01"
                      min="0"
                      value={weightAfter}
                      onChange={(e) => setWeightAfter(e.target.value)}
                      onFocus={() => setActiveNumpadTargetId('weightAfter')}
                      onKeyDown={(e) => handleLotWeightKeyDown(e, 'after')}
                      placeholder="เช่น 2120.00"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-base font-mono font-bold text-slate-900 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all"
                      required
                    />
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      น้ำหนักคอล์ยหลังตัดเสร็จ
                    </span>
                  </div>

                  {/* น้ำหนักที่ใช้จริงของม้วน (คำนวณอัตโนมัติ) */}
                  <div className="bg-emerald-50/70 p-3 rounded-2xl border border-emerald-300 flex flex-col justify-center">
                    <span className="text-[11px] font-semibold text-emerald-800 block">
                      น้ำหนักที่ใช้จริง (ก่อนใช้ - หลังใช้)
                    </span>
                    <div className="text-xl font-black font-mono text-emerald-700">
                      {coilUsedWeight.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                      <span className="text-xs font-normal text-slate-500">กก.</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">
                      ใช้ร่วมทุกแถว SO
                    </span>
                  </div>
                </div>
              </div>
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-teal-100 text-teal-800 flex items-center justify-center text-xs font-black">
                      1
                    </span>
                    ช่องตัวเลือกชนิดเหล็ก (แหล่งที่มา) <span className="text-rose-500">*</span>
                  </h3>
                  <span className="text-xs text-slate-500">เลือก 1 รายการ · ใช้ร่วกันทุกแถว</span>
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
                        ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-200 shadow-2xs'
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
                        ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-200 shadow-2xs'
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

              {/* Lot-level: ผู้บันทึก + อัตราน้ำหนักเหล็กต่อเมตร */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <Calculator className="w-3.5 h-3.5 text-emerald-600" />
                    อัตราน้ำหนักเหล็กต่อเมตร (กก./ม.)
                  </label>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setShowCustomFactor(!showCustomFactor)}
                      className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono font-bold text-slate-900 hover:border-emerald-500 cursor-pointer transition-colors"
                      title="คลิกเพื่อตรวจสอบหรือปรับอัตรา กก./ม."
                    >
                      {effectiveKgPerMeter.toFixed(2)} กก./ม.
                    </button>
                    <span className="text-[11px] text-slate-500">
                      มาตรฐานความหนา {thickness || '0.35'} มม. = {standardKgPerMeter.toFixed(2)} กก./ม.
                    </span>
                  </div>
                  {showCustomFactor && (
                    <div className="mt-2 p-2.5 bg-emerald-50/80 border border-emerald-200 rounded-xl text-xs space-y-1.5 animate-in fade-in">
                      <span className="font-bold text-emerald-900 text-[11px] block">
                        อัตราน้ำหนักเหล็กต่อเมตร (กก./เมตร):
                      </span>
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
                </div>
              </div>

              {/* ========== ส่วนที่ 2: รายการตัด SO (1 แถว = 1 SO) ========== */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 gap-2 flex-wrap">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center text-xs font-black">
                      2
                    </span>
                    รายการตัด SO (รหัส SO + ความยาวตามใบงาน)
                    <span className="text-[10px] font-medium text-slate-500">
                      · {rows.length} ใบ
                    </span>
                  </h3>
                  {!editingRecord && (
                    <button
                      type="button"
                      onClick={handleAddRow}
                      className="px-3 py-1.5 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      เพิ่มแถว SO
                    </button>
                  )}
                </div>

                {rowCalcs.map(({ row, calc }, idx) => {
                  const isPrimary = row.id === primaryRowId;
                  const sv = computeRowSaveValues(row);
                  return (
                    <div
                      key={row.id}
                      className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-3.5"
                    >
                      {/* Row header */}
                      <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-lg bg-slate-900 text-white flex items-center justify-center text-xs font-black">
                            {idx + 1}
                          </span>
                          <span className="text-xs font-bold text-slate-800">
                            แถวที่ {idx + 1}{rows.length > 1 ? ` จาก ${rows.length}` : ''}
                          </span>
                          <span className="text-[10px] text-slate-500 bg-white border border-slate-200 px-1.5 py-0.5 rounded-md">
                            1 แถว = 1 SO
                          </span>
                        </div>
                        {!editingRecord && rows.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveRow(row.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="ลบแถวนี้"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {/* SO Number + ความยาวตามใบงาน SO */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                            <Hash className="w-3.5 h-3.5 text-emerald-600" />
                            รหัสใบสั่งตัด (SO Number) <span className="text-rose-500">*</span>
                          </label>
                          <input
                            ref={(el) => {
                              soNumberInputRefs.current[row.id] = el;
                            }}
                            type="text"
                            value={row.soNumber}
                            onChange={(e) => handleUpdateRow(row.id, { soNumber: e.target.value.toLowerCase() })}
                            onFocus={() => setActiveRowId(row.id)}
                            onKeyDown={(e) => handleRowKeyDown(e, row, 'soNumber')}
                            placeholder="เช่น so6909001"
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-mono font-bold text-slate-900 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all"
                            required
                          />
                          {idx === 0 && (
                            <span className="text-[11px] text-slate-400 mt-1 block">
                              รูปแบบ: so + ปี พ.ศ. + เดือน + ลำดับ
                            </span>
                          )}
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
                            ref={(el) => {
                              soLengthInputRefs.current[row.id] = el;
                            }}
                            type="number"
                            step="0.01"
                            min="0"
                            value={row.soLengthMeters}
                            onChange={(e) => handleSoLengthChange(row.id, e.target.value)}
                            onFocus={() => activateRow(row.id, 'soLengthMeters')}
                            onClick={() => activateRow(row.id, 'soLengthMeters')}
                            onKeyDown={(e) => handleRowKeyDown(e, row, 'soLengthMeters')}
                            placeholder="เช่น 120.00 หรือ 250"
                            className={`w-full px-3 py-2 bg-white border rounded-xl text-sm font-mono font-bold text-slate-900 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all ${
                              showTabletNumpad && activeNumpadTargetId === 'soLengthMeters' && activeRowId === row.id
                                ? 'border-emerald-500 ring-2 ring-emerald-300 bg-emerald-50/20'
                                : 'border-slate-300'
                            }`}
                            required
                          />
                          {/* Quick Chips for SO Length */}
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {['50', '100', '120', '150', '200', '300'].map((chip) => (
                              <button
                                key={chip}
                                type="button"
                                onClick={() => handleSoLengthChange(row.id, chip)}
                                className={`text-[10px] px-1.5 py-0.5 rounded-md border cursor-pointer transition-colors ${
                                  row.soLengthMeters === chip
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

                      {/* น้ำหนักคำนวณของแถวนี้ + ช่องกรอก NG เสียจริง */}
                      <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          {/* ช่อง 1: น้ำหนักใช้จริงของ SO นี้ (เฉลี่ยตามความยาว) */}
                          <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                            <span className="text-[10px] font-semibold text-emerald-800 flex items-center justify-between">
                              <span>น้ำหนักใช้จริงของ SO นี้</span>
                              {totalSoLength > 0 && calc.numSoLength > 0 && (
                                <span className="text-[9px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-bold border border-emerald-100">
                                  {Math.round((calc.numSoLength / totalSoLength) * 100)}%
                                </span>
                              )}
                            </span>
                            <div className="font-mono font-bold text-emerald-700 text-base">
                              {format2(sv.weightUsed)}{' '}
                              <span className="text-xs font-normal text-slate-500">กก.</span>
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono block truncate">
                              ทฤษฎี {format2(calc.theoreticalSoWeight)} กก.
                            </span>
                          </div>

                          {/* ช่อง 2: ระบุ NG ที่เสียจริงของใบงานนี้ */}
                          <div className="bg-white p-2.5 rounded-xl border border-rose-200 focus-within:border-rose-400 focus-within:ring-2 focus-within:ring-rose-100 transition-all">
                            <label className="text-[10px] font-bold text-rose-900 flex items-center justify-between mb-1">
                              <span>NG เสียจริงของใบนี้ (เมตร)</span>
                              <span className="text-[9px] text-slate-400 font-normal">ระบุถ้ามี</span>
                            </label>
                            <input
                              ref={(el) => {
                                soNgInputRefs.current[row.id] = el;
                              }}
                              type="number"
                              step="0.01"
                              min="0"
                              value={row.ngMeters}
                              onChange={(e) => handleRowNgMetersChange(row.id, e.target.value)}
                              onFocus={() => activateRow(row.id, 'rowNgMeters')}
                              onClick={() => activateRow(row.id, 'rowNgMeters')}
                              onKeyDown={(e) => handleRowKeyDown(e, row, 'ngMeters')}
                              placeholder="0.00"
                              className={`w-full px-2 py-1 bg-white border rounded-lg text-sm font-mono font-bold text-rose-700 outline-none transition-all ${
                                showTabletNumpad && activeNumpadTargetId === 'rowNgMeters' && activeRowId === row.id
                                  ? 'border-rose-500 ring-2 ring-rose-300 bg-rose-50/20'
                                  : 'border-slate-300'
                              }`}
                            />
                            {/* Quick NG chips */}
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {['0', '1', '2', '5', '10'].map((chip) => (
                                <button
                                  key={chip}
                                  type="button"
                                  onClick={() => handleRowNgMetersChange(row.id, chip === '0' ? '' : chip)}
                                  className={`text-[9px] px-1.5 py-0.5 rounded border cursor-pointer transition-colors ${
                                    row.ngMeters === chip || (chip === '0' && !row.ngMeters)
                                      ? 'bg-rose-100 text-rose-800 border-rose-300 font-bold'
                                      : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                                  }`}
                                >
                                  {chip === '0' ? 'ไม่มี' : `${chip} ม.`}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* ช่อง 3: ยอด NG สรุปที่จะบันทึกลงใบงานนี้ */}
                          <div
                            className={`p-2.5 rounded-xl border ${
                              sv.numNgKg > 0 ? 'bg-rose-50 border-rose-300' : 'bg-slate-50 border-slate-200'
                            }`}
                          >
                            <span className="text-[10px] font-bold text-slate-700 flex items-center justify-between">
                              <span>NG บันทึกลงใบนี้</span>
                              {sv.isPrimary && sv.headTailNgKgPortion > 0 && (
                                <span className="text-[9px] bg-amber-100 text-amber-900 px-1 py-0.2 rounded font-bold border border-amber-200">
                                  +หัวท้าย {format2(sv.headTailNgKgPortion)} กก.
                                </span>
                              )}
                            </span>
                            <div className={`font-mono font-black text-base ${sv.numNgKg > 0 ? 'text-rose-700' : 'text-slate-400'}`}>
                              {format2(sv.numNgMeters)}{' '}
                              <span className="text-xs font-normal">ม.</span>
                            </div>
                            <span className="text-[10px] font-mono text-slate-500 block truncate">
                              ≈ {format2(sv.numNgKg)} กก.
                              {sv.isPrimary && sv.headTailNgKgPortion > 0
                                ? (calc.explicitNgKg > 0 ? ` (งานนี้ ${format2(calc.explicitNgMeters)} + หัวท้าย)` : ' (รวมเศษหัวท้ายม้วน)')
                                : (calc.explicitNgKg > 0 ? ` (ตามที่ระบุจริง ${format2(calc.explicitNgMeters)} ม.)` : ' (ไม่มีของเสีย)')}
                            </span>
                          </div>
                        </div>

                        {calc.numSoLength === 0 && (
                          <p className="mt-2.5 text-[11px] text-amber-800 bg-amber-50 p-2 rounded-lg border border-amber-200 flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                            <span>กรุณาระบุ <strong>ความยาวตามใบงาน SO (เมตร)</strong> ด้านบนเพื่อคำนวณอัตโนมัติ</span>
                          </p>
                        )}
                      </div>

                      {/* ความยาวที่ผลิตได้ + หมายเหตุ (per-row) */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            ความยาวที่ผลิตได้ (เมตร) <span className="text-slate-400 font-normal">(ถ้ามี)</span>
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={row.lengthMeters}
                            onChange={(e) => handleUpdateRow(row.id, { lengthMeters: e.target.value })}
                            onFocus={() => setActiveRowId(row.id)}
                            placeholder="เช่น 150.5"
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:border-emerald-500 outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            หมายเหตุ
                          </label>
                          <input
                            type="text"
                            value={row.notes}
                            onChange={(e) => handleUpdateRow(row.id, { notes: e.target.value })}
                            onFocus={() => setActiveRowId(row.id)}
                            placeholder="รายละเอียดเพิ่มเติม (ถ้ามี)"
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:border-emerald-500 outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Add Next Row Button */}
                {!editingRecord && (
                  <button
                    type="button"
                    onClick={handleAddRow}
                    className="w-full py-2 px-3 border border-dashed border-slate-300 hover:border-emerald-500 bg-slate-50 hover:bg-emerald-50/50 text-slate-700 hover:text-emerald-900 rounded-xl font-medium text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <PlusCircle className="w-3.5 h-3.5 text-emerald-600" />
                    <span>+ เพิ่มแถว SO ถัดไป</span>
                  </button>
                )}
              </div>

              {/* ========== ส่วนที่ 3: สรุปการคำนวณ (ระดับม้วน) ========== */}
              <div className="p-4 bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl border border-slate-700 shadow-sm space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="w-6 h-6 rounded-lg bg-emerald-500 text-white flex items-center justify-center text-xs font-black">
                    3
                  </span>
                  <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <Calculator className="w-4 h-4 text-emerald-400" />
                    ส่วนที่ 3: สรุปการคำนวณ
                  </h3>
                  <span className="text-[11px] text-slate-400 ml-auto">NG ลงตามใบงานที่เสียจริง + เศษหัวท้ายม้วนรวมที่ SO แรก</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-slate-700/60 p-3 rounded-xl border border-slate-600">
                    <span className="text-[10px] font-semibold text-slate-300 block">
                      น้ำหนักที่ใช้จริง (ก่อนใช้ - หลังใช้)
                    </span>
                    <div className="font-mono font-black text-white text-lg">
                      {format2(coilUsedWeight)} <span className="text-xs font-normal text-slate-400">กก.</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono block truncate">
                      ({format2(numWeightBefore)} - {format2(numWeightAfter)})
                    </span>
                  </div>

                  <div className="bg-slate-700/60 p-3 rounded-xl border border-slate-600">
                    <span className="text-[10px] font-semibold text-slate-300 block">
                      รวมงาน SO + น้ำหนักตามทฤษฎี
                    </span>
                    <div className="font-mono font-black text-teal-300 text-lg">
                      {totalSoLength.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                      <span className="text-xs font-normal text-slate-400">ม.</span>
                    </div>
                    <span className="text-[10px] text-teal-200/80 font-mono block truncate">
                      ≈ {format2(totalTheoreticalWeight)} กก. ({effectiveKgPerMeter.toFixed(2)} กก./ม.)
                    </span>
                  </div>

                  <div className="bg-rose-600/20 p-3 rounded-xl border border-rose-500/60">
                    <span className="text-[10px] font-bold text-rose-200 block">ยอดตัดตก / NG รวม</span>
                    <div className="font-mono font-black text-rose-300 text-lg">
                      {format2(autoNgKg)} <span className="text-xs font-normal text-rose-200">กก.</span>
                    </div>
                    <span className="text-[10px] text-rose-200/90 font-mono block truncate">
                      ≈ {autoNgMeters.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ม. · เสียจริง {format2(totalExplicitNgKg)} กก. / หัวท้าย {format2(unassignedHeadTailNgKg)} กก.
                    </span>
                  </div>
                </div>

                {coilUsedWeight > 0 && totalTheoreticalWeight > coilUsedWeight && (
                  <p className="text-[11px] text-amber-200 bg-amber-500/15 p-2 rounded-lg border border-amber-500/40 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-300" />
                    <span>น้ำหนักตามทฤษฎีงาน SO มากกว่าน้ำหนักที่ใช้จริง — NG ถูกตั้งเป็น 0 (ตรวจสอบความยาว SO อีกครั้ง)</span>
                  </p>
                )}
              </div>

              {/* Touch Numpad for Tablet */}
              {showTabletNumpad && (
                <div className="pt-2">
                  <TouchNumpad
                    targets={numpadTargets}
                    activeTargetId={activeNumpadTargetId}
                    onSelectTarget={(id) => setActiveNumpadTargetId(id)}
                    onValueChange={handleNumpadValueChange}
                    onClose={() => setShowTabletNumpad(false)}
                    onNextTarget={handleNextNumpadTarget}
                  />
                </div>
              )}

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
                          : rows.length > 1
                            ? `ตรวจสอบก่อนบันทึก ${rows.length} แถว`
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
                        ({totalNgMetersAll.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ม.)
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
                              {rec.soLengthMeters ? `${rec.soLengthMeters.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ม.` : '-'}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              {(rec.ngKg || 0) > 0 ? (
                                <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 font-bold text-[11px]">
                                  {rec.ngKg?.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              ) : (
                                <span className="text-slate-400 text-[11px]">0.00</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              {(rec.ngMeters || 0) > 0 ? (
                                <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 font-bold text-[11px]">
                                  {rec.ngMeters?.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              ) : (
                                <span className="text-slate-400 text-[11px]">0.00</span>
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
          <div className="bg-white rounded-2xl max-w-2xl w-full p-5 shadow-2xl border border-emerald-200 space-y-4 animate-in zoom-in-95 duration-150 max-h-[90dvh] overflow-y-auto">
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
                  {rows.length > 1 ? ` · จำนวน ${rows.length} รายการ` : ''}
                </p>
              </div>
            </div>

            {/* ข้อมูลระดับม้วน (lot-level) */}
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-3.5 space-y-2 text-sm">
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
              <div className="flex justify-between gap-2">
                <span className="text-slate-500 text-xs">ผู้บันทึก</span>
                <span className="text-xs font-semibold text-slate-800">{recordedBy.trim() || '-'}</span>
              </div>
            </div>

            {/* ตารางรายการตัด SO ทุกแถว */}
            <div className="border border-slate-200 rounded-xl overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
                  <tr>
                    <th className="py-2 px-2.5 text-left">SO</th>
                    <th className="py-2 px-2.5 text-right">ก่อนใช้</th>
                    <th className="py-2 px-2.5 text-right">ใช้จริง</th>
                    <th className="py-2 px-2.5 text-right">หลังใช้</th>
                    <th className="py-2 px-2.5 text-right">ยาว SO</th>
                    <th className="py-2 px-2.5 text-right">NG</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {rows.map((row) => {
                    const sv = computeRowSaveValues(row);
                    return (
                      <tr key={row.id}>
                        <td className="py-2 px-2.5 text-slate-900 font-bold">
                          {row.soNumber.trim() || '—'}
                          {sv.isPrimary && rows.length > 1 && (
                            <span className="ml-1 text-[9px] font-bold text-amber-600">[SO แรก]</span>
                          )}
                        </td>
                        <td className="py-2 px-2.5 text-right text-slate-600">
                          {format2(sv.weightBefore)}
                        </td>
                        <td className="py-2 px-2.5 text-right font-bold text-emerald-700">
                          {format2(sv.weightUsed)}
                        </td>
                        <td className="py-2 px-2.5 text-right text-slate-600">
                          {format2(sv.weightAfter)}
                        </td>
                        <td className="py-2 px-2.5 text-right font-bold text-teal-700">
                          {sv.numSoLength > 0 ? format2(sv.numSoLength) : '—'}
                        </td>
                        <td className="py-2 px-2.5 text-right text-rose-700">
                          {format2(sv.numNgKg)}
                          {sv.numNgMeters > 0 && (
                            <span className="block text-[10px] text-rose-500">{format2(sv.numNgMeters)} ม.</span>
                          )}
                          {sv.isPrimary && sv.headTailNgKgPortion > 0 && rows.length > 1 && (
                            <span className="block text-[9px] text-amber-600 font-sans">
                              (รวมหัวท้าย +{format2(sv.headTailNgKgPortion)})
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-slate-100 border-t border-slate-300 font-bold text-slate-800">
                  <tr>
                    <td className="py-2 px-2.5 whitespace-nowrap">รวมม้วน (ใช้จริง/NG)</td>
                    <td className="py-2 px-2.5 text-right">{format2(batchTotals.weightBefore)}</td>
                    <td className="py-2 px-2.5 text-right text-emerald-700">{format2(batchTotals.weightUsed)}</td>
                    <td className="py-2 px-2.5 text-right">{format2(batchTotals.weightAfter)}</td>
                    <td className="py-2 px-2.5 text-right text-teal-700">{format2(batchTotals.soLength)}</td>
                    <td className="py-2 px-2.5 text-right text-rose-700">
                      {format2(batchTotals.ngKg)}
                      {batchTotals.ngMeters > 0 && (
                        <span className="block text-[10px] text-rose-500">{format2(batchTotals.ngMeters)} ม.</span>
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
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
