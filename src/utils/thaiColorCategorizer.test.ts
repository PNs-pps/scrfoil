import { describe, it, expect } from 'vitest';
import { extractBaseThaiColor, getColorStyle } from './thaiColorCategorizer';

describe('thaiColorCategorizer', () => {
  it('categorizes all observed PU coil colors with distinct chart palettes', () => {
    const inputs = [
      'ขาว AW',
      'อลูซิงค์ ZN',
      'ดำด้าน BM',
      'ลายไม้อ่อน WD3D',
      'ครีม PB',
      'ลายไม้เข้ม WB3D',
      'เทา STG/BST',
      'โยเกิร์ตไวท์ YGW',
    ];

    const keys = inputs.map((c) => extractBaseThaiColor(c));
    expect(keys).toEqual([
      'ขาว',
      'อลูซิงค์',
      'ดำ',
      'ลายไม้อ่อน',
      'ครีม',
      'ลายไม้เข้ม',
      'เทา',
      'โยเกิร์ตไวท์',
    ]);

    const metas = keys.map((k) => getColorStyle(k));
    const uniqueFrontTops = new Set(metas.map((m) => m.chartPalette.frontTop));
    const uniqueBarColors = new Set(metas.map((m) => m.barColor));

    expect(uniqueFrontTops.size).toBe(inputs.length);
    expect(uniqueBarColors.size).toBe(inputs.length);

    // Ensure ลายไม้อ่อน does not collide with ครีม and ขาว uses crisp pearl-white 3D palette
    expect(getColorStyle('ลายไม้อ่อน').barColor).not.toBe(getColorStyle('ครีม').barColor);
    expect(getColorStyle('ขาว').dotColor).toBe('#ffffff');
    expect(getColorStyle('ขาว').chartPalette.frontTop).toBe('#ffffff');
    expect(getColorStyle('ขาว').chartPalette.stroke).toBe('#64748b');
  });

  it('supports shorthand wood & yogurt color names without fallback gray', () => {
    expect(extractBaseThaiColor('ไม้อ่อน WD3D')).toBe('ลายไม้อ่อน'.replace('ลาย', ''));
    expect(getColorStyle('ไม้อ่อน').chartPalette.frontTop).toBe(
      getColorStyle('ลายไม้อ่อน').chartPalette.frontTop
    );
    expect(getColorStyle('ไม้เข้ม').chartPalette.frontBottom).toBe(
      getColorStyle('ลายไม้เข้ม').chartPalette.frontBottom
    );
    expect(getColorStyle('โยเกิร์ต').chartPalette.frontTop).toBe(
      getColorStyle('โยเกิร์ตไวท์').chartPalette.frontTop
    );
  });
});
