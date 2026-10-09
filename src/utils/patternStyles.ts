import React from 'react';
import { getCanonicalPatternStyle, resolveStandardPattern } from './soFormatter';

/**
 * สีลายฟอยล์ (ท้องฟอยล์) ทั้งแอพ
 *
 * ไม่กำหนดสีซ้ำที่นี่อีกแล้ว — ทุกอย่างดึงจาก getCanonicalPatternStyle() ใน soFormatter.ts
 * ซึ่งเป็นชุดสีเดียวกับ "คงเหลือฟอยล์แยกตามลาย" ในหน้าแดชบอร์ด:
 * - ขาว: ขาว/เทาอ่อน   - ดำ: ดำ   - ไม้อ่อน: เหลือง
 * - ไม้เข้ม: น้ำตาล    - เทา: เทา  - กลีบบัว: ชมพู
 */
export interface PatternStyle {
  name: string;
  dotClass: string;
  badgeClass: string;
  colorName: string;
  borderClass: string;
  /** สีแท่งความคืบหน้า/คงเหลือ (เหมือนแดชบอร์ด) */
  progressClass: string;
  /** ไฮไลต์เข้ม: พื้นทึบ + ตัวอักษร + ขอบ ใช้กับป้ายลาย */
  highlightClass: string;
  /** ไฮไลต์อ่อน: พื้นกล่อง/แถวของลายนั้น */
  tintClass: string;
  style?: React.CSSProperties;
}

export function getPatternStyle(pattern: string = ''): PatternStyle {
  // รองรับชื่อลายที่พิมพ์หลากหลาย (เช่น "ลายไม้เข้ม", "สีดำ") แล้วจับคู่กับลายมาตรฐาน
  const key = resolveStandardPattern(pattern) ?? pattern;
  const c = getCanonicalPatternStyle(key);
  return {
    name: c.name,
    colorName: c.colorName,
    dotClass: c.dotClass,
    badgeClass: `${c.badgeClass} shadow-2xs font-bold`,
    borderClass: c.borderClass,
    progressClass: c.progressClass,
    highlightClass: c.highlightClass,
    tintClass: c.tintClass,
  };
}

export function getPatternProgressBarColor(pattern: string = ''): string {
  return getPatternStyle(pattern).progressClass;
}

export const PATTERN_LIST_OPTIONS = [
  { value: 'ขาว', label: 'ขาว', color: 'สีขาว' },
  { value: 'ดำ', label: 'ดำ', color: 'สีดำ' },
  { value: 'ไม้อ่อน', label: 'ไม้อ่อน', color: 'สีเหลือง' },
  { value: 'ไม้เข้ม', label: 'ไม้เข้ม', color: 'สีน้ำตาล' },
  { value: 'เทา', label: 'เทา', color: 'สีเทา' },
  { value: 'กลีบบัว', label: 'กลีบบัว', color: 'สีชมพู' },
];

export { WIDTH_SPECIFICATIONS, getWidthLabel } from '../types';
