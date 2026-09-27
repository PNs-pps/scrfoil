import React, { useEffect, useState } from 'react';
import { Layers, LogIn, ShieldAlert } from 'lucide-react';
import type { User } from 'firebase/auth';
import { subscribeToAuthState, signInWithGoogle, checkRedirectSignIn } from '../lib/firebase';

// Simple inline multi-color "G" mark (Google's official 4-color glyph),
// used instead of an external image/icon font per the offline-first rules.
const GoogleG: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.1 8 3.1l5.7-5.7C34.5 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"/>
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.9 1.1 8 3.1l5.7-5.7C34.5 6.1 29.6 4 24 4 16 4 9 8.5 6.3 14.7z"/>
    <path fill="#4CAF50" d="M24 44c5.5 0 10.4-2.1 14.1-5.6l-6.5-5.5C29.6 34.7 26.9 36 24 36c-5.3 0-9.7-3.4-11.3-8l-6.5 5C9 39.5 16 44 24 44z"/>
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.3-4.1 5.7l6.5 5.5C39.9 37 44 31.4 44 24c0-1.3-.1-2.7-.4-3.5z"/>
  </svg>
);

interface AuthGateProps {
  children: React.ReactNode;
}

export const AuthGate: React.FC<AuthGateProps> = ({ children }) => {
  const [user, setUser] = useState<User | null | undefined>(undefined); // undefined = still resolving
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Pick up the result of a redirect-based sign-in (mobile/webview fallback)
    checkRedirectSignIn().catch(() => {});

    const unsubscribe = subscribeToAuthState((u) => {
      setUser(u);
    });
    return unsubscribe;
  }, []);

  const handleSignIn = async () => {
    setError(null);
    setSigningIn(true);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user') {
        // User dismissed the popup themselves — not a real error, stay quiet.
      } else if (err?.code === 'auth/unauthorized-domain') {
        setError('โดเมนนี้ยังไม่ได้รับอนุญาตให้เข้าสู่ระบบ Google — แจ้งผู้ดูแลระบบให้เพิ่มโดเมนใน Firebase Console');
      } else {
        setError('เข้าสู่ระบบไม่สำเร็จ ลองใหม่อีกครั้ง');
      }
      console.warn('Google sign-in error:', err);
    } finally {
      setSigningIn(false);
    }
  };

  // Still resolving Firebase's persisted session — avoid flashing the login
  // screen for someone who is already signed in.
  if (user === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <div className="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center shadow-sm animate-pulse">
            <Layers className="w-5 h-5 stroke-[2.2]" />
          </div>
          <span className="text-xs font-medium">กำลังตรวจสอบสิทธิ์เข้าใช้งาน...</span>
        </div>
      </div>
    );
  }

  if (user) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
          <div className="flex items-center gap-2.5 mb-6">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold shadow-sm shrink-0">
              <Layers className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-900 text-amber-400 tracking-wide inline-block mb-0.5">
                หลังคาเย็นสยาม
              </span>
              <h1 className="text-sm font-bold text-slate-900 leading-tight truncate">
                สต๊อกฟอยล์ · ร่มเกล้า
              </h1>
            </div>
          </div>

          <h2 className="text-lg font-bold text-slate-900 mb-1.5">เข้าสู่ระบบเพื่อใช้งาน</h2>
          <p className="text-[13px] text-slate-500 leading-relaxed mb-6">
            ระบบนี้ต้องเข้าสู่ระบบด้วยบัญชี Google ก่อนทุกครั้ง ไม่รองรับการเข้าใช้แบบผู้เยี่ยมชม (Guest) อีกต่อไป
          </p>

          <button
            type="button"
            onClick={handleSignIn}
            disabled={signingIn}
            className="w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-sm font-bold shadow-xs transition-all active:scale-[0.98] cursor-pointer disabled:opacity-60 disabled:cursor-wait"
          >
            {signingIn ? (
              <LogIn className="w-4 h-4 animate-pulse" />
            ) : (
              <GoogleG className="w-4 h-4" />
            )}
            <span>{signingIn ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบด้วย Google'}</span>
          </button>

          {error && (
            <div className="mt-3 flex items-start gap-1.5 px-3 py-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs">
              <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthGate;
