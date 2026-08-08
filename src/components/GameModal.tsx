import React, { useState, useEffect } from 'react';
import { Game, User } from '../types';
import { safeGet, safeSet } from '../utils/persistentStorage';
import { saveFullUserAccountToFirestore } from '../services/firestoreStore';
import { X, Maximize2, Minimize2, ShieldAlert, Clock, RefreshCw, Gamepad2, FileText, Check, Heart } from 'lucide-react';

interface GameModalProps {
  game: Game | null;
  user: User;
  onClose: () => void;
  serverTimeOffset: number;
}

export const GameModal: React.FC<GameModalProps> = ({
  game,
  user,
  onClose,
  serverTimeOffset,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [gameNote, setGameNote] = useState<string>('');
  const [showNotes, setShowNotes] = useState<boolean>(false);
  const [noteSaved, setNoteSaved] = useState<boolean>(false);
  const [isFavorite, setIsFavorite] = useState<boolean>(false);

  // Check if current user is admin or owns tier
  const isAdmin =
    user.role === 'admin' ||
    user.username?.toLowerCase() === 'kreator' ||
    user.username?.toLowerCase() === 'admin' ||
    user.id === 'kreator-admin-id';

  const ownsTier = game ? (user.purchasedTiers || []).includes(game.tier) : false;
  const isUnlocked = isAdmin || ownsTier;

  const [verifying, setVerifying] = useState(!isUnlocked);
  const [accessGranted, setAccessGranted] = useState(isUnlocked);
  const [accessReason, setAccessReason] = useState<string>(isUnlocked ? (isAdmin ? 'admin' : 'tier') : '');
  const [remainingSecs, setRemainingSecs] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Server-sided effect for play history, note loading, and favorites
  useEffect(() => {
    if (!game || !accessGranted) return;
    try {
      // 1. Record play history in Firestore user profile
      const historyList = user.playHistory || [];
      if (!historyList.includes(game.id)) {
        const updatedHistory = [game.id, ...historyList.filter((id) => id !== game.id)].slice(0, 30);
        saveFullUserAccountToFirestore({ ...user, playHistory: updatedHistory }).catch(() => {});
      }

      // 2. Load game note from user profile
      const savedNote = user.gameNotes?.[game.id] || safeGet(`kreational_game_note_${game.id}`) || '';
      setGameNote(savedNote);

      // 3. Load favorite status from user profile
      const favs = user.favoriteGames || [];
      setIsFavorite(favs.includes(game.id));
    } catch (err) {
      console.warn('GameModal load effect warning:', err);
    }
  }, [game, accessGranted, user.favoriteGames]);

  const handleSaveNote = (text: string) => {
    setGameNote(text);
    if (!game) return;
    try {
      const updatedNotes = { ...(user.gameNotes || {}), [game.id]: text };
      saveFullUserAccountToFirestore({ ...user, gameNotes: updatedNotes }).catch(() => {});
      setNoteSaved(true);
      setTimeout(() => setNoteSaved(false), 2000);
    } catch (err) {
      console.warn('Failed to save note:', err);
    }
  };

  const toggleFavorite = () => {
    if (!game) return;
    try {
      const favs = user.favoriteGames || [];
      let updated: string[];
      if (favs.includes(game.id)) {
        updated = favs.filter((id) => id !== game.id);
        setIsFavorite(false);
      } else {
        updated = [...favs, game.id];
        setIsFavorite(true);
      }
      saveFullUserAccountToFirestore({ ...user, favoriteGames: updated }).catch(() => {});
    } catch (err) {
      console.warn('Failed to update favorites:', err);
    }
  };

  // Sync fullscreen state with document fullscreenchange event
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = () => {
    const container = document.getElementById('game-modal-container');
    if (!document.fullscreenElement) {
      if (container && container.requestFullscreen) {
        container.requestFullscreen().catch(() => {});
      } else if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    if (!game) return;

    let isMounted = true;
    const isAdminUser = user.role === 'admin' || user.username === 'Kreator';
    const ownsTier = (user.purchasedTiers || []).includes(game.tier as any);
    const tempPass = (user.temporaryAccess || []).find(
      (ta) => ta.gameId === game.id && ta.grantedAt + ta.durationSeconds * 1000 > Date.now() - serverTimeOffset
    );

    // Direct access for Admins or Tier Owners
    if (isUnlocked || isAdminUser || ownsTier) {
      setAccessGranted(true);
      setAccessReason(isAdminUser ? 'admin' : 'tier');
      setRemainingSecs(null);
      setErrorMessage(null);
      setVerifying(false);
      return;
    }

    if (tempPass) {
      const expiresAt = tempPass.grantedAt + tempPass.durationSeconds * 1000;
      setVerifying(false);
      setAccessGranted(true);
      setAccessReason('Temporary Access');
      setRemainingSecs(Math.max(0, Math.floor((expiresAt - (Date.now() - serverTimeOffset)) / 1000)));
      return;
    }

    // Access denied if neither tier access nor valid temporary access is present
    setVerifying(false);
    setAccessGranted(false);
    setErrorMessage('Access denied or expired.');

    return () => {
      isMounted = false;
    };
  }, [game, user.id, user.role, user.username, user.purchasedTiers, isUnlocked, isAdmin]);

  // Live countdown timer if temporary access
  useEffect(() => {
    if (remainingSecs === null || remainingSecs <= 0 || !accessGranted) return;

    const timer = setInterval(() => {
      setRemainingSecs((prev) => {
        if (prev === null || prev <= 1) {
          setAccessGranted(false);
          setErrorMessage('Your temporary access time for this game has expired.');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [remainingSecs, accessGranted]);

  if (!game) return null;

  // Helper to render embed code cleanly and handle both iframe strings and bare URLs
  const renderEmbed = (code: string | null | undefined) => {
    if (!code || code.trim() === '' || code.trim().toUpperCase() === 'PLACEHOLDER') {
      return (
        <div className="flex flex-col items-center justify-center p-8 text-center text-slate-400 font-mono text-sm space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-300">
            <Gamepad2 className="w-8 h-8" />
          </div>
          <p className="font-bold text-slate-100 text-base">{game.title}</p>
          <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
            This game is currently queued as a slot placeholder. No direct web embed URL has been assigned yet.
          </p>
        </div>
      );
    }

    const trimmed = code.trim();

    // Decode HTML entities
    let cleaned = trimmed
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');

    let targetUrl: string | null = null;

    // Detect if code is an <iframe> HTML tag string
    const isIframeTag = /^\s*<iframe/i.test(cleaned) || cleaned.toLowerCase().includes('<iframe');

    if (isIframeTag) {
      // Extract src attribute from <iframe> tag
      const srcMatch = cleaned.match(/src=["']([^"']+)["']/i) || cleaned.match(/src=([^\s>]+)/i);
      if (srcMatch && srcMatch[1]) {
        targetUrl = srcMatch[1].replace(/['"]/g, '');
      }
    } else {
      // Bare URL string
      targetUrl = cleaned;
    }

    // Process extracted or bare URL
    if (targetUrl) {
      if (targetUrl.startsWith('//')) {
        targetUrl = 'https:' + targetUrl;
      } else if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        targetUrl = 'https://' + targetUrl;
      }

      return (
        <iframe
          key={`game_iframe_${game.id}_${targetUrl}`}
          src={targetUrl}
          title={game.title}
          className="w-full h-full border-0 bg-black rounded-b-2xl sm:rounded-xl select-none object-cover"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; gamepad; fullscreen; focus-without-user-activation; microphone; camera; midi"
          allowFullScreen
          scrolling="no"
        />
      );
    }

    // Fallback for HTML iframe blocks without clear src match
    const sanitizedHtml = cleaned
      .replace(/width=["'][^"']*["']/gi, 'width="100%"')
      .replace(/height=["'][^"']*["']/gi, 'height="100%"');

    return (
      <div
        key={`game_html_${game.id}`}
        className="w-full h-full flex items-center justify-center bg-black rounded-b-2xl overflow-hidden [&>iframe]:w-full [&>iframe]:h-full [&>iframe]:border-0"
        dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
      />
    );
  };

  const formatTimer = (secs: number) => {
    const hours = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m ${s}s`;
    }
    return `${mins}m ${s}s`;
  };

  return (
    <div id="game-modal-overlay" className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl flex items-center justify-center p-2 sm:p-4">
      <div
        id="game-modal-container"
        className={`glass-modal flex flex-col transition-all duration-300 bg-slate-950 ${
          isFullscreen ? 'fixed inset-0 z-[100] w-screen h-screen rounded-none border-0' : 'w-full max-w-5xl h-[85vh]'
        }`}
      >
        {/* Modal Header */}
        <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between bg-white/[0.02] rounded-t-2xl shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-200 font-bold uppercase backdrop-blur-md">
              {game.tier} TIER
            </span>
            <h3 className="text-lg font-bold text-white font-mono tracking-tight">{game.title}</h3>

            {remainingSecs !== null && remainingSecs > 0 && accessGranted && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-mono font-bold active-timer animate-pulse backdrop-blur-md">
                <Clock className="w-3.5 h-3.5" />
                <span>Time Remaining: {formatTimer(remainingSecs)}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleFavorite}
              className={`p-2 rounded-xl transition-colors cursor-pointer ${
                isFavorite
                  ? 'text-rose-500 bg-rose-500/10 border border-rose-500/30'
                  : 'text-slate-400 hover:text-rose-400 hover:bg-white/10'
              }`}
              title={isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
            >
              <Heart className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
            </button>
            <button
              onClick={() => setShowNotes(!showNotes)}
              className={`p-2 rounded-xl transition-colors cursor-pointer ${
                showNotes || gameNote
                  ? 'text-amber-300 bg-amber-500/10 border border-amber-500/30'
                  : 'text-slate-400 hover:text-amber-300 hover:bg-white/10'
              }`}
              title="Game Notes & High Score (Saved in LocalStorage)"
            >
              <FileText className="w-4 h-4" />
            </button>
            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              id="game-modal-close-button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
              title="Close"
              aria-label="Close game"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Local Storage Notes Drawer */}
        {showNotes && (
          <div className="p-3.5 bg-slate-900/90 border-b border-white/10 flex flex-col gap-2 shrink-0 animate-fadeIn">
            <div className="flex items-center justify-between text-xs font-mono font-bold text-amber-300">
              <span className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" /> Game Notes & High Score (Local Storage)
              </span>
              {noteSaved && (
                <span className="text-emerald-400 text-[10px] flex items-center gap-1">
                  <Check className="w-3 h-3" /> Saved!
                </span>
              )}
            </div>
            <textarea
              value={gameNote}
              onChange={(e) => handleSaveNote(e.target.value)}
              placeholder="Type your notes, strategy, or high score here... (Auto-saved to LocalStorage)"
              rows={2}
              className="w-full p-2.5 bg-slate-950 border border-white/10 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50 resize-none font-mono"
            />
          </div>
        )}

        {/* Modal Body / Game Frame */}
        <div className="flex-1 w-full h-full bg-black relative overflow-hidden flex items-center justify-center p-0">
          {verifying ? (
            <div className="flex flex-col items-center justify-center p-8 max-w-sm text-center space-y-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center animate-pulse shadow-xl shadow-purple-900/30">
                  <Gamepad2 className="w-8 h-8 text-purple-400" />
                </div>
                <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-400 animate-ping" />
              </div>
              <div>
                <h4 className="text-base font-bold text-white font-mono tracking-tight">{game.title}</h4>
                <p className="text-xs text-purple-300 font-mono mt-0.5 uppercase tracking-wider font-semibold">
                  {game.tier} TIER
                </p>
              </div>
              <div className="w-48 h-1.5 bg-slate-900 rounded-full overflow-hidden border border-white/10">
                <div className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full animate-loading-bar" />
              </div>
              <p className="text-[11px] font-mono text-slate-400">Verifying authorization & loading game...</p>
            </div>
          ) : !accessGranted ? (
            <div className="p-6 max-w-md text-center space-y-4 bg-slate-900 border border-rose-900/60 rounded-2xl shadow-xl">
              <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto" />
              <div>
                <h4 className="text-lg font-bold text-rose-200">Access Restricted</h4>
                <p className="text-xs text-slate-400 mt-1">{errorMessage}</p>
              </div>
              <button
                onClick={onClose}
                className="w-full py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
              >
                Close Window
              </button>
            </div>
          ) : (
            renderEmbed(game.embedCode)
          )}
        </div>
      </div>
    </div>
  );
};
