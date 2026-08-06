import React, { useEffect } from 'react';
import { User, Tier, Game, GameRequest } from '../types';
import { fetchAllRequestsStore } from '../services/firestoreStore';
import { safeGet, safeSet } from '../utils/persistentStorage';

interface ApprovalNotificationsProps {
  user: User | null;
  tiers: Tier[];
  games: Game[];
  onSelectTier: (tierId: string) => void;
  onPlayGame: (game: Game) => void;
}

const STORAGE_KEY_NOTIFIED = 'kreational_notified_approvals_v3';

export const ApprovalNotifications: React.FC<ApprovalNotificationsProps> = ({
  user,
  tiers,
  games,
}) => {
  useEffect(() => {
    if (!user) return;

    // Ask for native OS / iOS notification permission silently if supported
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      try {
        Notification.requestPermission().catch(() => {});
      } catch (e) {}
    }

    let isMounted = true;

    const checkApprovals = async () => {
      try {
        const rawNotified = safeGet(STORAGE_KEY_NOTIFIED);
        const notifiedSet = new Set<string>(rawNotified ? JSON.parse(rawNotified) : []);

        const allRequests = await fetchAllRequestsStore();
        if (!isMounted) return;

        // Filter ONLY ACCEPTED / APPROVED requests for current logged-in user
        const acceptedRequests = allRequests.filter(
          (r: GameRequest) =>
            r.status === 'accepted' &&
            (r.userId === user.id || r.username.toLowerCase() === user.username.toLowerCase())
        );

        let newlyApprovedCount = 0;

        for (const req of acceptedRequests) {
          const reqKey = `req_${req.id}_${req.resolvedAt || req.createdAt}`;
          if (!notifiedSet.has(reqKey) && !notifiedSet.has(req.id)) {
            notifiedSet.add(reqKey);
            notifiedSet.add(req.id);
            newlyApprovedCount++;

            let displayTitle = req.targetTitle || req.targetId;
            if (req.type === 'tier' && req.tierId) {
              const matchedTier = tiers.find((t) => t.id === req.tierId);
              if (matchedTier) displayTitle = `${matchedTier.name} Tier`;
            } else if (req.type === 'single_game' && req.targetId) {
              const matchedGame = games.find((g) => g.id === req.targetId);
              if (matchedGame) displayTitle = matchedGame.title;
            }

            // Send native system / iOS push notification if supported & permitted
            if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
              try {
                new Notification('Kreational Access Approved! 🎉', {
                  body: `Your access for ${displayTitle} has been granted by Kreator!`,
                  icon: '/icon.png',
                });
              } catch (e) {
                // Ignore notification errors
              }
            }
          }
        }

        if (newlyApprovedCount > 0) {
          safeSet(STORAGE_KEY_NOTIFIED, JSON.stringify(Array.from(notifiedSet)));
        }
      } catch (err) {
        console.warn('[ApprovalNotifications] Error checking request approvals:', err);
      }
    };

    checkApprovals();
    const interval = setInterval(checkApprovals, 5000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [user, tiers, games]);

  // Pure headless component (no in-app notification bell or toast banners rendered on screen per user instructions)
  return null;
};
