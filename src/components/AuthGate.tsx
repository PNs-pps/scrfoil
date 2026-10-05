import React, { useEffect, useState } from 'react';
import { Layers, LogIn, ShieldAlert, Mail, Lock as LockIcon, Eye, EyeOff, CheckCircle2, PartyPopper } from 'lucide-react';
import type { User } from 'firebase/auth';
import {
  subscribeToAuthState,
  signInWithGoogle,
  signInWithEmail,
  registerWithEmail,
  sendResetPasswordEmail,
  checkRedirectSignIn,
} from '../lib/firebase';

// Inline brand marks (kept as local SVG per the offline/self-contained rule —
// no external icon fonts or hotlinked logo images).
const GoogleG: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.1 8 3.1l5.7-5.7C34.5 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"/>
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.9 1.1 8 3.1l5.7-5.7C34.5 6.1 29.6 4 24 4 16 4 9 8.5 6.3 14.7z"/>
    <path fill="#4CAF50" d="M24 44c5.5 0 10.4-2.1 14.1-5.6l-6.5-5.5C29.6 34.7 26.9 36 24 36c-5.3 0-9.7-3.4-11.3-8l-6.5 5C9 39.5 16 44 24 44z"/>
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.3-4.1 5.7l6.5 5.5C39.9 37 44 31.4 44 24c0-1.3-.1-2.7-.4-3.5z"/>
  </svg>
);

const FacebookF: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path fill="#ffffff" d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.95.93-1.95 1.89v2.25h3.32l-.53 3.49h-2.79V24C19.61 23.1 24 18.1 24 12.07z"/>
  </svg>
);

const AppleLogo: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path
      fill="currentColor"
      d="M16.365 1.43c0 1.14-.468 2.16-1.222 2.9-.822.82-2.02 1.42-3.05 1.34-.13-1.12.44-2.29 1.19-3.02.83-.82 2.26-1.43 3.08-1.22zM20.6 17.29c-.55 1.24-.81 1.8-1.52 2.9-1 1.53-2.4 3.43-4.14 3.45-1.55.02-1.95-1-4.05-.99-2.1.01-2.54 1.01-4.09.99-1.74-.02-3.06-1.73-4.06-3.26C.03 16.7-.72 11.6 1.67 8.08c1.19-1.75 3.13-2.85 4.94-2.88 1.63-.03 3.17 1.1 4.16 1.1.99 0 2.86-1.36 4.82-1.16.82.03 3.13.33 4.62 2.5-.12.08-2.76 1.61-2.73 4.8.03 3.8 3.33 5.06 3.36 5.08-.03.09-.53 1.8-1.08 2.77z"
    />
  </svg>
);

interface AuthGateProps {
  children: React.ReactNode;
}

type Mode = 'signin' | 'register' | 'reset';

export const AuthGate: React.FC<AuthGateProps> = ({ children }) => {
  const [user, setUser] = useState<User | null | undefined>(undefined); // undefined = still resolving
  const [providerBusy, setProviderBusy] = useState<'google' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  // Facebook / Apple sign-in aren't wired up to real credentials yet (needs a
  // Facebook App + Apple Developer account). Rather than throw a raw Firebase
  // error at people, the buttons show a lighthearted excuse and point them to
  // Google / email instead — swap in the real signInWithFacebook/signInWithApple
  // calls from lib/firebase.ts once those providers are actually configured.
  const [joke, setJoke] = useState<{ provider: 'facebook' | 'apple'; text: string; key: number } | null>(null);
  const FACEBOOK_JOKES = [
    '😅 อุ๊ย! ปุ่ม Facebook ยังเป็นแค่ของตกแต่ง เหมือนเพื่อนที่พูดว่า "เดี๋ยวโอนให้" ...รอมาสามเดือนละ',
    '🤳 Facebook Login ยังไม่ได้ตั้งค่า เจ้าของแอปยังหาเวลาสมัคร Facebook Developer ไม่ได้ (แปลว่าไม่เคยหา)',
    '📘 ระบบขอ "ยืมเฟซบุ๊กเพื่อน" ไปก่อน... ล้อเล่นนะ ใช้ Google หรืออีเมลด้านล่างไปพลางๆ ก่อนน้า',
  ];
  const APPLE_JOKES = [
    '🍏 Apple Sign-In ต้องเสียค่าสมาชิก Apple Developer ปีละ ~3,500 บาท รอบริษัทจ่ายให้นะ',
    '🍎 ปุ่มนี้สวยแต่รูปเฉยๆ — เหมือน iPhone ที่แบตหมดแล้วเสียบสายชาร์จผิดรุ่น ลองใช้ Google หรืออีเมลแทนนะ',
  ];

  useEffect(() => {
    // Pick up the result of a redirect-based sign-in (mobile/webview fallback)
    checkRedirectSignIn().catch(() => {});

    const unsubscribe = subscribeToAuthState((u) => {
      setUser(u);
    });
    return unsubscribe;
  }, []);

  const describeAuthError = (err: any): string => {
    switch (err?.code) {
      case 'auth/popup-closed-by-user':
        return '';
      case 'auth/unauthorized-domain':
        return 'โดเมนนี้ยังไม่ได้รับอนุญาตให้เข้าสู่ระบบ — แจ้งผู้ดูแลระบบให้เพิ่มโดเมนใน Firebase Console';
      case 'auth/account-exists-with-different-credential':
        return 'อีเมลนี้เคยสมัครไว้ด้วยวิธีเข้าสู่ระบบอื่นแล้ว ลองเข้าด้วยวิธีเดิม';
      case 'auth/invalid-email':
        return 'รูปแบบอีเมลไม่ถูกต้อง';
      case 'auth/user-not-found':
        return 'ไม่พบบัญชีนี้ในระบบ ลองสมัครสมาชิกก่อน';
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
      case 'auth/email-already-in-use':
        return 'อีเมลนี้มีบัญชีอยู่แล้ว ลองเข้าสู่ระบบแทนการสมัครใหม่';
      case 'auth/weak-password':
        return 'รหัสผ่านสั้นเกินไป ต้องมีอย่างน้อย 6 ตัวอักษร';
      case 'auth/too-many-requests':
        return 'ลองผิดหลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่';
      default:
        return 'เข้าสู่ระบบไม่สำเร็จ ลองใหม่อีกครั้ง';
    }
  };

  const handleJokeProvider = (provider: 'facebook' | 'apple') => {
    setError(null);
    const pool = provider === 'facebook' ? FACEBOOK_JOKES : APPLE_JOKES;
    const text = pool[Math.floor(Math.random() * pool.length)];
    setJoke({ provider, text, key: Date.now() });
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setJoke(null);
    setProviderBusy('google');
    try {
      await signInWithGoogle();
    } catch (err: any) {
      const msg = describeAuthError(err);
      if (msg) setError(msg);
      console.warn('google sign-in error:', err);
    } finally {
      setProviderBusy(null);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === 'reset') {
      if (!email.trim()) {
        setError('กรอกอีเมลก่อน');
        return;
      }
      setEmailBusy(true);
      try {
        await sendResetPasswordEmail(email);
        setResetSent(true);
      } catch (err: any) {
        setError(describeAuthError(err) || 'ส่งอีเมลไม่สำเร็จ ลองใหม่อีกครั้ง');
      } finally {
        setEmailBusy(false);
      }
      return;
    }

    if (!email.trim() || !password) {
      setError('กรอกอีเมลและรหัสผ่านให้ครบ');
      return;
    }

    setEmailBusy(true);
    try {
      if (mode === 'register') {
        await registerWithEmail(email, password, name);
      } else {
        await signInWithEmail(email, password);
      }
    } catch (err: any) {
      setError(describeAuthError(err));
      console.warn('Email auth error:', err);
    } finally {
      setEmailBusy(false);
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

  const anyBusy = providerBusy !== null || emailBusy;

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-8">
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

          <h2 className="text-lg font-bold text-slate-900 mb-1.5">
            {mode === 'reset' ? 'ลืมรหัสผ่าน' : mode === 'register' ? 'สมัครสมาชิก' : 'เข้าสู่ระบบเพื่อใช้งาน'}
          </h2>
          <p className="text-[13px] text-slate-500 leading-relaxed mb-5">
            {mode === 'reset'
              ? 'กรอกอีเมลที่ใช้สมัคร ระบบจะส่งลิงก์ตั้งรหัสผ่านใหม่ให้'
              : 'ต้องเข้าสู่ระบบก่อนทุกครั้ง ไม่รองรับการเข้าใช้แบบผู้เยี่ยมชม (Guest) อีกต่อไป'}
          </p>

          {mode !== 'reset' && (
            <>
              <div className="space-y-2 mb-4">
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={anyBusy}
                  className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-sm font-bold shadow-xs transition-all active:scale-[0.98] cursor-pointer disabled:opacity-60 disabled:cursor-wait"
                >
                  {providerBusy === 'google' ? <LogIn className="w-4 h-4 animate-pulse" /> : <GoogleG className="w-4 h-4" />}
                  <span>{providerBusy === 'google' ? 'กำลังเข้าสู่ระบบ...' : 'ดำเนินการต่อด้วย Google'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleJokeProvider('facebook')}
                  disabled={anyBusy}
                  className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl bg-[#1877F2] hover:bg-[#1565d8] text-white text-sm font-bold shadow-xs transition-all active:scale-[0.98] cursor-pointer disabled:opacity-60 disabled:cursor-wait"
                >
                  <FacebookF className="w-4 h-4" />
                  <span>ดำเนินการต่อด้วย Facebook</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleJokeProvider('apple')}
                  disabled={anyBusy}
                  className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl bg-slate-950 hover:bg-black text-white text-sm font-bold shadow-xs transition-all active:scale-[0.98] cursor-pointer disabled:opacity-60 disabled:cursor-wait"
                >
                  <AppleLogo className="w-4 h-4" />
                  <span>ดำเนินการต่อด้วย Apple</span>
                </button>
              </div>

              {joke && (
                <div
                  key={joke.key}
                  className="mb-4 flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs leading-relaxed"
                >
                  <PartyPopper className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                  <div className="flex-1">
                    <span>{joke.text}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setJoke(null)}
                    className="shrink-0 text-amber-500 hover:text-amber-700 font-bold cursor-pointer"
                    aria-label="ปิด"
                  >
                    ✕
                  </button>
                </div>
              )}

              <div className="flex items-center gap-3 my-4">
                <div className="h-px bg-slate-200 flex-1" />
                <span className="text-[11px] text-slate-400 font-medium">หรือใช้อีเมล</span>
                <div className="h-px bg-slate-200 flex-1" />
              </div>
            </>
          )}

          {resetSent ? (
            <div className="flex items-start gap-2 px-3 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs mb-3">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>ส่งลิงก์ตั้งรหัสผ่านใหม่ไปที่ {email} แล้ว เช็คอีเมล (รวมถึงถังขยะ/สแปม) ได้เลย</span>
            </div>
          ) : (
            <form onSubmit={handleEmailSubmit} className="space-y-2.5">
              {mode === 'register' && (
                <div className="relative">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="ชื่อที่แสดง (ไม่บังคับ)"
                    className="w-full pl-3 pr-3 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
                  />
                </div>
              )}

              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="อีเมล"
                  autoComplete="email"
                  className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
                />
              </div>

              {mode !== 'reset' && (
                <div className="relative">
                  <LockIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="รหัสผ่าน"
                    autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                    className="w-full pl-9 pr-9 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={anyBusy}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-bold shadow-xs transition-all active:scale-[0.98] cursor-pointer disabled:opacity-60 disabled:cursor-wait"
              >
                <span>
                  {emailBusy
                    ? 'กำลังดำเนินการ...'
                    : mode === 'reset'
                    ? 'ส่งลิงก์ตั้งรหัสผ่านใหม่'
                    : mode === 'register'
                    ? 'สมัครสมาชิก'
                    : 'เข้าสู่ระบบ'}
                </span>
              </button>
            </form>
          )}

          {error && (
            <div className="mt-3 flex items-start gap-1.5 px-3 py-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs">
              <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="mt-4 text-center text-xs text-slate-500 space-y-1">
            {mode === 'signin' && (
              <>
                <p>
                  ยังไม่มีบัญชี?{' '}
                  <button type="button" onClick={() => { setMode('register'); setError(null); }} className="font-bold text-amber-700 hover:underline cursor-pointer">
                    สมัครสมาชิก
                  </button>
                </p>
                <p>
                  <button type="button" onClick={() => { setMode('reset'); setError(null); setResetSent(false); }} className="text-slate-400 hover:text-slate-600 hover:underline cursor-pointer">
                    ลืมรหัสผ่าน?
                  </button>
                </p>
              </>
            )}
            {mode === 'register' && (
              <p>
                มีบัญชีอยู่แล้ว?{' '}
                <button type="button" onClick={() => { setMode('signin'); setError(null); }} className="font-bold text-amber-700 hover:underline cursor-pointer">
                  เข้าสู่ระบบ
                </button>
              </p>
            )}
            {mode === 'reset' && (
              <p>
                <button type="button" onClick={() => { setMode('signin'); setError(null); setResetSent(false); }} className="font-bold text-amber-700 hover:underline cursor-pointer">
                  กลับไปเข้าสู่ระบบ
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthGate;
