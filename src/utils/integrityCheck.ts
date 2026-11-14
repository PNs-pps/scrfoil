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
import {
  buildStrictRollKey,
  hasExplicitSpecConflict,
  isRecordSpecCompatibleWithRoll,
} from './rollIdentity';

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
  contaminatedCount?: number;
  zeroLockBlocked?: boolean;
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
  // Index rolls by ID and by STRICT composite key (lot + roll + width + normalizedPattern).
  // Never index by lot + roll alone — rolls with the same lot & roll across different widths/patterns must stay isolated.
  const rollById = new Map<string, FoilRoll>();
  const rollsByStrictKey = new Map<string, FoilRoll[]>();

  rolls.forEach((roll) => {
    rollById.set(roll.id, roll);
    const strictKey = buildStrictRollKey(roll.lotNumber, roll.rollNumber, roll.width, roll.pattern);
    if (roll.lotNumber && roll.rollNumber && roll.width && roll.pattern) {
      const list = rollsByStrictKey.get(strictKey) || [];
      list.push(roll);
      rollsByStrictKey.set(strictKey, list);
    }
  });

  const deductionByRoll = new Map<string, { total: number; used: number; ng: number; count: number }>();
  const contaminatedCountByRoll = new Map<string, number>();

  records.forEach((rec) => {
    // รายการจองรอตัด หรือยกเลิก จะยังไม่ถูกหักสต๊อกจริงจากม้วน
    if (rec.cutStatus === 'reserved' || rec.cutStatus === 'cancelled') return;

    let targetRoll: FoilRoll | undefined = rec.foilId ? rollById.get(rec.foilId) : undefined;

    if (targetRoll) {
      // If rec.foilId points to a roll whose width/pattern explicitly conflicts, quarantine it
      // rather than deducting cross-spec meters onto this roll.
      if (hasExplicitSpecConflict(targetRoll, rec)) {
        contaminatedCountByRoll.set(
          targetRoll.id,
          (contaminatedCountByRoll.get(targetRoll.id) || 0) + 1
        );
        return;
      }
    } else if (!rec.foilId) {
      // Fallback only when foilId is absent, and ONLY when lot + roll + width + pattern matches unambiguously.
      const strictKey = buildStrictRollKey(rec.lotNumber, rec.rollNumber, rec.width, rec.pattern);
      const candidates = rollsByStrictKey.get(strictKey) || [];
      if (candidates.length === 1 && isRecordSpecCompatibleWithRoll(candidates[0], rec, { requireBothPresent: true })) {
        targetRoll = candidates[0];
      }
    }

    if (!targetRoll) return;

    const existing = deductionByRoll.get(targetRoll.id) || { total: 0, used: 0, ng: 0, count: 0 };
    // usedMeters / ngMeters are always non-negative (production cuts).
    // totalDeducted is SIGNED: positive = stock out, negative = stock in
    // (e.g. Cycle Count when physical count > system remaining).
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
    deductionByRoll.set(targetRoll.id, existing);
  });

  const mismatches: IntegrityMismatch[] = [];

  rolls.forEach((roll) => {
    const deduction = deductionByRoll.get(roll.id) || { total: 0, used: 0, ng: 0, count: 0 };
    const contaminatedCount = contaminatedCountByRoll.get(roll.id) || 0;
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

    const wouldAutoZeroScrapRoll = !isZeroed && actualRemaining > 0 && expectedRemaining <= 0;
    const hasContamination = contaminatedCount > 0;

    if (Math.abs(diff) > TOLERANCE_METERS || hasContamination) {
      let reason: string | undefined;
      if (isZeroed) {
        reason = 'ม้วนนี้ถูกตั้งค่าเป็น 0 (สามารถกดปรับยอดเพื่อคืนสต๊อกได้)';
      } else if (hasContamination) {
        reason = `พบใบตัดต่างหน้ากว้าง/ลายปนอยู่ในม้วนนี้ ${contaminatedCount} ใบ — ล็อกการปรับยอดอัตโนมัติ กรุณากดแยกใบตัดกลับม้วนที่ถูกต้องก่อน`;
      } else if (wouldAutoZeroScrapRoll) {
        reason = `🔒 ล็อกห้ามปรับม้วนที่ยังเหลือเศษ (${actualRemaining} ม.) เป็น 0 อัตโนมัติ (คำนวณได้ ${expectedRemaining} ม.)`;
      }

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
        canAutoAdjust: !hasContamination && !wouldAutoZeroScrapRoll,
        zeroedReason: reason,
        contaminatedCount,
        zeroLockBlocked: wouldAutoZeroScrapRoll,
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
