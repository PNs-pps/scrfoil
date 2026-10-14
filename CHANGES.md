# scrfoil — การแก้ไขเฟส 0–2

ยังไม่ได้รัน `tsc` / `vitest` (ไม่มี node_modules/เน็ตตอนแก้) — ต้องรันก่อน deploy:
`npm install && npm run lint && npm test`

ใช้ patch: `git apply scrfoil-fixes.patch` (บน baseline ที่อัปโหลดมา)

## Cloudflare D1 Worker — ตรวจ Firebase ID token (แก้รอบล่าสุด)
โค้ด Worker เดิมตรวจแค่ `X-Backup-Secret` ทั้งที่ไคลเอนต์ส่ง `Authorization: Bearer <idToken>`
อยู่แล้ว และ CORS ไม่ได้อนุญาต header `Authorization` ทำให้คำขอ D1 จากเบราว์เซอร์ถูกบล็อกที่ preflight

- `cloudflare-d1/src/index.ts`: ตรวจ Firebase ID token จริง (RS256 กับ public key ของ Google,
  ตรวจ `iss`/`aud`/`exp`/`iat`, เช็ค `email` กับ allowlist — ไม่บังคับ `email_verified` เพราะ
  allowlist อีเมลพนักงานคือด่านหลัก), เพิ่ม `Authorization` ใน `Access-Control-Allow-Headers`,
  กัน `limit=NaN` (fallback 20), จำกัด payload 8 MB, เทียบ secret แบบ constant-time
- `cloudflare-d1/wrangler.toml`: ตั้ง `FIREBASE_PROJECT_IDS = "stock-foil,xenon-airport-rlxdt"`,
  `ALLOWED_EMAILS = "ikuyisad@ikwai.com"`, `DISABLE_SECRET_AUTH = "1"`
- ผ่าน `tsc --noEmit` ของ Worker และชุดทดสอบ logic (ออก token จริงด้วย WebCrypto ตรวจ token ปลอม/
  หมดอายุ/อีเมลนอกรายการ/alg=none ถูกปฏิเสธทั้งหมด)

## Deploy ฝั่ง Worker (ไม่บังคับ แต่แนะนำ)
1. ใน `cloudflare-d1/wrangler.toml` ตั้ง `database_id` จริง, `FIREBASE_PROJECT_IDS` และ `ALLOWED_EMAILS`
2. `wrangler deploy` แล้วทดสอบสำรองจากแอป (ส่ง Firebase token อัตโนมัติ)
3. เมื่อใช้ได้จริง ตั้ง `DISABLE_SECRET_AUTH = "1"` แล้ว `wrangler deploy` อีกครั้ง และล้างช่อง BACKUP_SECRET ทุกเครื่อง

## พฤติกรรมที่เปลี่ยน
- Cloud ปฏิเสธการตัดถาวร → ไม่ตัด (เดิมตัดเฉพาะในเครื่อง)
- ออฟไลน์ → เข้าคิวถาวร ส่งซ้ำอัตโนมัติ มีแถบเตือน
- "บันทึกขึ้น Cloud" ไม่เปลี่ยนยอดสต๊อกของม้วนที่มีใน Cloud แล้ว
- records window 200 ใช้ orderBy createdAt (รายการไม่มี createdAt จะไม่เข้า window)
- Cycle Count: ไม่ปรับถ้ามีการตัดหลังนับ/ยอด Cloud เปลี่ยน

## รอบที่ 2 — บั๊กข้อมูลพัง/ข้อมูลหายเงียบ/ยอดรวมผิด (A+B)
รัน `npm run lint` (tsc), `npm test` (69 tests / 9 ไฟล์) และ `npm run build` ผ่านทั้งหมด
(ต้องตั้ง `NODE_OPTIONS=--max-old-space-size=4096` ตอน lint)

### ยอดรวมที่ผิด (ตัด reserved/cancelled + คงเครื่องหมาย Cycle Count)
- `src/components/DashboardOverview.tsx`, `MonthlySummaryModal.tsx`: ใช้กฎหักยอดกลาง
  `summarizeRollDeduction` / `signedTotalDeducted` — ข้าม `reserved`/`cancelled` และคงเครื่องหมาย
  `totalDeducted` (Cycle Count คืนยอดติดลบ)
- `src/components/MonthlyFoilUsageBarChart.tsx`: เดิมรวมทุก record และใช้ `used+ng` — แก้ให้ข้าม
  `reserved`/`cancelled`, ใช้ `Math.abs` กับ used/ng และใช้ `signedTotalDeducted` กับยอดตัด
- `src/utils/dateGrouping.ts` (`groupCutsByDate`): ตัด `reserved`/`cancelled` + ใช้ `signedTotalDeducted`

### ข้อมูลหายเงียบ / เขียนทับกัน
- `src/lib/firebase.ts`:
  - `confirmProductionInFirestore` มี idempotency guard (completed แล้วคืนค่า server; cancelled โยน error) + แก้ string-concat bug
  - `saveFoilRollToFirestore` เป็น compare-and-set transaction คืน `{ stockProtected }` — ไม่ทับยอดที่เครื่องอื่นตัดไปแล้ว
  - **ออฟไลน์**: transaction ไม่ถูก replay โดย offline outbox ของ Firestore จึง fallback เป็นเขียนเฉพาะ metadata
    (`setDoc` merge) ซึ่งเข้าคิว outbox ได้ และไม่ทับยอดสต๊อก
  - retry queue สำหรับ `saveSOAuditLogInFirestore` (cap 500, flush อัตโนมัติ)
- `src/utils/pendingRecordEditQueue.ts` (ใหม่): คิวแก้ไข record แบบถาวร — realtime merge จะข้าม record/roll
  ที่ยังแก้ค้าง (`getPendingRecordEditIds` / `getPendingRecordEditRollIds`) ไม่ให้ snapshot เก่าทับ
- `src/App.tsx`:
  - `flushPendingRecordEdits` (คู่กับ `flushPendingCuts`): replay ใบแก้ไขที่ค้างผ่าน transaction เดิม
    (idempotent), retry เมื่อเน็ตไม่พร้อม, ทิ้ง+ดึงค่าจริงเมื่อ error ถาวร; เรียกทุก 30 วิ / ตอน `online`
    พร้อมแถบเตือน "ส่งตอนนี้" และตัวนับ
  - `handleEditCutRecord`: แยก non-recoverable ออกจากออฟไลน์จริง, บันทึกคิวก่อนปิดว่า "รอซิงค์", ปฏิเสธถ้าเก็บคิวไม่ได้
  - `handleDeleteRoll`, `handleVerifyRecord`, `handleUpdateRoll`: async + rollback/revert เมื่อ Cloud ปฏิเสธ,
    ใช้ compare-and-set (`expectedStock`) กันทับยอด
  - merge snapshot ใช้ `getPendingCutRollIds()` / `getPendingRecordEditRollIds()`; commit ใช้ functional updaters
    (`commitRolls`/`commitRecords`) ที่ sync refs
  - ออฟไลน์: snapshot `before_cut` ก่อน commit; D1 mark slot ใน `.then` + error toast
- `src/utils/autoBackup.ts`: `parseAndValidateBackupJSON` ไม่ทิ้ง record ที่ coerce ได้ + คืนสรุปการ coerce
- `src/components/EditFoilModal.tsx`: แก้ effect reset ฟอร์มกลางคัน (`initializedForRef`)
- `src/components/SettingsBackupView.tsx`: แสดงหมายเหตุการ coerce ข้อมูลตอนกู้คืน
- เทสใหม่: `src/utils/dataIntegrityFixes.test.ts`, `src/utils/pendingRecordEditQueue.test.ts`
