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
  dateReceived: string;      // วันที่รับเข้า YYYY-MM-DD
  status: 'active' | 'depleted'; // สถานะ (depleted เมื่อเหลือ <= 0)
  isUnused?: boolean;        // ม้วนเต็มที่เพิ่มเข้าระบบแต่ยังไม่มีการใช้งาน (ลดค่า Firestore read)
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
    productionRound?: string;
    roundNumber?: number;
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
  isSilverSide?: boolean;    // ตัวเลือกท้องเงิน
  isWhiteSide?: boolean;     // ตัวเลือกท้องขาว
  soNumber: string;          // รหัส SO หรือ เหตุผลการเบิกกรณีไม่ใช้ SO เช่น 'สาขายืม', 'ซ่อมฟอยล์พ่นกาว'
  cutType?: 'so' | 'non_so'; // ชนิดการตัด: มี SO หรือ ไม่ใช้ SO
  nonSoReason?: string;      // เหตุผลเพิ่มเติมกรณีไม่ใช้ SO (เช่น สาขาพัทยายืม)
  productionRound?: string;  // รอบการผลิต เช่น 'รอบ 1', 'รอบ 2', 'รอบ 3' หรือ 'รอบ 1/2'
  roundNumber?: number;      // ลำดับรอบการผลิต เช่น 1, 2, 3
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

// ====================================================
// ระบบตัดสต๊อกน้ำยา PU (Chemical Stock Management)
// แยกอิสระจากระบบตัดสต๊อกฟอยล์ โดยดึงเฉพาะข้อมูล SO: ผลิตจริง + NG
// ====================================================

/** ข้อมูลสูตรคำนวณการใช้น้ำยา */
export interface ChemicalFormula {
  id: string;
  name: string;                   // ชื่อน้ำยา เช่น 'Polyol K-Foam 32'
  density: string;                // ป้ายกำกับ Density เช่น 'Density 32, Density 35'
  densities?: string[];           // ค่า Density ที่รองรับได้มากกว่า 1 ค่า เช่น ['Density 32', 'Density 35', 'Density 40']
  inchSize: string;               // ใช้กับกี่นิ้ว เช่น '1 นิ้ว', '1.5 นิ้ว', '2 นิ้ว', '3 นิ้ว'
  drumNumber?: string;            // No. ถัง (แทนล็อต เช่น 'ถัง #A-12 / #B-15')
  description?: string;           // คำอธิบายเพิ่มเติม
  foamThicknessMm: number;        // ความหนาโฟม (มม.)
  
  // ผลการชั่งน้ำหนักทดสอบน้ำยา (Weight Test Calibration)
  polyWeightKg: number;           // น้ำยา Poly ที่ชั่งได้ (กก.)
  polySeconds: number;            // จำนวนวินาทีที่ยิงทดสอบ Poly
  polyFlowRatePerMin: number;     // การใช้น้ำยา Poly ใน 1 นาที (กก./นาที) = (polyWeightKg / polySeconds) * 60
  
  isoWeightKg: number;            // น้ำยา ISO ที่ชั่งได้ (กก.)
  isoSeconds: number;             // จำนวนวินาทีที่ยิงทดสอบ ISO
  isoFlowRatePerMin: number;      // การใช้น้ำยา ISO ใน 1 นาที (กก./นาที) = (isoWeightKg / isoSeconds) * 60
  
  totalFlowRatePerMin: number;    // รวมน้ำยาที่ใช้ใน 1 นาที (กก./นาที) = polyFlowRatePerMin + isoFlowRatePerMin
  
  defaultLineSpeedMPerMin: number; // ความเร็วสายพานมาตรฐานที่ใช้ผลิต (เมตร/นาที เช่น 8 ม./นาที)
  usageRatePerMeter: number;      // อัตราการใช้น้ำยาผลิตจริง (กก./เมตร) = totalFlowRatePerMin / defaultLineSpeedMPerMin
  ngRatePerMeter: number;         // อัตราการใช้น้ำยาสำหรับยอดเสีย NG (กก./เมตร)
  partARatioPercent: number;      // สัดส่วนน้ำยา Part A (Poly) เป็น %
  partBRatioPercent: number;      // สัดส่วนน้ำยา Part B (ISO) เป็น %
  wasteFactorPercent?: number;    // % เผื่อสูญเสียหัว-ท้าย / ล้นโฟม (ถ้ามี)
  isDefault?: boolean;            // เป็นสูตรเริ่มต้นหรือไม่
}

/** สต๊อกน้ำยาคงเหลือในคลัง */
export interface ChemicalStock {
  id: string;
  partAName: string;              // เช่น 'น้ำยา Poly (โพลีออล)'
  partBName: string;              // เช่น 'น้ำยา ISO (ไอโซไซยาเนต)'
  partAStockKg: number;           // น้ำยา Poly คงเหลือ (กก.)
  partBStockKg: number;           // น้ำยา ISO คงเหลือ (กก.)
  drumCapacityPolyKg: number;     // ขนาดมาตรฐานถัง Poly (เช่น 210 หรือ 215 กก./ถัง)
  drumCapacityIsoKg: number;      // ขนาดมาตรฐานถัง ISO (เช่น 250 กก./ถัง)
  drumCapacityKg?: number;        // สำหรับ backward compatibility
  updatedAt: string;              // วันเวลาอัปเดตล่าสุด
}

/** ประวัติการตัดสต๊อกน้ำยาตาม SO */
export interface ChemicalCutRecord {
  id: string;
  soNumber: string;               // รหัส SO (หรือหลาย SO คั่นด้วยจุลภาค)
  soNumbers?: string[];           // กรณีเลือกตัดหลายใบงานพร้อมกัน
  cutDate: string;                // วันที่ตัดสต๊อก / ผลิต (YYYY-MM-DD)
  formulaId: string;              // รหัสสูตรที่ใช้
  formulaName: string;            // ชื่อสูตร / ชื่อน้ำยาที่ใช้
  chemicalName?: string;          // ชื่อของน้ำยา (ถ้ามีผูกไว้)
  density?: string;               // ป้ายกำกับ Density
  densityK?: string;              // Density K ที่ใบงานนี้ใช้ (เช่น '25k', '28k', '30k', '35k', '40k')
  polyChemicalName?: string;      // ยี่ห้อน้ำยา Poly ที่ตัดจริง (ใช้จับคู่ถัง)
  isoChemicalName?: string;       // ยี่ห้อน้ำยา ISO ที่ตัดจริง (ใช้จับคู่ถัง)
  inchSize?: string;              // ใช้กับกี่นิ้ว
  drumNumber?: string;            // No. ถังรวม หรือ No. ถังหลัก
  polyDrumNumber?: string;        // No. ถัง Poly ที่ใช้
  isoDrumNumber?: string;         // No. ถัง ISO ที่ใช้
  
  lineSpeedMPerMin: number;       // ความเร็วสายพานที่ใช้ผลิตจริง (เมตร/นาที)
  polyFlowRatePerMin?: number;    // อัตราไหล Poly (กก./นาที)
  isoFlowRatePerMin?: number;     // อัตราไหล ISO (กก./นาที)
  totalFlowRatePerMin?: number;   // รวมอัตราไหล (กก./นาที)
  ratePerMeterUsed: number;       // อัตราที่คำนวณได้จริง (กก./เมตร) = flowRate / lineSpeed
  
  usedMeters: number;             // ความยาวผลิตจริงที่ดึงจาก SO (ม.) (งานดี)
  ngMeters: number;               // ความยาว NG ที่ดึงจาก SO (ม.) (งานเสีย)
  totalMeters: number;            // รวมความยาว (used + ng) (ม.)
  chemicalUsedKg: number;         // น้ำยาที่ใช้ผลิตจริง (กก.)
  chemicalNgKg: number;           // น้ำยาที่เสียจาก NG (กก.)
  totalChemicalKg: number;        // รวมน้ำยาที่ตัดทั้งหมด (กก.)
  partAKg: number;                // น้ำยา Poly ที่ตัด (กก.)
  partBKg: number;                // น้ำยา ISO ที่ตัด (กก.)
  remainingABefore: number;       // สต๊อก Poly ก่อนตัด (กก.)
  remainingAAfter: number;        // สต๊อก Poly หลังตัด (กก.)
  remainingBBefore: number;       // สต๊อก ISO ก่อนตัด (กก.)
  remainingBAfter: number;        // สต๊อก ISO หลังตัด (กก.)
  recordedBy: string;             // ผู้บันทึก
  notes?: string;                 // หมายเหตุ
  source?: 'foil_cut' | 'sandwich_cut' | 'manual'; // แหล่งที่มาของ SO
  productionRound?: string;       // รอบการผลิต (ถ้ามี)
  createdAt: string;              // Timestamp บันทึก
}

/** ประวัติการรับเข้าน้ำยา (เติมสต๊อกถัง) */
export interface ChemicalRestockRecord {
  id: string;
  chemicalName: string;           // ชื่อของน้ำยา เช่น 'K-Foam 32', 'Polyol Dow 210', 'ISO Wanhua 250'
  date: string;                   // วันที่รับเข้า (YYYY-MM-DD)
  drumNumber?: string;            // No. ถัง (แทนล็อต)
  drumNumbers?: string[];         // รายการ No. ถังที่รันต่อกัน (เช่น ['ถัง #A01', 'ถัง #A02', ...])
  polyDrumNumbers?: string[];     // No. ถัง Poly ที่รันต่อกัน
  isoDrumNumbers?: string[];      // No. ถัง ISO ที่รันต่อกัน
  lotNumber: string;              // เก็บ no.ถัง หรือเลขล็อตเดิม
  chemicalType: 'part_a' | 'part_b' | 'both'; // ชนิดน้ำยาที่รับเข้า (Poly / ISO / ทั้งคู่)
  drumsCount: number;             // จำนวนถัง
  kgPerDrum: number;              // กิโลกรัมต่อถัง (ISO 250 กก., Poly 210 หรือ 215 กก.)
  totalKgAdded: number;           // รวม กก. ทั้งหมดที่เพิ่ม
  partAKgAdded: number;           // กก. Poly ที่เพิ่ม
  partBKgAdded: number;           // กก. ISO ที่เพิ่ม
  supplier?: string;              // ผู้จัดจำหน่าย / แบรนด์น้ำยา
  supportedDensities?: string[];  // Density ที่น้ำยาตัวนี้ผลิตได้ (เช่น ['25k', '28k', '30k'])
  drumKgOverrides?: Record<string, number>; // น้ำหนักตั้งต้นของถังที่แก้ไขรายถัง key = 'a|<เลขถัง>' (Poly) หรือ 'b|<เลขถัง>' (ISO)
  recordedBy: string;             // ผู้บันทึก
  notes?: string;                 // หมายเหตุ
  createdAt: string;
}

/** ข้อมูลบัตรสต๊อกถังน้ำยา (Drum Stock Card Ledger) */
export interface DrumStockCardItem {
  id?: string;
  drumNumber: string;
  chemicalName: string;
  brand?: string;
  chemicalType: 'part_a' | 'part_b';
  supportedDensities?: string[];  // Density ที่น้ำยาตัวนี้ผลิตได้ (เช่น ['25k', '28k', '30k'])
  initialKg: number;
  receivedDate: string;
  supplier?: string;
  cuts: Array<{
    cutId: string;
    soNumber: string;
    soNumbers?: string[];
    date: string;
    formulaName: string;
    densityK?: string;            // เช่น 25k, 28k, 30k, 35k, 40k
    lineSpeedMPerMin: number;
    usedMeters: number;           // งานดี (เมตร)
    ngMeters: number;             // งานเสีย (เมตร)
    totalMeters: number;          // รวม (เมตร)
    cutKg: number;                // น้ำยาที่ตัดจากถังนี้ (กก.)
    remainingInDrumKg: number;    // น้ำยาคงเหลือในถังหลังตัด (กก.)
    recordedBy: string;
    notes?: string;
  }>;
  totalUsedMeters: number;        // รวมงานดีที่ใช้ (เมตร)
  totalNgMeters: number;          // รวมงานเสีย (เมตร)
  totalAllMeters: number;         // รวมความยาวทั้งหมด (เมตร)
  totalCutKg: number;             // รวมน้ำยาที่ตัดไปทั้งหมด (กก.)
  remainingKg: number;            // เหลือน้ำยาในถังเบอร์นี้ (กก.)
  remainingPercent: number;       // % คงเหลือในถัง
  status: 'active' | 'empty' | 'low';
}

