import { describe, it, expect } from 'vitest';
import { checkStockIntegrity, summarizeRollDeduction } from './integrityCheck';
import type { FoilRoll, StockCutRecord } from '../types';

const rec = (o: Partial<StockCutRecord>): StockCutRecord =>
  ({ id: 'r', foilId: 'f1', usedMeters: 0, ngMeters: 0, totalDeducted: 0, ...o } as StockCutRecord);

describe('summarizeRollDeduction', () => {
  const records = [
    rec({ id: 'a', usedMeters: 100, ngMeters: 5, totalDeducted: 105 }),
    rec({ id: 'b', usedMeters: 50, totalDeducted: 50 }),
    rec({ id: 'cc_1', soNumber: 'นับสต๊อก 2026-10', totalDeducted: -12.5 }),
    rec({ id: 'res', cutStatus: 'reserved', usedMeters: 999, totalDeducted: 999 }),
    rec({ id: 'can', cutStatus: 'cancelled', usedMeters: 888, totalDeducted: 888 }),
  ];

  it('skips reserved/cancelled and keeps the sign of Cycle Count returns', () => {
    const s = summarizeRollDeduction(records);
    expect(s.total).toBe(142.5);
    expect(s.used).toBe(150);
    expect(s.ng).toBe(5);
    expect(s.count).toBe(3);
  });

  it('agrees with checkStockIntegrity so a repair matches what the check reports', () => {
    const roll = { id: 'f1', totalMeters: 1000, remainingMeters: 1000, lotNumber: 'L', rollNumber: '1' } as FoilRoll;
    const [m] = checkStockIntegrity([roll], records);
    const s = summarizeRollDeduction(records);
    expect(m.expectedRemaining).toBe(1000 - s.total);
    expect(m.sumUsedMeters).toBe(s.used);
    expect(m.sumNgMeters).toBe(s.ng);
  });
});
