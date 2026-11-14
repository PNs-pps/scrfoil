import { FoilRoll, StockCutRecord } from '../types';
import { normalizePattern, resolveStandardPattern } from './soFormatter';

export interface SpecLike {
  width?: number | string | null;
  pattern?: string | null;
}

/**
 * Normalizes a lotNumber or rollNumber fragment for case-insensitive, whitespace-trimmed comparison.
 */
export function normalizeLotRollPart(value?: string | number | null): string {
  return String(value ?? '').trim().toLowerCase();
}

/**
 * Normalizes a foil pattern string so legacy aliases (e.g. "ท้องขาว", "กลับบัว") match
 * their canonical names while preserving custom pattern strings (e.g. "201").
 */
export function normalizePatternForMatch(pattern?: string | null): string {
  const trimmed = String(pattern ?? '').trim();
  if (!trimmed) return '';
  const canonical = normalizePattern(trimmed).trim();
  return resolveStandardPattern(canonical) ?? canonical.toLowerCase();
}

/**
 * Builds a strict 4-part composite identity key combining lot + roll + width + pattern.
 * Never collapse two rolls that share lot+roll across different widths or patterns.
 */
export function buildStrictRollKey(
  lotNumber?: string | null,
  rollNumber?: string | null,
  width?: number | string | null,
  pattern?: string | null
): string {
  const lot = normalizeLotRollPart(lotNumber);
  const roll = normalizeLotRollPart(rollNumber);
  const numericWidth = Number(width);
  const widthPart = Number.isFinite(numericWidth) && numericWidth > 0 ? String(numericWidth) : '';
  const patternPart = normalizePatternForMatch(pattern);
  return `${lot}::${roll}::${widthPart}::${patternPart}`;
}

/**
 * Checks whether a cut record's width and pattern are compatible with a roll's spec.
 * - With `requireBothPresent: true`, both width and pattern must be present on both sides and match.
 * - Otherwise, only fields explicitly present on both sides are required to agree.
 */
export function isRecordSpecCompatibleWithRoll(
  roll: SpecLike,
  rec: SpecLike,
  options?: { requireBothPresent?: boolean }
): boolean {
  const rollW = Number(roll.width);
  const recW = Number(rec.width);
  const hasRollW = Number.isFinite(rollW) && rollW > 0;
  const hasRecW = Number.isFinite(recW) && recW > 0;

  const rollP = normalizePatternForMatch(roll.pattern);
  const recP = normalizePatternForMatch(rec.pattern);

  if (options?.requireBothPresent) {
    return (
      hasRollW &&
      hasRecW &&
      rollW === recW &&
      Boolean(rollP) &&
      Boolean(recP) &&
      rollP === recP
    );
  }

  if (hasRollW && hasRecW && rollW !== recW) {
    return false;
  }
  if (rollP && recP && rollP !== recP) {
    return false;
  }
  return true;
}

/**
 * Returns true strictly when a record carries explicit width or pattern metadata
 * that conflicts with the roll's width or pattern.
 */
export function hasExplicitSpecConflict(roll: SpecLike, rec: SpecLike): boolean {
  return !isRecordSpecCompatibleWithRoll(roll, rec, { requireBothPresent: false });
}

/**
 * Finds records currently attached to `roll.id` whose explicit width or pattern
 * conflicts with `roll` (cross-spec contamination from earlier lot+roll matching bugs).
 */
export function findContaminatedRecordsForRoll(
  roll: FoilRoll,
  records: StockCutRecord[]
): StockCutRecord[] {
  return records.filter((r) => r.foilId === roll.id && hasExplicitSpecConflict(roll, r));
}

/**
 * Determines whether a cut record legitimately belongs to `roll`.
 * - Primary binding: `rec.foilId === roll.id` AND spec is compatible (quarantining conflicts).
 * - Never steals a record whose `foilId` points to another live roll in `knownRollIds`.
 * - Orphan/foilId-less fallback: only when `lotNumber + rollNumber + width + pattern` all match.
 */
export function doesRecordBelongToRoll(
  roll: FoilRoll,
  rec: StockCutRecord,
  knownRollIds?: Set<string>
): boolean {
  if (rec.foilId) {
    if (rec.foilId === roll.id) {
      return isRecordSpecCompatibleWithRoll(roll, rec);
    }
    if (!knownRollIds || knownRollIds.has(rec.foilId)) {
      return false;
    }
  }

  const lotMatches =
    normalizeLotRollPart(rec.lotNumber) !== '' &&
    normalizeLotRollPart(rec.lotNumber) === normalizeLotRollPart(roll.lotNumber);
  const rollMatches =
    normalizeLotRollPart(rec.rollNumber) !== '' &&
    normalizeLotRollPart(rec.rollNumber) === normalizeLotRollPart(roll.rollNumber);

  return (
    lotMatches &&
    rollMatches &&
    isRecordSpecCompatibleWithRoll(roll, rec, { requireBothPresent: true })
  );
}

/**
 * Finds the matching roll for a cut record:
 * 1. Exact `rec.foilId` match first (so callers can still inspect and quarantine explicit spec conflicts).
 * 2. Otherwise unambiguous 4-part composite match (`lotNumber + rollNumber + width + pattern`).
 */
export function findMatchingRollForRecord(
  rolls: FoilRoll[],
  rec: StockCutRecord
): FoilRoll | undefined {
  if (rec.foilId) {
    const byId = rolls.find((r) => r.id === rec.foilId);
    if (byId) return byId;
  }

  const lotKey = normalizeLotRollPart(rec.lotNumber);
  const rollKey = normalizeLotRollPart(rec.rollNumber);
  if (!lotKey || !rollKey) return undefined;

  const candidates = rolls.filter(
    (r) =>
      normalizeLotRollPart(r.lotNumber) === lotKey &&
      normalizeLotRollPart(r.rollNumber) === rollKey &&
      isRecordSpecCompatibleWithRoll(r, rec, { requireBothPresent: true })
  );

  return candidates.length === 1 ? candidates[0] : undefined;
}

/**
 * Finds the rightful target roll for a contaminated cut record currently attached to `sourceRollId`.
 * Requires an exact lotNumber + rollNumber + width + pattern match (and returns undefined if ambiguous).
 */
export function findTargetRollForContaminatedRecord(
  allRolls: FoilRoll[],
  sourceRollId: string,
  rec: StockCutRecord
): FoilRoll | undefined {
  const lotKey = normalizeLotRollPart(rec.lotNumber);
  const rollKey = normalizeLotRollPart(rec.rollNumber);
  if (!lotKey || !rollKey) return undefined;

  const candidates = allRolls.filter(
    (r) =>
      r.id !== sourceRollId &&
      normalizeLotRollPart(r.lotNumber) === lotKey &&
      normalizeLotRollPart(r.rollNumber) === rollKey &&
      isRecordSpecCompatibleWithRoll(r, rec, { requireBothPresent: true })
  );

  if (candidates.length === 1) return candidates[0];

  if (candidates.length > 1) {
    const activeCandidates = candidates.filter(
      (r) => r.status !== 'depleted' && !r.isZeroedOut && Number(r.remainingMeters) > 0
    );
    if (activeCandidates.length === 1) return activeCandidates[0];
  }

  return undefined;
}
