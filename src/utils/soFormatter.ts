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
  { value: 'ไม้เข้ม', label: 'ไม้เข้ม', colorClass: 'bg-[#78350f] text-amber-50' },
  { value: 'เทา', label: 'เทา', colorClass: 'bg-slate-400 text-slate-900' },
  { value: 'กลีบบัว', label: 'กลีบบัว', colorClass: 'bg-gradient-to-r from-slate-200 to-zinc-300 text-slate-900 border-slate-400' },
];

export const STANDARD_WIDTHS = [830, 850, 880, 900] as const;
