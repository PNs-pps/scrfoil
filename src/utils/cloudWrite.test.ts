import { describe, it, expect, vi, beforeEach } from 'vitest';
import { classifyWriteError, trackCloudWrite, describeWriteFailure } from './cloudWrite';

function firebaseError(code: string, message = code) {
  return Object.assign(new Error(message), { code });
}

describe('classifyWriteError', () => {
  it('treats permission-denied as terminal so the caller rolls back', () => {
    expect(classifyWriteError(firebaseError('permission-denied'))).toMatchObject({
      kind: 'rejected',
      reason: 'permission',
    });
  });

  it('treats the rule-shaped code with no useful code as terminal', () => {
    expect(
      classifyWriteError(
        firebaseError('missing-or-insufficient-permissions', 'Missing or insufficient permissions.')
      )
    ).toMatchObject({ kind: 'rejected', reason: 'rules' });
  });

  it('treats unavailable and network errors as still queued', () => {
    expect(classifyWriteError(firebaseError('unavailable')).kind).toBe('queued');
    expect(classifyWriteError(new Error('Failed to fetch')).kind).toBe('queued');
  });

  it('treats other terminal codes as rejected', () => {
    expect(classifyWriteError(firebaseError('invalid-argument')).kind).toBe('rejected');
  });
});

describe('trackCloudWrite', () => {
  it('reports committed once Firestore acknowledges', async () => {
    const outcome = await trackCloudWrite(Promise.resolve(undefined), 50);
    expect(outcome.kind).toBe('committed');
  });

  it('reports rejected when the write fails permanently', async () => {
    const outcome = await trackCloudWrite(
      Promise.reject(firebaseError('permission-denied')),
      50
    );
    expect(outcome.kind).toBe('rejected');
  });

  it('reports queued for a write that is still pending, rather than hanging', async () => {
    // Never settles: this is what an offline write looks like to the caller.
    const pending = new Promise<void>(() => {});
    const outcome = await trackCloudWrite(pending, 20);
    expect(outcome.kind).toBe('queued');
  });

  it('does not wait out the grace period for a write that resolves quickly', async () => {
    vi.useFakeTimers();
    let settled = false;
    const p = Promise.resolve().then(() => {
      settled = true;
    });
    const promise = trackCloudWrite(p, 10_000);
    await vi.runAllTimersAsync();
    const outcome = await promise;
    expect(outcome.kind).toBe('committed');
    expect(settled).toBe(true);
    vi.useRealTimers();
  });
});

describe('trackCloudWrite late rejection', () => {
  it('delivers a rejection that arrives after the write was reported queued', async () => {
    let rejectLater: (e: unknown) => void = () => {};
    const write = new Promise<void>((_, reject) => {
      rejectLater = reject;
    });
    const late = vi.fn();
    const outcome = await trackCloudWrite(write, 10, late);
    expect(outcome.kind).toBe('queued');
    expect(late).not.toHaveBeenCalled();

    rejectLater(firebaseError('permission-denied'));
    await new Promise((r) => setTimeout(r, 0));
    expect(late).toHaveBeenCalledTimes(1);
    expect(late.mock.calls[0][0].kind).toBe('rejected');
  });

  it('does not call the late handler for a rejection already returned to the caller', async () => {
    const late = vi.fn();
    const outcome = await trackCloudWrite(
      Promise.reject(firebaseError('permission-denied')),
      50,
      late
    );
    expect(outcome.kind).toBe('rejected');
    await new Promise((r) => setTimeout(r, 0));
    expect(late).not.toHaveBeenCalled();
  });

  it('does not call the late handler when a queued write later commits', async () => {
    let resolveLater: () => void = () => {};
    const write = new Promise<void>((resolve) => {
      resolveLater = resolve;
    });
    const late = vi.fn();
    await trackCloudWrite(write, 10, late);
    resolveLater();
    await new Promise((r) => setTimeout(r, 0));
    expect(late).not.toHaveBeenCalled();
  });
});

describe('describeWriteFailure', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('states that the local edit was reverted', () => {
    const message = describeWriteFailure({ kind: 'rejected', reason: 'permission' });
    expect(message).toContain('ยกเลิกการแก้ไขในเครื่องแล้ว');
  });
});