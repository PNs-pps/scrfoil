# scrfoil — การแก้ไขเฟส 0–2

ยังไม่ได้รัน `tsc` / `vitest` (ไม่มี node_modules/เน็ตตอนแก้) — ต้องรันก่อน deploy:
`npm install && npm run lint && npm test`

ใช้ patch: `git apply scrfoil-fixes.patch` (บน baseline ที่อัปโหลดมา)

## Deploy ฝั่ง Worker (ไม่บังคับ แต่แนะนำ)
1. ใน `cloudflare-d1/wrangler.toml` ตั้ง `FIREBASE_PROJECT_IDS` และ `ALLOWED_EMAILS`
2. `wrangler deploy` แล้วทดสอบสำรองจากแอป (ส่ง Firebase token อัตโนมัติ)
3. เมื่อใช้ได้ ล้างช่อง BACKUP_SECRET ทุกเครื่อง และตั้ง `DISABLE_SECRET_AUTH = "1"`

## พฤติกรรมที่เปลี่ยน
- Cloud ปฏิเสธการตัดถาวร → ไม่ตัด (เดิมตัดเฉพาะในเครื่อง)
- ออฟไลน์ → เข้าคิวถาวร ส่งซ้ำอัตโนมัติ มีแถบเตือน
- "บันทึกขึ้น Cloud" ไม่เปลี่ยนยอดสต๊อกของม้วนที่มีใน Cloud แล้ว
- records window 200 ใช้ orderBy createdAt (รายการไม่มี createdAt จะไม่เข้า window)
- Cycle Count: ไม่ปรับถ้ามีการตัดหลังนับ/ยอด Cloud เปลี่ยน
