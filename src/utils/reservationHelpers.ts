import { FoilRoll, StockCutRecord } from '../types';
import { round2 } from './formatters';

export interface RollReservationMetrics {
  totalMeters: number;
  remainingMeters: number;
  reservedMeters: number;
  projectedRemainingMeters: number;
  usedMeters: number;
  usedPercent: number;
  reservedPercent: number;
  availablePercent: number;
  reservedCount: number;
}

/**
 * คำนวณสถานะความยาวและการจองของม้วนฟอยล์แบบไดนามิกจากรายการ Records
 */
export const calculateRollReservationMetrics = (
  roll: FoilRoll,
  records: StockCutRecord[] = []
): RollReservationMetrics => {
  const total = Number(roll.totalMeters) || 0;
  const remaining = Number(roll.remainingMeters) || 0;

  // ค้นหารายการที่รอตัด (reserved) ของม้วนนี้
  const rollReservations = records.filter(
    (r) => r.foilId === roll.id && r.cutStatus === 'reserved'
  );

  const reservedCount = rollReservations.length;
  const reservedMeters = round2(
    rollReservations.reduce((sum, r) => sum + (Number(r.usedMeters) || 0) + (Number(r.ngMeters) || 0), 0)
  );

  const projectedRemainingMeters = Math.max(0, round2(remaining - reservedMeters));
  const usedMeters = Math.max(0, round2(total - remaining));

  let usedPercent = 0;
  let reservedPercent = 0;
  let availablePercent = 0;

  if (total > 0) {
    usedPercent = Math.min(100, (usedMeters / total) * 100);
    reservedPercent = Math.min(100 - usedPercent, (reservedMeters / total) * 100);
    availablePercent = Math.max(0, 100 - usedPercent - reservedPercent);
  }

  return {
    totalMeters: total,
    remainingMeters: remaining,
    reservedMeters,
    projectedRemainingMeters,
    usedMeters,
    usedPercent,
    reservedPercent,
    availablePercent,
    reservedCount,
  };
};

/**
 * ตรวจสอบสถานะของ Record ว่าเป็นรอตัด (จอง) หรือไม่
 */
export const isRecordReserved = (r: StockCutRecord): boolean => {
  return r.cutStatus === 'reserved';
};

/**
 * ตรวจสอบสถานะของ Record ว่าผลิตจริงแล้ว (ตัดจริง) หรือไม่
 */
export const isRecordCompleted = (r: StockCutRecord): boolean => {
  return !r.cutStatus || r.cutStatus === 'completed';
};

/**
 * ตรวจสอบสถานะของ Record ว่ายกเลิกแล้วหรือไม่
 */
export const isRecordCancelled = (r: StockCutRecord): boolean => {
  return r.cutStatus === 'cancelled';
};
