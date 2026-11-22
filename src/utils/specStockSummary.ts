import { FoilRoll, StockCutRecord, isRollUnused } from '../types';
import { round2 } from './formatters';
import { signedTotalDeducted } from './cutDeduction';
import { isRecordSpecCompatibleWithRoll, normalizePatternForMatch } from './rollIdentity';
import { normalizePattern, resolveStandardPattern, STANDARD_PATTERNS, STANDARD_WIDTHS } from './soFormatter';

export type SpecAlertLevel = 'critical' | 'warning' | 'normal';

export interface SpecStockSummary {
  key: string;
  width: number;
  pattern: string;
  activeRollCount: number;
  fullRollCount: number;
  partialRollCount: number;
  reverseOnlyCount: number;
  lowMeterRollCount: number;
  totalRemainingMeters: number;
  fullRollsMeters: number;
  partialRollsMeters: number;
  reservedMeters: number;
  netAvailableMeters: number;
  alertLevel: SpecAlertLevel;
  shouldShowInAlertBox: boolean;
}

export const LOW_METER_THRESHOLD = 200;

export function buildSpecKey(width: number | string, pattern: string): string {
  const numericWidth = Number(width);
  const widthPart = Number.isFinite(numericWidth) && numericWidth > 0 ? String(numericWidth) : '0';
  const patternPart = normalizePatternForMatch(pattern);
  return `${widthPart}::${patternPart}`;
}

export function getCanonicalDisplayPattern(pattern: string): string {
  const trimmed = String(pattern ?? '').trim();
  if (!trimmed) return 'ไม่ระบุ';
  return resolveStandardPattern(trimmed) ?? (normalizePattern(trimmed).trim() || trimmed);
}

export function isRollActiveForSummary(roll: FoilRoll): boolean {
  return Number(roll.remainingMeters) > 0 && !roll.isZeroedOut && roll.status !== 'depleted';
}

function getPatternSortRank(pattern: string): number {
  const idx = STANDARD_PATTERNS.findIndex((p) => p.value === pattern);
  return idx === -1 ? 999 : idx;
}

function getWidthSortRank(width: number): number {
  const idx = STANDARD_WIDTHS.findIndex((w) => Number(w) === width);
  return idx === -1 ? 10000 + width : idx;
}

/**
 * สรุปสถานะสต๊อกม้วนฟอยล์แยกตามคู่ หน้ากว้าง × ท้อง (Width × Pattern)
 * - นับเฉพาะม้วนที่ยังใช้งานอยู่ (remainingMeters > 0, !isZeroedOut, status !== 'depleted')
 * - "ลูกเต็ม" = ม้วนปกติที่ไม่ใช่ reverse-only, isRollUnused(roll), และไม่มีใบจอง SO ค้างอยู่
 * - "เมตรรวม" = รวมทั้งลูกเต็ม + เศษม้วน พร้อมยอดจอง SO และยอดสุทธิหลังหักจอง
 * - แจ้งเตือนอัตโนมัติ:
 *   - critical (โทนแดง): ลูกเต็มเหลือ 0 ลูก
 *   - warning (โทนเหลือง): ลูกเต็มเหลือ 1 ลูก
 */
export function summarizeStockByWidthPattern(
  rolls: FoilRoll[],
  records: StockCutRecord[] = []
): SpecStockSummary[] {
  const activeReservationsByRollId = new Map<string, StockCutRecord[]>();
  for (const rec of records) {
    if (rec.cutStatus === 'reserved' && rec.foilId) {
      const list = activeReservationsByRollId.get(rec.foilId) || [];
      list.push(rec);
      activeReservationsByRollId.set(rec.foilId, list);
    }
  }

  interface Bucket {
    key: string;
    width: number;
    pattern: string;
    rolls: FoilRoll[];
  }

  const buckets = new Map<string, Bucket>();

  for (const roll of rolls) {
    if (!isRollActiveForSummary(roll)) continue;
    const width = Number(roll.width) || 0;
    if (width <= 0) continue;
    const displayPattern = getCanonicalDisplayPattern(roll.pattern);
    const key = buildSpecKey(width, roll.pattern);

    const existing = buckets.get(key);
    if (existing) {
      existing.rolls.push(roll);
    } else {
      buckets.set(key, {
        key,
        width,
        pattern: displayPattern,
        rolls: [roll],
      });
    }
  }

  const summaries: SpecStockSummary[] = [];

  for (const bucket of buckets.values()) {
    let fullRollCount = 0;
    let partialRollCount = 0;
    let reverseOnlyCount = 0;
    let lowMeterRollCount = 0;
    let totalRemainingMeters = 0;
    let fullRollsMeters = 0;
    let partialRollsMeters = 0;
    let reservedMeters = 0;

    for (const roll of bucket.rolls) {
      const rem = round2(Math.max(0, Number(roll.remainingMeters) || 0));
      totalRemainingMeters = round2(totalRemainingMeters + rem);

      const rollRes = (activeReservationsByRollId.get(roll.id) || []).filter((rec) =>
        isRecordSpecCompatibleWithRoll(roll, rec)
      );
      const rollReservedMeters = round2(
        rollRes.reduce((sum, rec) => sum + Math.abs(signedTotalDeducted(rec)), 0)
      );
      reservedMeters = round2(reservedMeters + rollReservedMeters);

      if (roll.isReverseSideOnly) {
        reverseOnlyCount += 1;
        partialRollsMeters = round2(partialRollsMeters + rem);
      } else if (isRollUnused(roll) && rollRes.length === 0) {
        fullRollCount += 1;
        fullRollsMeters = round2(fullRollsMeters + rem);
      } else {
        partialRollCount += 1;
        partialRollsMeters = round2(partialRollsMeters + rem);
      }

      if (!roll.isReverseSideOnly && rem > 0 && rem <= LOW_METER_THRESHOLD) {
        lowMeterRollCount += 1;
      }
    }

    const netAvailableMeters = Math.max(0, round2(totalRemainingMeters - reservedMeters));
    const alertLevel: SpecAlertLevel =
      fullRollCount === 0 ? 'critical' : fullRollCount === 1 ? 'warning' : 'normal';

    summaries.push({
      key: bucket.key,
      width: bucket.width,
      pattern: bucket.pattern,
      activeRollCount: bucket.rolls.length,
      fullRollCount,
      partialRollCount,
      reverseOnlyCount,
      lowMeterRollCount,
      totalRemainingMeters,
      fullRollsMeters,
      partialRollsMeters,
      reservedMeters,
      netAvailableMeters,
      alertLevel,
      shouldShowInAlertBox: alertLevel !== 'normal',
    });
  }

  return summaries.sort((a, b) => {
    const wDiff = getWidthSortRank(a.width) - getWidthSortRank(b.width);
    if (wDiff !== 0) return wDiff;
    const pDiff = getPatternSortRank(a.pattern) - getPatternSortRank(b.pattern);
    if (pDiff !== 0) return pDiff;
    return a.pattern.localeCompare(b.pattern, 'th');
  });
}

/**
 * จัดเรียงรายการแจ้งเตือน: ลูกเต็มเหลือ 0 (critical/แดง) ขึ้นก่อน ตามด้วย ลูกเต็มเหลือ 1 (warning/เหลือง)
 */
export function getSortedAlertSummaries(summaries: SpecStockSummary[]): SpecStockSummary[] {
  return summaries
    .filter((s) => s.shouldShowInAlertBox)
    .sort((a, b) => {
      const levelScore = (lvl: SpecAlertLevel) => (lvl === 'critical' ? 0 : lvl === 'warning' ? 1 : 2);
      const lDiff = levelScore(a.alertLevel) - levelScore(b.alertLevel);
      if (lDiff !== 0) return lDiff;
      const wDiff = getWidthSortRank(a.width) - getWidthSortRank(b.width);
      if (wDiff !== 0) return wDiff;
      const pDiff = getPatternSortRank(a.pattern) - getPatternSortRank(b.pattern);
      if (pDiff !== 0) return pDiff;
      return a.pattern.localeCompare(b.pattern, 'th');
    });
}

export interface WidthStockGroup {
  width: number;
  patterns: SpecStockSummary[];
  fullRollCount: number;
  partialRollCount: number;
  reverseOnlyCount: number;
  totalRemainingMeters: number;
  reservedMeters: number;
  netAvailableMeters: number;
  zeroFullRollCount: number;
  oneFullRollCount: number;
}

/**
 * จัดกลุ่มผลสรุปสเปกตามหน้ากว้าง (รายการใหญ่) พร้อมรายการย่อยตามท้องฟอยล์
 */
export function groupSummariesByWidth(summaries: SpecStockSummary[]): WidthStockGroup[] {
  const map = new Map<number, SpecStockSummary[]>();
  for (const s of summaries) {
    const existing = map.get(s.width) || [];
    existing.push(s);
    map.set(s.width, existing);
  }

  const groups: WidthStockGroup[] = [];
  for (const [width, patterns] of map.entries()) {
    let fullRollCount = 0;
    let partialRollCount = 0;
    let reverseOnlyCount = 0;
    let totalRemainingMeters = 0;
    let reservedMeters = 0;
    let zeroFullRollCount = 0;
    let oneFullRollCount = 0;

    for (const p of patterns) {
      fullRollCount += p.fullRollCount;
      partialRollCount += p.partialRollCount;
      reverseOnlyCount += p.reverseOnlyCount;
      totalRemainingMeters = round2(totalRemainingMeters + p.totalRemainingMeters);
      reservedMeters = round2(reservedMeters + p.reservedMeters);
      if (p.fullRollCount === 0) zeroFullRollCount += 1;
      else if (p.fullRollCount === 1) oneFullRollCount += 1;
    }

    groups.push({
      width,
      patterns,
      fullRollCount,
      partialRollCount,
      reverseOnlyCount,
      totalRemainingMeters,
      reservedMeters,
      netAvailableMeters: Math.max(0, round2(totalRemainingMeters - reservedMeters)),
      zeroFullRollCount,
      oneFullRollCount,
    });
  }

  return groups.sort((a, b) => getWidthSortRank(a.width) - getWidthSortRank(b.width));
}
