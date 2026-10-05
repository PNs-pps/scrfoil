import { describe, it, expect } from 'vitest';
import { reconcileBatchRolls, summarizeBatch } from './batchReconcile';
import type { FoilRoll } from '../types';

function roll(id: string): FoilRoll {
  return { id, lotNumber: 'L1', rollNumber: id } as FoilRoll;
}

describe('reconcileBatchRolls', () => {
  const batch = [roll('batch-1'), roll('batch-2'), roll('batch-3')];

  it('removes only the permanently rejected rolls', () => {
    const next = reconcileBatchRolls({
      batch,
      outcomes: ['committed', 'committed', 'rejected'],
      current: [...batch, roll('existing-a')],
    });
    expect(next.map((r) => r.id)).toEqual(['batch-1', 'batch-2', 'existing-a']);
  });

  it('preserves rows pushed by the realtime listener while the batch was in flight', () => {
    // This is the regression: the row arrives on another device mid-batch and the
    // old implementation dropped it by spreading the stale start-of-batch array.
    const arrived = roll('from-other-device');
    const next = reconcileBatchRolls({
      batch,
      outcomes: ['committed', 'committed', 'rejected'],
      current: [...batch, roll('existing-a'), arrived],
    });

    expect(next.map((r) => r.id)).toContain('from-other-device');
    expect(next).toHaveLength(4);
  });

  it('does not resurrect rows deleted elsewhere during the batch', () => {
    const next = reconcileBatchRolls({
      batch,
      outcomes: ['committed', 'rejected', 'rejected'],
      current: [batch[0]],
    });
    expect(next.map((r) => r.id)).toEqual(['batch-1']);
  });

  it('removes the whole batch when every write was rejected', () => {
    const next = reconcileBatchRolls({
      batch,
      outcomes: ['rejected', 'rejected', 'rejected'],
      current: [...batch, roll('existing-a')],
    });
    expect(next.map((r) => r.id)).toEqual(['existing-a']);
  });

  it('keeps queued rolls, because Firestore will still push them', () => {
    const next = reconcileBatchRolls({
      batch,
      outcomes: ['committed', 'queued', 'queued'],
      current: [...batch, roll('existing-a')],
    });
    expect(next.map((r) => r.id)).toEqual([
      'batch-1',
      'batch-2',
      'batch-3',
      'existing-a',
    ]);
  });

  it('returns current state unchanged when no outcomes were supplied', () => {
    const current = [roll('existing-a')];
    expect(reconcileBatchRolls({ batch: [], outcomes: [], current })).toEqual(current);
  });
});

describe('summarizeBatch', () => {
  it('separates committed, queued and rejected rolls', () => {
    const batch = [roll('a'), roll('b'), roll('c'), roll('d')];
    const summary = summarizeBatch(batch, ['committed', 'queued', 'rejected', 'rejected']);

    expect(summary.committed.map((r) => r.id)).toEqual(['a']);
    expect(summary.queued.map((r) => r.id)).toEqual(['b']);
    expect(summary.dropped.map((r) => r.id)).toEqual(['c', 'd']);
  });

  it('ignores outcomes with no matching roll', () => {
    const summary = summarizeBatch([roll('a')], ['committed', 'committed']);
    expect(summary.committed).toHaveLength(1);
  });
});