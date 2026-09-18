import React from 'react';
import { Layers, Plus, Scissors, BarChart3, Package, History, RefreshCw, Download, Wrench, Settings } from 'lucide-react';

interface NavbarProps {
  activeTab: 'dashboard' | 'rolls' | 'history' | 'settings';
  setActiveTab: (tab: 'dashboard' | 'rolls' | 'history' | 'settings') => void;
  onOpenAddModal: () => void;
  onOpenCutModal: (mode?: 'so' | 'non_so') => void;
  totalRemainingMeters: number;
  activeRollsCount: number;
  onResetData: () => void;
  onExportRolls: () => void;
  onExportHistory: () => void;
  hasPermissionNotice?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onOpenAddModal,
  onOpenCutModal,
  totalRemainingMeters,
  activeRollsCount,
  onResetData,
  onExportRolls,
  onExportHistory,
  hasPermissionNotice = false,
}) => {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between py-3 gap-3">
          
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold shadow-xs">
              <Layers className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-900 text-amber-400 tracking-wider uppercase">
                  PU FOAM METALSHEET
                </span>
                <span className="text-xs text-slate-500 hidden sm:inline font-mono">
                  VER 2.5
                </span>
              </div>
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight leading-tight">
                ระบบจัดการสต๊อกและตัดฟอยล์
              </h1>
            </div>
          </div>

          {/* Quick Metrics & Actions */}
          <div className="flex items-center flex-wrap gap-2 sm:gap-3">
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

            {/* Action Buttons */}
            <button
              id="btn-add-foil"
              onClick={onOpenAddModal}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-medium transition-colors shadow-xs active:scale-[0.98] cursor-pointer"
            >
              <Plus className="w-4 h-4 text-amber-400" />
              <span>เพิ่มฟอยล์รับเข้า</span>
            </button>

            <button
              id="btn-cut-foil-so"
              onClick={() => onOpenCutModal('so')}
              title="ตัดสต๊อกตามใบสั่งผลิต SO (soxxyyzzz)"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs sm:text-sm font-bold transition-colors shadow-xs active:scale-[0.98] cursor-pointer"
            >
              <Scissors className="w-4 h-4 stroke-[2.5]" />
              <span>ตัดสต๊อก (มี SO)</span>
            </button>

            <button
              id="btn-cut-foil-non-so"
              onClick={() => onOpenCutModal('non_so')}
              title="ตัดสต๊อกโดยไม่ต้องใส่ใบงาน SO เช่น สาขายืม หรือ ซ่อมฟอยล์พ่นกาว"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 text-xs sm:text-sm font-bold transition-colors shadow-xs active:scale-[0.98] cursor-pointer"
            >
              <Wrench className="w-4 h-4 text-amber-600" />
              <span className="hidden xl:inline">ตัดสต๊อกไม่ใช้ SO (สาขายืม/ซ่อม)</span>
              <span className="xl:hidden">ตัดไม่ใช้ SO</span>
            </button>

            {/* Utility Dropdown / Buttons */}
            <div className="flex items-center gap-1 border-l border-slate-200 pl-2">
              <button
                id="btn-export-options"
                onClick={activeTab === 'history' ? onExportHistory : onExportRolls}
                title="ส่งออก CSV"
                className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                id="btn-reset-data"
                onClick={onResetData}
                title="โหลดข้อมูลตัวอย่างใหม่"
                className="p-2 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                id="btn-nav-settings"
                onClick={() => setActiveTab('settings')}
                title="การตั้งค่า & สำรองข้อมูล"
                className={`p-2 rounded-lg transition-colors cursor-pointer relative ${
                  activeTab === 'settings'
                    ? 'bg-amber-100 text-amber-900'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Settings className="w-4 h-4" />
                {hasPermissionNotice && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-t border-slate-100 mt-1 space-x-1 sm:space-x-4 overflow-x-auto">
          <button
            id="tab-dashboard"
            onClick={() => setActiveTab('dashboard')}
            className={`inline-flex items-center gap-2 py-2.5 px-3 border-b-2 font-medium text-sm transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'dashboard'
                ? 'border-amber-500 text-slate-950 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>แดชบอร์ดสรุปยอดคงเหลือ</span>
          </button>

          <button
            id="tab-rolls"
            onClick={() => setActiveTab('rolls')}
            className={`inline-flex items-center gap-2 py-2.5 px-3 border-b-2 font-medium text-sm transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'rolls'
                ? 'border-amber-500 text-slate-950 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>รายการม้วนฟอยล์ในสต๊อก</span>
            <span className="text-xs px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded-full font-mono">
              {activeRollsCount}
            </span>
          </button>

          <button
            id="tab-history"
            onClick={() => setActiveTab('history')}
            className={`inline-flex items-center gap-2 py-2.5 px-3 border-b-2 font-medium text-sm transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'history'
                ? 'border-amber-500 text-slate-950 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <History className="w-4 h-4" />
            <span>ประวัติการตัดสต๊อก (SO)</span>
          </button>

          <button
            id="tab-settings"
            onClick={() => setActiveTab('settings')}
            className={`inline-flex items-center gap-2 py-2.5 px-3 border-b-2 font-medium text-sm transition-colors whitespace-nowrap cursor-pointer relative ${
              activeTab === 'settings'
                ? 'border-amber-500 text-slate-950 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>ตั้งค่า & สำรองข้อมูล</span>
            {hasPermissionNotice && (
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
