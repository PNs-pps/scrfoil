import { FoilRoll, StockCutRecord } from '../types';
import { round2 } from './formatters';

export type SOBugType = 
  | 'DUPLICATE_SO_EXACT'      // รหัส SO เดียวกันและยอดเมตรเท่ากันเป๊ะ (กรอกซ้ำเพราะประวัติไม่ขึ้น)
  | 'SPLIT_PRODUCTION_BATCH'  // รหัส SO เดียวกันแต่เมตรต่างกัน (แบ่งรอบการผลิตปกติ)
  | 'DUPLICATE_SO_MULTIPLE'   // รหัส SO เดียวกันถูกตัดมากกว่า 1 ครั้งในม้วนนี้
  | 'METER_JUMP'              // ยอดคงเหลือโซ่ขาด ยอดก่อนตัดไม่ตรงกับยอดหลังตัดของใบก่อนหน้า
  | 'MATH_DISCREPANCY'        // เลขในใบงานไม่ตรงกัน (used + ng != total หรือ before - total != after)
  | 'NEGATIVE_VALUE'          // พบค่าติดลบหรือตัวเลขผิดรูป (NaN)
  | 'ZERO_METER_CUT'          // บันทึกรายการตัดเป็น 0 เมตร
  | 'MASTER_ROLL_MISMATCH'    // ยอดคงเหลือหน้าม้วนไม่ตรงกับผลรวมที่ตัดจริงในประวัติ SO
  | 'ACCUMULATED_MISMATCH';   // ยอดใช้สะสม (usedMeters/ngMeters) ในม้วนไม่ตรงกับผลรวม

export interface SOBugIssue {
  id: string;
  type: SOBugType;
  severity: 'error' | 'warning' | 'info';
  title: string;
  description: string;
  soNumber?: string;
  recordId?: string;
  duplicateRecordIds?: string[];
  affectedMeters?: number;
  expectedValue?: number;
  actualValue?: number;
  suggestedAction?: string;
  timestamp?: string;
}

export interface TimelineStep {
  index: number;
  record: StockCutRecord;
  isChainValid: boolean;
  expectedBefore: number;
  actualBefore: number;
  jumpDiff: number;
  isMathValid: boolean;
  isDuplicateSO: boolean;
  duplicateCount: number;
  isExactDuplicateSO: boolean;
  isSplitProduction: boolean;
  roundIndex?: number;
}

export interface RollSOAuditResult {
  rollId: string;
  lotNumber: string;
  rollNumber: string;
  pattern: string;
  width: number;
  totalMeters: number;
  currentRemaining: number;
  calculatedRemaining: number;
  diff: number; // currentRemaining - calculatedRemaining
  isZeroedOut: boolean;
  canRestoreZeroed?: boolean;
  totalCutsCount: number;
  totalUsedMeters: number;
  totalNgMeters: number;
  totalDeductedMeters: number;
  rollUsedMeters: number;
  rollNgMeters: number;
  issues: SOBugIssue[];
  hasErrors: boolean;
  hasWarnings: boolean;
  canAutoAdjust: boolean;
  timeline: TimelineStep[];
}

export interface SOAuditOverallSummary {
  totalRolls: number;
  rollsWithIssues: number;
  totalIssuesCount: number;
  duplicateSOIssuesCount: number;
  meterJumpIssuesCount: number;
  masterMismatchCount: number;
  zeroedOutExcludedCount: number;
  readyToAdjustCount: number;
}

const TOLERANCE = 0.05;

/**
 * Audit SO cut history for a single foil roll
 */
export function auditRollSOHistory(
  roll: FoilRoll,
  allRecords: StockCutRecord[]
): RollSOAuditResult {
  // Filter all records belonging to this roll
  const rollRecords = allRecords.filter((r) => r.foilId === roll.id);

  // Chronological sort: oldest cuts first to evaluate the continuous chain
  const sortedRecords = [...rollRecords].sort((a, b) => {
    const timeA = new Date(a.createdAt || a.usageDate || a.recordedDate || 0).getTime();
    const timeB = new Date(b.createdAt || b.usageDate || b.recordedDate || 0).getTime();
    return timeA - timeB;
  });

  const issues: SOBugIssue[] = [];

  // Group by SO Number to detect duplicate SO usage on this roll
  const soMap = new Map<string, StockCutRecord[]>();
  sortedRecords.forEach((rec) => {
    const soKey = (rec.soNumber || '').trim().toUpperCase();
    if (!soKey || rec.cutType === 'non_so') return;
    const list = soMap.get(soKey) || [];
    list.push(rec);
    soMap.set(soKey, list);
  });

  // 1. Check for Duplicate SOs vs Split Production Rounds
  soMap.forEach((cuts, soKey) => {
    if (cuts.length > 1) {
      // If cuts have explicit different production rounds, they are intentional split runs
      const explicitRounds = new Set(cuts.map((c) => (c.productionRound || '').trim()).filter(Boolean));
      const hasDistinctExplicitRounds = explicitRounds.size > 1 && explicitRounds.size === cuts.length;

      // Group cuts by their cut meter amounts AND production round to detect accidental duplicates
      const meterGroups = new Map<string, StockCutRecord[]>();
      cuts.forEach((c) => {
        const roundedMeters = round2(c.totalDeducted || (c.usedMeters + c.ngMeters));
        const roundKey = (c.productionRound || '').trim();
        // A cut is considered an exact duplicate if both meter amount AND production round are the same (or neither specified)
        const groupKey = `${roundKey}::${roundedMeters}`;
        const group = meterGroups.get(groupKey) || [];
        group.push(c);
        meterGroups.set(groupKey, group);
      });

      let hasExactDup = false;
      if (!hasDistinctExplicitRounds) {
        meterGroups.forEach((group, groupKey) => {
          if (group.length > 1) {
            hasExactDup = true;
            const duplicateRecordIds = group.slice(1).map((g) => g.id);
            const [roundName, meterStr] = groupKey.split('::');
            const meterKey = Number(meterStr) || 0;
            issues.push({
              id: `dup-exact-${roll.id}-${soKey}-${groupKey}`,
              type: 'DUPLICATE_SO_EXACT',
              severity: 'error',
              title: `⚠️ พบการตัด SO ${soKey}${roundName ? ` (${roundName})` : ''} ซ้ำ ยอดเมตรเท่ากัน (${meterKey} ม.)`,
              description: `พบการตัด SO ${soKey}${roundName ? ` ${roundName}` : ''} ซ้ำกัน ${group.length} ครั้ง ยอดครั้งละ ${meterKey} ม. เท่ากันเป๊ะ มักเกิดจากบันทึกแล้วประวัติไม่ขึ้นทันที จึงกรอกซ้ำ ทำให้สต๊อกถูกหักเบิ้ลไป ${round2(meterKey * (group.length - 1))} ม.`,
              soNumber: soKey,
              recordId: group[0].id,
              duplicateRecordIds,
              affectedMeters: round2(meterKey * (group.length - 1)),
              suggestedAction: 'กดยกเลิกหรือลบรายการตัดที่ซ้ำออก 1 รายการเพื่อคืนยอดสต๊อก หรือแก้ไขระบุรอบการผลิตให้ถูกต้อง',
              timestamp: group[1].createdAt || group[1].usageDate,
            });
          }
        });
      }

      // If cuts have different meters or distinct rounds, this is legitimate split production (แบ่งรอบการผลิต)
      if (!hasExactDup) {
        const roundsDesc = cuts.map((c, i) => {
          const rLabel = c.productionRound || `รอบ ${i + 1}`;
          return `${rLabel}: ${round2(c.totalDeducted || (c.usedMeters + c.ngMeters))}ม.`;
        }).join(', ');

        issues.push({
          id: `split-prod-${roll.id}-${soKey}`,
          type: 'SPLIT_PRODUCTION_BATCH',
          severity: 'info',
          title: `SO ${soKey} แบ่งรอบการผลิต (${cuts.length} รอบ)`,
          description: `พบ SO ${soKey} ในม้วนนี้ ${cuts.length} ครั้ง (${roundsDesc}) ซึ่งเป็นการแบ่งรอบการผลิตตามใบงาน`,
          soNumber: soKey,
          affectedMeters: round2(cuts.reduce((s, c) => s + (c.totalDeducted || (c.usedMeters + c.ngMeters)), 0)),
          suggestedAction: 'ไม่มีข้อผิดพลาด (ระบบรองรับการแบ่งรอบการผลิตของ SO)',
          timestamp: cuts[0].createdAt,
        });
      }
    }
  });

  // 2. Timeline Step-by-Step Chain & Jump Analysis
  let runningRemaining = Number(roll.totalMeters || 0);
  let totalUsed = 0;
  let totalNg = 0;
  let totalDeducted = 0;

  const timeline: TimelineStep[] = [];

  sortedRecords.forEach((rec, idx) => {
    const safeUsed = Math.abs(Number(rec.usedMeters || 0));
    const safeNg = Math.abs(Number(rec.ngMeters || 0));
    const safeTotal = Math.abs(Number(rec.totalDeducted ?? (safeUsed + safeNg)));
    const safeBefore = Number(rec.remainingBefore ?? 0);
    const safeAfter = Number(rec.remainingAfter ?? 0);

    totalUsed = round2(totalUsed + safeUsed);
    totalNg = round2(totalNg + safeNg);
    totalDeducted = round2(totalDeducted + safeTotal);

    // Math check: used + ng == total
    const mathSumDiff = Math.abs(safeTotal - (safeUsed + safeNg));
    const mathSubDiff = Math.abs(safeBefore - safeTotal - safeAfter);
    const isMathValid = mathSumDiff < TOLERANCE && (rec.remainingBefore === undefined || mathSubDiff < TOLERANCE);

    if (mathSumDiff >= TOLERANCE) {
      issues.push({
        id: `math-sum-${rec.id}`,
        type: 'MATH_DISCREPANCY',
        severity: 'error',
        title: `การบวกเลขในใบงาน SO ${rec.soNumber || '-'} ไม่ตรง`,
        description: `รวมตัดออก (${safeTotal} ม.) ไม่เท่ากับ ผลรวมของ ตัดใช้ (${safeUsed} ม.) + NG (${safeNg} ม.)`,
        soNumber: rec.soNumber,
        recordId: rec.id,
        affectedMeters: round2(Math.abs(safeTotal - (safeUsed + safeNg))),
        suggestedAction: 'ยอดตัดออกควรเท่ากับยอดใช้จริงบวก NG',
      });
    }

    // Negative / Zero value check
    if (rec.usedMeters < 0 || rec.ngMeters < 0 || rec.totalDeducted < 0) {
      issues.push({
        id: `neg-${rec.id}`,
        type: 'NEGATIVE_VALUE',
        severity: 'error',
        title: `พบตัวเลขติดลบในรายการ SO ${rec.soNumber || '-'}`,
        description: `ตัดใช้: ${rec.usedMeters} ม., NG: ${rec.ngMeters} ม., รวมตัด: ${rec.totalDeducted} ม.`,
        soNumber: rec.soNumber,
        recordId: rec.id,
        suggestedAction: 'ตรวจสอบและแก้ไขตัวเลขให้เป็นค่าบวก',
      });
    } else if (safeTotal === 0) {
      issues.push({
        id: `zero-${rec.id}`,
        type: 'ZERO_METER_CUT',
        severity: 'info',
        title: `รายการ SO ${rec.soNumber || '-'} มียอดตัด 0 เมตร`,
        description: 'ไม่มีการหักสต๊อกในรายการนี้',
        soNumber: rec.soNumber,
        recordId: rec.id,
      });
    }

    // Continuity jump check: compare actual before to runningRemaining
    const expectedBefore = runningRemaining;
    const jumpDiff = round2(safeBefore - expectedBefore);
    const isChainValid = idx === 0 || Math.abs(jumpDiff) < TOLERANCE;

    if (!isChainValid && Math.abs(jumpDiff) >= TOLERANCE) {
      issues.push({
        id: `jump-${rec.id}`,
        type: 'METER_JUMP',
        severity: 'warning',
        title: `ยอดคงเหลือก่อนตัดกระโดดที่ SO ${rec.soNumber || '-'} (${jumpDiff > 0 ? '+' : ''}${jumpDiff} ม.)`,
        description: `ก่อนตัดระบุไว้ ${safeBefore} ม. แต่ยอดสะสมที่ควรเหลือจากใบก่อนหน้าคือ ${expectedBefore} ม. (ผลต่าง ${jumpDiff > 0 ? 'เพิ่มขึ้น +' : 'ลดลง '}${Math.abs(jumpDiff)} ม.) อาจมีการแก้ไขยอดม้วนโดยตรงหรือมีรายการตัดอื่นแทรก`,
        soNumber: rec.soNumber,
        recordId: rec.id,
        affectedMeters: Math.abs(jumpDiff),
        expectedValue: expectedBefore,
        actualValue: safeBefore,
        suggestedAction: 'ปรับยอดคงเหลือให้สอดคล้องกับประวัติการตัดตามลำดับ',
      });
    }

    // Update running expected remaining after this cut
    runningRemaining = round2(Math.max(0, expectedBefore - safeTotal));

    const soKey = (rec.soNumber || '').trim().toUpperCase();
    const allCutsForSO = soMap.get(soKey) || [];
    const dupCount = allCutsForSO.length;
    
    // Check if another cut of this SO has exact same meters
    const exactMatches = allCutsForSO.filter(
      (c) => Math.abs((c.totalDeducted || (c.usedMeters + c.ngMeters)) - safeTotal) < 0.05
    );
    const isExactDuplicateSO = exactMatches.length > 1;
    const isSplitProduction = dupCount > 1 && !isExactDuplicateSO;
    const roundIndex = allCutsForSO.findIndex((c) => c.id === rec.id) + 1;

    timeline.push({
      index: idx + 1,
      record: rec,
      isChainValid,
      expectedBefore,
      actualBefore: safeBefore,
      jumpDiff,
      isMathValid,
      isDuplicateSO: dupCount > 1,
      duplicateCount: dupCount,
      isExactDuplicateSO,
      isSplitProduction,
      roundIndex,
    });
  });

  // 3. Compare with Roll Master Document State
  const calculatedRemaining = round2(Math.max(0, Number(roll.totalMeters || 0) - totalDeducted));
  const currentRemaining = round2(Number(roll.remainingMeters || 0));
  const diff = round2(currentRemaining - calculatedRemaining);

  // A roll is ONLY zeroed out if explicitly set by user (roll.isZeroedOut === true)
  // NEVER infer zeroed-out from remainingMeters === 0 or depleted status,
  // because that wrongly locks rolls whose balance became 0 and prevents recovery!
  const isZeroedOut = Boolean(roll.isZeroedOut);

  if (isZeroedOut) {
    if (calculatedRemaining > 0 && currentRemaining === 0) {
      issues.push({
        id: `zeroed-notice-${roll.id}`,
        type: 'MASTER_ROLL_MISMATCH',
        severity: 'info',
        title: 'ม้วนนี้ถูกตั้งค่าติ๊กเป็น 0 (เศษหางม้วน)',
        description: `คำนวณจาก SO ควรเหลือ ${calculatedRemaining} ม. แต่สถานะม้วนถูกตั้งเป็น 0 ม. คุณสามารถกด "คืนค่ายอดตาม SO" เพื่อนำม้วนนี้กลับมาใช้งานต่อได้`,
        suggestedAction: `กดปุ่ม "คืนค่ายอดตาม SO" เพื่อปรับยอดกลับเป็น ${calculatedRemaining} ม.`,
        affectedMeters: calculatedRemaining,
        expectedValue: calculatedRemaining,
        actualValue: currentRemaining,
      });
    }
  } else {
    // Check if remainingMeters does not match calculatedRemaining
    if (Math.abs(diff) > TOLERANCE) {
      const isZeroBug = currentRemaining === 0 && calculatedRemaining > 0;
      issues.push({
        id: `master-diff-${roll.id}`,
        type: 'MASTER_ROLL_MISMATCH',
        severity: 'error',
        title: isZeroBug
          ? `⚠️ ยอดคงเหลือม้วนกลายเป็น 0 ม. (คำนวณจากใบตัด SO ควรเหลือ ${calculatedRemaining} ม.)`
          : `ยอดคงเหลือหน้าสต๊อกไม่ตรงกับผลรวมตัด SO (ผลต่าง ${diff > 0 ? '+' : ''}${diff} ม.)`,
        description: isZeroBug
          ? `สต๊อกหน้าแอปแสดง 0 ม. แต่คำนวณจากยอดรับเข้า (${roll.totalMeters} ม.) หักยอดตัดจริงทุกใบ (${totalDeducted} ม.) ควรเหลือ ${calculatedRemaining} ม. สามารถกดปุ่มปรับยอดเพื่อคืนสต๊อกได้ทันที`
          : `สต๊อกหน้าแอปแสดง: ${currentRemaining} ม. แต่คำนวณจากยอดรับเข้า (${roll.totalMeters} ม.) ลบยอดตัดจริงทุกใบ (${totalDeducted} ม.) ควรเหลือ ${calculatedRemaining} ม.`,
        affectedMeters: Math.abs(diff),
        expectedValue: calculatedRemaining,
        actualValue: currentRemaining,
        suggestedAction: `ปรับยอดคงเหลือม้วนนี้ให้ตรงกับยอดคำนวณจริงจากใบสั่งตัด SO (${calculatedRemaining} ม.)`,
      });
    }
  }

  // 4. Check roll.usedMeters and roll.ngMeters accumulated counters
  const rollUsed = round2(Number(roll.usedMeters || 0));
  const rollNg = round2(Number(roll.ngMeters || 0));
  if (Math.abs(rollUsed - totalUsed) > TOLERANCE || Math.abs(rollNg - totalNg) > TOLERANCE) {
    issues.push({
      id: `acc-diff-${roll.id}`,
      type: 'ACCUMULATED_MISMATCH',
      severity: 'warning',
      title: 'ตัวเลขสถิติสะสม (ใช้จริง/NG) ในม้วนไม่ตรงกับผลรวมใบตัด',
      description: `ในม้วนบันทึก: ใช้ ${rollUsed} ม. / NG ${rollNg} ม. แต่ผลรวมในรายการตัดจริงคือ: ใช้ ${totalUsed} ม. / NG ${totalNg} ม.`,
      suggestedAction: 'ระบบจะอัปเดตสถิติสะสมให้ตรงกับประวัติ SO โดยอัตโนมัติเมื่อทำการปรับยอด',
    });
  }

  const hasErrors = issues.some((i) => i.severity === 'error');
  const hasWarnings = issues.some((i) => i.severity === 'warning');
  const canAutoAdjust = Math.abs(diff) > TOLERANCE;
  const canRestoreZeroed = (isZeroedOut && calculatedRemaining > 0) || (currentRemaining === 0 && calculatedRemaining > 0);

  return {
    rollId: roll.id,
    lotNumber: roll.lotNumber,
    rollNumber: roll.rollNumber,
    pattern: roll.pattern,
    width: roll.width,
    totalMeters: roll.totalMeters,
    currentRemaining,
    calculatedRemaining,
    diff,
    isZeroedOut,
    totalCutsCount: sortedRecords.length,
    totalUsedMeters: totalUsed,
    totalNgMeters: totalNg,
    totalDeductedMeters: totalDeducted,
    rollUsedMeters: rollUsed,
    rollNgMeters: rollNg,
    issues,
    hasErrors,
    hasWarnings,
    canAutoAdjust,
    canRestoreZeroed,
    timeline,
  };
}

/**
 * Audit all rolls and return sorted by issue severity
 */
export function auditAllRollsSOHistory(
  rolls: FoilRoll[],
  records: StockCutRecord[]
): RollSOAuditResult[] {
  const results = rolls.map((r) => auditRollSOHistory(r, records));

  // Sort: rolls with errors first, then warnings, then mismatches, then clean rolls
  return results.sort((a, b) => {
    if (a.hasErrors && !b.hasErrors) return -1;
    if (!a.hasErrors && b.hasErrors) return 1;
    if (a.hasWarnings && !b.hasWarnings) return -1;
    if (!a.hasWarnings && b.hasWarnings) return 1;
    if (a.canAutoAdjust && !b.canAutoAdjust) return -1;
    if (!a.canAutoAdjust && b.canAutoAdjust) return 1;
    return Math.abs(b.diff) - Math.abs(a.diff);
  });
}

/**
 * Get overall summary statistics across all audited rolls
 */
export function getSOAuditOverallSummary(
  auditResults: RollSOAuditResult[]
): SOAuditOverallSummary {
  let rollsWithIssues = 0;
  let totalIssuesCount = 0;
  let duplicateSOIssuesCount = 0;
  let meterJumpIssuesCount = 0;
  let masterMismatchCount = 0;
  let zeroedOutExcludedCount = 0;
  let readyToAdjustCount = 0;

  auditResults.forEach((res) => {
    if (res.issues.length > 0) {
      rollsWithIssues += 1;
      totalIssuesCount += res.issues.length;
    }

    res.issues.forEach((iss) => {
      if (iss.type === 'DUPLICATE_SO_EXACT' || iss.type === 'DUPLICATE_SO_MULTIPLE') {
        duplicateSOIssuesCount += 1;
      }
      if (iss.type === 'METER_JUMP') {
        meterJumpIssuesCount += 1;
      }
      if (iss.type === 'MASTER_ROLL_MISMATCH') {
        masterMismatchCount += 1;
      }
    });

    if (res.isZeroedOut) {
      zeroedOutExcludedCount += 1;
    }

    if (res.canAutoAdjust) {
      readyToAdjustCount += 1;
    }
  });

  return {
    totalRolls: auditResults.length,
    rollsWithIssues,
    totalIssuesCount,
    duplicateSOIssuesCount,
    meterJumpIssuesCount,
    masterMismatchCount,
    zeroedOutExcludedCount,
    readyToAdjustCount,
  };
}
