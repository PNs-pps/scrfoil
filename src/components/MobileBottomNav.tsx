import React from 'react';
import { BarChart3, Package, History, Settings } from 'lucide-react';

interface MobileBottomNavProps {
  activeTab: 'dashboard' | 'rolls' | 'history' | 'settings';
  setActiveTab: (tab: 'dashboard' | 'rolls' | 'history' | 'settings') => void;
  onOpenCutModal?: (mode?: 'so' | 'non_so') => void;
  hasPermissionNotice?: boolean;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  setActiveTab,
  hasPermissionNotice = false,
}) => {
  const tabs = [
    { id: 'dashboard' as const, label: 'แดชบอร์ด', icon: BarChart3 },
    { id: 'rolls' as const, label: 'ม้วนฟอยล์', icon: Package },
    { id: 'history' as const, label: 'ประวัติตัด', icon: History },
    { id: 'settings' as const, label: 'ตั้งค่า', icon: Settings },
  ];

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-t border-slate-200/80 shadow-[0_-4px_20px_rgba(15,23,42,0.06)] px-1.5 pt-1 pb-[max(0.4rem,env(safe-area-inset-bottom))] print:hidden"
      aria-label="เมนูหลัก"
    >
      <div className="grid grid-cols-4 items-stretch max-w-md mx-auto gap-0.5">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              aria-current={isActive ? 'page' : undefined}
              aria-label={tab.label}
              className={`flex flex-col items-center justify-center min-h-[44px] py-1 px-0.5 rounded-lg transition-all duration-200 cursor-pointer active:scale-95 ${
                isActive
                  ? 'text-amber-700 font-bold bg-amber-50/80'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <div className="relative">
                <Icon
                  className={`w-4.5 h-4.5 ${isActive ? 'stroke-[2.4] text-amber-600' : 'stroke-[2]'}`}
                  aria-hidden="true"
                />
                {tab.id === 'settings' && hasPermissionNotice && (
                  <span
                    className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white"
                    aria-label="มีแจ้งเตือน"
                  />
                )}
              </div>
              <span className="text-[10px] mt-0.5 leading-tight font-medium">
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
