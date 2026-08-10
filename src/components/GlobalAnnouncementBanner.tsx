import React, { useState, useEffect } from 'react';
import { Megaphone, X, Sparkles } from 'lucide-react';
import { db } from '../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { GlobalAnnouncement } from './KreatorFunPanel';

export const GlobalAnnouncementBanner: React.FC = () => {
  const [announcement, setAnnouncement] = useState<GlobalAnnouncement | null>(() => {
    try {
      const stored = localStorage.getItem('kreational_global_announcement');
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      return null;
    }
  });

  const [dismissedId, setDismissedId] = useState<string | null>(null);

  useEffect(() => {
    // Listen to real-time updates from Firestore
    const unsub = onSnapshot(doc(db, 'global_announcements', 'latest'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as GlobalAnnouncement;
        setAnnouncement(data);
        localStorage.setItem('kreational_global_announcement', JSON.stringify(data));
      } else {
        setAnnouncement(null);
        localStorage.removeItem('kreational_global_announcement');
      }
    });

    const handleLocalUpdate = () => {
      try {
        const stored = localStorage.getItem('kreational_global_announcement');
        setAnnouncement(stored ? JSON.parse(stored) : null);
      } catch (e) {}
    };

    window.addEventListener('announcement_updated', handleLocalUpdate);

    return () => {
      unsub();
      window.removeEventListener('announcement_updated', handleLocalUpdate);
    };
  }, []);

  if (!announcement || announcement.id === dismissedId) return null;

  return (
    <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-purple-950 text-white border-b border-purple-400/30 px-4 py-2 shadow-lg relative z-40 animate-fadeIn flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 max-w-7xl mx-auto flex-1 overflow-hidden">
        <div className="p-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-400/40 shrink-0 animate-bounce">
          <Megaphone className="w-4 h-4" />
        </div>
        <div className="flex items-center gap-2 overflow-hidden text-xs sm:text-sm font-semibold">
          <span className="px-2 py-0.5 rounded-full bg-purple-500/30 text-purple-200 border border-purple-400/40 text-[10px] font-mono uppercase shrink-0">
            {announcement.sender || 'Kreator'}
          </span>
          <span className="truncate text-amber-200 font-bold">{announcement.message}</span>
        </div>
      </div>

      <button
        onClick={() => setDismissedId(announcement.id)}
        className="p-1 rounded-lg hover:bg-white/10 text-white/70 hover:text-white shrink-0 cursor-pointer"
        title="Dismiss announcement"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
