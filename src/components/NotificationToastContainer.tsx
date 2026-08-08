import React, { useEffect, useState } from 'react';
import { UserNotification } from '../types';
import { Bell, X, Sparkles, AlertCircle, Award, CheckCircle2, ShoppingBag, ShieldAlert } from 'lucide-react';
import { SFX } from '../utils/sfx';

export function getStoredNotifications(): UserNotification[] {
  try {
    const raw = localStorage.getItem('kreational_user_notifications');
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function saveStoredNotifications(list: UserNotification[]) {
  try {
    localStorage.setItem('kreational_user_notifications', JSON.stringify(list.slice(0, 50)));
  } catch (e) {
    console.warn('Failed to save notifications:', e);
  }
}

interface ToastItem extends UserNotification {
  id: string;
}

export const NotificationToastContainer: React.FC = () => {
  const [activeToasts, setActiveToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const handleCustomNotification = (event: Event) => {
      const customEv = event as CustomEvent;
      const detail = customEv.detail || {};

      const title: string = detail.title || 'Notification';
      const message: string = detail.message || '';
      const timestamp: number = detail.timestamp || Date.now();

      let type: UserNotification['type'] = 'system';
      if (title.toLowerCase().includes('outbid')) type = 'outbid';
      else if (title.toLowerCase().includes('won') || title.toLowerCase().includes('bid')) type = 'auction_win';
      else if (title.toLowerCase().includes('krest') || title.toLowerCase().includes('coin')) type = 'krests_gained';
      else if (title.toLowerCase().includes('krate') || title.toLowerCase().includes('opened')) type = 'krate_unboxed';

      const newNotif: UserNotification = {
        id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        title,
        message,
        type,
        read: false,
        createdAt: timestamp,
      };

      // Save to localStorage history
      const existing = getStoredNotifications();
      saveStoredNotifications([newNotif, ...existing]);

      // Play SFX
      if (type === 'outbid') SFX.playError();
      else if (type === 'auction_win' || type === 'krate_unboxed') SFX.playPurchase();
      else SFX.playCoin();

      // Push to active toast view
      const toastItem: ToastItem = { ...newNotif };
      setActiveToasts((prev) => [toastItem, ...prev.slice(0, 4)]);

      // Auto dismiss toast after 5s
      setTimeout(() => {
        setActiveToasts((prev) => prev.filter((t) => t.id !== toastItem.id));
      }, 5500);
    };

    window.addEventListener('kreational-notification', handleCustomNotification);
    return () => window.removeEventListener('kreational-notification', handleCustomNotification);
  }, []);

  const dismissToast = (id: string) => {
    SFX.playClick();
    setActiveToasts((prev) => prev.filter((t) => t.id !== id));
  };

  if (activeToasts.length === 0) return null;

  return (
    <div className="fixed top-20 right-4 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
      {activeToasts.map((toast) => {
        const isOutbid = toast.type === 'outbid';
        const isWin = toast.type === 'auction_win';
        const isKrate = toast.type === 'krate_unboxed';

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto p-4 rounded-2xl border shadow-2xl backdrop-blur-xl transition-all duration-300 animate-in slide-in-from-right-8 flex items-start justify-between gap-3 ${
              isOutbid
                ? 'bg-rose-950/90 border-rose-500/60 text-rose-100 shadow-rose-950/80'
                : isWin
                ? 'bg-emerald-950/90 border-emerald-500/60 text-emerald-100 shadow-emerald-950/80'
                : isKrate
                ? 'bg-purple-950/90 border-purple-500/60 text-purple-100 shadow-purple-950/80'
                : 'bg-slate-900/95 border-amber-500/50 text-slate-100 shadow-amber-950/60'
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`p-2 rounded-xl shrink-0 ${
                  isOutbid
                    ? 'bg-rose-500/20 text-rose-400'
                    : isWin
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : isKrate
                    ? 'bg-purple-500/20 text-purple-400'
                    : 'bg-amber-500/20 text-amber-400'
                }`}
              >
                {isOutbid ? (
                  <ShieldAlert className="w-5 h-5 animate-pulse" />
                ) : isWin ? (
                  <Award className="w-5 h-5 animate-bounce" />
                ) : isKrate ? (
                  <Sparkles className="w-5 h-5 animate-spin" />
                ) : (
                  <Bell className="w-5 h-5" />
                )}
              </div>

              <div className="space-y-0.5">
                <h4 className="font-extrabold text-xs uppercase tracking-wider font-mono">
                  {toast.title}
                </h4>
                <p className="text-xs opacity-90 leading-snug">{toast.message}</p>
                <span className="text-[10px] opacity-60 font-mono block pt-1">
                  {new Date(toast.timestamp).toLocaleTimeString()}
                </span>
              </div>
            </div>

            <button
              onClick={() => dismissToast(toast.id)}
              className="p-1 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-all cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
