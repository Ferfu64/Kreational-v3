import React from 'react';
import { motion } from 'motion/react';
import { Tier, TierId } from '../types';
import { Lock, Check, Sparkles, Key } from 'lucide-react';
import { SFX } from '../utils/sfx';

interface TierSelectorProps {
  tiers: Tier[];
  selectedTierId: TierId;
  onSelectTier: (tierId: TierId) => void;
  userPurchasedTiers: TierId[];
  isAdmin: boolean;
  onRequestTierAccess: (tier: Tier) => void;
  onOpenAZChallenges?: () => void;
}

export const TIER_THEMES: Record<
  TierId,
  {
    name: string;
    bgGradient: string;
    border: string;
    text: string;
    activeRing: string;
    badgeBg: string;
    glow: string;
  }
> = {
  bronze: {
    name: 'Bronze',
    bgGradient: 'from-amber-950/70 via-amber-900/50 to-slate-900',
    border: 'border-amber-700/60',
    text: 'text-amber-300',
    activeRing: 'ring-amber-500',
    badgeBg: 'bg-amber-950 text-amber-300 border-amber-800',
    glow: 'shadow-amber-900/20',
  },
  silver: {
    name: 'Silver',
    bgGradient: 'from-slate-900 via-zinc-800/60 to-slate-900',
    border: 'border-slate-500/60',
    text: 'text-slate-200',
    activeRing: 'ring-slate-400',
    badgeBg: 'bg-slate-900 text-slate-200 border-slate-700',
    glow: 'shadow-slate-700/20',
  },
  gold: {
    name: 'Gold',
    bgGradient: 'from-amber-900/60 via-yellow-900/40 to-slate-900',
    border: 'border-yellow-500/70',
    text: 'text-yellow-300',
    activeRing: 'ring-yellow-400',
    badgeBg: 'bg-yellow-950 text-yellow-300 border-yellow-700',
    glow: 'shadow-yellow-500/20',
  },
  diamond: {
    name: 'Diamond',
    bgGradient: 'from-cyan-950/70 via-sky-900/40 to-slate-900',
    border: 'border-cyan-400/70',
    text: 'text-cyan-200',
    activeRing: 'ring-cyan-400',
    badgeBg: 'bg-cyan-950 text-cyan-200 border-cyan-800',
    glow: 'shadow-cyan-500/25',
  },
  mythic: {
    name: 'Mythic',
    bgGradient: 'from-purple-950/80 via-indigo-900/50 to-slate-900',
    border: 'border-purple-500/70',
    text: 'text-purple-300',
    activeRing: 'ring-purple-400',
    badgeBg: 'bg-purple-950 text-purple-300 border-purple-800',
    glow: 'shadow-purple-500/25',
  },
  legendary: {
    name: 'Legendary',
    bgGradient: 'from-rose-950/80 via-red-900/50 to-slate-900',
    border: 'border-rose-500/70',
    text: 'text-rose-300',
    activeRing: 'ring-rose-400',
    badgeBg: 'bg-rose-950 text-rose-300 border-rose-800',
    glow: 'shadow-rose-500/25',
  },
  master: {
    name: 'Master',
    bgGradient: 'from-emerald-950/80 via-teal-900/50 to-slate-900',
    border: 'border-emerald-500/70',
    text: 'text-emerald-300',
    activeRing: 'ring-emerald-400',
    badgeBg: 'bg-emerald-950 text-emerald-300 border-emerald-800',
    glow: 'shadow-emerald-500/25',
  },
  pro: {
    name: 'Pro',
    bgGradient: 'from-violet-950/80 via-fuchsia-950/60 to-slate-900',
    border: 'border-violet-400/70',
    text: 'text-violet-200',
    activeRing: 'ring-violet-400',
    badgeBg: 'bg-violet-950 text-violet-200 border-violet-800',
    glow: 'shadow-violet-500/30',
  },
  azgames: {
    name: 'AZGAMES',
    bgGradient: 'from-stone-950/90 via-red-950/70 to-slate-900',
    border: 'border-red-600/80',
    text: 'text-red-400',
    activeRing: 'ring-red-500',
    badgeBg: 'bg-red-950 text-red-300 border-red-800',
    glow: 'shadow-red-600/30',
  },
};

export const TierSelector: React.FC<TierSelectorProps> = ({
  tiers,
  selectedTierId,
  onSelectTier,
  userPurchasedTiers,
  isAdmin,
  onRequestTierAccess,
  onOpenAZChallenges,
}) => {
  // Hidden by default: 'azgames' tier only shown if user is Admin OR has explicit access
  const visibleTiers = tiers.filter((tier) => {
    if (tier.id === 'azgames' || tier.id === ('blocked' as any)) {
      return isAdmin || userPurchasedTiers.includes('azgames') || userPurchasedTiers.includes('blocked' as any);
    }
    return true;
  });

  return (
    <div id="tier-selector-container" className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-mono font-semibold uppercase tracking-widest text-slate-400 flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>Select Tier Level</span>
        </h2>
      </div>

      {/* Grid / Horizontal Row of Tiers */}
      <div className="flex sm:grid overflow-x-auto sm:grid-cols-4 lg:grid-cols-9 gap-2 sm:gap-2.5 pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {visibleTiers.map((tier, idx) => {
          const isSelected = selectedTierId === tier.id;
          const isUnlocked = isAdmin || userPurchasedTiers.includes(tier.id);
          const theme = TIER_THEMES[tier.id] || TIER_THEMES.bronze;
          const isAZGames = tier.id === 'azgames' || tier.name === 'AZGAMES';

          return (
            <motion.div
              id={`tier-card-${tier.id}`}
              key={tier.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.03, duration: 0.25 }}
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.98 }}
              role="button"
              tabIndex={0}
              onClick={() => {
                SFX.playTierChange();
                onSelectTier(tier.id);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  SFX.playTierChange();
                  onSelectTier(tier.id);
                }
              }}
              className={`relative flex flex-col items-center justify-between p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border text-left transition-all duration-300 group cursor-pointer backdrop-blur-xl shrink-0 min-w-[125px] sm:min-w-0 ${
                isAZGames ? 'glitch-card bg-red-950/40 border-red-600/80 shadow-red-900/50' : ''
              } ${
                isSelected
                  ? `bg-white/[0.08] ${theme.border} ring-2 ${theme.activeRing} ring-offset-2 ring-offset-[#050505] ${theme.glow} shadow-xl`
                  : 'bg-white/[0.025] border-white/10 hover:bg-white/[0.06] hover:border-white/20 opacity-85 hover:opacity-100'
              }`}
            >
              <div className="w-full flex items-center justify-between mb-1.5">
                <span className={`text-[10px] font-mono font-bold tracking-wider uppercase ${isAZGames ? 'glitch-text text-red-400' : theme.text}`}>
                  {isAZGames ? 'AZGAMES' : `TIER ${tier.displayOrder}`}
                </span>
                {isUnlocked ? (
                  <span className="p-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 backdrop-blur-md">
                    <Check className="w-3 h-3" />
                  </span>
                ) : (
                  <span className="p-1 rounded-full bg-slate-500/20 border border-slate-500/30 text-slate-400 backdrop-blur-md">
                    <Lock className="w-3 h-3" />
                  </span>
                )}
              </div>

              <div className="w-full my-1">
                <div className={`text-base font-bold tracking-tight font-mono ${isAZGames ? 'glitch-text text-red-400 font-black' : theme.text}`}>
                  {tier.name}
                </div>
              </div>

              {/* Status Badge */}
              <div className="w-full mt-2 pt-2 border-t border-white/10 flex flex-col items-center gap-1.5 text-[11px]">
                {isUnlocked ? (
                  <span className="text-emerald-400 font-semibold text-[11px] flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Unlocked
                  </span>
                ) : (
                  <button
                    id={`request-tier-btn-${tier.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onRequestTierAccess(tier);
                    }}
                    className="w-full py-1.5 px-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 font-semibold text-[10px] flex items-center justify-center gap-1 transition-colors backdrop-blur-md cursor-pointer"
                  >
                    <Key className="w-3 h-3" />
                    <span>Request Tier</span>
                  </button>
                )}

                {/* 25 AZGAMES Passes Button right under AZGAMES tier card */}
                {isAZGames && onOpenAZChallenges && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      SFX.playClick();
                      onOpenAZChallenges();
                    }}
                    className="w-full py-1 px-1.5 rounded-lg bg-gradient-to-r from-amber-500/30 via-red-500/30 to-amber-500/30 hover:from-amber-500/50 hover:to-red-500/50 text-amber-200 border border-amber-400/50 font-black text-[9px] uppercase tracking-wider flex items-center justify-center gap-1 cursor-pointer transition-all shadow-md"
                  >
                    <Sparkles className="w-3 h-3 text-amber-300 animate-pulse" />
                    <span>25 AZ Passes</span>
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
