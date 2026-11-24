import { describe, it, expect } from 'vitest';
import { mergeRollCutHistory, detectTimelineAnomalies } from './rollHistoryMerge';
import { CutHistoryItem, FoilRoll, StockCutRecord } from '../types';

const makeRoll = (overrides: Partial<FoilRoll> = {}): FoilRoll => ({
  id: 'roll-vip36-830',
  lotNumber: 'VIP36',
  rollNumber: '02',
  width: 830,
  pattern: 'ไม้เข้ม',
  totalMeters: 1000,
  remainingMeters: 154,
  usedMeters: 780,
  ngMeters: 66,
  status: 'active',
  dateReceived: '2026-10-01',
  createdAt: '2026-10-01T00:00:00.000Z',
  ...overrides,
});

const makeRootRec = (overrides: Partial<StockCutRecord> = {}): StockCutRecord => ({
  id: 'cut-1',
  foilId: 'roll-vip36-830',
  lotNumber: 'VIP36',
  rollNumber: '02',
  width: 830,
  pattern: 'ไม้เข้ม',
  soNumber: 'so6911380',
  usedMeters: 147.86,
  ngMeters: 84.17,
  totalDeducted: 232.03,
  remainingBefore: 386.03,
  remainingAfter: 154,
  usageDate: '2026-11-21',
  recordedDate: '2026-11-21',
  recordedBy: 'Tester',
  createdAt: '2026-11-21T10:00:00.000Z',
  cutStatus: 'completed',
  ...overrides,
});

const makeSubItem = (overrides: Partial<CutHistoryItem> = {}): CutHistoryItem => ({
  id: 'cut-1',
  soNumber: 'so6911380',
  cutMeters: 147.86,
  usedMeters: 147.86,
  ngMeters: 84.17,
  totalDeducted: 232.03,
  remainingBefore: 386.03,
  remainingAfter: 154,
  cutDate: '2026-11-21',
  usageDate: '2026-11-21',
  recordedDate: '2026-11-21',
  recordedBy: 'Tester',
  createdAt: '2026-11-21T10:00:00.000Z',
  cutStatus: 'completed',
  rollId: 'roll-vip36-830',
  lotNumber: 'VIP36',
  rollNumber: '02',
  width: 830,
  pattern: 'ไม้เข้ม',
  ...overrides,
});

describe('mergeRollCutHistory & detectTimelineAnomalies', () => {
  it('excludes stale cut_history subcollection entries when root record moved to another foilId (same lot+roll)', () => {
    const roll830 = makeRoll({
      id: 'roll-vip36-830',
      width: 830,
      pattern: 'ไม้เข้ม',
    });

    // In stock_cut_records, cut-moved already belongs to roll-vip36-880 (same lot VIP36 #02!)
    const rootRecords: StockCutRecord[] = [
      makeRootRec({
        id: 'cut-own',
        foilId: 'roll-vip36-830',
        width: 830,
        pattern: 'ไม้เข้ม',
      }),
      makeRootRec({
        id: 'cut-moved',
        foilId: 'roll-vip36-880',
        width: 880,
        pattern: 'ไม้เข้ม',
        soNumber: 'so6911039',
      }),
      makeRootRec({
        id: 'cut-cancelled',
        foilId: 'roll-vip36-830',
        cutStatus: 'cancelled',
        soNumber: 'so6911999',
      }),
    ];

    // Stale cut_history on roll-vip36-830 still contains cut-moved (even without width!) & cut-cancelled
    const staleSubItems: CutHistoryItem[] = [
      makeSubItem({ id: 'cut-own' }),
      makeSubItem({
        id: 'cut-moved',
        soNumber: 'so6911039',
        width: undefined,
        pattern: undefined,
        remainingBefore: 110.64,
        remainingAfter: -40.56,
      }),
      makeSubItem({
        id: 'cut-cancelled',
        soNumber: 'so6911999',
      }),
      makeSubItem({
        id: 'cut-other-spec',
        soNumber: 'so6911118',
        width: 880,
        pattern: 'ขาว',
      }),
    ];

    const res = mergeRollCutHistory(roll830, rootRecords, staleSubItems);
    expect(res.items.map((i) => i.id)).toEqual(['cut-own']);
    expect(res.staleSubItemIds).toEqual(['cut-moved']);
    expect(res.cancelledSubItemIds).toEqual(['cut-cancelled']);
    expect(res.crossSpecSubItemIds).toEqual(['cut-other-spec']);
    expect(res.rejectedSubCount).toBe(3);
  });

  it('excludes subcollection items whose lotNumber/rollNumber or rollId differs from target roll', () => {
    const roll = makeRoll();
    const res = mergeRollCutHistory(roll, [], [
      makeSubItem({ id: 'ok-1', lotNumber: 'VIP36', rollNumber: '02' }),
      makeSubItem({ id: 'wrong-lot', lotNumber: 'VIP37', rollNumber: '02' }),
      makeSubItem({ id: 'wrong-rollno', lotNumber: 'VIP36', rollNumber: '05' }),
      makeSubItem({ id: 'wrong-rollid', rollId: 'roll-other-id' }),
    ]);

    expect(res.items.map((i) => i.id)).toEqual(['ok-1']);
    expect(res.staleSubItemIds).toEqual(['wrong-lot', 'wrong-rollno', 'wrong-rollid']);
  });

  it('flags negative balances and interleaved split chains like the VIP36 #02 bug screenshot', () => {
    const roll = makeRoll();
    const merged = mergeRollCutHistory(
      roll,
      [
        makeRootRec({
          id: 'c1',
          soNumber: 'so6911050',
          totalDeducted: 15.6,
          remainingBefore: 564.99,
          remainingAfter: 549.39,
          usageDate: '2026-11-04',
          createdAt: '2026-11-04T08:00:00Z',
        }),
        makeRootRec({
          id: 'c2',
          soNumber: 'so6911039',
          totalDeducted: 151.2,
          remainingBefore: 110.64,
          remainingAfter: -40.56,
          usageDate: '2026-11-04',
          createdAt: '2026-11-04T09:00:00Z',
        }),
        makeRootRec({
          id: 'c3',
          soNumber: 'so6911077',
          totalDeducted: 40,
          remainingBefore: 491.89,
          remainingAfter: 451.89,
          usageDate: '2026-11-07',
          createdAt: '2026-11-07T08:00:00Z',
        }),
        makeRootRec({
          id: 'c4',
          soNumber: 'so6911118',
          totalDeducted: 51.7,
          remainingBefore: -138.06,
          remainingAfter: -189.76,
          usageDate: '2026-11-07',
          createdAt: '2026-11-07T09:00:00Z',
        }),
      ],
      []
    );

    const anomaly = detectTimelineAnomalies(merged.items, roll);
    expect(anomaly.hasMixedOrCorruptTimeline).toBe(true);
    expect(anomaly.negativeBalanceIds).toEqual(['c2', 'c4']);
    expect(anomaly.depletionEventCount).toBe(2);
    expect(anomaly.interleavedChainCount).toBeGreaterThanOrEqual(2);
  });

  it('preserves missing spec flag (isSpecVerified = false) on legacy records instead of hiding it', () => {
    const roll = makeRoll();
    const res = mergeRollCutHistory(
      roll,
      [
        makeRootRec({
          id: 'legacy-no-spec',
          width: undefined as any,
          pattern: '' as any,
        }),
      ],
      []
    );
    expect(res.items).toHaveLength(1);
    expect(res.items[0].isSpecVerified).toBe(false);
    const anomaly = detectTimelineAnomalies(res.items, roll);
    expect(anomaly.unverifiedSpecIds).toEqual(['legacy-no-spec']);
  });
});
