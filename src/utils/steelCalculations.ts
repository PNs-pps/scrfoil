/**
 * การคำนวณน้ำหนักคอล์ยเหล็กต่องาน SO และยอด NG สำหรับ PU Sandwich
 * ตามอัตรามาตรฐานโรงงาน:
 * 0.30 มม. -> 2.1 กก./เมตร
 * 0.35 มม. -> 2.3 กก./เมตร (ค่าเริ่มต้น)
 * 0.40 มม. -> 2.7 กก./เมตร
 * 0.47 มม. -> 3.1 กก./เมตร
 * 0.51 มม. -> 3.2 กก./เมตร
 */

export interface SteelThicknessSpec {
  value: string;
  rate: number;
  label: string;
}

export const FACTORY_THICKNESS_SPECS: SteelThicknessSpec[] = [
  { value: '0.30', rate: 2.1, label: '0.30 มม. (2.1 กก./ม.)' },
  { value: '0.35', rate: 2.3, label: '0.35 มม. (2.3 กก./ม.)' },
  { value: '0.40', rate: 2.7, label: '0.40 มม. (2.7 กก./ม.)' },
  { value: '0.47', rate: 3.1, label: '0.47 มม. (3.1 กก./ม.)' },
  { value: '0.51', rate: 3.2, label: '0.51 มม. (3.2 กก./ม.)' },
];

export const STEEL_WEIGHT_RATES: Record<string, number> = {
  '0.30': 2.1,
  '0.35': 2.3,
  '0.40': 2.7,
  '0.47': 3.1,
  '0.51': 3.2,
};

/**
 * ดึงค่าน้ำหนักเหล็กมาตรฐาน (กก. ต่อเมตร) ตามความหนา
 */
export function getSteelKgPerMeter(thicknessInput: string | number): number {
  const str = typeof thicknessInput === 'number' ? thicknessInput.toFixed(2) : (thicknessInput || '').trim();
  
  if (STEEL_WEIGHT_RATES[str] !== undefined) {
    return STEEL_WEIGHT_RATES[str];
  }
  
  const num = parseFloat(str);
  if (!num || isNaN(num)) return 2.3; // ค่าปริยาย 0.35 มม. = 2.3 กก./ม.
  
  if (num <= 0.30) return 2.1;
  if (num <= 0.35) return 2.3;
  if (num <= 0.40) return 2.7;
  if (num <= 0.47) return 3.1;
  if (num <= 0.51) return 3.2;
  
  // มากกว่า 0.51 ให้คำนวณตามสัดส่วน (3.2 / 0.51 ≈ 6.274)
  return Math.round(num * 6.275 * 10) / 10;
}

/**
 * คำนวณน้ำหนักตามทฤษฎีจากความยาว SO (กก.)
 */
export function calculateTheoreticalSoWeight(
  soLengthMeters: number,
  thickness: string | number,
  customKgPerMeter?: number
): number {
  if (soLengthMeters <= 0) return 0;
  const rate = customKgPerMeter && customKgPerMeter > 0 ? customKgPerMeter : getSteelKgPerMeter(thickness);
  return Math.round(soLengthMeters * rate * 100) / 100;
}

/**
 * คำนวณยอด NG กก. และ เมตร อัตโนมัติ
 */
export function calculateAutoNg(
  weightUsed: number,
  soLengthMeters: number,
  thickness: string | number,
  customKgPerMeter?: number
): { ngKg: number; ngMeters: number; rate: number; theoreticalWeight: number } {
  const rate = customKgPerMeter && customKgPerMeter > 0 ? customKgPerMeter : getSteelKgPerMeter(thickness);
  const theoreticalWeight = calculateTheoreticalSoWeight(soLengthMeters, thickness, rate);
  
  if (weightUsed <= 0 || soLengthMeters <= 0) {
    return { ngKg: 0, ngMeters: 0, rate, theoreticalWeight };
  }
  
  const ngKg = Math.max(0, Math.round((weightUsed - theoreticalWeight) * 100) / 100);
  const ngMeters = rate > 0 ? Math.max(0, Math.round((ngKg / rate) * 10) / 10) : 0;
  
  return { ngKg, ngMeters, rate, theoreticalWeight };
}
