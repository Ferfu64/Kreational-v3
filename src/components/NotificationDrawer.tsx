import React, { useState, useEffect } from 'react';
import { UserNotification } from '../types';
import { getStoredNotifications, saveStoredNotifications } from './NotificationToastContainer';
import { X, Bell, Trash2, CheckCheck, ShieldAlert, Award, Sparkles, Clock } from 'lucide-react';
import { SFX } from '../utils/sfx';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onClearUnreadBadge?: () => void;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  isOpen,
  onClose,
  onClearUnreadBadge,
}) => {
  const [notifications, setNotifications] = useState<UserNotification[]>([]);

  useEffect(() => {
    if (isOpen) {
      const list = getStoredNotifications();
      setNotifications(list);
      // Mark as read
      const updated = list.map((n) => ({ ...n, read: true }));
      saveStoredNotifications(updated);
      if (onClearUnreadBadge) onClearUnreadBadge();
    }
  }, [isOpen]);

  const handleClearAll = () => {
    SFX.playClick();
    saveStoredNotifications([]);
    setNotifications([]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-slate-950 border-l border-white/10 h-full flex flex-col justify-between shadow-2xl animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white uppercase font-mono tracking-tight">
                Notifications Hub
              </h3>
              <p className="text-xs text-slate-400">Activity alerts & marketplace notifications</p>
            </div>
          </div>

          <button
            onClick={() => {
              SFX.playClick();
              onClose();
            }}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {notifications.length === 0 ? (
            <div className="text-center py-16 space-y-3">
              <Bell className="w-12 h-12 text-slate-700 mx-auto" />
              <p className="text-slate-400 text-sm font-semibold">No notifications yet!</p>
              <p className="text-xs text-slate-600 max-w-xs mx-auto">
                Bids, auction wins, outbid alerts, and Krate unboxings will appear here in real time.
              </p>
            </div>
          ) : (
            notifications.map((item) => {
              const isOutbid = item.type === 'outbid';
              const isWin = item.type === 'auction_win';
              const isKrate = item.type === 'krate_unboxed';

              return (
                <div
                  key={item.id}
                  className={`p-4 rounded-2xl border transition-all flex items-start gap-3 ${
                    isOutbid
                      ? 'bg-rose-950/30 border-rose-500/40 text-rose-100'
                      : isWin
                      ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-100'
                      : isKrate
                      ? 'bg-purple-950/30 border-purple-500/40 text-purple-100'
                      : 'bg-slate-900/60 border-slate-800 text-slate-200'
                  }`}
                >
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
                      <ShieldAlert className="w-4 h-4" />
                    ) : isWin ? (
                      <Award className="w-4 h-4" />
                    ) : isKrate ? (
                      <Sparkles className="w-4 h-4" />
                    ) : (
                      <Bell className="w-4 h-4" />
                    )}
                  </div>

                  <div className="flex-1 space-y-1 min-w-0">
                    <h4 className="font-bold text-xs uppercase font-mono tracking-wider">
                      {item.title}
                    </h4>
                    <p className="text-xs text-slate-300 leading-snug">{item.message}</p>
                    <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1 pt-0.5">
                      <Clock className="w-3 h-3" />
                      <span>{new Date(item.timestamp).toLocaleTimeString()}</span>
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="p-4 border-t border-white/10 bg-slate-900/80 flex items-center justify-between">
            <button
              onClick={handleClearAll}
              className="px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>Clear History</span>
            </button>

            <span className="text-xs text-slate-400 font-mono">
              {notifications.length} Alerts
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
