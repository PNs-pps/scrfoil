# คำแนะนำการอัปโหลดโค้ดขึ้น GitHub และเปิดให้รันเป็นเว็บไซต์ (GitHub Pages)

โปรเจกต์นี้ได้รับการตั้งค่าพร้อมให้รันบนเว็บ **GitHub Pages** ได้ทันที โดยมีการเพิ่มไฟล์อัตโนมัติไว้แล้ว:
- `vite.config.ts` ตั้งค่า `base: './'` รองรับการรันบน Sub-path ของ GitHub Pages
- `.github/workflows/deploy.yml` สคริปต์ GitHub Actions ที่จะ Build และ Deploy เว็บให้อัตโนมัติทุกครั้งที่ Push โค้ด

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

เมื่อโค้ดอยู่บน GitHub แล้ว ให้เปิดการทำงานเพียงครั้งเดียวดังนี้:

1. เปิดหน้า Repository ของคุณบน GitHub
2. คลิกแท็บ **Settings** ด้านบน
3. ที่เมนูด้านซ้าย เลือก **Pages**
4. ในหัวข้อ **Build and deployment**:
   - ตรงช่อง **Source** ให้คลิกเลือกเป็น **GitHub Actions**
5. รอประมาณ 1-2 นาที ระบบจะ Build และ Deploy อัตโนมัติ (สามารถดูความคืบหน้าได้ที่แท็บ **Actions**)
6. เมื่อเสร็จแล้ว คุณจะได้รับลิงก์เว็บไซต์ เช่น:
   ```
   https://<your-username>.github.io/<repo-name>/
   ```
   สามารถนำลิงก์นี้ไปเปิดใช้งานผ่านคอมพิวเตอร์ แท็บเล็ต หรือสมาร์ตโฟนหน้างานโรงงานได้ทันที!
