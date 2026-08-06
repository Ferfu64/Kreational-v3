import React, { useState, useEffect } from 'react';
import { Game, Tier, User } from '../types';
import { safeGet, safeSet } from '../utils/persistentStorage';
import { Lock, Clock, Key, Play, Heart, FileText, Sparkles, History, Search, X } from 'lucide-react';
import { TIER_THEMES } from './TierSelector';

interface GameGridProps {
  selectedTier: Tier | null;
  games: Game[];
  allGames?: Game[];
  tiers?: Tier[];
  user: User;
  onPlayGame: (game: Game) => void;
  onRequestGameAccess: (game: Game) => void;
  onRequestTierAccess: (tier: Tier) => void;
  serverTimeOffset: number; // local - server time difference in ms
  enableSearchBar?: boolean;
}

export const GameGrid: React.FC<GameGridProps> = ({
  selectedTier,
  games,
  allGames,
  tiers = [],
  user,
  onPlayGame,
  onRequestGameAccess,
  onRequestTierAccess,
  serverTimeOffset,
  enableSearchBar: enableSearchBarProp,
}) => {
  const [now, setNow] = useState(Date.now() - serverTimeOffset);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [filterMode, setFilterMode] = useState<'all' | 'favorites' | 'recent'>('all');
  const [recentGameIds, setRecentGameIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [enableSearchBarLocal, setEnableSearchBarLocal] = useState(true);

  const enableSearchBar = enableSearchBarProp !== undefined ? enableSearchBarProp : enableSearchBarLocal;

  const fullGamesList = allGames && allGames.length > 0 ? allGames : games;

  // Update live clock every second using server-synced time
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now() - serverTimeOffset);
    }, 1000);
    return () => clearInterval(timer);
  }, [serverTimeOffset]);

  // Sync favorites, recent history & settings from LocalStorage
  const loadLocalStorageData = () => {
    try {
      const favsRaw = safeGet('kreational_favorites');
      setFavorites(favsRaw ? JSON.parse(favsRaw) : []);

      const historyRaw = safeGet('kreational_play_history');
      if (historyRaw) {
        const historyList: Array<{ id: string }> = JSON.parse(historyRaw);
        setRecentGameIds(historyList.map((h) => h.id));
      }

      const settingsRaw = safeGet('kreational_user_settings');
      if (settingsRaw) {
        const parsedSettings = JSON.parse(settingsRaw);
        setEnableSearchBarLocal(parsedSettings.enableSearchBar !== false);
      }
    } catch (err) {
      console.warn('Failed to load local storage in GameGrid:', err);
    }
  };

  useEffect(() => {
    loadLocalStorageData();
    window.addEventListener('storage', loadLocalStorageData);
    return () => window.removeEventListener('storage', loadLocalStorageData);
  }, []);

  const toggleFavorite = (gameId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      let updated: string[];
      if (favorites.includes(gameId)) {
        updated = favorites.filter((id) => id !== gameId);
      } else {
        updated = [...favorites, gameId];
      }
      setFavorites(updated);
      safeSet('kreational_favorites', JSON.stringify(updated));
    } catch (err) {
      console.warn('Failed to save favorite to localStorage:', err);
    }
  };

  if (!selectedTier) {
    return (
      <div className="p-8 text-center text-slate-500 font-mono text-sm bg-slate-900/50 rounded-2xl border border-slate-800">
        Please select a tier above to view games.
      </div>
    );
  }

  const isAdmin = user.role === 'admin' || user.username === 'Kreator';
  const userHasTempTier = (user.temporaryAccess || []).some(
    (ta) => ta.tierId === selectedTier.id && now < Number(ta.grantedAt) + Number(ta.durationSeconds) * 1000
  );
  const userOwnsTier = isAdmin || (user.purchasedTiers || []).includes(selectedTier.id) || userHasTempTier;

  // Helper to format remaining time
  const formatRemaining = (expiresAtMs: number) => {
    const remainingSeconds = Math.max(0, Math.floor((expiresAtMs - now) / 1000));
    if (remainingSeconds <= 0) return 'Expired';

    const hours = Math.floor(remainingSeconds / 3600);
    const mins = Math.floor((remainingSeconds % 3600) / 60);
    const secs = remainingSeconds % 60;

    if (hours > 0) {
      return `${hours}h ${mins}m ${secs}s`;
    }
    return `${mins}m ${secs}s`;
  };

  const tierTheme = TIER_THEMES[selectedTier.id] || TIER_THEMES.bronze;

  const isSearching = enableSearchBar && searchQuery.trim() !== '';

  // Filter games based on current filterMode and search query
  const sourceGames = isSearching ? fullGamesList : games;

  const displayedGames = sourceGames.filter((game) => {
    if (filterMode === 'favorites' && !favorites.includes(game.id)) {
      return false;
    }
    if (filterMode === 'recent' && !recentGameIds.includes(game.id)) {
      return false;
    }
    if (isSearching) {
      const q = searchQuery.toLowerCase().trim();
      return game.title.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div id="game-grid-container" className="space-y-4">
      {/* Games Search Bar (Enabled/Disabled via Settings) */}
      {enableSearchBar && (
        <div id="games-search-bar-container" className="relative w-full animate-fadeIn">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-purple-400 absolute left-3.5 pointer-events-none" />
            <input
              id="games-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search all games across ALL tiers by title..."
              className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-xs font-mono text-white placeholder-slate-400 focus:outline-none focus:border-purple-500/60 focus:ring-1 focus:ring-purple-500/50 backdrop-blur-md transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="Clear Search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Tier Header Bar */}
      <div className={`p-5 rounded-2xl glass flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xl backdrop-blur-xl bg-white/[0.03] border-white/10`}>
        <div>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-mono font-bold uppercase tracking-wider ${tierTheme.text}`}>
              {isSearching ? 'Global Search Results' : `Tier ${selectedTier.displayOrder}`}
            </span>
            {userOwnsTier ? (
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-semibold flex items-center gap-1 backdrop-blur-md">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Access Unlocked
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full bg-slate-500/20 border border-slate-500/30 text-slate-300 text-[10px] font-semibold flex items-center gap-1 backdrop-blur-md">
                <Lock className="w-3 h-3" /> Locked Tier
              </span>
            )}
          </div>
          <h3 className={`text-2xl font-mono font-black ${tierTheme.text} tracking-tight mt-1`}>
            {isSearching ? `Matching "${searchQuery}"` : `${selectedTier.name} Library`}
          </h3>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* LocalStorage Filters */}
          <div className="flex items-center bg-black/40 p-1 rounded-xl border border-white/10 text-xs font-mono">
            <button
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                filterMode === 'all' ? 'bg-purple-600 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              All ({isSearching ? fullGamesList.length : games.length})
            </button>
            <button
              onClick={() => setFilterMode('favorites')}
              className={`px-3 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                filterMode === 'favorites' ? 'bg-rose-600 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Heart className="w-3 h-3 fill-current" />
              <span>Favs ({(isSearching ? fullGamesList : games).filter((g) => favorites.includes(g.id)).length})</span>
            </button>
            <button
              onClick={() => setFilterMode('recent')}
              className={`px-3 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                filterMode === 'recent' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              <History className="w-3 h-3" />
              <span>Recent</span>
            </button>
          </div>

          {!userOwnsTier && !isSearching && (
            <button
              id="request-entire-tier-btn"
              onClick={() => onRequestTierAccess(selectedTier)}
              className="btn-primary py-2 px-4 text-xs font-bold flex items-center gap-2 cursor-pointer"
            >
              <Key className="w-4 h-4" />
              <span>Request Tier Access</span>
            </button>
          )}
        </div>
      </div>

      {/* Grid of game titles */}
      {displayedGames.length === 0 ? (
        <div className="p-8 text-center text-slate-400 font-mono text-sm glass rounded-2xl">
          {isSearching
            ? `No games found matching "${searchQuery}" across any tier.`
            : filterMode === 'favorites'
            ? 'No favorite games added yet in this tier. Click the heart icon on any game to favorite it!'
            : filterMode === 'recent'
            ? 'No recently played games recorded in LocalStorage yet.'
            : `No games currently added to ${selectedTier.name} tier.`}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {displayedGames.map((game) => {
            // Check temporary access for game or tier
            const tempAccess = (user.temporaryAccess || []).find(
              (ta) => (ta.gameId && ta.gameId === game.id) || (ta.tierId && ta.tierId === game.tier)
            );
            let hasValidTempAccess = false;
            let tempExpiresAt = 0;

            if (tempAccess) {
              tempExpiresAt = Number(tempAccess.grantedAt) + Number(tempAccess.durationSeconds) * 1000;
              if (now < tempExpiresAt) {
                hasValidTempAccess = true;
              }
            }

            const gameTierOwned = isAdmin || (user.purchasedTiers || []).includes(game.tier);
            const canPlay = gameTierOwned || hasValidTempAccess;
            const isFav = favorites.includes(game.id);
            const hasSavedNote = !!safeGet(`kreational_game_note_${game.id}`);
            const gameTierTheme = TIER_THEMES[game.tier] || TIER_THEMES.bronze;

            return (
              <div
                id={`game-card-${game.id}`}
                key={game.id}
                onClick={() => {
                  if (canPlay) {
                    onPlayGame(game);
                  }
                }}
                className={`p-4 rounded-2xl border text-left transition-all duration-200 group flex items-center justify-between gap-3 ${
                  canPlay
                    ? 'glass-card cursor-pointer hover:border-purple-500/40 shadow-lg'
                    : 'bg-white/[0.015] border-white/5 opacity-60 backdrop-blur-sm'
                }`}
              >
                {/* Title and local indicators */}
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-base font-semibold font-sans tracking-wide truncate ${canPlay ? 'text-slate-100 group-hover:text-purple-200' : 'text-slate-500'}`}>
                      {!canPlay && '🔒 '}
                      {game.title}
                    </span>
                    {isSearching && (
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider ${gameTierTheme.bg} ${gameTierTheme.text} border ${gameTierTheme.border}`}>
                        {game.tier}
                      </span>
                    )}
                    {hasSavedNote && (
                      <span className="text-amber-400" title="Has saved notes in LocalStorage">
                        <FileText className="w-3.5 h-3.5 inline" />
                      </span>
                    )}
                  </div>

                  {/* Live Countdown if temporary access */}
                  {hasValidTempAccess && !userOwnsTier && (
                    <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono active-timer">
                      <Clock className="w-3.5 h-3.5 animate-pulse" />
                      <span>{formatRemaining(tempExpiresAt)}</span>
                    </div>
                  )}
                </div>

                {/* Right Action buttons */}
                <div className="shrink-0 flex items-center gap-1.5">
                  <button
                    onClick={(e) => toggleFavorite(game.id, e)}
                    className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                      isFav
                        ? 'text-rose-500 hover:text-rose-400 bg-rose-500/10'
                        : 'text-slate-600 hover:text-slate-400 hover:bg-white/5'
                    }`}
                    title={isFav ? 'Remove Favorite' : 'Save Favorite in LocalStorage'}
                  >
                    <Heart className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
                  </button>

                  {canPlay ? (
                    <span className="px-3 py-1.5 rounded-xl bg-purple-500/20 text-purple-200 border border-purple-500/30 group-hover:bg-purple-600 group-hover:text-white group-hover:border-purple-400 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md">
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Play</span>
                    </span>
                  ) : (
                    <button
                      id={`request-single-game-btn-${game.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onRequestGameAccess(game);
                      }}
                      className="px-2.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer backdrop-blur-md"
                    >
                      <Key className="w-3.5 h-3.5" />
                      <span>Request Game</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
