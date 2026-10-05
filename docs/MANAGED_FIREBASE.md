# Managed Firebase (คลาวด์สำรอง)

แอปนี้มี Firebase สองชุด ชุดหนึ่งคือ **คลาวด์กลางของโรงงาน** อีกชุดคือ **คลาวด์สำรอง**
(project id `xenon-airport-rlxdt`) ที่ `MANAGED_FIREBASE_CONFIG` ใน `src/lib/firebase.ts`
ประกาศไว้ ใช้สลับจากหน้า **ตั้งค่า → คลาวด์** ในแอป

> คลาวด์สำรองไม่ได้ซิงก์ข้อมูลอัตโนมัติ เป็นชุดข้อมูลแยกที่ต้อง deploy
> rules และ (ถ้าต้องการใช้เป็นจริง) นำเข้าข้อมูลเริ่มต้นเข้าไปเอง

## สิ่งที่ต้องทำให้เสมอ

**ชุดหลักและชุดสำรองต้องใช้ `firestore.rules` ไฟล์เดียวกัน**
ถ้า deploy แค่ชุดหลัก คลาวด์สำรองจะยังเป็น "เปิดทุกคน" (deny-by-default ไม่มี)
คือใครก็เขียนข้อมูลทับได้ ให้มองว่า rules คือสิ่งที่ทำให้ชุดสำรองปลอดภัย

## ขั้นตอน deploy (ต้องล็อกอิน Firebase CLI ด้วยบัญชีที่มีสิทธิ์)

```bash
npm run -g firebase-tools   # ครั้งเดียว
firebase login

# 1) ตรวจว่าคลาวด์หลักใช้ rules ชุดนี้อยู่จริง
firebase deploy --only firestore:rules --project stock-foil

# 2) deploy ชุดเดียวกันไปคลาวด์สำรอง
firebase deploy --only firestore:rules --project xenon-airport-rlxdt
```

`firebase.json` ชี้ `firestore.rules` และ `firestore.indexes.json` ที่ root ของโปรเจกต์
จึง deploy ได้ทั้งสองชุดด้วยคำสั่งเดียวกันต่างเฉพาะ `--project`

## นำเข้าข้อมูลเริ่มต้นเข้าคลาวด์สำรอง

ต้องใช้ `firebase login` ด้วยบัญชี `xenon-airport-rlxdt`
(Firestore → สร้าง collection ตามชื่อใน `src/lib/firebase.ts` ก่อน เช่น `foil_rolls`,
`stock_cuts`, `pu_sandwich_cuts`, `cycle_counts` และ collection อื่นที่โค้ดอ้างถึง)

## ไฟล์ที่เกี่ยวข้อง

| ไฟล์ | หน้าที่ |
| --- | --- |
| `firestore.rules` | กฎสิทธิ์ของทั้งสองชุด (deny-by-default + อีเมลพนักงาน) |
| `firestore.indexes.json` | index ว่าง เพื่อให้ `firebase deploy` ไม่พัง |
| `firestore.rules.restricted` | **ไม่ใช้** เป็นร่างเก่าที่มีกฎเปิดกว้าง อย่า deploy |
| `firebase-applet-config.json` | config ของคลาวด์หลัก |
| `src/lib/firebase.ts` | `MANAGED_FIREBASE_CONFIG` และตัวเลือกเป้าหมาย |

## ข้อควรระวัง

- ถ้าเปลี่ยน `isStaff()` ใน `firestore.rules` ต้อง deploy **ทั้งสอง** โปรเจกต์
- บัญชีที่ล็อกอินต้องเป็นเจ้าของ (Owner) หรือ Editor ของทั้งสองโปรเจกต์
- การสลับเป้าหมายในแอปจะ `location.reload()` ทั้งหน้า และเขียนข้อมูลไปยัง
  ฐานข้อมูลที่เลือก **เฉพาะฐานนั้น** ไม่ได้ replicate ระหว่างสองชุด