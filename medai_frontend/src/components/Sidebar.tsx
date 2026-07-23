import { LayoutDashboard, Users, Brain, HeartPulse, Settings, HelpCircle, LogOut, Activity, Bell } from "lucide-react";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  user: any;
  onLogout: () => void;
}

export default function Sidebar({ activeTab, setActiveTab, user, onLogout }: SidebarProps) {
  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "patients", label: "Patients", icon: Users },
    { id: "prediction", label: "Drug Prediction", icon: Brain },
    { id: "adr", label: "ADR Analysis", icon: HeartPulse },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "settings", label: "Settings", icon: Settings },
    { id: "help", label: "Help & Support", icon: HelpCircle },
  ];

  return (
    <aside id="app-sidebar" className="w-64 bg-slate-900 text-white flex flex-col justify-between shrink-0 h-screen sticky top-0 border-r border-slate-800">
      {/* Sidebar Header */}
      <div className="p-6">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-sky-500 rounded-lg text-white">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold font-display tracking-tight text-white">MedAI</h1>
            <p className="text-[10px] text-sky-400 font-mono tracking-widest uppercase">Clinical Suite</p>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="mt-8 space-y-1.5">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? "bg-sky-600 text-white shadow-md shadow-sky-600/15"
                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? "text-white" : "text-slate-400 group-hover:text-white"}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Sidebar Footer & User Profile */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/40">
        <div className="flex items-center space-x-3 mb-4 p-2 rounded-lg bg-slate-800/40">
          <div className="w-10 h-10 rounded-full bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center font-bold text-sm">
            {user?.first_name ? user.first_name[0] : user?.username?.[0]?.toUpperCase() || "C"}
          </div>
          <div className="overflow-hidden">
            <h4 className="text-sm font-semibold text-white truncate">
              {user?.first_name ? `${user.first_name} ${user.last_name}` : user?.username}
            </h4>
            <p className="text-[11px] text-slate-400 truncate font-mono uppercase">
              {user?.role || "Clinician"} • {user?.department || "General"}
            </p>
          </div>
        </div>

        <button
          onClick={onLogout}
          className="w-full flex items-center space-x-3 px-4 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 rounded-lg transition-colors cursor-pointer"
        >
          <LogOut className="h-4 w-4" />
          <span>Exit Session</span>
        </button>
      </div>
    </aside>
  );
}
