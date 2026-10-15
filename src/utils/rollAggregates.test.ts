import { describe, it, expect } from 'vitest';
import {
  countableRecords,
  reservedRecords,
  aggregateDeduction,
  reservedMetersOf,
  reservedMetersOfRoll,
} from './rollAggregates';
import type { StockCutRecord } from '../types';

const rec = (o: Partial<StockCutRecord>): StockCutRecord =>
  ({
    id: 'r',
    foilId: 'f1',
    soNumber: 'SO-1',
    usedMeters: 0,
    ngMeters: 0,
    totalDeducted: 0,
    ...o,
  } as StockCutRecord);

describe('countableRecords / reservedRecords', () => {
  it('splits reserved and cancelled out of the countable set', () => {
    const records = [
      rec({ id: 'a', cutStatus: 'completed' }),
      rec({ id: 'b', cutStatus: 'reserved' }),
      rec({ id: 'c', cutStatus: 'cancelled' }),
      rec({ id: 'd' }), // undefined status counts as completed
    ];
    expect(countableRecords(records).map((r) => r.id)).toEqual(['a', 'd']);
    expect(reservedRecords(records).map((r) => r.id)).toEqual(['b']);
  });
});

describe('aggregateDeduction', () => {
  it('excludes reserved/cancelled and keeps the Cycle Count sign', () => {
    const records = [
      rec({ id: 'a', usedMeters: 100, ngMeters: 5, totalDeducted: 105 }),
      rec({ id: 'res', cutStatus: 'reserved', usedMeters: 999, totalDeducted: 999 }),
      rec({ id: 'can', cutStatus: 'cancelled', usedMeters: 888, totalDeducted: 888 }),
      rec({ id: 'cc_1', soNumber: 'นับสต๊อก 2026-10', totalDeducted: -12.5 }),
    ];
    const agg = aggregateDeduction(records);
    expect(agg.count).toBe(2);
    expect(agg.used).toBe(100);
    expect(agg.ng).toBe(5);
    expect(agg.total).toBe(92.5);
  });

  it('falls back to used+ng when totalDeducted is missing', () => {
    const records = [rec({ id: 'a', usedMeters: 10, ngMeters: 2, totalDeducted: undefined as unknown as number })];
    expect(aggregateDeduction(records).total).toBe(12);
  });

  it('returns zeros for an empty list', () => {
    expect(aggregateDeduction([])).toEqual({ total: 0, used: 0, ng: 0, count: 0 });
  });
});

describe('reservedMetersOf', () => {
  it('sums only reserved records as a positive magnitude', () => {
    const records = [
      rec({ id: 'a', cutStatus: 'completed', usedMeters: 100, totalDeducted: 100 }),
      rec({ id: 'b', cutStatus: 'reserved', usedMeters: 30, ngMeters: 5, totalDeducted: 35 }),
      rec({ id: 'c', cutStatus: 'reserved', usedMeters: 10, ngMeters: 0, totalDeducted: undefined as unknown as number }),
    ];
    expect(reservedMetersOf(records)).toBe(45);
  });

  it('ignores cancelled records', () => {
    const records = [rec({ id: 'c', cutStatus: 'cancelled', usedMeters: 50, totalDeducted: 50 })];
    expect(reservedMetersOf(records)).toBe(0);
  });
});

describe('reservedMetersOfRoll', () => {
  it('only counts reservations belonging to the requested roll', () => {
    const records = [
      rec({ id: 'a', foilId: 'f1', cutStatus: 'reserved', usedMeters: 20, totalDeducted: 20 }),
      rec({ id: 'b', foilId: 'f2', cutStatus: 'reserved', usedMeters: 99, totalDeducted: 99 }),
      rec({ id: 'c', foilId: 'f1', cutStatus: 'completed', usedMeters: 40, totalDeducted: 40 }),
    ];
    expect(reservedMetersOfRoll(records, 'f1')).toBe(20);
    expect(reservedMetersOfRoll(records, 'f2')).toBe(99);
  });
});
