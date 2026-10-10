import ExcelJS from 'exceljs';
import { FoilRoll, StockCutRecord, PuSandwichCutRecord, WIDTH_SPECIFICATIONS } from '../types';
import { formatMeters, todayLocalISO } from './formatters';

export interface DateFilterRange {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  label?: string;
}

export type ExportReportType = 'all_master' | 'accounting' | 'purchasing';
export type ExportMaterialFilter = 'all' | 'foil' | 'sandwich';

// Colors for styling
const STYLES = {
  headerBgNavy: '1E293B',       // Slate-800
  headerBgEmerald: '065F46',    // Emerald-800
  headerBgBlue: '1E40AF',       // Blue-800
  headerBgAmber: '92400E',      // Amber-800
  headerText: 'FFFFFF',
  subHeaderBg: 'F1F5F9',        // Slate-100
  zebraRowBg: 'F8FAFC',         // Slate-50
  totalRowBg: 'FEF3C7',         // Amber-100
  alertRowBg: 'FEE2E2',         // Rose-100
  borderColor: 'CBD5E1',        // Slate-300
};

/**
 * Filter cutting records by date range
 */
export function filterRecordsByDate<T extends { usageDate?: string; productionDate?: string; date?: string; recordedDate?: string }>(
  items: T[],
  startDate: string,
  endDate: string
): T[] {
  if (!startDate && !endDate) return items;
  return items.filter(item => {
    const d = item.usageDate || item.productionDate || item.date || item.recordedDate;
    if (!d) return true;
    const dateStr = d.slice(0, 10);
    if (startDate && dateStr < startDate) return false;
    if (endDate && dateStr > endDate) return false;
    return true;
  });
}

/**
 * Apply borders to a cell
 */
function applyCellBorder(cell: ExcelJS.Cell, borderStyle: ExcelJS.BorderStyle = 'thin') {
  cell.border = {
    top: { style: borderStyle, color: { argb: 'FFCBD5E1' } },
    left: { style: borderStyle, color: { argb: 'FFCBD5E1' } },
    bottom: { style: borderStyle, color: { argb: 'FFCBD5E1' } },
    right: { style: borderStyle, color: { argb: 'FFCBD5E1' } },
  };
}

/**
 * Apply styling to table headers
 */
function styleHeaderRow(row: ExcelJS.Row, bgArgb: string) {
  row.height = 26;
  row.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: `FF${bgArgb}` },
    };
    cell.font = {
      name: 'Tahoma',
      size: 11,
      bold: true,
      color: { argb: `FF${STYLES.headerText}` },
    };
    cell.alignment = {
      vertical: 'middle',
      horizontal: 'center',
      wrapText: true,
    };
    applyCellBorder(cell);
  });
}

/**
 * Auto-fit column widths based on cell content
 */
function autoFitColumns(worksheet: ExcelJS.Worksheet, minWidth = 10, maxWidth = 45) {
  worksheet.columns.forEach((column) => {
    let maxLen = 0;
    column.eachCell?.({ includeEmpty: true }, (cell) => {
      const val = cell.value;
      if (val !== null && val !== undefined) {
        let str = typeof val === 'object' && 'result' in val ? String(val.result ?? '') : String(val);
        // Approx length accounting for Thai characters
        const len = Math.ceil(str.length * 1.15);
        if (len > maxLen) maxLen = len;
      }
    });
    column.width = Math.min(Math.max(maxLen + 3, minWidth), maxWidth);
  });
}

/**
 * สร้างชีทสำหรับฝ่ายบัญชี: ประวัติการเบิกใช้ฟอยล์
 */
function buildAccountingFoilSheet(
  workbook: ExcelJS.Workbook,
  records: StockCutRecord[],
  dateRangeText: string
) {
  const ws = workbook.addWorksheet('บัญชี - เบิกใช้ฟอยล์', {
    views: [{ state: 'frozen', ySplit: 5 }],
  });

  // Title Block
  ws.mergeCells('A1:P1');
  const titleCell = ws.getCell('A1');
  titleCell.value = 'หลังคาเย็นสยาม ร่มเกล้า — รายงานสรุปการเบิกใช้วัตถุดิบฟอยล์ (สำหรับฝ่ายบัญชี)';
  titleCell.font = { name: 'Tahoma', size: 14, bold: true, color: { argb: 'FF1E293B' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  ws.getRow(1).height = 28;

  ws.mergeCells('A2:P2');
  const subTitleCell = ws.getCell('A2');
  subTitleCell.value = `ช่วงเวลาที่เลือก: ${dateRangeText} | วันที่ออกรายงาน: ${todayLocalISO()} | จำนวนทั้งหมด: ${records.length} รายการ`;
  subTitleCell.font = { name: 'Tahoma', size: 10, italic: true, color: { argb: 'FF64748B' } };
  ws.getRow(2).height = 20;

  ws.addRow([]); // Blank line

  // Headers (Row 4)
  const headers = [
    'ลำดับ',
    'วันที่ตัดใช้',
    'วันที่บันทึก',
    'เลขที่ SO / รายการ',
    'ประเภทงาน',
    'รอบผลิต',
    'ล็อต (Lot)',
    'เบอร์ม้วน',
    'หน้ากว้าง (มม.)',
    'สเปกลอน',
    'ลายท้อง',
    'ด้านหน้า',
    'เมตรที่ใช้ (ม.)',
    'เมตรเสีย NG (ม.)',
    'รวมตัดสุทธิ (ม.)',
    'คงเหลือหลังตัด (ม.)',
    'อัตรา NG (%)',
    'ผู้บันทึก',
    'หมายเหตุ'
  ];

  const headerRow = ws.addRow(headers);
  styleHeaderRow(headerRow, STYLES.headerBgNavy);

  // Data rows
  let rowIndex = 5;
  records.forEach((rec, idx) => {
    const isSo = rec.cutType !== 'non_so';
    const spec = WIDTH_SPECIFICATIONS[rec.width] || '-';
    const used = Number(rec.usedMeters || 0);
    const ng = Number(rec.ngMeters || 0);
    const totalDeducted = Number(rec.totalDeducted ?? (used + ng));
    const sideInfo = rec.isSilverSide ? 'หน้าเงิน' : rec.isWhiteSide ? 'หน้าขาว' : 'มาตรฐาน';

    const row = ws.addRow([
      idx + 1,
      rec.usageDate || '-',
      rec.recordedDate || '-',
      rec.soNumber || '-',
      isSo ? 'มี SO' : `ไม่ใช้ SO (${rec.nonSoReason || 'ทั่วไป'})`,
      rec.productionRound || '-',
      rec.lotNumber || '-',
      rec.rollNumber || '-',
      rec.width || '-',
      spec,
      rec.pattern || '-',
      sideInfo,
      used,
      ng,
      totalDeducted,
      Number(rec.remainingAfter ?? 0),
      { formula: `IF(M${rowIndex}>0, N${rowIndex}/M${rowIndex}, 0)` },
      rec.recordedBy || '-',
      rec.notes || '-'
    ]);

    row.height = 22;

    // Cell styling & formatting
    row.eachCell((cell, colNumber) => {
      applyCellBorder(cell);
      cell.font = { name: 'Tahoma', size: 10 };

      // Alternating background
      if (idx % 2 === 1) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: `FF${STYLES.zebraRowBg}` }
        };
      }

      // Column Alignments & Number formats
      if ([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 18].includes(colNumber)) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else if ([13, 14, 15, 16].includes(colNumber)) {
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
        cell.numFmt = '#,##0.00';
      } else if (colNumber === 17) {
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
        cell.numFmt = '0.00%';
        if (ng > 0) {
          cell.font = { name: 'Tahoma', size: 10, color: { argb: 'FFDC2626' }, bold: true };
        }
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      }
    });

    rowIndex++;
  });

  // Summary Row at the bottom
  if (records.length > 0) {
    const startRow = 5;
    const endRow = rowIndex - 1;
    const totalRow = ws.addRow([
      'รวมทั้งสิ้น',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      { formula: `SUM(M${startRow}:M${endRow})` },
      { formula: `SUM(N${startRow}:N${endRow})` },
      { formula: `SUM(O${startRow}:O${endRow})` },
      '-',
      { formula: `IF(M${rowIndex}>0, N${rowIndex}/M${rowIndex}, 0)` },
      '',
      ''
    ]);

    ws.mergeCells(`A${rowIndex}:L${rowIndex}`);
    totalRow.height = 26;
    totalRow.eachCell((cell, colNumber) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: `FF${STYLES.totalRowBg}` }
      };
      cell.font = { name: 'Tahoma', size: 10, bold: true, color: { argb: 'FF92400E' } };
      applyCellBorder(cell, 'medium');

      if ([13, 14, 15].includes(colNumber)) {
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
        cell.numFmt = '#,##0.00';
      } else if (colNumber === 17) {
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
        cell.numFmt = '0.00%';
      } else if (colNumber === 1) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      }
    });
  }

  autoFitColumns(ws);
}

/**
 * สร้างชีทสำหรับฝ่ายบัญชี: ประวัติการตัดแซนวิช (PU Sandwich)
 */
function buildAccountingSandwichSheet(
  workbook: ExcelJS.Workbook,
  records: PuSandwichCutRecord[],
  dateRangeText: string
) {
  const ws = workbook.addWorksheet('บัญชี - งานแซนวิช', {
    views: [{ state: 'frozen', ySplit: 5 }],
  });

  // Title Block
  ws.mergeCells('A1:O1');
  const titleCell = ws.getCell('A1');
  titleCell.value = 'หลังคาเย็นสยาม ร่มเกล้า — รายงานสรุปการผลิตและใช้วัตถุดิบ PU Sandwich (สำหรับฝ่ายบัญชี)';
  titleCell.font = { name: 'Tahoma', size: 14, bold: true, color: { argb: 'FF065F46' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  ws.getRow(1).height = 28;

  ws.mergeCells('A2:O2');
  const subTitleCell = ws.getCell('A2');
  subTitleCell.value = `ช่วงเวลาที่เลือก: ${dateRangeText} | วันที่ออกรายงาน: ${todayLocalISO()} | จำนวนทั้งหมด: ${records.length} รายการ`;
  subTitleCell.font = { name: 'Tahoma', size: 10, italic: true, color: { argb: 'FF64748B' } };
  ws.getRow(2).height = 20;

  ws.addRow([]); // Blank line

  const headers = [
    'ลำดับ',
    'วันที่ผลิต',
    'เลขที่ SO',
    'เบอร์คอล์ย',
    'สีคอล์ย',
    'ความหนา (มม.)',
    'แหล่งเหล็ก',
    'น้ำหนักก่อนใช้ (กก.)',
    'น้ำหนักหลังใช้ (กก.)',
    'น้ำหนักที่ใช้จริง (กก.)',
    'ความยาว SO (ม.)',
    'NG เสีย (กก.)',
    'NG เสีย (ม.)',
    'ผู้บันทึก',
    'หมายเหตุ'
  ];

  const headerRow = ws.addRow(headers);
  styleHeaderRow(headerRow, STYLES.headerBgEmerald);

  let rowIndex = 5;
  records.forEach((rec, idx) => {
    const origin = rec.steelOrigin === 'อื่นๆ' ? (rec.customSteelOrigin || 'อื่นๆ') : rec.steelOrigin;
    const wUsed = Number(rec.weightUsed ?? ((Number(rec.weightBefore || 0)) - (Number(rec.weightAfter || 0))));

    const row = ws.addRow([
      idx + 1,
      rec.productionDate || '-',
      rec.soNumber || '-',
      rec.coilNumber || '-',
      rec.coilColor || '-',
      rec.thickness || '-',
      origin || '-',
      Number(rec.weightBefore || 0),
      Number(rec.weightAfter || 0),
      wUsed,
      Number(rec.soLengthMeters || 0),
      Number(rec.ngKg || 0),
      Number(rec.ngMeters || 0),
      rec.recordedBy || '-',
      rec.notes || '-'
    ]);

    row.height = 22;

    row.eachCell((cell, colNumber) => {
      applyCellBorder(cell);
      cell.font = { name: 'Tahoma', size: 10 };

      if (idx % 2 === 1) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: `FF${STYLES.zebraRowBg}` }
        };
      }

      if ([1, 2, 3, 4, 5, 6, 7, 14].includes(colNumber)) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else if ([8, 9, 10, 11, 12, 13].includes(colNumber)) {
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
        cell.numFmt = '#,##0.00';
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      }
    });

    rowIndex++;
  });

  // Summary Row
  if (records.length > 0) {
    const startRow = 5;
    const endRow = rowIndex - 1;
    const totalRow = ws.addRow([
      'รวมทั้งสิ้น',
      '',
      '',
      '',
      '',
      '',
      '',
      { formula: `SUM(H${startRow}:H${endRow})` },
      { formula: `SUM(I${startRow}:I${endRow})` },
      { formula: `SUM(J${startRow}:J${endRow})` },
      { formula: `SUM(K${startRow}:K${endRow})` },
      { formula: `SUM(L${startRow}:L${endRow})` },
      { formula: `SUM(M${startRow}:M${endRow})` },
      '',
      ''
    ]);

    ws.mergeCells(`A${rowIndex}:G${rowIndex}`);
    totalRow.height = 26;
    totalRow.eachCell((cell, colNumber) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: `FF${STYLES.totalRowBg}` }
      };
      cell.font = { name: 'Tahoma', size: 10, bold: true, color: { argb: 'FF065F46' } };
      applyCellBorder(cell, 'medium');

      if ([8, 9, 10, 11, 12, 13].includes(colNumber)) {
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
        cell.numFmt = '#,##0.00';
      } else if (colNumber === 1) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      }
    });
  }

  autoFitColumns(ws);
}

/**
 * สร้างชีทสำหรับฝ่ายจัดซื้อ: สต๊อกคงเหลือปัจจุบัน และการแจ้งเตือนสั่งซื้อ
 */
function buildPurchasingInventorySheet(
  workbook: ExcelJS.Workbook,
  rolls: FoilRoll[]
) {
  const ws = workbook.addWorksheet('จัดซื้อ - สต๊อกคงเหลือฟอยล์', {
    views: [{ state: 'frozen', ySplit: 5 }],
  });

  // Title Block
  ws.mergeCells('A1:N1');
  const titleCell = ws.getCell('A1');
  titleCell.value = 'หลังคาเย็นสยาม ร่มเกล้า — รายงานสต๊อกคงเหลือและจุดสั่งซื้อวัตถุดิบฟอยล์ (สำหรับฝ่ายจัดซื้อ)';
  titleCell.font = { name: 'Tahoma', size: 14, bold: true, color: { argb: 'FF1E40AF' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  ws.getRow(1).height = 28;

  const activeRolls = rolls.filter(r => r.status === 'active' && !r.isZeroedOut && Number(r.remainingMeters) > 0);
  const depletedRolls = rolls.filter(r => r.status === 'depleted' || r.isZeroedOut || Number(r.remainingMeters) <= 0);
  const lowStockRolls = activeRolls.filter(r => Number(r.remainingMeters) <= 100);

  ws.mergeCells('A2:N2');
  const subTitleCell = ws.getCell('A2');
  subTitleCell.value = `วันที่ตรวจนับ: ${todayLocalISO()} | ม้วนพร้อมใช้: ${activeRolls.length} ม้วน | แจ้งเตือนเหลือน้อย (<=100ม.): ${lowStockRolls.length} ม้วน | ม้วนหมดแล้ว: ${depletedRolls.length} ม้วน`;
  subTitleCell.font = { name: 'Tahoma', size: 10, italic: true, color: { argb: 'FF64748B' } };
  ws.getRow(2).height = 20;

  ws.addRow([]); // Blank line

  const headers = [
    'ลำดับ',
    'ล็อต (Lot)',
    'เบอร์ม้วน',
    'หน้ากว้าง (มม.)',
    'สเปกลอน',
    'ลายท้อง',
    'เมตรลูกเต็ม (ม.)',
    'เมตรคงเหลือ (ม.)',
    'ใช้ไปแล้ว (ม.)',
    'เศษเสียสะสม (ม.)',
    'สถานะสต๊อก',
    'แจ้งเตือนจัดซื้อ',
    'วันที่รับเข้า',
    'หมายเหตุ'
  ];

  const headerRow = ws.addRow(headers);
  styleHeaderRow(headerRow, STYLES.headerBgBlue);

  let rowIndex = 5;
  rolls.forEach((roll, idx) => {
    const spec = WIDTH_SPECIFICATIONS[roll.width] || '-';
    const rem = Number(roll.remainingMeters || 0);
    const tot = Number(roll.totalMeters || 0);
    const isDepleted = roll.status === 'depleted' || roll.isZeroedOut || rem <= 0;
    const isLow = !isDepleted && rem <= 100;

    let statusText = 'พร้อมใช้งาน';
    let alertText = 'ปกติ';
    if (isDepleted) {
      statusText = 'หมดแล้ว';
      alertText = 'ม้วนหมด';
    } else if (isLow) {
      statusText = 'เหลือน้อย (เร่งด่วน)';
      alertText = 'ควรสั่งซื้อเพิ่ม';
    }

    const row = ws.addRow([
      idx + 1,
      roll.lotNumber || '-',
      roll.rollNumber || '-',
      roll.width || '-',
      spec,
      roll.pattern || '-',
      tot,
      rem,
      Number(roll.usedMeters || 0),
      Number(roll.ngMeters || 0),
      statusText,
      alertText,
      roll.dateReceived || '-',
      roll.notes || '-'
    ]);

    row.height = 22;

    row.eachCell((cell, colNumber) => {
      applyCellBorder(cell);
      cell.font = { name: 'Tahoma', size: 10 };

      // Highlight low stock or depleted
      if (isLow) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFEF3C7' } // Light yellow alert
        };
      } else if (isDepleted) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF1F5F9' } // Light gray
        };
        cell.font = { name: 'Tahoma', size: 10, color: { argb: 'FF94A3B8' } };
      } else if (idx % 2 === 1) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: `FF${STYLES.zebraRowBg}` }
        };
      }

      if ([1, 2, 3, 4, 5, 6, 11, 12, 13].includes(colNumber)) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else if ([7, 8, 9, 10].includes(colNumber)) {
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
        cell.numFmt = '#,##0.00';
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      }

      if (colNumber === 12 && isLow) {
        cell.font = { name: 'Tahoma', size: 10, bold: true, color: { argb: 'FFDC2626' } };
      }
    });

    rowIndex++;
  });

  // Summary Row
  if (rolls.length > 0) {
    const startRow = 5;
    const endRow = rowIndex - 1;
    const totalRow = ws.addRow([
      'รวมยอดคงคลังทั้งหมด',
      '',
      '',
      '',
      '',
      '',
      { formula: `SUM(G${startRow}:G${endRow})` },
      { formula: `SUM(H${startRow}:H${endRow})` },
      { formula: `SUM(I${startRow}:I${endRow})` },
      { formula: `SUM(J${startRow}:J${endRow})` },
      '',
      '',
      '',
      ''
    ]);

    ws.mergeCells(`A${rowIndex}:F${rowIndex}`);
    totalRow.height = 26;
    totalRow.eachCell((cell, colNumber) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: `FF${STYLES.totalRowBg}` }
      };
      cell.font = { name: 'Tahoma', size: 10, bold: true, color: { argb: 'FF1E40AF' } };
      applyCellBorder(cell, 'medium');

      if ([7, 8, 9, 10].includes(colNumber)) {
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
        cell.numFmt = '#,##0.00';
      } else if (colNumber === 1) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      }
    });
  }

  autoFitColumns(ws);
}

/**
 * สร้างชีทสำหรับฝ่ายจัดซื้อ: สรุปความต้องการสต๊อกแยกตามหน้ากว้างและลาย (Purchasing Breakdown Matrix)
 */
function buildPurchasingBreakdownSheet(
  workbook: ExcelJS.Workbook,
  rolls: FoilRoll[],
  records: StockCutRecord[]
) {
  const ws = workbook.addWorksheet('จัดซื้อ - สรุปตามหน้ากว้าง&ลาย', {
    views: [{ state: 'frozen', ySplit: 4 }],
  });

  // Title Block
  ws.mergeCells('A1:G1');
  const titleCell = ws.getCell('A1');
  titleCell.value = 'ตารางวิเคราะห์สต๊อกแยกตามหน้ากว้างและลายท้อง (สำหรับการวางแผนสั่งซื้อ)';
  titleCell.font = { name: 'Tahoma', size: 13, bold: true, color: { argb: 'FF1E293B' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  ws.getRow(1).height = 26;

  ws.addRow([]); // Blank line

  // Section 1: สรุปตามหน้ากว้าง (Width Analysis)
  const widthHeader = ws.addRow(['หน้ากว้าง (มม.)', 'สเปกลอน', 'จำนวนม้วนพร้อมใช้', 'เมตรคงเหลือรวม (ม.)', 'ยอดตัดใช้สะสม (ม.)', 'ยอดเสียสะสม (ม.)', 'สถานะการสั่งซื้อ']);
  styleHeaderRow(widthHeader, STYLES.headerBgNavy);

  const widths: number[] = [830, 850, 880, 900];
  widths.forEach(w => {
    const matchingRolls = rolls.filter(r => Number(r.width) === w && r.status === 'active' && !r.isZeroedOut && Number(r.remainingMeters) > 0);
    const totalRemaining = matchingRolls.reduce((acc, r) => acc + Number(r.remainingMeters || 0), 0);
    const matchingRecords = records.filter(rec => Number(rec.width) === w);
    const totalUsed = matchingRecords.reduce((acc, r) => acc + Number(r.usedMeters || 0), 0);
    const totalNg = matchingRecords.reduce((acc, r) => acc + Number(r.ngMeters || 0), 0);
    const spec = WIDTH_SPECIFICATIONS[w] || '-';

    let orderStatus = 'เพียงพอ';
    if (matchingRolls.length === 0 || totalRemaining < 500) {
      orderStatus = '⚠️ วิกฤต - ต้องสั่งซื้อด่วน';
    } else if (totalRemaining < 1500) {
      orderStatus = '⚡ ต่ำกว่าเกณฑ์ - เตรียมสั่งซื้อ';
    }

    const row = ws.addRow([
      w,
      spec,
      matchingRolls.length,
      totalRemaining,
      totalUsed,
      totalNg,
      orderStatus
    ]);

    row.height = 22;
    row.eachCell((cell, colNumber) => {
      applyCellBorder(cell);
      cell.font = { name: 'Tahoma', size: 10 };
      if ([1, 2, 3, 7].includes(colNumber)) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
        cell.numFmt = '#,##0.00';
      }

      if (colNumber === 7 && orderStatus.includes('วิกฤต')) {
        cell.font = { name: 'Tahoma', size: 10, bold: true, color: { argb: 'FFDC2626' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
      }
    });
  });

  ws.addRow([]); // Blank line
  ws.addRow([]); // Blank line

  // Section 2: สรุปตามลายท้อง (Pattern Analysis)
  const patternHeader = ws.addRow(['ลายท้องฟอยล์', 'จำนวนม้วนพร้อมใช้', 'เมตรคงเหลือรวม (ม.)', 'ม้วนเหลือน้อย (<=100ม.)', 'สถานะการสั่งซื้อ', '', '']);
  ws.mergeCells(`A${ws.lastRow!.number}:G${ws.lastRow!.number}`);
  patternHeader.getCell(1).value = 'สรุปสต๊อกแยกตามลายท้อง (Foil Pattern Breakdown)';
  patternHeader.getCell(1).font = { name: 'Tahoma', size: 12, bold: true, color: { argb: 'FF1E293B' } };
  patternHeader.height = 24;

  const patternSubHeader = ws.addRow(['ลายท้องฟอยล์', 'จำนวนม้วนพร้อมใช้', 'เมตรคงเหลือรวม (ม.)', 'ม้วนเหลือน้อย (<=100ม.)', 'สถานะการสั่งซื้อ', '', '']);
  styleHeaderRow(patternSubHeader, STYLES.headerBgBlue);

  // Group patterns
  const patterns = Array.from(new Set(rolls.map(r => r.pattern || 'ไม่ระบุ')));
  patterns.forEach(pat => {
    const matchingRolls = rolls.filter(r => (r.pattern || 'ไม่ระบุ') === pat && r.status === 'active' && !r.isZeroedOut && Number(r.remainingMeters) > 0);
    const totalRemaining = matchingRolls.reduce((acc, r) => acc + Number(r.remainingMeters || 0), 0);
    const lowCount = matchingRolls.filter(r => Number(r.remainingMeters) <= 100).length;

    let patStatus = 'ปกติ';
    if (matchingRolls.length === 0) {
      patStatus = '⚠️ ขาดสต๊อก';
    } else if (totalRemaining < 300) {
      patStatus = '⚡ เหลือน้อย';
    }

    const row = ws.addRow([
      pat,
      matchingRolls.length,
      totalRemaining,
      lowCount,
      patStatus,
      '',
      ''
    ]);

    row.height = 22;
    row.eachCell((cell, colNumber) => {
      applyCellBorder(cell);
      cell.font = { name: 'Tahoma', size: 10 };
      if ([1, 2, 4, 5].includes(colNumber)) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
        cell.numFmt = '#,##0.00';
      }

      if (colNumber === 5 && patStatus.includes('ขาด')) {
        cell.font = { name: 'Tahoma', size: 10, bold: true, color: { argb: 'FFDC2626' } };
      }
    });
  });

  autoFitColumns(ws);
}

/**
 * สร้างชีทสรุปภาพรวมผู้บริหารและการผลิต (Executive Summary)
 */
function buildExecutiveSummarySheet(
  workbook: ExcelJS.Workbook,
  rolls: FoilRoll[],
  records: StockCutRecord[],
  puRecords: PuSandwichCutRecord[],
  dateRangeText: string
) {
  const ws = workbook.addWorksheet('สรุปภาพรวมผู้บริหาร', {
    views: [{ showGridLines: true }],
  });

  // Header Title
  ws.mergeCells('A1:F1');
  const title = ws.getCell('A1');
  title.value = 'หลังคาเย็นสยาม ร่มเกล้า — รายงานสรุปภาพรวมฝ่ายผลิตและคลังสินค้า';
  title.font = { name: 'Tahoma', size: 15, bold: true, color: { argb: 'FF1E293B' } };
  title.alignment = { vertical: 'middle', horizontal: 'left' };
  ws.getRow(1).height = 32;

  ws.mergeCells('A2:F2');
  const subtitle = ws.getCell('A2');
  subtitle.value = `ช่วงเวลาที่วิเคราะห์: ${dateRangeText} | รายงานสร้างเมื่อ: ${new Date().toLocaleString('th-TH')}`;
  subtitle.font = { name: 'Tahoma', size: 10, italic: true, color: { argb: 'FF64748B' } };
  ws.getRow(2).height = 20;

  ws.addRow([]); // Blank

  // Section 1: KPI Summary Cards (Simulated via Cells)
  const totalFoilUsed = records.reduce((sum, r) => sum + Number(r.usedMeters || 0), 0);
  const totalFoilNg = records.reduce((sum, r) => sum + Number(r.ngMeters || 0), 0);
  const overallNgRate = totalFoilUsed > 0 ? (totalFoilNg / totalFoilUsed) * 100 : 0;
  const activeRolls = rolls.filter(r => r.status === 'active' && !r.isZeroedOut && Number(r.remainingMeters) > 0);
  const totalInventoryRemaining = activeRolls.reduce((sum, r) => sum + Number(r.remainingMeters || 0), 0);

  const totalSandwichSteelUsed = puRecords.reduce((sum, r) => sum + Number(r.weightUsed || 0), 0);
  const totalSandwichLength = puRecords.reduce((sum, r) => sum + Number(r.soLengthMeters || 0), 0);

  const kpiData = [
    ['ตัวชี้วัดหลัก (Key Metric)', 'ค่าตัวเลข', 'หน่วย', 'หมายเหตุ'],
    ['ยอดตัดใช้ฟอยล์ทั้งหมด (ช่วงที่เลือก)', formatMeters(totalFoilUsed), 'เมตร', `จากทั้งหมด ${records.length} รายการตัด`],
    ['ยอดเศษเสียสะสม (NG) ฟอยล์', formatMeters(totalFoilNg), 'เมตร', `คิดเป็นของเสีย ${overallNgRate.toFixed(2)}%`],
    ['อัตราการสูญเสียของเสีย NG เฉลี่ย', overallNgRate.toFixed(2) + '%', '%', overallNgRate <= 3 ? 'อยู่ในเกณฑ์ดีเยี่ยม (<= 3%)' : 'ควรตรวจสอบเครื่องจักรหรือคนตัด'],
    ['สต๊อกฟอยล์คงเหลือในคลังปัจจุบัน', formatMeters(totalInventoryRemaining), 'เมตร', `พร้อมใช้งาน ${activeRolls.length} ม้วน`],
    ['ปริมาณเหล็กคอยล์ใช้ผลิต PU Sandwich', formatMeters(totalSandwichSteelUsed), 'กก.', `จากทั้งหมด ${puRecords.length} ใบสั่งตัด`],
    ['ความยาวแผ่นแซนวิชที่ผลิตได้', formatMeters(totalSandwichLength), 'เมตร', 'ความยาวรวมตามใบสั่งผลิต SO'],
  ];

  kpiData.forEach((row, i) => {
    const wsRow = ws.addRow(row);
    wsRow.height = 24;
    if (i === 0) {
      styleHeaderRow(wsRow, STYLES.headerBgAmber);
    } else {
      wsRow.eachCell((cell, colNumber) => {
        applyCellBorder(cell);
        cell.font = { name: 'Tahoma', size: 10, bold: colNumber === 1 };
        if (colNumber === 2) {
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
          cell.font = { name: 'Tahoma', size: 10, bold: true, color: { argb: 'FF1E293B' } };
        } else if (colNumber === 3) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        } else {
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
        }
      });
    }
  });

  autoFitColumns(ws);
}

/**
 * Main export function - generates and downloads the professional Excel report
 */
export async function generateAndDownloadExcelReport(options: {
  reportType: ExportReportType;
  materialFilter: ExportMaterialFilter;
  dateRange: DateFilterRange;
  rolls: FoilRoll[];
  records: StockCutRecord[];
  puRecords: PuSandwichCutRecord[];
}): Promise<string> {
  const { reportType, materialFilter, dateRange, rolls, records, puRecords } = options;

  // Filter records by date
  const filteredFoilRecords = filterRecordsByDate(records, dateRange.startDate, dateRange.endDate);
  const filteredPuRecords = filterRecordsByDate(puRecords, dateRange.startDate, dateRange.endDate);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'หลังคาเย็นสยาม ร่มเกล้า (PU FOAM Stock System)';
  workbook.lastModifiedBy = 'ระบบจัดการสต๊อกฟอยล์';
  workbook.created = new Date();
  workbook.modified = new Date();

  const dateRangeText = dateRange.startDate && dateRange.endDate
    ? `${dateRange.startDate} ถึง ${dateRange.endDate}`
    : dateRange.startDate
    ? `ตั้งแต่ ${dateRange.startDate}`
    : dateRange.endDate
    ? `ถึง ${dateRange.endDate}`
    : 'ข้อมูลทั้งหมด (All Time)';

  // Build appropriate sheets according to options
  if (reportType === 'accounting') {
    // ฝ่ายบัญชี
    if (materialFilter === 'all' || materialFilter === 'foil') {
      buildAccountingFoilSheet(workbook, filteredFoilRecords, dateRangeText);
    }
    if (materialFilter === 'all' || materialFilter === 'sandwich') {
      buildAccountingSandwichSheet(workbook, filteredPuRecords, dateRangeText);
    }
  } else if (reportType === 'purchasing') {
    // ฝ่ายจัดซื้อ
    buildPurchasingInventorySheet(workbook, rolls);
    buildPurchasingBreakdownSheet(workbook, rolls, filteredFoilRecords);
  } else {
    // ฉบับสมบูรณ์ All Master
    buildExecutiveSummarySheet(workbook, rolls, filteredFoilRecords, filteredPuRecords, dateRangeText);
    if (materialFilter === 'all' || materialFilter === 'foil') {
      buildAccountingFoilSheet(workbook, filteredFoilRecords, dateRangeText);
    }
    if (materialFilter === 'all' || materialFilter === 'sandwich') {
      buildAccountingSandwichSheet(workbook, filteredPuRecords, dateRangeText);
    }
    buildPurchasingInventorySheet(workbook, rolls);
    buildPurchasingBreakdownSheet(workbook, rolls, filteredFoilRecords);
  }

  // Generate filename
  const dateSuffix = todayLocalISO();
  let filename = `รายงานสต๊อกและการผลิต_${dateSuffix}.xlsx`;
  if (reportType === 'accounting') {
    filename = `รายงานฝ่ายบัญชี_เบิกใช้วัตถุดิบ_${dateSuffix}.xlsx`;
  } else if (reportType === 'purchasing') {
    filename = `รายงานฝ่ายจัดซื้อ_สต๊อกคงเหลือ_${dateSuffix}.xlsx`;
  }

  // Write buffer and trigger browser download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  });
  
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return filename;
}
