export type FoilPattern = 
  | 'ท้องขาว'
  | 'ดำ'
  | 'ไม้อ่อน'
  | 'ไม้เข้ม'
  | 'เทา'
  | 'กลีบบัว'
  | string;

export type FoilWidth = 830 | 850 | 880 | 900 | number;

export const WIDTH_SPECIFICATIONS: Record<number, string> = {
  830: '5 ลอน 1 นิ้ว',
  850: '3 ลอน 1 นิ้ว',
  880: '5 ลอน 2 นิ้ว',
  900: '3 ลอน 2 นิ้ว',
};

export const getWidthLabel = (width: number | string): string => {
  const num = Number(width);
  const spec = WIDTH_SPECIFICATIONS[num];
  return spec ? `${num} มม. (${spec})` : `${num} มม.`;
};

export interface FoilRoll {
  id: string;
  lotNumber: string;         // ล็อต เช่น LOT-6909-A
  rollNumber: string;        // เบอร์ เช่น 01, R-05
  width: FoilWidth;          // หน้ากว้าง 830, 850, 880, 900
  pattern: FoilPattern;      // ท้อง ท้องขาว, ดำ, ไม้อ่อน, ไม้เข้ม, เทา, กลีบบัว
  totalMeters: number;       // จำนวนเมตรลูกเต็ม
  remainingMeters: number;   // จำนวนเมตรคงเหลือ
  usedMeters: number;        // จำนวนเมตรที่ตัดใช้สะสม
  ngMeters: number;          // จำนวนเมตร NG เสียสะสม
  dateReceived: string;      // วันที่รับเข้า YYYY-MM-DD
  status: 'active' | 'depleted' | 'out_of_stock'; // สถานะ (out_of_stock เมื่อเหลือ <= 0)
  notes?: string;
  isZeroedOut?: boolean;     // ติ๊กตัดสต๊อกเป็น 0 (กรณีเหลือสีแดง <= 50 เมตร)
  manualZeroedOriginalMeters?: number; // เก็บค่าเมตรก่อนติ๊กเป็น 0 เพื่อนำกลับมาใช้ใหม่ได้
  recentCuts?: Array<{
    id: string;
    soNumber: string;
    cutType?: 'so' | 'non_so';
    usedMeters: number;
    ngMeters: number;
    totalDeducted: number;
    remainingAfter: number;
    usageDate: string;
    recordedDate: string;
    recordedBy: string;
    notes?: string;
  }>;
  createdAt: string;
}

export interface StockCutRecord {
  id: string;
  foilId: string;            // รหัสม้วนฟอยล์ที่ตัด
  lotNumber: string;         // ล็อต
  rollNumber: string;        // เบอร์
  width: FoilWidth;          // หน้ากว้าง
  pattern: FoilPattern;      // ท้อง
  soNumber: string;          // รหัส SO หรือ เหตุผลการเบิกกรณีไม่ใช้ SO เช่น 'สาขายืม', 'ซ่อมฟอยล์พ่นกาว'
  cutType?: 'so' | 'non_so'; // ชนิดการตัด: มี SO หรือ ไม่ใช้ SO
  nonSoReason?: string;      // เหตุผลเพิ่มเติมกรณีไม่ใช้ SO (เช่น สาขาพัทยายืม)
  usedMeters: number;        // จำนวนเมตรที่ใช้
  ngMeters: number;          // NG ที่เสีย (เมตร)
  totalDeducted: number;     // รวมตัดออก (used + ng)
  remainingBefore: number;   // คงเหลือก่อนตัด
  remainingAfter: number;    // คงเหลือหลังตัด
  usageDate: string;         // วันที่ใช้ YYYY-MM-DD
  recordedDate: string;      // วันที่บันทึก YYYY-MM-DD
  recordedBy: string;        // คนที่บันทึก
  notes?: string;            // หมายเหตุ
  createdAt: string;
}

export interface SOComponents {
  yearBE: string;   // xx เช่น 69 (พ.ศ. 2569)
  month: string;    // yy เช่น 09 (ก.ย.)
  orderNo: string;  // zzz เช่น 500
}

/**
 * Structure of sub-collection: foil_rolls/{rollId}/cut_history
 */
export interface CutHistoryItem {
  id: string;
  soNumber: string;
  cutMeters: number;
  ngMeters: number;
  createdAt: any;
  rollId?: string;
  lotNumber?: string;
  rollNumber?: string;
  width?: FoilWidth;
  pattern?: FoilPattern;
  totalDeducted?: number;
  remainingBefore?: number;
  remainingAfter?: number;
  recordedBy?: string;
  usageDate?: string;
  notes?: string;
}
