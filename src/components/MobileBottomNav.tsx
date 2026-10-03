import React from 'react';
import { BarChart3, Package, History, Settings, CalendarDays, Factory } from 'lucide-react';

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
  const tabs = [
    { id: 'dashboard' as const, label: 'แดชบอร์ด', icon: BarChart3 },
    { id: 'flow' as const, label: 'ผลิตรายวัน', icon: CalendarDays },
    { id: 'rolls' as const, label: 'ม้วนฟอยล์', icon: Package },
    { id: 'sandwich' as const, label: 'แซนวิช', icon: Factory, activeColor: 'text-emerald-600', activeBg: 'bg-emerald-50' },
    { id: 'history' as const, label: 'ประวัติตัด', icon: History },
    { id: 'settings' as const, label: 'ตั้งค่า', icon: Settings },
  ];

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-t border-slate-200/80 shadow-[0_-4px_20px_rgba(15,23,42,0.06)] px-1 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
      aria-label="เมนูหลัก"
    >
      <div className="grid grid-cols-6 items-stretch max-w-lg mx-auto gap-0.5">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          const activeText = tab.activeColor || 'text-amber-600';
          const activeBg = tab.activeBg || 'bg-amber-50';

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              aria-current={isActive ? 'page' : undefined}
              aria-label={tab.label}
              className={`flex flex-col items-center justify-center min-h-[52px] py-2 px-0.5 rounded-xl transition-all cursor-pointer ${
                isActive
                  ? `${activeText} font-bold ${activeBg}`
                  : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              <div className="relative">
                <Icon className="w-6 h-6 stroke-[2.2]" aria-hidden="true" />
                {tab.id === 'settings' && hasPermissionNotice && (
                  <span
                    className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-rose-500"
                    aria-label="มีแจ้งเตือน"
                  />
                )}
              </div>
              <span className="text-[10px] sm:text-[11px] mt-0.5 leading-tight font-medium">
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
