import React from 'react';
import { Layers, Plus, Scissors, BarChart3, Package, History, Download, Settings } from 'lucide-react';

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
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold shadow-xs shrink-0">
              <Layers className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-900 text-amber-400 tracking-wider">
                  หลังคาเย็นสยาม (ร่มเกล้า)
                </span>
                <span className="text-xs text-slate-500 hidden sm:inline font-mono">
                  คลังฟอยล์ PU FOAM
                </span>
              </div>
              <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight leading-tight mt-0.5">
                หลังคาเย็นสยาม (ร่มเกล้า)
              </h1>
              <p className="text-xs text-slate-500 hidden md:block">
                ระบบจัดการสต๊อกฟอยล์และบันทึกใบสั่งผลิตตัดฟอยล์
              </p>
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
              id="btn-cut-foil"
              onClick={() => onOpenCutModal('so')}
              title="ตัดสต๊อกฟอยล์ (บันทึก SO หรือตัดไม่ใช้ SO)"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs sm:text-sm font-bold transition-colors shadow-xs active:scale-[0.98] cursor-pointer"
            >
              <Scissors className="w-4 h-4 stroke-[2.5]" />
              <span>ตัดสต็อกฟอยล์</span>
            </button>

            {/* Utility / Export Button */}
            <div className="flex items-center gap-1 border-l border-slate-200 pl-2">
              <button
                id="btn-export-options"
                onClick={activeTab === 'history' ? onExportHistory : onExportRolls}
                title="ส่งออกข้อมูล CSV"
                className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4" />
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
