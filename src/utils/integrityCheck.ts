/**
 * Daily stock integrity check.
 *
 * Verifies that each foil roll's remainingMeters actually matches what the
 * roll's own cut history (StockCutRecord entries) implies it should be:
 *
 *   expectedRemaining = totalMeters - sum(usedMeters + ngMeters) over all
 *                        records belonging to that roll
 *
 * A mismatch usually means either a manual edit that didn't account for
 * existing cuts, a cut/delete that partially failed to sync, or (rarely) a
 * stale local cache that never reconciled with Firestore. This runs entirely
 * on data already loaded in the browser — no extra reads required.
 */

import { FoilRoll, StockCutRecord } from '../types';
import { round2 } from './formatters';

export interface IntegrityMismatch {
  rollId: string;
  lotNumber: string;
  rollNumber: string;
  pattern: string;
  width: number;
  totalMeters: number;
  actualRemaining: number;
  expectedRemaining: number;
  diff: number; // actual - expected (positive = roll shows MORE than it should)
  recordCount: number;
  sumUsedMeters: number;
  sumNgMeters: number;
  sumTotalDeducted: number;
  isZeroedOut: boolean;
  canAutoAdjust: boolean;
  zeroedReason?: string;
}

// Small tolerance to absorb floating point rounding noise, not real discrepancies.
const TOLERANCE_METERS = 0.05;

/**
 * Total stock deduction implied by a roll's cut records, using exactly the rules
 * checkStockIntegrity applies: reserved / cancelled records deduct nothing, and
 * totalDeducted keeps its sign (Cycle Count returns are negative).
 *
 * Exported so a repair can be computed from the FULL record set read from Cloud
 * instead of whatever subset happens to be cached in the browser.
 */
export function summarizeRollDeduction(records: StockCutRecord[]): {
  total: number;
  used: number;
  ng: number;
  count: number;
} {
  let total = 0;
  let used = 0;
  let ng = 0;
  let count = 0;
  records.forEach((rec) => {
    if (rec.cutStatus === 'reserved' || rec.cutStatus === 'cancelled') return;
    const safeUsed = Math.abs(Number(rec.usedMeters || 0));
    const safeNg = Math.abs(Number(rec.ngMeters || 0));
    const rawTotal = Number(rec.totalDeducted);
    const deducted = Number.isFinite(rawTotal) ? rawTotal : safeUsed + safeNg;
    used = round2(used + safeUsed);
    ng = round2(ng + safeNg);
    total = round2(total + deducted);
    count += 1;
  });
  return { total, used, ng, count };
}

export interface CheckStockIntegrityOptions {
  excludeZeroedOut?: boolean;
}

export function checkStockIntegrity(
  rolls: FoilRoll[],
  records: StockCutRecord[],
  options?: CheckStockIntegrityOptions
): IntegrityMismatch[] {
  const deductionByRoll = new Map<string, { total: number; used: number; ng: number; count: number }>();

  records.forEach((rec) => {
    // รายการจองรอตัด หรือยกเลิก จะยังไม่ถูกหักสต๊อกจริงจากม้วน
    if (rec.cutStatus === 'reserved' || rec.cutStatus === 'cancelled') return;

    const existing = deductionByRoll.get(rec.foilId) || { total: 0, used: 0, ng: 0, count: 0 };
    // usedMeters / ngMeters are always non-negative (production cuts).
    // totalDeducted is SIGNED: positive = stock out, negative = stock in
    // (e.g. Cycle Count when physical count > system remaining).
    // Using Math.abs on totalDeducted would turn stock-in adjustments into
    // extra deductions and produce false integrity mismatches / system errors.
    const safeUsed = Math.abs(Number(rec.usedMeters || 0));
    const safeNg = Math.abs(Number(rec.ngMeters || 0));
    const rawTotal = Number(rec.totalDeducted);
    const deducted = Number.isFinite(rawTotal)
      ? rawTotal
      : safeUsed + safeNg;

    existing.used = round2(existing.used + safeUsed);
    existing.ng = round2(existing.ng + safeNg);
    existing.total = round2(existing.total + deducted);
    existing.count += 1;
    deductionByRoll.set(rec.foilId, existing);
  });

  const mismatches: IntegrityMismatch[] = [];

  rolls.forEach((roll) => {
    const deduction = deductionByRoll.get(roll.id) || { total: 0, used: 0, ng: 0, count: 0 };
    // Do not clamp expected to >=0: signed adjustments (stock-in) can make
    // remaining legitimately higher than totalMeters until total is revised.
    const expectedRemaining = round2(Number(roll.totalMeters || 0) - deduction.total);
    const actualRemaining = round2(Number(roll.remainingMeters || 0));
    const diff = round2(actualRemaining - expectedRemaining);

    const isZeroed = Boolean(roll.isZeroedOut);

    // If options explicitly ask to exclude zeroed out rolls from mismatches list
    if (options?.excludeZeroedOut && isZeroed) {
      return;
    }

    if (Math.abs(diff) > TOLERANCE_METERS) {
      mismatches.push({
        rollId: roll.id,
        lotNumber: roll.lotNumber,
        rollNumber: roll.rollNumber,
        pattern: roll.pattern,
        width: roll.width,
        totalMeters: roll.totalMeters,
        actualRemaining,
        expectedRemaining,
        diff,
        recordCount: deduction.count,
        sumUsedMeters: deduction.used,
        sumNgMeters: deduction.ng,
        sumTotalDeducted: deduction.total,
        isZeroedOut: isZeroed,
        canAutoAdjust: true, // Allow adjusting any mismatch to restore integrity
        zeroedReason: isZeroed ? 'ม้วนนี้ถูกตั้งค่าเป็น 0 (สามารถกดปรับยอดเพื่อคืนสต๊อกได้)' : undefined,
      });
    }
  });

  return mismatches.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
}

// --- "สัปดาห์ละครั้ง (จันทร์)" scheduling, done client-side -------------------
// ตรวจเต็มรูปแบบอัตโนมัติสัปดาห์ละ 1 ครั้ง โดยรันครั้งแรกที่เปิดแอปในสัปดาห์นั้น
// (นับสัปดาห์เริ่มวันจันทร์) ตามข้อตกลง W1/W3
// หมายเหตุ: เป็น client-only จึงตรวจได้เมื่อมีคนเปิดแอปเท่านั้น

const STORAGE_KEY = 'pufoam_integrity_check_state';
export const MAX_AUTO_CHECKS_PER_WEEK = 1;

export interface CheckState {
  date: string;            // กุญแจสัปดาห์ (วันจันทร์ YYYY-MM-DD)
  count: number;           // จำนวนครั้งที่ตรวจอัตโนมัติในสัปดาห์นี้
  lastCheckedAt: string;
}

/** วันจันทร์ของสัปดาห์ปัจจุบันตามเวลาเครื่อง (YYYY-MM-DD) ใช้เป็นกุญแจสัปดาห์ */
function weekKey(): string {
  const now = new Date();
  const day = now.getDay(); // 0=อา. … 6=ส.
  const daysSinceMonday = (day + 6) % 7; // จ.→0, อ.→1, … อา.→6
  const monday = new Date(now);
  monday.setDate(now.getDate() - daysSinceMonday);
  const y = monday.getFullYear();
  const m = String(monday.getMonth() + 1).padStart(2, '0');
  const d = String(monday.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function readState(): CheckState {
  const key = weekKey();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as CheckState;
      if (parsed.date === key) return parsed;
    }
  } catch (e) {
    // ignore corrupt/missing state
  }
  return { date: key, count: 0, lastCheckedAt: '' };
}

export function shouldRunAutoCheck(): boolean {
  const state = readState();
  return state.count < MAX_AUTO_CHECKS_PER_WEEK;
}

export function markAutoCheckRun(): void {
  const state = readState();
  state.count += 1;
  state.lastCheckedAt = new Date().toISOString();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    // localStorage unavailable — auto-check will just run again next load, harmless
  }
}

export function getCheckState(): CheckState {
  return readState();
}
