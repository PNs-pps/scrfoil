/**
 * ยอดที่ "หักออก" จากม้วนของรายการตัดหนึ่งรายการ
 *
 * รายการตัดปกติ (SO / ไม่ใช่ SO) เป็นค่าบวกเสมอ จึงใช้ค่าสัมบูรณ์เพื่อกันข้อมูลเก่าที่ติดลบผิดพลาด
 *
 * ข้อยกเว้น: รายการปรับยอดจาก Cycle Count (นับสต๊อก)
 *   - ของจริง "น้อยกว่า" ระบบ → totalDeducted เป็นบวก (หักออก)
 *   - ของจริง "มากกว่า" ระบบ → totalDeducted เป็นลบ (คืนยอดเข้าม้วน) ซึ่งเป็นค่าที่ถูกต้องโดยตั้งใจ
 *   ดังนั้นต้องคงเครื่องหมายไว้ ห้ามใช้ Math.abs ไม่เช่นนั้นระบบตรวจสอบจะนับยอดที่คืนเป็นยอดที่ตัด
 *   แล้วแจ้งว่าม้วน "แสดงมากเกินไป" และแนะนำให้แก้ยอดลงผิดทิศ
 */

export interface DeductionLike {
  id?: string;
  soNumber?: string;
  notes?: string;
  usedMeters?: number;
  ngMeters?: number;
  totalDeducted?: number;
}

const CC_SO_PREFIX = 'นับสต๊อก';

/** ใช่รายการปรับยอดจาก Cycle Count หรือไม่ (id ขึ้นต้น cc_ / SO ขึ้นต้น "นับสต๊อก" / หมายเหตุขึ้นต้น Cycle Count) */
export function isCycleCountRecord(rec: DeductionLike | null | undefined): boolean {
  if (!rec) return false;
  return (
    String(rec.id || '').startsWith('cc_') ||
    String(rec.soNumber || '').trim().startsWith(CC_SO_PREFIX) ||
    /^Cycle Count/i.test(String(rec.notes || '').trim())
  );
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** ยอดหักของรายการ: Cycle Count คงเครื่องหมาย (ติดลบ = คืนยอด) รายการอื่นเป็นค่าบวกเสมอ */
export function signedTotalDeducted(rec: DeductionLike): number {
  const used = Math.abs(Number(rec.usedMeters || 0));
  const ng = Math.abs(Number(rec.ngMeters || 0));
  const raw = rec.totalDeducted;
  const hasRaw = raw !== undefined && raw !== null && Number.isFinite(Number(raw));
  if (isCycleCountRecord(rec) && hasRaw) {
    return round2(Number(raw));
  }
  return round2(Math.abs(Number(hasRaw ? raw : used + ng)));
}
