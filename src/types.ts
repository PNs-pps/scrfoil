export type FoilPattern = 
  | 'ขาว'
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
  pattern: FoilPattern;      // ท้อง ขาว, ดำ, ไม้อ่อน, ไม้เข้ม, เทา, กลีบบัว
  totalMeters: number;       // จำนวนเมตรลูกเต็ม
  remainingMeters: number;   // จำนวนเมตรคงเหลือ
  usedMeters: number;        // จำนวนเมตรที่ตัดใช้สะสม
  ngMeters: number;          // จำนวนเมตร NG เสียสะสม
  reservedMeters?: number;   // จำนวนเมตรที่มีการจองรอตัด
  projectedRemainingMeters?: number; // ผลิตจริงแล้วจะเหลือกี่เมตร (remainingMeters - reservedMeters)
  dateReceived: string;      // วันที่รับเข้า YYYY-MM-DD
  status: 'active' | 'depleted'; // สถานะ (depleted เมื่อเหลือ <= 0)
  isUnused?: boolean;        // ม้วนเต็มที่เพิ่มเข้าระบบแต่ยังไม่มีการใช้งาน (ลดค่า Firestore read)
  notes?: string;
  isZeroedOut?: boolean;     // ติ๊กตัดสต๊อกเป็น 0 (กรณีเหลือสีแดง <= 50 เมตร)
  manualZeroedOriginalMeters?: number; // เก็บค่าเมตรก่อนติ๊กเป็น 0 เพื่อนำกลับมาใช้ใหม่ได้
  depletedAt?: string;       // วันที่ม้วนหมดสต๊อก (YYYY-MM-DD หรือ ISO string)
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
    productionRound?: string;
    roundNumber?: number;
    notes?: string;
  }>;
  createdAt: string;
}

export type CutProductionStatus = 'completed' | 'reserved' | 'cancelled';

export interface StockCutRecord {
  id: string;
  foilId: string;            // รหัสม้วนฟอยล์ที่ตัด
  lotNumber: string;         // ล็อต
  rollNumber: string;        // เบอร์
  width: FoilWidth;          // หน้ากว้าง
  pattern: FoilPattern;      // ท้อง
  isSilverSide?: boolean;    // ตัวเลือกท้องเงิน
  isWhiteSide?: boolean;     // ตัวเลือกท้องขาว
  soNumber: string;          // รหัส SO หรือ เหตุผลการเบิกกรณีไม่ใช้ SO เช่น 'สาขายืม', 'ซ่อมฟอยล์พ่นกาว'
  cutType?: 'so' | 'non_so'; // ชนิดการตัด: มี SO หรือ ไม่ใช้ SO
  cutStatus?: CutProductionStatus; // สถานะการผลิต: 'completed' = ตัดจริง (เขียว), 'reserved' = รอตัด/จอง (เหลือง), 'cancelled' = ยกเลิก
  nonSoReason?: string;      // เหตุผลเพิ่มเติมกรณีไม่ใช้ SO (เช่น สาขาพัทยายืม)
  productionRound?: string;  // รอบการผลิต เช่น 'รอบ 1', 'รอบ 2', 'รอบ 3' หรือ 'รอบ 1/2'
  roundNumber?: number;      // ลำดับรอบการผลิต เช่น 1, 2, 3
  usedMeters: number;        // จำนวนเมตรที่ใช้
  ngMeters: number;          // NG ที่เสีย (เมตร) - ยอดรวม NG หัวท้าย
  ngHeadTailMeters?: number; // ยอดรวม NG หัวท้าย (เมตร)
  totalDeducted: number;     // ยอดตัดสุทธิ (signed): บวก = ตัดออกจากสต๊อก, ลบ = คืนสต๊อก (เช่น นับสต๊อกของจริง > ระบบ)
  remainingBefore: number;   // คงเหลือก่อนตัด
  remainingAfter: number;    // คงเหลือหลังตัด
  usageDate: string;         // วันที่ใช้ YYYY-MM-DD
  recordedDate: string;      // วันที่บันทึก YYYY-MM-DD
  recordedBy: string;        // คนที่บันทึก
  notes?: string;            // หมายเหตุ
  verificationStatus?: 'pending' | 'verified' | 'flagged'; // สถานะการตรวจรับรอง SO
  verifiedBy?: string;       // ผู้ตรวจรับรอง
  verifiedAt?: string;       // วันเวลาที่ตรวจรับรอง
  confirmedAt?: string;      // วันเวลาที่กดยืนยันว่าผลิตจริงแล้ว
  confirmedBy?: string;      // ผู้กดยืนยันผลิตจริง
  cancelledAt?: string;      // วันเวลาที่ยกเลิกการผลิต
  cancelledBy?: string;      // ผู้กดยกเลิกการผลิต
  cancelReason?: string;     // เหตุผลการยกเลิกการผลิต
  reallocatedFromRollId?: string; // รหัสม้วนเดิมก่อนเปลี่ยนม้วน
  reallocatedAt?: string;    // วันเวลาที่เปลี่ยนม้วนฟอยล์
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
  usedMeters?: number;
  ngMeters: number;
  createdAt: any;
  rollId?: string;
  lotNumber?: string;
  rollNumber?: string;
  width?: FoilWidth;
  pattern?: FoilPattern;
  isSilverSide?: boolean;
  isWhiteSide?: boolean;
  totalDeducted?: number;
  remainingBefore?: number;
  remainingAfter?: number;
  cutDate?: string;
  usageDate?: string;
  recordedDate?: string;
  recordedBy?: string;
  cutType?: 'so' | 'non_so';
  nonSoReason?: string;
  productionRound?: string;
  roundNumber?: number;
  cutStatus?: 'completed' | 'reserved' | 'cancelled';
  notes?: string;
}

/**
 * ตัวเลือกชนิดเหล็ก สำหรับงานตัด SO ไม่ใช้ฟอยล์ ผลิต PU Sandwich
 * 1. เหล็กนอก
 * 2. เหล็กBlue Scope
 * 3. อื่นๆ
 */
export type SteelOriginType = 'เหล็กนอก' | 'เหล็กBlue Scope' | 'อื่นๆ';

export interface PuSandwichCutRecord {
  id: string;
  soNumber: string;               // รหัสใบสั่งตัด SO
  productionDate: string;         // วันที่ตัด/ผลิต (YYYY-MM-DD)
  // 5 ช่องคีย์หลัก:
  coilColor: string;              // 1. สีคอล์ย
  thickness: string;              // 2. ความหนา (เช่น 0.35, 0.40)
  coilNumber: string;             // 3. เบอร์คอล์ย
  weightBefore: number;           // 4. น้ำหนักก่อนใช้ (กก.)
  weightAfter: number;            // 5. น้ำหนักหลังใช้ (กก.)
  // ช่องตัวเลือก 1 ช่อง:
  steelOrigin: SteelOriginType;   // 1. เหล็กนอก 2. เหล็กBlue Scope 3. อื่นๆ
  customSteelOrigin?: string;     // ระบุรายละเอียดกรณีเลือก "อื่นๆ"
  // คำนวณอัตโนมัติ:
  weightUsed: number;             // น้ำหนักที่ใช้จริง = weightBefore - weightAfter (กก.)
  // ความยาวตามใบงาน SO:
  soLengthMeters?: number;        // ความยาวตามใบงาน SO (เมตร)
  // ยอด NG (ของเสีย):
  ngKg?: number;                  // ยอด NG เสียหาย (กก.)
  ngMeters?: number;              // ยอด NG เสียหาย (เมตร)
  // ข้อมูลเสริม:
  lengthMeters?: number;          // ความยาวที่ผลิต (ม.)
  recordedBy?: string;            // ผู้บันทึก
  notes?: string;                 // หมายเหตุ
  verificationStatus?: 'pending' | 'verified' | 'flagged'; // สถานะการตรวจรับรอง SO
  verifiedBy?: string;            // ผู้ตรวจรับรอง
  verifiedAt?: string;            // วันเวลาที่ตรวจรับรอง
  createdAt: string;              // Timestamp บันทึก
}

/**
 * ระบบตรวจนับสต๊อกประจำเดือน (Physical Cycle Count)
 * เปรียบเทียบยอดในระบบ vs ของจริง และบันทึกเหตุผลส่วนต่าง
 */
export interface CycleCountLine {
  rollId: string;
  lotNumber: string;
  rollNumber: string;
  width: number | string;
  pattern: string;
  systemRemaining: number;   // ยอดในระบบ ณ เวลานับ
  physicalCount: number;     // ยอดนับจริง
  variance: number;          // physical - system
  reason?: string;           // บังคับเมื่อ variance !== 0
  adjusted?: boolean;        // ปรับยอดระบบให้เท่าของจริงแล้วหรือยัง
  /** เวลา (ISO) ที่กรอกยอดนับจริงของม้วนนี้ — ใช้ตรวจว่ามีการตัดสต๊อกหลังนับหรือไม่ */
  countedAt?: string;
}

export interface CycleCountSession {
  id: string;
  period: string;            // YYYY-MM
  status: 'draft' | 'completed';
  countedBy?: string;
  notes?: string;
  lines: CycleCountLine[];
  createdAt: string;
  updatedAt?: string;        // บันทึกล่าสุด (แก้ไขต่อข้ามวัน)
  completedAt?: string;
  /** id ใบตัดที่สร้างตอนปรับยอด — ใช้ตอนลบประวัติเพื่อคืนยอด + ลบใบนับสต๊อก */
  adjustmentRecordIds?: string[];
}

/** ตรวจสอบว่าม้วนนี้เป็นม้วนเต็มที่ยังไม่มีการใช้งานหรือไม่ */
export function isRollUnused(roll: FoilRoll): boolean {
  if (roll.isUnused !== undefined) return roll.isUnused;
  return (
    roll.status === 'active' &&
    !roll.isZeroedOut &&
    Number(roll.usedMeters || 0) === 0 &&
    Number(roll.ngMeters || 0) === 0 &&
    Number(roll.remainingMeters) >= Number(roll.totalMeters) &&
    (!roll.recentCuts || roll.recentCuts.length === 0)
  );
}

/**
 * โครงสร้างข้อมูลความแตกต่าง (Diff) ระหว่างค่าเดิมและค่าใหม่ของฟิลด์ที่แก้ไข
 */
export interface SOAuditDiff {
  field: string;               // ชื่อฟิลด์ เช่น usedMeters, ngMeters, soNumber, notes
  label: string;               // ป้ายชื่อภาษาไทย เช่น เมตรใช้งาน, เมตรเสีย (NG), หมายเหตุ
  oldValue: string | number | null | undefined;
  newValue: string | number | null | undefined;
  unit?: string;               // หน่วย เช่น ม., กก.
  delta?: number;              // ผลต่างเชิงตัวเลข เช่น -5.0 หรือ +10
}

/**
 * ข้อมูลบันทึกประวัติการตรวจสอบการแก้ไข SO (SO Audit Trail Log Item)
 * บันทึกเฉพาะเหตุการณ์ UPDATE (การแก้ไข) ตามคำสั่งของผู้ใช้ (ไม่บันทึกการลบ)
 */
export interface SOAuditLogItem {
  id: string;                  // รหัสบันทึก Audit (UUID)
  timestamp: string;           // วันที่และเวลา ISO 8601
  action: 'UPDATE' | 'VERIFY' | 'FLAG'; // ประเภทเหตุการณ์: UPDATE | VERIFY | FLAG
  recordType: 'foil' | 'sandwich'; // ประเภทวัตถุดิบ
  recordId: string;            // รหัสใบตัดต้นทาง
  soNumber: string;            // รหัส SO หรือเหตุผล Non-SO
  operator: string;            // ผู้ดำเนินการ/ผู้แก้ไข
  rollInfo?: {
    lotNumber?: string;
    rollNumber?: string;
    width?: number | string;
    pattern?: string;
    coilColor?: string;
    coilNumber?: string;
  };
  reason?: string;             // สาเหตุการแก้ไข (ถ้ามี)
  diffs: SOAuditDiff[];        // รายการความแตกต่างก่อน vs หลังแก้ไข
  summary: string;             // ข้อความสรุปย่อภาษาไทย
  verificationStatus?: 'pending' | 'verified' | 'flagged'; // สถานะการตรวจสอบ
  verifiedBy?: string;         // ผู้ตรวจรับรอง
  verifiedAt?: string;         // วันเวลาที่ตรวจรับรอง
}

