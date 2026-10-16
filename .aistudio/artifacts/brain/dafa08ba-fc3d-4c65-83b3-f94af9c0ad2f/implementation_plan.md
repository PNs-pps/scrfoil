# แผนการปรับปรุง: บันทึกของเสีย NG แยกตามใบงาน SO ที่เสียจริง (PU Sandwich)

## 1. ที่มาและความต้องการของผู้ใช้งาน (User Requirements)
เดิมทีระบบตัด PU Sandwich ในกรณีตัดหลายใบงานจากม้วนคอล์ยเดียวกัน (Batch) จะนำค่าน้ำหนักใช้จริง (`weightUsed`) และของเสีย NG ทั้งหมดของม้วน (`ngKg`, `ngMeters`) ไปบันทึกรวมไว้ที่ใบงานแรกใบเดียว (Primary Row) ส่วนใบงานอื่นๆ จะบันทึกเป็น 0 

จากคำตอบและความต้องการที่ได้รับ:
1. **การระบุของเสีย NG:** เพิ่มช่องกรอกยอด NG (กก./เมตร) ในแต่ละแถวใบงาน SO เพื่อระบุของเสียที่เกิดขึ้นจริงในใบงานนั้นๆ
2. **การจัดการเศษหัวท้ายม้วน (Head/Tail Scrap):** ผลต่างของเสียรวมทั้งม้วนที่เหลือจากการหัก NG เฉพาะใบงาน จะถูกนำไปรวมไว้ที่ใบงานแรกของม้วนเหมือนเดิม (ทำให้ยอดรวมทั้งม้วนยังคงแม่นยำ 100%)
3. **การคำนวณน้ำหนักเหล็กที่ใช้จริง (`weightUsed`):** เปลี่ยนจากการลงยอดรวมไว้ที่ใบงานแรก เป็นการเฉลี่ยน้ำหนักใช้จริงให้แต่ละใบงานตามสัดส่วนความยาว SO (`soLengthMeters / totalSoLength * coilUsedWeight`)

---

## 2. การออกแบบสถาปัตยกรรมและการคำนวณ (Calculation Logic)

### 2.1 โครงสร้างข้อมูลแถวใน Modal (`SandwichRow`)
```typescript
export interface SandwichRow {
  id: string;
  soNumber: string;
  soLengthMeters: string;
  lengthMeters: string;
  ngKg: string;       // เพิ่ม: ยอด NG เฉพาะใบงานนี้ (กก.)
  ngMeters: string;   // เพิ่ม: ยอด NG เฉพาะใบงานนี้ (เมตร)
  notes: string;
}
```

### 2.2 การคำนวณน้ำหนักใช้จริงแยกตามใบงาน (`weightUsed`)
- คำนวณความยาวรวมของทุกใบงาน: `totalSoLength = sum(row.soLengthMeters)`
- น้ำหนักเหล็กที่ม้วนถูกตัดใช้ไปทั้งหมด: `coilUsedWeight = weightBefore - weightAfter`
- สำหรับแต่ละใบงาน $i$:
  $$\text{weightUsed}_i = \text{round}_2 \left( \frac{\text{soLengthMeters}_i}{\text{totalSoLength}} \times \text{coilUsedWeight} \right)$$
- ปรับเศษทศนิยม (Rounding adjustment) ให้ใบงานแรก เพื่อให้ผลรวม $\sum \text{weightUsed}_i = \text{coilUsedWeight}$ เสมอ

### 2.3 การคำนวณและปันส่วนของเสีย NG (`ngKg`, `ngMeters`)
- ยอดของเสียรวมทั้งม้วน (Total Coil Scrap):
  $$\text{autoTotalNgKg} = \max(0, \text{coilUsedWeight} - \text{totalTheoreticalWeight})$$
- ยอดของเสียที่ระบุเฉพาะใบงานรวม:
  $$\text{sumExplicitNgKg} = \sum \text{parseCleanNum}(\text{row.ngKg})$$
- ยอดเศษหัวท้ายม้วนที่เหลือ (Unallocated Head/Tail Scrap):
  $$\text{headTailNgKg} = \max(0, \text{autoTotalNgKg} - \text{sumExplicitNgKg})$$
- การจัดสรรลงแต่ละใบงาน:
  - **ใบงานแรก (Primary Row):**
    $$\text{rowNgKg}_1 = \text{explicitNgKg}_1 + \text{headTailNgKg}$$
  - **ใบงานอื่นๆ ($i > 1$):**
    $$\text{rowNgKg}_i = \text{explicitNgKg}_i$$
  - คำนวณเมตรที่เสียหาย:
    $$\text{rowNgMeters}_i = \text{round}_1 \left( \frac{\text{rowNgKg}_i}{\text{effectiveKgPerMeter}} \right)$$

---

## 3. การปรับปรุง UI & UX ใน `PuSandwichModal.tsx`

1. **เพิ่มคอลัมน์ NG ในตารางกรอก SO:**
   - เพิ่มช่องกรอก `NG (กก.)` ในแต่ละแถว SO มี placeholder แสดงตัวอย่าง `0.00`
   - เมื่อผู้ใช้กรอก กก. ระบบจะแสดงยอดแปลงเป็นเมตรอัตโนมัติใต้ช่อง (หรือสลับหน่วยได้)
   - เชื่อมต่อ Enter flow และ Touch Numpad สำหรับแท็บเล็ตให้รองรับช่อง NG ของแต่ละแถว
2. **แถบสรุปยอดและหน้าต่างยืนยัน (Confirmation Summary):**
   - แสดงตารางสรุปก่อนบันทึกให้เห็นชัดเจน:
     - ความยาว SO แต่ละใบงาน
     - น้ำหนักใช้จริงที่คำนวณได้ของแต่ละใบงาน
     - ยอด NG เฉพาะใบงาน + เศษหัวท้ายม้วนที่รวมในใบงานแรก
     - ยอดรวมทั้งหมดสอดคล้องกับน้ำหนักชั่งขึ้น-ลงของม้วน
3. **การแก้ไขข้อมูลย้อนหลัง (Edit Mode):**
   - ในโหมดแก้ไขใบงานเดียว รองรับการแก้ไข `ngKg` และ `weightUsed` ของใบงานนั้นอย่างถูกต้อง

---

## 4. ผลกระทบต่อระบบประวัติและการส่งออก (History & Reports)
- **`CuttingHistoryTable.tsx` & ประวัติการตัด:** แสดงค่าน้ำหนักใช้จริงและ NG ของแต่ละใบงานตามที่เกิดขึ้นจริง ไม่เป็น 0 อีกต่อไป
- **`ExcelExportModal.tsx` & CSV Export:** ดึงค่า `weightUsed` และ `ngKg` ของแต่ละใบงานไปทำรายงานสรุปต้นทุนและการสูญเสียได้แม่นยำราย SO ทันที
- **ไม่มีผลกระทบต่อข้อมูลเก่า:** ข้อมูลเก่าที่เคยบันทึกไว้ยังคงแสดงผลตามเดิมได้ 100%

---

## 5. แผนการตรวจสอบและทดสอบ (Verification Plan)
1. **ทดสอบกรณี 1 ใบงาน:** ตรวจสอบว่าค่าน้ำหนักและ NG ทั้งหมดยังคงลงที่ใบงานเดียวเหมือนเดิม
2. **ทดสอบกรณีหลายใบงานแบบไม่ระบุ NG:** ตรวจสอบว่าน้ำหนักเฉลี่ยตามความยาว และ NG รวมทั้งหมดตกที่ใบแรก (พฤติกรรมดั้งเดิมที่ปลอดภัย)
3. **ทดสอบกรณีระบุ NG เฉพาะใบงานที่ 2 หรือ 3:** ตรวจสอบว่าใบงานที่ระบุได้รับ NG ตามที่คีย์จริง และเศษหัวท้ายที่เหลือถูกนำไปรวมที่ใบแรกอย่างถูกต้อง
4. **ตรวจสอบการคอมไพล์และ TypeScript:** รัน `lint_applet` และ `compile_applet` เพื่อยืนยันความถูกต้องของโค้ดทั้งหมด
