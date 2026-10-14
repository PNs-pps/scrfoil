import { describe, it, expect } from 'vitest';
import {
  enqueuePendingCut,
  loadPendingCuts,
  removePendingCut,
  notePendingCutAttempt,
  classifyCutFailure,
} from './pendingCutQueue';
import type { StockCutRecord } from '../types';

function fakeStorage(initial?: string) {
  let v: string | null = initial ?? null;
  return {
    getItem: () => v,
    setItem: (_k: string, val: string) => {
      v = val;
    },
  };
}

const rec = (id: string): StockCutRecord => ({ id, foilId: 'f1', totalDeducted: 5 } as StockCutRecord);

describe('pendingCutQueue', () => {
  it('persists a batch and reloads it', () => {
    const s = fakeStorage();
    expect(enqueuePendingCut([rec('a'), rec('b')], new Error('offline'), s)).toBe(true);
    const list = loadPendingCuts(s);
    expect(list).toHaveLength(1);
    expect(list[0].queueId).toBe('a');
    expect(list[0].records.map((r) => r.id)).toEqual(['a', 'b']);
  });

  it('does not duplicate the same batch', () => {
    const s = fakeStorage();
    enqueuePendingCut([rec('a')], undefined, s);
    enqueuePendingCut([rec('a')], undefined, s);
    expect(loadPendingCuts(s)).toHaveLength(1);
  });

  it('removes a batch and counts attempts', () => {
    const s = fakeStorage();
    enqueuePendingCut([rec('a')], undefined, s);
    enqueuePendingCut([rec('c')], undefined, s);
    notePendingCutAttempt('a', new Error('still offline'), s);
    expect(loadPendingCuts(s).find((e) => e.queueId === 'a')?.attempts).toBe(2);
    removePendingCut('a', s);
    expect(loadPendingCuts(s).map((e) => e.queueId)).toEqual(['c']);
  });

  it('reports failure to persist so the caller can refuse the cut', () => {
    const full = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    expect(enqueuePendingCut([rec('a')], undefined, full)).toBe(false);
  });

  it('survives corrupt storage', () => {
    expect(loadPendingCuts(fakeStorage('{not json'))).toEqual([]);
    expect(loadPendingCuts(fakeStorage('{"a":1}'))).toEqual([]);
  });
});

describe('classifyCutFailure', () => {
  it('shortage is never retried', () => {
    expect(classifyCutFailure(new Error('สต๊อกไม่พอ! เหลือ 3 ม.'))).toBe('shortage');
  });
  it('offline/unavailable is retried', () => {
    expect(classifyCutFailure({ code: 'unavailable', message: 'x' })).toBe('retry');
    expect(classifyCutFailure({ message: 'Failed to get document because the client is offline.' })).toBe('retry');
  });
  it('permission and rule errors are terminal', () => {
    expect(classifyCutFailure({ code: 'permission-denied', message: 'x' })).toBe('terminal');
    expect(classifyCutFailure({ code: 'failed-precondition', message: 'x' })).toBe('terminal');
  });
  it('unrecognised errors (e.g. our own bugs) are terminal, not silently queued', () => {
    expect(classifyCutFailure(new TypeError('x is undefined'))).toBe('terminal');
  });
});
