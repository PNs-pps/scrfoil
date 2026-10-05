import React, { useEffect, useRef, useState } from 'react';
import { Layers, Plus, Scissors, BarChart3, Package, History, Download, Settings, Lock, Unlock, Key, Workflow, Bug, LogOut, Factory, User, Check } from 'lucide-react';
import { UserMode } from '../utils/auth';

interface NavbarProps {
  activeTab: 'dashboard' | 'rolls' | 'history' | 'settings';
  setActiveTab: (tab: 'dashboard' | 'rolls' | 'history' | 'settings') => void;
  onOpenAddModal: () => void;
  onOpenCutModal: (mode?: 'so' | 'non_so') => void;
  onOpenPuSandwichModal: () => void;
  puSandwichCount?: number;
  totalRemainingMeters: number;
  activeRollsCount: number;
  onResetData: () => void;
  onExportRolls: () => void;
  onExportHistory: () => void;
  hasPermissionNotice?: boolean;
  userMode: UserMode;
  onUnlockEditor: () => void;
  onLockVisitor: () => void;
  onOpenSOAudit?: () => void;
  soBugCount?: number;
  currentUserEmail?: string | null;
  onSignOut?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onOpenAddModal,
  onOpenCutModal,
  onOpenPuSandwichModal,
  puSandwichCount = 0,
  totalRemainingMeters,
  activeRollsCount,
  onResetData,
  onExportRolls,
  onExportHistory,
  hasPermissionNotice = false,
  userMode,
  onUnlockEditor,
  onLockVisitor,
  onOpenSOAudit,
  soBugCount = 0,
  currentUserEmail,
  onSignOut,
}) => {
  // Account menu. This used to be a single button that signed you out on click,
  // which was both undiscoverable on phones (hidden below `sm`) and a
  // one-tap destructive action with no confirmation.
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isAccountOpen) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setIsAccountOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsAccountOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isAccountOpen]);

  return (
    <header className="bg-white/90 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-30 shadow-sm pt-[env(safe-area-inset-top)]">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between py-1.5 sm:py-2 gap-1.5">
          
          {/* Top Row: Logo & Top Utilities */}
          <div className="flex items-center justify-between gap-2">
            {/* Logo & Title */}
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-bold shadow-sm shrink-0">
                <Layers className="w-4.5 h-4.5 stroke-[2.2]" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-md bg-slate-900 text-amber-400 tracking-wide">
                    หลังคาเย็นสยาม
                  </span>
                  <span className="text-[11px] text-slate-400 hidden sm:inline font-mono">
                    คลังฟอยล์ PU FOAM
                  </span>
                </div>
                <h1 className="text-sm font-bold text-slate-900 tracking-tight leading-tight truncate">
                  สต๊อกฟอยล์ · ร่มเกล้า
                </h1>
              </div>
            </div>

            {/* Mode Switcher Pill & Quick Utility (Top Right) */}
            <div className="flex items-center gap-1.5 shrink-0">
              {userMode === 'visitor' ? (
                <button
                  type="button"
                  onClick={onUnlockEditor}
                  className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 text-xs font-bold transition-all cursor-pointer shadow-2xs group"
                  title="คลิกเพื่อใส่รหัสผ่านและปลดล็อคโหมดคีย์ข้อมูล"
                >
                  <Lock className="w-3.5 h-3.5 text-amber-700 group-hover:scale-110 transition-transform" />
                  <span className="hidden sm:inline">ผู้เข้าชม</span>
                  <span className="px-1.5 py-0.2 rounded bg-amber-200 text-amber-950 text-[10px] font-bold">
                    ปลดล็อค
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onLockVisitor}
                  className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-900 text-xs font-bold transition-all cursor-pointer shadow-2xs group"
                  title="คลิกเพื่อล็อคกลับสู่โหมดผู้เข้าชม"
                >
                  <Unlock className="w-3.5 h-3.5 text-emerald-600 group-hover:scale-110 transition-transform" />
                  <span className="hidden sm:inline">คีย์ข้อมูล</span>
                  <span className="px-1.5 py-0.2 rounded bg-emerald-200 text-emerald-950 text-[10px] font-bold">
                    ล็อค
                  </span>
                </button>
              )}

              {/* SO Bug Inspector — ไอคอนเล็ก + จุดแจ้งเตือน */}
              {onOpenSOAudit && (
                <button
                  type="button"
                  onClick={onOpenSOAudit}
                  className="relative p-1.5 sm:p-2 rounded-lg text-slate-600 hover:text-amber-800 hover:bg-amber-50 border border-transparent hover:border-amber-200 transition-all cursor-pointer"
                  title={
                    soBugCount && soBugCount > 0
                      ? `ตรวจหาบัค SO (${soBugCount} ม้วน)`
                      : 'ตรวจหาบัคจากประวัติ SO'
                  }
                >
                  <Bug className={`w-4 h-4 ${soBugCount && soBugCount > 0 ? 'text-amber-600' : 'text-slate-500'}`} />
                  {Boolean(soBugCount && soBugCount > 0) && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-3.5 px-0.5 rounded-full bg-rose-600 text-white text-[11px] font-bold leading-[14px] text-center">
                      {soBugCount > 9 ? '9+' : soBugCount}
                    </span>
                  )}
                </button>
              )}

              {/* Utility / Export Button */}
              <button
                id="btn-export-options"
                onClick={activeTab === 'history' ? onExportHistory : onExportRolls}
                title="ส่งออกข้อมูล CSV"
                className="p-1.5 sm:p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer border border-slate-200"
              >
                <Download className="w-4 h-4" />
              </button>

              {/* Signed-in account chip — opens a menu showing who is signed in */}
              {currentUserEmail && (
                <div className="relative" ref={accountRef}>
                  <button
                    type="button"
                    id="btn-account"
                    onClick={() => setIsAccountOpen((v) => !v)}
                    aria-expanded={isAccountOpen}
                    aria-haspopup="menu"
                    aria-label={`บัญชีที่เข้าสู่ระบบ: ${currentUserEmail}`}
                    title={currentUserEmail}
                    className="flex items-center gap-1.5 pl-1 pr-1.5 py-1 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer min-w-[44px] min-h-[44px] sm:min-h-0"
                  >
                    <span className="w-6 h-6 rounded-full bg-slate-900 text-amber-400 text-[11px] font-bold flex items-center justify-center shrink-0">
                      {currentUserEmail.charAt(0).toUpperCase()}
                    </span>
                    <span className="hidden sm:inline text-[11px] font-medium max-w-[140px] truncate">
                      {currentUserEmail}
                    </span>
                  </button>

                  {isAccountOpen && (
                    <div
                      role="menu"
                      aria-label="บัญชีผู้ใช้"
                      className="absolute right-0 top-full mt-1.5 z-50 w-[260px] rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden"
                    >
                      <div className="px-3 py-2.5 bg-slate-50 border-b border-slate-200">
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                          เข้าสู่ระบบด้วย
                        </p>
                        <p className="text-xs font-bold text-slate-900 break-all mt-0.5">
                          {currentUserEmail}
                        </p>
                        <p className="mt-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                          <Check className="w-3 h-3" aria-hidden="true" />
                          {userMode === 'editor' ? 'โหมดคีย์ข้อมูล' : 'โหมดผู้เข้าชม'}
                        </p>
                      </div>

                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setIsAccountOpen(false);
                          onSignOut?.();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-bold text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer min-h-[44px]"
                      >
                        <LogOut className="w-4 h-4 shrink-0" aria-hidden="true" />
                        <span>ออกจากระบบ</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Action Row: Metrics + Main 2 Action Buttons (Side by Side on the Same Row) */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2 sm:gap-3 w-full md:w-auto">
            <div className="hidden lg:flex items-center gap-3 px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-200 text-xs">
              <div>
                <span className="text-slate-500 block">คงเหลือรวม</span>
                <span className="font-bold text-slate-900 text-sm font-mono">
                  {totalRemainingMeters.toLocaleString()} <span className="font-normal text-slate-500 text-xs">ม.</span>
                </span>
              </div>
              <div className="w-px h-6 bg-slate-200" />
              <div>
                <span className="text-slate-500 block">ม้วนพร้อมใช้</span>
                <span className="font-bold text-emerald-600 text-sm font-mono">
                  {activeRollsCount} <span className="font-normal text-slate-500 text-xs">ม้วน</span>
                </span>
              </div>
            </div>

{/* Action Buttons: three primary commands */}
            <div className="grid grid-cols-3 gap-1.5 sm:flex sm:items-center sm:gap-2 w-full sm:w-auto">
              <button
                id="btn-add-foil"
                onClick={onOpenAddModal}
                className="h-9 px-2 sm:px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all duration-200 shadow-xs active:scale-[0.98] cursor-pointer flex items-center justify-center gap-1.5"
              >
                {userMode === 'visitor' ? (
                  <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                ) : (
                  <Plus className="w-3.5 h-3.5 text-amber-400 stroke-[2.5] shrink-0" />
                )}
                <span className="whitespace-nowrap">เพิ่มฟอยล์</span>
              </button>

              <button
                id="btn-cut-foil"
                onClick={() => onOpenCutModal('so')}
                title="ตัดสต๊อกฟอยล์ (บันทึก SO หรือตัดไม่ใช้ SO)"
                className="h-9 px-2 sm:px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all duration-200 shadow-xs active:scale-[0.98] cursor-pointer flex items-center justify-center gap-1.5 border border-amber-600/30"
              >
                {userMode === 'visitor' ? (
                  <Lock className="w-3.5 h-3.5 stroke-[2.5] shrink-0" />
                ) : (
                  <Scissors className="w-3.5 h-3.5 stroke-[2.5] shrink-0" />
                )}
                <span className="whitespace-nowrap">ตัดสต๊อกฟอยล์</span>
              </button>

              {/* PU sandwich cut — records a steel-coil SO (weight before/after).
                  This does not touch foil rolls; see PuSandwichModal. */}
              <button
                id="btn-cut-pu-sandwich"
                onClick={onOpenPuSandwichModal}
                title="ตัดสต๊อกแซนวิช (บันทึก SO ผลิต PU Sandwich ไม่ใช้ฟอยล์)"
                className="h-9 px-2 sm:px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all duration-200 shadow-xs active:scale-[0.98] cursor-pointer flex items-center justify-center gap-1.5 border border-emerald-700/30"
              >
                {userMode === 'visitor' ? (
                  <Lock className="w-3.5 h-3.5 stroke-[2.5] shrink-0" />
                ) : (
                  <Factory className="w-3.5 h-3.5 stroke-[2.5] shrink-0" />
                )}
                <span className="whitespace-nowrap">ตัดสต๊อกแซนวิช</span>
                {puSandwichCount > 0 && (
                  <span className="min-w-[16px] px-1 h-4 rounded-full bg-white/25 text-[10px] font-mono font-bold leading-4 text-center">
                    {puSandwichCount > 99 ? '99+' : puSandwichCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Navigation Tabs for PC / Tablet (Distinct desktop navigation container) */}
        <div className="hidden md:flex items-center border-t border-slate-100 pt-2.5 pb-1 overflow-x-auto">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100/90 rounded-2xl border border-slate-200/80 shadow-2xs">
            <button
              id="tab-dashboard"
              onClick={() => setActiveTab('dashboard')}
              className={`inline-flex items-center gap-2 py-2 px-3.5 rounded-xl font-medium text-xs lg:text-sm transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'dashboard'
                  ? 'bg-white text-slate-950 font-bold shadow-xs border border-slate-200/70'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <BarChart3 className="w-4 h-4 text-amber-600" />
              <span className="lg:hidden">แดชบอร์ด</span>
              <span className="hidden lg:inline">แดชบอร์ดภาพรวมสต๊อก</span>
            </button>

            <button
              id="tab-rolls"
              onClick={() => setActiveTab('rolls')}
              className={`inline-flex items-center gap-2 py-2 px-3.5 rounded-xl font-medium text-xs lg:text-sm transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'rolls'
                  ? 'bg-white text-slate-950 font-bold shadow-xs border border-slate-200/70'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Package className="w-4 h-4 text-amber-600" />
              <span className="lg:hidden">ม้วนฟอยล์</span>
              <span className="hidden lg:inline">คลังม้วนฟอยล์</span>
              <span className={`text-[11px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                activeTab === 'rolls' ? 'bg-amber-100 text-amber-900' : 'bg-slate-200 text-slate-700'
              }`}>
                {activeRollsCount}
              </span>
            </button>

            <button
              id="tab-history"
              onClick={() => setActiveTab('history')}
              className={`inline-flex items-center gap-2 py-2 px-3.5 rounded-xl font-medium text-xs lg:text-sm transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'history'
                  ? 'bg-white text-slate-950 font-bold shadow-xs border border-slate-200/70'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <History className="w-4 h-4 text-amber-600" />
              <span className="lg:hidden">ประวัติตัด</span>
              <span className="hidden lg:inline">ประวัติการตัดสต๊อก (SO)</span>
            </button>

            <button
              id="tab-settings"
              onClick={() => setActiveTab('settings')}
              className={`inline-flex items-center gap-2 py-2 px-3.5 rounded-xl font-medium text-xs lg:text-sm transition-all whitespace-nowrap cursor-pointer relative ${
                activeTab === 'settings'
                  ? 'bg-white text-slate-950 font-bold shadow-xs border border-slate-200/70'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Settings className="w-4 h-4 text-slate-600" />
              <span className="lg:hidden">ตั้งค่า</span>
              <span className="hidden lg:inline">ตั้งค่า & สำรองข้อมูล</span>
              {hasPermissionNotice && (
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              )}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
