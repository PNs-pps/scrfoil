import { CutHistoryItem, FoilRoll, StockCutRecord } from '../types';
import { formatMeters } from './formatters';
import {
  hasExplicitSpecConflict,
  isRecordSpecCompatibleWithRoll,
  normalizeLotRollPart,
  normalizePatternForMatch,
} from './rollIdentity';

export interface MergedCutHistoryRow extends CutHistoryItem {
  /** Lot/Roll/Width/Pattern actually stamped on the cut record itself (not overwritten by parent roll) */
  rawLotNumber?: string;
  rawRollNumber?: string;
  rawWidth?: number;
  rawPattern?: string;
  rawFoilId?: string;
  /** True when the cut explicitly stores both matching width and pattern */
  isSpecVerified: boolean;
  /** True when lot/roll on the record itself differs from parent roll's lot/roll */
  hasLotRollConflict: boolean;
  /** True when remainingBefore or remainingAfter is negative (< -0.01) */
  hasNegativeBalance: boolean;
  /** Source of this row in merged view */
  mergeSource: 'root' | 'sub' | 'both';
}

export interface MergeRollCutHistoryResult {
  items: MergedCutHistoryRow[];
  staleSubItemIds: string[];
  crossSpecSubItemIds: string[];
  cancelledSubItemIds: string[];
  rejectedSubCount: number;
}

export interface TimelineAnomalySummary {
  hasMixedOrCorruptTimeline: boolean;
  negativeBalanceIds: string[];
  unverifiedSpecIds: string[];
  lotRollConflictIds: string[];
  depletionEventCount: number;
  interleavedChainCount: number;
  summaryMessages: string[];
}

function resolveRollSpecVerification(
  roll: Pick<FoilRoll, 'width' | 'pattern'>,
  widthVal?: number | string | null,
  patternVal?: string | null
): boolean {
  const recW = Number(widthVal);
  const recP = normalizePatternForMatch(patternVal);
  if (!Number.isFinite(recW) || recW <= 0 || !recP) {
    return false;
  }
  return isRecordSpecCompatibleWithRoll(
    roll,
    { width: recW, pattern: patternVal },
    { requireBothPresent: true }
  );
}

function hasLotOrRollConflict(
  roll: Pick<FoilRoll, 'lotNumber' | 'rollNumber'>,
  lotVal?: string | null,
  rollNoVal?: string | null
): boolean {
  const targetLot = normalizeLotRollPart(roll.lotNumber);
  const targetRoll = normalizeLotRollPart(roll.rollNumber);
  const itemLot = normalizeLotRollPart(lotVal);
  const itemRoll = normalizeLotRollPart(rollNoVal);

  if (itemLot && targetLot && itemLot !== targetLot) return true;
  if (itemRoll && targetRoll && itemRoll !== targetRoll) return true;
  return false;
}

/**
 * Merges `stock_cut_records` (root) and `foil_rolls/{rollId}/cut_history` (subcollection)
 * strictly for one target roll.
 *
 * Isolation rules:
 * 1. Subcollection items are rejected if:
 *    - `item.rollId` is explicitly set to another roll ID
 *    - `item.lotNumber` or `item.rollNumber` explicitly conflicts with `roll`
 *    - `item.width` or `item.pattern` explicitly conflicts with `roll` (`hasExplicitSpecConflict`)
 *    - A root `stock_cut_records` doc with the same ID exists and either belongs to a DIFFERENT `foilId`,
 *      is `cancelled`, or has an explicit spec conflict with `roll`.
 * 2. Root records are accepted only when `r.foilId === roll.id` AND `isRecordSpecCompatibleWithRoll(roll, r)`.
 * 3. Root record values (especially `remainingBefore`/`remainingAfter` after chain realignment) override
 *    stale subcollection snapshots, while preserving raw spec metadata (`rawWidth`, `rawPattern`, etc.)
 *    so unverified legacy records remain auditable instead of silently masked.
 */
export function mergeRollCutHistory(
  roll: Pick<FoilRoll, 'id' | 'lotNumber' | 'rollNumber' | 'width' | 'pattern'> | null | undefined,
  rootRecords: StockCutRecord[],
  subItems: CutHistoryItem[] | null | undefined
): MergeRollCutHistoryResult {
  if (!roll?.id) {
    return {
      items: [],
      staleSubItemIds: [],
      crossSpecSubItemIds: [],
      cancelledSubItemIds: [],
      rejectedSubCount: 0,
    };
  }

  const rollId = roll.id;
  const rootById = new Map<string, StockCutRecord>();
  rootRecords.forEach((r) => {
    if (r?.id) rootById.set(r.id, r);
  });

  const map = new Map<string, MergedCutHistoryRow>();
  const staleSubItemIds: string[] = [];
  const crossSpecSubItemIds: string[] = [];
  const cancelledSubItemIds: string[] = [];

  // 1) Filter sub-collection items strictly
  (subItems || []).forEach((item) => {
    if (!item?.id) return;

    // Cross-rollId inside subcollection
    if (item.rollId && item.rollId !== rollId) {
      staleSubItemIds.push(item.id);
      return;
    }

    // Explicit lot or roll mismatch inside subcollection (catches mixed VIP36 #02 vs another roll)
    if (hasLotOrRollConflict(roll, item.lotNumber, item.rollNumber)) {
      staleSubItemIds.push(item.id);
      return;
    }

    // Cancelled subcollection entry should not pollute active roll timeline
    if (item.cutStatus === 'cancelled') {
      cancelledSubItemIds.push(item.id);
      return;
    }

    // Explicit width or pattern conflict inside subcollection
    if (hasExplicitSpecConflict(roll, item)) {
      crossSpecSubItemIds.push(item.id);
      return;
    }

    // Cross-check authoritative root record if loaded
    const rootMatch = rootById.get(item.id);
    if (rootMatch) {
      if (rootMatch.foilId && rootMatch.foilId !== rollId) {
        staleSubItemIds.push(item.id);
        return;
      }
      if (rootMatch.cutStatus === 'cancelled') {
        cancelledSubItemIds.push(item.id);
        return;
      }
      if (hasExplicitSpecConflict(roll, rootMatch)) {
        crossSpecSubItemIds.push(item.id);
        return;
      }
    }

    const remBefore = Number(item.remainingBefore ?? 0);
    const remAfter = Number(item.remainingAfter ?? 0);
    const isCountable = item.cutStatus !== 'reserved';

    map.set(item.id, {
      ...item,
      rollId: item.rollId || rollId,
      lotNumber: item.lotNumber || roll.lotNumber,
      rollNumber: item.rollNumber || roll.rollNumber,
      width: item.width ?? roll.width,
      pattern: item.pattern || roll.pattern,
      rawLotNumber: item.lotNumber,
      rawRollNumber: item.rollNumber,
      rawWidth: item.width !== undefined && item.width !== null ? Number(item.width) : undefined,
      rawPattern: item.pattern,
      rawFoilId: item.rollId,
      isSpecVerified: resolveRollSpecVerification(roll, item.width, item.pattern),
      hasLotRollConflict: hasLotOrRollConflict(roll, item.lotNumber, item.rollNumber),
      hasNegativeBalance: isCountable && (remBefore < -0.01 || remAfter < -0.01),
      mergeSource: 'sub',
    });
  });

  // 2) Overlay authoritative root records for this roll (excluding cancelled records)
  rootRecords
    .filter(
      (r) =>
        r.foilId === rollId &&
        r.cutStatus !== 'cancelled' &&
        isRecordSpecCompatibleWithRoll(roll, r)
    )
    .forEach((r) => {
      const prev = map.get(r.id);
      const effectiveWidth =
        r.width !== undefined && r.width !== null && Number(r.width) > 0
          ? Number(r.width)
          : prev?.rawWidth;
      const effectivePattern = (r.pattern || '').trim() || prev?.rawPattern;
      const effectiveLot = (r.lotNumber || '').trim() || prev?.rawLotNumber;
      const effectiveRollNo = (r.rollNumber || '').trim() || prev?.rawRollNumber;

      const remBefore =
        r.remainingBefore != null ? Number(r.remainingBefore) : Number(prev?.remainingBefore ?? 0);
      const remAfter =
        r.remainingAfter != null ? Number(r.remainingAfter) : Number(prev?.remainingAfter ?? 0);
      const cutStatus = r.cutStatus || prev?.cutStatus || 'completed';
      const isCountable = cutStatus !== 'reserved' && cutStatus !== 'cancelled';

      map.set(r.id, {
        id: r.id,
        soNumber: r.soNumber,
        cutMeters: r.usedMeters,
        usedMeters: r.usedMeters,
        ngMeters: r.ngMeters,
        totalDeducted: r.totalDeducted,
        remainingBefore: remBefore,
        remainingAfter: remAfter,
        cutDate: r.usageDate || r.recordedDate,
        usageDate: r.usageDate,
        recordedDate: r.recordedDate,
        recordedBy: r.recordedBy,
        notes: r.notes,
        createdAt: r.createdAt || r.recordedDate,
        cutType: r.cutType || 'so',
        nonSoReason: r.nonSoReason,
        productionRound: r.productionRound,
        roundNumber: r.roundNumber,
        cutStatus,
        rollId,
        lotNumber: effectiveLot || roll.lotNumber,
        rollNumber: effectiveRollNo || roll.rollNumber,
        width: effectiveWidth ?? roll.width,
        pattern: effectivePattern || roll.pattern,
        isSilverSide: r.isSilverSide ?? prev?.isSilverSide,
        isWhiteSide: r.isWhiteSide ?? prev?.isWhiteSide,
        rawLotNumber: r.lotNumber ?? prev?.rawLotNumber,
        rawRollNumber: r.rollNumber ?? prev?.rawRollNumber,
        rawWidth: effectiveWidth,
        rawPattern: effectivePattern,
        rawFoilId: r.foilId,
        isSpecVerified: resolveRollSpecVerification(roll, effectiveWidth, effectivePattern),
        hasLotRollConflict: hasLotOrRollConflict(roll, effectiveLot, effectiveRollNo),
        hasNegativeBalance: isCountable && (remBefore < -0.01 || remAfter < -0.01),
        mergeSource: prev ? 'both' : 'root',
      });
    });

  const sorted = Array.from(map.values()).sort((a, b) => {
    const timeA = new Date(a.usageDate || a.recordedDate || a.createdAt || 0).getTime();
    const timeB = new Date(b.usageDate || b.recordedDate || b.createdAt || 0).getTime();
    if (timeA !== timeB) return timeB - timeA;
    const createdCmp = String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    if (createdCmp !== 0) return createdCmp;
    // On identical date & timestamp, a smaller remainingAfter was cut later -> show first
    const remAfterDiff = Number(a.remainingAfter ?? 0) - Number(b.remainingAfter ?? 0);
    if (Math.abs(remAfterDiff) > 0.01) return remAfterDiff;
    return String(b.id).localeCompare(String(a.id));
  });

  const rejectedSubCount =
    staleSubItemIds.length + crossSpecSubItemIds.length + cancelledSubItemIds.length;

  return {
    items: sorted,
    staleSubItemIds: Array.from(new Set(staleSubItemIds)),
    crossSpecSubItemIds: Array.from(new Set(crossSpecSubItemIds)),
    cancelledSubItemIds: Array.from(new Set(cancelledSubItemIds)),
    rejectedSubCount,
  };
}

/**
 * Inspects a merged roll timeline for interleaved chains (e.g. a second roll sharing
 * Lot+Roll mixed into this timeline causing negative balances, repeated exhaustions,
 * or non-monotonic jumps).
 */
export function detectTimelineAnomalies(
  items: MergedCutHistoryRow[],
  roll?: Pick<FoilRoll, 'lotNumber' | 'rollNumber' | 'width' | 'pattern'> | null
): TimelineAnomalySummary {
  const negativeBalanceIds: string[] = [];
  const unverifiedSpecIds: string[] = [];
  const lotRollConflictIds: string[] = [];
  let depletionEventCount = 0;
  let interleavedChainCount = 0;

  const countableAsc = [...items]
    .filter((i) => i.cutStatus !== 'reserved' && i.cutStatus !== 'cancelled')
    .sort((a, b) => {
      const timeA = new Date(a.usageDate || a.recordedDate || a.createdAt || 0).getTime();
      const timeB = new Date(b.usageDate || b.recordedDate || b.createdAt || 0).getTime();
      if (timeA !== timeB) return timeA - timeB;
      return String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
    });

  countableAsc.forEach((item, idx) => {
    const remBefore = Number(item.remainingBefore ?? 0);
    const remAfter = Number(item.remainingAfter ?? 0);
    const totalDed = Number(item.totalDeducted ?? 0);

    if (item.hasNegativeBalance || remBefore < -0.01 || remAfter < -0.01) {
      negativeBalanceIds.push(item.id);
    }
    if (!item.isSpecVerified) {
      unverifiedSpecIds.push(item.id);
    }
    if (item.hasLotRollConflict) {
      lotRollConflictIds.push(item.id);
    }
    if (remAfter <= 0.01 && totalDed > 0) {
      depletionEventCount += 1;
    }

    if (idx > 0) {
      const prev = countableAsc[idx - 1];
      const prevAfter = Number(prev.remainingAfter ?? 0);
      // Detect chain interleaving: previous cut left one level (e.g. -40.56 or 235.82)
      // and next chronological cut starts far away (> 1m diff) without a stock-in cycle count
      const isCycleCount =
        String(item.id || '').startsWith('cc_') ||
        String(item.soNumber || '').trim().startsWith('นับสต๊อก');
      if (!isCycleCount && Math.abs(remBefore - prevAfter) > 1) {
        interleavedChainCount += 1;
      }
    }
  });

  const summaryMessages: string[] = [];
  const rollTag = roll
    ? `หน้า ${roll.width} มม. · ลาย${roll.pattern} · ล็อต ${roll.lotNumber} #${roll.rollNumber}`
    : '';

  if (negativeBalanceIds.length > 0) {
    summaryMessages.push(
      `พบรายการที่ยอดก่อนตัด/หลังตัดติดลบ ${negativeBalanceIds.length} รายการ (บ่งชี้ว่าเคยมียอดตัดปนจากม้วนอื่นหรือข้ามหน้ากว้าง)`
    );
  }
  if (interleavedChainCount > 0 || depletionEventCount > 1) {
    summaryMessages.push(
      `พบสายยอดคงเหลือสลับไปมา (${interleavedChainCount} จุด${
        depletionEventCount > 1 ? `, หมดม้วน ${depletionEventCount} ครั้ง` : ''
      }) อาจมีประวัติของม้วนอื่นที่ล็อต/เบอร์ตรงกันปนอยู่บน${rollTag || 'ม้วนนี้'}`
    );
  }
  if (lotRollConflictIds.length > 0) {
    summaryMessages.push(
      `พบรายการที่ล็อต/เบอร์บนใบตัดไม่ตรงกับม้วนนี้ ${lotRollConflictIds.length} รายการ`
    );
  }
  if (unverifiedSpecIds.length > 0) {
    summaryMessages.push(
      `มี ${unverifiedSpecIds.length} รายการเก่าที่ไม่ได้ประทับตราหน้ากว้าง/ลายในบันทึก (กำลังใช้ค่า ${formatMeters(
        Number(roll?.width || 0)
      )} มม. · ${roll?.pattern || '-'} ชั่วคราว)`
    );
  }

  return {
    hasMixedOrCorruptTimeline:
      negativeBalanceIds.length > 0 ||
      interleavedChainCount > 0 ||
      depletionEventCount > 1 ||
      lotRollConflictIds.length > 0,
    negativeBalanceIds,
    unverifiedSpecIds,
    lotRollConflictIds,
    depletionEventCount,
    interleavedChainCount,
    summaryMessages,
  };
}
