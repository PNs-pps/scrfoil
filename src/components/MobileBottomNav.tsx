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
  const item = (tab: typeof activeTab, label: string, Icon: React.ElementType) => {
    const active = activeTab === tab;
    return (
      <button
        onClick={() => setActiveTab(tab)}
        className={`flex flex-col items-center justify-center py-2 rounded-md transition-colors cursor-pointer ${
          active ? 'text-slate-900 font-semibold' : 'text-slate-400 hover:text-slate-700 font-medium'
        }`}
      >
        <Icon className={`w-5 h-5 ${active ? 'stroke-[2]' : 'stroke-[1.5]'}`} />
        <span className="text-[10px] mt-1 leading-tight tracking-tight">{label}</span>
      </button>
    );
  };

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 px-1 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <div className="grid grid-cols-6 items-center max-w-lg mx-auto">
        {item('dashboard', 'แดชบอร์ด', BarChart3)}
        {item('flow', 'ผลิตรายวัน', CalendarDays)}
        {item('rolls', 'ม้วนฟอยล์', Package)}
        {item('sandwich', 'แซนวิช', Factory)}
        {item('history', 'ประวัติตัด', History)}
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex flex-col items-center justify-center py-2 rounded-md transition-colors relative cursor-pointer ${
            activeTab === 'settings'
              ? 'text-slate-900 font-semibold'
              : 'text-slate-400 hover:text-slate-700 font-medium'
          }`}
        >
          <div className="relative">
            <Settings
              className={`w-5 h-5 ${
                activeTab === 'settings' ? 'stroke-[2]' : 'stroke-[1.5]'
              }`}
            />
            {hasPermissionNotice && (
              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-slate-900" />
            )}
          </div>
          <span className="text-[10px] mt-1 leading-tight tracking-tight">ตั้งค่า</span>
        </button>
      </div>
    </nav>
  );
};
