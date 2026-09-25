import React from 'react';
import { Layers, Plus, Scissors, BarChart3, Package, History, Download, Settings, Lock, Unlock, Key, Workflow, Factory, Bug } from 'lucide-react';
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
}) => {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between py-3 gap-3">
          
          {/* Top Row: Logo & Top Utilities */}
          <div className="flex items-center justify-between gap-2">
            {/* Logo & Title */}
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold shadow-xs shrink-0">
                <Layers className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.2]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] sm:text-[11px] font-bold px-1.5 sm:px-2 py-0.5 rounded bg-slate-900 text-amber-400 tracking-wider">
                    หลังคาเย็นสยาม (ร่มเกล้า)
                  </span>
                  <span className="text-xs text-slate-500 hidden sm:inline font-mono">
                    คลังฟอยล์ PU FOAM
                  </span>
                </div>
                <h1 className="text-sm sm:text-lg font-bold text-slate-900 tracking-tight leading-tight mt-0.5">
                  หลังคาเย็นสยาม (ร่มเกล้า)
                </h1>
                <p className="text-xs text-slate-500 hidden md:block">
                  ระบบจัดการสต๊อกฟอยล์และบันทึกใบสั่งผลิตตัดฟอยล์
                </p>
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

              {/* SO Bug Inspector — compact notification-style badge (text form) */}
              {onOpenSOAudit && (
                <button
                  type="button"
                  onClick={onOpenSOAudit}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-amber-50/80 hover:bg-amber-100 border border-amber-200 text-amber-900 text-[11px] font-semibold transition-all cursor-pointer"
                  title="ตรวจหาบัคจากประวัติ SO และตรวจสอบยอดคงเหลือสต๊อก"
                >
                  <Bug className="w-3 h-3 text-amber-600" />
                  <span>บัค SO</span>
                  {Boolean(soBugCount && soBugCount > 0) && (
                    <span className="ml-0.5 px-1.5 py-0 rounded-full bg-rose-600 text-white text-[10px] font-bold leading-4">
                      {soBugCount}
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

            {/* Action Buttons: Prominent and on the Same Line */}
            <div className="grid grid-cols-3 gap-1.5 sm:flex sm:items-center sm:gap-2 w-full sm:w-auto">
              <button
                id="btn-add-foil"
                onClick={onOpenAddModal}
                className="h-10 px-2 sm:px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold transition-all shadow-xs active:scale-[0.98] cursor-pointer flex items-center justify-center gap-1.5"
              >
                {userMode === 'visitor' ? (
                  <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                ) : (
                  <Plus className="w-4 h-4 text-amber-400 stroke-[2.5] shrink-0" />
                )}
                <span className="whitespace-nowrap">เพิ่มฟอยล์</span>
              </button>

              <button
                id="btn-cut-foil"
                onClick={() => onOpenCutModal('so')}
                title="ตัดสต๊อกฟอยล์ (บันทึก SO หรือตัดไม่ใช้ SO)"
                className="h-10 px-2 sm:px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs sm:text-sm font-bold transition-all shadow-xs active:scale-[0.98] cursor-pointer flex items-center justify-center gap-1.5 border border-amber-600/30"
              >
                {userMode === 'visitor' ? (
                  <Lock className="w-3.5 h-3.5 stroke-[2.5] shrink-0" />
                ) : (
                  <Scissors className="w-4 h-4 stroke-[2.5] shrink-0" />
                )}
                <span className="whitespace-nowrap">ตัดสต็อกฟอยล์</span>
              </button>

              <button
                id="btn-cut-pu-sandwich"
                onClick={onOpenPuSandwichModal}
                title="ตัด SO ไม่ใช้ฟอยล์ ผลิต PU Sandwich"
                className="h-10 px-2 sm:px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold transition-all shadow-xs active:scale-[0.98] cursor-pointer flex items-center justify-center gap-1.5 border border-emerald-700/40"
              >
                {userMode === 'visitor' ? (
                  <Lock className="w-3.5 h-3.5 text-emerald-200 shrink-0" />
                ) : (
                  <Factory className="w-4 h-4 text-emerald-200 stroke-[2.2] shrink-0" />
                )}
                <span className="whitespace-nowrap">ตัด SO แซนวิช</span>
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
              id="tab-sandwich"
              onClick={() => setActiveTab('sandwich')}
              className={`inline-flex items-center gap-2 py-2 px-3.5 rounded-xl font-medium text-xs lg:text-sm transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'sandwich'
                  ? 'bg-white text-slate-950 font-bold shadow-xs border border-slate-200/70'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Factory className="w-4 h-4 text-emerald-600" />
              <span className="lg:hidden">PU แซนวิช</span>
              <span className="hidden lg:inline">ตัด SO แซนวิช (ไม่ใช้ฟอยล์)</span>
              <span className={`text-[11px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                activeTab === 'sandwich' ? 'bg-emerald-100 text-emerald-900' : 'bg-slate-200 text-slate-700'
              }`}>
                {puSandwichCount}
              </span>
            </button>

            <button
              id="tab-flow"
              onClick={() => setActiveTab('flow')}
              className={`inline-flex items-center gap-2 py-2 px-3.5 rounded-xl font-medium text-xs lg:text-sm transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'flow'
                  ? 'bg-white text-slate-950 font-bold shadow-xs border border-slate-200/70'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Workflow className="w-4 h-4 text-amber-600" />
              <span className="lg:hidden">Flow ผลิต</span>
              <span className="hidden lg:inline">Flow Chart ผลการผลิตรายวัน</span>
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                Daily Flow
              </span>
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
