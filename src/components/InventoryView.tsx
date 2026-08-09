import React, { useState } from 'react';
import { User, ItemInstance, ItemRarity } from '../types';
import {
  Shield,
  Zap,
  Ticket,
  Dices,
  Key,
  Package,
  Store,
  CheckCircle2,
  AlertCircle,
  Tag,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { SFX } from '../utils/sfx';

interface InventoryViewProps {
  user: User;
  onUpdateUser: (updatedUser: User) => void;
  onOpenMarketplaceListing?: (item: ItemInstance) => void;
  onNavigateToMarketplace?: () => void;
}

const RARITY_THEMES: Record<
  ItemRarity,
  { bg: string; border: string; text: string; badge: string; shadow: string }
> = {
  common: {
    bg: 'bg-slate-900/60',
    border: 'border-slate-700/60',
    text: 'text-slate-300',
    badge: 'bg-slate-800 text-slate-300 border-slate-600',
    shadow: 'shadow-slate-900/40',
  },
  uncommon: {
    bg: 'bg-emerald-950/40',
    border: 'border-emerald-600/60',
    text: 'text-emerald-300',
    badge: 'bg-emerald-900 text-emerald-200 border-emerald-600',
    shadow: 'shadow-emerald-950/40',
  },
  rare: {
    bg: 'bg-blue-950/40',
    border: 'border-blue-500/60',
    text: 'text-blue-300',
    badge: 'bg-blue-900 text-blue-200 border-blue-600',
    shadow: 'shadow-blue-950/40',
  },
  epic: {
    bg: 'bg-purple-950/40',
    border: 'border-purple-500/60',
    text: 'text-purple-300',
    badge: 'bg-purple-900 text-purple-200 border-purple-600',
    shadow: 'shadow-purple-950/40',
  },
  legendary: {
    bg: 'bg-amber-950/40',
    border: 'border-amber-500/80',
    text: 'text-amber-300',
    badge: 'bg-amber-900 text-amber-200 border-amber-500 font-bold',
    shadow: 'shadow-amber-950/50',
  },
};

export const InventoryView: React.FC<InventoryViewProps> = ({
  user,
  onUpdateUser,
  onOpenMarketplaceListing,
  onNavigateToMarketplace,
}) => {
  const [selectedItem, setSelectedItem] = useState<ItemInstance | null>(null);
  const [filterRarity, setFilterRarity] = useState<string>('all');
  const [useStatusMessage, setUseStatusMessage] = useState<string | null>(null);

  const inventory = user.inventory || [];

  const filteredInventory = inventory.filter((item) => {
    if (filterRarity !== 'all' && item.rarity !== filterRarity) return false;
    return true;
  });

  const handleUseItem = (item: ItemInstance) => {
    if (item.isListed) return;
    SFX.playSuccess();

    let updatedInventory = (user.inventory || []).filter(
      (i) => i.instanceId !== item.instanceId
    );
    let updatedUser: User = { ...user };
    let msg = '';

    if (item.itemId === 'streak_shield') {
      updatedUser.activeStreakShields = (user.activeStreakShields || 0) + 1;
      msg = '🛡️ Streak Shield activated! Your next missed daily streak is protected.';
    } else if (item.itemId === 'krest_booster') {
      updatedUser.krestBoosterExpiresAt = Date.now() + 30 * 60 * 1000;
      msg = '⚡ Krest Booster activated! Passive Krest earnings doubled for 30 minutes.';
    } else if (item.itemId === 'request_token') {
      updatedUser.freeRequestTokens = (user.freeRequestTokens || 0) + 1;
      msg = '🎫 Request Token activated! You gained 1 free Game/Tier Request submission.';
    } else if (item.itemId === 'krate_reroll') {
      updatedUser.krateRerolls = (user.krateRerolls || 0) + 1;
      msg = '🎲 Krate Reroll activated! You can reroll 1 Krate loot in the Shop.';
    } else if (item.itemId === 'temp_access_token') {
      // Grant 1 hour temporary access to a featured tier or game
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
    } else {
      msg = `Activated ${item.name}!`;
    }

    updatedUser.inventory = updatedInventory;
    onUpdateUser(updatedUser);
    setUseStatusMessage(msg);
    setSelectedItem(null);
  };

  return (
    <div id="user-inventory-panel" className="space-y-6">
      {/* Active Boosters Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-purple-950/40 border border-purple-500/30 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              Player Inventory
              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-mono">
                {inventory.length} Items
              </span>
            </h3>
            <p className="text-xs text-slate-300 mt-0.5">
              Manage your utility items, activate power-ups, or list items on the Marketplace.
            </p>
          </div>
        </div>

        {onNavigateToMarketplace && (
          <button
            onClick={() => {
              SFX.playClick();
              onNavigateToMarketplace();
            }}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 flex items-center gap-2 transition-all cursor-pointer shadow-md"
          >
            <Store className="w-4 h-4 text-amber-400" />
            <span>Go to Marketplace</span>
          </button>
        )}
      </div>

      {/* Active Effects / Power-ups Status Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-medium text-slate-300">Active Shields:</span>
          </div>
          <span className="font-mono font-bold text-xs text-blue-300">
            {user.activeStreakShields || 0}
          </span>
        </div>

        <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-medium text-slate-300">Krest Booster:</span>
          </div>
          <span className="font-mono font-bold text-xs text-amber-300">
            {user.krestBoosterExpiresAt && user.krestBoosterExpiresAt > Date.now()
              ? `${Math.ceil((user.krestBoosterExpiresAt - Date.now()) / 60000)}m left`
              : 'Inactive'}
          </span>
        </div>

        <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Ticket className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-medium text-slate-300">Free Request Tokens:</span>
          </div>
          <span className="font-mono font-bold text-xs text-emerald-300">
            {user.freeRequestTokens || 0}
          </span>
        </div>
      </div>

      {useStatusMessage && (
        <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/50 text-emerald-200 text-xs font-semibold flex items-center justify-between animate-fade-in">
          <span>{useStatusMessage}</span>
          <button
            onClick={() => setUseStatusMessage(null)}
            className="text-emerald-400 hover:text-white text-xs underline cursor-pointer ml-2"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Rarity Filter Controls */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 no-scrollbar">
        <div className="flex items-center gap-1.5">
          {['all', 'common', 'uncommon', 'rare', 'epic', 'legendary'].map((r) => (
            <button
              key={r}
              onClick={() => setFilterRarity(r)}
              className={`px-3 py-1 rounded-xl text-xs font-semibold capitalize transition-all cursor-pointer ${
                filterRarity === r
                  ? 'bg-purple-600 text-white border border-purple-400 shadow-md'
                  : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Inventory Items Grid */}
      {filteredInventory.length === 0 ? (
        <div className="p-8 text-center rounded-2xl bg-slate-950/40 border border-slate-800 space-y-2">
          <Package className="w-10 h-10 text-slate-600 mx-auto" />
          <p className="text-sm font-semibold text-slate-400">No items found in inventory.</p>
          <p className="text-xs text-slate-300">
            Unbox Krates in the Shop or complete Daily Quests to earn rare Utility Items!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredInventory.map((item) => {
            const theme = RARITY_THEMES[item.rarity] || RARITY_THEMES.common;
            return (
              <div
                key={item.instanceId}
                onClick={() => {
                  SFX.playClick();
                  setSelectedItem(item);
                }}
                className={`p-4 rounded-2xl ${theme.bg} border ${theme.border} ${theme.shadow} transition-all cursor-pointer hover:scale-[1.02] relative group space-y-3`}
              >
                {/* Currently Listed Badge Overlay */}
                {item.isListed && (
                  <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-rose-950/90 text-rose-300 border border-rose-600 text-[10px] font-bold tracking-wide uppercase flex items-center gap-1 shadow-lg z-10 animate-pulse">
                    <Tag className="w-2.5 h-2.5 text-rose-400" />
                    <span>Currently Listed</span>
                  </div>
                )}

                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-xl bg-black/40 border border-white/10 flex items-center justify-center text-2xl shrink-0 group-hover:scale-110 transition-transform">
                    {item.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-white text-sm truncate">{item.name}</h4>
                    </div>
                    <span
                      className={`inline-block mt-0.5 px-2 py-0.2 rounded-md text-[10px] uppercase tracking-wider font-semibold border ${theme.badge}`}
                    >
                      {item.rarity}
                    </span>
                    <p className="text-[10px] text-slate-300 font-mono mt-1">
                      ID: {item.instanceId}
                    </p>
                  </div>
                </div>

                <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                  {item.description}
                </p>

                <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-300">
                  <span>Effect: {item.utilityEffect.type}</span>
                  <span className="text-purple-300 font-bold group-hover:underline">
                    View Details →
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Item Detail View Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-md p-6 rounded-3xl bg-slate-900 border border-purple-500/40 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-purple-950/60 border border-purple-500/50 flex items-center justify-center text-3xl">
                  {selectedItem.icon}
                </div>
                <div>
                  <h3 className="font-bold text-white text-lg">{selectedItem.name}</h3>
                  <span
                    className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                      RARITY_THEMES[selectedItem.rarity].badge
                    }`}
                  >
                    {selectedItem.rarity}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setSelectedItem(null)}
                className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Status Banner if Listed */}
            {selectedItem.isListed ? (
              <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-600/60 text-rose-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <div>
                  <strong className="block text-rose-300 font-bold">Currently Listed on Marketplace</strong>
                  <span>This item is active on the Marketplace. It cannot be used or re-listed until the listing ends.</span>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Ready in Inventory. Available for use or listing on the Marketplace.</span>
              </div>
            )}

            {/* Description & Effect Details */}
            <div className="space-y-3 bg-slate-950/60 p-4 rounded-2xl border border-white/5 text-xs text-slate-300">
              <div>
                <span className="text-slate-300 uppercase text-[10px] font-mono tracking-wider block">Description</span>
                <p className="text-white mt-0.5 font-medium">{selectedItem.description}</p>
              </div>

              <div>
                <span className="text-slate-300 uppercase text-[10px] font-mono tracking-wider block">Utility Effect</span>
                <p className="text-amber-300 mt-0.5 font-semibold">
                  {selectedItem.utilityEffect.description || selectedItem.utilityEffect.type}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10 text-[11px]">
                <div>
                  <span className="text-slate-300 block">Tradable:</span>
                  <span className="text-white font-bold">{selectedItem.tradable ? 'Yes' : 'No'}</span>
                </div>
                <div>
                  <span className="text-slate-300 block">Unique Instance ID:</span>
                  <span className="text-purple-300 font-mono font-bold">{selectedItem.instanceId}</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              {!selectedItem.isListed && (
                <button
                  onClick={() => handleUseItem(selectedItem)}
                  className="flex-1 py-3 px-4 rounded-xl font-bold text-xs bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-900/50 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Use Item Now</span>
                </button>
              )}

              {selectedItem.tradable && !selectedItem.isListed && onOpenMarketplaceListing && (
                <button
                  onClick={() => {
                    const itemToList = selectedItem;
                    setSelectedItem(null);
                    onOpenMarketplaceListing(itemToList);
                  }}
                  className="flex-1 py-3 px-4 rounded-xl font-bold text-xs bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/50 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <Store className="w-4 h-4 text-amber-400" />
                  <span>List on Marketplace</span>
                </button>
              )}

              <button
                onClick={() => setSelectedItem(null)}
                className="py-3 px-4 rounded-xl font-semibold text-xs bg-slate-800 text-slate-300 hover:text-white transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
