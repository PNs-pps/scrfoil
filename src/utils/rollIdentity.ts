import { FoilRoll, StockCutRecord } from '../types';
import { normalizePattern } from './soFormatter';

export function normalizeLotRollPart(value?: string | number | null): string {
  return String(value ?? '').trim().toUpperCase();
}

export function normalizePatternForMatch(pattern?: string | null): string {
  const trimmed = String(pattern ?? '').trim();
  if (!trimmed || trimmed === '-' || trimmed === 'ไม่ระบุ') return '';
  return normalizePattern(trimmed).trim().toLowerCase();
}

export function buildStrictRollKey(
  lotNumber?: string | null,
  rollNumber?: string | null,
  width?: number | string | null,
  pattern?: string | null
): string {
  const lot = normalizeLotRollPart(lotNumber);
  const roll = normalizeLotRollPart(rollNumber);
  const w = Number(width);
  const widthPart = Number.isFinite(w) && w > 0 ? String(w) : '';
  const patternPart = normalizePatternForMatch(pattern);
  return `${lot}::${roll}::${widthPart}::${patternPart}`;
}

/**
 * Checks whether a cut record's width and pattern are compatible with a given foil roll.
 * Missing/empty spec fields on legacy records are treated as non-conflicting unless
 * strict=true is requested.
 */
export function isRecordSpecCompatibleWithRoll(
  roll: Pick<FoilRoll, 'width' | 'pattern'>,
  record: Partial<Pick<StockCutRecord, 'width' | 'pattern'>>,
  options?: { requireBothPresent?: boolean }
): boolean {
  const rollWidth = Number(roll.width);
  const recWidth = Number(record.width);
  const hasRollWidth = Number.isFinite(rollWidth) && rollWidth > 0;
  const hasRecWidth =
    record.width !== undefined &&
    record.width !== null &&
    String(record.width).trim() !== '' &&
    Number.isFinite(recWidth) &&
    recWidth > 0;

  const rollPattern = normalizePatternForMatch(roll.pattern);
  const recPattern = normalizePatternForMatch(record.pattern);

  if (options?.requireBothPresent) {
    if (!hasRollWidth || !hasRecWidth || rollWidth !== recWidth) return false;
    if (!rollPattern || !recPattern || rollPattern !== recPattern) return false;
    return true;
  }

  if (hasRollWidth && hasRecWidth && rollWidth !== recWidth) {
    return false;
  }
  if (rollPattern && recPattern && rollPattern !== recPattern) {
    return false;
  }
  return true;
}

/**
 * True when a cut record explicitly carries a different width or pattern than the roll.
 */
export function hasExplicitSpecConflict(
  roll: Pick<FoilRoll, 'width' | 'pattern'>,
  record: Partial<Pick<StockCutRecord, 'width' | 'pattern'>>
): boolean {
  return !isRecordSpecCompatibleWithRoll(roll, record);
}

/**
 * Finds the rightful roll for a cut record.
 * - Prefers exact foilId match ONLY if width & pattern are compatible.
 * - If foilId points to a roll whose width/pattern disagrees (cross-spec contamination)
 *   or foilId is missing, checks if there is a unique roll matching lotNumber + rollNumber + width + pattern.
 * - Never matches across different widths or patterns by lot+roll alone.
 */
export function findMatchingRollForRecord(
  rolls: FoilRoll[],
  record: Pick<StockCutRecord, 'foilId' | 'lotNumber' | 'rollNumber' | 'width' | 'pattern'>
): FoilRoll | undefined {
  const byId = record.foilId ? rolls.find((r) => r.id === record.foilId) : undefined;
  if (byId && isRecordSpecCompatibleWithRoll(byId, record)) {
    return byId;
  }

  const targetLot = normalizeLotRollPart(record.lotNumber);
  const targetRollNo = normalizeLotRollPart(record.rollNumber);
  if (targetLot && targetRollNo) {
    const strictMatches = rolls.filter(
      (r) =>
        normalizeLotRollPart(r.lotNumber) === targetLot &&
        normalizeLotRollPart(r.rollNumber) === targetRollNo &&
        isRecordSpecCompatibleWithRoll(r, record, { requireBothPresent: true })
    );
    if (strictMatches.length === 1) {
      return strictMatches[0];
    }

    // Legacy record missing width/pattern: only match if there is a single non-conflicting roll with that lot+roll
    const compatMatches = rolls.filter(
      (r) =>
        normalizeLotRollPart(r.lotNumber) === targetLot &&
        normalizeLotRollPart(r.rollNumber) === targetRollNo &&
        isRecordSpecCompatibleWithRoll(r, record)
    );
    if (compatMatches.length === 1) {
      return compatMatches[0];
    }
  }

  // Fallback to byId only when no spec-matching roll exists (so caller can still surface contamination warning)
  return byId;
}

/**
 * Strict check determining whether a cut record legitimately belongs to `roll`.
 * Prevents cross-width / cross-pattern mixing and prevents stealing records whose
 * `foilId` belongs to another live roll.
 */
export function doesRecordBelongToRoll(
  roll: FoilRoll,
  record: StockCutRecord,
  knownRollIds?: Set<string>
): boolean {
  if (record.foilId) {
    if (record.foilId === roll.id) {
      return isRecordSpecCompatibleWithRoll(roll, record);
    }
    // If record's foilId belongs to another live roll, never pull it in via lot+roll fallback
    if (!knownRollIds || knownRollIds.has(record.foilId)) {
      return false;
    }
  }

  // Fallback only for orphan / foilId-less records: must match lot + roll + width + pattern
  const sameLot =
    normalizeLotRollPart(record.lotNumber) !== '' &&
    normalizeLotRollPart(record.lotNumber) === normalizeLotRollPart(roll.lotNumber);
  const sameRoll =
    normalizeLotRollPart(record.rollNumber) !== '' &&
    normalizeLotRollPart(record.rollNumber) === normalizeLotRollPart(roll.rollNumber);

  if (!sameLot || !sameRoll) return false;
  return isRecordSpecCompatibleWithRoll(roll, record, { requireBothPresent: true });
}

/**
 * Returns records currently attached to `roll.id` whose width or pattern contradicts `roll`.
 * These are quarantined from deductions and offered for one-click recovery back to their true roll.
 */
export function findContaminatedRecordsForRoll(
  roll: FoilRoll,
  records: StockCutRecord[]
): StockCutRecord[] {
  return records.filter(
    (r) => r.foilId === roll.id && hasExplicitSpecConflict(roll, r)
  );
}

/**
 * Given a cross-spec contaminated record attached to `sourceRollId`, finds the rightful
 * target roll (excluding `sourceRollId`) matching lotNumber + rollNumber + width + pattern.
 */
export function findTargetRollForContaminatedRecord(
  rolls: FoilRoll[],
  sourceRollId: string,
  record: StockCutRecord
): FoilRoll | undefined {
  const lot = normalizeLotRollPart(record.lotNumber);
  const rollNo = normalizeLotRollPart(record.rollNumber);
  if (!lot || !rollNo) return undefined;

  const matches = rolls.filter(
    (r) =>
      r.id !== sourceRollId &&
      normalizeLotRollPart(r.lotNumber) === lot &&
      normalizeLotRollPart(r.rollNumber) === rollNo &&
      isRecordSpecCompatibleWithRoll(r, record, { requireBothPresent: true })
  );
  return matches.length === 1 ? matches[0] : matches[0];
}
