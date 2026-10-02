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
  if (val === undefined || val === null || val === '') return '0';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return '0';
  return num.toLocaleString('th-TH', {
    minimumFractionDigits: 0,
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
  const lotComp = aLot.localeCompare(bLot, undefined, { numeric: true, sensitivity: 'base' });
  if (lotComp !== 0) return lotComp;
  return aRoll.localeCompare(bRoll, undefined, { numeric: true, sensitivity: 'base' });
};

