import React from 'react';

/**
 * Pattern (ท้องฟอยล์) visual styling and color specification
 * Based on user requirement:
 * - ขาว: สีขาว
 * - ดำ: สีดำ
 * - ไม้อ่อน: สีเหลือง
 * - ไม้เข้ม: สีน้ำตาล
 * - เทา: สีเทา
 * - กลีบบัว: สีเงิน
 */
export interface PatternStyle {
  name: string;
  dotClass: string;
  badgeClass: string;
  colorName: string;
  borderClass: string;
  style?: React.CSSProperties;
}

export function getPatternStyle(pattern: string = ''): PatternStyle {
  const norm = (pattern || '').trim().toLowerCase();

  // 1. ดำ (Black)
  if (norm === 'ดำ' || norm.includes('ดำ') || norm === 'black') {
    return {
      name: 'ดำ',
      colorName: 'สีดำ',
      dotClass: 'bg-slate-950 border border-black shadow-xs',
      badgeClass: 'bg-slate-900 text-white border border-slate-950 shadow-2xs font-semibold',
      borderClass: 'border-slate-950',
    };
  }

  // 2. ไม้อ่อน (Yellow / Light Wood)
  if (
    norm === 'ไม้อ่อน' ||
    norm === 'ไม้อ้อน' ||
    norm === 'ลายไม้อ่อน' ||
    norm === 'ลายไม้อ้อน' ||
    norm.includes('ไม้อ่อน') ||
    norm.includes('ไม้อ้อน') ||
    norm === 'light_wood'
  ) {
    return {
      name: 'ไม้อ่อน',
      colorName: 'สีเหลือง',
      dotClass: 'bg-amber-300 border border-amber-400 shadow-xs',
      badgeClass: 'bg-amber-200 text-amber-950 border border-amber-300 shadow-2xs font-bold',
      borderClass: 'border-amber-400',
    };
  }

  // 3. ไม้เข้ม (Brown / Dark Wood)
  if (
    norm === 'ไม้เข้ม' ||
    norm === 'ลายไม้เข้ม' ||
    norm.includes('ไม้เข้ม') ||
    norm === 'dark_wood'
  ) {
    return {
      name: 'ไม้เข้ม',
      colorName: 'สีน้ำตาล',
      dotClass: 'bg-[#78350f] border border-[#451a03] shadow-xs',
      badgeClass: 'bg-[#78350f] text-amber-50 border border-[#451a03] shadow-2xs font-bold',
      borderClass: 'border-[#78350f]',
    };
  }

  // 4. เทา (Gray)
  if (norm === 'เทา' || norm.includes('เทา') || norm === 'gray' || norm === 'grey') {
    return {
      name: 'เทา',
      colorName: 'สีเทา',
      dotClass: 'bg-slate-400 border border-slate-500 shadow-xs',
      badgeClass: 'bg-slate-200 text-slate-800 border border-slate-400 shadow-2xs font-bold',
      borderClass: 'border-slate-400',
    };
  }

  // 5. กลีบบัว / เงิน (Silver / Lotus Petal)
  if (
    norm === 'กลีบบัว' ||
    norm.includes('กลีบบัว') ||
    norm === 'บัว' ||
    norm === 'silver' ||
    norm === 'เงิน' ||
    norm.includes('เงิน')
  ) {
    return {
      name: 'กลีบบัว',
      colorName: 'สีเงิน',
      dotClass: 'bg-gradient-to-tr from-slate-300 via-zinc-200 to-slate-400 border border-slate-400 shadow-xs',
      badgeClass: 'bg-gradient-to-r from-slate-100 to-zinc-200 text-slate-800 border border-slate-300 shadow-2xs font-bold',
      borderClass: 'border-slate-300',
    };
  }

  // 6. ขาว (White) - Default
  return {
    name: 'ขาว',
    colorName: 'สีขาว',
    dotClass: 'bg-white border-2 border-slate-300 shadow-xs',
    badgeClass: 'bg-white text-slate-900 border border-slate-300 shadow-2xs font-bold',
    borderClass: 'border-slate-300',
  };
}

export function getPatternProgressBarColor(pattern: string = ''): string {
  const norm = (pattern || '').trim().toLowerCase();
  if (norm.includes('ดำ') || norm === 'black') return 'bg-slate-900';
  if (norm.includes('ไม้เข้ม') || norm === 'dark_wood') return 'bg-[#78350f]';
  if (norm.includes('ไม้อ่อน') || norm.includes('ไม้อ้อน') || norm === 'light_wood') return 'bg-amber-400';
  if (norm.includes('กลีบบัว') || norm.includes('เงิน') || norm === 'silver') return 'bg-gradient-to-r from-slate-400 to-zinc-400';
  if (norm.includes('เทา') || norm === 'gray' || norm === 'grey') return 'bg-slate-500';
  if (norm.includes('ขาว') || norm === 'white') return 'bg-slate-400';
  return 'bg-emerald-500';
}

export const PATTERN_LIST_OPTIONS = [
  { value: 'ขาว', label: 'ขาว', color: 'สีขาว' },
  { value: 'ดำ', label: 'ดำ', color: 'สีดำ' },
  { value: 'ไม้อ่อน', label: 'ไม้อ่อน', color: 'สีเหลือง' },
  { value: 'ไม้เข้ม', label: 'ไม้เข้ม', color: 'สีน้ำตาล' },
  { value: 'เทา', label: 'เทา', color: 'สีเทา' },
  { value: 'กลีบบัว', label: 'กลีบบัว', color: 'สีเงิน' },
];

export { WIDTH_SPECIFICATIONS, getWidthLabel } from '../types';


