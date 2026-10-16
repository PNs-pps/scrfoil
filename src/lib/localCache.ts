/**
 * localCache — จัด namespace ของ localStorage cache
 *
 * ปัญหาเดิม: โหมดทดลอง (sandbox) เขียนข้อมูลลงคีย์เดียวกับข้อมูลจริง
 * (เช่น pufoam_foil_rolls_v3) ทำให้ระเบียนทดลองค้างปนกับแคชข้อมูลจริง
 * แม้ปิดโหมดทดลองแล้ว
 *
 * วิธีแก้: ทุกคีย์ข้อมูลจะถูกเติม prefix `pufoam_sandbox_` เมื่อโหมดทดลองเปิดอยู่
 * (ดู scopeKey) และเมื่อปิด/เพิกถอนโหมดทดลองจะล้างแคชที่เกี่ยวข้องให้สะอาด
 *
 * ไฟล์นี้เป็น leaf module — ต้องไม่ import จาก './sandbox' เพื่อเลี่ยง dependency cycle
 * (sandbox.ts จะ import ไฟล์นี้แทน)
 */

export const SANDBOX_KEY_PREFIX = 'pufoam_sandbox_';

// ธงสถานะของโหมดทดลอง (single source of truth — sandbox.ts re-export จากที่นี่)
export const SANDBOX_STORAGE_KEY = 'pufoam_sandbox_enabled';
export const SANDBOX_DEVICE_KEY = 'pufoam_sandbox_device_allowed';
export const SANDBOX_STORE_KEY = `${SANDBOX_KEY_PREFIX}store`;

// one-time migration: ล้างแคชจริงที่อาจปนเปื้อนจากโหมดทดลอง (โค้ดรุ่นก่อนหน้า)
export const CACHE_SCOPE_MIGRATION_KEY = 'pufoam_cache_scope_migrated_v1';

/** คีย์ฐาน (ยังไม่เติม prefix) ของแคชข้อมูลทั้งหมด */
export const CACHE_BASE_KEYS = {
  ROLLS: 'pufoam_foil_rolls_v3',
  RECORDS: 'pufoam_cut_records_v3',
  PU_SANDWICH: 'pufoam_pu_sandwich_records_v1',
  OPERATOR_NAMES: 'pufoam_operator_names_v3',
  CLEAN_INITIALIZED: 'pufoam_clean_v3_initialized',
  ARCHIVED_ROLLS: 'pufoam_archived_rolls_cache',
  OLD_ROLLS_V1: 'pufoam_foil_rolls_v1',
  OLD_RECORDS_V1: 'pufoam_cut_records_v1',
  OLD_ROLLS_V2: 'pufoam_foil_rolls_v2',
  OLD_RECORDS_V2: 'pufoam_cut_records_v2',
} as const;

/** โหมดทดลองเปิดอยู่หรือไม่ (อ่านธงดิบ — ไม่พึ่งพา sandbox.ts) */
export function isSandboxActive(): boolean {
  try {
    return localStorage.getItem(SANDBOX_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

/** เติม prefix ของโหมดทดลองให้คีย์ฐาน ถ้าโหมดทดลองเปิดอยู่ */
export function scopeKey(baseKey: string): string {
  return isSandboxActive() ? SANDBOX_KEY_PREFIX + baseKey : baseKey;
}

/** คีย์แคชคลังม้วนหมด (archived rolls) ตาม namespace ปัจจุบัน */
export function archivedRollsCacheKey(): string {
  return scopeKey(CACHE_BASE_KEYS.ARCHIVED_ROLLS);
}

function removeKeys(keys: string[]): void {
  try {
    keys.forEach((k) => localStorage.removeItem(k));
  } catch (err) {
    console.warn('localCache remove failed:', err);
  }
}

function collectSandboxKeys(): string[] {
  const doomed: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(SANDBOX_KEY_PREFIX)) doomed.push(k);
    }
  } catch (err) {
    console.warn('localCache scan failed:', err);
  }
  return doomed;
}

/** ล้างแคชข้อมูลจริงทุกคีย์ (ให้โหลดใหม่จาก Firestore) */
export function clearRealDataCache(): void {
  removeKeys(Object.values(CACHE_BASE_KEYS));
}

/** ล้างแคช/ข้อมูลของโหมดทดลองทั้งหมด (รวมธงและ store) — ใช้ตอนเพิกถอนเครื่อง */
export function purgeSandboxCache(): void {
  removeKeys(collectSandboxKeys());
}

/**
 * one-time migration: ผู้ใช้ที่เคยเปิดโหมดทดลองด้วยโค้ดรุ่นเก่าอาจมีระเบียนทดลอง
 * ปนอยู่ในคีย์ข้อมูลจริง — ล้างแคชจริงหนึ่งครั้งเพื่อให้โหลดใหม่จาก Firestore
 */
export function runCacheScopeMigration(): void {
  if (isSandboxActive()) return;
  try {
    if (localStorage.getItem(CACHE_SCOPE_MIGRATION_KEY)) return;
    clearRealDataCache();
    localStorage.setItem(CACHE_SCOPE_MIGRATION_KEY, 'true');
  } catch (err) {
    console.warn('localCache migration failed:', err);
  }
}
