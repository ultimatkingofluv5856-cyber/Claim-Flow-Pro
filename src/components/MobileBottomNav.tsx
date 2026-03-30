import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import {
  BarChart3, History, UserCheck, ShieldCheck, Users, Menu, UserCircle, Plus, ArrowLeftRight, Scale, Receipt, Settings, Shield, LogOut, FileUp,
} from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface MobileBottomNavProps {
  activeView: string;
  onNavigate: (view: string) => void;
}

const sideNavItems = [
  { id: 'dashboard', icon: BarChart3, label: 'Home', roles: ['all'] },
  { id: 'history', icon: History, label: 'History', roles: ['all'] },
  { id: 'profile', icon: UserCircle, label: 'Profile', roles: ['all'] },
];

const allNavItems = [
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

export default function MobileBottomNav({ activeView, onNavigate }: MobileBottomNavProps) {
  const { user, logout } = useAuth();
  const [sheetOpen, setSheetOpen] = useState(false);

  const filteredAllItems = allNavItems.filter((item) => {
    if (item.roles.includes('all')) return true;
    return item.roles.includes(user?.role || '');
  });

  const handleNavigate = (view: string) => {
    onNavigate(view);
    setSheetOpen(false);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 px-2 pb-[env(safe-area-inset-bottom,0px)] pt-2 backdrop-blur-xl shadow-lg md:hidden">
      <div className="relative flex h-20 select-none items-end justify-around">
        {sideNavItems.slice(0, 2).map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={cn(
                'flex h-14 flex-1 flex-col items-center justify-center py-1 transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className={cn('h-5 w-5', isActive && 'text-primary')} />
              <span className="mt-1 text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}

        <div className="flex flex-1 items-end justify-center">
          <button
            onClick={() => onNavigate('submit')}
            className="flex h-16 w-16 -translate-y-4 items-center justify-center rounded-full border-4 border-background bg-primary text-primary-foreground shadow-xl transition-transform hover:scale-[1.02] active:scale-[0.98]"
            aria-label="Submit Claim"
          >
            <Plus className="h-7 w-7" />
          </button>
        </div>

        {sideNavItems.slice(2).map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={cn(
                'flex h-14 flex-1 flex-col items-center justify-center py-1 transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className={cn('h-5 w-5', isActive && 'text-primary')} />
              <span className="mt-1 text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}

        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <button className="flex h-14 flex-1 flex-col items-center justify-center py-1 text-muted-foreground transition-colors hover:text-foreground">
              <Menu className="h-5 w-5" />
              <span className="mt-1 text-[10px] font-medium">More</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[82vh] rounded-t-2xl pb-[env(safe-area-inset-bottom,0px)]">
            <SheetHeader className="border-b border-border pb-4">
              <SheetTitle className="text-left">Menu</SheetTitle>
            </SheetHeader>
            <div className="max-h-[calc(82vh-132px)] overflow-y-auto py-4">
              <div className="grid grid-cols-3 gap-3">
                {filteredAllItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeView === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNavigate(item.id)}
                      className={cn(
                        'flex min-h-[96px] flex-col items-center justify-center rounded-xl p-4 transition-colors',
                        isActive
                          ? 'border border-primary/20 bg-primary/10 text-primary'
                          : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground',
                      )}
                    >
                      <Icon className="mb-2 h-6 w-6" />
                      <span className="text-center text-xs font-medium leading-tight">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 border-t border-border bg-card p-4">
              <Button
                variant="destructive"
                className="w-full"
                onClick={() => { logout(); setSheetOpen(false); }}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
