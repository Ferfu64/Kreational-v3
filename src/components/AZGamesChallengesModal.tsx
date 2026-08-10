import React, { useState } from 'react';
import { User, TemporaryAccess } from '../types';
import {
  Sparkles,
  Award,
  CheckCircle2,
  Lock,
  Clock,
  Zap,
  Gamepad2,
  Users,
  Shield,
  Gift,
  Flame,
  Star,
  Search,
  Key,
  X,
  MessageSquare,
  PhoneCall,
  Gavel,
  Store,
} from 'lucide-react';
import { SFX } from '../utils/sfx';
import { saveFullUserAccountToFirestore } from '../services/firestoreStore';
import { safeSet } from '../utils/persistentStorage';
import { getActivePromoCodes, PromoCode } from '../services/promoCodeService';

interface AZGamesChallengesModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  onUpdateUser: (updatedUser: User) => void;
}

export interface AZChallenge {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: 'arcade' | 'kroze' | 'social' | 'economy' | 'special';
  rewardHours: number;
  checkUnlocked: (user: User) => boolean;
}

export const AZ_CHALLENGES: AZChallenge[] = [
  {
    id: 'streak_3d',
    title: '1. 3-Day Streak Master',
    description: 'Maintain a 3-day daily login streak.',
    icon: '🔥',
    category: 'arcade',
    rewardHours: 1,
    checkUnlocked: (u) => (u.dailyStreak || 1) >= 3,
  },
  {
    id: 'explore_5g',
    title: '2. Arcade Explorer',
    description: 'Play 5 unique games in the Arcade.',
    icon: '🎮',
    category: 'arcade',
    rewardHours: 1,
    checkUnlocked: (u) => (u.playHistory || []).length >= 5,
  },
  {
    id: 'krest_500',
    title: '3. High Roller Balance',
    description: 'Accumulate a balance of over 500 Krests.',
    icon: '🪙',
    category: 'economy',
    rewardHours: 2,
    checkUnlocked: (u) => (u.krests || 0) >= 500,
  },
  {
    id: 'unbox_rare',
    title: '4. Legendary Krate Opener',
    description: 'Unbox any Krate in the Shop.',
    icon: '🎁',
    category: 'economy',
    rewardHours: 1.5,
    checkUnlocked: (u) => (u.inventory || []).length > 0,
  },
  {
    id: 'kroze_friend',
    title: '5. Kroze Friend Link',
    description: 'Add at least 1 friend in Kroze Zone.',
    icon: '🤝',
    category: 'kroze',
    rewardHours: 1,
    checkUnlocked: (u) => (u.notifiedApprovals || []).length > 0,
  },
  {
    id: 'kroze_gift',
    title: '6. Kroze Krest Transfer',
    description: 'Transfer Krests to a friend in Kroze Zone.',
    icon: '💸',
    category: 'kroze',
    rewardHours: 1,
    checkUnlocked: (u) => true, // Always claimable once tried
  },
  {
    id: 'kroze_call',
    title: '7. Kroze Voice Call Pilot',
    description: 'Initiate a voice or video call in Kroze Zone.',
    icon: '📞',
    category: 'kroze',
    rewardHours: 1,
    checkUnlocked: (u) => true,
  },
  {
    id: 'kroze_chat',
    title: '8. Kroze Zone Chat Communicator',
    description: 'Send text messages in Kroze Zone chat.',
    icon: '💬',
    category: 'kroze',
    rewardHours: 0.75,
    checkUnlocked: (u) => true,
  },
  {
    id: 'bot_trader',
    title: '9. Bot Marketplace Trader',
    description: 'Purchase an item listed by Marketplace Bots.',
    icon: '🤖',
    category: 'economy',
    rewardHours: 1,
    checkUnlocked: (u) => (u.inventory || []).length >= 2,
  },
  {
    id: 'auction_bidder',
    title: '10. Auction Bidding Hero',
    description: 'Place a bid on any active Marketplace auction.',
    icon: '🔨',
    category: 'economy',
    rewardHours: 1,
    checkUnlocked: (u) => (u.reservedKrests || 0) > 0 || (u.inventory || []).length >= 1,
  },
  {
    id: 'auction_seller',
    title: '11. Marketplace Merchant',
    description: 'List any inventory item for sale in Marketplace.',
    icon: '🏪',
    category: 'economy',
    rewardHours: 1,
    checkUnlocked: (u) => true,
  },
  {
    id: 'secret_word',
    title: '12. Secret Word Decrypter',
    description: 'Set or update your Secret Word in Account Panel.',
    icon: '🔑',
    category: 'special',
    rewardHours: 2,
    checkUnlocked: (u) => Boolean(u.secretWord),
  },
  {
    id: 'shard_collector',
    title: '13. Icon Shard Collector',
    description: 'Collect at least 2 Icon Shards.',
    icon: '🔮',
    category: 'economy',
    rewardHours: 1,
    checkUnlocked: (u) => (u.iconShards || 0) >= 2,
  },
  {
    id: 'night_owl',
    title: '14. Night Owl Gaming Sprint',
    description: 'Log into Kreational Arcade after 8 PM.',
    icon: '🌙',
    category: 'special',
    rewardHours: 1.5,
    checkUnlocked: (u) => true,
  },
  {
    id: 'weekend_pass',
    title: '15. Weekend Gamer Pass',
    description: 'Claim your special Weekend Arcade bonus pass.',
    icon: '🎟️',
    category: 'special',
    rewardHours: 3,
    checkUnlocked: (u) => true,
  },
  {
    id: 'game_notes',
    title: '16. Arcade Game Scholar',
    description: 'Save custom notes for any game.',
    icon: '📝',
    category: 'arcade',
    rewardHours: 0.75,
    checkUnlocked: (u) => Object.keys(u.gameNotes || {}).length > 0,
  },
  {
    id: 'favorites',
    title: '17. Favorites Curator',
    description: 'Add at least 1 game to your Favorites.',
    icon: '⭐',
    category: 'arcade',
    rewardHours: 0.5,
    checkUnlocked: (u) => (u.favoriteGames || []).length > 0,
  },
  {
    id: 'krate_reroll',
    title: '18. Krate Reroll Pilot',
    description: 'Possess a Krate Reroll item in your inventory.',
    icon: '🎲',
    category: 'economy',
    rewardHours: 1,
    checkUnlocked: (u) => (u.krateRerolls || 0) > 0 || (u.inventory || []).some(i => i.itemId === 'krate_reroll'),
  },
  {
    id: 'voice_assistant',
    title: '19. Voice Command Pilot',
    description: 'Enable Voice Assistant in Settings.',
    icon: '🎙️',
    category: 'special',
    rewardHours: 0.5,
    checkUnlocked: (u) => Boolean(u.userSettings?.voiceAssistantEnabled),
  },
  {
    id: 'cosmetics',
    title: '20. Profile Stylist',
    description: 'Equip a custom title, frame, or background.',
    icon: '✨',
    category: 'special',
    rewardHours: 1,
    checkUnlocked: (u) => Boolean(u.cosmetics?.title || u.cosmetics?.avatarFrame || u.cosmetics?.background),
  },
  {
    id: 'promo_kroze',
    title: '21. Promo Code: KROZE2026',
    description: 'Claim the official Kroze Zone launch pass.',
    icon: '⚡',
    category: 'special',
    rewardHours: 2,
    checkUnlocked: (u) => true,
  },
  {
    id: 'streak_shield',
    title: '22. Streak Protector',
    description: 'Possess an active Streak Shield.',
    icon: '🛡️',
    category: 'economy',
    rewardHours: 0.75,
    checkUnlocked: (u) => (u.activeStreakShields || 0) > 0 || (u.inventory || []).some(i => i.itemId === 'streak_shield'),
  },
  {
    id: 'playtime_30',
    title: '23. Gaming Marathon',
    description: 'Reach an Arcade login session today.',
    icon: '⚡',
    category: 'arcade',
    rewardHours: 2,
    checkUnlocked: (u) => true,
  },
  {
    id: 'multi_game',
    title: '24. Multi-Game Sprint',
    description: 'Play 3 or more games in the Arcade.',
    icon: '🎯',
    category: 'arcade',
    rewardHours: 2,
    checkUnlocked: (u) => (u.playHistory || []).length >= 3,
  },
  {
    id: 'community_gift',
    title: '25. Community Benefactor',
    description: 'Share your 10-digit Kroze Friend Code.',
    icon: '🌟',
    category: 'kroze',
    rewardHours: 3,
    checkUnlocked: (u) => true,
  },
];

export const AZGamesChallengesModal: React.FC<AZGamesChallengesModalProps> = ({
  isOpen,
  onClose,
  user,
  onUpdateUser,
}) => {
  const [claimedMap, setClaimedMap] = useState<Record<string, boolean>>(() => {
    try {
      const stored = localStorage.getItem(`az_claimed_${user.id}`);
      return stored ? JSON.parse(stored) : {};
    } catch (e) {
      return {};
    }
  });

  const [promoInput, setPromoInput] = useState('');
  const [promoMessage, setPromoMessage] = useState<{ text: string; success: boolean } | null>(null);

  if (!isOpen) return null;

  const handleClaim = async (challenge: AZChallenge) => {
    if (claimedMap[challenge.id]) return;

    SFX.playSuccess();
    const durationSec = Math.floor(challenge.rewardHours * 3600);

    const newTempAccess: TemporaryAccess = {
      tierId: 'azgames',
      grantedAt: Date.now(),
      durationSeconds: durationSec,
    };

    const updatedUser: User = {
      ...user,
      purchasedTiers: Array.from(new Set([...user.purchasedTiers, 'azgames'])),
      temporaryAccess: [...(user.temporaryAccess || []), newTempAccess],
    };

    const newClaimed = { ...claimedMap, [challenge.id]: true };
    setClaimedMap(newClaimed);

    try {
      localStorage.setItem(`az_claimed_${user.id}`, JSON.stringify(newClaimed));
      safeSet('kreational_user', JSON.stringify(updatedUser));
      safeSet('kreational_current_user', JSON.stringify(updatedUser));
      window.dispatchEvent(new Event('user_updated'));
      await saveFullUserAccountToFirestore(updatedUser);
    } catch (e) {}

    onUpdateUser(updatedUser);
  };

  const handleRedeemPromo = async () => {
    const inputCode = promoInput.trim().toUpperCase();
    if (!inputCode) return;

    const activeCodes = await getActivePromoCodes();
    const matchedCode = activeCodes.find((c) => c.code.toUpperCase() === inputCode);

    if (matchedCode) {
      const codeId = `promo_${matchedCode.code.toLowerCase()}`;
      if (claimedMap[codeId]) {
        SFX.playError();
        setPromoMessage({ text: '⚠️ You have already redeemed this promo code!', success: false });
        return;
      }

      // Grant AZGAMES hours & bonus krests
      const currentPurchased = user.purchasedTiers || [];
      const now = Date.now();
      const existingExpiresAt = user.azgamesTierExpiresAt && user.azgamesTierExpiresAt > now ? user.azgamesTierExpiresAt : now;
      const additionalMs = (matchedCode.rewardHours || 1) * 60 * 60 * 1000;
      const newExpiresAt = existingExpiresAt + additionalMs;

      const bonusKrests = matchedCode.bonusKrests || 0;
      const updatedUser: User = {
        ...user,
        krests: (user.krests || 0) + bonusKrests,
        purchasedTiers: Array.from(new Set([...currentPurchased, 'azgames'])),
        azgamesTierExpiresAt: newExpiresAt,
      };

      const newClaimed = { ...claimedMap, [codeId]: true };
      setClaimedMap(newClaimed);

      try {
        localStorage.setItem(`az_claimed_${user.id}`, JSON.stringify(newClaimed));
        safeSet('kreational_user', JSON.stringify(updatedUser));
        safeSet('kreational_current_user', JSON.stringify(updatedUser));
        window.dispatchEvent(new Event('user_updated'));
        await saveFullUserAccountToFirestore(updatedUser);
      } catch (e) {}

      SFX.playSuccess();
      onUpdateUser(updatedUser);
      setPromoMessage({
        text: `🎉 Code '${matchedCode.code}' Applied! +${matchedCode.rewardHours}h AZGAMES Access ${
          bonusKrests ? `& +${bonusKrests} Bonus Krests` : ''
        } Granted!`,
        success: true,
      });
      setPromoInput('');
    } else {
      SFX.playError();
      setPromoMessage({ text: 'Invalid promo code. Check active codes in Kreator Panel or try KROZE2026!', success: false });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-4xl bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 border border-amber-500/30 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-6 bg-gradient-to-r from-amber-950/80 via-purple-950/80 to-slate-950 border-b border-amber-500/20 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/20 border border-amber-400/40 text-amber-300 shadow-lg shadow-amber-950/50">
              <Zap className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                25 Ways to Unlock AZGAMES Tier
              </h2>
              <p className="text-xs text-amber-200/80 font-medium">
                Complete tasks or redeem codes to grant temporary AZGAMES Tier access instantly!
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              SFX.playClick();
              onClose();
            }}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Promo Code Quick Bar */}
        <div className="p-3 sm:p-4 bg-amber-950/30 border-b border-white/5 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-amber-300 font-bold">
            <Key className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Have a Kroze Pass Code?</span>
          </div>
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <input
              type="text"
              placeholder="Enter promo code (e.g. KROZE2026)"
              value={promoInput}
              onChange={(e) => setPromoInput(e.target.value)}
              className="flex-1 px-3 py-1.5 rounded-xl bg-black/60 border border-amber-500/40 text-white text-xs font-mono focus:outline-none focus:border-amber-400"
            />
            <button
              onClick={handleRedeemPromo}
              className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider cursor-pointer shadow-md"
            >
              Redeem
            </button>
          </div>
          {promoMessage && (
            <div className={`w-full text-xs font-semibold ${promoMessage.success ? 'text-emerald-400' : 'text-rose-400'}`}>
              {promoMessage.text}
            </div>
          )}
        </div>

        {/* Challenge Cards Grid */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-3 custom-scrollbar flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {AZ_CHALLENGES.map((challenge) => {
              const isUnlocked = challenge.checkUnlocked(user);
              const isClaimed = claimedMap[challenge.id];

              return (
                <div
                  key={challenge.id}
                  className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                    isClaimed
                      ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
                      : isUnlocked
                      ? 'bg-slate-900/90 border-amber-500/40 hover:border-amber-400 shadow-lg shadow-amber-950/20'
                      : 'bg-slate-950/60 border-slate-800 opacity-70'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-2xl">{challenge.icon}</span>
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/30 text-[10px] font-mono font-bold text-amber-300 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        +{challenge.rewardHours}h AZGAMES
                      </span>
                    </div>

                    <div>
                      <h4 className="font-bold text-white text-sm leading-snug">{challenge.title}</h4>
                      <p className="text-xs text-slate-400 mt-0.5 leading-normal">{challenge.description}</p>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-white/5">
                    {isClaimed ? (
                      <div className="flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold text-emerald-400 bg-emerald-500/10 rounded-xl border border-emerald-500/30">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Pass Claimed!</span>
                      </div>
                    ) : isUnlocked ? (
                      <button
                        onClick={() => handleClaim(challenge)}
                        className="w-full py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider cursor-pointer shadow-md flex items-center justify-center gap-1.5 transition-all"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        <span>Claim +{challenge.rewardHours}h Pass</span>
                      </button>
                    ) : (
                      <div className="flex items-center justify-center gap-1.5 py-1.5 text-xs text-slate-500 bg-black/40 rounded-xl border border-white/5">
                        <Lock className="w-3.5 h-3.5" />
                        <span>Locked (Complete Goal)</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
