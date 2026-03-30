import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import NotificationBell from '@/components/NotificationBell';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { getCompanySettings } from '@/lib/claims-api';

export default function AppHeader() {
  const { user, logout } = useAuth();
  const [brand, setBrand] = useState({ name: 'ClaimFlow Pro', subtitle: 'Claims Management System', logo: '/ipi-logo.jpg' });

  useEffect(() => {
    getCompanySettings()
      .then((settings) => {
        if (!settings) return;
        setBrand({
          name: settings.company_name || 'ClaimFlow Pro',
          subtitle: settings.company_subtitle || 'Claims Management System',
          logo: settings.logo_url || '/ipi-logo.jpg',
        });
      })
      .catch(() => {});
  }, []);

  return (
    <header className="glass-card sticky top-0 z-40 mx-3 mb-4 mt-[env(safe-area-inset-top,12px)] flex select-none items-center justify-between bg-card/95 px-3 py-3 backdrop-blur-md sm:mx-4 sm:mb-6 sm:mt-4 sm:px-6 sm:py-4">
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
        <img
          src={brand.logo}
          alt={brand.name}
          className="h-10 w-10 flex-shrink-0 rounded-md border border-border bg-white p-1 object-contain"
        />
        <div className="min-w-0">
          <h1 className="truncate text-sm font-bold text-foreground sm:text-lg">{brand.name}</h1>
          <p className="truncate text-xs text-muted-foreground sm:text-sm">
            <span className="font-medium text-foreground">{user?.name}</span>
            <span className="hidden md:inline"> | {brand.subtitle}</span>
            <span className="hidden sm:inline"> ({user?.role})</span>
          </p>
        </div>
      </div>
      <div className="flex flex-shrink-0 items-center gap-1 sm:gap-3">
        <NotificationBell />
        <div className="hidden items-center gap-2 sm:flex">
          <Avatar className="h-8 w-8 border border-border">
            {user?.profile_picture_url ? (
              <AvatarImage src={user.profile_picture_url} alt={user.name} />
            ) : (
              <AvatarFallback className="bg-primary/10 text-xs text-primary">
                {user?.name?.charAt(0)?.toUpperCase() || '?'}
              </AvatarFallback>
            )}
          </Avatar>
          <span className="hidden text-sm font-medium text-foreground lg:inline">{user?.name}</span>
        </div>
        <Button variant="outline" size="sm" onClick={logout} className="px-2 sm:px-3">
          <LogOut className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Logout</span>
        </Button>
      </div>
    </header>
  );
}
