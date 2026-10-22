import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

function parseCliArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx !== -1 && idx + 1 < process.argv.length) {
    return process.argv[idx + 1];
  }
  return undefined;
}

const cliPort = parseCliArg('--port') || parseCliArg('-p');
const PORT = Number(cliPort) || Number(process.env.PORT) || 3000;
const cliHost = parseCliArg('--host') || process.env.HOST || '0.0.0.0';
const isProduction = process.env.NODE_ENV === 'production';

// Body parsers with high limit for large data exports/sync
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// CORS & iFrame-safe Security headers (crucial for Google AI Studio environment)
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  // Allow iFrame embedding inside AI Studio preview
  res.removeHeader('X-Frame-Options');
  res.setHeader('Content-Security-Policy', "frame-ancestors *");

  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

// Request logger for API routes
app.use('/api', (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (process.env.DEBUG_API || res.statusCode >= 400) {
      console.log(`[API] ${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// ============================================================================
// Server-side Persistent Data Store
// ============================================================================
const DATA_DIR = path.resolve(process.cwd(), '.server_data');
const DB_FILE = path.join(DATA_DIR, 'database.json');

interface ServerDatabaseSchema {
  version: number;
  lastUpdated: string;
  rolls: any[];
  cutRecords: any[];
  puSandwichCuts: any[];
  cycleCounts: any[];
  soAuditLogs: any[];
  metadata: {
    systemName: string;
    branch: string;
    initializedAt: string;
  };
}

const defaultDatabase: ServerDatabaseSchema = {
  version: 1,
  lastUpdated: new Date().toISOString(),
  rolls: [],
  cutRecords: [],
  puSandwichCuts: [],
  cycleCounts: [],
  soAuditLogs: [],
  metadata: {
    systemName: 'ระบบตัดสต๊อกฟอยล์ PU Foam เมทัลชีท',
    branch: 'หลังคาเย็นสยาม (ร่มเกล้า)',
    initializedAt: new Date().toISOString(),
  },
};

// Production seed generator for Siam Cold Roof (Romklao factory)
function generateFactorySeedData(): ServerDatabaseSchema {
  const rolls = [
    {
      id: 'roll-830-01',
      lotNumber: 'LOT-6901-A',
      rollNumber: '01',
      width: 830,
      pattern: 'ขาว',
      totalMeters: 3000,
      remainingMeters: 2160,
      usedMeters: 800,
      ngMeters: 40,
      status: 'active',
      dateReceived: '2026-03-01',
      notes: 'ล็อตมาตรฐาน ท้องขาว 5 ลอน 1 นิ้ว',
      createdAt: '2026-03-01T08:00:00.000Z',
    },
    {
      id: 'roll-830-02',
      lotNumber: 'LOT-6901-A',
      rollNumber: '02',
      width: 830,
      pattern: 'เงินเงา',
      totalMeters: 3000,
      remainingMeters: 3000,
      usedMeters: 0,
      ngMeters: 0,
      status: 'active',
      isUnused: true,
      dateReceived: '2026-03-01',
      notes: 'ม้วนสำรอง ท้องเงินเงา',
      createdAt: '2026-03-01T08:15:00.000Z',
    },
    {
      id: 'roll-830-03',
      lotNumber: 'LOT-6902-B',
      rollNumber: '03',
      width: 830,
      pattern: 'ไม้อ่อน',
      totalMeters: 2500,
      remainingMeters: 1720,
      usedMeters: 740,
      ngMeters: 40,
      status: 'active',
      dateReceived: '2026-03-10',
      notes: 'ลายไม้อ่อน สเปกพิเศษงานบ้านพักอาศัย',
      createdAt: '2026-03-10T09:00:00.000Z',
    },
    {
      id: 'roll-850-01',
      lotNumber: 'LOT-6901-C',
      rollNumber: '01',
      width: 850,
      pattern: 'ขาว',
      totalMeters: 3000,
      remainingMeters: 1450,
      usedMeters: 1500,
      ngMeters: 50,
      status: 'active',
      dateReceived: '2026-03-02',
      notes: 'ม้วนตัดหลักงาน 3 ลอน 1 นิ้ว',
      createdAt: '2026-03-02T08:30:00.000Z',
    },
    {
      id: 'roll-850-02',
      lotNumber: 'LOT-6902-C',
      rollNumber: '02',
      width: 850,
      pattern: 'ดำ',
      totalMeters: 2500,
      remainingMeters: 2360,
      usedMeters: 130,
      ngMeters: 10,
      status: 'active',
      dateReceived: '2026-03-05',
      notes: 'ท้องดำ สไตล์โมเดิร์น/ลอฟต์',
      createdAt: '2026-03-05T09:30:00.000Z',
    },
    {
      id: 'roll-850-03',
      lotNumber: 'LOT-6903-A',
      rollNumber: '03',
      width: 850,
      pattern: 'ไม้เข้ม',
      totalMeters: 2000,
      remainingMeters: 2000,
      usedMeters: 0,
      ngMeters: 0,
      status: 'active',
      isUnused: true,
      dateReceived: '2026-03-15',
      notes: 'ลายไม้เข้มคลาสสิก',
      createdAt: '2026-03-15T10:00:00.000Z',
    },
    {
      id: 'roll-880-01',
      lotNumber: 'LOT-6902-D',
      rollNumber: '01',
      width: 880,
      pattern: 'ขาว',
      totalMeters: 3000,
      remainingMeters: 920,
      usedMeters: 2020,
      ngMeters: 60,
      status: 'active',
      dateReceived: '2026-03-04',
      notes: '5 ลอน 2 นิ้ว งานโกดังและโรงงาน',
      createdAt: '2026-03-04T08:00:00.000Z',
    },
    {
      id: 'roll-880-02',
      lotNumber: 'LOT-6903-D',
      rollNumber: '02',
      width: 880,
      pattern: 'เทา',
      totalMeters: 2500,
      remainingMeters: 2210,
      usedMeters: 280,
      ngMeters: 10,
      status: 'active',
      dateReceived: '2026-03-12',
      notes: 'ท้องเทาโมเดิร์น',
      createdAt: '2026-03-12T11:00:00.000Z',
    },
    {
      id: 'roll-900-01',
      lotNumber: 'LOT-6901-E',
      rollNumber: '01',
      width: 900,
      pattern: 'ขาว',
      totalMeters: 3000,
      remainingMeters: 480,
      usedMeters: 2460,
      ngMeters: 60,
      status: 'active',
      dateReceived: '2026-03-03',
      notes: 'เหลือสีแดง < 500 ม. เตรียมเปลี่ยนม้วนถัดไป',
      createdAt: '2026-03-03T09:00:00.000Z',
    },
    {
      id: 'roll-900-02',
      lotNumber: 'LOT-6902-E',
      rollNumber: '02',
      width: 900,
      pattern: 'กลีบบัว',
      totalMeters: 2500,
      remainingMeters: 2500,
      usedMeters: 0,
      ngMeters: 0,
      status: 'active',
      isUnused: true,
      dateReceived: '2026-03-14',
      notes: 'ลายกลีบบัวงานโครงการสถาปัตย์',
      createdAt: '2026-03-14T10:30:00.000Z',
    },
    {
      id: 'roll-900-03',
      lotNumber: 'LOT-6903-E',
      rollNumber: '03',
      width: 900,
      pattern: 'ขาว',
      totalMeters: 3000,
      remainingMeters: 3000,
      usedMeters: 0,
      ngMeters: 0,
      status: 'active',
      isUnused: true,
      dateReceived: '2026-03-16',
      notes: 'ม้วนใหม่พร้อมสลับเมื่อเบอร์ 01 หมด',
      createdAt: '2026-03-16T08:00:00.000Z',
    },
    {
      id: 'roll-dep-01',
      lotNumber: 'LOT-6812-Z',
      rollNumber: '05',
      width: 830,
      pattern: 'ขาว',
      totalMeters: 3000,
      remainingMeters: 0,
      usedMeters: 2920,
      ngMeters: 80,
      status: 'depleted',
      dateReceived: '2026-02-15',
      depletedAt: '2026-03-01T17:00:00.000Z',
      notes: 'ตัดหมดม้วนแล้ว ยอดตรงสมบูรณ์',
      createdAt: '2026-02-15T08:00:00.000Z',
    },
  ];

  const cutRecords = [
    {
      id: 'cut-001',
      foilId: 'roll-830-01',
      lotNumber: 'LOT-6901-A',
      rollNumber: '01',
      width: 830,
      pattern: 'ขาว',
      soNumber: 'SO-6701-015',
      cutType: 'so',
      cutStatus: 'completed',
      usedMeters: 320,
      ngMeters: 15,
      totalDeducted: 335,
      remainingBefore: 3000,
      remainingAfter: 2665,
      usageDate: '2026-03-02',
      recordedDate: '2026-03-02',
      recordedBy: 'สมชาย นพคุณ (ช่างเครื่อง)',
      verificationStatus: 'verified',
      verifiedBy: 'หัวหน้างาน สมเกียรติ',
      verifiedAt: '2026-03-02T16:00:00.000Z',
      notes: 'งานหลังคาโครงการ ร่มเกล้า เฟส 1',
      createdAt: '2026-03-02T10:30:00.000Z',
    },
    {
      id: 'cut-002',
      foilId: 'roll-830-01',
      lotNumber: 'LOT-6901-A',
      rollNumber: '01',
      width: 830,
      pattern: 'ขาว',
      soNumber: 'SO-6701-042',
      cutType: 'so',
      cutStatus: 'completed',
      usedMeters: 480,
      ngMeters: 25,
      totalDeducted: 505,
      remainingBefore: 2665,
      remainingAfter: 2160,
      usageDate: '2026-03-04',
      recordedDate: '2026-03-04',
      recordedBy: 'วิชัย ชัยชนะ',
      verificationStatus: 'verified',
      verifiedBy: 'หัวหน้างาน สมเกียรติ',
      verifiedAt: '2026-03-04T17:00:00.000Z',
      notes: 'ตัด 2 ช่วง รวม NG หัวท้ายเรียบร้อย',
      createdAt: '2026-03-04T11:15:00.000Z',
    },
    {
      id: 'cut-003',
      foilId: 'roll-850-01',
      lotNumber: 'LOT-6901-C',
      rollNumber: '01',
      width: 850,
      pattern: 'ขาว',
      soNumber: 'SO-6702-088',
      cutType: 'so',
      cutStatus: 'completed',
      usedMeters: 850,
      ngMeters: 30,
      totalDeducted: 880,
      remainingBefore: 3000,
      remainingAfter: 2120,
      usageDate: '2026-03-05',
      recordedDate: '2026-03-05',
      recordedBy: 'ธีรศักดิ์ สุวรรณ',
      verificationStatus: 'verified',
      verifiedBy: 'หัวหน้างาน สมเกียรติ',
      verifiedAt: '2026-03-05T15:30:00.000Z',
      notes: 'งาน 3 ลอน ออเดอร์ใหญ่จัดส่งลาดกระบัง',
      createdAt: '2026-03-05T09:45:00.000Z',
    },
    {
      id: 'cut-004',
      foilId: 'roll-850-01',
      lotNumber: 'LOT-6901-C',
      rollNumber: '01',
      width: 850,
      pattern: 'ขาว',
      soNumber: 'SO-6702-105',
      cutType: 'so',
      cutStatus: 'completed',
      usedMeters: 650,
      ngMeters: 20,
      totalDeducted: 670,
      remainingBefore: 2120,
      remainingAfter: 1450,
      usageDate: '2026-03-08',
      recordedDate: '2026-03-08',
      recordedBy: 'สมชาย นพคุณ (ช่างเครื่อง)',
      verificationStatus: 'verified',
      notes: 'ตัดรอบบ่าย ตรวจสอบผิวฟอยล์เรียบสนิท',
      createdAt: '2026-03-08T14:20:00.000Z',
    },
    {
      id: 'cut-005',
      foilId: 'roll-880-01',
      lotNumber: 'LOT-6902-D',
      rollNumber: '01',
      width: 880,
      pattern: 'ขาว',
      soNumber: 'SO-6702-140',
      cutType: 'so',
      cutStatus: 'completed',
      usedMeters: 1100,
      ngMeters: 35,
      totalDeducted: 1135,
      remainingBefore: 3000,
      remainingAfter: 1865,
      usageDate: '2026-03-09',
      recordedDate: '2026-03-09',
      recordedBy: 'ประภาส บรรเจิด',
      verificationStatus: 'verified',
      notes: 'หลังคาโกดังมีนบุรี ความยาว 12 เมตร',
      createdAt: '2026-03-09T10:00:00.000Z',
    },
    {
      id: 'cut-006',
      foilId: 'roll-880-01',
      lotNumber: 'LOT-6902-D',
      rollNumber: '01',
      width: 880,
      pattern: 'ขาว',
      soNumber: 'SO-6702-180',
      cutType: 'so',
      cutStatus: 'completed',
      usedMeters: 920,
      ngMeters: 25,
      totalDeducted: 945,
      remainingBefore: 1865,
      remainingAfter: 920,
      usageDate: '2026-03-12',
      recordedDate: '2026-03-12',
      recordedBy: 'อนุชิต สดใส',
      verificationStatus: 'verified',
      notes: 'ตัดครบตามสเปก',
      createdAt: '2026-03-12T13:40:00.000Z',
    },
    {
      id: 'cut-007',
      foilId: 'roll-900-01',
      lotNumber: 'LOT-6901-E',
      rollNumber: '01',
      width: 900,
      pattern: 'ขาว',
      soNumber: 'SO-6703-022',
      cutType: 'so',
      cutStatus: 'completed',
      usedMeters: 1460,
      ngMeters: 35,
      totalDeducted: 1495,
      remainingBefore: 3000,
      remainingAfter: 1505,
      usageDate: '2026-03-10',
      recordedDate: '2026-03-10',
      recordedBy: 'วิชัย ชัยชนะ',
      verificationStatus: 'verified',
      notes: '3 ลอน 2 นิ้ว งานส่งต่อสาขาบางพลี',
      createdAt: '2026-03-10T11:00:00.000Z',
    },
    {
      id: 'cut-008',
      foilId: 'roll-900-01',
      lotNumber: 'LOT-6901-E',
      rollNumber: '01',
      width: 900,
      pattern: 'ขาว',
      soNumber: 'SO-6703-050',
      cutType: 'so',
      cutStatus: 'completed',
      usedMeters: 1000,
      ngMeters: 25,
      totalDeducted: 1025,
      remainingBefore: 1505,
      remainingAfter: 480,
      usageDate: '2026-03-14',
      recordedDate: '2026-03-14',
      recordedBy: 'สมชาย นพคุณ (ช่างเครื่อง)',
      verificationStatus: 'verified',
      notes: 'ยอดคงเหลือเข้าโซนแดงเตือนเปลี่ยนม้วน',
      createdAt: '2026-03-14T15:10:00.000Z',
    },
    {
      id: 'cut-009',
      foilId: 'roll-850-02',
      lotNumber: 'LOT-6902-C',
      rollNumber: '02',
      width: 850,
      pattern: 'ดำ',
      soNumber: 'เบิกซ่อมหน้างาน',
      cutType: 'non_so',
      cutStatus: 'completed',
      nonSoReason: 'เบิกซ่อมแผ่นหลังคาเคลมหน้างานพัทยา',
      usedMeters: 130,
      ngMeters: 10,
      totalDeducted: 140,
      remainingBefore: 2500,
      remainingAfter: 2360,
      usageDate: '2026-03-11',
      recordedDate: '2026-03-11',
      recordedBy: 'ประภาส บรรเจิด',
      notes: 'เบิกไม่ใช้ SO ได้รับอนุมัติจาก ผจก. ฝ่ายผลิต',
      createdAt: '2026-03-11T09:30:00.000Z',
    },
  ];

  const puSandwichCuts = [
    {
      id: 'pusw-001',
      soNumber: 'SO-6703-SW01',
      productionDate: '2026-03-10',
      coilColor: 'ขาวมุก',
      thickness: '0.35',
      coilNumber: 'C-9021',
      steelOrigin: 'เหล็กBlue Scope',
      weightBefore: 3450,
      weightAfter: 2820,
      weightUsed: 630,
      soLengthMeters: 315,
      ngMeters: 15,
      ngKg: 30,
      lengthMeters: 300,
      recordedBy: 'สมชาย นพคุณ (ช่างเครื่อง)',
      notes: 'แซนวิชฉีดโฟม 2 นิ้ว ลอนมาตรฐาน ผิวขาวมุก',
      createdAt: '2026-03-10T10:30:00.000Z',
    },
    {
      id: 'pusw-002',
      soNumber: 'SO-6703-SW02',
      productionDate: '2026-03-11',
      coilColor: 'เทาเข้ม',
      thickness: '0.40',
      coilNumber: 'C-9022',
      steelOrigin: 'เหล็กนอก',
      weightBefore: 4120,
      weightAfter: 3280,
      weightUsed: 840,
      soLengthMeters: 380,
      ngMeters: 22,
      ngKg: 48.4,
      lengthMeters: 358,
      recordedBy: 'วิชัย ชัยชนะ',
      notes: 'งานแซนวิชสีเทา คลุมอาคารอเนกประสงค์',
      createdAt: '2026-03-11T14:00:00.000Z',
    },
    {
      id: 'pusw-003',
      soNumber: 'SO-6703-SW03',
      productionDate: '2026-03-12',
      coilColor: 'น้ำเงิน',
      thickness: '0.35',
      coilNumber: 'C-9025',
      steelOrigin: 'เหล็กBlue Scope',
      weightBefore: 2980,
      weightAfter: 2150,
      weightUsed: 830,
      soLengthMeters: 410,
      ngMeters: 18,
      ngKg: 36,
      lengthMeters: 392,
      recordedBy: 'ธีรศักดิ์ สุวรรณ',
      notes: 'ฉีดโฟมเต็มร่อง ลอน 3 ลอน สเปกบลูสโคป',
      createdAt: '2026-03-12T11:20:00.000Z',
    },
    {
      id: 'pusw-004',
      soNumber: 'SO-6703-SW04',
      productionDate: '2026-03-14',
      coilColor: 'ดำด้าน',
      thickness: '0.45',
      coilNumber: 'C-9030',
      steelOrigin: 'เหล็กนอก',
      weightBefore: 5200,
      weightAfter: 4100,
      weightUsed: 1100,
      soLengthMeters: 460,
      ngMeters: 25,
      ngKg: 59.8,
      lengthMeters: 435,
      recordedBy: 'ประภาส บรรเจิด',
      notes: 'สเปกหนา 0.45 มม. รีดตรงสวยงาม',
      createdAt: '2026-03-14T16:15:00.000Z',
    },
  ];

  const cycleCounts = [
    {
      id: 'cycle-001',
      date: '2026-03-15',
      sessionName: 'ตรวจนับสต๊อกฟอยล์ประจำปักษ์กลางเดือน มี.ค. 2569',
      conductedBy: 'สมเกียรติ มั่งมี (หัวหน้าคลัง)',
      totalRollsChecked: 11,
      totalDiscrepancyMeters: 0,
      status: 'approved',
      items: [
        { rollId: 'roll-830-01', systemMeters: 2160, physicalMeters: 2160, diffMeters: 0 },
        { rollId: 'roll-850-01', systemMeters: 1450, physicalMeters: 1450, diffMeters: 0 },
        { rollId: 'roll-880-01', systemMeters: 920, physicalMeters: 920, diffMeters: 0 },
        { rollId: 'roll-900-01', systemMeters: 480, physicalMeters: 480, diffMeters: 0 },
      ],
      createdAt: '2026-03-15T16:30:00.000Z',
    },
  ];

  const soAuditLogs = [
    {
      id: 'audit-001',
      action: 'SO_VERIFIED',
      soNumber: 'SO-6701-015',
      performedBy: 'หัวหน้างาน สมเกียรติ',
      timestamp: '2026-03-02T16:00:00.000Z',
      details: 'ตรวจสอบใบสั่งตัด SO-6701-015 ม้วน LOT-6901-A เบอร์ 01 เมตรตัดตรงตามใบงาน',
    },
    {
      id: 'audit-002',
      action: 'SO_VERIFIED',
      soNumber: 'SO-6701-042',
      performedBy: 'หัวหน้างาน สมเกียรติ',
      timestamp: '2026-03-04T17:00:00.000Z',
      details: 'รับรองยอดตัดและยอด NG หัวท้าย 25 ม.',
    },
  ];

  return {
    version: 1,
    lastUpdated: new Date().toISOString(),
    rolls,
    cutRecords,
    puSandwichCuts,
    cycleCounts,
    soAuditLogs,
    metadata: {
      systemName: 'ระบบตัดสต๊อกฟอยล์ PU Foam เมทัลชีท',
      branch: 'หลังคาเย็นสยาม (ร่มเกล้า)',
      initializedAt: new Date().toISOString(),
    },
  };
}

function ensureDataStore(): ServerDatabaseSchema {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE)) {
      const emptyDb: ServerDatabaseSchema = {
        version: 1,
        lastUpdated: new Date().toISOString(),
        rolls: [],
        cutRecords: [],
        puSandwichCuts: [],
        cycleCounts: [],
        soAuditLogs: [],
        metadata: {
          systemName: 'ระบบตัดสต๊อกฟอยล์ PU Foam เมทัลชีท',
          branch: 'หลังคาเย็นสยาม (ร่มเกล้า)',
          initializedAt: new Date().toISOString(),
        },
      };
      fs.writeFileSync(DB_FILE, JSON.stringify(emptyDb, null, 2), 'utf-8');
      return emptyDb;
    }
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      ...defaultDatabase,
      ...parsed,
      rolls: Array.isArray(parsed.rolls) ? parsed.rolls : [],
      cutRecords: Array.isArray(parsed.cutRecords) ? parsed.cutRecords : [],
      puSandwichCuts: Array.isArray(parsed.puSandwichCuts) ? parsed.puSandwichCuts : [],
      cycleCounts: Array.isArray(parsed.cycleCounts) ? parsed.cycleCounts : [],
      soAuditLogs: Array.isArray(parsed.soAuditLogs) ? parsed.soAuditLogs : [],
    };
  } catch (err) {
    console.warn('[ServerDB] Failed to read database.json, using empty store:', err);
    return {
      ...defaultDatabase,
      rolls: [],
      cutRecords: [],
      puSandwichCuts: [],
      cycleCounts: [],
      soAuditLogs: [],
    };
  }
}

let inMemoryDb: ServerDatabaseSchema = ensureDataStore();

function persistDataStore(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    inMemoryDb.lastUpdated = new Date().toISOString();
    fs.writeFileSync(DB_FILE, JSON.stringify(inMemoryDb, null, 2), 'utf-8');
  } catch (err) {
    console.error('[ServerDB] Save error:', err);
  }
}

// Read Firebase applet configuration if present
let firebaseAppletConfig: any = {};
try {
  const cfgPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(cfgPath)) {
    firebaseAppletConfig = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
  }
} catch (e) {
  // Config missing or unreadable
}

// ============================================================================
// REST API Routes
// ============================================================================

/**
 * GET /api/health
 * Health check & fullstack server diagnostic endpoint
 */
app.get('/api/health', (req: Request, res: Response) => {
  const activeRollsCount = inMemoryDb.rolls.filter(
    (r) => r.status === 'active' && !r.isZeroedOut && Number(r.remainingMeters) > 0
  ).length;
  const depletedRollsCount = inMemoryDb.rolls.filter(
    (r) => r.status === 'depleted' || r.isZeroedOut || Number(r.remainingMeters) <= 0
  ).length;

  res.json({
    status: 'ok',
    server: 'Express Full-Stack',
    version: '1.0.0',
    mode: isProduction ? 'production' : 'development',
    port: PORT,
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    memoryUsageMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    database: {
      projectId: firebaseAppletConfig.projectId || 'stock-foil',
      firestoreDatabaseId: firebaseAppletConfig.firestoreDatabaseId || '(default)',
      storeType: 'Persistent JSON Store + Firestore Gateway',
      storeLastUpdated: inMemoryDb.lastUpdated,
      counts: {
        totalRolls: inMemoryDb.rolls.length,
        activeRolls: activeRollsCount,
        depletedRolls: depletedRollsCount,
        cutRecords: inMemoryDb.cutRecords.length,
        puSandwichCuts: inMemoryDb.puSandwichCuts.length,
        cycleCounts: inMemoryDb.cycleCounts.length,
        soAuditLogs: inMemoryDb.soAuditLogs.length,
      },
    },
  });
});

/**
 * GET /api/info
 * Detailed system information and endpoints registry
 */
app.get('/api/info', (req: Request, res: Response) => {
  res.json({
    name: 'ระบบตัดสต๊อกฟอยล์ PU Foam เมทัลชีท',
    system: 'หลังคาเย็นสยาม (ร่มเกล้า)',
    fullstack: true,
    capabilities: [
      'RESTful Data API (/api/*)',
      'Realtime Cloud Firestore Integration',
      'Dual Database Target (stock-foil / xenon-airport-rlxdt)',
      'Local Storage Fallback & Offline Resilience',
      'Full Database Backup Export/Import',
      'Tablet Large Touch Numpad Support',
      'PU Sandwich Steel & Scrap Multi-SO Computation',
      'SO Audit Trail & Chain Verification',
    ],
    endpoints: [
      { method: 'GET', path: '/api/health', desc: 'Server health and database metrics' },
      { method: 'GET', path: '/api/stats', desc: 'Aggregated stock and usage statistics' },
      { method: 'GET', path: '/api/rolls', desc: 'List foil rolls with filters' },
      { method: 'POST', path: '/api/rolls', desc: 'Create new foil roll' },
      { method: 'GET', path: '/api/rolls/:id', desc: 'Get single foil roll details' },
      { method: 'PUT', path: '/api/rolls/:id', desc: 'Update foil roll' },
      { method: 'DELETE', path: '/api/rolls/:id', desc: 'Delete or archive roll' },
      { method: 'GET', path: '/api/cuts', desc: 'List stock cut records' },
      { method: 'POST', path: '/api/cuts', desc: 'Create cutting record & update roll' },
      { method: 'DELETE', path: '/api/cuts/:id', desc: 'Delete cut record' },
      { method: 'GET', path: '/api/sandwich', desc: 'List PU sandwich cut records' },
      { method: 'POST', path: '/api/sandwich', desc: 'Create PU sandwich cut record' },
      { method: 'DELETE', path: '/api/sandwich/:id', desc: 'Delete PU sandwich record' },
      { method: 'GET', path: '/api/cycle-counts', desc: 'List cycle count sessions' },
      { method: 'POST', path: '/api/cycle-counts', desc: 'Save cycle count session' },
      { method: 'GET', path: '/api/audit-logs', desc: 'List SO change and audit trail logs' },
      { method: 'GET', path: '/api/backup/export', desc: 'Export entire database as JSON' },
      { method: 'POST', path: '/api/backup/import', desc: 'Restore database from JSON' },
      { method: 'POST', path: '/api/sync', desc: 'Two-way sync client records with server' },
    ],
  });
});

/**
 * GET /api/stats
 * Aggregated inventory and cut metrics
 */
app.get('/api/stats', (req: Request, res: Response) => {
  const rolls = inMemoryDb.rolls;
  const cuts = inMemoryDb.cutRecords;
  const sandwich = inMemoryDb.puSandwichCuts;

  const activeRolls = rolls.filter(
    (r) => r.status === 'active' && !r.isZeroedOut && Number(r.remainingMeters) > 0
  );
  const depletedRolls = rolls.filter(
    (r) => r.status === 'depleted' || r.isZeroedOut || Number(r.remainingMeters) <= 0
  );
  const lowStockRolls = activeRolls.filter((r) => Number(r.remainingMeters) <= 100);

  const totalMetersRemaining = activeRolls.reduce((sum, r) => sum + (Number(r.remainingMeters) || 0), 0);
  const totalMetersUsed = cuts.reduce((sum, c) => sum + (Number(c.usedMeters) || 0), 0);
  const totalNgMeters = cuts.reduce((sum, c) => sum + (Number(c.ngMeters) || 0), 0);
  const ngRatePercent = totalMetersUsed > 0 ? (totalNgMeters / totalMetersUsed) * 100 : 0;

  // Breakdown by width
  const widths = [830, 850, 880, 900];
  const byWidth = widths.map((w) => {
    const matching = activeRolls.filter((r) => Number(r.width) === w);
    const rem = matching.reduce((s, r) => s + (Number(r.remainingMeters) || 0), 0);
    const used = cuts.filter((c) => Number(c.width) === w).reduce((s, c) => s + (Number(c.usedMeters) || 0), 0);
    return { width: w, activeRollCount: matching.length, remainingMeters: rem, usedMeters: used };
  });

  // PU Sandwich stats
  const totalSandwichSteelUsedKg = sandwich.reduce((sum, s) => sum + (Number(s.weightUsed) || 0), 0);
  const totalSandwichLengthMeters = sandwich.reduce((sum, s) => sum + (Number(s.soLengthMeters) || 0), 0);
  const totalSandwichNgMeters = sandwich.reduce((sum, s) => sum + (Number(s.ngMeters) || 0), 0);
  const totalSandwichNgKg = sandwich.reduce((sum, s) => sum + (Number(s.ngKg) || 0), 0);

  res.json({
    inventory: {
      totalRolls: rolls.length,
      activeRolls: activeRolls.length,
      depletedRolls: depletedRolls.length,
      lowStockRolls: lowStockRolls.length,
      totalMetersRemaining: Math.round(totalMetersRemaining * 100) / 100,
      totalMetersUsed: Math.round(totalMetersUsed * 100) / 100,
      totalNgMeters: Math.round(totalNgMeters * 100) / 100,
      ngRatePercent: Math.round(ngRatePercent * 100) / 100,
      byWidth,
    },
    sandwich: {
      totalRecords: sandwich.length,
      totalSteelUsedKg: Math.round(totalSandwichSteelUsedKg * 100) / 100,
      totalLengthMeters: Math.round(totalSandwichLengthMeters * 100) / 100,
      totalNgMeters: Math.round(totalSandwichNgMeters * 100) / 100,
      totalNgKg: Math.round(totalSandwichNgKg * 100) / 100,
    },
    computedAt: new Date().toISOString(),
  });
});

// ----------------------------------------------------------------------------
// FOIL ROLLS ENDPOINTS
// ----------------------------------------------------------------------------

/**
 * GET /api/rolls
 * Query params: status (active/depleted/all), width, pattern, search, limit, offset
 */
app.get('/api/rolls', (req: Request, res: Response) => {
  let list = [...inMemoryDb.rolls];

  const { status, width, pattern, search, limit, offset } = req.query;

  if (status === 'active') {
    list = list.filter((r) => r.status === 'active' && !r.isZeroedOut && Number(r.remainingMeters) > 0);
  } else if (status === 'depleted') {
    list = list.filter((r) => r.status === 'depleted' || r.isZeroedOut || Number(r.remainingMeters) <= 0);
  }

  if (width) {
    const wNum = Number(width);
    if (!isNaN(wNum)) {
      list = list.filter((r) => Number(r.width) === wNum);
    }
  }

  if (pattern && typeof pattern === 'string') {
    list = list.filter((r) => (r.pattern || '').toLowerCase() === pattern.toLowerCase());
  }

  if (search && typeof search === 'string') {
    const q = search.trim().toLowerCase();
    list = list.filter(
      (r) =>
        (r.lotNumber || '').toLowerCase().includes(q) ||
        (r.rollNumber || '').toLowerCase().includes(q) ||
        (r.notes || '').toLowerCase().includes(q)
    );
  }

  const total = list.length;
  const off = Math.max(0, Number(offset) || 0);
  const lim = Math.max(1, Math.min(500, Number(limit) || 100));
  const paginated = list.slice(off, off + lim);

  res.json({
    total,
    offset: off,
    limit: lim,
    rolls: paginated,
  });
});

/**
 * GET /api/rolls/:id
 */
app.get('/api/rolls/:id', (req: Request, res: Response) => {
  const roll = inMemoryDb.rolls.find((r) => r.id === req.params.id);
  if (!roll) {
    res.status(404).json({ error: 'Foil roll not found' });
    return;
  }
  const rollCuts = inMemoryDb.cutRecords.filter((c) => c.foilId === roll.id);
  res.json({
    roll,
    cuts: rollCuts,
  });
});

/**
 * POST /api/rolls
 * Register new roll
 */
app.post('/api/rolls', (req: Request, res: Response) => {
  const body = req.body;
  if (!body.lotNumber || !body.rollNumber || !body.width || !body.totalMeters) {
    res.status(400).json({ error: 'Missing required roll fields (lotNumber, rollNumber, width, totalMeters)' });
    return;
  }

  const id = body.id || `roll_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const totalMeters = Number(body.totalMeters) || 0;
  const remainingMeters = body.remainingMeters !== undefined ? Number(body.remainingMeters) : totalMeters;

  const newRoll = {
    ...body,
    id,
    lotNumber: String(body.lotNumber).trim(),
    rollNumber: String(body.rollNumber).trim(),
    width: Number(body.width),
    pattern: body.pattern || 'ขาว',
    totalMeters,
    remainingMeters,
    usedMeters: Number(body.usedMeters) || 0,
    ngMeters: Number(body.ngMeters) || 0,
    status: remainingMeters <= 0 ? 'depleted' : 'active',
    dateReceived: body.dateReceived || new Date().toISOString().slice(0, 10),
    createdAt: body.createdAt || new Date().toISOString(),
  };

  inMemoryDb.rolls.unshift(newRoll);
  persistDataStore();

  res.status(201).json({ success: true, roll: newRoll });
});

/**
 * PUT /api/rolls/:id
 */
app.put('/api/rolls/:id', (req: Request, res: Response) => {
  const index = inMemoryDb.rolls.findIndex((r) => r.id === req.params.id);
  if (index === -1) {
    res.status(404).json({ error: 'Foil roll not found' });
    return;
  }

  const existing = inMemoryDb.rolls[index];
  const updated = {
    ...existing,
    ...req.body,
    id: existing.id, // prevent ID change
    updatedAt: new Date().toISOString(),
  };

  if (updated.remainingMeters !== undefined) {
    updated.status = Number(updated.remainingMeters) <= 0 || updated.isZeroedOut ? 'depleted' : 'active';
  }

  inMemoryDb.rolls[index] = updated;
  persistDataStore();

  res.json({ success: true, roll: updated });
});

/**
 * DELETE /api/rolls/:id
 */
app.delete('/api/rolls/:id', (req: Request, res: Response) => {
  const index = inMemoryDb.rolls.findIndex((r) => r.id === req.params.id);
  if (index === -1) {
    res.status(404).json({ error: 'Foil roll not found' });
    return;
  }

  const removed = inMemoryDb.rolls.splice(index, 1)[0];
  persistDataStore();

  res.json({ success: true, deletedRoll: removed });
});

// ----------------------------------------------------------------------------
// CUT RECORDS ENDPOINTS
// ----------------------------------------------------------------------------

/**
 * GET /api/cuts
 * Query params: soNumber, foilId, cutType, limit, offset
 */
app.get('/api/cuts', (req: Request, res: Response) => {
  let list = [...inMemoryDb.cutRecords];

  const { soNumber, foilId, cutType, search, limit, offset } = req.query;

  if (soNumber && typeof soNumber === 'string') {
    list = list.filter((c) => (c.soNumber || '').toLowerCase().includes(soNumber.toLowerCase()));
  }

  if (foilId && typeof foilId === 'string') {
    list = list.filter((c) => c.foilId === foilId);
  }

  if (cutType && typeof cutType === 'string') {
    list = list.filter((c) => c.cutType === cutType);
  }

  if (search && typeof search === 'string') {
    const q = search.trim().toLowerCase();
    list = list.filter(
      (c) =>
        (c.soNumber || '').toLowerCase().includes(q) ||
        (c.lotNumber || '').toLowerCase().includes(q) ||
        (c.rollNumber || '').toLowerCase().includes(q) ||
        (c.recordedBy || '').toLowerCase().includes(q)
    );
  }

  const total = list.length;
  const off = Math.max(0, Number(offset) || 0);
  const lim = Math.max(1, Math.min(500, Number(limit) || 100));
  const paginated = list.slice(off, off + lim);

  res.json({
    total,
    offset: off,
    limit: lim,
    cuts: paginated,
  });
});

/**
 * POST /api/cuts
 * Record cut action & update roll remaining meters
 */
app.post('/api/cuts', (req: Request, res: Response) => {
  const body = req.body;
  if (!body.foilId || !body.soNumber || body.usedMeters === undefined) {
    res.status(400).json({ error: 'Missing required cut record fields (foilId, soNumber, usedMeters)' });
    return;
  }

  const rollIndex = inMemoryDb.rolls.findIndex((r) => r.id === body.foilId);
  const roll = rollIndex !== -1 ? inMemoryDb.rolls[rollIndex] : null;

  const id = body.id || `cut_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const usedMeters = Number(body.usedMeters) || 0;
  const ngMeters = Number(body.ngMeters) || 0;
  const totalDeducted = body.totalDeducted !== undefined ? Number(body.totalDeducted) : usedMeters + ngMeters;

  const remainingBefore = body.remainingBefore !== undefined ? Number(body.remainingBefore) : (roll ? Number(roll.remainingMeters) : 0);
  const remainingAfter = body.remainingAfter !== undefined ? Number(body.remainingAfter) : Math.max(0, remainingBefore - totalDeducted);

  const newCut = {
    ...body,
    id,
    usedMeters,
    ngMeters,
    totalDeducted,
    remainingBefore,
    remainingAfter,
    createdAt: body.createdAt || new Date().toISOString(),
    recordedDate: body.recordedDate || new Date().toISOString().slice(0, 10),
  };

  inMemoryDb.cutRecords.unshift(newCut);

  // Update roll remaining meters if found
  if (roll) {
    roll.remainingMeters = remainingAfter;
    roll.usedMeters = (Number(roll.usedMeters) || 0) + usedMeters;
    roll.ngMeters = (Number(roll.ngMeters) || 0) + ngMeters;
    roll.status = remainingAfter <= 0 ? 'depleted' : 'active';
    inMemoryDb.rolls[rollIndex] = roll;
  }

  persistDataStore();

  res.status(201).json({ success: true, cut: newCut, roll });
});

/**
 * DELETE /api/cuts/:id
 */
app.delete('/api/cuts/:id', (req: Request, res: Response) => {
  const index = inMemoryDb.cutRecords.findIndex((c) => c.id === req.params.id);
  if (index === -1) {
    res.status(404).json({ error: 'Cut record not found' });
    return;
  }

  const removed = inMemoryDb.cutRecords.splice(index, 1)[0];
  persistDataStore();

  res.json({ success: true, deletedCut: removed });
});

// ----------------------------------------------------------------------------
// PU SANDWICH ENDPOINTS
// ----------------------------------------------------------------------------

/**
 * GET /api/sandwich
 */
app.get('/api/sandwich', (req: Request, res: Response) => {
  const { search, limit, offset } = req.query;
  let list = [...inMemoryDb.puSandwichCuts];

  if (search && typeof search === 'string') {
    const q = search.trim().toLowerCase();
    list = list.filter(
      (s) =>
        (s.soNumber || '').toLowerCase().includes(q) ||
        (s.coilNumber || '').toLowerCase().includes(q) ||
        (s.coilColor || '').toLowerCase().includes(q) ||
        (s.recordedBy || '').toLowerCase().includes(q)
    );
  }

  const total = list.length;
  const off = Math.max(0, Number(offset) || 0);
  const lim = Math.max(1, Math.min(500, Number(limit) || 100));

  res.json({
    total,
    offset: off,
    limit: lim,
    records: list.slice(off, off + lim),
  });
});

/**
 * POST /api/sandwich
 */
app.post('/api/sandwich', (req: Request, res: Response) => {
  const body = req.body;
  if (!body.soNumber || body.weightUsed === undefined) {
    res.status(400).json({ error: 'Missing required PU Sandwich fields (soNumber, weightUsed)' });
    return;
  }

  const id = body.id || `pusw_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const record = {
    ...body,
    id,
    createdAt: body.createdAt || new Date().toISOString(),
  };

  inMemoryDb.puSandwichCuts.unshift(record);
  persistDataStore();

  res.status(201).json({ success: true, record });
});

/**
 * DELETE /api/sandwich/:id
 */
app.delete('/api/sandwich/:id', (req: Request, res: Response) => {
  const index = inMemoryDb.puSandwichCuts.findIndex((s) => s.id === req.params.id);
  if (index === -1) {
    res.status(404).json({ error: 'PU Sandwich record not found' });
    return;
  }

  const removed = inMemoryDb.puSandwichCuts.splice(index, 1)[0];
  persistDataStore();

  res.json({ success: true, deletedRecord: removed });
});

// ----------------------------------------------------------------------------
// FULL DATA BACKUP & SYNC ENDPOINTS
// ----------------------------------------------------------------------------

/**
 * GET /api/backup/export
 * Downloads full database JSON
 */
app.get('/api/backup/export', (req: Request, res: Response) => {
  const exportPayload = {
    exportedAt: new Date().toISOString(),
    system: 'หลังคาเย็นสยาม (ร่มเกล้า)',
    version: inMemoryDb.version,
    counts: {
      rolls: inMemoryDb.rolls.length,
      cutRecords: inMemoryDb.cutRecords.length,
      puSandwichCuts: inMemoryDb.puSandwichCuts.length,
      cycleCounts: inMemoryDb.cycleCounts.length,
      soAuditLogs: inMemoryDb.soAuditLogs.length,
    },
    data: {
      rolls: inMemoryDb.rolls,
      cutRecords: inMemoryDb.cutRecords,
      puSandwichCuts: inMemoryDb.puSandwichCuts,
      cycleCounts: inMemoryDb.cycleCounts,
      soAuditLogs: inMemoryDb.soAuditLogs,
    },
  };

  const filename = `pufoam_backup_${new Date().toISOString().slice(0, 10)}.json`;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.json(exportPayload);
});

/**
 * POST /api/backup/import
 * Restores database from JSON
 */
app.post('/api/backup/import', (req: Request, res: Response) => {
  const body = req.body;
  const data = body.data || body;

  if (!data || (!Array.isArray(data.rolls) && !Array.isArray(data.cutRecords))) {
    res.status(400).json({ error: 'Invalid backup format. Must contain rolls or cutRecords array.' });
    return;
  }

  if (Array.isArray(data.rolls)) inMemoryDb.rolls = data.rolls;
  if (Array.isArray(data.cutRecords)) inMemoryDb.cutRecords = data.cutRecords;
  if (Array.isArray(data.puSandwichCuts)) inMemoryDb.puSandwichCuts = data.puSandwichCuts;
  if (Array.isArray(data.cycleCounts)) inMemoryDb.cycleCounts = data.cycleCounts;
  if (Array.isArray(data.soAuditLogs)) inMemoryDb.soAuditLogs = data.soAuditLogs;

  persistDataStore();

  res.json({
    success: true,
    message: 'Database imported successfully',
    counts: {
      rolls: inMemoryDb.rolls.length,
      cutRecords: inMemoryDb.cutRecords.length,
      puSandwichCuts: inMemoryDb.puSandwichCuts.length,
    },
  });
});

/**
 * POST /api/sync
 * Two-way sync: merges client-side records into server store and returns fresh snapshot
 */
app.post('/api/sync', (req: Request, res: Response) => {
  const { rolls = [], cutRecords = [], puSandwichCuts = [] } = req.body;

  // Merge rolls by ID
  const rollMap = new Map<string, any>();
  inMemoryDb.rolls.forEach((r) => rollMap.set(r.id, r));
  rolls.forEach((r: any) => {
    if (r && r.id) {
      const existing = rollMap.get(r.id);
      if (!existing || (r.updatedAt && r.updatedAt > (existing.updatedAt || ''))) {
        rollMap.set(r.id, { ...existing, ...r });
      }
    }
  });
  inMemoryDb.rolls = Array.from(rollMap.values());

  // Merge cutRecords by ID
  const cutMap = new Map<string, any>();
  inMemoryDb.cutRecords.forEach((c) => cutMap.set(c.id, c));
  cutRecords.forEach((c: any) => {
    if (c && c.id) cutMap.set(c.id, c);
  });
  inMemoryDb.cutRecords = Array.from(cutMap.values()).sort(
    (a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')
  );

  // Merge PU sandwich cuts
  const sandwichMap = new Map<string, any>();
  inMemoryDb.puSandwichCuts.forEach((s) => sandwichMap.set(s.id, s));
  puSandwichCuts.forEach((s: any) => {
    if (s && s.id) sandwichMap.set(s.id, s);
  });
  inMemoryDb.puSandwichCuts = Array.from(sandwichMap.values()).sort(
    (a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')
  );

  persistDataStore();

  res.json({
    success: true,
    syncedAt: new Date().toISOString(),
    serverCounts: {
      rolls: inMemoryDb.rolls.length,
      cutRecords: inMemoryDb.cutRecords.length,
      puSandwichCuts: inMemoryDb.puSandwichCuts.length,
    },
    rolls: inMemoryDb.rolls,
    cutRecords: inMemoryDb.cutRecords,
    puSandwichCuts: inMemoryDb.puSandwichCuts,
  });
});

// ----------------------------------------------------------------------------
// FULLSTACK DATA SEED & MASTER CRUD ENDPOINTS
// ----------------------------------------------------------------------------

/**
 * POST /api/seed
 * GET /api/seed
 * Populates or resets backend store with realistic Siam Cold Roof factory production data
 */
const handleSeedRequest = (req: Request, res: Response) => {
  const seed = generateFactorySeedData();
  inMemoryDb = seed;
  persistDataStore();

  res.json({
    success: true,
    message: 'สร้างชุดข้อมูล Full-Stack ตัวอย่างโรงงานหลังคาเย็นสยาม ร่มเกล้า สำเร็จ',
    seededAt: new Date().toISOString(),
    counts: {
      rolls: inMemoryDb.rolls.length,
      cutRecords: inMemoryDb.cutRecords.length,
      puSandwichCuts: inMemoryDb.puSandwichCuts.length,
      cycleCounts: inMemoryDb.cycleCounts.length,
      soAuditLogs: inMemoryDb.soAuditLogs.length,
    },
    data: {
      rolls: inMemoryDb.rolls,
      cutRecords: inMemoryDb.cutRecords,
      puSandwichCuts: inMemoryDb.puSandwichCuts,
      cycleCounts: inMemoryDb.cycleCounts,
      soAuditLogs: inMemoryDb.soAuditLogs,
    },
  });
};

app.post('/api/seed', handleSeedRequest);
app.get('/api/seed', handleSeedRequest);

/**
 * GET /api/data
 * Get all fullstack datasets in one call
 */
app.get('/api/data', (req: Request, res: Response) => {
  res.json({
    success: true,
    version: inMemoryDb.version,
    lastUpdated: inMemoryDb.lastUpdated,
    metadata: inMemoryDb.metadata,
    counts: {
      rolls: inMemoryDb.rolls.length,
      cutRecords: inMemoryDb.cutRecords.length,
      puSandwichCuts: inMemoryDb.puSandwichCuts.length,
      cycleCounts: inMemoryDb.cycleCounts.length,
      soAuditLogs: inMemoryDb.soAuditLogs.length,
    },
    rolls: inMemoryDb.rolls,
    cutRecords: inMemoryDb.cutRecords,
    puSandwichCuts: inMemoryDb.puSandwichCuts,
    cycleCounts: inMemoryDb.cycleCounts,
    soAuditLogs: inMemoryDb.soAuditLogs,
  });
});

/**
 * POST /api/data
 * Replace all datasets
 */
app.post('/api/data', (req: Request, res: Response) => {
  const { rolls, cutRecords, puSandwichCuts, cycleCounts, soAuditLogs } = req.body;
  if (Array.isArray(rolls)) inMemoryDb.rolls = rolls;
  if (Array.isArray(cutRecords)) inMemoryDb.cutRecords = cutRecords;
  if (Array.isArray(puSandwichCuts)) inMemoryDb.puSandwichCuts = puSandwichCuts;
  if (Array.isArray(cycleCounts)) inMemoryDb.cycleCounts = cycleCounts;
  if (Array.isArray(soAuditLogs)) inMemoryDb.soAuditLogs = soAuditLogs;

  persistDataStore();

  res.json({
    success: true,
    message: 'บันทึกชุดข้อมูล Full-Stack สำเร็จ',
    counts: {
      rolls: inMemoryDb.rolls.length,
      cutRecords: inMemoryDb.cutRecords.length,
      puSandwichCuts: inMemoryDb.puSandwichCuts.length,
      cycleCounts: inMemoryDb.cycleCounts.length,
      soAuditLogs: inMemoryDb.soAuditLogs.length,
    },
  });
});

/**
 * DELETE /api/data
 * Clear database store
 */
app.delete('/api/data', (req: Request, res: Response) => {
  inMemoryDb.rolls = [];
  inMemoryDb.cutRecords = [];
  inMemoryDb.puSandwichCuts = [];
  inMemoryDb.cycleCounts = [];
  inMemoryDb.soAuditLogs = [];
  persistDataStore();

  res.json({
    success: true,
    message: 'ล้างข้อมูลบน Server เรียบร้อย',
    counts: {
      rolls: 0,
      cutRecords: 0,
      puSandwichCuts: 0,
      cycleCounts: 0,
      soAuditLogs: 0,
    },
  });
});

// ----------------------------------------------------------------------------
// CYCLE COUNTS ENDPOINTS
// ----------------------------------------------------------------------------
app.get('/api/cycle-counts', (req: Request, res: Response) => {
  res.json({
    total: inMemoryDb.cycleCounts.length,
    sessions: inMemoryDb.cycleCounts,
  });
});

app.post('/api/cycle-counts', (req: Request, res: Response) => {
  const session = req.body;
  const id = session.id || `cycle_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const item = { ...session, id, createdAt: session.createdAt || new Date().toISOString() };
  inMemoryDb.cycleCounts.unshift(item);
  persistDataStore();
  res.status(201).json({ success: true, session: item });
});

app.delete('/api/cycle-counts/:id', (req: Request, res: Response) => {
  const idx = inMemoryDb.cycleCounts.findIndex((c) => c.id === req.params.id);
  if (idx === -1) {
    res.status(404).json({ error: 'Cycle count session not found' });
    return;
  }
  const deleted = inMemoryDb.cycleCounts.splice(idx, 1)[0];
  persistDataStore();
  res.json({ success: true, deletedSession: deleted });
});

// ----------------------------------------------------------------------------
// SO AUDIT LOGS ENDPOINTS
// ----------------------------------------------------------------------------
app.get('/api/audit-logs', (req: Request, res: Response) => {
  const { limit, offset, soNumber } = req.query;
  let list = [...inMemoryDb.soAuditLogs];

  if (soNumber && typeof soNumber === 'string') {
    list = list.filter((l) => (l.soNumber || '').toLowerCase().includes(soNumber.toLowerCase()));
  }

  const total = list.length;
  const off = Math.max(0, Number(offset) || 0);
  const lim = Math.max(1, Math.min(500, Number(limit) || 100));

  res.json({
    total,
    offset: off,
    limit: lim,
    logs: list.slice(off, off + lim),
  });
});

app.post('/api/audit-logs', (req: Request, res: Response) => {
  const log = req.body;
  const id = log.id || `audit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const item = { ...log, id, timestamp: log.timestamp || new Date().toISOString() };
  inMemoryDb.soAuditLogs.unshift(item);
  persistDataStore();
  res.status(201).json({ success: true, log: item });
});

// ============================================================================
// Front-End Integration: Vite Middleware (Dev) or Static Files (Production)
// ============================================================================
async function startServer() {
  if (!isProduction) {
    // Development mode: Mount Vite middleware on the Express instance
    const isHmrDisabled = process.env.DISABLE_HMR === 'true';
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: !isHmrDisabled,
        watch: isHmrDisabled ? null : {},
      },
      appType: 'spa',
    });

    app.use(vite.middlewares);
    console.log('[FullStack] Vite middleware mounted for development mode');
  } else {
    // Production mode: Serve pre-built static assets from dist/
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));

    app.get('*', (req: Request, res: Response) => {
      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('Application build not found. Please run npm run build.');
      }
    });
    console.log('[FullStack] Static serving enabled for production dist/');
  }

  app.listen(PORT, cliHost, () => {
    console.log(`=======================================================`);
    console.log(`🚀 PU Foam Stock Full-Stack Server Running`);
    console.log(`📍 Port: ${PORT} (Host: ${cliHost})`);
    console.log(`🌐 Mode: ${isProduction ? 'Production' : 'Development'}`);
    console.log(`📡 Health Check: http://${cliHost}:${PORT}/api/health`);
    console.log(`📊 Statistics:  http://${cliHost}:${PORT}/api/stats`);
    console.log(`=======================================================`);
  });
}

startServer().catch((err) => {
  console.error('[FullStack] Failed to start server:', err);
  process.exit(1);
});
