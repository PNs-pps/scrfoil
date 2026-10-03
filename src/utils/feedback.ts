/**
 * Haptic + short audio feedback for factory floor (success / error).
 * Safe no-ops when browser blocks AudioContext or vibration.
 */

type ToneKind = 'success' | 'error' | 'info';

let sharedCtx: AudioContext | null = null;

function getAudioCtx(): AudioContext | null {
  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    if (!sharedCtx || sharedCtx.state === 'closed') {
      sharedCtx = new AC();
    }
    if (sharedCtx.state === 'suspended') {
      sharedCtx.resume().catch(() => {});
    }
    return sharedCtx;
  } catch {
    return null;
  }
}

function beep(freq: number, durationMs: number, volume = 0.18, type: OscillatorType = 'sine') {
  const ctx = getAudioCtx();
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
    /* ignore */
  }
}

export function vibrateSuccess() {
  try {
    if (navigator.vibrate) navigator.vibrate([40, 40, 60]);
  } catch {
    /* ignore */
  }
}

export function vibrateError() {
  try {
    if (navigator.vibrate) navigator.vibrate([80, 50, 80, 50, 120]);
  } catch {
    /* ignore */
  }
}

export function playSuccessBeep() {
  beep(880, 90, 0.16, 'sine');
  setTimeout(() => beep(1175, 140, 0.14, 'sine'), 95);
}

export function playErrorBeep() {
  beep(220, 160, 0.2, 'square');
  setTimeout(() => beep(165, 220, 0.18, 'square'), 140);
}

export function notifySuccess() {
  vibrateSuccess();
  playSuccessBeep();
}

export function notifyError() {
  vibrateError();
  playErrorBeep();
}

export function notifyByKind(kind: ToneKind) {
  if (kind === 'success') notifySuccess();
  else if (kind === 'error') notifyError();
}
