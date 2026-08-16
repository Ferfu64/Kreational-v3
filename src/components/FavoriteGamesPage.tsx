import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Game, User, Tier } from '../types';
import {
  Heart,
  Gamepad2,
  Maximize2,
  Minimize2,
  LogOut,
  Sparkles,
  Search,
  Shuffle,
  Flame,
  Coins,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Grid3X3,
  Tv,
  Star,
  Play,
  FileText,
  Check,
  ArrowLeft,
  Share2,
} from 'lucide-react';
import { SFX } from '../utils/sfx';
import { safeGet, safeSet } from '../utils/persistentStorage';
import { saveFullUserAccountToFirestore } from '../services/firestoreStore';
import { recordGamePlayedInQuests } from '../utils/questManager';
import kreationsLogo from '../assets/images/kreations_sleek_logo_1785626924672.jpg';

interface FavoriteGamesPageProps {
  user: User;
  games: Game[];
  tiers: Tier[];
  onReturnToKreational: () => void;
  onUpdateUser: (user: User) => void;
  serverTimeOffset?: number;
}

export const FavoriteGamesPage: React.FC<FavoriteGamesPageProps> = ({
  user,
  games,
  tiers,
  onReturnToKreational,
  onUpdateUser,
  serverTimeOffset = 0,
}) => {
  // Favorites State
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => {
    const userFavs = user.favoriteGames || [];
    try {
      const stored = safeGet('kreational_favorites');
      const parsed = stored ? JSON.parse(stored) : [];
      return Array.from(new Set([...userFavs, ...parsed]));
    } catch {
      return userFavs;
    }
  });

  // UI States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTierFilter, setSelectedTierFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'bento' | 'cinema'>('grid');
  const [activePlayingGame, setActivePlayingGame] = useState<Game | null>(null);
  const [isBrowserFullscreen, setIsBrowserFullscreen] = useState(false);
  const [selectedNoteGameId, setSelectedNoteGameId] = useState<string | null>(null);
  const [gameNotes, setGameNotes] = useState<Record<string, string>>(user.gameNotes || {});
  const [noteSavedId, setNoteSavedId] = useState<string | null>(null);
  const [quickSwitcherOpen, setQuickSwitcherOpen] = useState(false);

  // Sync favorites if user prop changes
  useEffect(() => {
    if (user.favoriteGames) {
      setFavoriteIds((prev) => Array.from(new Set([...prev, ...(user.favoriteGames || [])])));
    }
  }, [user.favoriteGames]);

  // Sync fullscreen change
  useEffect(() => {
    const handleFs = () => setIsBrowserFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFs);
    return () => document.removeEventListener('fullscreenchange', handleFs);
  }, []);

  // Keyboard shortcut Esc to exit to Kreational or exit active game
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (activePlayingGame) {
          setActivePlayingGame(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activePlayingGame]);

  // Get full Game objects for all favorite IDs
  const favoriteGamesList = useMemo(() => {
    const map = new Map<string, Game>();
    games.forEach((g) => map.set(g.id, g));
    return favoriteIds
      .map((id) => map.get(id))
      .filter((g): g is Game => Boolean(g));
  }, [favoriteIds, games]);

  // Filtered favorite games
  const filteredFavorites = useMemo(() => {
    return favoriteGamesList.filter((game) => {
      const matchesSearch =
        !searchQuery.trim() ||
        game.title.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
        game.tier.toLowerCase().includes(searchQuery.toLowerCase().trim());
      const matchesTier = selectedTierFilter === 'all' || game.tier === selectedTierFilter;
      return matchesSearch && matchesTier;
    });
  }, [favoriteGamesList, searchQuery, selectedTierFilter]);

  // Check access permission
  const canAccessGame = (game: Game): boolean => {
    const isAdmin =
      user.role === 'admin' ||
      user.username?.toLowerCase() === 'kreator' ||
      user.id === 'kreator-admin-id';
    if (isAdmin) return true;
    if ((user.purchasedTiers || []).includes(game.tier as any)) return true;
    const now = Date.now() - serverTimeOffset;
    const tempPass = (user.temporaryAccess || []).find(
      (ta) =>
        (ta.gameId && ta.gameId === game.id) ||
        (ta.tierId && ta.tierId === game.tier && Number(ta.grantedAt) + Number(ta.durationSeconds) * 1000 > now)
    );
    return Boolean(tempPass);
  };

  // Toggle Favorite
  const handleToggleFavorite = (gameId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    SFX.playClick();
    let updated: string[];
    if (favoriteIds.includes(gameId)) {
      updated = favoriteIds.filter((id) => id !== gameId);
    } else {
      updated = [...favoriteIds, gameId];
    }
    setFavoriteIds(updated);
    safeSet('kreational_favorites', JSON.stringify(updated));
    const updatedUser = { ...user, favoriteGames: updated };
    onUpdateUser(updatedUser);
    saveFullUserAccountToFirestore(updatedUser).catch(() => {});
  };

  // Launch Game
  const handleLaunchGame = (game: Game, autoFullscreen: boolean = true) => {
    SFX.playClick();
    setActivePlayingGame(game);

    if (autoFullscreen && !document.fullscreenElement) {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    }

    // Record quest progress
    const updatedUser = recordGamePlayedInQuests(user);
    onUpdateUser(updatedUser);
    saveFullUserAccountToFirestore(updatedUser).catch(() => {});
  };

  // Play Random Favorite
  const handlePlayRandom = () => {
    if (favoriteGamesList.length === 0) return;
    SFX.playClick();
    const randomIndex = Math.floor(Math.random() * favoriteGamesList.length);
    handleLaunchGame(favoriteGamesList[randomIndex], true);
  };

  // Toggle Native Fullscreen
  const toggleNativeFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  // Save Game Note
  const handleSaveNote = (gameId: string, noteText: string) => {
    const updatedNotes = { ...gameNotes, [gameId]: noteText };
    setGameNotes(updatedNotes);
    safeSet(`kreational_game_note_${gameId}`, noteText);
    const updatedUser = { ...user, gameNotes: updatedNotes };
    onUpdateUser(updatedUser);
    saveFullUserAccountToFirestore(updatedUser).catch(() => {});
    setNoteSavedId(gameId);
    setTimeout(() => setNoteSavedId(null), 1800);
  };

  // Tier color mapper (middle ground styling)
  const getTierColorStyle = (tierId: string) => {
    switch (tierId) {
      case 'bronze':
        return {
          bg: 'bg-amber-950/40',
          border: 'border-amber-600/40',
          text: 'text-amber-400',
          glow: 'group-hover:border-amber-500/60 shadow-amber-950/20',
        };
      case 'silver':
        return {
          bg: 'bg-slate-900/60',
          border: 'border-slate-400/40',
          text: 'text-slate-300',
          glow: 'group-hover:border-slate-300/60 shadow-slate-900/20',
        };
      case 'gold':
        return {
          bg: 'bg-yellow-950/40',
          border: 'border-yellow-500/40',
          text: 'text-yellow-400',
          glow: 'group-hover:border-yellow-400/60 shadow-yellow-950/20',
        };
      case 'diamond':
        return {
          bg: 'bg-cyan-950/40',
          border: 'border-cyan-500/40',
          text: 'text-cyan-400',
          glow: 'group-hover:border-cyan-400/60 shadow-cyan-950/20',
        };
      case 'mythic':
        return {
          bg: 'bg-fuchsia-950/40',
          border: 'border-fuchsia-500/40',
          text: 'text-fuchsia-400',
          glow: 'group-hover:border-fuchsia-400/60 shadow-fuchsia-950/20',
        };
      case 'legendary':
        return {
          bg: 'bg-amber-900/40',
          border: 'border-amber-400/40',
          text: 'text-amber-300',
          glow: 'group-hover:border-amber-300/60 shadow-amber-900/20',
        };
      case 'master':
        return {
          bg: 'bg-rose-950/40',
          border: 'border-rose-500/40',
          text: 'text-rose-400',
          glow: 'group-hover:border-rose-400/60 shadow-rose-950/20',
        };
      default:
        return {
          bg: 'bg-indigo-950/40',
          border: 'border-indigo-500/40',
          text: 'text-indigo-400',
          glow: 'group-hover:border-indigo-400/60 shadow-indigo-950/20',
        };
    }
  };

  // Render Active Playing Game Fullscreen Theater
  if (activePlayingGame) {
    const isEmbedHtml = activePlayingGame.embedCode.includes('<iframe');
    const embedSrc = isEmbedHtml
      ? activePlayingGame.embedCode.match(/src="([^"]+)"/)?.[1] || activePlayingGame.embedCode
      : activePlayingGame.embedCode;
    const tierStyle = getTierColorStyle(activePlayingGame.tier);

    return (
      <div
        id="favorite-fullscreen-theater"
        className="fixed inset-0 z-50 bg-[#04040a] text-slate-100 flex flex-col select-none overflow-hidden"
      >
        {/* Sleek Floating Top HUD */}
        <header className="h-14 px-4 bg-black/80 backdrop-blur-xl border-b border-indigo-500/30 flex items-center justify-between gap-3 shrink-0 z-20">
          {/* Left: Back & Game Info */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => {
                SFX.playClick();
                setActivePlayingGame(null);
              }}
              className="p-2 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-200 border border-indigo-400/30 cursor-pointer flex items-center gap-1.5 text-xs font-bold transition-all shrink-0"
              title="Back to Favorites Grid"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Favorites</span>
            </button>

            <div className="flex items-center gap-2 min-w-0">
              <span className={`px-2 py-0.5 rounded-lg text-[10px] font-mono uppercase font-black border ${tierStyle.border} ${tierStyle.text} ${tierStyle.bg} shrink-0`}>
                {activePlayingGame.tier}
              </span>
              <h2 className="text-sm sm:text-base font-black text-white truncate tracking-tight">
                {activePlayingGame.title}
              </h2>
            </div>
          </div>

          {/* Center: Quick Switcher Dropdown */}
          <div className="relative hidden md:block">
            <button
              onClick={() => setQuickSwitcherOpen(!quickSwitcherOpen)}
              className="px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-indigo-500/30 text-xs font-bold flex items-center gap-2 cursor-pointer transition-all"
            >
              <Heart className="w-3.5 h-3.5 text-rose-400 fill-rose-400" />
              <span>Switch Favorite ({favoriteGamesList.length})</span>
            </button>

            {quickSwitcherOpen && (
              <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 w-64 max-h-72 overflow-y-auto bg-slate-950/95 backdrop-blur-2xl border border-indigo-500/40 rounded-2xl p-2 shadow-2xl space-y-1 z-30">
                {favoriteGamesList.map((fg) => (
                  <button
                    key={fg.id}
                    onClick={() => {
                      setActivePlayingGame(fg);
                      setQuickSwitcherOpen(false);
                      SFX.playClick();
                    }}
                    className={`w-full p-2 rounded-xl text-left text-xs font-bold flex items-center justify-between cursor-pointer transition-all ${
                      fg.id === activePlayingGame.id
                        ? 'bg-indigo-600/40 text-white border border-indigo-400/50'
                        : 'hover:bg-white/10 text-slate-300'
                    }`}
                  >
                    <span className="truncate">{fg.title}</span>
                    <span className="text-[9px] font-mono uppercase opacity-70 px-1 rounded bg-black/40">
                      {fg.tier}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => handleToggleFavorite(activePlayingGame.id)}
              className={`p-2 rounded-xl border text-xs cursor-pointer transition-all ${
                favoriteIds.includes(activePlayingGame.id)
                  ? 'bg-rose-500/20 border-rose-500/50 text-rose-300'
                  : 'bg-slate-800/60 border-white/10 text-slate-400'
              }`}
              title="Toggle Favorite"
            >
              <Heart className={`w-4 h-4 ${favoriteIds.includes(activePlayingGame.id) ? 'fill-rose-400 text-rose-400' : ''}`} />
            </button>

            <button
              onClick={() => {
                const ifr = document.getElementById('favorite-game-iframe') as HTMLIFrameElement;
                if (ifr) ifr.src = ifr.src;
                SFX.playClick();
              }}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-white/10 text-xs cursor-pointer transition-all"
              title="Reload Game"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            <button
              onClick={toggleNativeFullscreen}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-white/10 text-xs cursor-pointer transition-all"
              title={isBrowserFullscreen ? 'Exit Browser Fullscreen' : 'Enter Browser Fullscreen'}
            >
              {isBrowserFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            <button
              onClick={() => {
                SFX.playClick();
                onReturnToKreational();
              }}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-black uppercase tracking-wider border border-purple-400/40 cursor-pointer flex items-center gap-1.5 transition-all shadow-md shadow-purple-950/40"
              title="Return to Main Kreational"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Exit to Kreational</span>
            </button>
          </div>
        </header>

        {/* Game Iframe / Content View */}
        <div className="flex-1 w-full h-full relative bg-black flex items-center justify-center">
          {isEmbedHtml ? (
            <div
              className="w-full h-full"
              dangerouslySetInnerHTML={{
                __html: activePlayingGame.embedCode.replace(
                  '<iframe',
                  '<iframe id="favorite-game-iframe" style="width:100%;height:100%;border:none;"'
                ),
              }}
            />
          ) : (
            <iframe
              id="favorite-game-iframe"
              src={embedSrc}
              title={activePlayingGame.title}
              className="w-full h-full border-0"
              allow="autoplay; gamepad; fullscreen; cross-origin-isolated"
              allowFullScreen
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      id="favorite-games-page"
      className="min-h-screen bg-[#070712] text-slate-100 flex flex-col relative overflow-x-hidden selection:bg-purple-500/30 selection:text-purple-200"
    >
      {/* Middle Ground Ambient Glows (Obsidian + Cyber Violet/Rose Aura) */}
      <div className="fixed -top-40 left-1/4 w-[600px] h-[600px] bg-indigo-600/12 rounded-full blur-[140px] pointer-events-none" />
      <div className="fixed top-1/2 -right-40 w-[500px] h-[500px] bg-purple-600/12 rounded-full blur-[140px] pointer-events-none" />
      <div className="fixed -bottom-40 left-1/3 w-[600px] h-[600px] bg-rose-600/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Main Top Header Navigation Bar */}
      <header className="sticky top-0 z-30 bg-[#090a18]/85 backdrop-blur-2xl border-b border-indigo-500/25 px-4 sm:px-8 py-3.5 shadow-xl">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Brand & Page Identity */}
          <div className="flex items-center justify-between w-full md:w-auto gap-4">
            <div className="flex items-center gap-3">
              <img
                src={kreationsLogo}
                alt="Kreational Logo"
                className="w-10 h-10 rounded-2xl object-cover border border-indigo-400/40 shadow-lg shadow-indigo-950/60"
                referrerPolicy="no-referrer"
              />
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-black tracking-tight text-white font-mono flex items-center gap-1.5">
                    <span>KREATIONAL</span>
                    <span className="text-xs px-2 py-0.5 rounded-md bg-gradient-to-r from-rose-500/20 to-purple-500/20 text-rose-300 border border-rose-400/40">
                      FAVORITES
                    </span>
                  </h1>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
                  <span className="flex items-center gap-1 text-rose-400 font-bold">
                    <Heart className="w-3 h-3 fill-rose-400" />
                    {favoriteGamesList.length} Hearted {favoriteGamesList.length === 1 ? 'Game' : 'Games'}
                  </span>
                  <span>•</span>
                  <span>Instant Fullscreen Ready</span>
                </div>
              </div>
            </div>

            {/* Mobile Exit Button */}
            <button
              onClick={() => {
                SFX.playClick();
                onReturnToKreational();
              }}
              className="md:hidden px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-black uppercase flex items-center gap-1 border border-purple-400/40 cursor-pointer shadow-md"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Exit</span>
            </button>
          </div>

          {/* Middle: Search & Quick Play Controls */}
          <div className="flex items-center gap-2.5 w-full md:w-auto justify-end flex-wrap">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 text-indigo-400/70 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filter favorites..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-black/60 border border-indigo-500/30 text-white text-xs font-bold placeholder-slate-500 focus:outline-none focus:border-indigo-400 transition-all"
              />
            </div>

            {favoriteGamesList.length > 0 && (
              <button
                onClick={handlePlayRandom}
                className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 text-amber-200 border border-amber-500/40 text-xs font-bold cursor-pointer flex items-center gap-1.5 transition-all active:scale-95 shadow-sm"
                title="Shuffle and play a random favorite game"
              >
                <Shuffle className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Shuffle Play</span>
              </button>
            )}

            {/* Layout Mode Toggles */}
            <div className="flex items-center p-0.5 rounded-xl bg-black/50 border border-white/10">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg text-xs cursor-pointer transition-all ${
                  viewMode === 'grid' ? 'bg-indigo-600/40 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
                title="Standard Grid View"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode('bento')}
                className={`p-1.5 rounded-lg text-xs cursor-pointer transition-all ${
                  viewMode === 'bento' ? 'bg-indigo-600/40 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
                title="Compact Bento Grid"
              >
                <Grid3X3 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode('cinema')}
                className={`p-1.5 rounded-lg text-xs cursor-pointer transition-all ${
                  viewMode === 'cinema' ? 'bg-indigo-600/40 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
                title="Cinema Showcase View"
              >
                <Tv className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Fullscreen Mode Toggle */}
            <button
              onClick={toggleNativeFullscreen}
              className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-indigo-500/30 text-xs cursor-pointer transition-all"
              title="Toggle Browser Fullscreen"
            >
              {isBrowserFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>

            {/* Primary Exit to Main Kreational Button */}
            <button
              onClick={() => {
                SFX.playClick();
                onReturnToKreational();
              }}
              className="hidden md:flex px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-black uppercase tracking-wider border border-purple-400/50 cursor-pointer items-center gap-2 transition-all shadow-lg shadow-purple-950/50 active:scale-95 group"
            >
              <LogOut className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
              <span>Exit to Kreational</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Tier Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          <button
            onClick={() => setSelectedTierFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-all ${
              selectedTierFilter === 'all'
                ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white border border-indigo-400/50 shadow-md shadow-indigo-950/40'
                : 'bg-black/40 text-slate-400 hover:text-white border border-white/5'
            }`}
          >
            All Favorites ({favoriteGamesList.length})
          </button>

          {tiers.map((t) => {
            const count = favoriteGamesList.filter((g) => g.tier === t.id).length;
            if (count === 0) return null;
            const style = getTierColorStyle(t.id);
            return (
              <button
                key={t.id}
                onClick={() => setSelectedTierFilter(t.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-all flex items-center gap-1.5 ${
                  selectedTierFilter === t.id
                    ? `${style.bg} ${style.text} ${style.border} border shadow-md`
                    : 'bg-black/40 text-slate-400 hover:text-white border border-white/5'
                }`}
              >
                <span>{t.name}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/50 font-mono opacity-80">
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Empty State: If user has 0 favorites or all un-hearted */}
        {favoriteGamesList.length === 0 ? (
          <div className="p-12 rounded-3xl bg-slate-900/60 border border-indigo-500/20 backdrop-blur-xl text-center space-y-5 max-w-xl mx-auto my-12 shadow-2xl">
            <div className="w-16 h-16 rounded-3xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400 shadow-lg shadow-rose-950/40">
              <Heart className="w-8 h-8" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-xl font-black text-white">No Favorite Games Yet</h3>
              <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
                Click the heart icon on any game in the main Kreational game library to add it to your high-speed Favorites Vault for instant 1-click fullscreen play!
              </p>
            </div>
            <button
              onClick={() => {
                SFX.playClick();
                onReturnToKreational();
              }}
              className="px-6 py-3 rounded-2xl bg-gradient-to-r from-indigo-500 via-purple-600 to-indigo-500 hover:from-indigo-400 hover:to-purple-500 text-white font-black text-xs uppercase tracking-wider shadow-xl shadow-indigo-950/60 cursor-pointer flex items-center gap-2 mx-auto transition-transform active:scale-95"
            >
              <Gamepad2 className="w-4 h-4" />
              <span>Explore Game Library</span>
            </button>
          </div>
        ) : filteredFavorites.length === 0 ? (
          /* Search Empty State */
          <div className="p-8 rounded-2xl bg-slate-900/50 border border-white/10 text-center text-slate-400 space-y-2">
            <Search className="w-6 h-6 mx-auto text-slate-500" />
            <p className="text-xs font-bold">No favorite games match "{searchQuery}"</p>
            <button
              onClick={() => setSearchQuery('')}
              className="text-xs text-indigo-400 hover:underline cursor-pointer"
            >
              Clear filter
            </button>
          </div>
        ) : (
          /* Favorites Render Views */
          <div>
            {/* Spotlight Hero (Top favorite game featured banner if in grid/cinema mode) */}
            {viewMode !== 'bento' && filteredFavorites.length > 0 && !searchQuery && selectedTierFilter === 'all' && (
              <div className="p-6 rounded-3xl bg-gradient-to-r from-slate-900/90 via-indigo-950/60 to-purple-950/60 border border-indigo-500/30 backdrop-blur-xl shadow-2xl mb-6 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden group">
                <div className="space-y-2 z-10 text-left">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-mono font-black flex items-center gap-1">
                      <Star className="w-3 h-3 fill-rose-400 text-rose-400" />
                      VAULT SPOTLIGHT
                    </span>
                    <span className="text-[10px] font-mono text-indigo-300/80 uppercase">
                      Fast 1-Click Launch
                    </span>
                  </div>
                  <h3 className="text-2xl font-black text-white">{filteredFavorites[0].title}</h3>
                  <p className="text-xs text-slate-300 max-w-lg">
                    Launch your primary starred game in instant fullscreen mode with optimal rendering performance.
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0 z-10 w-full md:w-auto">
                  <button
                    onClick={() => handleLaunchGame(filteredFavorites[0], true)}
                    className="flex-1 md:flex-none px-6 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-950/50 cursor-pointer flex items-center justify-center gap-2 transition-transform active:scale-95"
                  >
                    <Play className="w-4 h-4 fill-white" />
                    <span>Launch Fullscreen</span>
                  </button>

                  <button
                    onClick={(e) => handleToggleFavorite(filteredFavorites[0].id, e)}
                    className="p-3.5 rounded-2xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 cursor-pointer transition-all"
                    title="Remove from favorites"
                  >
                    <Heart className="w-4 h-4 fill-rose-400 text-rose-400" />
                  </button>
                </div>
              </div>
            )}

            {/* Standard Grid Mode */}
            {viewMode === 'grid' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredFavorites.map((game, idx) => {
                  const style = getTierColorStyle(game.tier);
                  const isFav = favoriteIds.includes(game.id);
                  const note = gameNotes[game.id] || '';

                  return (
                    <motion.div
                      key={game.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(idx * 0.03, 0.3), duration: 0.25 }}
                      whileHover={{ scale: 1.02, y: -3 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => handleLaunchGame(game, true)}
                      className={`p-5 rounded-2xl bg-slate-900/80 hover:bg-slate-900 border ${style.border} ${style.glow} transition-all duration-200 cursor-pointer group flex flex-col justify-between space-y-4 shadow-lg relative overflow-hidden`}
                    >
                      {/* Top Header Card */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1 min-w-0">
                          <span className={`px-2 py-0.5 rounded-md text-[9px] font-mono uppercase font-black border ${style.border} ${style.text} ${style.bg}`}>
                            {game.tier}
                          </span>
                          <h4 className="text-base font-black text-white truncate group-hover:text-indigo-200 transition-colors">
                            {game.title}
                          </h4>
                        </div>

                        {/* Heart Button */}
                        <motion.button
                          whileTap={{ scale: 0.8 }}
                          onClick={(e) => handleToggleFavorite(game.id, e)}
                          className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/30 text-rose-400 border border-rose-500/30 transition-all cursor-pointer shrink-0"
                          title="Heart / Unheart"
                        >
                          <Heart className={`w-4 h-4 ${isFav ? 'fill-rose-400 text-rose-400' : 'text-slate-400'}`} />
                        </motion.button>
                      </div>

                      {/* Card Middle: Preview / Notes Snippet */}
                      <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1.5">
                        <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                          <span className="flex items-center gap-1 text-emerald-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            Ready
                          </span>
                          <span className="text-indigo-300">1-Click Launch</span>
                        </div>

                        {note ? (
                          <p className="text-[11px] text-slate-300 line-clamp-2 italic">
                            "{note}"
                          </p>
                        ) : (
                          <p className="text-[10px] text-slate-500 italic">
                            No notes added. Click note icon to add tips.
                          </p>
                        )}
                      </div>

                      {/* Bottom Actions */}
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLaunchGame(game, true);
                          }}
                          className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-black text-xs uppercase tracking-wider shadow-md cursor-pointer flex items-center justify-center gap-1.5 transition-transform active:scale-95"
                        >
                          <Play className="w-3.5 h-3.5 fill-white" />
                          <span>Play Game</span>
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedNoteGameId(selectedNoteGameId === game.id ? null : game.id);
                          }}
                          className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/10 cursor-pointer transition-all"
                          title="Edit Personal Note"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Expandable Note Box */}
                      {selectedNoteGameId === game.id && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="p-3 rounded-xl bg-black/80 border border-indigo-500/40 space-y-2 mt-2"
                        >
                          <div className="flex items-center justify-between text-[10px] text-indigo-300 font-bold">
                            <span>Personal Game Note</span>
                            {noteSavedId === game.id && (
                              <span className="text-emerald-400 flex items-center gap-0.5">
                                <Check className="w-3 h-3" /> Saved
                              </span>
                            )}
                          </div>
                          <textarea
                            value={gameNotes[game.id] || ''}
                            onChange={(e) => handleSaveNote(game.id, e.target.value)}
                            placeholder="Write personal tips, high scores, or shortcuts..."
                            className="w-full p-2 rounded-lg bg-black/60 border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-400"
                            rows={2}
                          />
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* Bento / Compact Mode */}
            {viewMode === 'bento' && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {filteredFavorites.map((game) => {
                  const style = getTierColorStyle(game.tier);
                  return (
                    <div
                      key={game.id}
                      onClick={() => handleLaunchGame(game, true)}
                      className={`p-4 rounded-2xl bg-slate-900/80 hover:bg-slate-900 border ${style.border} ${style.glow} flex flex-col justify-between gap-3 cursor-pointer group transition-all duration-200 hover:-translate-y-0.5 shadow-md`}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span className={`px-1.5 py-0.2 rounded text-[8px] font-mono uppercase font-black border ${style.border} ${style.text} ${style.bg}`}>
                          {game.tier}
                        </span>
                        <button
                          onClick={(e) => handleToggleFavorite(game.id, e)}
                          className="text-rose-400 hover:scale-110 transition-transform cursor-pointer"
                        >
                          <Heart className="w-3.5 h-3.5 fill-rose-400" />
                        </button>
                      </div>

                      <div className="min-w-0">
                        <div className="text-xs font-black text-white truncate group-hover:text-indigo-300 transition-colors">
                          {game.title}
                        </div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleLaunchGame(game, true);
                        }}
                        className="w-full py-1.5 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-200 border border-indigo-400/30 text-[10px] font-black uppercase flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Play className="w-2.5 h-2.5 fill-current" />
                        <span>Launch</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Cinema Showcase Mode */}
            {viewMode === 'cinema' && (
              <div className="space-y-4">
                {filteredFavorites.map((game) => {
                  const style = getTierColorStyle(game.tier);
                  return (
                    <div
                      key={game.id}
                      onClick={() => handleLaunchGame(game, true)}
                      className={`p-5 rounded-2xl bg-slate-900/80 hover:bg-slate-900 border ${style.border} ${style.glow} flex flex-col sm:flex-row items-center justify-between gap-4 cursor-pointer group transition-all`}
                    >
                      <div className="flex items-center gap-4 min-w-0 w-full sm:w-auto">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-400/40 flex items-center justify-center font-black text-indigo-300 shrink-0">
                          <Gamepad2 className="w-6 h-6" />
                        </div>
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded-md text-[9px] font-mono uppercase font-black border ${style.border} ${style.text} ${style.bg}`}>
                              {game.tier}
                            </span>
                            <h4 className="text-base font-black text-white truncate group-hover:text-indigo-200">
                              {game.title}
                            </h4>
                          </div>
                          <p className="text-xs text-slate-400">
                            Fast Fullscreen Arcade Embed • Ready to stream
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 w-full sm:w-auto justify-end">
                        <button
                          onClick={(e) => handleToggleFavorite(game.id, e)}
                          className="p-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/30 text-rose-400 border border-rose-500/30 cursor-pointer"
                        >
                          <Heart className="w-4 h-4 fill-rose-400" />
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLaunchGame(game, true);
                          }}
                          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-black text-xs uppercase flex items-center gap-1.5 cursor-pointer shadow-md"
                        >
                          <Play className="w-3.5 h-3.5 fill-white" />
                          <span>Play Now</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Unobtrusive Bottom Bar with Exit and Vault Info */}
      <footer className="py-4 px-6 border-t border-white/5 bg-black/40 backdrop-blur-md flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-mono text-[11px]">Kreational Favorites Vault • Active Session</span>
        </div>

        <button
          onClick={() => {
            SFX.playClick();
            onReturnToKreational();
          }}
          className="text-indigo-300 hover:text-white font-bold flex items-center gap-1 cursor-pointer transition-colors"
        >
          <span>Return to Game Library</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </footer>
    </div>
  );
};
