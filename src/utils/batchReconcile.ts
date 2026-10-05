import type { FoilRoll } from '../types';

/**
 * Batch-import reconciliation.
 *
 * The rule this encodes: after a batch of Firestore writes finishes, the only
 * rolls that may be removed from local state are the ones whose write was
 * rejected permanently. Everything else must be derived from the *current* state,
 * not from the array captured when the batch started.
 *
 * That distinction is the whole point. A batch costs one network round trip per
 * roll, so the start-of-batch array is stale by the time it finishes. The original
 * implementation spread that stale array back over state, which silently
 * discarded any row the realtime listener had delivered in the meantime — both in
 * memory and in localStorage.
 */

export type BatchWriteOutcome = 'committed' | 'queued' | 'rejected';

export interface BatchReconcileInput {
  /** Rolls created by this batch, in write order. */
  batch: FoilRoll[];
  /** Per-roll outcome, positionally aligned with `batch`. */
  outcomes: BatchWriteOutcome[];
  /** Current state, which may already include rows from other devices. */
  current: FoilRoll[];
}

/** Remove only the permanently-rejected rolls from current state. */
export function reconcileBatchRolls({ batch, outcomes, current }: BatchReconcileInput): FoilRoll[] {
  const rejected = new Set<string>();
  outcomes.forEach((outcome, i) => {
    if (outcome === 'rejected' && batch[i]) rejected.add(batch[i].id);
  });
  return current.filter((r) => !rejected.has(r.id));
}

export interface BatchSummary {
  committed: FoilRoll[];
  /** Still in Firestore's durable outbox; must not be described as failures. */
  queued: FoilRoll[];
  /** Never reached Cloud and will not retry; must be removed locally. */
  dropped: FoilRoll[];
}

export function summarizeBatch(
  batch: FoilRoll[],
  outcomes: BatchWriteOutcome[]
): BatchSummary {
  const summary: BatchSummary = { committed: [], queued: [], dropped: [] };
  outcomes.forEach((outcome, i) => {
    const target = batch[i];
    if (!target) return;
    if (outcome === 'committed') summary.committed.push(target);
    else if (outcome === 'queued') summary.queued.push(target);
    else summary.dropped.push(target);
  });
  return summary;
}