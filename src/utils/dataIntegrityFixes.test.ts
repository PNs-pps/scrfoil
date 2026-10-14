import { describe, it, expect } from 'vitest';
import { getPendingCutRollIds, enqueuePendingCut } from './pendingCutQueue';
import { parseAndValidateBackupJSON } from './autoBackup';
import { groupCutsByDate, groupRollsByDateReceived } from './dateGrouping';
import type { FoilRoll, StockCutRecord } from '../types';

function fakeStorage(initial?: string) {
  let v: string | null = initial ?? null;
  return {
    getItem: () => v,
    setItem: (_k: string, val: string) => {
      v = val;
    },
  };
}

const rec = (o: Partial<StockCutRecord>): StockCutRecord =>
  ({ id: 'r', foilId: 'f1', soNumber: 'SO-1', usedMeters: 0, ngMeters: 0, totalDeducted: 0, ...o } as StockCutRecord);

describe('getPendingCutRollIds', () => {
  it('collects every distinct rollId referenced by queued records', () => {
    const s = fakeStorage();
    enqueuePendingCut([rec({ id: 'a', foilId: 'f1' }), rec({ id: 'b', foilId: 'f2' })], undefined, s);
    enqueuePendingCut([rec({ id: 'c', foilId: 'f1' })], undefined, s);
    expect(getPendingCutRollIds(s)).toEqual(new Set(['f1', 'f2']));
  });

  it('returns an empty set when the queue is empty or corrupt', () => {
    expect(getPendingCutRollIds(fakeStorage())).toEqual(new Set());
    expect(getPendingCutRollIds(fakeStorage('{not json'))).toEqual(new Set());
  });
});

describe('parseAndValidateBackupJSON', () => {
  it('keeps records without a numeric totalDeducted and normalizes the total', () => {
    const content = JSON.stringify({
      records: [
        { id: 'a', soNumber: 'SO-1', usedMeters: 10, ngMeters: 2 },
        { id: 'b', soNumber: 'SO-2', usedMeters: '5', ngMeters: null, totalDeducted: 5 },
      ],
    });
    const result = parseAndValidateBackupJSON(content);
    expect(result.records).toHaveLength(2);
    expect(result.records[0].totalDeducted).toBe(12);
    expect(result.records[0].usedMeters).toBe(10);
    expect(result.records[0].ngMeters).toBe(2);
    expect(result.records[1].totalDeducted).toBe(5);
    expect(result.totalRecords).toBe(2);
    expect(result.coercedRecords).toBe(1);
  });

  it('drops only entries without a string soNumber', () => {
    const content = JSON.stringify({
      records: [{ id: 'a' }, { id: 'b', soNumber: 'SO-2' }],
    });
    const result = parseAndValidateBackupJSON(content);
    expect(result.records.map((r) => r.id)).toEqual(['b']);
    expect(result.totalRecords).toBe(2);
  });

  it('keeps rolls without remainingMeters and derives it from totalMeters', () => {
    const content = JSON.stringify({
      rolls: [
        { id: 'r1', lotNumber: 'L1', totalMeters: 100 },
        { id: 'r2', lotNumber: 'L2', totalMeters: 50, remainingMeters: 30 },
        { id: 'r3', totalMeters: 10 },
      ],
    });
    const result = parseAndValidateBackupJSON(content);
    expect(result.rolls.map((r) => r.id)).toEqual(['r1', 'r2']);
    expect(result.rolls[0].remainingMeters).toBe(100);
    expect(result.rolls[0].totalMeters).toBe(100);
    expect(result.rolls[1].remainingMeters).toBe(30);
    expect(result.totalRolls).toBe(3);
    expect(result.coercedRolls).toBe(1);
  });

  it('accepts the nested data payload and stays backward compatible', () => {
    const content = JSON.stringify({
      data: { rolls: [{ id: 'r1', lotNumber: 'L1', totalMeters: 10 }], records: [] },
    });
    const result = parseAndValidateBackupJSON(content);
    expect(result.rolls).toHaveLength(1);
    expect(result.records).toHaveLength(0);
  });
});

describe('groupCutsByDate', () => {
  const date = '2026-10-10';

  it('excludes reserved/cancelled from totals but still lists every record', () => {
    const records = [
      rec({ id: 'a', usageDate: date, usedMeters: 100, ngMeters: 5, totalDeducted: 105 }),
      rec({ id: 'res', usageDate: date, cutStatus: 'reserved', usedMeters: 999, totalDeducted: 999 }),
      rec({ id: 'can', usageDate: date, cutStatus: 'cancelled', usedMeters: 888, totalDeducted: 888 }),
    ];
    const [group] = groupCutsByDate(records);
    expect(group.records).toHaveLength(3);
    expect(group.totalUsedMeters).toBe(100);
    expect(group.totalNgMeters).toBe(5);
    expect(group.totalDeductedMeters).toBe(105);
  });

  it('keeps the sign of Cycle Count returns in totalDeductedMeters', () => {
    const records = [
      rec({ id: 'a', soNumber: 'SO-1', usageDate: date, usedMeters: 100, ngMeters: 5, totalDeducted: 105 }),
      rec({ id: 'cc_1', soNumber: 'นับสต๊อก 2026-10', usageDate: date, totalDeducted: -12.5 }),
    ];
    const [group] = groupCutsByDate(records);
    expect(group.totalDeductedMeters).toBe(92.5);
    expect(group.totalUsedMeters).toBe(100);
  });
});

describe('groupRollsByDateReceived', () => {
  it('does not produce NaN when totalMeters is missing', () => {
    const rolls = [
      { id: 'r1', lotNumber: 'L1', dateReceived: '2026-10-10', totalMeters: 100 } as FoilRoll,
      { id: 'r2', lotNumber: 'L2', dateReceived: '2026-10-10' } as FoilRoll,
    ];
    const [group] = groupRollsByDateReceived(rolls);
    expect(group.totalMeters).toBe(100);
  });
});
