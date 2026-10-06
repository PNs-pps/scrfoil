# ขั้นตอน deploy การแก้ไขด้านความปลอดภัย

ทำตามลำดับนี้ (รันเองในเครื่องที่ล็อกอิน Firebase/Cloudflare/Vercel แล้ว)

## 0) ก่อนเริ่ม
- `npm install && npm run build` ต้องผ่านก่อน
- เปิดแอปเวอร์ชันเก่าค้างไว้ 1 เครื่องเป็นทางหนีไฟ จนกว่าจะทดสอบเสร็จ

## 1) Cloudflare Worker (D1 backup)
```bash
cd cloudflare-d1
# ตรวจ [vars] ใน wrangler.toml: STAFF_EMAILS, ALLOWED_ORIGINS = https://scrfoil.vercel.app
npx wrangler deploy
npx wrangler secret delete BACKUP_SECRET   # ลบ secret เดิมทิ้ง (ไม่ใช้แล้ว)
```
ถ้าเปิดแอปจากโดเมนอื่น (เช่น preview ของ Vercel หรือ localhost) ให้เพิ่มใน `ALLOWED_ORIGINS` คั่นด้วย comma แล้ว deploy ใหม่

## 2) ยืนยันอีเมลพนักงานก่อน deploy rules
rules ใหม่ต้องการ `email_verified == true`
- ล็อกอินด้วย Google = ผ่านอัตโนมัติ
- ล็อกอินด้วยอีเมล/รหัสผ่าน: ล็อกอินครั้งหนึ่ง (ระบบส่งอีเมลยืนยัน) แล้วกดลิงก์ในอีเมลให้เรียบร้อย **ก่อน** ทำข้อ 3

## 3) Firestore rules (ทั้งสองฐาน)
```bash
firebase deploy --only firestore:rules --project stock-foil
firebase deploy --only firestore:rules --config firebase.backup.json --project xenon-airport-rlxdt
```

## 4) หน้าเว็บ (Vercel)
push ขึ้น git ตามปกติ (Vercel จะ build ให้) แล้วเปิดแอปบนมือถือ → ตั้งค่า → สำรอง → ทดสอบ D1

## 5) ตรวจสอบหลัง deploy
- ล็อกอินแล้วข้อมูลโหลดปกติ / บันทึกการตัดได้
- ทดสอบสำรอง D1 สำเร็จ
- ล็อกอินด้วยอีเมลอื่นที่ไม่ใช่พนักงาน ต้องอ่าน/เขียนข้อมูลไม่ได้

## 6) ที่ต้องตรวจเองในคอนโซล
- Google Cloud Console → Credentials → จำกัด API key ให้เฉพาะโดเมน `scrfoil.vercel.app`
- `appId` ใน `firebase-applet-config.json` กับ `src/lib/firebase.ts` ไม่ตรงกัน: ตรวจว่าอันไหนถูกใน Firebase Console
- โปรเจกต์สำรอง `xenon-airport-rlxdt`: ยืนยันว่าเป็นของคุณ และ deploy rules ตามข้อ 3 แล้ว

ไฟล์ `.github/workflows/deploy.yml` และ `DEPLOY_TO_GITHUB.md` เป็นของ GitHub Pages: ถ้า host บน Vercel อย่างเดียว ไม่ต้องใช้
