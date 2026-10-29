import { describe, it, expect } from 'vitest';
import { auditRollSOHistory, sortRollRecordsInCutOrder } from './soHistoryAudit';
import { FoilRoll, StockCutRecord } from '../types';

describe('soHistoryAudit - Physical Cut Order and Chain Continuity', () => {
  const mockRoll: FoilRoll = {
    id: 'roll-test-1',
    lotNumber: 'LOT-A1',
    rollNumber: 'R01',
    pattern: '201',
    width: 914,
    totalMeters: 1000,
    remainingMeters: 686.88,
    usedMeters: 307.12,
    ngMeters: 6.0,
    status: 'active',
    isUnused: false,
    dateReceived: '2026-10-20',
    createdAt: '2026-10-20T00:00:00.000Z',
  };

  const createRec = (overrides: Partial<StockCutRecord>): StockCutRecord => ({
    id: 'cut-default',
    foilId: 'roll-test-1',
    lotNumber: 'LOT-A1',
    rollNumber: 'R01',
    pattern: '201',
    width: 914,
    soNumber: 'SO-TEST',
    usedMeters: 0,
    ngMeters: 0,
    totalDeducted: 0,
    remainingBefore: 1000,
    remainingAfter: 1000,
    recordedBy: 'สมชาย',
    recordedDate: '2026-10-27',
    usageDate: '2026-10-27',
    createdAt: '2026-10-27T10:00:00.000Z',
    ...overrides,
  });

  // The exact 4 records from the user's real-world screenshot:
  // In reality:
  // 1st cut: SO 466 (1,000.00 -> 905.80)
  // 2nd cut: SO 472 (905.80 -> 901.80)
  // 3rd cut: SO 462 (901.80 -> 894.80)
  // 4th cut: SO 211 (894.80 -> 686.88) - paper invoice date was 2026-10-21
  const recordsOutOfUsageDateOrder: StockCutRecord[] = [
    createRec({
      id: 'cut-1',
      soNumber: 'so6910211',
      usedMeters: 207.92,
      ngMeters: 0,
      totalDeducted: 207.92,
      remainingBefore: 894.8,
      remainingAfter: 686.88,
      usageDate: '2026-10-21', // Older paper invoice date
      recordedDate: '2026-10-27',
      createdAt: '2026-10-27T10:15:00.000Z',
    }),
    createRec({
      id: 'cut-2',
      soNumber: 'so6910462',
      usedMeters: 7.0,
      ngMeters: 0,
      totalDeducted: 7.0,
      remainingBefore: 901.8,
      remainingAfter: 894.8,
      usageDate: '2026-10-25',
      recordedDate: '2026-10-27',
      createdAt: '2026-10-27T10:10:00.000Z',
    }),
    createRec({
      id: 'cut-3',
      soNumber: 'so6910472',
      usedMeters: 4.0,
      ngMeters: 0,
      totalDeducted: 4.0,
      remainingBefore: 905.8,
      remainingAfter: 901.8,
      usageDate: '2026-10-26',
      recordedDate: '2026-10-27',
      createdAt: '2026-10-27T10:05:00.000Z',
    }),
    createRec({
      id: 'cut-4',
      soNumber: 'so6910466',
      usedMeters: 88.2,
      ngMeters: 6.0,
      totalDeducted: 94.2,
      remainingBefore: 1000.0,
      remainingAfter: 905.8,
      usageDate: '2026-10-27',
      recordedDate: '2026-10-27',
      createdAt: '2026-10-27T10:00:00.000Z',
    }),
  ];

  it('sortRollRecordsInCutOrder correctly sorts by physical roll sequence starting from 1000m down to 686.88m', () => {
    const sorted = sortRollRecordsInCutOrder(recordsOutOfUsageDateOrder, 1000);
    expect(sorted.map((r) => r.soNumber)).toEqual([
      'so6910466',
      'so6910472',
      'so6910462',
      'so6910211',
    ]);
  });

  it('auditRollSOHistory does not report fake METER_JUMP bugs when physical cuts chain continuously', () => {
    const audit = auditRollSOHistory(mockRoll, recordsOutOfUsageDateOrder);

    // Should have 0 meter jump bugs
    const jumpIssues = audit.issues.filter((i) => i.type === 'METER_JUMP');
    expect(jumpIssues).toHaveLength(0);

    // All timeline steps should be chain valid
    expect(audit.timeline).toHaveLength(4);
    audit.timeline.forEach((step) => {
      expect(step.isChainValid).toBe(true);
      expect(Math.abs(step.jumpDiff)).toBeLessThan(0.05);
    });

    // Final calculated remaining should match exactly 686.88m
    expect(audit.calculatedRemaining).toBe(686.88);
  });

  it('sorts batch cuts created in the same second by remainingBefore descending', () => {
    const batchTimestamp = '2026-10-27T12:00:00.000Z';
    const batchRecords: StockCutRecord[] = [
      createRec({
        id: 'cut-batch-3',
        soNumber: 'SO-3',
        usedMeters: 100,
        ngMeters: 0,
        totalDeducted: 100,
        remainingBefore: 700,
        remainingAfter: 600,
        createdAt: batchTimestamp,
      }),
      createRec({
        id: 'cut-batch-1',
        soNumber: 'SO-1',
        usedMeters: 200,
        ngMeters: 0,
        totalDeducted: 200,
        remainingBefore: 1000,
        remainingAfter: 800,
        createdAt: batchTimestamp,
      }),
      createRec({
        id: 'cut-batch-2',
        soNumber: 'SO-2',
        usedMeters: 100,
        ngMeters: 0,
        totalDeducted: 100,
        remainingBefore: 800,
        remainingAfter: 700,
        createdAt: batchTimestamp,
      }),
    ];

    const sorted = sortRollRecordsInCutOrder(batchRecords, 1000);
    expect(sorted.map((r) => r.soNumber)).toEqual(['SO-1', 'SO-2', 'SO-3']);
  });
});
