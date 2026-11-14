import { describe, it, expect } from 'vitest';
import { getRestorableZeroedMeters } from './rollZeroRestore';
import { FoilRoll, StockCutRecord } from '../types';

const baseRoll = (overrides: Partial<FoilRoll> = {}): FoilRoll => ({
  id: 'foil-test-1',
  lotNumber: 'LOT-01',
  rollNumber: '01',
  width: 850,
  pattern: 'ขาว',
  totalMeters: 1000,
  remainingMeters: 0,
  usedMeters: 950,
  ngMeters: 15,
  status: 'depleted',
  dateReceived: '2026-11-01',
  createdAt: '2026-11-01T00:00:00.000Z',
  isZeroedOut: true,
  ...overrides,
});

describe('getRestorableZeroedMeters', () => {
  it('prefers manualZeroedOriginalMeters when present and positive', () => {
    const roll = baseRoll({ manualZeroedOriginalMeters: 32.45 });
    expect(getRestorableZeroedMeters(roll, [])).toBe(32.45);
  });

  it('falls back to SO audit calculatedRemaining when manualZeroedOriginalMeters is missing or zero', () => {
    const roll = baseRoll({ manualZeroedOriginalMeters: undefined });
    const records: StockCutRecord[] = [
      {
        id: 'cut-1',
        foilId: 'foil-test-1',
        lotNumber: 'LOT-01',
        rollNumber: '01',
        width: 850,
        pattern: 'ขาว',
        soNumber: 'so6911001',
        usedMeters: 950,
        ngMeters: 15,
        totalDeducted: 965,
        remainingBefore: 1000,
        remainingAfter: 35,
        usageDate: '2026-11-02',
        recordedDate: '2026-11-02',
        recordedBy: 'Tester',
        createdAt: '2026-11-02T00:00:00.000Z',
        cutStatus: 'completed',
      },
    ];
    expect(getRestorableZeroedMeters(roll, records)).toBe(35);
    expect(getRestorableZeroedMeters(baseRoll({ manualZeroedOriginalMeters: 0 }), records)).toBe(35);
  });

  it('falls back to totalMeters - usedMeters - ngMeters when no cut records exist', () => {
    const roll = baseRoll({ totalMeters: 1000, usedMeters: 940, ngMeters: 18, manualZeroedOriginalMeters: undefined });
    expect(getRestorableZeroedMeters(roll)).toBe(42);
  });
});
