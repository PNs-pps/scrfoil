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

// Automatic one-time cleanup to ensure the requested empty clean state
function checkAndCleanInitialState() {
  try {
    if (!localStorage.getItem(STORAGE_KEYS.CLEAN_INITIALIZED)) {
      // Clear old cached test data
      localStorage.removeItem('pufoam_foil_rolls_v1');
      localStorage.removeItem('pufoam_cut_records_v1');
      localStorage.removeItem('pufoam_foil_rolls_v2');
      localStorage.removeItem('pufoam_cut_records_v2');
      localStorage.setItem(STORAGE_KEYS.ROLLS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.CLEAN_INITIALIZED, 'true');
    }
  } catch {}
}

export function getStoredRolls(): FoilRoll[] {
  try {
    checkAndCleanInitialState();
    const raw = localStorage.getItem(STORAGE_KEYS.ROLLS);
    if (!raw) {
      saveStoredRolls(INITIAL_FOIL_ROLLS);
      return INITIAL_FOIL_ROLLS;
    }
    const parsed: FoilRoll[] = JSON.parse(raw);
    // Normalize spelling for existing saved data
    return parsed.map(r => ({
      ...r,
      pattern: normalizePattern(r.pattern),
    }));
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
    const raw = localStorage.getItem(STORAGE_KEYS.RECORDS);
    if (!raw) {
      saveStoredCutRecords(INITIAL_CUT_RECORDS);
      return INITIAL_CUT_RECORDS;
    }
    const parsed: StockCutRecord[] = JSON.parse(raw);
    return parsed.map(r => ({
      ...r,
      pattern: normalizePattern(r.pattern),
    }));
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
    `"${r.soNumber}"`,
    `"${r.lotNumber}"`,
    `"${r.rollNumber}"`,
    r.width,
    `"${r.pattern}"`,
    r.usedMeters,
    r.ngMeters,
    r.totalDeducted,
    r.remainingBefore,
    r.remainingAfter,
    `"${r.usageDate}"`,
    `"${r.recordedDate}"`,
    `"${r.recordedBy.replace(/"/g, '""')}"`,
    `"${(r.notes || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(row => row.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `foil_stock_cut_history_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
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
    `"${r.lotNumber}"`,
    `"${r.rollNumber}"`,
    r.width,
    `"${r.pattern}"`,
    r.totalMeters,
    r.remainingMeters,
    r.usedMeters,
    r.ngMeters,
    r.status === 'active' ? 'พร้อมใช้งาน' : 'หมดแล้ว',
    `"${r.dateReceived}"`,
    `"${(r.notes || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(row => row.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `foil_inventory_summary_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
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
    'ยอด NG (กก.)',
    'ยอด NG (ม.)',
    'ความยาวที่ผลิต (ม.)',
    'ผู้บันทึก',
    'หมายเหตุ',
    'เวลาบันทึก'
  ];

  const rows = records.map(r => [
    `"${r.soNumber}"`,
    `"${r.productionDate || ''}"`,
    `"${r.coilColor}"`,
    `"${r.thickness}"`,
    `"${r.coilNumber}"`,
    `"${r.steelOrigin === 'อื่นๆ' && r.customSteelOrigin ? `${r.steelOrigin} (${r.customSteelOrigin})` : r.steelOrigin}"`,
    r.weightBefore,
    r.weightAfter,
    r.weightUsed,
    r.ngKg ?? 0,
    r.ngMeters ?? 0,
    r.lengthMeters ?? '',
    `"${(r.recordedBy || '').replace(/"/g, '""')}"`,
    `"${(r.notes || '').replace(/"/g, '""')}"`,
    `"${r.createdAt}"`
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(row => row.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `pu_sandwich_cuts_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
