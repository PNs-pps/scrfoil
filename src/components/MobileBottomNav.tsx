import React from 'react';
import { BarChart3, Package, History, Settings, Workflow, Factory } from 'lucide-react';

interface MobileBottomNavProps {
  activeTab: 'dashboard' | 'rolls' | 'history' | 'flow' | 'sandwich' | 'settings';
  setActiveTab: (tab: 'dashboard' | 'rolls' | 'history' | 'flow' | 'sandwich' | 'settings') => void;
  onOpenCutModal?: (mode?: 'so' | 'non_so') => void;
  hasPermissionNotice?: boolean;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  setActiveTab,
  hasPermissionNotice = false,
}) => {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-xl border-t border-slate-200/80 shadow-[0_-4px_20px_rgba(15,23,42,0.06)] px-1 pt-1 pb-[max(0.35rem,env(safe-area-inset-bottom))]">
      <div className="grid grid-cols-6 items-center max-w-lg mx-auto">
        {/* Tab: Dashboard */}
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center justify-center py-1.5 rounded-xl transition-all cursor-pointer ${
            activeTab === 'dashboard'
              ? 'text-amber-600 font-bold bg-amber-50'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <BarChart3 className="w-5 h-5 stroke-[2.2]" />
          <span className="text-[9px] mt-0.5 leading-tight">แดชบอร์ด</span>
        </button>

        {/* Tab: Rolls */}
        <button
          onClick={() => setActiveTab('rolls')}
          className={`flex flex-col items-center justify-center py-1.5 rounded-xl transition-all cursor-pointer ${
            activeTab === 'rolls'
              ? 'text-amber-600 font-bold bg-amber-50'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Package className="w-5 h-5 stroke-[2.2]" />
          <span className="text-[9px] mt-0.5 leading-tight">ม้วนฟอยล์</span>
        </button>

        {/* Tab: PU Sandwich */}
        <button
          onClick={() => setActiveTab('sandwich')}
          className={`flex flex-col items-center justify-center py-1.5 rounded-xl transition-all cursor-pointer ${
            activeTab === 'sandwich'
              ? 'text-emerald-600 font-bold bg-emerald-50'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Factory className="w-5 h-5 stroke-[2.2]" />
          <span className="text-[9px] mt-0.5 leading-tight">แซนวิช</span>
        </button>

        {/* Tab: Flow Chart */}
        <button
          onClick={() => setActiveTab('flow')}
          className={`flex flex-col items-center justify-center py-1.5 rounded-xl transition-all cursor-pointer ${
            activeTab === 'flow'
              ? 'text-amber-600 font-bold bg-amber-50'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Workflow className="w-5 h-5 stroke-[2.2]" />
          <span className="text-[9px] mt-0.5 leading-tight">Flow ผลิต</span>
        </button>

        {/* Tab: History */}
        <button
          onClick={() => setActiveTab('history')}
          className={`flex flex-col items-center justify-center py-1.5 rounded-xl transition-all cursor-pointer ${
            activeTab === 'history'
              ? 'text-amber-600 font-bold bg-amber-50'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <History className="w-5 h-5 stroke-[2.2]" />
          <span className="text-[9px] mt-0.5 leading-tight">ประวัติตัด</span>
        </button>

        {/* Tab: Settings & Backup */}
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex flex-col items-center justify-center py-1.5 rounded-xl transition-all relative cursor-pointer ${
            activeTab === 'settings'
              ? 'text-amber-600 font-bold bg-amber-50'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className="relative">
            <Settings className="w-5 h-5 stroke-[2.2]" />
            {hasPermissionNotice && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            )}
          </div>
          <span className="text-[9px] mt-0.5 leading-tight">ตั้งค่า</span>
        </button>
      </div>
    </nav>
  );
};
