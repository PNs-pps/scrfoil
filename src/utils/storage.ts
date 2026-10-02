import { todayLocalYMD, csvCell } from './formatters';
import { FoilRoll, StockCutRecord, PuSandwichCutRecord } from '../types';
import { INITIAL_FOIL_ROLLS, INITIAL_CUT_RECORDS } from '../data/initialData';
import { normalizePattern } from './soFormatter';

const STORAGE_KEYS = {
  ROLLS: 'pufoam_foil_rolls_v3',
  RECORDS: 'pufoam_cut_records_v3',
  PU_SANDWICH: 'pufoam_pu_sandwich_records_v1',
  OPERATOR_NAMES: 'pufoam_operator_names_v3',
  CLEAN_INITIALIZED: 'pufoam_clean_v3_initialized',
};

// Safe initial state recovery — never wipe user data
function checkAndCleanInitialState() {
  // Safe helper: ensure clean initialized flag is set without wiping data
  try {
    if (!localStorage.getItem(STORAGE_KEYS.CLEAN_INITIALIZED)) {
      localStorage.setItem(STORAGE_KEYS.CLEAN_INITIALIZED, 'true');
    }
  } catch {}
}

export function getStoredRolls(): FoilRoll[] {
  try {
    checkAndCleanInitialState();
    let raw = localStorage.getItem(STORAGE_KEYS.ROLLS);
    
    // If v3 is empty or missing, check fallback locations: v2, v1, or backup snapshots
    if (!raw || raw === '[]' || raw.trim() === '') {
      const v2 = localStorage.getItem('pufoam_foil_rolls_v2');
      if (v2 && v2 !== '[]') {
        raw = v2;
      } else {
        const v1 = localStorage.getItem('pufoam_foil_rolls_v1');
        if (v1 && v1 !== '[]') {
          raw = v1;
        } else {
          // Check auto backup snapshots
          const snapRaw = localStorage.getItem('pufoam_autobackup_snapshots_v1');
          if (snapRaw) {
            try {
              const snaps = JSON.parse(snapRaw);
              if (Array.isArray(snaps) && snaps.length > 0) {
                for (const s of snaps) {
                  if (s?.data?.rolls && Array.isArray(s.data.rolls) && s.data.rolls.length > 0) {
                    saveStoredRolls(s.data.rolls);
                    return s.data.rolls.map((r: FoilRoll) => ({
                      ...r,
                      pattern: normalizePattern(r.pattern),
                    }));
                  }
                }
              }
            } catch {}
          }
        }
      }
    }

    if (!raw) {
      saveStoredRolls(INITIAL_FOIL_ROLLS);
      return INITIAL_FOIL_ROLLS;
    }
    const parsed: FoilRoll[] = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      // Check if snapshots have data to recover
      try {
        const snapRaw = localStorage.getItem('pufoam_autobackup_snapshots_v1');
        if (snapRaw) {
          const snaps = JSON.parse(snapRaw);
          if (Array.isArray(snaps)) {
            for (const s of snaps) {
              if (s?.data?.rolls && Array.isArray(s.data.rolls) && s.data.rolls.length > 0) {
                saveStoredRolls(s.data.rolls);
                return s.data.rolls.map((r: FoilRoll) => ({
                  ...r,
                  pattern: normalizePattern(r.pattern),
                }));
              }
            }
          }
        }
      } catch {}
      return [];
    }
    // Normalize spelling for existing saved data
    const normalized = parsed.map(r => ({
      ...r,
      pattern: normalizePattern(r.pattern),
    }));
    // Re-save to current key so future reads are fast
    saveStoredRolls(normalized);
    return normalized;
  } catch (err) {
    console.warn('Failed to load foil rolls from storage', err);
    return INITIAL_FOIL_ROLLS;
  }
}

export function saveStoredRolls(rolls: FoilRoll[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.ROLLS, JSON.stringify(rolls));
  } catch (err) {
    console.warn('Failed to save foil rolls to storage', err);
  }
}

export function getStoredCutRecords(): StockCutRecord[] {
  try {
    checkAndCleanInitialState();
    let raw = localStorage.getItem(STORAGE_KEYS.RECORDS);

    // If v3 is empty or missing, check fallback locations: v2, v1, or backup snapshots
    if (!raw || raw === '[]' || raw.trim() === '') {
      const v2 = localStorage.getItem('pufoam_cut_records_v2');
      if (v2 && v2 !== '[]') {
        raw = v2;
      } else {
        const v1 = localStorage.getItem('pufoam_cut_records_v1');
        if (v1 && v1 !== '[]') {
          raw = v1;
        } else {
          // Check auto backup snapshots
          const snapRaw = localStorage.getItem('pufoam_autobackup_snapshots_v1');
          if (snapRaw) {
            try {
              const snaps = JSON.parse(snapRaw);
              if (Array.isArray(snaps) && snaps.length > 0) {
                for (const s of snaps) {
                  if (s?.data?.records && Array.isArray(s.data.records) && s.data.records.length > 0) {
                    saveStoredCutRecords(s.data.records);
                    return s.data.records.map((r: StockCutRecord) => ({
                      ...r,
                      pattern: normalizePattern(r.pattern),
                    }));
                  }
                }
              }
            } catch {}
          }
        }
      }
    }

    if (!raw) {
      saveStoredCutRecords(INITIAL_CUT_RECORDS);
      return INITIAL_CUT_RECORDS;
    }
    const parsed: StockCutRecord[] = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      // Check if snapshots have records
      try {
        const snapRaw = localStorage.getItem('pufoam_autobackup_snapshots_v1');
        if (snapRaw) {
          const snaps = JSON.parse(snapRaw);
          if (Array.isArray(snaps)) {
            for (const s of snaps) {
              if (s?.data?.records && Array.isArray(s.data.records) && s.data.records.length > 0) {
                saveStoredCutRecords(s.data.records);
                return s.data.records.map((r: StockCutRecord) => ({
                  ...r,
                  pattern: normalizePattern(r.pattern),
                }));
              }
            }
          }
        }
      } catch {}
      return [];
    }
    const normalized = parsed.map(r => ({
      ...r,
      pattern: normalizePattern(r.pattern),
    }));
    saveStoredCutRecords(normalized);
    return normalized;
  } catch (err) {
    console.warn('Failed to load cut records from storage', err);
    return INITIAL_CUT_RECORDS;
  }
}

export function saveStoredCutRecords(records: StockCutRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify(records));
  } catch (err) {
    console.warn('Failed to save cut records to storage', err);
  }
}

export function clearAllData(): { rolls: FoilRoll[]; records: StockCutRecord[] } {
  saveStoredRolls([]);
  saveStoredCutRecords([]);
  return { rolls: [], records: [] };
}

export function resetAllDataToDefault(): { rolls: FoilRoll[]; records: StockCutRecord[] } {
  return clearAllData();
}

export function getRecentOperators(): string[] {
  const defaultOperators = [
    'สมชาย นพคุณ (ช่างเครื่อง)',
    'วิชัย ชัยชนะ',
    'ธีรศักดิ์ สุวรรณ',
    'ประภาส บรรเจิด',
    'อนุชิต สดใส'
  ];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.OPERATOR_NAMES);
    if (!raw) return defaultOperators;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : defaultOperators;
  } catch {
    return defaultOperators;
  }
}

export function saveRecentOperator(name: string): void {
  if (!name.trim()) return;
  const current = getRecentOperators();
  const trimmed = name.trim();
  const updated = [trimmed, ...current.filter(n => n !== trimmed)].slice(0, 10);
  try {
    localStorage.setItem(STORAGE_KEYS.OPERATOR_NAMES, JSON.stringify(updated));
  } catch {}
}


export function exportCutRecordsToCSV(records: StockCutRecord[]): void {
  const headers = [
    'รหัส SO',
    'ล็อต (Lot)',
    'เบอร์ม้วน (Roll No.)',
    'หน้ากว้าง (มม.)',
    'ลายฟอยล์',
    'จำนวนเมตรที่ใช้ (ม.)',
    'NG ที่เสีย (ม.)',
    'รวมตัดออก (ม.)',
    'คงเหลือก่อนตัด (ม.)',
    'คงเหลือหลังตัด (ม.)',
    'วันที่ใช้งาน',
    'วันที่บันทึก',
    'ผู้บันทึก',
    'หมายเหตุ'
  ];

  const rows = records.map(r => [
    csvCell(r.soNumber),
    csvCell(r.lotNumber),
    csvCell(r.rollNumber),
    r.width,
    csvCell(r.pattern),
    r.usedMeters,
    r.ngMeters,
    r.totalDeducted,
    r.remainingBefore ?? '',
    r.remainingAfter,
    csvCell(r.usageDate),
    csvCell(r.recordedDate),
    csvCell(r.recordedBy),
    csvCell(r.notes)
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(row => row.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `foil_stock_cut_history_${todayLocalYMD()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportRollsToCSV(rolls: FoilRoll[]): void {
  const headers = [
    'ล็อต (Lot)',
    'เบอร์ม้วน (Roll No.)',
    'หน้ากว้าง (มม.)',
    'ลายฟอยล์',
    'เมตรลูกเต็ม (ม.)',
    'เมตรคงเหลือ (ม.)',
    'เมตรที่ตัดใช้ (ม.)',
    'NG เสีย (ม.)',
    'สถานะ',
    'วันที่รับเข้า',
    'หมายเหตุ'
  ];

  const rows = rolls.map(r => [
    csvCell(r.lotNumber),
    csvCell(r.rollNumber),
    r.width,
    csvCell(r.pattern),
    r.totalMeters,
    r.remainingMeters,
    r.usedMeters,
    r.ngMeters,
    r.status === 'active' ? 'พร้อมใช้งาน' : 'หมดแล้ว',
    csvCell(r.dateReceived),
    csvCell(r.notes)
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(row => row.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `foil_inventory_summary_${todayLocalYMD()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ----------------------------------------------------
// PU Sandwich Cut Records Storage & Export
// ----------------------------------------------------
export function getStoredPuSandwichRecords(): PuSandwichCutRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PU_SANDWICH);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.warn('Failed to load PU Sandwich records from storage', err);
    return [];
  }
}

export function saveStoredPuSandwichRecords(records: PuSandwichCutRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.PU_SANDWICH, JSON.stringify(records));
  } catch (err) {
    console.warn('Failed to save PU Sandwich records to storage', err);
  }
}

export function exportPuSandwichRecordsToCSV(records: PuSandwichCutRecord[]): void {
  const headers = [
    'รหัส SO',
    'วันที่ผลิต',
    'สีคอล์ย',
    'ความหนา',
    'เบอร์คอล์ย',
    'ชนิดเหล็ก',
    'น้ำหนักก่อนใช้ (กก.)',
    'น้ำหนักหลังใช้ (กก.)',
    'น้ำหนักใช้จริง (กก.)',
    'ความยาวตามใบงาน SO (ม.)',
    'ยอด NG (กก.)',
    'ยอด NG (ม.)',
    'ความยาวที่ผลิตได้ (ม.)',
    'ผู้บันทึก',
    'หมายเหตุ',
    'เวลาบันทึก'
  ];

  const rows = records.map(r => [
    csvCell(r.soNumber),
    csvCell(r.productionDate),
    csvCell(r.coilColor),
    csvCell(r.thickness),
    csvCell(r.coilNumber),
    csvCell(r.steelOrigin === 'อื่นๆ' && r.customSteelOrigin ? `${r.steelOrigin} (${r.customSteelOrigin})` : r.steelOrigin),
    r.weightBefore,
    r.weightAfter,
    r.weightUsed,
    r.soLengthMeters ?? '',
    r.ngKg ?? 0,
    r.ngMeters ?? 0,
    r.lengthMeters ?? '',
    csvCell(r.recordedBy),
    csvCell(r.notes),
    csvCell(r.createdAt)
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(row => row.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `pu_sandwich_cuts_${todayLocalYMD()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
