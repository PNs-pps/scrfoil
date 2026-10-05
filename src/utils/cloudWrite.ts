/**
 * Distinguishing "this write is still queued" from "this write will never land"
 * matters because the two need opposite local-state handling.
 *
 * Firestore's web SDK keeps its own durable outbox when offline persistence is
 * enabled (see `initializeFirestore` in `src/lib/firebase.ts`):
 *
 *   - offline / transient failure -> the write sits in that outbox and the
 *     promise stays **pending** until the server acknowledges it. Firestore never
 *     rejects, so there is nothing for us to retry and nothing was lost.
 *   - `permission-denied` -> the write is **terminal**. Firestore does not retry
 *     it and no cache will ever push it. Keeping the local copy and telling the
 *     operator it is "waiting to sync" would describe something that will never
 *     happen, so the caller has to roll the local change back.
 *
 * The timeout exists because a pending promise gives no signal at all. Without it
 * an offline write leaves the operator with a spinner and no message.
 */

/** Firestore error codes that will never succeed on retry. */
const TERMINAL_FIRESTORE_CODES = new Set([
  'permission-denied',
  'unauthenticated',
  'invalid-argument',
  'failed-precondition',
  'out-of-range',
  'unimplemented',
]);

export type CloudWriteOutcome =
  /** Firestore acknowledged the write. Safe to treat as saved. */
  | { kind: 'committed' }
  /** Still in flight after the grace period — queued locally, not yet on Cloud. */
  | { kind: 'queued' }
  /** Rejected permanently; the write is gone and must be rolled back locally. */
  | { kind: 'rejected'; reason: 'permission' | 'rules' | 'unknown'; message?: string };

/**
 * How long to wait before reporting a still-pending write as `queued`.
 * Long enough that a slow-but-online write is not misreported as queued, short
 * enough that an operator is not left without feedback.
 */
export const PENDING_WRITE_GRACE_MS = 6000;

export function classifyWriteError(err: any): CloudWriteOutcome {
  const code: string | undefined = err?.code;
  const message: string | undefined = err?.message;

  // Rule-shaped failures do not always carry a usable code (for example when the
  // error surfaces as a plain object from a batch listener), but they are still
  // terminal, so they must not be reported as "waiting to sync".
  //
  // Checked before the generic permission test below: its message contains the
  // word "permissions", so testing for "permission" first would classify every
  // rule failure as a plain auth failure.
  if (
    code === 'missing-or-insufficient-permissions' ||
    code === 'failed-precondition' ||
    message?.includes('Missing or insufficient permissions')
  ) {
    return { kind: 'rejected', reason: 'rules', message };
  }

  if (code === 'permission-denied' || message?.includes('permission')) {
    return { kind: 'rejected', reason: 'permission', message };
  }

  if (code && TERMINAL_FIRESTORE_CODES.has(code)) {
    return { kind: 'rejected', reason: 'unknown', message };
  }

  // 'unavailable', 'deadline-exceeded', network errors: Firestore's own retry
  // owns these, so treat as still queued.
  return { kind: 'queued', ...(message ? { message } : {}) } as CloudWriteOutcome;
}

/**
 * Await a Firestore write and classify the result, reporting `queued` if it has
 * still not settled after `graceMs`.
 */
export async function trackCloudWrite(
  write: Promise<unknown>,
  graceMs: number = PENDING_WRITE_GRACE_MS
): Promise<CloudWriteOutcome> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const queued = new Promise<CloudWriteOutcome>((resolve) => {
    timer = setTimeout(() => resolve({ kind: 'queued' }), graceMs);
  });

  try {
    return await Promise.race<CloudWriteOutcome>([
      write.then(
        (): CloudWriteOutcome => ({ kind: 'committed' }),
        (err) => classifyWriteError(err)
      ),
      queued,
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Operator-facing explanation for a write that was not committed. */
export function describeWriteFailure(
  outcome: Extract<CloudWriteOutcome, { kind: 'rejected' }>
): string {
  switch (outcome.reason) {
    case 'permission':
      return 'ไม่มีสิทธิ์เขียนลง Cloud (Firestore Rules) — ยกเลิกการแก้ไขในเครื่องแล้ว';
    case 'rules':
      return 'Firestore Rules ไม่อนุญาตการเขียน — ยกเลิกการแก้ไขในเครื่องแล้ว';
    default:
      return 'บันทึกลง Cloud ไม่สำเร็จ — ยกเลิกการแก้ไขในเครื่องแล้ว';
  }
}