# คำแนะนำการอัปโหลดโค้ดขึ้น GitHub และเปิดให้รันเป็นเว็บไซต์ (GitHub Pages)

โปรเจกต์นี้ตั้งค่าให้รันบนเว็บ **GitHub Pages** ได้:
- `vite.config.ts` ตั้งค่า `base: './'` ให้ asset URL เป็นแบบสัมพัทธ์ รองรับการรันบน Sub-path ของ GitHub Pages (`https://<user>.github.io/<repo>/`)
- `.github/workflows/deploy.yml` สคริปต์ GitHub Actions ที่ Typecheck, Test, Build และ Deploy อัตโนมัติทุกครั้งที่ Push ขึ้น `main`

> หมายเหตุ: ก่อนหน้านี้เอกสารฉบับเดิมอ้างว่ามีทั้งสองไฟล์นี้อยู่แล้ว ซึ่งไม่เป็นจริง — workflow เพิ่งถูกเพิ่มเข้ามาในรอบนี้

---

## วิธีที่ 1: วิธีที่ง่ายและเร็วที่สุด (ผ่าน Google AI Studio)

1. คลิกที่ **เมนู Settings / สามจุด** (มุมขวาบนของหน้าจอ AI Studio)
2. เลือก **Export to GitHub** (หรือ Download ZIP แล้วนำขึ้น GitHub)
3. ระบุชื่อ Repository ที่ต้องการ แล้วกดสร้าง
4. เมื่อโค้ดขึ้น GitHub แล้ว ให้ทำตามขั้นตอนการเปิดเว็บใน **"ขั้นตอนเปิด GitHub Pages"** ด้านล่าง

---

## วิธีที่ 2: อัปโหลดผ่าน Terminal / Command Prompt บนเครื่อง

1. สร้าง Repository เปล่าขึ้นมาใน [GitHub.com](https://github.com/new) (เช่น ตั้งชื่อว่า `pufoam-foil-stock`)
2. เปิด Terminal ในโฟลเดอร์โปรเจกต์ แล้วพิมพ์คำสั่งดังต่อไปนี้:

```bash
# 1. เริ่มต้นระบบ Git
git init

# 2. เพิ่มไฟล์ทั้งหมดเข้าสู่การติดตาม
git add .

# 3. บันทึก Commit
git commit -m "feat: ระบบตัดสต๊อกฟอยล์ PU Foam เมทัลชีท พร้อมระบบ Firebase Realtime"

# 4. ตั้งชื่อ Branch หลักเป็น main
git branch -M main

# 5. เชื่อมต่อไปยัง GitHub Repository ของคุณ (แทนที่ <username> และ <repo-name> ด้วยของคุณ)
git remote add origin https://github.com/<username>/<repo-name>.git

# 6. อัปโหลดโค้ดขึ้น GitHub
git push -u origin main
```

---

## ขั้นตอนเปิดให้เว็บไซต์รันบนอินเทอร์เน็ต (GitHub Pages)

### หมายเหตุสำคัญ: Firebase Authorized Domains

แอปบังคับให้ล็อกอินด้วย Firebase Auth ก่อนเข้าถึงข้อมูล ถ้า deploy บน GitHub Pages ต้องเพิ่มโดเมนใหม่ใน Firebase Console มิฉะนั้นจะขึ้น `auth/unauthorized-domain` และล็อกอินไม่ได้:

1. เปิด [Firebase Console > Authentication > Settings > Authorized domains](https://console.firebase.google.com/project/_/auth/settings)
2. กด **Add domain** แล้วใส่โดเมนของ GitHub Pages เช่น `username.github.io`

ถ้าใช้ Vercel ค่าที่ตั้งไว้อยู่แล้ว

### หมายเหตุ: โหมดคีย์ข้อมูล

รหัสผ่านสำหรับโหมดคีย์ข้อมูลอ่านจาก `VITE_OPERATOR_PASSWORD` ซึ่งเป็น build-time variable ถ้าไม่ตั้งไว้ ระบบจะยังใช้งานได้ปกติสำหรับอีเมลพนักงานที่ล็อกอินผ่าน Firebase Auth เพราะสิทธิ์จริงมาจาก Firestore Rules ไม่ใช่จากรหัสผ่าน

---

เมื่อโค้ดอยู่บน GitHub แล้ว ให้เปิดการทำงานเพียงครั้งเดียวดังนี้:

1. เปิดหน้า Repository ของคุณบน GitHub
2. คลิกแท็บ **Settings** ด้านบน
3. ที่เมนูด้านซ้าย เลือก **Pages**
4. ในหัวข้อ **Build and deployment**:
   - ตรงช่อง **Source** ให้คลิกเลือกเป็น **GitHub Actions**
   - ถ้ายังไม่มีส่วน Environment ให้สร้าง environment ชื่อ `github-pages` (workflow ระบุไว้)
5. กด **Save**
6. เข้าแท็บ **Actions** แล้วกด **Deploy to GitHub Pages** > **Run workflow** เพื่อ deploy ครั้งแรก (หลังจากนั้น push ขึ้น `main` จะ deploy เองอัตโนมัติ)
7. รอประมาณ 2-3 นาที
8. เมื่อเสร็จแล้ว คุณจะได้รับลิงก์เว็บไซต์ เช่น:
   ```
   https://<your-username>.github.io/<repo-name>/
   ```
   สามารถนำลิงก์นี้ไปเปิดใช้งานผ่านคอมพิวเตอร์ แท็บเล็ต หรือสมาร์ตโฟนหน้างานโรงงานได้ทันที!
