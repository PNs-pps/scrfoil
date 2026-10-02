import { 
  ChemicalFormula, 
  ChemicalStock, 
  ChemicalCutRecord, 
  ChemicalRestockRecord, 
  StockCutRecord, 
  PuSandwichCutRecord,
  DrumStockCardItem
} from '../types';
import { round2, todayLocalYMD, csvCell } from './formatters';
import { normalizeDensityList, normalizeDensityK } from './density';

const STORAGE_KEYS = {
  CHEMICAL_STOCK: 'pufoam_chemical_stock_v1',
  CHEMICAL_FORMULAS: 'pufoam_chemical_formulas_v1',
  CHEMICAL_CUT_RECORDS: 'pufoam_chemical_cut_records_v1',
  CHEMICAL_RESTOCK_RECORDS: 'pufoam_chemical_restock_records_v1',
};

/**
 * คำนวณอัตราการใช้น้ำยาใน 1 นาที (กก./นาที) จากน้ำหนักที่ชั่งได้และจำนวนวินาทีที่ทดสอบ
 * flowRate = (weightKg / seconds) * 60
 */
export function calculateFlowRatePerMin(weightKg: number, seconds: number): number {
  const safeWeight = Math.max(0, Number(weightKg) || 0);
  const safeSec = Math.max(0, Number(seconds) || 0);
  if (safeSec <= 0 || safeWeight <= 0) return 0;
  return round2((safeWeight / safeSec) * 60);
}

/**
 * คำนวณอัตราการใช้น้ำยาต่อเมตร (กก./เมตร) จากความเร็วสายพานที่ใช้ผลิตจริง (เมตร/นาที)
 * ratePerMeter = flowRatePerMin / lineSpeed
 */
export function calculateRatePerMeter(flowRatePerMin: number, lineSpeedMPerMin: number): number {
  const safeFlow = Math.max(0, Number(flowRatePerMin) || 0);
  const safeSpeed = Math.max(0, Number(lineSpeedMPerMin) || 0);
  if (safeSpeed <= 0 || safeFlow <= 0) return 0;
  return round2(safeFlow / safeSpeed);
}

/** สูตรมาตรฐานเริ่มต้นสำหรับโรงงานผลิตหลังคาพียูโฟม */
export const DEFAULT_CHEMICAL_FORMULAS: ChemicalFormula[] = [
  {
    id: 'formula-1inch',
    name: 'น้ำยาโฟมมาตรฐาน 1 นิ้ว (K-Foam 32)',
    density: 'Density 32',
    inchSize: '1 นิ้ว',
    drumNumber: 'ถัง #A01 / #B01',
    description: 'สูตรฉีดโฟมหนา 1 นิ้ว (25 มม.) สำหรับหลังคาเมทัลชีทติดฟอยล์มาตรฐาน ความเร็วสายพาน ~8.0 ม./นาที',
    foamThicknessMm: 25,
    
    // ชั่งน้ำหนักทดสอบ: Poly 0.283 กก. ใน 5 วินาที -> 3.40 กก./นาที
    polyWeightKg: 0.283,
    polySeconds: 5,
    polyFlowRatePerMin: 3.40,

    // ชั่งน้ำหนักทดสอบ: ISO 0.283 กก. ใน 5 วินาที -> 3.40 กก./นาที
    isoWeightKg: 0.283,
    isoSeconds: 5,
    isoFlowRatePerMin: 3.40,

    totalFlowRatePerMin: 6.80,    // รวม 6.80 กก./นาที
    defaultLineSpeedMPerMin: 8.0, // สายพาน 8.0 ม./นาที
    usageRatePerMeter: 0.85,      // 6.80 / 8.0 = 0.85 กก./เมตร
    ngRatePerMeter: 0.85,
    partARatioPercent: 50,        // Poly 50%
    partBRatioPercent: 50,        // ISO 50%
    wasteFactorPercent: 0,
    isDefault: true,
  },
  {
    id: 'formula-2inch',
    name: 'น้ำยาโฟมหนา 2 นิ้ว (K-Foam 35)',
    density: 'Density 35',
    inchSize: '2 นิ้ว',
    drumNumber: 'ถัง #A03 / #B03',
    description: 'สูตรฉีดโฟมหนา 2 นิ้ว (50 มม.) งานห้องเย็น โรงงาน หรือโครงสร้างควบคุมอุณหภูมิ สายพาน ~8.0 ม./นาที',
    foamThicknessMm: 50,
    
    polyWeightKg: 0.550,
    polySeconds: 5,
    polyFlowRatePerMin: 6.60,

    isoWeightKg: 0.550,
    isoSeconds: 5,
    isoFlowRatePerMin: 6.60,

    totalFlowRatePerMin: 13.20,
    defaultLineSpeedMPerMin: 8.0,
    usageRatePerMeter: 1.65,      // 13.20 / 8.0 = 1.65 กก./เมตร
    ngRatePerMeter: 1.65,
    partARatioPercent: 50,
    partBRatioPercent: 50,
    wasteFactorPercent: 0,
    isDefault: false,
  },
  {
    id: 'formula-sandwich-2inch',
    name: 'น้ำยา PU แซนวิช 2 นิ้ว (Density 35)',
    density: 'Density 35',
    inchSize: '2 นิ้ว',
    drumNumber: 'ถัง #A04 / #B04',
    description: 'สูตรผลิตแผ่นฉนวนแซนวิชพาเนล (Sandwich Panel) ความหนาแน่น 35 kg/m³ สายพาน ~8.0 ม./นาที',
    foamThicknessMm: 50,
    
    polyWeightKg: 0.583,
    polySeconds: 5,
    polyFlowRatePerMin: 7.00,

    isoWeightKg: 0.583,
    isoSeconds: 5,
    isoFlowRatePerMin: 7.00,

    totalFlowRatePerMin: 14.00,
    defaultLineSpeedMPerMin: 8.0,
    usageRatePerMeter: 1.75,      // 14.00 / 8.0 = 1.75 กก./เมตร
    ngRatePerMeter: 1.75,
    partARatioPercent: 50,
    partBRatioPercent: 50,
    wasteFactorPercent: 0,
    isDefault: false,
  },
  {
    id: 'formula-high-density',
    name: 'น้ำยาโฟมแน่นพิเศษ (Density 40)',
    density: 'Density 40',
    inchSize: '1 นิ้ว',
    drumNumber: 'ถัง #A05 / #B05',
    description: 'สูตรเพิ่มความแข็งแรง ฉีดน้ำยาแน่นพิเศษ รับน้ำหนักและกันไฟได้ดีขึ้น สัดส่วน A 48% : B 52%',
    foamThicknessMm: 25,
    
    polyWeightKg: 0.336,
    polySeconds: 5,
    polyFlowRatePerMin: 4.03,

    isoWeightKg: 0.364,
    isoSeconds: 5,
    isoFlowRatePerMin: 4.37,

    totalFlowRatePerMin: 8.40,
    defaultLineSpeedMPerMin: 8.0,
    usageRatePerMeter: 1.05,      // 8.40 / 8.0 = 1.05 กก./เมตร
    ngRatePerMeter: 1.05,
    partARatioPercent: 48,
    partBRatioPercent: 52,
    wasteFactorPercent: 0,
    isDefault: false,
  },
];

/** ค่าเริ่มต้นสต๊อกน้ำยาในคลัง (ISO 250 กก./ถัง, Poly 210 กก./ถัง) */
export const DEFAULT_INITIAL_CHEMICAL_STOCK: ChemicalStock = {
  id: 'main',
  partAName: 'น้ำยา Poly (โพลีออล)',
  partBName: 'น้ำยา ISO (ไอโซไซยาเนต)',
  partAStockKg: 840,            // เริ่มต้น 4 ถัง x 210 กก. = 840 กก.
  partBStockKg: 1000,           // เริ่มต้น 4 ถัง x 250 กก. = 1,000 กก.
  drumCapacityPolyKg: 210,      // Poly มาตรฐาน 210 กก./ถัง (หรือ 215 กก.)
  drumCapacityIsoKg: 250,       // ISO มาตรฐาน 250 กก./ถัง
  drumCapacityKg: 250,          // backward compatible
  updatedAt: new Date().toISOString(),
};

// ====================================================
// Local Storage Functions
// ====================================================

/** ความหนาโฟม PU ที่ระบบรองรับ: 1 นิ้ว และ 2 นิ้ว เท่านั้น */
export const PU_INCH_OPTIONS: Array<{ label: string; thicknessMm: number }> = [
  { label: '1 นิ้ว', thicknessMm: 25 },
  { label: '2 นิ้ว', thicknessMm: 50 },
];

/** แปลงข้อความนิ้ว ("1", "1 นิ้ว", "2 นิ้ว (แซนวิช)") เป็น '1 นิ้ว' / '2 นิ้ว' — คืน '' ถ้าไม่ใช่ 1 หรือ 2 */
export function normalizeInchSize(input: unknown): string {
  const m = String(input ?? '').match(/(\d+(?:\.\d+)?)/);
  if (!m) return '';
  const n = Number(m[1]);
  if (n === 1) return '1 นิ้ว';
  if (n === 2) return '2 นิ้ว';
  return '';
}

/**
 * น้ำหนักตั้งต้นของถังหนึ่งใบในรายการรับเข้า
 * - ถ้าแก้น้ำหนักรายถังไว้ (drumKgOverrides) ใช้ค่านั้น
 * - ไม่เช่นนั้นเฉลี่ยยอดที่เหลือ (ยอดรวม − ยอดที่แก้รายถัง) ให้ถังที่ไม่ได้แก้
 */
export function drumInitialKg(
  r: ChemicalRestockRecord,
  type: 'part_a' | 'part_b',
  drumNo: string
): number {
  const list = (type === 'part_a' ? r.polyDrumNumbers : r.isoDrumNumbers) || [];
  const total = Number(type === 'part_a' ? r.partAKgAdded : r.partBKgAdded) || 0;
  const overrides = r.drumKgOverrides || {};
  const keyOf = (no: string) => `${type === 'part_a' ? 'a' : 'b'}|${no.trim()}`;
  const own = overrides[keyOf(drumNo)];
  if (typeof own === 'number' && own >= 0) return round2(own);
  if (total <= 0 || list.length === 0) return 0;
  const clean = list.map(d => d.trim());
  const overSum = clean.reduce((sum, d) => sum + (typeof overrides[keyOf(d)] === 'number' ? overrides[keyOf(d)] : 0), 0);
  const free = clean.filter(d => typeof overrides[keyOf(d)] !== 'number').length;
  if (free <= 0) return 0;
  return round2(Math.max(0, total - overSum) / free);
}

/**
 * ทำความสะอาดรายการสูตรที่โหลดจาก localStorage หรือ Firestore ให้อยู่ในรูปแบบปัจจุบัน
 * - ตัดสูตรตั้งต้น 1.5 นิ้วเดิมออก (PU มีเฉพาะ 1 และ 2 นิ้ว)
 * - แปลง Density เป็น "Nk" และเติมค่าที่ขาด
 */
export function normalizeFormulaList(parsed: any[]): ChemicalFormula[] {
  const kept = (parsed || []).filter((item: any) => item && !(item.id === 'formula-1.5inch' && !normalizeInchSize(item.inchSize)));
  if (kept.length === 0) return DEFAULT_CHEMICAL_FORMULAS;
  return kept.map((item: any, idx: number) => {
    const fallback = DEFAULT_CHEMICAL_FORMULAS.find(f => f.id === item.id) || DEFAULT_CHEMICAL_FORMULAS[idx] || DEFAULT_CHEMICAL_FORMULAS[0];
    const polyWeightKg = Number(item.polyWeightKg ?? fallback.polyWeightKg);
    const polySeconds = Number(item.polySeconds ?? fallback.polySeconds ?? 5);
    const polyFlowRatePerMin = Number(item.polyFlowRatePerMin ?? calculateFlowRatePerMin(polyWeightKg, polySeconds));
    
    const isoWeightKg = Number(item.isoWeightKg ?? fallback.isoWeightKg);
    const isoSeconds = Number(item.isoSeconds ?? fallback.isoSeconds ?? 5);
    const isoFlowRatePerMin = Number(item.isoFlowRatePerMin ?? calculateFlowRatePerMin(isoWeightKg, isoSeconds));

    const totalFlowRatePerMin = Number(item.totalFlowRatePerMin ?? round2(polyFlowRatePerMin + isoFlowRatePerMin));
    const defaultLineSpeedMPerMin = Number(item.defaultLineSpeedMPerMin ?? fallback.defaultLineSpeedMPerMin ?? 8.0);
    const usageRatePerMeter = Number(item.usageRatePerMeter ?? calculateRatePerMeter(totalFlowRatePerMin, defaultLineSpeedMPerMin));

    return {
      ...item,
      ...(() => {
        // รวม density ให้เป็นรูปแบบเดียวกัน "25k, 30k" (ข้อมูลเก่า "Density 32" → "32k")
        const list = normalizeDensityList(item.densities && item.densities.length ? item.densities : (item.density || fallback.density));
        const safe = list.length > 0 ? list : ['30k'];
        return { density: safe.join(', '), densities: safe };
      })(),
      inchSize: normalizeInchSize(item.inchSize) || item.inchSize || fallback.inchSize || '1 นิ้ว',
      drumNumber: item.drumNumber || fallback.drumNumber || `ถัง #${idx + 1}`,
      polyWeightKg,
      polySeconds,
      polyFlowRatePerMin,
      isoWeightKg,
      isoSeconds,
      isoFlowRatePerMin,
      totalFlowRatePerMin,
      defaultLineSpeedMPerMin,
      usageRatePerMeter,
      ngRatePerMeter: Number(item.ngRatePerMeter ?? usageRatePerMeter),
      partARatioPercent: Number(item.partARatioPercent ?? (totalFlowRatePerMin > 0 ? round2((polyFlowRatePerMin / totalFlowRatePerMin) * 100) : 50)),
      partBRatioPercent: Number(item.partBRatioPercent ?? (totalFlowRatePerMin > 0 ? round2((isoFlowRatePerMin / totalFlowRatePerMin) * 100) : 50)),
    };
  });
}

export function getStoredFormulas(): ChemicalFormula[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CHEMICAL_FORMULAS);
    if (!raw) {
      saveStoredFormulas(DEFAULT_CHEMICAL_FORMULAS);
      return DEFAULT_CHEMICAL_FORMULAS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const normalized = normalizeFormulaList(parsed);
      if (normalized.length !== parsed.length) saveStoredFormulas(normalized);
      return normalized;
    }
    return DEFAULT_CHEMICAL_FORMULAS;
  } catch (err) {
    console.warn('Failed to load chemical formulas from storage', err);
    return DEFAULT_CHEMICAL_FORMULAS;
  }
}

export function saveStoredFormulas(formulas: ChemicalFormula[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.CHEMICAL_FORMULAS, JSON.stringify(formulas));
  } catch (err) {
    console.warn('Failed to save chemical formulas to storage', err);
  }
}

export function getStoredChemicalStock(): ChemicalStock {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CHEMICAL_STOCK);
    if (!raw) {
      saveStoredChemicalStock(DEFAULT_INITIAL_CHEMICAL_STOCK);
      return DEFAULT_INITIAL_CHEMICAL_STOCK;
    }
    const parsed = JSON.parse(raw);
    return {
      id: parsed.id || 'main',
      partAName: parsed.partAName || DEFAULT_INITIAL_CHEMICAL_STOCK.partAName,
      partBName: parsed.partBName || DEFAULT_INITIAL_CHEMICAL_STOCK.partBName,
      partAStockKg: Number(parsed.partAStockKg) || 0,
      partBStockKg: Number(parsed.partBStockKg) || 0,
      drumCapacityPolyKg: Number(parsed.drumCapacityPolyKg) || 210,
      drumCapacityIsoKg: Number(parsed.drumCapacityIsoKg) || 250,
      drumCapacityKg: Number(parsed.drumCapacityIsoKg || parsed.drumCapacityKg) || 250,
      updatedAt: parsed.updatedAt || new Date().toISOString(),
    };
  } catch (err) {
    console.warn('Failed to load chemical stock from storage', err);
    return DEFAULT_INITIAL_CHEMICAL_STOCK;
  }
}

export function saveStoredChemicalStock(stock: ChemicalStock): void {
  try {
    localStorage.setItem(STORAGE_KEYS.CHEMICAL_STOCK, JSON.stringify(stock));
  } catch (err) {
    console.warn('Failed to save chemical stock to storage', err);
  }
}

export function getStoredChemicalCutRecords(): ChemicalCutRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CHEMICAL_CUT_RECORDS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('Failed to load chemical cut records', err);
    return [];
  }
}

export function saveStoredChemicalCutRecords(records: ChemicalCutRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.CHEMICAL_CUT_RECORDS, JSON.stringify(records));
  } catch (err) {
    console.warn('Failed to save chemical cut records', err);
  }
}

export function getStoredChemicalRestockRecords(): ChemicalRestockRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CHEMICAL_RESTOCK_RECORDS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('Failed to load chemical restock records', err);
    return [];
  }
}

export function saveStoredChemicalRestockRecords(records: ChemicalRestockRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.CHEMICAL_RESTOCK_RECORDS, JSON.stringify(records));
  } catch (err) {
    console.warn('Failed to save chemical restock records', err);
  }
}

// ====================================================
// Chemical Calculation Engine (คำนวณตามสูตรและความเร็วสายพานจริง)
// ====================================================

export interface ChemicalCalculationResult {
  usedMeters: number;
  ngMeters: number;
  totalMeters: number;
  lineSpeedMPerMin: number;
  ratePerMeter: number;
  polyRatePerMeter: number;
  isoRatePerMeter: number;
  chemicalUsedKg: number;
  chemicalNgKg: number;
  totalChemicalKg: number;
  partAKg: number; // Poly
  partBKg: number; // ISO
  formula: ChemicalFormula;
}

/**
 * คำนวณปริมาณน้ำยา PU จากยอดผลิตจริง (usedMeters) และยอด NG (ngMeters)
 * โดยนำความเร็วสายพานที่ใช้ผลิตจริง (actualLineSpeedMPerMin) มาคำนวณเป็นน้ำยาที่ใช้ทั้งหมด
 */
export function calculateChemicalUsage(
  usedMeters: number,
  ngMeters: number,
  formula: ChemicalFormula,
  actualLineSpeedMPerMin?: number
): ChemicalCalculationResult {
  const safeUsedMeters = Math.max(0, Number(usedMeters) || 0);
  const safeNgMeters = Math.max(0, Number(ngMeters) || 0);
  const totalMeters = round2(safeUsedMeters + safeNgMeters);

  // กำหนดความเร็วสายพานที่ใช้ผลิตจริง (หากไม่ระบุให้ใช้ค่า default ของสูตร เช่น 8.0 ม./นาที)
  const lineSpeed = Math.max(0.1, Number(actualLineSpeedMPerMin || formula.defaultLineSpeedMPerMin || 8.0));

  // คำนวณอัตราการใช้น้ำยาต่อเมตร (กก./เมตร) จากอัตราไหล 1 นาที / ความเร็วสายพาน
  // หมายเหตุ: ใช้ค่าที่ "ไม่ปัดเศษ" ในการคำนวณกก. (เดิมปัดอัตรา/เมตรเป็น 2 ตำแหน่งก่อนคูณเมตร
  // ทำให้ยอดสะสมคลาดเคลื่อนตามจำนวนเมตร) ค่าที่ปัดเก็บไว้แสดงผลเท่านั้น
  const polyFlow = Math.max(0, Number(formula.polyFlowRatePerMin) || 0);
  const isoFlow = Math.max(0, Number(formula.isoFlowRatePerMin) || 0);
  const totalFlow = Math.max(0, Number(formula.totalFlowRatePerMin) || 0) || (polyFlow + isoFlow);

  let rawRatePerMeter = 0;
  if (totalFlow > 0) {
    rawRatePerMeter = totalFlow / lineSpeed;
  } else {
    rawRatePerMeter = Math.max(0, Number(formula.usageRatePerMeter) || 0);
  }

  // สัดส่วน Poly : ISO — ใช้อัตราไหลจริงก่อน ถ้าไม่มีใช้ % ในสูตร ถ้าไม่มีอีกใช้ 50:50 (กัน NaN)
  let ratioA = 0.5;
  if (polyFlow > 0 && isoFlow > 0) {
    ratioA = polyFlow / (polyFlow + isoFlow);
  } else {
    const a = Number(formula.partARatioPercent);
    const b = Number(formula.partBRatioPercent);
    if (isFinite(a) && isFinite(b) && a >= 0 && b >= 0 && a + b > 0) {
      ratioA = a / (a + b);
    }
  }
  const ratioB = 1 - ratioA;

  const round3 = (n: number) => Math.round(n * 1000) / 1000;
  const ratePerMeter = round3(rawRatePerMeter);
  const polyRatePerMeter = round3(rawRatePerMeter * ratioA);
  const isoRatePerMeter = round3(rawRatePerMeter * ratioB);

  // คำนวณน้ำยาตามเมตร
  const rawChemicalUsed = safeUsedMeters * rawRatePerMeter;
  const rawChemicalNg = safeNgMeters * rawRatePerMeter;
  
  // เผื่อ Loss factor (ถ้ามี)
  const wasteMultiplier = 1 + ((Number(formula.wasteFactorPercent) || 0) / 100);
  const chemicalUsedKg = round2(rawChemicalUsed * wasteMultiplier);
  const chemicalNgKg = round2(rawChemicalNg * wasteMultiplier);
  const totalChemicalKg = round2(chemicalUsedKg + chemicalNgKg);

  // คำนวณแยก Part A (Poly) และ Part B (ISO)
  const partAKg = round2(totalChemicalKg * ratioA);
  // ให้ Part B รับเศษส่วนต่างเพื่อไม่ให้ผลรวมเพี้ยนจากทศนิยม
  const partBKg = round2(totalChemicalKg - partAKg);

  return {
    usedMeters: safeUsedMeters,
    ngMeters: safeNgMeters,
    totalMeters,
    lineSpeedMPerMin: lineSpeed,
    ratePerMeter,
    polyRatePerMeter,
    isoRatePerMeter,
    chemicalUsedKg,
    chemicalNgKg,
    totalChemicalKg,
    partAKg,
    partBKg,
    formula,
  };
}

// ====================================================
// SO Extraction Utility
// ====================================================

export interface ExtractedProductionSO {
  id: string;
  soNumber: string;
  usedMeters: number;
  ngMeters: number;
  totalMeters: number;
  date: string;
  source: 'foil_cut' | 'sandwich_cut';
  sourceTitle: string;
  recordedBy?: string;
  lotOrCoil?: string;
  alreadyDeducted?: boolean;
}

export function extractProductionSOList(
  foilRecords: StockCutRecord[],
  puRecords: PuSandwichCutRecord[],
  chemicalCutRecords: ChemicalCutRecord[] = []
): ExtractedProductionSO[] {
  const result: ExtractedProductionSO[] = [];
  // ใบตัดที่เลือกหลาย SO เก็บ soNumber เป็น "A, B, C" และ soNumbers เป็น array — ต้องแตกทีละใบ
  // (เดิมเทียบเฉพาะ soNumber ทั้งสาย ทำให้ SO ในใบตัดรวมถูกมองว่ายังไม่ได้ตัด และตัดซ้ำได้)
  const deductedSoSet = new Set<string>();
  chemicalCutRecords.forEach(c => {
    const add = (v?: string) => {
      const t = (v || '').trim().toLowerCase();
      if (t) deductedSoSet.add(t);
    };
    add(c.soNumber);
    (c.soNumbers || []).forEach(add);
    (c.soNumber || '').split(/[,،;]/).forEach(add);
  });

  // 1. จากประวัติตัดสต๊อกฟอยล์
  foilRecords.forEach(r => {
    const soClean = (r.soNumber || '').trim();
    if (!soClean) return;
    const used = Math.max(0, Number(r.usedMeters) || 0);
    const ng = Math.max(0, Number(r.ngMeters) || 0);
    if (used <= 0 && ng <= 0) return;

    result.push({
      id: `foil-${r.id}`,
      soNumber: soClean,
      usedMeters: used,
      ngMeters: ng,
      totalMeters: round2(used + ng),
      date: r.usageDate || r.recordedDate || r.createdAt?.slice(0, 10) || '',
      source: 'foil_cut',
      sourceTitle: 'ตัดฟอยล์ติดแผ่น',
      recordedBy: r.recordedBy,
      lotOrCoil: r.lotNumber ? `ล็อต ${r.lotNumber}` : undefined,
      alreadyDeducted: deductedSoSet.has(soClean.toLowerCase()),
    });
  });

  // 2. จากประวัติตัด PU Sandwich (ไม่ใช้ฟอยล์)
  puRecords.forEach(p => {
    const soClean = (p.soNumber || '').trim();
    if (!soClean) return;
    const used = Math.max(0, Number(p.soLengthMeters || p.lengthMeters) || 0);
    const ng = Math.max(0, Number(p.ngMeters) || 0);
    if (used <= 0 && ng <= 0) return;

    result.push({
      id: `pu-${p.id}`,
      soNumber: soClean,
      usedMeters: used,
      ngMeters: ng,
      totalMeters: round2(used + ng),
      date: p.productionDate || p.createdAt?.slice(0, 10) || '',
      source: 'sandwich_cut',
      sourceTitle: 'ตัด PU แซนวิช (ไม่ใช้ฟอยล์)',
      recordedBy: p.recordedBy,
      lotOrCoil: p.coilNumber ? `คอล์ย ${p.coilNumber}` : undefined,
      alreadyDeducted: deductedSoSet.has(soClean.toLowerCase()),
    });
  });

  return result.sort((a, b) => b.date.localeCompare(a.date));
}

// ====================================================
// Chemical Deduction Execution
// ====================================================

export interface ExecuteChemicalCutParams {
  soNumber: string;
  soNumbers?: string[];
  cutDate: string;
  usedMeters: number;
  ngMeters: number;
  formula: ChemicalFormula;
  actualLineSpeedMPerMin?: number;
  recordedBy: string;
  notes?: string;
  source?: 'foil_cut' | 'sandwich_cut' | 'manual';
  productionRound?: string;
  currentStock: ChemicalStock;
  chemicalName?: string;
  drumNumber?: string;
  polyDrumNumber?: string;
  isoDrumNumber?: string;
  density?: string;
  densityK?: string;
  polyChemicalName?: string;   // ยี่ห้อ/ชื่อน้ำยาของถัง Poly ที่ตัดจริง
  isoChemicalName?: string;    // ยี่ห้อ/ชื่อน้ำยาของถัง ISO ที่ตัดจริง
}

export function executeChemicalCut(params: ExecuteChemicalCutParams): {
  updatedStock: ChemicalStock;
  cutRecord: ChemicalCutRecord;
} {
  const calc = calculateChemicalUsage(
    params.usedMeters, 
    params.ngMeters, 
    params.formula, 
    params.actualLineSpeedMPerMin
  );
  
  const remainingABefore = params.currentStock.partAStockKg;
  const remainingBBefore = params.currentStock.partBStockKg;

  const remainingAAfter = round2(remainingABefore - calc.partAKg);
  const remainingBAfter = round2(remainingBBefore - calc.partBKg);

  const updatedStock: ChemicalStock = {
    ...params.currentStock,
    partAStockKg: remainingAAfter,
    partBStockKg: remainingBAfter,
    updatedAt: new Date().toISOString(),
  };

  const cutRecord: ChemicalCutRecord = {
    id: `chem-cut-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    soNumber: params.soNumber.trim(),
    soNumbers: params.soNumbers && params.soNumbers.length > 0 ? params.soNumbers : undefined,
    cutDate: params.cutDate || todayLocalYMD(),
    formulaId: params.formula.id,
    formulaName: params.formula.name,
    chemicalName: params.chemicalName || params.formula.name,
    density: params.density || params.formula.density,
    densityK: params.densityK,
    polyChemicalName: params.polyChemicalName,
    isoChemicalName: params.isoChemicalName,
    inchSize: params.formula.inchSize,
    drumNumber: params.drumNumber || params.formula.drumNumber,
    polyDrumNumber: params.polyDrumNumber,
    isoDrumNumber: params.isoDrumNumber,
    lineSpeedMPerMin: calc.lineSpeedMPerMin,
    polyFlowRatePerMin: params.formula.polyFlowRatePerMin,
    isoFlowRatePerMin: params.formula.isoFlowRatePerMin,
    totalFlowRatePerMin: params.formula.totalFlowRatePerMin,
    ratePerMeterUsed: calc.ratePerMeter,
    usedMeters: calc.usedMeters,
    ngMeters: calc.ngMeters,
    totalMeters: calc.totalMeters,
    chemicalUsedKg: calc.chemicalUsedKg,
    chemicalNgKg: calc.chemicalNgKg,
    totalChemicalKg: calc.totalChemicalKg,
    partAKg: calc.partAKg,
    partBKg: calc.partBKg,
    remainingABefore,
    remainingAAfter,
    remainingBBefore,
    remainingBAfter,
    recordedBy: params.recordedBy || 'ช่างคุมเครื่อง',
    notes: params.notes || '',
    source: params.source || 'manual',
    productionRound: params.productionRound,
    createdAt: new Date().toISOString(),
  };

  return { updatedStock, cutRecord };
}

/**
 * ข้อมูลกลุ่มโฟลเดอร์ของชื่อน้ำยา
 */
export interface ChemicalFolderGroup {
  chemicalName: string;
  totalDrums: number;
  activeDrums: number;
  totalInitialKg: number;
  totalRemainingKg: number;
  totalUsedMeters: number;
  totalNgMeters: number;
  supportedDensities: string[];   // ค่า K ที่น้ำยานี้กำหนดไว้ (เช่น ['25k', '28k', '30k'])
  hasPoly: boolean;               // มีถัง Poly หรือไม่
  hasIso: boolean;                // มีถัง ISO หรือไม่
  drums: DrumStockCardItem[];
}

/**
 * ฟังก์ชันสร้างหมายเลขถังที่รันต่อกันโดยอัตโนมัติ เช่น 'ถัง #A01', 'ถัง #A02', ...
 */
export function parseAndGenerateConsecutiveNumbers(startStr: string, count: number, defaultPrefix = 'ถัง #01'): string[] {
  const safeCount = Math.max(1, count || 1);
  const input = (startStr || '').trim() || defaultPrefix;
  
  // ตรวจจับตัวเลขส่วนท้าย เช่น ใน "ถัง #A01", "P-105", "01"
  const match = input.match(/^(.*?)(\d+)$/);
  if (!match) {
    return Array.from({ length: safeCount }, (_, i) => {
      const n = i + 1;
      return `${input} #${n < 10 ? '0' + n : n}`;
    });
  }

  const prefix = match[1];
  const numStr = match[2];
  const startNum = parseInt(numStr, 10);
  const padLength = numStr.length;

  return Array.from({ length: safeCount }, (_, i) => {
    const curNum = startNum + i;
    const padded = String(curNum).padStart(padLength, '0');
    return `${prefix}${padded}`;
  });
}

/**
 * เปรียบเทียบเลขถังแบบธรรมชาติ เรียงจากเบอร์น้อยไปหาเบอร์มาก (เช่น #A01 < #A02 < #A10, #B01 < #B02)
 */
export function compareDrumNumbers(a: string, b: string): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;

  // ดึงกลุ่มข้อความนำหน้าและตัวเลข
  const matchA = a.match(/^(.*?)(\d+)(.*?)$/);
  const matchB = b.match(/^(.*?)(\d+)(.*?)$/);

  if (matchA && matchB) {
    const prefixA = matchA[1].trim().toLowerCase();
    const prefixB = matchB[1].trim().toLowerCase();
    if (prefixA === prefixB) {
      const numA = parseInt(matchA[2], 10);
      const numB = parseInt(matchB[2], 10);
      if (numA !== numB) return numA - numB;
    }
  }

  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

/**
 * เรียงรายการถังน้ำยาจากเบอร์น้อยที่สุดก่อน (FIFO)
 */
export function sortDrumsByLowestNumber(drums: DrumStockCardItem[]): DrumStockCardItem[] {
  return [...drums].sort((a, b) => compareDrumNumbers(a.drumNumber, b.drumNumber));
}

/**
 * ตรวจสอบความถูกต้องของหมายเลขถังในระบบ
 * - หากไม่พบ หรือไม่มีน้ำยาเหลือ ส่งผลลัพธ์แจ้งเตือนและบล็อกการตัดสต๊อก
 */
export function findDrumInStock(
  drumNumber: string,
  type: 'part_a' | 'part_b',
  drumCards: DrumStockCardItem[],
  chemicalName?: string
): { found: boolean; drum?: DrumStockCardItem; hasStock: boolean; errorMsg?: string } {
  const clean = (drumNumber || '').trim().toLowerCase();
  if (!clean) {
    return {
      found: false,
      hasStock: false,
      errorMsg: `กรุณาระบุเลขถัง ${type === 'part_a' ? 'Poly' : 'ISO'}`,
    };
  }

  // ค้นหาถังที่ตรงชนิดและเลขถัง — ต้องตรง "เป๊ะ" ก่อน (เดิมใช้ includes ทำให้ "ถัง #A1" ไปชน "ถัง #A10")
  const norm = (v: string) => (v || '').trim().toLowerCase();
  const byType = drumCards.filter(d => d.chemicalType === type);
  const nameOk = (d: DrumStockCardItem) => !chemicalName || chemicalName === 'all' || d.chemicalName === chemicalName;

  let candidate: DrumStockCardItem | undefined =
    byType.find(d => nameOk(d) && norm(d.drumNumber) === clean) ||
    byType.find(d => norm(d.drumNumber) === clean);

  if (!candidate) {
    // ไม่เจอแบบตรงเป๊ะ → ยอมรับแบบบางส่วนเฉพาะกรณีที่เหลือถังเดียวเท่านั้น
    const partialOf = (list: DrumStockCardItem[]) =>
      list.filter(d => norm(d.drumNumber).includes(clean) || clean.includes(norm(d.drumNumber)));
    let partial = partialOf(byType.filter(nameOk));
    if (partial.length === 0) partial = partialOf(byType);
    if (partial.length === 1) {
      candidate = partial[0];
    } else if (partial.length > 1) {
      return {
        found: false,
        hasStock: false,
        errorMsg: `เลขถัง "${drumNumber}" ตรงกับหลายถัง (${partial.slice(0, 3).map(d => d.drumNumber).join(', ')}...) กรุณาระบุเลขถังให้ครบ`,
      };
    }
  }

  if (!candidate) {
    return {
      found: false,
      hasStock: false,
      errorMsg: `ไม่พบข้อมูลถัง "${drumNumber}" ในระบบ (${type === 'part_a' ? 'Poly' : 'ISO'})`,
    };
  }

  if (candidate.remainingKg <= 0) {
    return {
      found: true,
      drum: candidate,
      hasStock: false,
      errorMsg: `ถัง "${candidate.drumNumber}" น้ำยาหมดแล้ว (คงเหลือ 0 กก.)`,
    };
  }

  return {
    found: true,
    drum: candidate,
    hasStock: true,
  };
}

/**
 * ลบรายการรับเข้าน้ำยา และปรับลดยอดสต๊อกคงเหลือกลับคืน
 */
export function deleteRestockRecord(
  recordId: string,
  allRestocks: ChemicalRestockRecord[],
  currentStock: ChemicalStock
): {
  updatedStock: ChemicalStock;
  remainingRestocks: ChemicalRestockRecord[];
  deletedRecord: ChemicalRestockRecord | null;
} {
  const target = allRestocks.find(r => r.id === recordId);
  if (!target) {
    return { updatedStock: currentStock, remainingRestocks: allRestocks, deletedRecord: null };
  }

  const updatedStock: ChemicalStock = {
    ...currentStock,
    partAStockKg: round2(Math.max(0, currentStock.partAStockKg - (target.partAKgAdded || 0))),
    partBStockKg: round2(Math.max(0, currentStock.partBStockKg - (target.partBKgAdded || 0))),
    updatedAt: new Date().toISOString(),
  };

  const remainingRestocks = allRestocks.filter(r => r.id !== recordId);
  return { updatedStock, remainingRestocks, deletedRecord: target };
}

/**
 * แก้ไขรายการรับเข้าน้ำยา และปรับความต่างของยอดสต๊อกคงเหลือ
 */
export function updateRestockRecord(
  updatedRecord: ChemicalRestockRecord,
  allRestocks: ChemicalRestockRecord[],
  currentStock: ChemicalStock
): {
  updatedStock: ChemicalStock;
  updatedRestocks: ChemicalRestockRecord[];
} {
  const oldRecord = allRestocks.find(r => r.id === updatedRecord.id);
  const oldPartA = oldRecord?.partAKgAdded || 0;
  const oldPartB = oldRecord?.partBKgAdded || 0;

  const diffA = (updatedRecord.partAKgAdded || 0) - oldPartA;
  const diffB = (updatedRecord.partBKgAdded || 0) - oldPartB;

  const updatedStock: ChemicalStock = {
    ...currentStock,
    partAStockKg: round2(Math.max(0, currentStock.partAStockKg + diffA)),
    partBStockKg: round2(Math.max(0, currentStock.partBStockKg + diffB)),
    updatedAt: new Date().toISOString(),
  };

  const updatedRestocks = allRestocks.map(r => r.id === updatedRecord.id ? updatedRecord : r);
  return { updatedStock, updatedRestocks };
}

/** จำนวนถังทั้งหมดในรายการรับเข้า (นับไม่ซ้ำ) */
function countDistinctDrums(r: ChemicalRestockRecord): number {
  const set = new Set<string>();
  (r.polyDrumNumbers || []).forEach(d => set.add('a|' + d.trim()));
  (r.isoDrumNumbers || []).forEach(d => set.add('b|' + d.trim()));
  if (set.size === 0) (r.drumNumbers || []).forEach(d => set.add('g|' + d.trim()));
  return set.size;
}

/** ตัดถังหนึ่งใบออกจากรายการรับเข้า พร้อมหักน้ำหนักของถังนั้นออกจากยอดรับเข้า (ไม่ทำให้ถังที่เหลือได้น้ำหนักเพิ่ม) */
function removeDrumFromRecord(
  r: ChemicalRestockRecord,
  drumNo: string
): { record: ChemicalRestockRecord; removedA: number; removedB: number; touched: boolean } {
  const clean = drumNo.trim();
  const hasPoly = (r.polyDrumNumbers || []).some(d => d.trim() === clean);
  const hasIso = (r.isoDrumNumbers || []).some(d => d.trim() === clean);
  const hasGen = (r.drumNumbers || []).some(d => d.trim() === clean);
  if (!hasPoly && !hasIso && !hasGen) return { record: r, removedA: 0, removedB: 0, touched: false };

  // คำนวณน้ำหนักก่อนลบเลขถังออกจากรายการ
  const removedA = hasPoly ? drumInitialKg(r, 'part_a', clean) : 0;
  const removedB = hasIso ? drumInitialKg(r, 'part_b', clean) : 0;
  const overrides = { ...(r.drumKgOverrides || {}) };
  delete overrides[`a|${clean}`];
  delete overrides[`b|${clean}`];

  const notThis = (d: string) => d.trim() !== clean;
  const partA = round2(Math.max(0, (Number(r.partAKgAdded) || 0) - removedA));
  const partB = round2(Math.max(0, (Number(r.partBKgAdded) || 0) - removedB));
  const record: ChemicalRestockRecord = {
    ...r,
    polyDrumNumbers: (r.polyDrumNumbers || []).filter(notThis),
    isoDrumNumbers: (r.isoDrumNumbers || []).filter(notThis),
    drumNumbers: (r.drumNumbers || []).filter(notThis),
    partAKgAdded: partA,
    partBKgAdded: partB,
    totalKgAdded: round2(partA + partB),
    drumsCount: Math.max(0, (r.drumsCount || 1) - 1),
    drumKgOverrides: Object.keys(overrides).length > 0 ? overrides : undefined,
  };
  if (!record.drumKgOverrides) delete record.drumKgOverrides;
  return { record, removedA, removedB, touched: true };
}

const recordHasNoDrums = (r: ChemicalRestockRecord) =>
  (r.polyDrumNumbers || []).length === 0 &&
  (r.isoDrumNumbers || []).length === 0 &&
  (r.drumNumbers || []).length === 0;

/**
 * ลบถังน้ำยาออกจากระบบ
 * - หักน้ำหนักของถังนั้นออกจากรายการรับเข้า (เดิมไม่หัก ทำให้ถังที่เหลือในรายการเดียวกันได้น้ำหนักตั้งต้นเพิ่มขึ้นเอง)
 * - หักยอดคงเหลือของถังนั้นออกจากสต๊อกรวม (เดิมสต๊อกรวมไม่เปลี่ยน)
 * - รายการรับเข้าที่ไม่เหลือถังแล้วจะถูกลบ (คืน id ใน removedRecordIds เพื่อลบบน Cloud)
 */
export function deleteDrumWithStock(
  drumNumber: string,
  chemicalName: string,
  restockRecords: ChemicalRestockRecord[],
  cutRecords: ChemicalCutRecord[],
  currentStock: ChemicalStock
): {
  updatedRestocks: ChemicalRestockRecord[];
  changedRecordIds: string[];
  removedRecordIds: string[];
  updatedStock: ChemicalStock;
  removedRemainingKg: { partA: number; partB: number };
} {
  const clean = drumNumber.trim();
  const chemMatches = (r: ChemicalRestockRecord) => !(chemicalName && r.chemicalName && r.chemicalName !== chemicalName);

  // ยอดคงเหลือจริงของถังนี้ (หลังหักการตัดทั้งหมด)
  const cards = buildDrumStockCards(restockRecords, cutRecords).filter(
    c => c.drumNumber.trim() === clean && (!chemicalName || c.chemicalName === chemicalName)
  );
  const remA = round2(cards.filter(c => c.chemicalType === 'part_a').reduce((sum, c) => sum + Math.max(0, c.remainingKg), 0));
  const remB = round2(cards.filter(c => c.chemicalType === 'part_b').reduce((sum, c) => sum + Math.max(0, c.remainingKg), 0));

  const changed: string[] = [];
  const removed: string[] = [];
  const updated: ChemicalRestockRecord[] = [];
  restockRecords.forEach(r => {
    if (!chemMatches(r)) { updated.push(r); return; }
    const res = removeDrumFromRecord(r, clean);
    if (!res.touched) { updated.push(r); return; }
    if (recordHasNoDrums(res.record)) { removed.push(r.id); return; }
    changed.push(r.id);
    updated.push(res.record);
  });

  const updatedStock: ChemicalStock = {
    ...currentStock,
    partAStockKg: round2(Math.max(0, currentStock.partAStockKg - remA)),
    partBStockKg: round2(Math.max(0, currentStock.partBStockKg - remB)),
    updatedAt: new Date().toISOString(),
  };
  return { updatedRestocks: updated, changedRecordIds: changed, removedRecordIds: removed, updatedStock, removedRemainingKg: { partA: remA, partB: remB } };
}

/** (คงไว้เพื่อความเข้ากันได้) ลบเลขถังออกจากประวัติรับเข้า โดยหักน้ำหนักถังนั้นออกจากรายการ */
export function deleteDrumFromRestockRecords(
  drumNumber: string,
  chemicalName: string,
  restockRecords: ChemicalRestockRecord[]
): ChemicalRestockRecord[] {
  const clean = drumNumber.trim();
  const out: ChemicalRestockRecord[] = [];
  restockRecords.forEach(r => {
    if (chemicalName && r.chemicalName && r.chemicalName !== chemicalName) { out.push(r); return; }
    const res = removeDrumFromRecord(r, clean);
    if (!res.touched) { out.push(r); return; }
    if (!recordHasNoDrums(res.record)) out.push(res.record);
  });
  return out;
}

export interface UpdateDrumOptions {
  supplier?: string;
  initialKg?: number;
  receivedDate?: string;
}

/**
 * แก้ไขข้อมูลถังน้ำยา (เลขถัง / ยี่ห้อ / ผู้จัดจำหน่าย / น้ำหนักตั้งต้น / วันที่รับ) และปรับเลขถังในประวัติตัดสต๊อก
 * - แก้เฉพาะรายการรับเข้าที่ "มีถังนี้อยู่จริง" (เดิมเปลี่ยนชื่อยี่ห้อของทุกรายการในยี่ห้อเดียวกัน)
 * - ถ้ารายการนั้นมีถังอื่นอยู่ด้วยและมีการเปลี่ยนยี่ห้อ/ผู้จัดจำหน่าย/วันที่ จะแยกถังนี้ออกเป็นรายการใหม่ ไม่กระทบถังข้างเคียง
 * - ถ้าแก้น้ำหนักตั้งต้น จะปรับยอดรับเข้าและสต๊อกรวมตามส่วนต่าง
 */
export function updateDrumInRecords(
  oldDrumNumber: string,
  newDrumNumber: string,
  chemicalName: string,
  newChemicalName: string,
  restockRecords: ChemicalRestockRecord[],
  cutRecords: ChemicalCutRecord[],
  options: UpdateDrumOptions = {},
  currentStock?: ChemicalStock
): {
  updatedRestocks: ChemicalRestockRecord[];
  updatedCuts: ChemicalCutRecord[];
  updatedStock?: ChemicalStock;
} {
  const cleanOld = oldDrumNumber.trim();
  const cleanNew = newDrumNumber.trim() || cleanOld;
  const cleanOldChem = chemicalName.trim();
  const cleanNewChem = newChemicalName.trim() || cleanOldChem;

  let diffA = 0;
  let diffB = 0;
  const updatedRestocks: ChemicalRestockRecord[] = [];

  restockRecords.forEach(r => {
    if (cleanOldChem && r.chemicalName && r.chemicalName.trim() !== cleanOldChem) { updatedRestocks.push(r); return; }

    const inPoly = (r.polyDrumNumbers || []).some(d => d.trim() === cleanOld);
    const inIso = (r.isoDrumNumbers || []).some(d => d.trim() === cleanOld);
    const inGen = (r.drumNumbers || []).some(d => d.trim() === cleanOld);
    if (!inPoly && !inIso && !inGen) { updatedRestocks.push(r); return; }

    const rename = (list?: string[]) => (list || []).map(d => (d.trim() === cleanOld ? cleanNew : d));
    const chemChanged = cleanNewChem !== (r.chemicalName || '').trim();
    const supplierChanged = options.supplier !== undefined && options.supplier.trim() !== (r.supplier || '').trim();
    const dateChanged = !!options.receivedDate && options.receivedDate !== r.date;
    const others = countDistinctDrums(r) > 1;
    const bothLists = inPoly && inIso;
    const wantsSplit = others && !bothLists && (chemChanged || supplierChanged || dateChanged);

    // น้ำหนักตั้งต้นใหม่ (ถ้ามีการแก้)
    const type: 'part_a' | 'part_b' | null = inPoly ? 'part_a' : inIso ? 'part_b' : null;
    const oldKg = type ? drumInitialKg(r, type, cleanOld) : 0;
    const wantsKg = type !== null && typeof options.initialKg === 'number' && options.initialKg > 0
      && Math.abs(options.initialKg - oldKg) > 0.005 && (type === 'part_a' ? (r.partAKgAdded || 0) > 0 : (r.partBKgAdded || 0) > 0);
    const newKg = wantsKg ? round2(options.initialKg as number) : oldKg;
    const kgDiff = wantsKg ? round2(newKg - oldKg) : 0;
    if (type === 'part_a') diffA += kgDiff; else if (type === 'part_b') diffB += kgDiff;

    if (wantsSplit && type) {
      // 1) ถังที่เหลือในรายการเดิม (หักน้ำหนักถังนี้ออก)
      const { record: rest } = removeDrumFromRecord(r, cleanOld);
      updatedRestocks.push(rest);
      // 2) รายการใหม่สำหรับถังนี้ถังเดียว
      const single: ChemicalRestockRecord = {
        ...r,
        id: `${r.id}-d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
        chemicalName: cleanNewChem,
        supplier: options.supplier !== undefined ? options.supplier.trim() || undefined : r.supplier,
        date: options.receivedDate || r.date,
        chemicalType: type,
        lotNumber: cleanNew,
        drumNumber: cleanNew,
        drumNumbers: inGen ? [cleanNew] : [],
        polyDrumNumbers: type === 'part_a' ? [cleanNew] : [],
        isoDrumNumbers: type === 'part_b' ? [cleanNew] : [],
        drumsCount: 1,
        kgPerDrum: newKg,
        partAKgAdded: type === 'part_a' ? newKg : 0,
        partBKgAdded: type === 'part_b' ? newKg : 0,
        totalKgAdded: newKg,
        drumKgOverrides: undefined,
      };
      delete single.drumKgOverrides;
      if (single.supplier === undefined) delete single.supplier;
      updatedRestocks.push(single);
      return;
    }

    // แก้ในรายการเดิม
    const next: ChemicalRestockRecord = {
      ...r,
      chemicalName: cleanNewChem,
      polyDrumNumbers: rename(r.polyDrumNumbers),
      isoDrumNumbers: rename(r.isoDrumNumbers),
      drumNumbers: rename(r.drumNumbers),
      drumNumber: (r.drumNumber || '').trim() === cleanOld ? cleanNew : r.drumNumber,
    };
    if (options.supplier !== undefined) {
      if (options.supplier.trim()) next.supplier = options.supplier.trim(); else delete next.supplier;
    }
    if (options.receivedDate) next.date = options.receivedDate;

    if (wantsKg && type) {
      const overrides = { ...(r.drumKgOverrides || {}) };
      if (cleanNew !== cleanOld) delete overrides[`${type === 'part_a' ? 'a' : 'b'}|${cleanOld}`];
      overrides[`${type === 'part_a' ? 'a' : 'b'}|${cleanNew}`] = newKg;
      next.drumKgOverrides = overrides;
      if (type === 'part_a') next.partAKgAdded = round2((r.partAKgAdded || 0) + kgDiff);
      else next.partBKgAdded = round2((r.partBKgAdded || 0) + kgDiff);
      next.totalKgAdded = round2((next.partAKgAdded || 0) + (next.partBKgAdded || 0));
    } else if (r.drumKgOverrides && cleanNew !== cleanOld) {
      // เปลี่ยนเลขถังอย่างเดียว: ย้ายคีย์น้ำหนักที่เคยแก้ไว้ตามไปด้วย
      const overrides = { ...r.drumKgOverrides };
      (['a', 'b'] as const).forEach(k => {
        if (typeof overrides[`${k}|${cleanOld}`] === 'number') {
          overrides[`${k}|${cleanNew}`] = overrides[`${k}|${cleanOld}`];
          delete overrides[`${k}|${cleanOld}`];
        }
      });
      next.drumKgOverrides = overrides;
    }
    updatedRestocks.push(next);
  });

  // ประวัติตัดสต๊อก: เปลี่ยนเลขถังเฉพาะรายการที่ตัดจากถังนี้จริง
  const updatedCuts = cutRecords.map(c => {
    const chemOk = !cleanOldChem || !c.chemicalName || c.chemicalName === cleanOldChem ||
      c.polyChemicalName === cleanOldChem || c.isoChemicalName === cleanOldChem;
    if (!chemOk) return c;
    let modified = false;
    let newPoly = c.polyDrumNumber;
    let newIso = c.isoDrumNumber;
    let newMain = c.drumNumber;
    let newChem = c.chemicalName;
    let newPolyChem = c.polyChemicalName;
    let newIsoChem = c.isoChemicalName;

    if ((c.polyDrumNumber || '').trim() === cleanOld) {
      newPoly = cleanNew; modified = true;
      if (cleanNewChem !== cleanOldChem && (!c.polyChemicalName || c.polyChemicalName === cleanOldChem)) newPolyChem = cleanNewChem;
    }
    if ((c.isoDrumNumber || '').trim() === cleanOld) {
      newIso = cleanNew; modified = true;
      if (cleanNewChem !== cleanOldChem && (!c.isoChemicalName || c.isoChemicalName === cleanOldChem)) newIsoChem = cleanNewChem;
    }
    if ((c.drumNumber || '').trim() === cleanOld) {
      newMain = cleanNew; modified = true;
    } else if (c.drumNumber && c.drumNumber.includes('/')) {
      // ข้อมูลเก่า drumNumber เป็นสตริงรวม "ถัง #A01 / ถัง #B01"
      const parts = c.drumNumber.split('/').map(x => x.trim());
      if (parts.includes(cleanOld)) {
        newMain = parts.map(x => (x === cleanOld ? cleanNew : x)).join(' / ');
        modified = true;
      }
    }
    if (modified && cleanNewChem !== cleanOldChem && c.chemicalName === cleanOldChem && !c.polyChemicalName && !c.isoChemicalName) {
      newChem = cleanNewChem;
    }

    return modified
      ? { ...c, polyDrumNumber: newPoly, isoDrumNumber: newIso, drumNumber: newMain, chemicalName: newChem, polyChemicalName: newPolyChem, isoChemicalName: newIsoChem }
      : c;
  });

  let updatedStock: ChemicalStock | undefined;
  if (currentStock && (diffA !== 0 || diffB !== 0)) {
    updatedStock = {
      ...currentStock,
      partAStockKg: round2(Math.max(0, currentStock.partAStockKg + diffA)),
      partBStockKg: round2(Math.max(0, currentStock.partBStockKg + diffB)),
      updatedAt: new Date().toISOString(),
    };
  }
  return { updatedRestocks, updatedCuts, updatedStock };
}

/**
 * อัปเดตค่า K (Supported Densities) สำหรับโฟลเดอร์ชื่อน้ำยา (โดยเฉพาะ Poly)
 */
export function updateFolderDensitiesInRecords(
  chemicalName: string,
  densities: string[],
  restockRecords: ChemicalRestockRecord[]
): ChemicalRestockRecord[] {
  const cleanName = chemicalName.trim();
  return restockRecords.map(r => {
    if (r.chemicalName && r.chemicalName.trim() === cleanName) {
      return {
        ...r,
        supportedDensities: normalizeDensityList(densities),
      };
    }
    return r;
  });
}

/**
 * สร้างข้อมูลบัตรสต๊อกถังน้ำยา (Stock Card) แยกตามเบอร์ถังและ SO
 * แยกข้อมูลแต่ละยี่ห้อออกจากกันอย่างชัดเจน ไม่เขียนทับข้อมูลเดิม
 */
export function buildDrumStockCards(
  restockRecords: ChemicalRestockRecord[],
  cutRecords: ChemicalCutRecord[]
): DrumStockCardItem[] {
  const cardsMap = new Map<string, DrumStockCardItem>();

  // 1. นำข้อมูลถังจากประวัติรับเข้า (Restock Records)
  // ใช้ key แบบผสม `${chemName}:::${cleanNo}:::${type}` เพื่อแยกแต่ละยี่ห้อออกจากกัน ไม่เขียนทับข้อมูลเดิม
  restockRecords.forEach(r => {
    const chemName = r.chemicalName?.trim() || 'K-Foam 32 (มาตรฐาน)';
    const cardDensities = normalizeDensityList(r.supportedDensities);
    
    // ตรวจสอบว่ามีรายการถัง Poly ที่รันต่อกันหรือไม่
    if (r.polyDrumNumbers && r.polyDrumNumbers.length > 0) {
      r.polyDrumNumbers.forEach(dNum => {
        const cleanNo = dNum.trim();
        const perDrumKg = r.partAKgAdded > 0 ? drumInitialKg(r, 'part_a', cleanNo) : ((r.chemicalType !== 'part_b' && r.kgPerDrum) || 210);
        const cardKey = `${chemName}:::${cleanNo}:::part_a`;
        if (!cardsMap.has(cardKey)) {
          cardsMap.set(cardKey, {
            id: cardKey,
            drumNumber: cleanNo,
            chemicalName: chemName,
            brand: r.supplier || chemName,
            chemicalType: 'part_a',
            supportedDensities: cardDensities,
            initialKg: perDrumKg,
            receivedDate: r.date,
            supplier: r.supplier,
            cuts: [],
            totalUsedMeters: 0,
            totalNgMeters: 0,
            totalAllMeters: 0,
            totalCutKg: 0,
            remainingKg: perDrumKg,
            remainingPercent: 100,
            status: 'active',
          });
        }
      });
    }

    // ตรวจสอบว่ามีรายการถัง ISO ที่รันต่อกันหรือไม่
    if (r.isoDrumNumbers && r.isoDrumNumbers.length > 0) {
      // เดิมใช้ r.kgPerDrum ซึ่งเป็นน้ำหนัก Poly เมื่อรับเข้าแบบ 'both' → ถัง ISO ได้ 210 แทน 250
      r.isoDrumNumbers.forEach(dNum => {
        const cleanNo = dNum.trim();
        const perDrumKg = r.partBKgAdded > 0 ? drumInitialKg(r, 'part_b', cleanNo) : ((r.chemicalType === 'part_b' && r.kgPerDrum) || 250);
        const cardKey = `${chemName}:::${cleanNo}:::part_b`;
        if (!cardsMap.has(cardKey)) {
          cardsMap.set(cardKey, {
            id: cardKey,
            drumNumber: cleanNo,
            chemicalName: chemName,
            brand: r.supplier || chemName,
            chemicalType: 'part_b',
            supportedDensities: cardDensities,
            initialKg: perDrumKg,
            receivedDate: r.date,
            supplier: r.supplier,
            cuts: [],
            totalUsedMeters: 0,
            totalNgMeters: 0,
            totalAllMeters: 0,
            totalCutKg: 0,
            remainingKg: perDrumKg,
            remainingPercent: 100,
            status: 'active',
          });
        }
      });
    }

    // ตรวจสอบกรณี drumNumbers ทั่วไป
    if (r.drumNumbers && r.drumNumbers.length > 0 && (!r.polyDrumNumbers || r.polyDrumNumbers.length === 0) && (!r.isoDrumNumbers || r.isoDrumNumbers.length === 0)) {
      const perDrumKg = r.kgPerDrum || 210;
      const chemType = r.chemicalType === 'part_b' ? 'part_b' : 'part_a';
      r.drumNumbers.forEach(dNum => {
        const cleanNo = dNum.trim();
        const cardKey = `${chemName}:::${cleanNo}:::${chemType}`;
        if (!cardsMap.has(cardKey)) {
          cardsMap.set(cardKey, {
            id: cardKey,
            drumNumber: cleanNo,
            chemicalName: chemName,
            brand: r.supplier || chemName,
            chemicalType: chemType,
            supportedDensities: cardDensities,
            initialKg: perDrumKg,
            receivedDate: r.date,
            supplier: r.supplier,
            cuts: [],
            totalUsedMeters: 0,
            totalNgMeters: 0,
            totalAllMeters: 0,
            totalCutKg: 0,
            remainingKg: perDrumKg,
            remainingPercent: 100,
            status: 'active',
          });
        }
      });
    }

    // กรณีถังเดี่ยวเดิม (backward compatibility)
    if ((!r.polyDrumNumbers || r.polyDrumNumbers.length === 0) && (!r.isoDrumNumbers || r.isoDrumNumbers.length === 0) && (!r.drumNumbers || r.drumNumbers.length === 0)) {
      const baseDrumNo = r.drumNumber?.trim() || r.lotNumber?.trim() || 'ถังทั่วไป';
      if (r.chemicalType === 'both') {
        const polyDrumId = `${baseDrumNo} (Poly)`;
        const keyA = `${chemName}:::${polyDrumId}:::part_a`;
        if (!cardsMap.has(keyA)) {
          const initA = r.partAKgAdded > 0 ? r.partAKgAdded : 210;
          cardsMap.set(keyA, {
            id: keyA,
            drumNumber: polyDrumId,
            chemicalName: chemName,
            brand: r.supplier || chemName,
            chemicalType: 'part_a',
            supportedDensities: cardDensities,
            initialKg: initA,
            receivedDate: r.date,
            supplier: r.supplier,
            cuts: [],
            totalUsedMeters: 0,
            totalNgMeters: 0,
            totalAllMeters: 0,
            totalCutKg: 0,
            remainingKg: initA,
            remainingPercent: 100,
            status: 'active',
          });
        }

        const isoDrumId = `${baseDrumNo} (ISO)`;
        const keyB = `${chemName}:::${isoDrumId}:::part_b`;
        if (!cardsMap.has(keyB)) {
          const initB = r.partBKgAdded > 0 ? r.partBKgAdded : 250;
          cardsMap.set(keyB, {
            id: keyB,
            drumNumber: isoDrumId,
            chemicalName: chemName,
            brand: r.supplier || chemName,
            chemicalType: 'part_b',
            supportedDensities: cardDensities,
            initialKg: initB,
            receivedDate: r.date,
            supplier: r.supplier,
            cuts: [],
            totalUsedMeters: 0,
            totalNgMeters: 0,
            totalAllMeters: 0,
            totalCutKg: 0,
            remainingKg: initB,
            remainingPercent: 100,
            status: 'active',
          });
        }
      } else {
        const drumId = baseDrumNo;
        const keySolo = `${chemName}:::${drumId}:::${r.chemicalType}`;
        if (!cardsMap.has(keySolo)) {
          const initWeight = r.chemicalType === 'part_a' 
            ? (r.partAKgAdded > 0 ? r.partAKgAdded : 210)
            : (r.partBKgAdded > 0 ? r.partBKgAdded : 250);

          cardsMap.set(keySolo, {
            id: keySolo,
            drumNumber: drumId,
            chemicalName: chemName,
            brand: r.supplier || chemName,
            chemicalType: r.chemicalType,
            supportedDensities: cardDensities,
            initialKg: initWeight,
            receivedDate: r.date,
            supplier: r.supplier,
            cuts: [],
            totalUsedMeters: 0,
            totalNgMeters: 0,
            totalAllMeters: 0,
            totalCutKg: 0,
            remainingKg: initWeight,
            remainingPercent: 100,
            status: 'active',
          });
        }
      }
    }
  });

  // ถ้ายังไม่มีถังในระบบเลย สร้างถังตั้งต้น
  if (cardsMap.size === 0) {
    cardsMap.set('K-Foam 32:::ถัง #A01 (Poly):::part_a', {
      id: 'K-Foam 32:::ถัง #A01 (Poly):::part_a',
      drumNumber: 'ถัง #A01 (Poly)',
      chemicalName: 'K-Foam 32 (มาตรฐาน)',
      brand: 'K-Foam',
      chemicalType: 'part_a',
      initialKg: 840,
      receivedDate: todayLocalYMD(),
      supplier: 'โรงงานตั้งต้น',
      cuts: [],
      totalUsedMeters: 0,
      totalNgMeters: 0,
      totalAllMeters: 0,
      totalCutKg: 0,
      remainingKg: 840,
      remainingPercent: 100,
      status: 'active',
    });
    cardsMap.set('K-Foam 32:::ถัง #B01 (ISO):::part_b', {
      id: 'K-Foam 32:::ถัง #B01 (ISO):::part_b',
      drumNumber: 'ถัง #B01 (ISO)',
      chemicalName: 'K-Foam 32 (มาตรฐาน)',
      brand: 'K-Foam',
      chemicalType: 'part_b',
      initialKg: 1000,
      receivedDate: todayLocalYMD(),
      supplier: 'โรงงานตั้งต้น',
      cuts: [],
      totalUsedMeters: 0,
      totalNgMeters: 0,
      totalAllMeters: 0,
      totalCutKg: 0,
      remainingKg: 1000,
      remainingPercent: 100,
      status: 'active',
    });
  }

  // 2. นำรายการตัด (Cuts) มาเรียงตามวันเวลา และผูกเข้ากับบัตรสต๊อกถัง
  const sortedCuts = [...cutRecords].sort((a, b) => {
    return (a.cutDate || a.createdAt).localeCompare(b.cutDate || b.createdAt);
  });

  const allCards = Array.from(cardsMap.values());

  const normNo = (v?: string) => (v || '').trim().toLowerCase();

  /**
   * เลือกบัตรสต๊อกถังที่ถูกตัด ตามลำดับความแม่นยำ (ไม่ใช้ includes แบบหลวม ๆ ก่อนอีกต่อไป
   * เดิม find() รวมทุกเงื่อนไขด้วย OR → ได้ "ใบแรกที่เข้าเงื่อนไขใดก็ได้" ทำให้ตัดผิดถัง/ผิดยี่ห้อ
   * และเงื่อนไข includes('Poly') จับถังอะไรก็ได้ที่มีคำว่า Poly)
   */
  const pickCard = (
    type: 'part_a' | 'part_b',
    drumNo: string | undefined,
    brand: string | undefined,
    compositeNo: string | undefined,
    typeWord: 'Poly' | 'ISO'
  ): DrumStockCardItem | undefined => {
    const cards = allCards.filter(c => c.chemicalType === type);
    const no = normNo(drumNo);
    if (no) {
      const exactWithBrand = brand ? cards.find(c => normNo(c.drumNumber) === no && c.chemicalName === brand) : undefined;
      if (exactWithBrand) return exactWithBrand;
      const exact = cards.find(c => normNo(c.drumNumber) === no);
      if (exact) return exact;
    }
    // ข้อมูลเก่า: drumNumber เป็นสตริงรวม "ถัง #A01 / ถัง #B01"
    if (compositeNo) {
      const parts = compositeNo.split('/').map(normNo).filter(Boolean);
      for (const part of parts) {
        const hit = cards.find(c => normNo(c.drumNumber) === part);
        if (hit) return hit;
      }
    }
    if (no) {
      const partial = cards.filter(c => normNo(c.drumNumber).includes(no) || no.includes(normNo(c.drumNumber)));
      if (partial.length === 1) return partial[0];
    }
    // มีเลขถังระบุไว้แต่หาไม่เจอ (เช่น ถังถูกลบไปแล้ว) → ห้ามไปตัดยอดของถังอื่น
    if (no || compositeNo) return undefined;
    // ข้อมูลเก่าที่ไม่มีเลขถังเลย: ผูกกับถังที่ตั้งชื่อว่า "(Poly)" / "(ISO)"
    const legacy = cards.find(c => c.drumNumber.includes(typeWord));
    return legacy || cards[0];
  };

  sortedCuts.forEach(cut => {
    const polyTarget = pickCard('part_a', cut.polyDrumNumber, cut.polyChemicalName || cut.chemicalName, cut.drumNumber, 'Poly');

    if (polyTarget) {
      polyTarget.cuts.push({
        cutId: cut.id,
        soNumber: cut.soNumber,
        soNumbers: cut.soNumbers,
        date: cut.cutDate,
        formulaName: cut.formulaName,
        densityK: cut.densityK,
        lineSpeedMPerMin: cut.lineSpeedMPerMin || 8.0,
        usedMeters: cut.usedMeters,
        ngMeters: cut.ngMeters,
        totalMeters: cut.totalMeters,
        cutKg: cut.partAKg,
        remainingInDrumKg: 0,
        recordedBy: cut.recordedBy,
        notes: cut.notes,
      });
    }

    const isoTarget = pickCard('part_b', cut.isoDrumNumber, cut.isoChemicalName || cut.chemicalName, cut.drumNumber, 'ISO');

    if (isoTarget) {
      isoTarget.cuts.push({
        cutId: cut.id,
        soNumber: cut.soNumber,
        soNumbers: cut.soNumbers,
        date: cut.cutDate,
        formulaName: cut.formulaName,
        densityK: cut.densityK,
        lineSpeedMPerMin: cut.lineSpeedMPerMin || 8.0,
        usedMeters: cut.usedMeters,
        ngMeters: cut.ngMeters,
        totalMeters: cut.totalMeters,
        cutKg: cut.partBKg,
        remainingInDrumKg: 0,
        recordedBy: cut.recordedBy,
        notes: cut.notes,
      });
    }
  });

  // 3. คำนวณ Running balance และสรุปบรรทัดสุดท้ายของแต่ละถัง
  allCards.forEach(card => {
    let runningKg = card.initialKg;
    let sumUsedMeters = 0;
    let sumNgMeters = 0;
    let sumTotalMeters = 0;
    let sumCutKg = 0;

    card.cuts.forEach(cutItem => {
      sumUsedMeters = round2(sumUsedMeters + cutItem.usedMeters);
      sumNgMeters = round2(sumNgMeters + cutItem.ngMeters);
      sumTotalMeters = round2(sumTotalMeters + cutItem.totalMeters);
      sumCutKg = round2(sumCutKg + cutItem.cutKg);
      runningKg = round2(runningKg - cutItem.cutKg);
      cutItem.remainingInDrumKg = Math.max(0, runningKg);
    });

    card.totalUsedMeters = sumUsedMeters;
    card.totalNgMeters = sumNgMeters;
    card.totalAllMeters = sumTotalMeters;
    card.totalCutKg = sumCutKg;
    card.remainingKg = Math.max(0, runningKg);
    card.remainingPercent = card.initialKg > 0 ? round2((card.remainingKg / card.initialKg) * 100) : 0;
    card.status = card.remainingKg <= 0 ? 'empty' : card.remainingKg <= 35 ? 'low' : 'active';
  });

  // เรียงลำดับโฟลเดอร์ชื่อน้ำยาก่อน แล้วเรียงตามหมายเลขถังจากเบอร์น้อยไปหาเบอร์มาก
  allCards.sort((a, b) => {
    if (a.chemicalName !== b.chemicalName) {
      return a.chemicalName.localeCompare(b.chemicalName, 'th');
    }
    return compareDrumNumbers(a.drumNumber, b.drumNumber);
  });

  return allCards;
}

/**
 * แนะนำ No. ถังถัดไปจากถังที่มีอยู่ในระบบ
 */
export function suggestNextDrumNumber(
  existingDrums: string[] | DrumStockCardItem[],
  type: 'part_a' | 'part_b',
  chemicalName?: string
): string {
  const defaultPrefix = type === 'part_a' ? 'ถัง #A' : 'ถัง #B';
  let filtered = existingDrums;
  if (chemicalName && chemicalName.trim() && Array.isArray(existingDrums) && existingDrums.length > 0 && typeof existingDrums[0] !== 'string') {
    const cardItems = existingDrums as DrumStockCardItem[];
    const matchingBrand = cardItems.filter(d => d.chemicalName === chemicalName.trim());
    if (matchingBrand.length > 0) {
      filtered = matchingBrand;
    }
  }

  const drumNames: string[] = filtered.map(d => typeof d === 'string' ? d : d.drumNumber);
  
  // กรองเฉพาะถังที่ตรงกับ type หรือ prefix
  const targetChar = type === 'part_a' ? 'A' : 'B';
  let maxNum = 0;
  let detectedPrefix = defaultPrefix;
  let detectedPad = 2;

  drumNames.forEach(name => {
    // เช่น "ถัง #A01", "A05", "ถัง 1", "P-02"
    const match = name.match(/^(.*?)(\d+)$/);
    if (match) {
      const prefix = match[1];
      const num = parseInt(match[2], 10);
      const pad = match[2].length;
      if (prefix.toUpperCase().includes(targetChar) || prefix.includes(type === 'part_a' ? 'Poly' : 'ISO')) {
        if (num > maxNum) {
          maxNum = num;
          detectedPrefix = prefix;
          detectedPad = pad;
        }
      }
    }
  });

  if (maxNum > 0) {
    const nextNum = maxNum + 1;
    return `${detectedPrefix}${String(nextNum).padStart(detectedPad, '0')}`;
  }

  return `${defaultPrefix}01`;
}

/**
 * จัดกลุ่มถังน้ำยาเป็นโฟลเดอร์ตาม "ชื่อของน้ำยา"
 */
export function groupDrumsByChemicalName(drumStockCards: DrumStockCardItem[]): ChemicalFolderGroup[] {
  const map = new Map<string, DrumStockCardItem[]>();

  drumStockCards.forEach(d => {
    const name = d.chemicalName || 'น้ำยามาตรฐาน';
    if (!map.has(name)) {
      map.set(name, []);
    }
    map.get(name)!.push(d);
  });

  const result: ChemicalFolderGroup[] = [];
  map.forEach((drums, chemicalName) => {
    const totalInitialKg = round2(drums.reduce((sum, d) => sum + d.initialKg, 0));
    const totalRemainingKg = round2(drums.reduce((sum, d) => sum + d.remainingKg, 0));
    const totalUsedMeters = round2(drums.reduce((sum, d) => sum + d.totalUsedMeters, 0));
    const totalNgMeters = round2(drums.reduce((sum, d) => sum + d.totalNgMeters, 0));
    const activeDrums = drums.filter(d => d.status === 'active' || d.status === 'low').length;
    const hasPoly = drums.some(d => d.chemicalType === 'part_a');
    const hasIso = drums.some(d => d.chemicalType === 'part_b');

    // รวมค่า K จากทุกถังในโฟลเดอร์นี้
    const kSet = new Set<string>();
    drums.forEach(d => {
      (d.supportedDensities || []).forEach(k => kSet.add(k));
    });
    // ถ้ายังไม่มีกำหนดค่า K แต่เป็น Poly ให้กำหนดค่ามาตรฐานเริ่มต้นที่พบบ่อย
    if (kSet.size === 0) {
      if (chemicalName.toLowerCase().includes('32')) kSet.add('32k');
      else if (chemicalName.toLowerCase().includes('30')) kSet.add('30k');
      else if (chemicalName.toLowerCase().includes('28')) kSet.add('28k');
      else if (chemicalName.toLowerCase().includes('25')) kSet.add('25k');
      else if (hasPoly) {
        kSet.add('28k');
        kSet.add('30k');
        kSet.add('32k');
      }
    }
    const supportedDensities = Array.from(kSet);

    result.push({
      chemicalName,
      totalDrums: drums.length,
      activeDrums,
      totalInitialKg,
      totalRemainingKg,
      totalUsedMeters,
      totalNgMeters,
      supportedDensities,
      hasPoly,
      hasIso,
      drums,
    });
  });

  return result;
}

/**
 * ยกเลิกรายการตัดสต๊อกน้ำยา และคืนยอดกลับเข้าสต๊อก
 */
export function revertChemicalCut(
  recordId: string,
  allRecords: ChemicalCutRecord[],
  currentStock: ChemicalStock
): {
  updatedStock: ChemicalStock;
  remainingRecords: ChemicalCutRecord[];
  revertedRecord: ChemicalCutRecord | null;
} {
  const target = allRecords.find(r => r.id === recordId);
  if (!target) {
    return { updatedStock: currentStock, remainingRecords: allRecords, revertedRecord: null };
  }

  // คืนยอดสต๊อก (Part A: Poly, Part B: ISO)
  const updatedStock: ChemicalStock = {
    ...currentStock,
    partAStockKg: round2(currentStock.partAStockKg + target.partAKg),
    partBStockKg: round2(currentStock.partBStockKg + target.partBKg),
    updatedAt: new Date().toISOString(),
  };

  const remainingRecords = allRecords.filter(r => r.id !== recordId);
  return { updatedStock, remainingRecords, revertedRecord: target };
}

/**
 * ส่งออกประวัติการตัดสต๊อกน้ำยาเป็นไฟล์ CSV
 */
export function exportChemicalCutsToCSV(records: ChemicalCutRecord[]): void {
  if (records.length === 0) return;

  const headers = [
    'วันที่บันทึก',
    'วันที่ตัด/ผลิต',
    'เลขที่ SO',
    'ชื่อน้ำยา/สูตร',
    'Density',
    'ขนาดนิ้ว',
    'No. ถัง',
    'ความเร็วสายพาน (ม./นาที)',
    'อัตราคำนวณ (กก./ม.)',
    'เมตรผลิตจริง (ม.)',
    'เมตรเสีย NG (ม.)',
    'รวมความยาว (ม.)',
    'น้ำยาผลิตจริง (กก.)',
    'น้ำยาเสีย NG (กก.)',
    'รวมน้ำยาทั้งหมด (กก.)',
    'น้ำยา Poly (กก.)',
    'น้ำยา ISO (กก.)',
    'คงเหลือ Poly หลังตัด (กก.)',
    'คงเหลือ ISO หลังตัด (กก.)',
    'ผู้บันทึก',
    'หมายเหตุ',
  ];

  const rows = records.map(r => [
    csvCell(r.createdAt),
    csvCell(r.cutDate),
    csvCell(r.soNumbers && r.soNumbers.length > 0 ? r.soNumbers.join(', ') : r.soNumber),
    csvCell(r.formulaName),
    csvCell(r.densityK || r.density),
    csvCell(r.inchSize),
    csvCell(r.drumNumber),
    r.lineSpeedMPerMin || '',
    r.ratePerMeterUsed || '',
    r.usedMeters,
    r.ngMeters,
    r.totalMeters,
    r.chemicalUsedKg,
    r.chemicalNgKg,
    r.totalChemicalKg,
    r.partAKg,
    r.partBKg,
    r.remainingAAfter,
    r.remainingBAfter,
    csvCell(r.recordedBy),
    csvCell(r.notes),
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `chemical_cuts_history_${todayLocalYMD()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
