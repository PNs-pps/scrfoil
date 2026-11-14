import { describe, it, expect } from 'vitest';
import {
  findMatchingRollForRecord,
  doesRecordBelongToRoll,
  findContaminatedRecordsForRoll,
  findTargetRollForContaminatedRecord,
  isRecordSpecCompatibleWithRoll,
} from './rollIdentity';
import { checkStockIntegrity } from './integrityCheck';
import { auditRollSOHistory } from './soHistoryAudit';
import type { FoilRoll, StockCutRecord } from '../types';

const makeRoll = (overrides: Partial<FoilRoll>): FoilRoll => ({
  id: 'roll-default',
  lotNumber: 'VIP36',
  rollNumber: '02',
  width: 830,
  pattern: 'กลีบบัว',
  totalMeters: 1000,
  remainingMeters: 1000,
  usedMeters: 0,
  ngMeters: 0,
  dateReceived: '2026-10-10',
  status: 'active',
  createdAt: '2026-10-10T00:00:00.000Z',
  ...overrides,
});

const makeCut = (overrides: Partial<StockCutRecord>): StockCutRecord => ({
  id: 'cut-default',
  foilId: 'roll-830',
  lotNumber: 'VIP36',
  rollNumber: '02',
  width: 830,
  pattern: 'กลีบบัว',
  soNumber: 'so6911187',
  usedMeters: 10,
  ngMeters: 0,
  totalDeducted: 10,
  remainingBefore: 1000,
  remainingAfter: 990,
  usageDate: '2026-11-10',
  recordedDate: '2026-11-10',
  recordedBy: 'นอต',
  createdAt: '2026-11-10T10:00:00.000Z',
  ...overrides,
});

describe('rollIdentity - Strict isolation across width and pattern', () => {
  const roll830 = makeRoll({
    id: 'roll-830',
    lotNumber: 'VIP36',
    rollNumber: '02',
    width: 830,
    pattern: 'กลีบบัว',
    totalMeters: 1000,
    remainingMeters: 983.14,
  });

  const roll850 = makeRoll({
    id: 'roll-850',
    lotNumber: 'VIP36',
    rollNumber: '02',
    width: 850,
    pattern: 'ขาว',
    totalMeters: 1000,
    remainingMeters: 948.3,
  });

  it('never mixes cuts sharing lotNumber + rollNumber across different widths and patterns', () => {
    const cut830 = makeCut({
      id: 'cut-830',
      foilId: 'roll-830',
      width: 830,
      pattern: 'กลีบบัว',
      soNumber: 'so6911187',
      usedMeters: 16.86,
      totalDeducted: 16.86,
      remainingBefore: 1000,
      remainingAfter: 983.14,
    });

    const cut850 = makeCut({
      id: 'cut-850',
      foilId: 'roll-850',
      width: 850,
      pattern: 'ขาว',
      soNumber: 'so6911118',
      usedMeters: 51.7,
      totalDeducted: 51.7,
      remainingBefore: 1000,
      remainingAfter: 948.3,
    });

    const knownIds = new Set([roll830.id, roll850.id]);
    expect(doesRecordBelongToRoll(roll830, cut830, knownIds)).toBe(true);
    expect(doesRecordBelongToRoll(roll830, cut850, knownIds)).toBe(false);
    expect(doesRecordBelongToRoll(roll850, cut850, knownIds)).toBe(true);
    expect(doesRecordBelongToRoll(roll850, cut830, knownIds)).toBe(false);

    expect(findMatchingRollForRecord([roll830, roll850], cut830)?.id).toBe('roll-830');
    expect(findMatchingRollForRecord([roll830, roll850], cut850)?.id).toBe('roll-850');

    const integrity = checkStockIntegrity([roll830, roll850], [cut830, cut850]);
    expect(integrity).toHaveLength(0);
  });

  it('matches ท้องขาว and ขาว via normalizePatternForMatch cleanly', () => {
    const recShort = makeCut({ width: 850, pattern: 'ขาว' });
    const recLong = makeCut({ width: 850, pattern: 'ท้องขาว' });
    expect(isRecordSpecCompatibleWithRoll(roll850, recShort, { requireBothPresent: true })).toBe(true);
    expect(isRecordSpecCompatibleWithRoll(roll850, recLong, { requireBothPresent: true })).toBe(true);
    expect(isRecordSpecCompatibleWithRoll(roll830, recShort)).toBe(false);
  });

  it('quarantines cross-spec contaminated cuts and resolves their rightful roll', () => {
    // Cut belonging to 850 ขาว accidentally carries foilId of 830 กลีบบัว
    const contaminatedCut = makeCut({
      id: 'cut-wrong-id',
      foilId: 'roll-830',
      lotNumber: 'VIP36',
      rollNumber: '02',
      width: 850,
      pattern: 'ขาว',
      soNumber: 'so6911118',
      usedMeters: 51.7,
      totalDeducted: 51.7,
    });
    const legitCut830 = makeCut({
      id: 'cut-legit-830',
      foilId: 'roll-830',
      width: 830,
      pattern: 'กลีบบัว',
      soNumber: 'so6911187',
      usedMeters: 16.86,
      totalDeducted: 16.86,
      remainingBefore: 1000,
      remainingAfter: 983.14,
    });

    const contaminated = findContaminatedRecordsForRoll(roll830, [legitCut830, contaminatedCut]);
    expect(contaminated.map((r) => r.id)).toEqual(['cut-wrong-id']);

    const target = findTargetRollForContaminatedRecord([roll830, roll850], roll830.id, contaminatedCut);
    expect(target?.id).toBe('roll-850');

    const audit = auditRollSOHistory(roll830, [legitCut830, contaminatedCut]);
    expect(audit.contaminatedRecords).toHaveLength(1);
    expect(audit.issues.some((i) => i.type === 'SPEC_MISMATCH_CONTAMINATION')).toBe(true);
    // Excluded from deduction and locked from auto-adjust until separated
    expect(audit.calculatedRemaining).toBe(983.14);
    expect(audit.canAutoAdjust).toBe(false);

    const integrity = checkStockIntegrity([roll830, roll850], [legitCut830, contaminatedCut]);
    const item830 = integrity.find((m) => m.rollId === 'roll-830');
    expect(item830?.contaminatedCount).toBe(1);
    expect(item830?.canAutoAdjust).toBe(false);
  });
});

describe('Zero-Lock & Negative-Balance Safety Guards', () => {
  it('blocks auto-adjust when a roll still has leftover scrap (> 0) and computed remaining <= 0', () => {
    const scrapRoll = makeRoll({
      id: 'roll-scrap',
      lotNumber: 'VIP36',
      rollNumber: '02',
      width: 830,
      pattern: 'กลีบบัว',
      totalMeters: 1000,
      remainingMeters: 2.34,
      isZeroedOut: false,
      status: 'active',
    });

    const overDeductedCuts = [
      makeCut({
        id: 'c1',
        foilId: 'roll-scrap',
        usedMeters: 997.66,
        totalDeducted: 997.66,
        remainingBefore: 1000,
        remainingAfter: 2.34,
      }),
      makeCut({
        id: 'c2',
        foilId: 'roll-scrap',
        soNumber: 'ตัวอย่าง',
        usedMeters: 1,
        ngMeters: 6,
        totalDeducted: 7,
        remainingBefore: -264.66,
        remainingAfter: -271.66,
      }),
    ];

    const audit = auditRollSOHistory(scrapRoll, overDeductedCuts);
    expect(audit.calculatedRemaining).toBe(-4.66);
    expect(audit.zeroLockBlocked).toBe(true);
    expect(audit.canAutoAdjust).toBe(false);
    expect(audit.issues.some((i) => i.type === 'NEGATIVE_VALUE')).toBe(true);

    const integrity = checkStockIntegrity([scrapRoll], overDeductedCuts);
    expect(integrity).toHaveLength(1);
    expect(integrity[0].zeroLockBlocked).toBe(true);
    expect(integrity[0].canAutoAdjust).toBe(false);
  });
});
