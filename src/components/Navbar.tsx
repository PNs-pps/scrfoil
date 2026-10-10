import React, { useEffect, useRef, useState } from 'react';
import {
  Layers,
  Plus,
  Scissors,
  BarChart3,
  Package,
  History,
  Download,
  Settings,
  Lock,
  Unlock,
  Bug,
  LogOut,
  Factory,
  User,
  Check,
  FileSpreadsheet,
} from 'lucide-react';
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
  onOpenExcelExport?: () => void;
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
  onOpenExcelExport,
}) => {
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

  const userInitial = currentUserEmail
    ? currentUserEmail.trim().charAt(0).toUpperCase()
    : null;

  return (
    <header className="bg-white/95 backdrop-blur-md border-b border-slate-200/90 sticky top-0 z-30 shadow-2xs pt-[env(safe-area-inset-top)]">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        
        {/* Tier 1: Brand Logo, Desktop Navigation Tabs & Core Controls */}
        <div className="flex items-center justify-between py-2 sm:py-2.5 gap-2 sm:gap-4">
          
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 shrink-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-linear-to-br from-amber-400 to-amber-500 text-slate-950 flex items-center justify-center font-bold shadow-xs shrink-0 ring-1 ring-amber-600/20">
              <Layers className="w-4.5 h-4.5 sm:w-5 sm:h-5 stroke-[2.2]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs sm:text-sm font-extrabold text-slate-900 tracking-tight leading-none truncate">
                  หลังคาเย็นสยาม ร่มเกล้า
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium leading-tight mt-0.5 truncate">
                สต๊อกฟอยล์ & PU FOAM
              </p>
            </div>
          </div>

          {/* Desktop Navigation Tabs (Integrated directly in top bar for clean layout) */}
          <nav
            aria-label="เมนูหลักระบบ"
            className="hidden md:flex items-center gap-1 p-1 bg-slate-100/90 rounded-xl border border-slate-200/80 shadow-2xs"
          >
            <button
              id="tab-dashboard"
              type="button"
              onClick={() => setActiveTab('dashboard')}
              className={`inline-flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'dashboard'
                  ? 'bg-white text-slate-950 font-bold shadow-xs border border-slate-200/70'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 text-amber-600" />
              <span>แดชบอร์ด</span>
            </button>

            <button
              id="tab-rolls"
              type="button"
              onClick={() => setActiveTab('rolls')}
              className={`inline-flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'rolls'
                  ? 'bg-white text-slate-950 font-bold shadow-xs border border-slate-200/70'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Package className="w-3.5 h-3.5 text-amber-600" />
              <span>ม้วนฟอยล์</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                  activeTab === 'rolls' ? 'bg-amber-100 text-amber-900' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {activeRollsCount}
              </span>
            </button>

            <button
              id="tab-history"
              type="button"
              onClick={() => setActiveTab('history')}
              className={`inline-flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'history'
                  ? 'bg-white text-slate-950 font-bold shadow-xs border border-slate-200/70'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <History className="w-3.5 h-3.5 text-amber-600" />
              <span>ประวัติตัด</span>
            </button>

            <button
              id="tab-settings"
              type="button"
              onClick={() => setActiveTab('settings')}
              className={`inline-flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer relative ${
                activeTab === 'settings'
                  ? 'bg-white text-slate-950 font-bold shadow-xs border border-slate-200/70'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Settings className="w-3.5 h-3.5 text-slate-600" />
              <span>ตั้งค่า</span>
              {hasPermissionNotice && (
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              )}
            </button>
          </nav>

          {/* Right Controls: Excel Button (no .xlsx), Mode Switcher, Bug Inspector, Profile Avatar (Circle Only) */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            
            {/* Excel Report Button — NO .xlsx suffix */}
            {onOpenExcelExport && (
              <button
                id="btn-excel-report"
                type="button"
                onClick={onOpenExcelExport}
                title="ส่งออกรายงาน Excel สำเร็จรูป สำหรับฝ่ายบัญชีและฝ่ายจัดซื้อ"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-900 text-xs font-bold transition-all cursor-pointer shadow-2xs group active:scale-95"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700 group-hover:scale-110 transition-transform" />
                <span className="hidden xs:inline">รายงาน Excel</span>
              </button>
            )}

            {/* Mode Switcher Pill */}
            {userMode === 'visitor' ? (
              <button
                type="button"
                onClick={onUnlockEditor}
                className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 text-xs font-bold transition-all cursor-pointer shadow-2xs group active:scale-95"
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
                className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-900 text-xs font-bold transition-all cursor-pointer shadow-2xs group active:scale-95"
                title="คลิกเพื่อล็อคกลับสู่โหมดผู้เข้าชม"
              >
                <Unlock className="w-3.5 h-3.5 text-emerald-600 group-hover:scale-110 transition-transform" />
                <span className="hidden sm:inline">คีย์ข้อมูล</span>
                <span className="px-1.5 py-0.2 rounded bg-emerald-200 text-emerald-950 text-[10px] font-bold">
                  ล็อค
                </span>
              </button>
            )}

            {/* SO Bug Inspector (if bug count exists or callback present) */}
            {onOpenSOAudit && (
              <button
                type="button"
                onClick={onOpenSOAudit}
                className="relative p-1.5 sm:p-2 rounded-lg text-slate-600 hover:text-amber-800 hover:bg-amber-50 border border-slate-200 hover:border-amber-200 transition-all cursor-pointer"
                title={
                  soBugCount && soBugCount > 0
                    ? `ตรวจหาบัค SO (${soBugCount} ม้วน)`
                    : 'ตรวจหาบัคจากประวัติ SO'
                }
              >
                <Bug className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${soBugCount && soBugCount > 0 ? 'text-amber-600' : 'text-slate-500'}`} />
                {Boolean(soBugCount && soBugCount > 0) && (
                  <span className="absolute -top-1 -right-1 min-w-[14px] h-3.5 px-0.5 rounded-full bg-rose-600 text-white text-[10px] font-bold leading-[14px] text-center">
                    {soBugCount > 9 ? '9+' : soBugCount}
                  </span>
                )}
              </button>
            )}

            {/* Profile Avatar (ONLY a pure circle profile avatar icon, no text label!) */}
            <div className="relative" ref={accountRef}>
              <button
                type="button"
                id="btn-account"
                onClick={() => setIsAccountOpen((v) => !v)}
                aria-expanded={isAccountOpen}
                aria-haspopup="menu"
                aria-label={`บัญชีผู้ใช้: ${currentUserEmail || 'ผู้ใช้งาน'}`}
                title={currentUserEmail || 'โปรไฟล์ผู้ใช้'}
                className="w-8 h-8 rounded-full bg-linear-to-br from-slate-900 via-slate-800 to-slate-950 text-amber-400 font-bold text-xs flex items-center justify-center shadow-xs ring-2 ring-slate-200 hover:ring-amber-500 transition-all cursor-pointer active:scale-95 shrink-0"
              >
                {userInitial ? (
                  <span>{userInitial}</span>
                ) : (
                  <User className="w-4 h-4 text-slate-300" />
                )}
              </button>

              {/* Account Dropdown Menu */}
              {isAccountOpen && (
                <div
                  role="menu"
                  aria-label="บัญชีผู้ใช้"
                  className="absolute right-0 top-full mt-2 z-50 w-[270px] rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
                >
                  <div className="px-3.5 py-3 bg-slate-50 border-b border-slate-200">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-slate-900 text-amber-400 text-xs font-bold flex items-center justify-center shrink-0">
                        {userInitial || <User className="w-4 h-4 text-slate-300" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                          บัญชีที่เข้าสู่ระบบ
                        </p>
                        <p className="text-xs font-bold text-slate-900 truncate" title={currentUserEmail || undefined}>
                          {currentUserEmail || 'ผู้เข้าชม (ไม่ได้เข้าสู่ระบบ)'}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          userMode === 'editor'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        <Check className="w-3 h-3" aria-hidden="true" />
                        {userMode === 'editor' ? 'โหมดคีย์ข้อมูล (Editor)' : 'โหมดผู้เข้าชม (Visitor)'}
                      </span>
                    </div>
                  </div>

                  {currentUserEmail && onSignOut && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setIsAccountOpen(false);
                        onSignOut();
                      }}
                      className="w-full flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
                    >
                      <LogOut className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>ออกจากระบบ</span>
                    </button>
                  )}
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Tier 2: Primary Production Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-1.5 sm:py-2 gap-2 border-t border-slate-100">
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>ระบบบันทึกและตัดสต๊อกหน้างาน</span>
          </div>

          {/* Primary Production Action Buttons + CSV Backup */}
          <div className="flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
            <div className="grid grid-cols-3 gap-1.5 w-full sm:w-auto sm:flex sm:items-center">
              
              {/* Button 1: Add Foil */}
              <button
                id="btn-add-foil"
                onClick={onOpenAddModal}
                className="h-9 px-2 sm:px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all duration-200 shadow-xs active:scale-[0.98] cursor-pointer flex items-center justify-center gap-1.5"
              >
                {userMode === 'visitor' ? (
                  <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                ) : (
                  <Plus className="w-3.5 h-3.5 text-amber-400 stroke-[2.5] shrink-0" />
                )}
                <span className="whitespace-nowrap">เพิ่มฟอยล์</span>
              </button>

              {/* Button 2: Cut Foil */}
              <button
                id="btn-cut-foil"
                onClick={() => onOpenCutModal('so')}
                title="ตัดสต๊อกฟอยล์ (บันทึก SO หรือตัดไม่ใช้ SO)"
                className="h-9 px-2 sm:px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all duration-200 shadow-xs active:scale-[0.98] cursor-pointer flex items-center justify-center gap-1.5 border border-amber-600/30"
              >
                {userMode === 'visitor' ? (
                  <Lock className="w-3.5 h-3.5 stroke-[2.5] shrink-0" />
                ) : (
                  <Scissors className="w-3.5 h-3.5 stroke-[2.5] shrink-0" />
                )}
                <span className="whitespace-nowrap">ตัดสต๊อกฟอยล์</span>
              </button>

              {/* Button 3: Cut PU Sandwich */}
              <button
                id="btn-cut-pu-sandwich"
                onClick={onOpenPuSandwichModal}
                title="ตัดสต๊อกแซนวิช (บันทึก SO ผลิต PU Sandwich ไม่ใช้ฟอยล์)"
                className="h-9 px-2 sm:px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all duration-200 shadow-xs active:scale-[0.98] cursor-pointer flex items-center justify-center gap-1.5 border border-emerald-700/30"
              >
                {userMode === 'visitor' ? (
                  <Lock className="w-3.5 h-3.5 stroke-[2.5] shrink-0" />
                ) : (
                  <Factory className="w-3.5 h-3.5 stroke-[2.5] shrink-0" />
                )}
                <span className="whitespace-nowrap">ตัดแซนวิช</span>
              </button>
            </div>

            {/* CSV Export Backup Button */}
            <button
              id="btn-export-options"
              type="button"
              onClick={activeTab === 'history' ? onExportHistory : onExportRolls}
              title="ส่งออกข้อมูลสำรอง CSV"
              className="hidden sm:flex h-9 w-9 items-center justify-center rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer border border-slate-200 shrink-0"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>

        </div>

      </div>
    </header>
  );
};
