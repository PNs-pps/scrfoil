import { SOComponents } from '../types';

/**
 * Parses and validates soxxyyzzz format
 * e.g., "so6909500" => xx=69 (ปี พ.ศ. 2569), yy=09 (เดือน 9), zzz=500 (เลขคำสั่งซื้อ)
 */

export function getCurrentThaiYearBE2Digits(): string {
  // Current local Buddhist Era 2 digits
  // e.g. 2026 CE => 2569 BE => "69"
  const now = new Date();
  const beYear = now.getFullYear() + 543;
  return String(beYear).slice(-2);
}

export function getCurrentMonth2Digits(): string {
  const now = new Date();
  return String(now.getMonth() + 1).padStart(2, '0');
}

export function getRealtimeSOExample(orderSuffix = '___'): string {
  const yy = getCurrentThaiYearBE2Digits();
  const mm = getCurrentMonth2Digits();
  return `so${yy}${mm}${orderSuffix}`;
}

export function parseSONumber(so: string): {
  isValid: boolean;
  components?: SOComponents;
  error?: string;
} {
  const clean = so.trim().toLowerCase();
  
  if (!clean.startsWith('so')) {
    return {
      isValid: false,
      error: 'รหัสต้องขึ้นต้นด้วย "so" (เช่น so6909500)'
    };
  }

  const remainder = clean.slice(2);
  // Remainder should have at least xx (2 digits) + yy (2 digits) + zzz (at least 1-4 digits)
  if (remainder.length < 5) {
    return {
      isValid: false,
      error: 'รูปแบบต้องประกอบด้วย so + ปี พ.ศ.(2หลัก) + เดือน(2หลัก) + เลขคำสั่งซื้อ (เช่น so6909500)'
    };
  }

  const yearBE = remainder.slice(0, 2);
  const month = remainder.slice(2, 4);
  const orderNo = remainder.slice(4);

  if (!/^\d{2}$/.test(yearBE)) {
    return { isValid: false, error: 'ปี พ.ศ. (xx) ต้องเป็นตัวเลข 2 หลัก' };
  }

  const monthNum = parseInt(month, 10);
  if (!/^\d{2}$/.test(month) || monthNum < 1 || monthNum > 12) {
    return { isValid: false, error: 'เดือน (yy) ต้องเป็นตัวเลข 01 - 12' };
  }

  if (!/^\d+$/.test(orderNo)) {
    return { isValid: false, error: 'เลขคำสั่งซื้อ (zzz) ต้องเป็นตัวเลข' };
  }

  return {
    isValid: true,
    components: {
      yearBE,
      month,
      orderNo
    }
  };
}

export function buildSONumber(yearBE: string, month: string, orderNo: string): string {
  const cleanYear = yearBE.replace(/\D/g, '').slice(-2).padStart(2, '0');
  const cleanMonth = month.replace(/\D/g, '').slice(0, 2).padStart(2, '0');
  const cleanOrder = orderNo.replace(/\D/g, '');
  return `so${cleanYear}${cleanMonth}${cleanOrder}`;
}

export const THAI_MONTHS = [
  { value: '01', label: '01 - มกราคม' },
  { value: '02', label: '02 - กุมภาพันธ์' },
  { value: '03', label: '03 - มีนาคม' },
  { value: '04', label: '04 - เมษายน' },
  { value: '05', label: '05 - พฤษภาคม' },
  { value: '06', label: '06 - มิถุนายน' },
  { value: '07', label: '07 - กรกฎาคม' },
  { value: '08', label: '08 - สิงหาคม' },
  { value: '09', label: '09 - กันยายน' },
  { value: '10', label: '10 - ตุลาคม' },
  { value: '11', label: '11 - พฤศจิกายน' },
  { value: '12', label: '12 - ธันวาคม' },
];

export const STANDARD_PATTERNS = [
  { value: 'ขาว', label: 'ขาว', colorClass: 'bg-white text-slate-800 border-slate-300' },
  { value: 'ดำ', label: 'ดำ', colorClass: 'bg-slate-900 text-white' },
  { value: 'ไม้อ่อน', label: 'ไม้อ่อน', colorClass: 'bg-amber-100 text-amber-900 border-amber-300' },
  { value: 'ไม้เข้ม', label: 'ไม้เข้ม', colorClass: 'bg-amber-800 text-amber-50' },
  { value: 'เทา', label: 'เทา', colorClass: 'bg-slate-400 text-slate-900' },
  { value: 'กลีบบัว', label: 'กลีบบัว', colorClass: 'bg-rose-200 text-rose-900 border-rose-300' },
];

export const STANDARD_WIDTHS = [830, 850, 880, 900] as const;

export interface PatternStyleDef {
  value: string;
  label: string;
  name: string;
  dotClass: string;
  badgeClass: string;
  progressClass: string;
}

/**
 * Provides canonical colors, dot markers, and badges for foil patterns
 * ensuring absolute visual consistency across Dashboard, Roll List, SO History, and Flow Chart.
 */
export function getCanonicalPatternStyle(patternRaw: string): PatternStyleDef {
  const p = normalizePattern(patternRaw);
  switch (p) {
    case 'ขาว':
      return {
        value: 'ขาว',
        label: 'ขาว',
        name: 'ขาว',
        dotClass: 'bg-white border-2 border-slate-400 shadow-2xs',
        badgeClass: 'bg-slate-100 text-slate-800 border border-slate-300',
        progressClass: 'bg-slate-400',
      };
    case 'ดำ':
      return {
        value: 'ดำ',
        label: 'ดำ',
        name: 'ดำ',
        dotClass: 'bg-slate-950 border border-slate-800 shadow-2xs',
        badgeClass: 'bg-slate-900 text-white border border-slate-800',
        progressClass: 'bg-slate-900',
      };
    case 'ไม้อ่อน':
      return {
        value: 'ไม้อ่อน',
        label: 'ไม้อ่อน',
        name: 'ไม้อ่อน',
        dotClass: 'bg-amber-200 border border-amber-400 shadow-2xs',
        badgeClass: 'bg-amber-100 text-amber-900 border border-amber-300',
        progressClass: 'bg-amber-400',
      };
    case 'ไม้เข้ม':
      return {
        value: 'ไม้เข้ม',
        label: 'ไม้เข้ม',
        name: 'ไม้เข้ม',
        dotClass: 'bg-amber-800 border border-amber-950 shadow-2xs',
        badgeClass: 'bg-amber-800 text-amber-50 border border-amber-900',
        progressClass: 'bg-amber-800',
      };
    case 'เทา':
      return {
        value: 'เทา',
        label: 'เทา',
        name: 'เทา',
        dotClass: 'bg-slate-400 border border-slate-500 shadow-2xs',
        badgeClass: 'bg-slate-200 text-slate-800 border border-slate-300',
        progressClass: 'bg-slate-500',
      };
    case 'กลีบบัว':
      return {
        value: 'กลีบบัว',
        label: 'กลีบบัว',
        name: 'กลีบบัว',
        dotClass: 'bg-rose-300 border border-rose-400 shadow-2xs',
        badgeClass: 'bg-rose-100 text-rose-900 border border-rose-300',
        progressClass: 'bg-rose-400',
      };
    default:
      return {
        value: p,
        label: p,
        name: p,
        dotClass: 'bg-indigo-300 border border-indigo-400 shadow-2xs',
        badgeClass: 'bg-indigo-100 text-indigo-900 border border-indigo-200',
        progressClass: 'bg-indigo-400',
      };
  }
}

export const PATTERN_HEX_COLORS: Record<string, string> = {
  'ขาว': '#64748b',    // Slate 500 (distinct and visible)
  'ดำ': '#0f172a',     // Slate 900
  'ไม้อ่อน': '#f59e0b', // Amber 500
  'ไม้เข้ม': '#92400e', // Amber 800
  'เทา': '#94a3b8',    // Slate 400
  'กลีบบัว': '#f43f5e', // Rose 500
};

export function getPatternHexColor(pattern: string): string {
  const norm = normalizePattern(pattern);
  return PATTERN_HEX_COLORS[norm] || '#8b5cf6';
}

/**
 * Normalizes legacy / mis-typed pattern spellings to the current canonical
 * pattern names, so older saved data (local storage or Firestore) still
 * groups correctly with today's standard pattern list instead of showing up
 * as a separate "custom pattern" bar in the dashboard (e.g. an old roll
 * saved as "ท้องขาว" before the pattern was renamed to "ขาว").
 */
export function normalizePattern(pattern: string): string {
  switch (pattern) {
    case 'ท้องขาว':
      return 'ขาว';
    case 'ลายไม่อ่อน':
      return 'ไม้อ่อน';
    case 'ลายไม้เข้ม':
      return 'ไม้เข้ม';
    case 'กลับบัว':
      return 'กลีบบัว';
    default:
      return pattern;
  }
}
