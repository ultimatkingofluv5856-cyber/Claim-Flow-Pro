import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import {
  BarChart3, FileUp, History, ArrowLeftRight, Scale, UserCheck, ShieldCheck,
  Receipt, Users, Settings, Menu, LogOut, ChevronLeft, Shield, UserCircle
} from 'lucide-react';

interface SidebarProps {
  activeView: string;
  onNavigate: (view: string) => void;
}

const navItems = [
  { id: 'dashboard', icon: BarChart3, label: 'Dashboard', roles: ['all'] },
  { id: 'submit', icon: FileUp, label: 'Submit Claim', roles: ['all'] },
  { id: 'history', icon: History, label: 'Claim History', roles: ['all'] },
  { id: 'transactions', icon: ArrowLeftRight, label: 'Transactions', roles: ['all'] },
  { id: 'balances', icon: Scale, label: 'User Balances', roles: ['all'] },
  { id: 'manager-approval', icon: UserCheck, label: 'Manager Approval', roles: ['Manager', 'Super Admin'] },
  { id: 'admin-approval', icon: ShieldCheck, label: 'Admin Approval', roles: ['Admin', 'Super Admin'] },
  { id: 'voucher', icon: Receipt, label: 'Payment Voucher', roles: ['Admin', 'Super Admin'] },
  { id: 'users', icon: Users, label: 'User Management', roles: ['Admin', 'Super Admin'] },
  { id: 'audit', icon: Shield, label: 'Audit Trail', roles: ['Admin', 'Super Admin'] },
  { id: 'settings', icon: Settings, label: 'Settings', roles: ['Admin', 'Super Admin'] },
  { id: 'profile', icon: UserCircle, label: 'My Profile', roles: ['all'] },
];

export default function AppSidebar({ activeView, onNavigate }: SidebarProps) {
  const { user, logout } = useAuth();
  const [expanded, setExpanded] = useState(false);

  const filteredItems = navItems.filter(item => {
    if (item.roles.includes('all')) return true;
    return item.roles.includes(user?.role || '');
  });

  // Desktop-only sidebar (mobile uses MobileBottomNav)
  return (
    <>
      <button
        onClick={() => setExpanded(!expanded)}
        className="fixed top-4 left-4 z-50 gradient-primary text-primary-foreground rounded-full w-10 h-10 lg:w-12 lg:h-12 flex items-center justify-center shadow-lg transition-all duration-300 hover:scale-110"
      >
        {expanded ? <ChevronLeft className="h-4 w-4 lg:h-5 lg:w-5" /> : <Menu className="h-4 w-4 lg:h-5 lg:w-5" />}
      </button>

      <aside className={cn(
        "fixed top-0 left-0 h-full gradient-primary shadow-xl z-40 transition-all duration-300 overflow-y-auto pt-16 lg:pt-20",
        expanded ? "w-[240px] lg:w-[280px]" : "w-[70px]"
      )}>
        <nav className="flex flex-col">
          {filteredItems.map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => { onNavigate(item.id); setExpanded(false); }}
                className={cn("sidebar-nav-btn", activeView === item.id && "active")}
              >
                <Icon className="h-5 w-5 min-w-[20px] mr-4" />
                <span className={cn("transition-opacity duration-300 whitespace-nowrap", expanded ? "opacity-100" : "opacity-0 pointer-events-none")}>
                  {item.label}
                </span>
              </button>
            );
          })}
          <button onClick={logout} className="sidebar-nav-btn mt-4 border-t border-white/20 pt-4">
            <LogOut className="h-5 w-5 min-w-[20px] mr-4" />
            <span className={cn("transition-opacity duration-300", expanded ? "opacity-100" : "opacity-0 pointer-events-none")}>
              Logout
            </span>
          </button>
        </nav>
      </aside>

      {expanded && (
        <div className="fixed inset-0 bg-black/20 z-30" onClick={() => setExpanded(false)} />
      )}
    </>
  );
}
