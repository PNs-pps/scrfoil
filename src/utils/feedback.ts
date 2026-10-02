/**
 * Audio + haptic feedback for cut / save success and errors.
 * Works in modern browsers; fails silently when unsupported.
 */

type FeedbackKind = 'success' | 'error' | 'info';

let sharedCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    if (!sharedCtx || sharedCtx.state === 'closed') {
      sharedCtx = new AC();
    }
    if (sharedCtx.state === 'suspended') {
      sharedCtx.resume().catch(() => undefined);
    }
    return sharedCtx;
  } catch {
    return null;
  }
}

function beep(freq: number, durationMs: number, volume = 0.18, type: OscillatorType = 'sine') {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = volume;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + durationMs / 1000);
    osc.start(now);
    osc.stop(now + durationMs / 1000 + 0.02);
  } catch {
    // ignore
  }
}

function vibrate(pattern: number | number[]) {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  } catch {
    // ignore
  }
}

/** Success: two short high beeps + light double vibration */
export function playSuccessFeedback() {
  beep(880, 80, 0.16, 'sine');
  setTimeout(() => beep(1175, 90, 0.14, 'sine'), 110);
  vibrate([40, 40, 40]);
}

/** Error: low tone + longer vibration */
export function playErrorFeedback() {
  beep(220, 280, 0.2, 'triangle');
  setTimeout(() => beep(180, 220, 0.16, 'triangle'), 160);
  vibrate([120, 60, 180]);
}

/** Soft info tick */
export function playInfoFeedback() {
  beep(660, 60, 0.1, 'sine');
  vibrate(25);
}

export function playFeedback(kind: FeedbackKind) {
  if (kind === 'success') playSuccessFeedback();
  else if (kind === 'error') playErrorFeedback();
  else playInfoFeedback();
}
