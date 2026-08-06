import React, { useState } from 'react';
import { User, UserCosmetics, TierId } from '../types';
import { COSMETICS_CATALOG, CosmeticOption } from '../utils/userProfile';
import {
  X,
  Sparkles,
  Package,
  Shield,
  Image as ImageIcon,
  CheckCircle2,
  Lock,
  ArrowRight,
  Gift,
  Layers,
  Crown,
  Target,
  Check,
  Flame,
  Award,
} from 'lucide-react';
import { VoiceManager } from '../assistant/VoiceManager';
import { SFX } from '../utils/sfx';
import {
  getActiveQuestsForUser,
  claimQuestRewardInQuests,
  recordKrateOpenedInQuests,
} from '../utils/questManager';

interface ShopModalProps {
  user: User;
  onUpdateUser: (updated: User) => void;
  onClose: () => void;
  onOpenProfile: () => void;
  onTriggerKreditGain?: (amount: number) => void;
}

export interface KrateTier {
  id: 'bronze' | 'silver' | 'gold';
  name: string;
  cost: number;
  icon: string;
  color: string;
  border: string;
  glow: string;
  shardsRange: [number, number];
  description: string;
}

export const KRATE_TIERS: KrateTier[] = [
  {
    id: 'bronze',
    name: 'Bronze Krate',
    cost: 150,
    icon: '📦',
    color: 'from-amber-950/80 via-slate-900 to-amber-950/90 text-amber-300',
    border: 'border-amber-600/50 hover:border-amber-400',
    glow: 'shadow-amber-950/60 hover:shadow-amber-900/80',
    shardsRange: [0, 2],
    description: '150 Krests. Chance for Icon Shards + Common or Rare Cosmetics.',
  },
  {
    id: 'silver',
    name: 'Silver Krate',
    cost: 350,
    icon: '💎',
    color: 'from-slate-900 via-indigo-950 to-slate-950 text-cyan-300',
    border: 'border-cyan-500/50 hover:border-cyan-400',
    glow: 'shadow-cyan-950/60 hover:shadow-cyan-900/80',
    shardsRange: [0, 3],
    description: '350 Krests. Higher chance for Icon Shards + Rare/Epic Cosmetics.',
  },
  {
    id: 'gold',
    name: 'Gold Krate',
    cost: 500,
    icon: '👑',
    color: 'from-amber-950 via-purple-950 to-amber-950 text-amber-200',
    border: 'border-amber-400/80 hover:border-amber-300',
    glow: 'shadow-amber-500/30 hover:shadow-amber-500/50',
    shardsRange: [1, 5],
    description: '500 Krests. Epic/Legendary Cosmetics + 5% Chance to unlock AZGAMES Tier!',
  },
];

export interface UnboxedReward {
  shardsAdded: number;
  cosmetic?: CosmeticOption;
  alreadyOwned?: boolean;
  unlockedAZGAMES?: boolean;
}

export const ShopModal: React.FC<ShopModalProps> = ({
  user,
  onUpdateUser,
  onClose,
  onOpenProfile,
  onTriggerKreditGain,
}) => {
  const [activeShopTab, setActiveShopTab] = useState<'krates' | 'quests'>('krates');
  const [openingKrate, setOpeningKrate] = useState<KrateTier | null>(null);
  const [unboxingStep, setUnboxingStep] = useState<'idle' | 'spinning' | 'revealed'>('idle');
  const [reward, setReward] = useState<UnboxedReward | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const krests = user.krests || 0;
  const iconShards = user.iconShards || 0;
  const activeQuests = getActiveQuestsForUser(user);
  const availableClaimCount = activeQuests.filter((q) => q.completed && !q.claimed).length;

  const handleClaimQuest = (questId: 'login_today' | 'play_5_games' | 'open_krate') => {
    const { updatedUser, rewardKrests } = claimQuestRewardInQuests(user, questId);
    if (rewardKrests > 0) {
      SFX.playCoin();
      onUpdateUser(updatedUser);
      onTriggerKreditGain?.(rewardKrests);
    }
  };

  const handleBuyKrate = (krate: KrateTier) => {
    if (krests < krate.cost) {
      SFX.playError();
      setErrorMsg(`Not enough Krests! You need ${krate.cost} Krests (You have ${krests}).`);
      return;
    }

    SFX.playPurchase();
    setErrorMsg(null);
    setOpeningKrate(krate);
    setUnboxingStep('spinning');

    try {
      VoiceManager.speak(`Opening ${krate.name}...`, { configOverride: { rate: 1.1, pitch: 1.1 } });
    } catch (e) {}

    // Deduct Krests
    const newKrests = krests - krate.cost;

    // Determine Shards (Non-guaranteed!)
    let shardsDropped = 0;
    const dropChance = krate.id === 'bronze' ? 0.5 : krate.id === 'silver' ? 0.65 : 0.8;
    if (Math.random() < dropChance) {
      const minShards = krate.shardsRange[0] || 1;
      const maxShards = krate.shardsRange[1];
      shardsDropped = Math.floor(Math.random() * (maxShards - minShards + 1)) + minShards;
    }

    // Determine Gold Krate Grand Prize: 5% Chance to unlock AZGAMES tier
    let unlockedAZGAMES = false;
    let purchasedTiers = [...(user.purchasedTiers || [])];
    if (krate.id === 'gold' && Math.random() < 0.05) {
      if (!purchasedTiers.includes('blocked')) {
        purchasedTiers.push('blocked');
        unlockedAZGAMES = true;
      }
    }

    // Determine Cosmetic
    const cosmeticsToPick = COSMETICS_CATALOG.filter((c) => {
      if (krate.id === 'bronze') return c.rarity === 'common' || c.rarity === 'rare';
      if (krate.id === 'silver') return c.rarity === 'rare' || c.rarity === 'epic';
      return c.rarity === 'epic' || c.rarity === 'legendary';
    });

    const chosenCosmetic = cosmeticsToPick[Math.floor(Math.random() * cosmeticsToPick.length)];

    // Check ownership
    const currentUnlockedBgs = user.cosmetics?.unlockedBackgrounds || ['bg_neon_cyber'];
    const currentUnlockedFrames = user.cosmetics?.unlockedFrames || ['frame_default'];
    const currentUnlockedTitles = user.cosmetics?.unlockedTitles || ['Arcade Rookie', 'Glitch Runner'];

    let alreadyOwned = false;
    let newBgs = [...currentUnlockedBgs];
    let newFrames = [...currentUnlockedFrames];
    let newTitles = [...currentUnlockedTitles];

    if (chosenCosmetic.type === 'background') {
      if (newBgs.includes(chosenCosmetic.id)) {
        alreadyOwned = true;
      } else {
        newBgs.push(chosenCosmetic.id);
      }
    } else if (chosenCosmetic.type === 'frame') {
      if (newFrames.includes(chosenCosmetic.id)) {
        alreadyOwned = true;
      } else {
        newFrames.push(chosenCosmetic.id);
      }
    } else if (chosenCosmetic.type === 'title') {
      if (newTitles.includes(chosenCosmetic.name)) {
        alreadyOwned = true;
      } else {
        newTitles.push(chosenCosmetic.name);
      }
    }

    let updatedUser: User = {
      ...user,
      krests: newKrests,
      iconShards: iconShards + shardsDropped,
      purchasedTiers: Array.from(new Set(purchasedTiers)),
      cosmetics: {
        ...user.cosmetics,
        unlockedBackgrounds: newBgs,
        unlockedFrames: newFrames,
        unlockedTitles: newTitles,
      },
    };

    // Progress the "Open a Krate" daily quest!
    updatedUser = recordKrateOpenedInQuests(updatedUser);

    onUpdateUser(updatedUser);

    setTimeout(() => {
      if (unlockedAZGAMES) {
        SFX.playStreakClaim();
      } else {
        SFX.playUnboxing();
      }

      setReward({
        shardsAdded: shardsDropped,
        cosmetic: chosenCosmetic,
        alreadyOwned,
        unlockedAZGAMES,
      });
      setUnboxingStep('revealed');

      try {
        if (unlockedAZGAMES) {
          VoiceManager.speak(`JACKPOT! You unlocked permanent access to the AZGAMES Tier!`, {
            configOverride: { rate: 1.1, pitch: 1.2 },
          });
        } else {
          VoiceManager.speak(`Krate opened! Received ${shardsDropped} Icon Shards and ${chosenCosmetic.name}!`, {
            configOverride: { rate: 1.1, pitch: 1.2 },
          });
        }
      } catch (e) {}
    }, 2200);
  };

  const closeUnboxing = () => {
    setOpeningKrate(null);
    setUnboxingStep('idle');
    setReward(null);
  };

  return (
    <div id="shop-modal-overlay" className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xl flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn">
      <div id="shop-modal-card" className="w-full max-w-2xl rounded-2xl bg-slate-950 border border-purple-500/40 shadow-2xl shadow-purple-950/80 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-white/10 bg-gradient-to-r from-purple-950/60 via-slate-950 to-indigo-950/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/20 border border-purple-500/40 text-purple-300 shadow-md shadow-purple-900/50">
              <Gift className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white font-mono tracking-tight flex items-center gap-2">
                Kreational Shop & Krates
              </h3>
              <p className="text-xs text-purple-300">
                Spend Krests to open Krates and unlock profile cosmetics & Icon Shards!
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Currency & Shards Tracker Bar */}
        <div className="px-5 py-3 bg-white/[0.03] border-b border-white/10 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                SFX.playClick();
                setActiveShopTab('krates');
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeShopTab === 'krates'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-950/50'
                  : 'bg-white/5 text-slate-400 hover:text-white'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>Shop & Krates</span>
            </button>

            <button
              onClick={() => {
                SFX.playClick();
                setActiveShopTab('quests');
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer relative ${
                activeShopTab === 'quests'
                  ? 'bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-950/50'
                  : 'bg-white/5 text-slate-400 hover:text-white'
              }`}
            >
              <Target className="w-3.5 h-3.5" />
              <span>Daily Quests</span>
              {availableClaimCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping absolute -top-0.5 -right-0.5" />
              )}
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 font-mono font-bold text-xs">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>{krests} Krests</span>
            </div>

            <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-300 font-mono font-bold text-xs">
              <Layers className="w-4 h-4 text-purple-400" />
              <span>
                {iconShards} / 10 Shards
              </span>
            </div>
          </div>
        </div>

        {/* Custom Avatar Upload Teaser Banner */}
        <div className="mx-5 mt-4 p-3.5 rounded-xl bg-gradient-to-r from-purple-950/80 via-indigo-950/60 to-slate-950 border border-purple-500/30 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/40">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                <span>Custom Profile Picture Unlock</span>
                {iconShards >= 10 ? (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-mono">
                    UNLOCKED!
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-mono">
                    {10 - iconShards} Shards Needed
                  </span>
                )}
              </h4>
              <p className="text-[11px] text-slate-300 leading-tight mt-0.5">
                {iconShards >= 10
                  ? 'You have 10 Icon Shards! Go to your Profile to upload any picture from your device gallery.'
                  : 'Collect 10 Icon Shards from Krates below to unlock uploading custom images from your device gallery.'}
              </p>
            </div>
          </div>

          {iconShards >= 10 && (
            <button
              onClick={() => {
                onClose();
                onOpenProfile();
              }}
              className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shrink-0 cursor-pointer shadow-md shadow-emerald-950/60"
            >
              Upload Photo
            </button>
          )}
        </div>

        {/* Error message */}
        {errorMsg && (
          <div className="mx-5 mt-3 p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs font-semibold">
            {errorMsg}
          </div>
        )}

        {/* Tab 1: Krates Shop */}
        {activeShopTab === 'krates' && (
          <div className="p-5 overflow-y-auto space-y-4 flex-1">
            <h4 className="text-xs font-mono font-bold text-purple-300 uppercase tracking-wider">
              Available Krates
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {KRATE_TIERS.map((krate) => {
                const canAfford = krests >= krate.cost;
                return (
                  <div
                    key={krate.id}
                    className={`p-4 rounded-2xl bg-gradient-to-b ${krate.color} border ${krate.border} ${krate.glow} backdrop-blur-xl flex flex-col justify-between transition-all duration-300 relative group overflow-hidden`}
                  >
                    <div>
                      <div className="text-4xl mb-2 text-center group-hover:scale-110 transition-transform">
                        {krate.icon}
                      </div>

                      <h4 className="text-base font-bold text-white text-center tracking-tight">
                        {krate.name}
                      </h4>

                      <p className="text-[11px] text-slate-300/90 text-center mt-1.5 leading-relaxed">
                        {krate.description}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-white/10 space-y-2">
                      <div className="flex items-center justify-between text-xs font-mono font-bold">
                        <span className="text-slate-400">Price:</span>
                        <span className="text-amber-300 flex items-center gap-1">
                          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                          {krate.cost} Krests
                        </span>
                      </div>

                      <button
                        onClick={() => handleBuyKrate(krate)}
                        disabled={!canAfford}
                        className={`w-full py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          canAfford
                            ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-900/50'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-white/5'
                        }`}
                      >
                        {canAfford ? (
                          <>
                            <Package className="w-4 h-4" />
                            <span>Buy & Open Krate</span>
                          </>
                        ) : (
                          <>
                            <Lock className="w-3.5 h-3.5" />
                            <span>Need {krate.cost} Krests</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 2: Daily Quests Panel */}
        {activeShopTab === 'quests' && (
          <div className="p-5 overflow-y-auto space-y-4 flex-1">
            <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-950/80 via-purple-950/60 to-slate-950 border border-amber-500/40 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400">
                  <Target className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white font-mono flex items-center gap-2">
                    <span>Daily Quests</span>
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-mono border border-amber-500/30">
                      Refreshes Every Midnight
                    </span>
                  </h4>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Complete your 3 daily quests below to earn bonus Krests every single day!
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {activeQuests.map((quest) => {
                const percent = Math.min(100, Math.round((quest.currentProgress / quest.def.targetProgress) * 100));

                return (
                  <div
                    key={quest.def.id}
                    className={`p-4 rounded-2xl border transition-all ${
                      quest.claimed
                        ? 'bg-slate-900/40 border-white/10 opacity-70'
                        : quest.completed
                        ? 'bg-gradient-to-r from-emerald-950/60 to-slate-950 border-emerald-500/60 shadow-lg shadow-emerald-950/50'
                        : 'bg-white/[0.03] border-white/10'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-slate-900 border border-white/10 flex items-center justify-center text-2xl shrink-0 shadow-md">
                          {quest.def.icon}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-white font-mono">
                              {quest.def.title}
                            </h4>
                            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-mono font-bold flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-amber-400" />
                              +{quest.def.rewardKrests} Krests
                            </span>
                          </div>
                          <p className="text-xs text-slate-300 mt-0.5">{quest.def.description}</p>
                        </div>
                      </div>

                      <div className="w-full sm:w-auto flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/10">
                        <div className="text-right">
                          <span className="text-xs font-mono font-bold text-slate-300 block">
                            {quest.currentProgress} / {quest.def.targetProgress}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono block">
                            {quest.claimed ? 'Claimed' : quest.completed ? 'Ready!' : 'In Progress'}
                          </span>
                        </div>

                        {quest.claimed ? (
                          <span className="px-4 py-2 rounded-xl bg-slate-800 text-emerald-400 border border-white/10 text-xs font-bold font-mono flex items-center gap-1.5 shrink-0">
                            <Check className="w-4 h-4" /> Claimed
                          </span>
                        ) : quest.completed ? (
                          <button
                            onClick={() => handleClaimQuest(quest.def.id)}
                            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black text-xs cursor-pointer shadow-lg shadow-emerald-950/80 animate-bounce flex items-center gap-1.5 shrink-0"
                          >
                            <Sparkles className="w-4 h-4" />
                            <span>Claim +{quest.def.rewardKrests}</span>
                          </button>
                        ) : (
                          <span className="px-3.5 py-2 rounded-xl bg-slate-800/80 text-slate-400 border border-white/10 text-xs font-mono font-bold shrink-0">
                            In Progress
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-3 w-full h-2 rounded-full bg-slate-900 overflow-hidden border border-white/10">
                      <div
                        className={`h-full transition-all duration-500 rounded-full ${
                          quest.claimed
                            ? 'bg-slate-700'
                            : quest.completed
                            ? 'bg-gradient-to-r from-emerald-400 to-teal-300'
                            : 'bg-gradient-to-r from-amber-500 to-purple-500'
                        }`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Unboxing Animation Modal Overlay */}
      {openingKrate && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-2xl flex items-center justify-center p-4 animate-fadeIn">
          <div className="w-full max-w-md p-6 rounded-3xl bg-slate-950 border border-purple-500/50 shadow-2xl shadow-purple-950/80 text-center space-y-5 relative overflow-hidden">
            {unboxingStep === 'spinning' ? (
              <div className="py-12 space-y-6">
                <div className="relative w-28 h-28 mx-auto">
                  <div className="absolute inset-0 rounded-full bg-purple-500/20 animate-ping" />
                  <div className="w-28 h-28 rounded-3xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-6xl shadow-2xl shadow-purple-500/50 animate-bounce">
                    {openingKrate.icon}
                  </div>
                </div>

                <div>
                  <h3 className="text-xl font-bold text-white font-mono tracking-tight">
                    Opening {openingKrate.name}...
                  </h3>
                  <p className="text-xs text-purple-300 font-mono mt-1 animate-pulse">
                    Unlocking mystery profile cosmetic...
                  </p>
                </div>
              </div>
            ) : (
              reward && (
                <div className="space-y-5 animate-in zoom-in-95 duration-300">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto shadow-xl shadow-emerald-950/80">
                    <CheckCircle2 className="w-10 h-10" />
                  </div>

                  <div>
                    <span className="px-3 py-1 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-300 text-xs font-mono font-bold tracking-wider uppercase">
                      KRATE REWARD REVEALED
                    </span>
                    <h3 className="text-2xl font-black text-white font-mono tracking-tight mt-2">
                      Congratulations!
                    </h3>
                  </div>

                  <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 space-y-3">
                    {/* AZGAMES Grand Prize Banner if hit 5% chance */}
                    {reward.unlockedAZGAMES && (
                      <div className="p-3.5 rounded-xl bg-gradient-to-r from-amber-500/20 via-purple-500/20 to-rose-500/20 border border-amber-400/80 text-amber-200 flex items-center justify-between shadow-lg shadow-amber-950/60 animate-pulse">
                        <div className="flex items-center gap-2.5">
                          <Crown className="w-6 h-6 text-amber-400 shrink-0" />
                          <div className="text-left">
                            <span className="text-xs font-black text-amber-300 uppercase font-mono block">
                              🔥 GRAND PRIZE JACKPOT!
                            </span>
                            <span className="text-[11px] text-white font-bold block">
                              Unlocked Permanent Access to AZGAMES Tier!
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Shards Received */}
                    <div className="p-3 rounded-xl bg-purple-950/60 border border-purple-500/30 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <Layers className="w-5 h-5 text-purple-400" />
                        <span className="text-xs font-bold text-white">Icon Shards</span>
                      </div>
                      <span className="text-sm font-black text-purple-300 font-mono">
                        +{reward.shardsAdded} Shards
                      </span>
                    </div>

                    {/* Cosmetic Received */}
                    {reward.cosmetic && (
                      <div className="p-3 rounded-xl bg-slate-900 border border-white/10 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <Sparkles className="w-5 h-5 text-amber-400" />
                          <div className="text-left">
                            <span className="text-xs font-bold text-white block">
                              {reward.cosmetic.name}
                            </span>
                            <span className="text-[10px] text-purple-300 uppercase font-mono font-semibold">
                              {reward.cosmetic.type} ({reward.cosmetic.rarity})
                            </span>
                          </div>
                        </div>

                        {reward.alreadyOwned ? (
                          <span className="text-[10px] text-slate-400 font-mono">Already Owned</span>
                        ) : (
                          <span className="text-[10px] text-emerald-400 font-mono font-bold">NEW UNLOCK!</span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={closeUnboxing}
                      className="flex-1 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer transition-colors"
                    >
                      Keep Shopping
                    </button>
                    <button
                      onClick={() => {
                        closeUnboxing();
                        onClose();
                        onOpenProfile();
                      }}
                      className="flex-1 py-3 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold cursor-pointer transition-colors shadow-lg shadow-purple-900/50"
                    >
                      Equip in Profile
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
};
