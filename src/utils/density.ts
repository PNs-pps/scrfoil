/**
 * Density (K) ของน้ำยา PU / ใบงาน
 * รูปแบบมาตรฐานที่ใช้ทั้งระบบ: "25k", "28k", "30k", "35k", "40k" (หรือค่าที่กรอกเอง เช่น "32k")
 */

/** ค่า Density มาตรฐานที่ให้กดเลือก */
export const DENSITY_K_PRESETS: string[] = ['25k', '28k', '30k', '35k', '40k'];

/**
 * แปลงค่าที่ผู้ใช้กรอก/ข้อมูลเก่าให้เป็นรูปแบบ "Nk"
 * รองรับ: "32", "32k", "32K", "32 k", "Density 32", "D32", "density32", "32.5"
 * คืนค่า '' ถ้าไม่ใช่ตัวเลขที่ใช้ได้ (1–200)
 */
export function normalizeDensityK(input: unknown): string {
  const raw = String(input ?? '').trim().toLowerCase();
  if (!raw) return '';
  const m = raw.match(/(\d+(?:\.\d+)?)/);
  if (!m) return '';
  const n = Number(m[1]);
  if (!isFinite(n) || n <= 0 || n > 200) return '';
  return `${n}k`;
}

/** แปลงรายการ density หลายรูปแบบ (array หรือ "Density 32, Density 35") เป็น ["32k","35k"] ไม่ซ้ำ */
export function normalizeDensityList(input: unknown): string[] {
  const parts: string[] = Array.isArray(input)
    ? input.map(String)
    : String(input ?? '').split(/[,/]/);
  const out: string[] = [];
  parts.forEach((p) => {
    const k = normalizeDensityK(p);
    if (k && !out.includes(k)) out.push(k);
  });
  return out;
}

/** เรียงตามตัวเลขน้อยไปมาก */
export function sortDensityList(list: string[]): string[] {
  return [...list].sort((a, b) => parseFloat(a) - parseFloat(b));
}

/**
 * รายการรองรับ K นี้หรือไม่
 * - ถ้ารายการว่าง (ยังไม่เคยกำหนด) ถือว่าไม่จำกัด → true
 */
export function densityListSupports(list: unknown, k: string): boolean {
  const normalized = normalizeDensityList(list);
  if (normalized.length === 0) return true;
  const target = normalizeDensityK(k);
  if (!target) return true;
  return normalized.includes(target);
}
