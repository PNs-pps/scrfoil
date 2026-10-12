import { StockCutRecord, PuSandwichCutRecord, SOAuditDiff, SOAuditLogItem } from '../types';
import { formatMeters, formatThaiDate, formatThaiDateTime } from './formatters';

const STORAGE_KEY = 'pufoam_so_audit_logs_v1';

/**
 * ดึงรายการ Audit Logs ทั้งหมดที่บันทึกไว้ใน LocalStorage
 */
export function loadStoredSOAuditLogs(): SOAuditLogItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Failed to load stored SO audit logs:', err);
    return [];
  }
}

/**
 * บันทึกรายการ Audit Logs ลง LocalStorage
 */
export function saveStoredSOAuditLogs(logs: SOAuditLogItem[]): void {
  try {
    // เก็บประวัติสูงสุด 500 รายการล่าสุดเพื่อรักษาขนาด LocalStorage
    const trimmed = logs.slice(0, 500);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch (err) {
    console.error('Failed to save stored SO audit logs:', err);
  }
}

/**
 * ตรวจจับความแตกต่าง (Diff) ระหว่างข้อมูลเดิมกับข้อมูลใหม่ของการตัดฟอยล์
 */
export function computeCutRecordDiff(
  oldRecord: StockCutRecord,
  newRecord: Partial<StockCutRecord>
): SOAuditDiff[] {
  const diffs: SOAuditDiff[] = [];

  const roundNum = (n: any) => (typeof n === 'number' && !isNaN(n) ? Math.round(n * 100) / 100 : 0);

  // 1. SO Number
  if (newRecord.soNumber !== undefined && newRecord.soNumber !== oldRecord.soNumber) {
    diffs.push({
      field: 'soNumber',
      label: 'รหัส SO / เหตุผล',
      oldValue: oldRecord.soNumber || '-',
      newValue: newRecord.soNumber || '-',
    });
  }

  // 2. Used Meters
  if (newRecord.usedMeters !== undefined && roundNum(newRecord.usedMeters) !== roundNum(oldRecord.usedMeters)) {
    const oldM = roundNum(oldRecord.usedMeters);
    const newM = roundNum(newRecord.usedMeters);
    diffs.push({
      field: 'usedMeters',
      label: 'เมตรใช้งาน',
      oldValue: oldM,
      newValue: newM,
      unit: 'ม.',
      delta: roundNum(newM - oldM),
    });
  }

  // 3. NG Meters
  if (newRecord.ngMeters !== undefined && roundNum(newRecord.ngMeters) !== roundNum(oldRecord.ngMeters)) {
    const oldM = roundNum(oldRecord.ngMeters);
    const newM = roundNum(newRecord.ngMeters);
    diffs.push({
      field: 'ngMeters',
      label: 'เมตรเสีย (NG)',
      oldValue: oldM,
      newValue: newM,
      unit: 'ม.',
      delta: roundNum(newM - oldM),
    });
  }

  // 4. Total Deducted
  if (newRecord.totalDeducted !== undefined && roundNum(newRecord.totalDeducted) !== roundNum(oldRecord.totalDeducted)) {
    const oldM = roundNum(oldRecord.totalDeducted);
    const newM = roundNum(newRecord.totalDeducted);
    diffs.push({
      field: 'totalDeducted',
      label: 'ยอดตัดสุทธิ',
      oldValue: oldM,
      newValue: newM,
      unit: 'ม.',
      delta: roundNum(newM - oldM),
    });
  }

  // 5. Production Round
  if (newRecord.productionRound !== undefined && newRecord.productionRound !== oldRecord.productionRound) {
    diffs.push({
      field: 'productionRound',
      label: 'รอบการผลิต',
      oldValue: oldRecord.productionRound || '-',
      newValue: newRecord.productionRound || '-',
    });
  }

  // 6. Cut Type
  if (newRecord.cutType !== undefined && newRecord.cutType !== oldRecord.cutType) {
    const mapType = (t?: string) => (t === 'non_so' ? 'ไม่ใช้ SO' : 'ตัดตาม SO');
    diffs.push({
      field: 'cutType',
      label: 'ประเภทการตัด',
      oldValue: mapType(oldRecord.cutType),
      newValue: mapType(newRecord.cutType),
    });
  }

  // 7. Usage Date
  if (newRecord.usageDate !== undefined && newRecord.usageDate !== oldRecord.usageDate) {
    diffs.push({
      field: 'usageDate',
      label: 'วันที่ตัด',
      oldValue: oldRecord.usageDate || '-',
      newValue: newRecord.usageDate || '-',
    });
  }

  // 8. Recorded By
  if (newRecord.recordedBy !== undefined && newRecord.recordedBy !== oldRecord.recordedBy) {
    diffs.push({
      field: 'recordedBy',
      label: 'ช่าง/ผู้บันทึก',
      oldValue: oldRecord.recordedBy || '-',
      newValue: newRecord.recordedBy || '-',
    });
  }

  // 9. Notes
  const oldNotes = (oldRecord.notes || '').trim();
  const newNotes = (newRecord.notes || '').trim();
  if (newRecord.notes !== undefined && oldNotes !== newNotes) {
    diffs.push({
      field: 'notes',
      label: 'หมายเหตุ',
      oldValue: oldNotes || '(ว่าง)',
      newValue: newNotes || '(ว่าง)',
    });
  }

  return diffs;
}

/**
 * ตรวจจับความแตกต่าง (Diff) ระหว่างข้อมูลเดิมกับข้อมูลใหม่ของการตัด PU Sandwich
 */
export function computeSandwichCutDiff(
  oldRecord: PuSandwichCutRecord,
  newRecord: Partial<PuSandwichCutRecord>
): SOAuditDiff[] {
  const diffs: SOAuditDiff[] = [];
  const roundNum = (n: any) => (typeof n === 'number' && !isNaN(n) ? Math.round(n * 100) / 100 : 0);

  // 1. SO Number
  if (newRecord.soNumber !== undefined && newRecord.soNumber !== oldRecord.soNumber) {
    diffs.push({
      field: 'soNumber',
      label: 'รหัส SO',
      oldValue: oldRecord.soNumber || '-',
      newValue: newRecord.soNumber || '-',
    });
  }

  // 2. Coil Color
  if (newRecord.coilColor !== undefined && newRecord.coilColor !== oldRecord.coilColor) {
    diffs.push({
      field: 'coilColor',
      label: 'สีคอยล์',
      oldValue: oldRecord.coilColor || '-',
      newValue: newRecord.coilColor || '-',
    });
  }

  // 3. Coil Number
  if (newRecord.coilNumber !== undefined && newRecord.coilNumber !== oldRecord.coilNumber) {
    diffs.push({
      field: 'coilNumber',
      label: 'เบอร์คอยล์',
      oldValue: oldRecord.coilNumber || '-',
      newValue: newRecord.coilNumber || '-',
    });
  }

  // 4. Thickness
  if (newRecord.thickness !== undefined && newRecord.thickness !== oldRecord.thickness) {
    diffs.push({
      field: 'thickness',
      label: 'ความหนา',
      oldValue: oldRecord.thickness || '-',
      newValue: newRecord.thickness || '-',
    });
  }

  // 5. Weight Used
  if (newRecord.weightUsed !== undefined && roundNum(newRecord.weightUsed) !== roundNum(oldRecord.weightUsed)) {
    const oldW = roundNum(oldRecord.weightUsed);
    const newW = roundNum(newRecord.weightUsed);
    diffs.push({
      field: 'weightUsed',
      label: 'น้ำหนักที่ใช้',
      oldValue: oldW,
      newValue: newW,
      unit: 'กก.',
      delta: roundNum(newW - oldW),
    });
  }

  // 6. SO Length Meters
  if (
    newRecord.soLengthMeters !== undefined &&
    roundNum(newRecord.soLengthMeters) !== roundNum(oldRecord.soLengthMeters)
  ) {
    const oldL = roundNum(oldRecord.soLengthMeters || 0);
    const newL = roundNum(newRecord.soLengthMeters);
    diffs.push({
      field: 'soLengthMeters',
      label: 'ความยาวตาม SO',
      oldValue: oldL,
      newValue: newL,
      unit: 'ม.',
      delta: roundNum(newL - oldL),
    });
  }

  // 7. NG Kg
  if (newRecord.ngKg !== undefined && roundNum(newRecord.ngKg) !== roundNum(oldRecord.ngKg)) {
    const oldNg = roundNum(oldRecord.ngKg || 0);
    const newNg = roundNum(newRecord.ngKg);
    diffs.push({
      field: 'ngKg',
      label: 'NG เสียหาย (กก.)',
      oldValue: oldNg,
      newValue: newNg,
      unit: 'กก.',
      delta: roundNum(newNg - oldNg),
    });
  }

  // 8. NG Meters
  if (newRecord.ngMeters !== undefined && roundNum(newRecord.ngMeters) !== roundNum(oldRecord.ngMeters)) {
    const oldNg = roundNum(oldRecord.ngMeters || 0);
    const newNg = roundNum(newRecord.ngMeters);
    diffs.push({
      field: 'ngMeters',
      label: 'NG เสียหาย (ม.)',
      oldValue: oldNg,
      newValue: newNg,
      unit: 'ม.',
      delta: roundNum(newNg - oldNg),
    });
  }

  // 9. Steel Origin
  if (newRecord.steelOrigin !== undefined && newRecord.steelOrigin !== oldRecord.steelOrigin) {
    diffs.push({
      field: 'steelOrigin',
      label: 'ชนิดเหล็ก',
      oldValue: oldRecord.steelOrigin || '-',
      newValue: newRecord.steelOrigin || '-',
    });
  }

  // 10. Production Date
  if (newRecord.productionDate !== undefined && newRecord.productionDate !== oldRecord.productionDate) {
    diffs.push({
      field: 'productionDate',
      label: 'วันที่ผลิต',
      oldValue: oldRecord.productionDate || '-',
      newValue: newRecord.productionDate || '-',
    });
  }

  // 11. Notes
  const oldNotes = (oldRecord.notes || '').trim();
  const newNotes = (newRecord.notes || '').trim();
  if (newRecord.notes !== undefined && oldNotes !== newNotes) {
    diffs.push({
      field: 'notes',
      label: 'หมายเหตุ',
      oldValue: oldNotes || '(ว่าง)',
      newValue: newNotes || '(ว่าง)',
    });
  }

  return diffs;
}

/**
 * สร้างข้อความสรุปภาษาไทยแบบกระชับจากรายการ diffs
 */
export function summarizeDiffs(diffs: SOAuditDiff[]): string {
  if (diffs.length === 0) return 'ไม่มีการเปลี่ยนแปลงข้อมูล';

  const parts = diffs.map((d) => {
    const deltaStr =
      d.delta !== undefined
        ? ` (${d.delta > 0 ? `+${d.delta}` : d.delta}${d.unit ? ` ${d.unit}` : ''})`
        : '';
    return `${d.label}: ${d.oldValue} → ${d.newValue}${d.unit ? ` ${d.unit}` : ''}${deltaStr}`;
  });

  return parts.join(' | ');
}

/**
 * สร้างอินสแตนซ์ SOAuditLogItem
 */
export function buildSOAuditLogItem(params: {
  recordType: 'foil' | 'sandwich';
  recordId: string;
  soNumber: string;
  operator: string;
  diffs: SOAuditDiff[];
  rollInfo?: SOAuditLogItem['rollInfo'];
  reason?: string;
}): SOAuditLogItem {
  const summary = summarizeDiffs(params.diffs);
  return {
    id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
    timestamp: new Date().toISOString(),
    action: 'UPDATE',
    recordType: params.recordType,
    recordId: params.recordId,
    soNumber: params.soNumber,
    operator: params.operator,
    rollInfo: params.rollInfo,
    reason: params.reason,
    diffs: params.diffs,
    summary,
  };
}

/**
 * ส่งออกรายการ Audit Logs เป็นไฟล์ CSV สำหรับเปิดใน Microsoft Excel
 */
export function exportAuditLogsToCSV(logs: SOAuditLogItem[]): void {
  if (logs.length === 0) {
    alert('ไม่มีรายการประวัติการแก้ไขสำหรับส่งออก');
    return;
  }

  const headers = [
    'วันเวลาที่แก้ไข',
    'ประเภทวัตถุดิบ',
    'รหัส SO',
    'ผู้แก้ไข / บัญชี',
    'ข้อมูลม้วน / คอยล์',
    'สรุปการแก้ไข',
    'รายการเปลี่ยนแปลง (Diff)',
  ];

  const escapeCSV = (str: string | number | undefined | null) => {
    if (str === undefined || str === null) return '""';
    const s = String(str).replace(/"/g, '""');
    return `"${s}"`;
  };

  const rows = logs.map((log) => {
    const dateFormatted = formatThaiDateTime(log.timestamp);
    const typeLabel = log.recordType === 'foil' ? 'ตัดฟอยล์' : 'ตัดแซนวิช';
    const rollDesc = log.rollInfo
      ? log.recordType === 'foil'
        ? `ล็อต: ${log.rollInfo.lotNumber || '-'} เบอร์: ${log.rollInfo.rollNumber || '-'} ลาย: ${log.rollInfo.pattern || '-'}`
        : `สี: ${log.rollInfo.coilColor || '-'} เบอร์: ${log.rollInfo.coilNumber || '-'}`
      : '-';

    const diffDetail = log.diffs
      .map(
        (d) =>
          `[${d.label}]: ${d.oldValue} -> ${d.newValue}${d.unit ? ` ${d.unit}` : ''}${
            d.delta !== undefined ? ` (${d.delta > 0 ? `+${d.delta}` : d.delta})` : ''
          }`
      )
      .join('; ');

    return [
      escapeCSV(dateFormatted),
      escapeCSV(typeLabel),
      escapeCSV(log.soNumber),
      escapeCSV(log.operator),
      escapeCSV(rollDesc),
      escapeCSV(log.summary),
      escapeCSV(diffDetail),
    ].join(',');
  });

  // UTF-8 BOM (\uFEFF) ensures Thai characters open correctly in Excel
  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
    now.getDate()
  ).padStart(2, '0')}`;
  a.download = `รายงานประวัติตรวจสอบการแก้ไข_SO_Audit_Trail_${dateStr}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
