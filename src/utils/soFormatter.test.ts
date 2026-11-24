import { describe, it, expect } from 'vitest';
import {
  validateStrictSONumber,
  isValidStrictSONumber,
  parseSONumber,
} from './soFormatter';

describe('validateStrictSONumber & isValidStrictSONumber', () => {
  it('accepts valid 2 English letters + 7 digits including so and ed repair orders', () => {
    expect(isValidStrictSONumber('so6911001')).toBe(true);
    expect(isValidStrictSONumber('SO6909500')).toBe(true);
    expect(isValidStrictSONumber('ed6911001')).toBe(true);
    expect(isValidStrictSONumber('ED6909500')).toBe(true);
    expect(isValidStrictSONumber('ab1234567')).toBe(true);
    expect(isValidStrictSONumber('  So6911999  ')).toBe(true);

    const res = validateStrictSONumber('  ed6911001 ');
    expect(res).toEqual({
      isValid: true,
      normalized: 'ed6911001',
      letterCount: 2,
      digitCount: 7,
    });
  });

  it('rejects empty or whitespace-only SO strings', () => {
    const empty = validateStrictSONumber('');
    expect(empty.isValid).toBe(false);
    expect(empty.letterCount).toBe(0);
    expect(empty.digitCount).toBe(0);
    expect(empty.error).toBeTruthy();

    expect(isValidStrictSONumber('   ')).toBe(false);
  });

  it('rejects default incomplete prefixes and short digit counts (< 7 digits)', () => {
    const prefixOnly = validateStrictSONumber('so6911');
    expect(prefixOnly.isValid).toBe(false);
    expect(prefixOnly.letterCount).toBe(2);
    expect(prefixOnly.digitCount).toBe(4);
    expect(prefixOnly.error).toContain('4/7');

    const edIncomplete = validateStrictSONumber('ed6911');
    expect(edIncomplete.isValid).toBe(false);
    expect(edIncomplete.letterCount).toBe(2);
    expect(edIncomplete.digitCount).toBe(4);

    const sixDigits = validateStrictSONumber('so691150');
    expect(sixDigits.isValid).toBe(false);
    expect(sixDigits.digitCount).toBe(6);
    expect(sixDigits.error).toContain('6/7');
  });

  it('rejects excess digits (> 7 digits)', () => {
    const eightDigits = validateStrictSONumber('so69115001');
    expect(eightDigits.isValid).toBe(false);
    expect(eightDigits.digitCount).toBe(8);
    expect(eightDigits.error).toContain('8/7');
  });

  it('rejects wrong letter count (0, 1, or 3+ English letters)', () => {
    const zeroLetters = validateStrictSONumber('6911500');
    expect(zeroLetters.isValid).toBe(false);
    expect(zeroLetters.letterCount).toBe(0);

    const oneLetter = validateStrictSONumber('s6911500');
    expect(oneLetter.isValid).toBe(false);
    expect(oneLetter.letterCount).toBe(1);

    const threeLetters = validateStrictSONumber('soo6911500');
    expect(threeLetters.isValid).toBe(false);
    expect(threeLetters.letterCount).toBe(3);
  });

  it('rejects non-alphanumeric characters, internal spaces, hyphens, or Thai characters', () => {
    expect(isValidStrictSONumber('so-6911001')).toBe(false);
    expect(isValidStrictSONumber('so 6911001')).toBe(false);
    expect(isValidStrictSONumber('สอ6911001')).toBe(false);
    expect(isValidStrictSONumber('so6911a01')).toBe(false);
  });
});

describe('parseSONumber', () => {
  it('parses valid soXXYYZZZ and edXXYYZZZ into components', () => {
    const res = parseSONumber('SO6909500');
    expect(res).toEqual({
      isValid: true,
      components: { yearBE: '69', month: '09', orderNo: '500' },
    });

    const edRes = parseSONumber('ed6911001');
    expect(edRes).toEqual({
      isValid: true,
      components: { yearBE: '69', month: '11', orderNo: '001' },
    });
  });

  it('rejects incomplete or overlong order digits', () => {
    expect(parseSONumber('so6911').isValid).toBe(false);
    expect(parseSONumber('ed6911').isValid).toBe(false);
    expect(parseSONumber('so691101').isValid).toBe(false);
    expect(parseSONumber('so69110001').isValid).toBe(false);
  });
});
