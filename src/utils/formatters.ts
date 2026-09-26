/**
 * Formatting and rounding utilities for foil stock management
 */

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

