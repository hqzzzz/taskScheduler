import React from 'react';
import { 
  LayoutDashboard, 
  FileText, 
  FileCode, 
  Link2, 
  Settings, 
  LogOut,
  Clock,
  ChevronRight,
  RefreshCw
} from 'lucide-react';

import { cn } from '../lib/utils';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: any) => void;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, onLogout }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'logs', label: 'Execution Logs', icon: FileText },
    { id: 'editor', label: 'File Editor', icon: FileCode },
    { id: 'hardlink', label: 'Hard Linker', icon: Link2 },
    { id: 'transfer', label: 'File Transfer', icon: RefreshCw },
  ];

  return (
    <aside className="w-64 bg-[#1e1e1e] text-gray-400 flex flex-col shrink-0">
      <div className="p-6">
        <div className="flex items-center gap-3 text-emerald-500 mb-10">
          <div className="p-2 bg-emerald-500/10 rounded-lg">
            <Clock className="w-6 h-6" />
          </div>
          <h1 className="font-bold text-xl text-white tracking-tight">TaskScheduler</h1>
        </div>

        <div className="space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-600 mb-4 px-4">Explorer</p>
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all group",
                activeTab === item.id 
                  ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" 
                  : "hover:bg-white/5 hover:text-white"
              )}
            >
              <item.icon className={cn(
                "w-4 h-4 transition-colors",
                activeTab === item.id ? "text-emerald-500" : "text-gray-500 group-hover:text-gray-300"
              )} />
              {item.label}
              {activeTab === item.id && <ChevronRight className="w-3 h-3 ml-auto opacity-50" />}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-auto p-6 border-t border-white/5 space-y-4">
        <div className="bg-white/5 rounded-xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-600 mb-2">System Status</p>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-xs font-medium text-gray-300">Scheduler Online</span>
          </div>
        </div>

        <button 
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-rose-400 hover:bg-rose-500/10 transition-all"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );
};
