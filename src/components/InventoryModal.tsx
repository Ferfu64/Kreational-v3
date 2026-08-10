import React, { useState } from 'react';
import { User, ItemInstance, ItemRarity } from '../types';
import {
  Package,
  X,
  Sparkles,
  Shield,
  Zap,
  Ticket,
  Dices,
  Key,
  Store,
  CheckCircle2,
  Tag,
  Filter,
} from 'lucide-react';
import { SFX } from '../utils/sfx';
import { saveFullUserAccountToFirestore } from '../services/firestoreStore';
import { safeSet } from '../utils/persistentStorage';

interface InventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  onUpdateUser: (updatedUser: User) => void;
  onNavigateToMarketplace?: () => void;
}

const RARITY_THEMES: Record<
  ItemRarity,
  { bg: string; border: string; text: string; badge: string; shadow: string }
> = {
  common: {
    bg: 'bg-slate-900/90',
    border: 'border-slate-800',
    text: 'text-slate-300',
    badge: 'bg-slate-800 text-slate-300 border-slate-600',
    shadow: 'shadow-slate-950/40',
  },
  uncommon: {
    bg: 'bg-emerald-950/80',
    border: 'border-emerald-600/60',
    text: 'text-emerald-300',
    badge: 'bg-emerald-900 text-emerald-200 border-emerald-600 font-semibold',
    shadow: 'shadow-emerald-950/50',
  },
  rare: {
    bg: 'bg-blue-950/80',
    border: 'border-blue-500/60',
    text: 'text-blue-300',
    badge: 'bg-blue-900 text-blue-200 border-blue-600 font-semibold',
    shadow: 'shadow-blue-950/50',
  },
  epic: {
    bg: 'bg-purple-950/80',
    border: 'border-purple-500/60',
    text: 'text-purple-300',
    badge: 'bg-purple-900 text-purple-200 border-purple-500 font-bold',
    shadow: 'shadow-purple-950/60',
  },
  legendary: {
    bg: 'bg-amber-950/80',
    border: 'border-amber-500/80',
    text: 'text-amber-300',
    badge: 'bg-amber-900 text-amber-200 border-amber-400 font-extrabold',
    shadow: 'shadow-amber-950/80 ring-1 ring-amber-500/30',
  },
};

export const InventoryModal: React.FC<InventoryModalProps> = ({
  isOpen,
  onClose,
  user,
  onUpdateUser,
  onNavigateToMarketplace,
}) => {
  const [filterRarity, setFilterRarity] = useState<string>('all');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const inventory = user.inventory || [];
  const filteredInventory = inventory.filter((item) => {
    if (filterRarity !== 'all' && item.rarity !== filterRarity) return false;
    return true;
  });

  const handleUseItem = async (item: ItemInstance) => {
    if (item.isListed) return;
    SFX.playSuccess();

    const updatedInventory = (user.inventory || []).filter(
      (i) => i.instanceId !== item.instanceId
    );

    let updatedUser: User = {
      ...user,
      inventory: updatedInventory,
    };
    let msg = '';

    if (item.itemId === 'streak_shield') {
      updatedUser.activeStreakShields = (user.activeStreakShields || 0) + 1;
      msg = '🛡️ Streak Shield activated! Absorbs 1 missed daily login.';
    } else if (item.itemId === 'krest_booster') {
      updatedUser.krestBoosterExpiresAt = Date.now() + 30 * 60 * 1000;
      updatedUser.krests = (user.krests || 0) + 100; // Bonus instant Krests
      msg = '⚡ Krest Booster activated! +100 Krests granted and double passive earnings for 30 minutes.';
    } else if (item.itemId === 'request_token') {
      updatedUser.freeRequestTokens = (user.freeRequestTokens || 0) + 1;
      msg = '🎫 Request Token activated! 1 free game/tier request token added to your account.';
    } else if (item.itemId === 'krate_reroll') {
      updatedUser.krateRerolls = (user.krateRerolls || 0) + 1;
      msg = '🎲 Krate Reroll activated! 1 free Shop Krate reroll added.';
    } else if (item.itemId === 'temp_access_token') {
      const newAccess = [
        ...(user.temporaryAccess || []),
        {
          tierId: 'pro' as any,
          grantedAt: Date.now(),
          durationSeconds: 3600,
        },
      ];
      updatedUser.temporaryAccess = newAccess;
      msg = '🔑 Temporary Access Token activated! Granted 1 Hour of Pro Tier access.';
    } else if (item.itemId === 'xp_booster_overclock') {
      updatedUser.krests = (user.krests || 0) + 250;
      msg = '⚡ Overclocked Krest Amplifier activated! +250 Krests added to your balance.';
    } else if (item.itemId === 'mythic_shard_token') {
      updatedUser.krests = (user.krests || 0) + 200;
      msg = '🔮 Mythic Shard redeemed! +200 Krests added to your balance.';
    } else {
      updatedUser.krests = (user.krests || 0) + 75;
      msg = `Activated ${item.name}! +75 bonus Krests added.`;
    }

    try {
      safeSet('kreational_user', JSON.stringify(updatedUser));
      safeSet('kreational_current_user', JSON.stringify(updatedUser));
      window.dispatchEvent(new Event('user_updated'));
      await saveFullUserAccountToFirestore(updatedUser);
    } catch (e) {
      console.warn('Error saving user inventory state:', e);
    }

    onUpdateUser(updatedUser);
    setStatusMessage(msg);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-3xl bg-slate-900 border border-purple-500/40 shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between bg-black/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-inner">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white flex items-center gap-2 font-mono">
                MY INVENTORY & COLLECTION
                <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-xs font-mono font-bold border border-purple-500/30">
                  {inventory.length} Items
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                View your items, activate power-ups, or list items on the Marketplace.
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              SFX.playClick();
              onClose();
            }}
            className="p-2 rounded-full bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Bar */}
        <div className="px-5 py-3 border-b border-white/5 bg-slate-950/60 flex items-center justify-between gap-3 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 shrink-0">
            <Filter className="w-3.5 h-3.5 text-purple-400" />
            <span>Filter Rarity:</span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {['all', 'common', 'uncommon', 'rare', 'epic', 'legendary'].map((rarity) => (
              <button
                key={rarity}
                onClick={() => {
                  SFX.playClick();
                  setFilterRarity(rarity);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-all cursor-pointer ${
                  filterRarity === rarity
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-950/50 border border-purple-400'
                    : 'bg-black/40 text-slate-400 hover:text-slate-200 border border-white/5'
                }`}
              >
                {rarity}
              </button>
            ))}
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          {statusMessage && (
            <div className="p-3.5 rounded-2xl bg-emerald-950/90 border border-emerald-500/60 text-emerald-200 text-xs font-bold flex items-center justify-between shadow-lg">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{statusMessage}</span>
              </div>
              <button
                onClick={() => setStatusMessage(null)}
                className="px-2 py-1 rounded bg-black/40 text-white text-[10px] hover:bg-black/60 cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {filteredInventory.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <Package className="w-12 h-12 text-slate-600 mx-auto" />
              <p className="text-slate-300 text-sm font-semibold">
                No items found in your inventory for this filter.
              </p>
              {onNavigateToMarketplace && (
                <button
                  onClick={() => {
                    SFX.playClick();
                    onClose();
                    onNavigateToMarketplace();
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md inline-flex items-center gap-2 cursor-pointer mt-2"
                >
                  <Store className="w-4 h-4" />
                  <span>Browse Marketplace</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredInventory.map((item) => {
                const theme = RARITY_THEMES[item.rarity] || RARITY_THEMES.common;

                return (
                  <div
                    key={item.instanceId}
                    className={`p-4 rounded-3xl ${theme.bg} border ${theme.border} ${theme.shadow} space-y-3 flex flex-col justify-between relative group hover:scale-[1.02] transition-all`}
                  >
                    <div className="flex items-center justify-between border-b border-white/10 pb-2">
                      <span className={`px-2 py-0.5 rounded-md text-[9px] uppercase border ${theme.badge}`}>
                        {item.rarity}
                      </span>
                      {item.isListed && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] font-mono font-bold flex items-center gap-1">
                          <Tag className="w-2.5 h-2.5" />
                          LISTED ON MARKETPLACE
                        </span>
                      )}
                    </div>

                    <div className="text-center py-2 space-y-2">
                      <div className="w-16 h-16 mx-auto rounded-2xl bg-black/60 border border-white/10 flex items-center justify-center text-3xl shadow-inner group-hover:scale-105 transition-transform">
                        {item.icon}
                      </div>
                      <div>
                        <h3 className="font-bold text-white text-sm">{item.name}</h3>
                        <p className="text-[11px] text-slate-400 line-clamp-2 mt-1 px-1">
                          {item.description}
                        </p>
                      </div>
                    </div>

                    {item.utilityEffect && (
                      <div className="p-2.5 rounded-2xl bg-black/60 border border-white/10 text-[11px] text-purple-200/90 leading-tight">
                        <strong>Effect:</strong> {item.utilityEffect.description}
                      </div>
                    )}

                    <div className="pt-1 flex items-center gap-2">
                      {!item.isListed ? (
                        <>
                          {item.itemId === 'krate_reroll' || item.itemId === 'quantum_reroll_cube' ? (
                            <div className="flex-1 py-2 px-3 rounded-xl font-bold text-[11px] bg-indigo-900/60 text-indigo-300 border border-indigo-500/40 text-center">
                              🎲 Auto-Used in Shop
                            </div>
                          ) : item.itemId === 'streak_shield' || item.itemId === 'auction_shield_charm' ? (
                            <div className="flex-1 py-2 px-3 rounded-xl font-bold text-[11px] bg-emerald-900/60 text-emerald-300 border border-emerald-500/40 text-center">
                              🛡️ Passive Auto-Shield
                            </div>
                          ) : item.itemId === 'request_token' ? (
                            <div className="flex-1 py-2 px-3 rounded-xl font-bold text-[11px] bg-amber-900/60 text-amber-300 border border-amber-500/40 text-center">
                              🎫 Use in Request Screen
                            </div>
                          ) : (
                            <button
                              onClick={() => handleUseItem(item)}
                              className="flex-1 py-2 rounded-xl font-bold text-xs bg-purple-600 hover:bg-purple-500 text-white shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
                            >
                              <Zap className="w-3.5 h-3.5 text-amber-300" />
                              <span>Activate Item</span>
                            </button>
                          )}

                          {onNavigateToMarketplace && (
                            <button
                              onClick={() => {
                                SFX.playClick();
                                onClose();
                                onNavigateToMarketplace();
                              }}
                              className="px-3 py-2 rounded-xl text-xs font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 transition-all cursor-pointer flex items-center gap-1"
                              title="List on Marketplace"
                            >
                              <Store className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </>
                      ) : (
                        <div className="w-full py-2 rounded-xl text-center text-xs font-bold text-amber-300 bg-amber-500/10 border border-amber-500/20">
                          Active Listing
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
