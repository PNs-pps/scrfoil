import React, { useState } from 'react';
import { ShieldAlert, Copy, Check, ExternalLink, RefreshCw, Database, X, Terminal } from 'lucide-react';

interface FirebaseRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  onRetry: () => void;
  onSwitchToManagedCloud: () => void;
  currentIsManaged: boolean;
}

export const FirebaseRulesModal: React.FC<FirebaseRulesModalProps> = ({
  isOpen,
  onClose,
  projectId,
  onRetry,
  onSwitchToManagedCloud,
  currentIsManaged,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const rulesCode = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /test/{docId} {
      allow read, write: if true;
    }
    match /foil_rolls/{rollId} {
      allow read, write: if true;
      match /cuts/{cutId} {
        allow read, write: if true;
      }
      match /cut_history/{cutId} {
        allow read, write: if true;
      }
    }
    match /{path=**}/cut_history/{cutId} {
      allow read, write: if true;
    }
    match /stock_cut_records/{recordId} {
      allow read, write: if true;
    }
    match /pu_sandwich_cuts/{recordId} {
      allow read, write: if true;
    }
    // ประวัตินับสต๊อกประจำเดือน (Cycle Count) — ต้องมีกฎนี้ไม่งั้นบันทึกไม่ได้
    match /cycle_counts/{sessionId} {
      allow read, write: if true;
    }
  }
}`;

  const handleCopyRules = () => {
    navigator.clipboard.writeText(rulesCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden text-slate-800 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-amber-500 to-amber-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/20 rounded-lg">
              <ShieldAlert className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-base">วิธีเปิดสิทธิ์ Firebase Firestore Rules</h3>
              <p className="text-amber-100 text-xs">โครงการ: {projectId}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/20 transition-colors text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-sm leading-relaxed">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">สาเหตุที่พบ (Missing permissions): </span>
              เมื่อสร้างฐานข้อมูล Firestore ใหม่บน Firebase ค่าเริ่มต้นจะล็อกการอ่าน/เขียนทั้งหมด (Deny All) 
              ท่านจำเป็นต้องนำ Security Rules ด้านล่างนี้ไปวางในหน้า Firebase Console เพื่ออนุญาตให้เว็บแอปรับส่งข้อมูลสต๊อกได้
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="font-semibold text-slate-900 text-xs uppercase tracking-wider text-slate-500">
              ขั้นตอนการแก้ไข (3 ขั้นตอนง่ายๆ):
            </h4>
            <ol className="list-decimal list-inside space-y-2 text-xs text-slate-700">
              <li>
                เปิด Firebase Console:
                <a
                  href={`https://console.firebase.google.com/project/${projectId}/firestore/rules`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 ml-1.5 text-blue-600 hover:text-blue-700 font-medium underline"
                >
                  เปิดหน้า Rules ของ {projectId} <ExternalLink className="w-3 h-3" />
                </a>
              </li>
              <li>
                คัดลอกโค้ด Rules ด้านล่างนี้ แล้วนำไปวางแทนที่โค้ดเดิมในแท็บ <strong>Rules</strong>
              </li>
              <li>
                กดปุ่ม <strong>Publish</strong> สีฟ้าที่มุมขวาบนของ Firebase Console
              </li>
            </ol>
          </div>

          {/* Rules Code Snippet */}
          <div className="relative rounded-xl bg-slate-900 text-slate-200 border border-slate-800 p-4 font-mono text-xs">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-slate-400">
              <span className="flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-amber-400" />
                firestore.rules
              </span>
              <button
                type="button"
                onClick={handleCopyRules}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-md text-xs font-sans font-medium transition-all shadow"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>คัดลอกแล้ว!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>คัดลอกโค้ด Rules</span>
                  </>
                )}
              </button>
            </div>
            <pre className="overflow-x-auto text-[11px] leading-snug text-amber-200/90 font-mono">
              {rulesCode}
            </pre>
          </div>

          {/* Alternative Quick Option */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-600" />
                <span className="font-semibold text-slate-800 text-xs">ต้องการใช้งานทันทีโดยไม่ต้องตั้งค่า Rules?</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  onSwitchToManagedCloud();
                  onClose();
                }}
                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg shadow transition-colors flex items-center gap-1"
              >
                <Database className="w-3.5 h-3.5" />
                {currentIsManaged ? 'กำลังใช้งาน Cloud สำรองอยู่แล้ว' : 'สลับใช้ Cloud สำรอง (เปิดสิทธิ์แล้ว)'}
              </button>
            </div>
            <p className="text-[11px] text-slate-500 leading-normal">
              เรามี Cloud Firestore สำรองที่เปิดสิทธิ์ Rules และเชื่อมต่อ Realtime ไว้ให้แล้ว สามารถสลับไปใช้ได้ทันที
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-100 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-slate-600 hover:text-slate-800 text-xs font-medium"
          >
            ปิดหน้าต่างนี้ (ใช้งานออฟไลน์/Local ชั่วคราว)
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onRetry();
                onClose();
              }}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-xl shadow transition-colors flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>ลองเชื่อมต่อใหม่อีกครั้ง (Retry)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
