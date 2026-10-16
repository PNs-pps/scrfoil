/**
 * โหมดทดลอง (Sandbox mode)
 *
 * จุดประสงค์: ให้พนักงานหน้างานทดลองใช้แอปทั้งระบบบนแท็บเล็ตเครื่องเดียวได้
 * โดยไม่แตะข้อมูลคลาวด์จริงเลย — เปิดใช้เฉพาะเครื่องที่ปลดล็อกด้วยรหัสเท่านั้น
 *
 * หลักการสำคัญ:
 * - เก็บเป็น "ธงใน localStorage ของเบราว์เซอร์นั้น" เครื่องอื่นไม่ได้รับผลกระทบ
 * - มีสองธงแยกกัน:
 *   1) `pufoam_sandbox_device_allowed` = เครื่องนี้ได้รับอนุญาต (กรอกรหัสถูกแล้ว)
 *   2) `pufoam_sandbox_enabled`        = กำลังเปิดโหมดทดลองอยู่
 *   เพื่อให้เปิด/ปิดสลับไปมาได้โดยไม่ต้องกรอกรหัสซ้ำ
 * - ค่าถูกอ่านครั้งเดียวตอนโมดูลถูกโหลด (module-eval) ดังนั้นทุกครั้งที่เปลี่ยน
 *   สถานะจะ reload หน้า เพื่อให้ชั้นข้อมูลถูกสร้างใหม่ให้สอดคล้อง
 * - ทุกการอ่าน/เขียน localStorage หุ้ม try/catch เสมอ (โหมดส่วนตัว/ปิด storage)
 */

import { seedSandboxStoreIfEmpty, resetSandboxStore } from './sandboxSeed';
import {
  SANDBOX_STORAGE_KEY,
  SANDBOX_DEVICE_KEY,
  isSandboxActive,
  purgeSandboxCache,
  clearRealDataCache,
} from './localCache';

export { SANDBOX_STORAGE_KEY, SANDBOX_DEVICE_KEY, isSandboxActive };

export const SANDBOX_UNLOCK_CODE = 'PUFOAM-TEST';

/** อ่านธงบูลีนจาก localStorage — คืน false เสมอถ้าอ่านไม่ได้/ยังไม่ตั้งค่า */
function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === 'true';
  } catch {
    return false;
  }
}

/** เขียนธงบูลีนลง localStorage — กลืน error ไม่ให้ล้มแอป */
function writeFlag(key: string, value: boolean): void {
  try {
    if (value) {
      localStorage.setItem(key, 'true');
    } else {
      localStorage.removeItem(key);
    }
  } catch (err) {
    console.warn('Sandbox storage write failed:', err);
  }
}

/**
 * ตรวจว่าเครื่องนี้ได้รับอนุญาตให้ใช้โหมดทดลองแล้วหรือยัง
 * (กรอกรหัสปลดล็อกถูกต้องแล้วอย่างน้อยหนึ่งครั้ง)
 */
export function isSandboxUnlocked(): boolean {
  return readFlag(SANDBOX_DEVICE_KEY);
}

/**
 * ปลดล็อกเครื่องนี้ด้วยรหัส
 * @returns true เมื่อรหัสถูก (และบันทึกธงสำเร็จหรือไม่ก็ตาม — เทียบรหัสเป็นหลัก)
 */
export function unlockSandboxDevice(code: string): boolean {
  const input = (code ?? '').trim().toUpperCase();
  if (input !== SANDBOX_UNLOCK_CODE) return false;
  writeFlag(SANDBOX_DEVICE_KEY, true);
  return true;
}

/** เพิกถอนสิทธิ์เครื่องนี้ และปิดโหมดทดลองไปพร้อมกัน (ล้างข้อมูลทดลองทั้งหมด) */
export function lockSandboxDevice(): void {
  writeFlag(SANDBOX_STORAGE_KEY, false);
  writeFlag(SANDBOX_DEVICE_KEY, false);
  purgeSandboxCache();
}

function reloadPage(): void {
  try {
    if (typeof window !== 'undefined' && window.location) {
      window.location.reload();
    }
  } catch (err) {
    console.warn('Sandbox reload failed:', err);
  }
}

/**
 * เปิดโหมดทดลองบนเครื่องนี้ (ต้องปลดล็อกก่อน)
 * เติมข้อมูลตัวอย่างให้ถ้ายังว่าง แล้ว reload เพื่อสร้างชั้นข้อมูลใหม่
 * @returns true ถ้าเปิดสำเร็จ, false ถ้าเครื่องนี้ยังไม่ได้รับอนุญาต
 */
export function enableSandbox(): boolean {
  if (!isSandboxUnlocked()) return false;
  try {
    seedSandboxStoreIfEmpty();
  } catch (err) {
    console.warn('Sandbox seeding failed:', err);
  }
  writeFlag(SANDBOX_STORAGE_KEY, true);
  reloadPage();
  return true;
}

/** ปิดโหมดทดลอง (คงสิทธิ์เครื่องไว้ เพื่อเปิดใหม่ได้โดยไม่ต้องกรอกรหัส)
 *  ล้างแคชข้อมูลจริงเพื่อให้โหลดใหม่จาก Firestore สะอาด — กันระเบียนทดลองค้าง */
export function disableSandbox(): void {
  writeFlag(SANDBOX_STORAGE_KEY, false);
  clearRealDataCache();
  reloadPage();
}

/** ล้างข้อมูลทดลองทั้งหมดแล้วเติมชุดตัวอย่างใหม่ จากนั้น reload */
export function resetSandboxData(): void {
  try {
    resetSandboxStore();
  } catch (err) {
    console.warn('Sandbox reset failed:', err);
  }
  reloadPage();
}
