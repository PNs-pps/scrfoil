import { describe, it, expect } from 'vitest';
import {
  buildStrictRollKey,
  doesRecordBelongToRoll,
  findContaminatedRecordsForRoll,
  findMatchingRollForRecord,
  findTargetRollForContaminatedRecord,
  hasExplicitSpecConflict,
  isRecordSpecCompatibleWithRoll,
} from './rollIdentity';
import { auditRollSOHistory } from './soHistoryAudit';
import { checkStockIntegrity } from './integrityCheck';
import { getRestorableZeroedMeters } from './rollZeroRestore';
import { FoilRoll, StockCutRecord } from '../types';

const makeRoll = (overrides: Partial<FoilRoll> = {}): FoilRoll => ({
  id: 'roll-default',
  lotNumber: 'VIP36',
  rollNumber: '02',
  width: 850,
  pattern: 'ขาว',
  totalMeters: 1000,
  remainingMeters: 274,
  usedMeters: 726,
  ngMeters: 0,
  status: 'active',
  dateReceived: '2026-11-01',
  createdAt: '2026-11-01T00:00:00.000Z',
  ...overrides,
});

const makeRec = (overrides: Partial<StockCutRecord> = {}): StockCutRecord => ({
  id: 'rec-default',
  foilId: 'roll-850-white',
  lotNumber: 'VIP36',
  rollNumber: '02',
  width: 850,
  pattern: 'ขาว',
  soNumber: 'so6911001',
  usedMeters: 100,
  ngMeters: 0,
  totalDeducted: 100,
  remainingBefore: 1000,
  remainingAfter: 900,
  usageDate: '2026-11-05',
  recordedDate: '2026-11-05',
  recordedBy: 'Tester',
  createdAt: '2026-11-05T10:00:00.000Z',
  cutStatus: 'completed',
  ...overrides,
});

describe('rollIdentity & cross-spec isolation', () => {
  const roll850White = makeRoll({
    id: 'roll-850-white',
    lotNumber: 'VIP36',
    rollNumber: '02',
    width: 850,
    pattern: 'ขาว',
    totalMeters: 726,
    remainingMeters: 0,
    usedMeters: 726,
    status: 'depleted',
  });

  const roll830Lotus = makeRoll({
    id: 'roll-830-lotus',
    lotNumber: 'VIP36',
    rollNumber: '02',
    width: 830,
    pattern: 'กลีบบัว',
    totalMeters: 784.04,
    remainingMeters: 0,
    usedMeters: 784.04,
    status: 'depleted',
  });

  it('keeps strict roll keys distinct when lot and roll match across different width or pattern', () => {
    const keyWhite = buildStrictRollKey(
      roll850White.lotNumber,
      roll850White.rollNumber,
      roll850White.width,
      roll850White.pattern
    );
    const keyLotus = buildStrictRollKey(
      roll830Lotus.lotNumber,
      roll830Lotus.rollNumber,
      roll830Lotus.width,
      roll830Lotus.pattern
    );
    expect(keyWhite).not.toBe(keyLotus);

    const aliasWhiteKey = buildStrictRollKey(' vip36 ', '02', '850', 'ท้องขาว');
    expect(aliasWhiteKey).toBe(keyWhite);
  });

  it('detects explicit width or pattern conflict accurately', () => {
    const recLotusOnWhite = makeRec({
      foilId: roll850White.id,
      width: 830,
      pattern: 'กลีบบัว',
    });
    expect(hasExplicitSpecConflict(roll850White, recLotusOnWhite)).toBe(true);
    expect(isRecordSpecCompatibleWithRoll(roll850White, recLotusOnWhite)).toBe(false);

    const recMissingSpec = makeRec({
      foilId: roll850White.id,
      width: undefined as any,
      pattern: undefined as any,
    });
    expect(hasExplicitSpecConflict(roll850White, recMissingSpec)).toBe(false);
    expect(isRecordSpecCompatibleWithRoll(roll850White, recMissingSpec)).toBe(true);
    expect(
      isRecordSpecCompatibleWithRoll(roll850White, recMissingSpec, { requireBothPresent: true })
    ).toBe(false);
  });

  it('isolates cross-spec records in doesRecordBelongToRoll and finds exact rightful target roll', () => {
    const allRolls = [roll850White, roll830Lotus];
    const knownIds = new Set(allRolls.map((r) => r.id));

    const validWhiteCut = makeRec({
      id: 'rec-w1',
      foilId: roll850White.id,
      width: 850,
      pattern: 'ขาว',
      usedMeters: 726,
      totalDeducted: 726,
      remainingBefore: 726,
      remainingAfter: 0,
    });

    const contaminatedLotusCut = makeRec({
      id: 'rec-l1',
      foilId: roll850White.id, // Hijacked onto 850 white roll!
      lotNumber: 'VIP36',
      rollNumber: '02',
      width: 830,
      pattern: 'กลีบบัว',
      usedMeters: 123.6,
      totalDeducted: 123.6,
    });

    expect(doesRecordBelongToRoll(roll850White, validWhiteCut, knownIds)).toBe(true);
    expect(doesRecordBelongToRoll(roll850White, contaminatedLotusCut, knownIds)).toBe(false);
    // Must not silently hijack while foilId still points to another known live roll
    expect(doesRecordBelongToRoll(roll830Lotus, contaminatedLotusCut, knownIds)).toBe(false);

    const contaminated = findContaminatedRecordsForRoll(roll850White, [
      validWhiteCut,
      contaminatedLotusCut,
    ]);
    expect(contaminated.map((r) => r.id)).toEqual(['rec-l1']);

    const target = findTargetRollForContaminatedRecord(
      allRolls,
      roll850White.id,
      contaminatedLotusCut
    );
    expect(target?.id).toBe(roll830Lotus.id);

    // Orphan fallback only attaches when all 4 spec fields agree
    const orphanLotusCut = makeRec({
      id: 'rec-orphan',
      foilId: '',
      lotNumber: 'VIP36',
      rollNumber: '02',
      width: 830,
      pattern: 'กลีบบัว',
    });
    expect(findMatchingRollForRecord(allRolls, orphanLotusCut)?.id).toBe(roll830Lotus.id);
    expect(doesRecordBelongToRoll(roll850White, orphanLotusCut, knownIds)).toBe(false);
    expect(doesRecordBelongToRoll(roll830Lotus, orphanLotusCut, knownIds)).toBe(true);
  });

  it('quarantines contaminated cuts in auditRollSOHistory, checkStockIntegrity, and getRestorableZeroedMeters', () => {
    const roll = makeRoll({
      id: 'roll-a',
      totalMeters: 1000,
      remainingMeters: 500,
      usedMeters: 500,
      ngMeters: 0,
      isZeroedOut: false,
    });
    const ownRec = makeRec({
      id: 'cut-own',
      foilId: 'roll-a',
      width: 850,
      pattern: 'ขาว',
      usedMeters: 500,
      totalDeducted: 500,
      remainingBefore: 1000,
      remainingAfter: 500,
    });
    const hijackedRec = makeRec({
      id: 'cut-hijack',
      foilId: 'roll-a',
      width: 830,
      pattern: 'กลีบบัว',
      usedMeters: 400,
      totalDeducted: 400,
      remainingBefore: 500,
      remainingAfter: 100,
    });

    const audit = auditRollSOHistory(roll, [ownRec, hijackedRec]);
    expect(audit.contaminatedRecords.map((r) => r.id)).toEqual(['cut-hijack']);
    expect(audit.totalUsedMeters).toBe(500);
    expect(audit.calculatedRemaining).toBe(500);
    expect(audit.canAutoAdjust).toBe(false);
    expect(audit.issues.some((i) => i.type === 'SPEC_MISMATCH_CONTAMINATION')).toBe(true);

    // Integrity check locks auto-adjustment while contaminated records remain
    const [mismatch] = checkStockIntegrity([roll], [ownRec, hijackedRec]);
    expect(mismatch).toBeDefined();
    expect(mismatch.contaminatedCount).toBe(1);
    expect(mismatch.canAutoAdjust).toBe(false);

    // Zero-out restore ignores cross-spec hijacked records when computing fallback remainder
    const zeroedRoll = {
      ...roll,
      isZeroedOut: true,
      remainingMeters: 0,
      manualZeroedOriginalMeters: undefined,
    };
    expect(getRestorableZeroedMeters(zeroedRoll, [ownRec, hijackedRec])).toBe(500);
  });
});
