import { describe, it, expect } from 'vitest';
import {
  enqueuePendingRecordEdit,
  loadPendingRecordEdits,
  removePendingRecordEdit,
  notePendingRecordEditAttempt,
  getPendingRecordEditIds,
  getPendingRecordEditRollIds,
} from './pendingRecordEditQueue';
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

const rec = (id: string, foilId = 'f1'): StockCutRecord =>
  ({ id, foilId, usedMeters: 5 } as StockCutRecord);
const roll = (id: string): FoilRoll => ({ id, remainingMeters: 10 } as FoilRoll);

describe('pendingRecordEditQueue', () => {
  it('persists an edit and reloads it', () => {
    const s = fakeStorage();
    expect(
      enqueuePendingRecordEdit({ record: rec('r1'), roll: roll('f1') }, new Error('offline'), s)
    ).toBe(true);
    const list = loadPendingRecordEdits(s);
    expect(list).toHaveLength(1);
    expect(list[0].recordId).toBe('r1');
    expect(list[0].record.usedMeters).toBe(5);
    expect(list[0].roll?.id).toBe('f1');
  });

  it('re-editing the same record keeps only the newest copy', () => {
    const s = fakeStorage();
    enqueuePendingRecordEdit({ record: rec('r1') }, undefined, s);
    enqueuePendingRecordEdit(
      { record: { ...rec('r1'), usedMeters: 9 } as StockCutRecord },
      undefined,
      s
    );
    const list = loadPendingRecordEdits(s);
    expect(list).toHaveLength(1);
    expect(list[0].record.usedMeters).toBe(9);
  });

  it('removes and counts attempts by recordId', () => {
    const s = fakeStorage();
    enqueuePendingRecordEdit({ record: rec('r1') }, undefined, s);
    enqueuePendingRecordEdit({ record: rec('r2', 'f2') }, undefined, s);
    notePendingRecordEditAttempt('r1', new Error('still offline'), s);
    expect(loadPendingRecordEdits(s).find((e) => e.recordId === 'r1')?.attempts).toBe(2);
    removePendingRecordEdit('r1', s);
    expect(loadPendingRecordEdits(s).map((e) => e.recordId)).toEqual(['r2']);
  });

  it('exposes record and roll ids for the realtime-merge guard', () => {
    const s = fakeStorage();
    enqueuePendingRecordEdit({ record: rec('r1', 'f1') }, undefined, s);
    expect(Array.from(getPendingRecordEditIds(s))).toEqual(['r1']);
    expect(Array.from(getPendingRecordEditRollIds(s)).sort()).toEqual(['f1']);
  });

  it('reports failure to persist so the caller can refuse the edit', () => {
    const full = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    expect(enqueuePendingRecordEdit({ record: rec('r1') }, undefined, full)).toBe(false);
  });

  it('survives corrupt storage', () => {
    expect(loadPendingRecordEdits(fakeStorage('{not json'))).toEqual([]);
    expect(loadPendingRecordEdits(fakeStorage('{"a":1}'))).toEqual([]);
  });
});
