import { FoilRoll, StockCutRecord } from '../types';

export interface DateGroupedIncoming {
  date: string; // YYYY-MM-DD
  displayDate: string;
  rolls: FoilRoll[];
  totalMeters: number;
  totalRolls: number;
}

export interface DateGroupedCuts {
  date: string; // YYYY-MM-DD
  displayDate: string;
  records: StockCutRecord[];
  totalUsedMeters: number;
  totalNgMeters: number;
  totalDeductedMeters: number;
  soCount: number;
  uniqueSoList: string[];
}

/**
 * Group rolls into "folders" by Date Received
 */
export function groupRollsByDateReceived(rolls: FoilRoll[]): DateGroupedIncoming[] {
  const groupsMap = new Map<string, FoilRoll[]>();

  rolls.forEach((roll) => {
    // Extract YYYY-MM-DD from dateReceived or createdAt
    const dateStr = (roll.dateReceived || roll.createdAt || '').slice(0, 10) || 'ไม่ระบุวันที่';
    const list = groupsMap.get(dateStr) || [];
    list.push(roll);
    groupsMap.set(dateStr, list);
  });

  // Sort dates descending
  const sortedDates = Array.from(groupsMap.keys()).sort((a, b) => {
    if (a === 'ไม่ระบุวันที่') return 1;
    if (b === 'ไม่ระบุวันที่') return -1;
    return b.localeCompare(a);
  });

  return sortedDates.map((date) => {
    const list = groupsMap.get(date) || [];
    const totalMeters = list.reduce((sum, r) => sum + r.totalMeters, 0);
    
    let displayDate = date;
    if (date !== 'ไม่ระบุวันที่') {
      try {
        const d = new Date(date);
        displayDate = d.toLocaleDateString('th-TH', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
      } catch {
        displayDate = date;
      }
    }

    return {
      date,
      displayDate,
      rolls: list,
      totalMeters,
      totalRolls: list.length,
    };
  });
}

/**
 * Group cut records into "folders" by SO Cut Date (usageDate or cutDate)
 */
export function groupCutsByDate(records: StockCutRecord[]): DateGroupedCuts[] {
  const groupsMap = new Map<string, StockCutRecord[]>();

  records.forEach((rec) => {
    const dateStr = (rec.usageDate || rec.recordedDate || rec.createdAt || '').slice(0, 10) || 'ไม่ระบุวันที่';
    const list = groupsMap.get(dateStr) || [];
    list.push(rec);
    groupsMap.set(dateStr, list);
  });

  // Sort dates descending
  const sortedDates = Array.from(groupsMap.keys()).sort((a, b) => {
    if (a === 'ไม่ระบุวันที่') return 1;
    if (b === 'ไม่ระบุวันที่') return -1;
    return b.localeCompare(a);
  });

  return sortedDates.map((date) => {
    const list = groupsMap.get(date) || [];
    const totalUsedMeters = list.reduce((sum, r) => sum + r.usedMeters, 0);
    const totalNgMeters = list.reduce((sum, r) => sum + r.ngMeters, 0);
    const totalDeductedMeters = totalUsedMeters + totalNgMeters;
    const uniqueSoList = Array.from(new Set(list.map((r) => r.soNumber).filter(Boolean)));

    let displayDate = date;
    if (date !== 'ไม่ระบุวันที่') {
      try {
        const d = new Date(date);
        displayDate = d.toLocaleDateString('th-TH', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
      } catch {
        displayDate = date;
      }
    }

    return {
      date,
      displayDate,
      records: list,
      totalUsedMeters,
      totalNgMeters,
      totalDeductedMeters,
      soCount: uniqueSoList.length,
      uniqueSoList,
    };
  });
}

/**
 * Export date-organized archive containing separated folders for incoming and SO cuts
 */
export function exportDateOrganizedArchiveJSON(rolls: FoilRoll[], records: StockCutRecord[]): void {
  const incomingGroups = groupRollsByDateReceived(rolls);
  const cutsGroups = groupCutsByDate(records);

  const payload = {
    appName: 'หลังคาเย็นสยาม (ร่มเกล้า) - ระบบคลังฟอยล์ PU Foam',
    archiveType: 'date_separated_folder_archive',
    exportedAt: new Date().toISOString(),
    summary: {
      totalRolls: rolls.length,
      totalCutRecords: records.length,
      incomingDateFoldersCount: incomingGroups.length,
      soCutDateFoldersCount: cutsGroups.length,
    },
    // Folder 1: Incoming rolls organized by Date Received
    incoming_by_date_received: incomingGroups.reduce((acc, g) => {
      acc[g.date] = {
        displayDate: g.displayDate,
        totalRolls: g.totalRolls,
        totalMeters: g.totalMeters,
        rolls: g.rolls,
      };
      return acc;
    }, {} as Record<string, any>),
    // Folder 2: SO Cuts organized by Date Cut
    so_cuts_by_cut_date: cutsGroups.reduce((acc, g) => {
      acc[g.date] = {
        displayDate: g.displayDate,
        recordsCount: g.records.length,
        soCount: g.soCount,
        soList: g.uniqueSoList,
        totalUsedMeters: g.totalUsedMeters,
        totalNgMeters: g.totalNgMeters,
        totalDeductedMeters: g.totalDeductedMeters,
        records: g.records,
      };
      return acc;
    }, {} as Record<string, any>),
  };

  const jsonString = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const d = new Date().toISOString().slice(0, 10);
  link.setAttribute('href', url);
  link.setAttribute('download', `สำรองข้อมูลแยกโฟลเดอร์วันที่_รับเข้าและตัดSO_${d}.json`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export incoming rolls for a specific date as CSV
 */
export function exportIncomingDateCSV(date: string, rolls: FoilRoll[]): void {
  const headers = [
    'วันที่รับเข้า',
    'เลขล็อต',
    'เบอร์ม้วน',
    'หน้ากว้าง (มม.)',
    'ท้องฟอยล์',
    'เมตรลูกเต็ม',
    'คงเหลือปัจจุบัน',
    'ใช้ไปแล้ว',
    'NG เสีย',
    'สถานะ',
    'หมายเหตุ',
  ];

  const rows = rolls.map((r) => [
    r.dateReceived || '-',
    `"${(r.lotNumber || '').replace(/"/g, '""')}"`,
    `"${(r.rollNumber || '').replace(/"/g, '""')}"`,
    r.width,
    `"${(r.pattern || '').replace(/"/g, '""')}"`,
    r.totalMeters,
    r.remainingMeters,
    r.usedMeters,
    r.ngMeters,
    r.status,
    `"${(r.notes || '').replace(/"/g, '""')}"`,
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((row) => row.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `รับเข้าฟอยล์_วันที่_${date}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export cut records for a specific date as CSV
 */
export function exportCutsDateCSV(date: string, records: StockCutRecord[]): void {
  const headers = [
    'วันที่ตัด SO',
    'รหัส SO',
    'เลขล็อต',
    'เบอร์ม้วน',
    'หน้ากว้าง (มม.)',
    'ท้องฟอยล์',
    'เมตรที่ตัดใช้',
    'NG ที่เสีย',
    'รวมตัดออก',
    'คงเหลือก่อนตัด',
    'คงเหลือหลังตัด',
    'ผู้บันทึก',
    'หมายเหตุ',
  ];

  const rows = records.map((r) => [
    r.usageDate || r.recordedDate || '-',
    `"${(r.soNumber || '').replace(/"/g, '""')}"`,
    `"${(r.lotNumber || '').replace(/"/g, '""')}"`,
    `"${(r.rollNumber || '').replace(/"/g, '""')}"`,
    r.width,
    `"${(r.pattern || '').replace(/"/g, '""')}"`,
    r.usedMeters,
    r.ngMeters,
    r.totalDeducted,
    r.remainingBefore ?? '-',
    r.remainingAfter,
    `"${(r.recordedBy || '').replace(/"/g, '""')}"`,
    `"${(r.notes || '').replace(/"/g, '""')}"`,
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((row) => row.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `รายการตัดSO_วันที่_${date}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
