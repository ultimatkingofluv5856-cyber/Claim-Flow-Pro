import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '@/lib/claims-api';
import { Bell, Check, CheckCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function NotificationBell() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const unreadCount = notifications.filter(n => !n.is_read).length;

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const data = await getNotifications(user.email);
      setNotifications(data);
    } catch (e) { console.error(e); }
  }, [user]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000); // poll every 30s
    return () => clearInterval(interval);
  }, [load]);

  const handleMarkRead = async (id: string) => {
    await markNotificationRead(id);
    load();
  };

  const handleMarkAllRead = async () => {
    if (!user) return;
    await markAllNotificationsRead(user.email);
    load();
  };

  const typeColor = (type: string) => {
    switch (type) {
      case 'success': return 'bg-green-500';
      case 'warning': return 'bg-yellow-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-blue-500';
    }
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    const diffDays = Math.floor(diffHrs / 24);
    return `${diffDays}d ago`;
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-full hover:bg-muted transition-colors"
      >
        <Bell className="h-5 w-5 text-muted-foreground" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-80 max-h-96 bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden">
            <div className="flex items-center justify-between p-3 border-b border-border">
              <h3 className="font-semibold text-sm text-foreground">Notifications</h3>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleMarkAllRead}>
                    <CheckCheck className="h-3 w-3 mr-1" /> Mark all read
                  </Button>
                )}
                <button onClick={() => setOpen(false)} className="p-1 hover:bg-muted rounded">
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            </div>
            <div className="overflow-y-auto max-h-[320px]">
              {notifications.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground text-sm">No notifications</div>
              ) : (
                notifications.map(n => (
                  <div
                    key={n.id}
                    className={cn(
                      "p-3 border-b border-border last:border-0 transition-colors cursor-pointer hover:bg-muted/50",
                      !n.is_read && "bg-primary/5"
                    )}
                    onClick={() => !n.is_read && handleMarkRead(n.id)}
                  >
                    <div className="flex items-start gap-2">
                      <div className={cn("w-2 h-2 rounded-full mt-1.5 shrink-0", typeColor(n.type))} />
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-sm", !n.is_read ? "font-semibold text-foreground" : "text-muted-foreground")}>{n.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">{formatTime(n.created_at)}</p>
                      </div>
                      {!n.is_read && (
                        <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
