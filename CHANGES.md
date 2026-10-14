# scrfoil — การแก้ไขเฟส 0–2

ยังไม่ได้รัน `tsc` / `vitest` (ไม่มี node_modules/เน็ตตอนแก้) — ต้องรันก่อน deploy:
`npm install && npm run lint && npm test`

ใช้ patch: `git apply scrfoil-fixes.patch` (บน baseline ที่อัปโหลดมา)

## Cloudflare D1 Worker — ตรวจ Firebase ID token (แก้รอบล่าสุด)
โค้ด Worker เดิมตรวจแค่ `X-Backup-Secret` ทั้งที่ไคลเอนต์ส่ง `Authorization: Bearer <idToken>`
อยู่แล้ว และ CORS ไม่ได้อนุญาต header `Authorization` ทำให้คำขอ D1 จากเบราว์เซอร์ถูกบล็อกที่ preflight

- `cloudflare-d1/src/index.ts`: ตรวจ Firebase ID token จริง (RS256 กับ public key ของ Google,
  ตรวจ `iss`/`aud`/`exp`/`iat`, เช็ค `email` กับ allowlist), เพิ่ม `Authorization` ใน
  `Access-Control-Allow-Headers`, กัน `limit=NaN` (fallback 20), จำกัด payload 8 MB, เทียบ secret
  แบบ constant-time
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
