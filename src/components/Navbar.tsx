import React from 'react';
import { Layers, Plus, Scissors, BarChart3, Package, History, Download, Settings, Lock, Unlock, Workflow, Factory, Bug, LogOut } from 'lucide-react';
import { UserMode } from '../utils/auth';

interface NavbarProps {
  activeTab: 'dashboard' | 'rolls' | 'history' | 'flow' | 'sandwich' | 'settings';
  setActiveTab: (tab: 'dashboard' | 'rolls' | 'history' | 'flow' | 'sandwich' | 'settings') => void;
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

const tabBase =
  'inline-flex items-center gap-2 py-2 px-3.5 rounded-md text-xs lg:text-sm transition-colors whitespace-nowrap cursor-pointer border border-transparent';
const tabActive = 'bg-white text-slate-900 font-semibold border-slate-200';
const tabIdle = 'text-slate-500 hover:text-slate-900 hover:bg-white/80 font-medium';

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onOpenAddModal,
  onOpenCutModal,
  onOpenPuSandwichModal,
  puSandwichCount = 0,
  totalRemainingMeters,
  activeRollsCount,
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
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between py-4 gap-4">
          {/* Logo & Title */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-md border border-slate-200 bg-white text-slate-900 flex items-center justify-center shrink-0">
                <Layers className="w-4.5 h-4.5 stroke-[1.75]" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-slate-400 tracking-wide">
                  หลังคาเย็นสยาม · คลังฟอยล์ PU FOAM
                </p>
                <h1 className="text-base font-semibold text-slate-900 tracking-tight leading-tight truncate">
                  สต๊อกฟอยล์ · ร่มเกล้า
                </h1>
              </div>
            </div>

            {/* Top-right utilities */}
            <div className="flex items-center gap-2 shrink-0">
              {userMode === 'visitor' ? (
                <button
                  type="button"
                  onClick={onUnlockEditor}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-200 text-slate-700 text-xs font-medium hover:bg-slate-50 cursor-pointer"
                  title="คลิกเพื่อใส่รหัสผ่านและปลดล็อคโหมดคีย์ข้อมูล"
                >
                  <Lock className="w-3.5 h-3.5 text-slate-500" />
                  <span className="hidden sm:inline">ผู้เข้าชม</span>
                  <span className="text-[10px] text-slate-400 font-medium">ปลดล็อค</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onLockVisitor}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-200 text-slate-700 text-xs font-medium hover:bg-slate-50 cursor-pointer"
                  title="คลิกเพื่อล็อคกลับสู่โหมดผู้เข้าชม"
                >
                  <Unlock className="w-3.5 h-3.5 text-slate-500" />
                  <span className="hidden sm:inline">คีย์ข้อมูล</span>
                  <span className="text-[10px] text-slate-400 font-medium">ล็อค</span>
                </button>
              )}

              {onOpenSOAudit && (
                <button
                  type="button"
                  onClick={onOpenSOAudit}
                  className="relative p-2 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-50 border border-transparent hover:border-slate-200 cursor-pointer"
                  title={
                    soBugCount && soBugCount > 0
                      ? `ตรวจหาบัค SO (${soBugCount} ม้วน)`
                      : 'ตรวจหาบัคจากประวัติ SO'
                  }
                >
                  <Bug className="w-4 h-4" />
                  {Boolean(soBugCount && soBugCount > 0) && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-3.5 px-0.5 rounded-full border border-slate-300 bg-white text-slate-900 text-[9px] font-semibold leading-[14px] text-center">
                      {soBugCount > 9 ? '9+' : soBugCount}
                    </span>
                  )}
                </button>
              )}

              <button
                id="btn-export-options"
                onClick={activeTab === 'history' ? onExportHistory : onExportRolls}
                title="ส่งออกข้อมูล CSV"
                className="p-2 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-50 border border-slate-200 cursor-pointer"
              >
                <Download className="w-4 h-4" />
              </button>

              {currentUserEmail && (
                <button
                  type="button"
                  onClick={onSignOut}
                  title={`เข้าสู่ระบบด้วย ${currentUserEmail} — คลิกเพื่อออกจากระบบ`}
                  className="hidden sm:flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-md border border-slate-200 hover:bg-slate-50 text-slate-600 cursor-pointer"
                >
                  <span className="w-6 h-6 rounded-full border border-slate-200 bg-slate-50 text-slate-700 text-[11px] font-semibold flex items-center justify-center shrink-0">
                    {currentUserEmail.charAt(0).toUpperCase()}
                  </span>
                  <span className="text-[11px] font-medium max-w-[140px] truncate">{currentUserEmail}</span>
                  <LogOut className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                </button>
              )}
            </div>
          </div>

          {/* Metrics + Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3 w-full md:w-auto">
            <div className="hidden lg:flex items-center gap-4 px-4 py-2 bg-slate-50 rounded-md border border-slate-200 text-xs">
              <div>
                <span className="text-slate-400 block font-medium">คงเหลือรวม</span>
                <span className="font-semibold text-slate-900 text-sm font-mono">
                  {totalRemainingMeters.toLocaleString()}{' '}
                  <span className="font-normal text-slate-400 text-xs">ม.</span>
                </span>
              </div>
              <div className="w-px h-6 bg-slate-200" />
              <div>
                <span className="text-slate-400 block font-medium">ม้วนพร้อมใช้</span>
                <span className="font-semibold text-slate-900 text-sm font-mono">
                  {activeRollsCount}{' '}
                  <span className="font-normal text-slate-400 text-xs">ม้วน</span>
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center sm:gap-2 w-full sm:w-auto">
              <button
                id="btn-add-foil"
                onClick={onOpenAddModal}
                className="h-10 px-3 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-medium cursor-pointer flex items-center justify-center gap-1.5"
              >
                {userMode === 'visitor' ? (
                  <Lock className="w-3.5 h-3.5 shrink-0 opacity-70" />
                ) : (
                  <Plus className="w-4 h-4 stroke-[2] shrink-0" />
                )}
                <span className="whitespace-nowrap">เพิ่มฟอยล์</span>
              </button>

              <button
                id="btn-cut-foil"
                onClick={() => onOpenCutModal('so')}
                title="ตัดสต๊อกฟอยล์ (บันทึก SO หรือตัดไม่ใช้ SO)"
                className="h-10 px-3 rounded-md border border-slate-900 bg-white hover:bg-slate-50 text-slate-900 text-xs sm:text-sm font-medium cursor-pointer flex items-center justify-center gap-1.5"
              >
                {userMode === 'visitor' ? (
                  <Lock className="w-3.5 h-3.5 stroke-[2] shrink-0" />
                ) : (
                  <Scissors className="w-4 h-4 stroke-[2] shrink-0" />
                )}
                <span className="whitespace-nowrap">ตัดสต็อกฟอยล์</span>
              </button>

              <button
                id="btn-cut-pu-sandwich"
                onClick={onOpenPuSandwichModal}
                title="ตัด SO ไม่ใช้ฟอยล์ ผลิต PU Sandwich"
                className="h-10 px-3 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-medium cursor-pointer flex items-center justify-center gap-1.5"
              >
                {userMode === 'visitor' ? (
                  <Lock className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <Factory className="w-4 h-4 stroke-[1.75] shrink-0" />
                )}
                <span className="whitespace-nowrap">ตัด SO แซนวิช</span>
              </button>
            </div>
          </div>
        </div>

        {/* Desktop tabs */}
        <div className="hidden md:flex items-center border-t border-slate-100 pt-3 pb-1 overflow-x-auto">
          <div className="flex items-center gap-1 p-1 bg-slate-50 rounded-md border border-slate-200">
            <button
              id="tab-dashboard"
              onClick={() => setActiveTab('dashboard')}
              className={`${tabBase} ${activeTab === 'dashboard' ? tabActive : tabIdle}`}
            >
              <BarChart3 className="w-4 h-4" />
              <span className="lg:hidden">แดชบอร์ด</span>
              <span className="hidden lg:inline">แดชบอร์ดภาพรวมสต๊อก</span>
            </button>

            <button
              id="tab-flow"
              onClick={() => setActiveTab('flow')}
              className={`${tabBase} ${activeTab === 'flow' ? tabActive : tabIdle}`}
            >
              <Workflow className="w-4 h-4" />
              <span>ผลิตรายวัน</span>
            </button>

            <button
              id="tab-rolls"
              onClick={() => setActiveTab('rolls')}
              className={`${tabBase} ${activeTab === 'rolls' ? tabActive : tabIdle}`}
            >
              <Package className="w-4 h-4" />
              <span className="lg:hidden">ม้วนฟอยล์</span>
              <span className="hidden lg:inline">คลังม้วนฟอยล์</span>
              <span
                className={`text-[11px] px-1.5 py-0.5 rounded font-mono font-semibold border ${
                  activeTab === 'rolls'
                    ? 'border-slate-200 bg-white text-slate-900'
                    : 'border-transparent bg-slate-100 text-slate-500'
                }`}
              >
                {activeRollsCount}
              </span>
            </button>

            <button
              id="tab-history"
              onClick={() => setActiveTab('history')}
              className={`${tabBase} ${activeTab === 'history' ? tabActive : tabIdle}`}
            >
              <History className="w-4 h-4" />
              <span className="lg:hidden">ประวัติตัด</span>
              <span className="hidden lg:inline">ประวัติการตัดสต๊อก (SO)</span>
            </button>

            <button
              id="tab-sandwich"
              onClick={() => setActiveTab('sandwich')}
              className={`${tabBase} ${activeTab === 'sandwich' ? tabActive : tabIdle}`}
            >
              <Factory className="w-4 h-4" />
              <span className="lg:hidden">PU แซนวิช</span>
              <span className="hidden lg:inline">ตัด SO แซนวิช (ไม่ใช้ฟอยล์)</span>
              <span
                className={`text-[11px] px-1.5 py-0.5 rounded font-mono font-semibold border ${
                  activeTab === 'sandwich'
                    ? 'border-slate-200 bg-white text-slate-900'
                    : 'border-transparent bg-slate-100 text-slate-500'
                }`}
              >
                {puSandwichCount}
              </span>
            </button>

            <button
              id="tab-settings"
              onClick={() => setActiveTab('settings')}
              className={`${tabBase} relative ${activeTab === 'settings' ? tabActive : tabIdle}`}
            >
              <Settings className="w-4 h-4" />
              <span className="lg:hidden">ตั้งค่า</span>
              <span className="hidden lg:inline">ตั้งค่า & สำรองข้อมูล</span>
              {hasPermissionNotice && (
                <span className="w-1.5 h-1.5 rounded-full bg-slate-900" />
              )}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
