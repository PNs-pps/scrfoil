import { FoilRoll, StockCutRecord } from '../types';
import { round2 } from './formatters';
import { auditRollSOHistory } from './soHistoryAudit';

/**
 * คำนวณยอดเมตรคงเหลือเดิมที่สามารถคืนค่าได้ สำหรับม้วนฟอยล์ที่ถูกกด "ตัดสล็อตเป็น 0" (isZeroedOut)
 * ลำดับความสำคัญ:
 * 1. ค่า `manualZeroedOriginalMeters` ที่บันทึกไว้ก่อนกดตัดเป็น 0 (แม่นยำที่สุด)
 * 2. ยอดคำนวณจากประวัติ SO จริง (กรณีม้วนเก่าที่ไม่มีค่าสำรอง หรือค่าสำรองเป็น 0)
 * 3. ยอดคงเหลือพื้นฐาน (totalMeters - usedMeters - ngMeters)
 */
export function getRestorableZeroedMeters(
  roll: FoilRoll,
  records?: StockCutRecord[]
): number {
  if (
    typeof roll.manualZeroedOriginalMeters === 'number' &&
    Number.isFinite(roll.manualZeroedOriginalMeters) &&
    roll.manualZeroedOriginalMeters > 0
  ) {
    return round2(roll.manualZeroedOriginalMeters);
  }

  if (records && records.length > 0) {
    const rollRecords = records.filter((r) => r.foilId === roll.id);
    if (rollRecords.length > 0) {
      const audit = auditRollSOHistory(roll, rollRecords);
      if (audit.calculatedRemaining > 0) {
        return round2(audit.calculatedRemaining);
      }
    }
  }

  const basicRemaining = round2(
    (Number(roll.totalMeters) || 0) -
      (Number(roll.usedMeters) || 0) -
      (Number(roll.ngMeters) || 0)
  );
  return Math.max(0, basicRemaining);
}
