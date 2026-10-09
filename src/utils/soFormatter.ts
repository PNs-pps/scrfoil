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
  { value: 'ขาว', label: 'ขาว', colorClass: 'bg-slate-100 text-slate-800 border-slate-300' },
  { value: 'ดำ', label: 'ดำ', colorClass: 'bg-slate-900 text-white border-slate-800' },
  { value: 'ไม้อ่อน', label: 'ไม้อ่อน', colorClass: 'bg-amber-100 text-amber-900 border-amber-300' },
  { value: 'ไม้เข้ม', label: 'ไม้เข้ม', colorClass: 'bg-amber-800 text-amber-50 border-amber-900' },
  { value: 'เทา', label: 'เทา', colorClass: 'bg-slate-200 text-slate-800 border-slate-300' },
  { value: 'กลีบบัว', label: 'กลีบบัว', colorClass: 'bg-rose-100 text-rose-900 border-rose-300' },
];

export const STANDARD_WIDTHS = [830, 850, 880, 900] as const;

export interface PatternStyleDef {
  value: string;
  label: string;
  name: string;
  /** ชื่อสีภาษาไทย เช่น "สีเหลือง" */
  colorName: string;
  dotClass: string;
  badgeClass: string;
  /** สีแท่ง "คงเหลือแยกตามลาย" ในหน้าแดชบอร์ด */
  progressClass: string;
  borderClass: string;
  /** สีไฮไลต์เข้ม (พื้นทึบ + ตัวอักษรที่อ่านออก) ใช้กับป้ายลายฟอยล์ */
  highlightClass: string;
  /** สีไฮไลต์อ่อน ใช้กับพื้นกล่อง/แถวที่เกี่ยวกับลายนั้น */
  tintClass: string;
}

/**
 * แหล่งสีเดียวของลายฟอยล์ทั้งแอพ — ใช้ชุดสีเดียวกับ "คงเหลือฟอยล์แยกตามลาย"
 * ในหน้าแดชบอร์ด ให้ Dashboard, รายการม้วน, ประวัติ SO, กราฟรายเดือน,
 * Daily Flow และ Modal ต่าง ๆ แสดงสีตรงกันเสมอ
 */
export function getCanonicalPatternStyle(patternRaw: string): PatternStyleDef {
  const p = normalizePattern(patternRaw);
  switch (p) {
    case 'ขาว':
      return {
        value: 'ขาว',
        label: 'ขาว',
        name: 'ขาว',
        colorName: 'สีขาว',
        dotClass: 'bg-white border-2 border-slate-400 shadow-2xs',
        badgeClass: 'bg-slate-100 text-slate-800 border border-slate-300',
        progressClass: 'bg-slate-400',
        borderClass: 'border-slate-400',
        highlightClass: 'bg-slate-100 text-slate-900 border-slate-400',
        tintClass: 'bg-slate-50 border-slate-300',
      };
    case 'ดำ':
      return {
        value: 'ดำ',
        label: 'ดำ',
        name: 'ดำ',
        colorName: 'สีดำ',
        dotClass: 'bg-slate-950 border border-slate-800 shadow-2xs',
        badgeClass: 'bg-slate-900 text-white border border-slate-800',
        progressClass: 'bg-slate-900',
        borderClass: 'border-slate-900',
        highlightClass: 'bg-slate-900 text-white border-slate-950',
        tintClass: 'bg-slate-100 border-slate-500',
      };
    case 'ไม้อ่อน':
      return {
        value: 'ไม้อ่อน',
        label: 'ไม้อ่อน',
        name: 'ไม้อ่อน',
        colorName: 'สีเหลือง',
        dotClass: 'bg-amber-200 border border-amber-400 shadow-2xs',
        badgeClass: 'bg-amber-100 text-amber-900 border border-amber-300',
        progressClass: 'bg-amber-400',
        borderClass: 'border-amber-400',
        highlightClass: 'bg-amber-200 text-amber-950 border-amber-400',
        tintClass: 'bg-amber-50 border-amber-300',
      };
    case 'ไม้เข้ม':
      return {
        value: 'ไม้เข้ม',
        label: 'ไม้เข้ม',
        name: 'ไม้เข้ม',
        colorName: 'สีน้ำตาล',
        dotClass: 'bg-amber-800 border border-amber-950 shadow-2xs',
        badgeClass: 'bg-amber-800 text-amber-50 border border-amber-900',
        progressClass: 'bg-amber-800',
        borderClass: 'border-amber-800',
        highlightClass: 'bg-amber-800 text-amber-50 border-amber-950',
        tintClass: 'bg-amber-100/80 border-amber-700',
      };
    case 'เทา':
      return {
        value: 'เทา',
        label: 'เทา',
        name: 'เทา',
        colorName: 'สีเทา',
        dotClass: 'bg-slate-400 border border-slate-500 shadow-2xs',
        badgeClass: 'bg-slate-200 text-slate-800 border border-slate-300',
        progressClass: 'bg-slate-500',
        borderClass: 'border-slate-500',
        highlightClass: 'bg-slate-300 text-slate-900 border-slate-500',
        tintClass: 'bg-slate-100 border-slate-400',
      };
    case 'กลีบบัว':
      return {
        value: 'กลีบบัว',
        label: 'กลีบบัว',
        name: 'กลีบบัว',
        colorName: 'สีชมพู',
        dotClass: 'bg-rose-300 border border-rose-400 shadow-2xs',
        badgeClass: 'bg-rose-100 text-rose-900 border border-rose-300',
        progressClass: 'bg-rose-400',
        borderClass: 'border-rose-400',
        highlightClass: 'bg-rose-200 text-rose-950 border-rose-400',
        tintClass: 'bg-rose-50 border-rose-300',
      };
    default:
      return {
        value: p,
        label: p,
        name: p,
        colorName: 'สีอื่น ๆ',
        dotClass: 'bg-indigo-300 border border-indigo-400 shadow-2xs',
        badgeClass: 'bg-indigo-100 text-indigo-900 border border-indigo-200',
        progressClass: 'bg-indigo-400',
        borderClass: 'border-indigo-400',
        highlightClass: 'bg-indigo-200 text-indigo-950 border-indigo-400',
        tintClass: 'bg-indigo-50 border-indigo-300',
      };
  }
}

/**
 * จับคู่ชื่อลายที่พิมพ์หลากหลาย (เช่น "ลายไม้เข้ม", "สีดำ", "silver") ให้เป็นลายมาตรฐาน
 * คืน null ถ้าไม่ตรงกับลายมาตรฐานใดเลย
 */
export function resolveStandardPattern(patternRaw: string = ''): string | null {
  const norm = normalizePattern((patternRaw || '').trim());
  if (STANDARD_PATTERNS.some((sp) => sp.value === norm)) return norm;
  const l = norm.toLowerCase();
  if (l.includes('ไม้เข้ม') || l === 'dark_wood') return 'ไม้เข้ม';
  if (l.includes('ไม้อ่อน') || l.includes('ไม้อ้อน') || l.includes('ไม่อ่อน') || l === 'light_wood') return 'ไม้อ่อน';
  if (l.includes('กลีบบัว') || l.includes('กลับบัว') || l === 'บัว' || l === 'silver' || l === 'เงิน') return 'กลีบบัว';
  if (l.includes('ดำ') || l === 'black') return 'ดำ';
  if (l.includes('เทา') || l === 'gray' || l === 'grey') return 'เทา';
  if (l.includes('ขาว') || l === 'white') return 'ขาว';
  return null;
}

/** สี hex สำหรับกราฟ — ตรงกับ progressClass ของแต่ละลายในแดชบอร์ด (Tailwind 400/500/800/900) */
export const PATTERN_HEX_COLORS: Record<string, string> = {
  'ขาว': '#94a3b8',    // slate-400  (bg-slate-400)
  'ดำ': '#0f172a',     // slate-900  (bg-slate-900)
  'ไม้อ่อน': '#fbbf24', // amber-400  (bg-amber-400)
  'ไม้เข้ม': '#92400e', // amber-800  (bg-amber-800)
  'เทา': '#64748b',    // slate-500  (bg-slate-500)
  'กลีบบัว': '#fb7185', // rose-400   (bg-rose-400)
};

export function getPatternHexColor(pattern: string): string {
  const norm = resolveStandardPattern(pattern) ?? normalizePattern(pattern);
  return PATTERN_HEX_COLORS[norm] || '#818cf8'; // indigo-400 = สีลายอื่น ๆ ใน getCanonicalPatternStyle
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
