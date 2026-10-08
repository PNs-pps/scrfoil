import { FoilRoll } from '../types';

/**
 * Formatting and rounding utilities for foil stock management
 */

/**
 * วันที่ปัจจุบันตามเวลาเครื่อง (YYYY-MM-DD)
 * ใช้แทน new Date().toISOString().slice(0, 10) ที่เป็นเวลา UTC
 * ซึ่งทำให้วันที่ผิดเป็นของเมื่อวานช่วง 00:00-07:00 น. (เวลาไทย)
 */
export const todayLocalISO = (d: Date = new Date()): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const formatMeters = (val: number | string | undefined | null): string => {
  if (val === undefined || val === null || val === '') return '0.00';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return '0.00';
  return num.toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export const round2 = (num: number): number => {
  if (isNaN(num)) return 0;
  return Math.round((num + Number.EPSILON) * 100) / 100;
};

/**
 * Sorts rolls naturally by Lot Number, then by Roll Number
 */
export const compareLotAndRoll = (
  aLot: string,
  aRoll: string,
  bLot: string,
  bRoll: string
): number => {
  const lotComp = (aLot || '').trim().localeCompare((bLot || '').trim(), undefined, { numeric: true, sensitivity: 'base' });
  if (lotComp !== 0) return lotComp;
  return (aRoll || '').trim().localeCompare((bRoll || '').trim(), undefined, { numeric: true, sensitivity: 'base' });
};

/**
 * ตรวจสอบว่าม้วนฟอยล์หมดสต๊อกแล้วหรือไม่
 */
export const isRollDepleted = (roll: FoilRoll): boolean => {
  return Number(roll.remainingMeters) <= 0 || roll.status === 'depleted' || Boolean(roll.isZeroedOut);
};

export interface GenericCutRecord {
  foilId?: string;
  remainingAfter?: number;
  usageDate?: string;
  recordedDate?: string;
  createdAt?: string;
}

/**
 * หาวันที่ม้วนฟอยล์หมดสต๊อก (YYYY-MM-DD)
 */
export const getRollDepletionDate = (
  roll: FoilRoll,
  cutRecords?: GenericCutRecord[]
): string | null => {
  if (!isRollDepleted(roll)) return null;

  if (roll.depletedAt) {
    return roll.depletedAt.slice(0, 10);
  }

  const rawCuts: GenericCutRecord[] = (cutRecords || (roll.recentCuts as GenericCutRecord[]) || []);
  const cuts = rawCuts.filter((c) => !c.foilId || c.foilId === roll.id);
  if (cuts.length > 0) {
    // 1. ตรวจสอบการตัดที่ทำให้เหลือ <= 0 (เลือกใบที่มีวันที่ล่าสุด)
    const zeroCuts = cuts.filter((c) => Number(c.remainingAfter) <= 0);
    if (zeroCuts.length > 0) {
      const sorted = [...zeroCuts].sort((a, b) => {
        const tA = new Date(a.usageDate || a.recordedDate || a.createdAt || 0).getTime();
        const tB = new Date(b.usageDate || b.recordedDate || b.createdAt || 0).getTime();
        return tB - tA;
      });
      const d = sorted[0].usageDate || sorted[0].recordedDate || sorted[0].createdAt;
      if (d) return d.slice(0, 10);
    }
    // 2. ถ้าไม่มี 0 ให้ใช้วันที่ของการตัดล่าสุด
    const sorted = [...cuts].sort((a, b) => {
      const tA = new Date(a.usageDate || a.recordedDate || a.createdAt || 0).getTime();
      const tB = new Date(b.usageDate || b.recordedDate || b.createdAt || 0).getTime();
      return tB - tA;
    });
    const latest = sorted[0];
    const d = latest.usageDate || latest.recordedDate || latest.createdAt;
    if (d) return d.slice(0, 10);
  }

  if (roll.createdAt) {
    return roll.createdAt.slice(0, 10);
  }
  if (roll.dateReceived) {
    return roll.dateReceived.slice(0, 10);
  }
  return null;
};

/**
 * หาเวลา (timestamp ms) ที่ม้วนฟอยล์หมด สำหรับใช้เรียงลำดับ
 */
export const getRollDepletionTimestamp = (
  roll: FoilRoll,
  cutRecords?: GenericCutRecord[]
): number => {
  if (!isRollDepleted(roll)) return 0;

  if (roll.depletedAt) {
    const t = new Date(roll.depletedAt).getTime();
    if (!isNaN(t) && t > 0) return t;
  }

  const rawCuts: GenericCutRecord[] = (cutRecords || (roll.recentCuts as GenericCutRecord[]) || []);
  const cuts = rawCuts.filter((c) => !c.foilId || c.foilId === roll.id);
  if (cuts.length > 0) {
    const zeroCuts = cuts.filter((c) => Number(c.remainingAfter) <= 0);
    if (zeroCuts.length > 0) {
      let maxZeroTime = 0;
      zeroCuts.forEach((c) => {
        const d = c.usageDate || c.recordedDate || c.createdAt;
        if (d) {
          const t = new Date(d).getTime();
          if (!isNaN(t) && t > maxZeroTime) maxZeroTime = t;
        }
      });
      if (maxZeroTime > 0) return maxZeroTime;
    }

    let latestTime = 0;
    cuts.forEach((c) => {
      const d = c.usageDate || c.recordedDate || c.createdAt;
      if (d) {
        const t = new Date(d).getTime();
        if (!isNaN(t) && t > latestTime) latestTime = t;
      }
    });
    if (latestTime > 0) return latestTime;
  }

  if (roll.createdAt) {
    const t = new Date(roll.createdAt).getTime();
    if (!isNaN(t) && t > 0) return t;
  }
  if (roll.dateReceived) {
    const t = new Date(roll.dateReceived).getTime();
    if (!isNaN(t) && t > 0) return t;
  }

  return 0;
};

/**
 * แปลงวันที่เป็นรูปแบบภาษาไทย พ.ศ. (เช่น 15/09/2569)
 */
export const formatThaiDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '-';
  try {
    const clean = dateStr.slice(0, 10);
    const parts = clean.split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const d = parseInt(parts[2], 10);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
        const thaiYear = y > 2400 ? y : y + 543;
        return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${thaiYear}`;
      }
    }
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    }
  } catch {
    // fallback
  }
  return dateStr;
};

/**
 * เรียงลำดับม้วนฟอยล์ตามข้อกำหนด:
 * 1. ฟอล์ยที่หมดแล้วให้ไปอยู่ข้างล่างม้วนที่ใช้อยู่
 * 2. สำหรับม้วนที่หมดแล้ว เรียงจากหมดนานแล้วจะอยู่ล่างสุด พึ่งหมดจะอยู่บน (เวลาหมดล่าสุด -> เก่าสุด)
 * 3. สำหรับม้วนที่ยังไม่หมด เรียงตาม Lot และ Roll Number ตามปกติ
 */
export const compareFoilRolls = (
  a: FoilRoll,
  b: FoilRoll,
  cutRecords?: GenericCutRecord[]
): number => {
  const isDepA = isRollDepleted(a);
  const isDepB = isRollDepleted(b);

  // 1. ฟอล์ยที่หมดแล้วไปอยู่ข้างล่างม้วนที่ใช้อยู่
  if (!isDepA && isDepB) return -1;
  if (isDepA && !isDepB) return 1;

  // 2. ถ้าหมดแล้วทั้งคู่: เรียงจากหมดนานแล้วจะอยู่ล่างสุด พึ่งหมดจะอยู่บน (descending by depletion time)
  if (isDepA && isDepB) {
    const timeA = getRollDepletionTimestamp(a, cutRecords);
    const timeB = getRollDepletionTimestamp(b, cutRecords);
    if (timeA !== timeB) {
      return timeB - timeA; // ค่ามาก (พึ่งหมด) อยู่บน, ค่าน้อย (หมดนานแล้ว) อยู่ล่าง
    }
    return compareLotAndRoll(a.lotNumber || '', a.rollNumber || '', b.lotNumber || '', b.rollNumber || '');
  }

  // 3. ถ้ายังไม่หมดทั้งคู่ (ใช้อยู่): เรียงตามล็อตและเบอร์ม้วนตามปกติ
  return compareLotAndRoll(a.lotNumber || '', a.rollNumber || '', b.lotNumber || '', b.rollNumber || '');
};

