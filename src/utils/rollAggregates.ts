/**
 * สูตรกลางสำหรับรวมยอดจากรายการตัดสต๊อก (StockCutRecord / CutHistoryItem)
 *
 * ทุกวิว/การส่งออกต้องใช้ตัวช่วยในไฟล์นี้ เพื่อให้ตัวเลขตรงกันหมด:
 *   - รายการ "reserved" (รอตัด/จอง) และ "cancelled" (ยกเลิก) ต้องไม่ถูกนับเข้าสต๊อก
 *   - ยอดรวมต้องคงเครื่องหมายของ totalDeducted (Cycle Count คืนยอดเป็นค่าลบ)
 *
 * ก่อนหน้านี้แต่ละคอมโพเนนต์เขียนสูตรเอง ทำให้ตัวเลขไม่ตรงกันและเกิดการนับซ้ำ
 */

import { StockCutRecord } from '../types';
import { round2 } from './formatters';
import { signedTotalDeducted } from './cutDeduction';
import { summarizeRollDeduction } from './integrityCheck';

/** รูปร่างขั้นต่ำของรายการตัดที่ตัวช่วยในไฟล์นี้ใช้ (รองรับทั้ง StockCutRecord และ CutHistoryItem) */
export interface CutLike {
  id?: string;
  soNumber?: string;
  notes?: string;
  cutStatus?: 'completed' | 'reserved' | 'cancelled';
  usedMeters?: number;
  ngMeters?: number;
  totalDeducted?: number;
}

/** รายการที่นับเข้าสต๊อกจริง (completed หรือไม่ระบุสถานะ) */
export function isCountableCut(r: CutLike): boolean {
  return r.cutStatus !== 'reserved' && r.cutStatus !== 'cancelled';
}

/** รายการที่ถูกจองรอตัด */
export function isReservedCut(r: CutLike): boolean {
  return r.cutStatus === 'reserved';
}

/** รายการที่นับเข้าสต๊อกจริง — ตัด reserved/cancelled ออก */
export function countableRecords<T extends CutLike>(records: T[] = []): T[] {
  return records.filter(isCountableCut);
}

/** รายการที่ถูกจองรอตัด (reserved) */
export function reservedRecords<T extends CutLike>(records: T[] = []): T[] {
  return records.filter(isReservedCut);
}

export interface DeductionAggregate {
  /** ยอดหักสุทธิ (signed) ของรายการที่นับจริง */
  total: number;
  /** เมตรที่ใช้งาน (ค่าบวก) */
  used: number;
  /** เมตร NG (ค่าบวก) */
  ng: number;
  /** จำนวนรายการที่นับ */
  count: number;
}

/**
 * ยอดหักรวมของรายการที่นับจริง (ตัด reserved/cancelled, คงเครื่องหมาย CC)
 * ใช้ตัวเดียวกับ Dashboard เพื่อให้ตัวเลขตรงกันทุกวิว
 */
export function aggregateDeduction(records: StockCutRecord[] = []): DeductionAggregate {
  return summarizeRollDeduction(records);
}

/** เมตรที่ถูกจองไว้ (reserved) ของชุด record — สูตรเดียวทั้งแอป */
export function reservedMetersOf<T extends CutLike>(records: T[] = []): number {
  let sum = 0;
  for (const rec of records) {
    if (!isReservedCut(rec)) continue;
    sum = round2(sum + Math.abs(signedTotalDeducted(rec)));
  }
  return sum;
}

/** เมตรที่ถูกจองไว้ (reserved) ของม้วนหนึ่ง */
export function reservedMetersOfRoll<T extends CutLike & { foilId?: string }>(
  records: T[] = [],
  rollId: string
): number {
  return reservedMetersOf(records.filter((r) => r.foilId === rollId));
}
