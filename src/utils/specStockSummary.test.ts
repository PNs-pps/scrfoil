import { describe, it, expect } from 'vitest';
import type { FoilRoll, StockCutRecord } from '../types';
import {
  getSortedAlertSummaries,
  groupSummariesByWidth,
  summarizeStockByWidthPattern,
} from './specStockSummary';

const makeRoll = (overrides: Partial<FoilRoll>): FoilRoll => ({
  id: 'roll-1',
  lotNumber: 'LOT-1',
  rollNumber: '01',
  width: 850,
  pattern: 'ขาว',
  totalMeters: 1000,
  remainingMeters: 1000,
  usedMeters: 0,
  ngMeters: 0,
  dateReceived: '2026-11-01',
  status: 'active',
  isUnused: true,
  createdAt: '2026-11-01T00:00:00.000Z',
  ...overrides,
});

const makeRec = (overrides: Partial<StockCutRecord>): StockCutRecord => ({
  id: 'rec-1',
  foilId: 'roll-1',
  lotNumber: 'LOT-1',
  rollNumber: '01',
  width: 850,
  pattern: 'ขาว',
  soNumber: 'so6911001',
  cutStatus: 'reserved',
  usedMeters: 120,
  ngMeters: 0,
  totalDeducted: 120,
  remainingBefore: 1000,
  remainingAfter: 880,
  usageDate: '2026-11-20',
  recordedDate: '2026-11-20',
  recordedBy: 'Tester',
  createdAt: '2026-11-20T00:00:00.000Z',
  ...overrides,
});

describe('summarizeStockByWidthPattern', () => {
  it('flags critical (0 full rolls -> red) and warning (1 full roll -> yellow) and keeps normal (>= 2 full rolls) out of alerts', () => {
    const rolls: FoilRoll[] = [
      // 830 ขาว -> 0 full rolls, 2 partial rolls -> critical (red)
      makeRoll({ id: 'a1', width: 830, pattern: 'ขาว', remainingMeters: 350, usedMeters: 650, isUnused: false }),
      makeRoll({ id: 'a2', width: 830, pattern: 'ขาว', remainingMeters: 120, usedMeters: 880, isUnused: false }),
      // 850 ดำ -> 1 full roll, 1 partial roll -> warning (yellow)
      makeRoll({ id: 'b1', width: 850, pattern: 'ดำ', remainingMeters: 1000, usedMeters: 0, isUnused: true }),
      makeRoll({ id: 'b2', width: 850, pattern: 'ดำ', remainingMeters: 420, usedMeters: 580, isUnused: false }),
      // 880 เทา -> 2 full rolls -> normal
      makeRoll({ id: 'c1', width: 880, pattern: 'เทา', remainingMeters: 1000, usedMeters: 0, isUnused: true }),
      makeRoll({ id: 'c2', width: 880, pattern: 'เทา', remainingMeters: 1000, usedMeters: 0, isUnused: true }),
    ];

    const summaries = summarizeStockByWidthPattern(rolls, []);
    const s830 = summaries.find((s) => s.width === 830 && s.pattern === 'ขาว')!;
    const s850 = summaries.find((s) => s.width === 850 && s.pattern === 'ดำ')!;
    const s880 = summaries.find((s) => s.width === 880 && s.pattern === 'เทา')!;

    expect(s830.fullRollCount).toBe(0);
    expect(s830.partialRollCount).toBe(2);
    expect(s830.totalRemainingMeters).toBe(470);
    expect(s830.alertLevel).toBe('critical');
    expect(s830.shouldShowInAlertBox).toBe(true);

    expect(s850.fullRollCount).toBe(1);
    expect(s850.partialRollCount).toBe(1);
    expect(s850.totalRemainingMeters).toBe(1420);
    expect(s850.alertLevel).toBe('warning');
    expect(s850.shouldShowInAlertBox).toBe(true);

    expect(s880.fullRollCount).toBe(2);
    expect(s880.totalRemainingMeters).toBe(2000);
    expect(s880.alertLevel).toBe('normal');
    expect(s880.shouldShowInAlertBox).toBe(false);

    const alerts = getSortedAlertSummaries(summaries);
    expect(alerts.map((a) => `${a.width}-${a.alertLevel}`)).toEqual([
      '830-critical',
      '850-warning',
    ]);
  });

  it('does not count a full roll with an active SO reservation as an unused full roll and deducts compatible SO reservations', () => {
    const rolls: FoilRoll[] = [
      makeRoll({ id: 'f1', width: 850, pattern: 'ขาว', remainingMeters: 1000, usedMeters: 0, isUnused: true }),
      makeRoll({ id: 'f2', width: 850, pattern: 'ขาว', remainingMeters: 1000, usedMeters: 0, isUnused: true }),
    ];

    const records: StockCutRecord[] = [
      // Valid compatible reservation on f1
      makeRec({ id: 'r1', foilId: 'f1', width: 850, pattern: 'ขาว', usedMeters: 250, totalDeducted: 250, cutStatus: 'reserved' }),
      // Cross-spec contaminated reservation on f2 must NOT reduce f2 or pollute reservedMeters
      makeRec({ id: 'r2', foilId: 'f2', width: 900, pattern: 'ดำ', usedMeters: 400, totalDeducted: 400, cutStatus: 'reserved' }),
      // Completed/cancelled records must NOT count as reserved
      makeRec({ id: 'r3', foilId: 'f2', width: 850, pattern: 'ขาว', usedMeters: 100, totalDeducted: 100, cutStatus: 'completed' }),
    ];

    const summaries = summarizeStockByWidthPattern(rolls, records);
    expect(summaries).toHaveLength(1);
    const s = summaries[0];
    expect(s.fullRollCount).toBe(1);
    expect(s.partialRollCount).toBe(1);
    expect(s.totalRemainingMeters).toBe(2000);
    expect(s.reservedMeters).toBe(250);
    expect(s.netAvailableMeters).toBe(1750);
    expect(s.alertLevel).toBe('warning');
  });

  it('merges legacy pattern aliases and excludes zeroed/depleted rolls while separating reverse-side-only rolls', () => {
    const rolls: FoilRoll[] = [
      makeRoll({ id: 'p1', width: 900, pattern: 'ท้องขาว', remainingMeters: 1000, usedMeters: 0, isUnused: true }),
      makeRoll({ id: 'p2', width: 900, pattern: 'ขาว', remainingMeters: 300, usedMeters: 700, isUnused: false }),
      makeRoll({ id: 'p3', width: 900, pattern: 'ขาว', remainingMeters: 500, usedMeters: 0, isUnused: true, isReverseSideOnly: true }),
      makeRoll({ id: 'p4', width: 900, pattern: 'ขาว', remainingMeters: 30, usedMeters: 970, isZeroedOut: true, status: 'depleted' }),
    ];

    const summaries = summarizeStockByWidthPattern(rolls, []);
    expect(summaries).toHaveLength(1);
    const s = summaries[0];
    expect(s.pattern).toBe('ขาว');
    expect(s.activeRollCount).toBe(3);
    expect(s.fullRollCount).toBe(1);
    expect(s.partialRollCount).toBe(1);
    expect(s.reverseOnlyCount).toBe(1);
    expect(s.partialRollsMeters).toBe(300);
    expect(s.reverseOnlyMeters).toBe(500);
    expect(s.usableRemainingMeters).toBe(1300);
    expect(s.totalRemainingMeters).toBe(1800);
  });

  it('aggregates zeroFullRollCount and oneFullRollCount per width for automatic width highlight dots', () => {
    const rolls: FoilRoll[] = [
      // 830: ขาว has 0 full rolls, ดำ has 1 full roll
      makeRoll({ id: 'w1', width: 830, pattern: 'ขาว', remainingMeters: 220, usedMeters: 780, isUnused: false }),
      makeRoll({ id: 'w2', width: 830, pattern: 'ดำ', remainingMeters: 1000, usedMeters: 0, isUnused: true }),
      // 850: ขาว has 1 full roll (no 0-full-roll spec -> zeroFullRollCount should be 0!)
      makeRoll({ id: 'w3', width: 850, pattern: 'ขาว', remainingMeters: 1000, usedMeters: 0, isUnused: true }),
      // 880: ขาว has 2 full rolls (both zeroFullRollCount & oneFullRollCount = 0)
      makeRoll({ id: 'w4', width: 880, pattern: 'ขาว', remainingMeters: 1000, usedMeters: 0, isUnused: true }),
      makeRoll({ id: 'w5', width: 880, pattern: 'ขาว', remainingMeters: 1000, usedMeters: 0, isUnused: true }),
    ];

    const summaries = summarizeStockByWidthPattern(rolls, []);
    const widthGroups = groupSummariesByWidth(summaries);

    expect(widthGroups.map((g) => g.width)).toEqual([830, 850, 880]);
    expect(widthGroups[0].zeroFullRollCount).toBe(1);
    expect(widthGroups[0].oneFullRollCount).toBe(1);
    expect(widthGroups[0].totalRemainingMeters).toBe(1220);

    expect(widthGroups[1].zeroFullRollCount).toBe(0);
    expect(widthGroups[1].oneFullRollCount).toBe(1);

    expect(widthGroups[2].zeroFullRollCount).toBe(0);
    expect(widthGroups[2].oneFullRollCount).toBe(0);
  });
});
