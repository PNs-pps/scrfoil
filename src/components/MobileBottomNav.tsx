import React from 'react';
import { BarChart3, Package, Scissors, History, Settings, Workflow } from 'lucide-react';

interface MobileBottomNavProps {
  activeTab: 'dashboard' | 'rolls' | 'history' | 'flow' | 'settings';
  setActiveTab: (tab: 'dashboard' | 'rolls' | 'history' | 'flow' | 'settings') => void;
  onOpenCutModal: (mode?: 'so' | 'non_so') => void;
  hasPermissionNotice?: boolean;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  setActiveTab,
  onOpenCutModal,
  hasPermissionNotice = false,
}) => {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-lg px-2 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))]">
      <div className="grid grid-cols-6 items-center max-w-lg mx-auto">
        {/* Tab: Dashboard */}
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all cursor-pointer ${
            activeTab === 'dashboard' ? 'text-amber-600 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
          <span className="text-[10px] mt-0.5 leading-tight">แดชบอร์ด</span>
        </button>

        {/* Tab: Rolls */}
        <button
          onClick={() => setActiveTab('rolls')}
          className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all cursor-pointer ${
            activeTab === 'rolls' ? 'text-amber-600 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Package className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
          <span className="text-[10px] mt-0.5 leading-tight">ม้วนฟอยล์</span>
        </button>

        {/* Big Center Action: Cut Stock */}
        <div className="flex justify-center -mt-3">
          <button
            onClick={() => onOpenCutModal('so')}
            title="ตัดสต๊อกด่วน (มี SO)"
            className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-950 flex flex-col items-center justify-center shadow-md active:scale-95 transition-transform border-2 border-white cursor-pointer"
          >
            <Scissors className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
            <span className="text-[8px] sm:text-[9px] font-black -mt-0.5 uppercase tracking-tighter">ตัดสต๊อก</span>
          </button>
        </div>

        {/* Tab: Flow Chart */}
        <button
          onClick={() => setActiveTab('flow')}
          className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all cursor-pointer ${
            activeTab === 'flow' ? 'text-amber-600 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Workflow className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
          <span className="text-[10px] mt-0.5 leading-tight">Flow ผลิต</span>
        </button>

        {/* Tab: History */}
        <button
          onClick={() => setActiveTab('history')}
          className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all cursor-pointer ${
            activeTab === 'history' ? 'text-amber-600 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <History className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
          <span className="text-[10px] mt-0.5 leading-tight">ประวัติตัด</span>
        </button>

        {/* Tab: Settings & Backup */}
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all relative cursor-pointer ${
            activeTab === 'settings' ? 'text-amber-600 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className="relative">
            <Settings className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
            {hasPermissionNotice && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            )}
          </div>
          <span className="text-[10px] mt-0.5 leading-tight">ตั้งค่า</span>
        </button>
      </div>
    </nav>
  );
};
