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
    const existing = deductionByRoll.get(rec.foilId) || { total: 0, used: 0, ng: 0, count: 0 };
    const safeUsed = Math.abs(Number(rec.usedMeters || 0));
    const safeNg = Math.abs(Number(rec.ngMeters || 0));
    const deducted = Math.abs(Number(rec.totalDeducted ?? (safeUsed + safeNg)));

    existing.used = round2(existing.used + safeUsed);
    existing.ng = round2(existing.ng + safeNg);
    existing.total = round2(existing.total + deducted);
    existing.count += 1;
    deductionByRoll.set(rec.foilId, existing);
  });

  const mismatches: IntegrityMismatch[] = [];

  rolls.forEach((roll) => {
    const deduction = deductionByRoll.get(roll.id) || { total: 0, used: 0, ng: 0, count: 0 };
    const expectedRemaining = round2(Math.max(0, Number(roll.totalMeters || 0) - deduction.total));
    const actualRemaining = round2(Number(roll.remainingMeters || 0));
    const diff = round2(actualRemaining - expectedRemaining);

    const isZeroed = Boolean(
      roll.isZeroedOut || 
      (roll.remainingMeters === 0 && (roll.status === 'depleted' || roll.manualZeroedOriginalMeters !== undefined))
    );

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
        canAutoAdjust: !isZeroed,
        zeroedReason: isZeroed ? 'ม้วนนี้ถูกกดตัดเป็น 0 แล้ว (isZeroedOut) ยกเว้นการปรับยอด' : undefined,
      });
    }
  });

  return mismatches.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
}

// --- "1-2 times a day" scheduling, done client-side ------------------------
// There's no server-side scheduler in this app (it's a pure client + Firestore
// app), so "automatic" here means: the check runs by itself, without anyone
// pressing a button, the first couple of times someone opens the app each day.
// If nobody opens the app on a given day, no check runs that day — there's no
// way around that without adding a real backend (see Cloud Functions option).

const STORAGE_KEY = 'pufoam_integrity_check_state';
const MAX_AUTO_CHECKS_PER_DAY = 2;

interface CheckState {
  date: string; // YYYY-MM-DD
  count: number;
  lastCheckedAt: string;
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function readState(): CheckState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: CheckState = JSON.parse(raw);
      if (parsed.date === todayStr()) return parsed;
    }
  } catch (e) {
    // ignore corrupt/missing state
  }
  return { date: todayStr(), count: 0, lastCheckedAt: '' };
}

export function shouldRunAutoCheck(): boolean {
  const state = readState();
  return state.count < MAX_AUTO_CHECKS_PER_DAY;
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
