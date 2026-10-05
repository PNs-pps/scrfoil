# Cloudflare D1 — สำรอง snapshot ระบบสต๊อกฟอยล์

เก็บ **snapshot เต็ม** (ม้วน + ประวัติตัด + แซนวิช ถ้ามี) ไว้บน D1  
ใช้เป็นชั้นสำรอง แยกจาก Firebase realtime

## ตั้งค่าครั้งแรก (ประมาณ 5–10 นาที)

```bash
cd cloudflare-d1
npm install
npx wrangler login

# สร้างฐาน D1
npx wrangler d1 create foil-stock-backups
# คัดลอก database_id ไปใส่ใน wrangler.toml

# สร้างตาราง
npx wrangler d1 execute foil-stock-backups --file=./schema.sql

# ตั้งรหัสลับ (จำไว้ใส่ในแอป)
npx wrangler secret put BACKUP_SECRET
# พิมพ์รหัสยาว ๆ เช่น foil-backup-xxxx

# Deploy
npx wrangler deploy
```

หลัง deploy จะได้ URL เช่น:

`https://foil-stock-d1-backup.<your-subdomain>.workers.dev`

## ในแอป (หน้าตั้งค่า)

1. เปิดแท็บ **สำรองข้อมูล**
2. ช่อง **Cloudflare D1**
3. ใส่ Worker URL + รหัสลับ (BACKUP_SECRET)
4. กด **ทดสอบการเชื่อมต่อ** → **สำรองขึ้น D1**

## API สั้น ๆ

| Method | Path | คำอธิบาย |
|--------|------|----------|
| GET | `/health` | ตรวจว่า Worker ทำงาน |
| GET | `/backups` | รายการ snapshot |
| GET | `/backups/:id` | ดึง snapshot เต็ม |
| POST | `/backups` | อัปโหลด snapshot |
| DELETE | `/backups/:id` | ลบ |

ทุกเส้นทาง (ยกเว้น `/health`) ต้องมี header:

`X-Backup-Secret: <secret>`
