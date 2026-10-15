import React from 'react';
import { FlaskConical } from 'lucide-react';
import { isSandboxActive, disableSandbox } from '../lib/sandbox';

/**
 * แถบเตือนโหมดทดลอง — แสดงค้างไว้ด้านบนสุดทุกหน้าจอเมื่อโหมดทดลองเปิดอยู่
 * กด "ปิดโหมดทดลอง" เพื่อกลับไปใช้คลาวด์จริง (ข้อมูลทดลองยังอยู่ในเครื่อง)
 */
export const SandboxBanner: React.FC = () => {
  if (!isSandboxActive()) return null;
  return (
    <div
      role="status"
      className="sticky top-0 z-[80] bg-rose-700 text-white px-3 sm:px-4 py-2.5 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-xs sm:text-sm font-bold shadow-md"
    >
      <span className="flex items-center gap-2 text-center">
        <FlaskConical className="w-4 h-4 shrink-0" />
        <span>โหมดทดลอง — ข้อมูลอยู่ในเครื่องนี้เท่านั้น ไม่ซิงค์ Cloud</span>
      </span>
      <button
        type="button"
        onClick={() => disableSandbox()}
        className="bg-white text-rose-700 font-bold px-3 py-1 rounded-lg hover:bg-rose-50 transition-all text-xs shrink-0 cursor-pointer active:scale-95 shadow-xs"
      >
        ปิดโหมดทดลอง
      </button>
    </div>
  );
};

export default SandboxBanner;
