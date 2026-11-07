import { PuSandwichCutRecord } from '../types';

export interface BaseColorMeta {
  key: string;
  label: string;
  bgClass: string;
  borderClass: string;
  textClass: string;
  badgeClass: string;
  dotColor: string;
  chipClass: string;
  barColor: string;
}

export const KNOWN_BASE_THAI_COLORS: BaseColorMeta[] = [
  {
    key: 'ขาว',
    label: 'สีขาว',
    bgClass: 'bg-slate-50',
    borderClass: 'border-slate-300',
    textClass: 'text-slate-900',
    badgeClass: 'bg-slate-100 text-slate-800 border-2 border-slate-400',
    dotColor: '#f8fafc',
    chipClass: 'bg-white text-slate-950 border-2 border-slate-400 shadow-2xs font-bold',
    barColor: '#64748b', // ขอบเทาคมชัด ไม่กลืนกับพื้นหลัง
  },
  {
    key: 'ดำ',
    label: 'สีดำ',
    bgClass: 'bg-slate-900/5',
    borderClass: 'border-slate-800',
    textClass: 'text-slate-950',
    badgeClass: 'bg-slate-900 text-white border-slate-900',
    dotColor: '#0f172a',
    chipClass: 'bg-slate-900 text-white border-slate-900',
    barColor: '#0f172a',
  },
  {
    key: 'เทา',
    label: 'สีเทา',
    bgClass: 'bg-slate-100/70',
    borderClass: 'border-slate-400',
    textClass: 'text-slate-800',
    badgeClass: 'bg-slate-200 text-slate-800 border-slate-400',
    dotColor: '#475569',
    chipClass: 'bg-slate-200 text-slate-800 border-slate-300',
    barColor: '#475569',
  },
  {
    key: 'น้ำเงิน',
    label: 'สีน้ำเงิน',
    bgClass: 'bg-blue-50/70',
    borderClass: 'border-blue-400',
    textClass: 'text-blue-950',
    badgeClass: 'bg-blue-100 text-blue-900 border-blue-400',
    dotColor: '#1d4ed8',
    chipClass: 'bg-blue-600 text-white border-blue-700',
    barColor: '#1d4ed8',
  },
  {
    key: 'ฟ้า',
    label: 'สีฟ้า',
    bgClass: 'bg-sky-50/70',
    borderClass: 'border-sky-300',
    textClass: 'text-sky-950',
    badgeClass: 'bg-sky-100 text-sky-900 border-sky-300',
    dotColor: '#0284c7',
    chipClass: 'bg-sky-500 text-white border-sky-600',
    barColor: '#0284c7',
  },
  {
    key: 'เขียว',
    label: 'สีเขียว',
    bgClass: 'bg-emerald-50/70',
    borderClass: 'border-emerald-300',
    textClass: 'text-emerald-950',
    badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300',
    dotColor: '#059669',
    chipClass: 'bg-emerald-600 text-white border-emerald-700',
    barColor: '#059669',
  },
  {
    key: 'น้ำตาล',
    label: 'สีน้ำตาล',
    bgClass: 'bg-amber-50/70',
    borderClass: 'border-amber-400',
    textClass: 'text-amber-950',
    badgeClass: 'bg-amber-100 text-amber-900 border-amber-300',
    dotColor: '#78350f',
    chipClass: 'bg-amber-800 text-white border-amber-900',
    barColor: '#92400e',
  },
  {
    key: 'ช็อกโกแลต',
    label: 'สีช็อกโกแลต',
    bgClass: 'bg-stone-100/70',
    borderClass: 'border-stone-500',
    textClass: 'text-stone-950',
    badgeClass: 'bg-stone-200 text-stone-900 border-stone-400',
    dotColor: '#451a03',
    chipClass: 'bg-stone-800 text-white border-stone-900',
    barColor: '#573016',
  },
  {
    key: 'แดง',
    label: 'สีแดง',
    bgClass: 'bg-rose-50/70',
    borderClass: 'border-rose-300',
    textClass: 'text-rose-950',
    badgeClass: 'bg-rose-100 text-rose-900 border-rose-300',
    dotColor: '#e11d48',
    chipClass: 'bg-rose-600 text-white border-rose-700',
    barColor: '#e11d48',
  },
  {
    key: 'ส้ม',
    label: 'สีส้ม',
    bgClass: 'bg-orange-50/70',
    borderClass: 'border-orange-300',
    textClass: 'text-orange-950',
    badgeClass: 'bg-orange-100 text-orange-900 border-orange-300',
    dotColor: '#ea580c',
    chipClass: 'bg-orange-500 text-white border-orange-600',
    barColor: '#ea580c',
  },
  {
    key: 'เหลือง',
    label: 'สีเหลือง',
    bgClass: 'bg-yellow-50/70',
    borderClass: 'border-yellow-400',
    textClass: 'text-yellow-950',
    badgeClass: 'bg-yellow-100 text-yellow-900 border-yellow-300',
    dotColor: '#ca8a04',
    chipClass: 'bg-yellow-400 text-slate-900 border-yellow-500',
    barColor: '#eab308',
  },
  {
    key: 'ม่วง',
    label: 'สีม่วง',
    bgClass: 'bg-purple-50/70',
    borderClass: 'border-purple-300',
    textClass: 'text-purple-950',
    badgeClass: 'bg-purple-100 text-purple-900 border-purple-300',
    dotColor: '#9333ea',
    chipClass: 'bg-purple-600 text-white border-purple-700',
    barColor: '#9333ea',
  },
  {
    key: 'ครีม',
    label: 'สีครีม',
    bgClass: 'bg-amber-50/40',
    borderClass: 'border-amber-200',
    textClass: 'text-amber-900',
    badgeClass: 'bg-amber-50 text-amber-900 border-amber-200',
    dotColor: '#fef3c7',
    chipClass: 'bg-amber-100 text-amber-900 border-amber-300',
    barColor: '#f59e0b',
  },
  {
    key: 'อลูซิงค์',
    label: 'อลูซิงค์ / ซิงค์',
    bgClass: 'bg-zinc-100/70',
    borderClass: 'border-zinc-400',
    textClass: 'text-zinc-950',
    badgeClass: 'bg-zinc-200 text-zinc-900 border-zinc-400',
    dotColor: '#71717a',
    chipClass: 'bg-zinc-600 text-white border-zinc-700',
    barColor: '#71717a',
  },
];

/**
 * ปรับชื่อสีย่อยให้เป็นรูปแบบมาตรฐาน (Canonical Sub-color):
 * 1. ตัดคำนำหน้า "สี" เช่น "สีขาว AW" -> "ขาว AW", "สีดำ" -> "ดำ"
 * 2. ยุบช่องว่างซ้ำซ้อนให้เหลือ 1 เคาะ
 * 3. จัดการเว้นวรรคเครื่องหมาย / เช่น "AW / Z.cool" -> "AW/Z.cool"
 * 4. ปรับอักษรพิมพ์เล็ก-ใหญ่ให้สอดคล้องกัน เช่น "aw" -> "AW", "z.cool" -> "Z.cool"
 */
export function normalizeSubColor(rawColor: string): string {
  if (!rawColor || !rawColor.trim()) return 'ไม่ระบุสี';
  let s = rawColor.trim();

  // 1. ตัดคำนำหน้า "สี" หากตามด้วยอักษรภาษาไทยอื่นๆ (เช่น "สีขาว AW" -> "ขาว AW")
  if (s.startsWith('สี') && s.length > 2) {
    s = s.slice(2).trim();
  }

  // 2. ยุบช่องว่างซ้ำซ้อน
  s = s.replace(/\s+/g, ' ');

  // 3. จัดการเครื่องหมายสแลช /
  s = s.replace(/\s*\/\s*/g, '/');

  // 4. จัดการคำเฉพาะภาษาอังกฤษ (AW, Z.cool, Blue Scope)
  s = s.replace(/\baw\b/gi, 'AW');
  s = s.replace(/\bz\.cool\b/gi, 'Z.cool');
  s = s.replace(/\bblue\s*scope\b/gi, 'Blue Scope');

  // 5. จัดการ ช็อคโกแลต -> ช็อกโกแลต
  s = s.replace(/ช็อคโกแลต/g, 'ช็อกโกแลต');

  // 6. ซิงค์ -> อลูซิงค์ (ถ้าเป็นคำเดี่ยวหรือซิงค์เฉยๆ)
  if (s === 'ซิงค์') s = 'อลูซิงค์';

  return s;
}

/**
 * ดึงชื่อสีหลักภาษาไทย (Base Thai Color)
 * เช่น "ขาว AW", "ขาว AW/Z.cool", "สีขาวมุก" -> "ขาว"
 * "ดำด้าน", "สีดำเงา" -> "ดำ"
 * "ช็อคโกแลต AW" -> "ช็อกโกแลต"
 */
export function extractBaseThaiColor(rawColor: string): string {
  if (!rawColor || !rawColor.trim()) return 'ไม่ระบุสี';
  const clean = normalizeSubColor(rawColor);

  // ค้นหาคำขึ้นต้นตามรายชื่อสีหลัก
  for (const item of KNOWN_BASE_THAI_COLORS) {
    if (clean.startsWith(item.key)) {
      return item.key;
    }
  }

  // ค้นหาว่ามีคำว่าสีเหล่านี้ประกอบอยู่หรือไม่
  for (const item of KNOWN_BASE_THAI_COLORS) {
    if (clean.includes(item.key)) {
      return item.key;
    }
  }

  // Fallback: ดึงคำภาษาไทยชุดแรกก่อนเว้นวรรคหรือเครื่องหมาย
  const thaiMatch = clean.match(/^[\u0E00-\u0E7F]+/);
  if (thaiMatch && thaiMatch[0].trim()) {
    const firstThai = thaiMatch[0].trim();
    if (firstThai.length >= 2) return firstThai;
  }

  return clean;
}

export function getColorStyle(baseColorKey: string): BaseColorMeta {
  const found = KNOWN_BASE_THAI_COLORS.find(
    (c) => c.key === baseColorKey || c.label.includes(baseColorKey)
  );
  if (found) return found;

  return {
    key: baseColorKey,
    label: `สี${baseColorKey}`,
    bgClass: 'bg-slate-50',
    borderClass: 'border-slate-300',
    textClass: 'text-slate-800',
    badgeClass: 'bg-slate-100 text-slate-800 border-slate-300',
    dotColor: '#94a3b8',
    chipClass: 'bg-slate-700 text-white border-slate-800',
    barColor: '#64748b',
  };
}

/**
 * ปรับค่าความหนาให้เป็นรูปแบบตัวเลขมาตรฐาน เช่น "0.35 มม."
 */
export function normalizeThickness(rawThickness: string | number | undefined): string {
  if (rawThickness == null) return 'ไม่ระบุ';
  const str = String(rawThickness).trim();
  const num = parseFloat(str.replace(/[^0-9.]/g, ''));
  if (!isNaN(num) && num > 0) {
    return `${num.toFixed(2)} มม.`;
  }
  return str.endsWith('มม.') ? str : (str ? `${str} มม.` : 'ไม่ระบุ');
}

export interface ThicknessGroup {
  thickness: string;
  steelOrigin: string; // แหล่งเหล็กของแถวความหนานี้ (เช่น เหล็กนอก, เหล็กBlue Scope)
  count: number;
  totalLengthMeters: number;
  totalWeightKg: number;
  totalNgKg: number;
  totalNgMeters: number;
  soNumbers: string[];
  coilNumbers: string[];
}

export interface SubColorVariantGroup {
  subColor: string; // เช่น "ขาว AW", "ขาว AW/Z.cool" (ไม่แยกการ์ดหากสีย่อยเดียวกัน)
  steelOrigins: string[]; // รายการแหล่งเหล็กทั้งหมดที่ใช้ในสีย่อยนี้ เช่น ['เหล็กนอก'] หรือ ['เหล็กนอก', 'เหล็กBlue Scope']
  count: number;
  totalLengthMeters: number;
  totalWeightKg: number;
  totalNgKg: number;
  totalNgMeters: number;
  thicknesses: ThicknessGroup[];
}

export interface PrimaryColorGroup {
  baseColor: string; // เช่น "ขาว"
  displayLabel: string; // เช่น "สีขาว"
  colorMeta: BaseColorMeta;
  count: number;
  totalLengthMeters: number;
  totalWeightKg: number;
  totalTons: number;
  totalNgKg: number;
  totalNgMeters: number;
  ngPercent: number;
  subVariants: SubColorVariantGroup[];
}

/**
 * รวมกลุ่มข้อมูลคอยล์ PU Sandwich:
 * ระดับ 1: สีหลักภาษาไทย (เช่น "ขาว" รวม "ขาว AW", "ขาว AW/Z.cool")
 * ระดับ 2: สีย่อย (Sub-color) เช่น "ขาว AW" รวมทุกเรคอร์ดที่เป็นขาว AW ไว้ในการ์ดเดียว ไม่แยกออกจากกัน
 * ระดับ 3: ตารางแจกแจงความหนาและแหล่งเหล็ก (Thickness + Origin Breakdown)
 */
export function groupPuSandwichByThaiColors(records: PuSandwichCutRecord[]): PrimaryColorGroup[] {
  if (!Array.isArray(records) || records.length === 0) return [];

  const primaryMap = new Map<
    string,
    {
      baseColor: string;
      meta: BaseColorMeta;
      subMap: Map<
        string,
        {
          subColor: string;
          steelOriginsSet: Set<string>;
          thickMap: Map<string, ThicknessGroup>;
        }
      >;
    }
  >();

  records.forEach((r) => {
    const rawColor = (r.coilColor || '').trim() || 'ไม่ระบุสี';
    const subColor = normalizeSubColor(rawColor);
    const baseColor = extractBaseThaiColor(subColor);
    const origin = (r.steelOrigin || 'เหล็กนอก').trim();
    const thickness = normalizeThickness(r.thickness);

    const weight = Number(r.weightUsed) || 0;
    const length = Number(r.soLengthMeters) || 0;
    const ngKg = Number(r.ngKg) || 0;
    const ngM = Number(r.ngMeters) || 0;
    const soNo = (r.soNumber || '').trim();
    const coilNo = (r.coilNumber || '').trim();

    // 1. Primary level (สีหลัก เช่น "ขาว", "ดำ", "น้ำเงิน")
    if (!primaryMap.has(baseColor)) {
      primaryMap.set(baseColor, {
        baseColor,
        meta: getColorStyle(baseColor),
        subMap: new Map(),
      });
    }
    const prim = primaryMap.get(baseColor)!;

    // 2. Sub-variant level: ใช้เฉพาะ subColor เป็น key (ไม่นำ origin มาแยกการ์ดสีย่อย)
    // เพื่อให้สีเหมือนกัน สีย่อยเหมือนกัน ถูกรวมอยู่ในการ์ดเดียวกัน 100%
    const subKey = subColor.toLowerCase();
    if (!prim.subMap.has(subKey)) {
      prim.subMap.set(subKey, {
        subColor,
        steelOriginsSet: new Set(),
        thickMap: new Map(),
      });
    }
    const sub = prim.subMap.get(subKey)!;
    sub.steelOriginsSet.add(origin);

    // 3. Thickness + Origin level (แจกแจงในตารางของสีย่อย)
    const thickKey = `${thickness}___${origin}`;
    if (!sub.thickMap.has(thickKey)) {
      sub.thickMap.set(thickKey, {
        thickness,
        steelOrigin: origin,
        count: 0,
        totalLengthMeters: 0,
        totalWeightKg: 0,
        totalNgKg: 0,
        totalNgMeters: 0,
        soNumbers: [],
        coilNumbers: [],
      });
    }
    const thick = sub.thickMap.get(thickKey)!;

    thick.count += 1;
    thick.totalLengthMeters += length;
    thick.totalWeightKg += weight;
    thick.totalNgKg += ngKg;
    thick.totalNgMeters += ngM;
    if (soNo && !thick.soNumbers.includes(soNo)) thick.soNumbers.push(soNo);
    if (coilNo && !thick.coilNumbers.includes(coilNo)) thick.coilNumbers.push(coilNo);
  });

  // แปลงโครงสร้างเป็น Array ที่เรียงลำดับสวยงาม
  const result: PrimaryColorGroup[] = [];

  primaryMap.forEach((prim) => {
    let primTotalCount = 0;
    let primTotalLength = 0;
    let primTotalWeight = 0;
    let primTotalNgKg = 0;
    let primTotalNgM = 0;

    const subVariants: SubColorVariantGroup[] = [];

    prim.subMap.forEach((sub) => {
      let subTotalCount = 0;
      let subTotalLength = 0;
      let subTotalWeight = 0;
      let subTotalNgKg = 0;
      let subTotalNgM = 0;

      const thicknesses: ThicknessGroup[] = [];

      sub.thickMap.forEach((thick) => {
        subTotalCount += thick.count;
        subTotalLength += thick.totalLengthMeters;
        subTotalWeight += thick.totalWeightKg;
        subTotalNgKg += thick.totalNgKg;
        subTotalNgM += thick.totalNgMeters;

        thicknesses.push({
          ...thick,
          totalLengthMeters: Math.round(thick.totalLengthMeters * 10) / 10,
          totalWeightKg: Math.round(thick.totalWeightKg * 100) / 100,
          totalNgKg: Math.round(thick.totalNgKg * 100) / 100,
          totalNgMeters: Math.round(thick.totalNgMeters * 10) / 10,
        });
      });

      // เรียงลำดับความหนาจากน้อยไปมาก
      thicknesses.sort((a, b) => {
        const numA = parseFloat(a.thickness) || 0;
        const numB = parseFloat(b.thickness) || 0;
        if (numA !== numB) return numA - numB;
        return a.steelOrigin.localeCompare(b.steelOrigin, 'th');
      });

      primTotalCount += subTotalCount;
      primTotalLength += subTotalLength;
      primTotalWeight += subTotalWeight;
      primTotalNgKg += subTotalNgKg;
      primTotalNgM += subTotalNgM;

      subVariants.push({
        subColor: sub.subColor,
        steelOrigins: Array.from(sub.steelOriginsSet),
        count: subTotalCount,
        totalLengthMeters: Math.round(subTotalLength * 10) / 10,
        totalWeightKg: Math.round(subTotalWeight * 100) / 100,
        totalNgKg: Math.round(subTotalNgKg * 100) / 100,
        totalNgMeters: Math.round(subTotalNgM * 10) / 10,
        thicknesses,
      });
    });

    // เรียงสีย่อยตามยอดเมตรผลิตจากมากไปน้อย
    subVariants.sort((a, b) => b.totalLengthMeters - a.totalLengthMeters);

    const ngPercent = primTotalWeight > 0 ? (primTotalNgKg / primTotalWeight) * 100 : 0;

    result.push({
      baseColor: prim.baseColor,
      displayLabel: prim.meta.label || `สี${prim.baseColor}`,
      colorMeta: prim.meta,
      count: primTotalCount,
      totalLengthMeters: Math.round(primTotalLength * 10) / 10,
      totalWeightKg: Math.round(primTotalWeight * 100) / 100,
      totalTons: Math.round((primTotalWeight / 1000) * 100) / 100,
      totalNgKg: Math.round(primTotalNgKg * 100) / 100,
      totalNgMeters: Math.round(primTotalNgM * 10) / 10,
      ngPercent: Math.round(ngPercent * 100) / 100,
      subVariants,
    });
  });

  // เรียงสีหลักตามยอดเมตรผลิตรวมจากมากไปน้อย
  result.sort((a, b) => b.totalLengthMeters - a.totalLengthMeters);

  return result;
}
