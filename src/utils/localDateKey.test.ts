import { describe, it, expect } from 'vitest';
import { localDateKey, todayLocalISO } from './formatters';

describe('localDateKey', () => {
  it('keeps date-only values unchanged', () => {
    expect(localDateKey('2026-10-14')).toBe('2026-10-14');
  });
  it('converts a timestamp to the device-local calendar date, not the UTC one', () => {
    const d = new Date(2026, 9, 14, 2, 0, 0); // 02:00 local on Oct 14
    expect(localDateKey(d.toISOString())).toBe('2026-10-14');
    expect(localDateKey(d.toISOString())).toBe(todayLocalISO(d));
  });
  it('returns empty for missing input', () => {
    expect(localDateKey(undefined)).toBe('');
    expect(localDateKey('')).toBe('');
  });
});
