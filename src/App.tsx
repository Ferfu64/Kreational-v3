import React, { useState, useEffect } from 'react';
import { User, Tier, TierId, Game } from './types';
import { LoginScreen } from './components/LoginScreen';
import { Navbar } from './components/Navbar';
import { TierSelector } from './components/TierSelector';
import { GameGrid } from './components/GameGrid';
import { GameModal } from './components/GameModal';
import { RequestModal } from './components/RequestModal';
import { RequestHistoryModal } from './components/RequestHistoryModal';
import { AccountManagementPanel } from './components/AccountManagementPanel';
import { RequestsPanel } from './components/RequestsPanel';
import { GameManagementPanel } from './components/GameManagementPanel';
import { SettingsModal, UserSettings, DEFAULT_SETTINGS } from './components/SettingsModal';
import { BrandingFooter } from './components/BrandingFooter';
import { LoadingScreen } from './components/LoadingScreen';
import { DEFAULT_GAMES } from './data/defaultGames';
import { KREATOR_ADMIN_USER } from './utils/localAuth';
import {
  fetchAllGamesStore,
  fetchAllRequestsStore,
  fetchAllUsers,
} from './services/firestoreStore';
import { AssistantProvider } from './assistant/AssistantContext';
import { AssistantFloatingButton } from './assistant/AssistantFloatingButton';
import { AssistantControlsModal } from './assistant/AssistantControlsModal';
import { ChalkboardModal } from './assistant/ChalkboardModal';
import { ArcadeContextManager } from './assistant/ArcadeContextManager';

const INITIAL_TIERS: Tier[] = [
  { id: 'bronze', name: 'Bronze', displayOrder: 1 },
  { id: 'silver', name: 'Silver', displayOrder: 2 },
  { id: 'gold', name: 'Gold', displayOrder: 3 },
  { id: 'diamond', name: 'Diamond', displayOrder: 4 },
  { id: 'mythic', name: 'Mythic', displayOrder: 5 },
  { id: 'legendary', name: 'Legendary', displayOrder: 6 },
  { id: 'master', name: 'Master', displayOrder: 7 },
  { id: 'pro', name: 'Pro', displayOrder: 8 },
  { id: 'blocked', name: 'AZGAMES', displayOrder: 99 },
];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  // Online / Offline Status
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  // User Settings State
  const [userSettings, setUserSettings] = useState<UserSettings>(() => {
    try {
      const stored = localStorage.getItem('kreational_user_settings');
      return stored ? JSON.parse(stored) : DEFAULT_SETTINGS;
    } catch (e) {
      return DEFAULT_SETTINGS;
    }
  });

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Modals
  const [playingGame, setPlayingGame] = useState<Game | null>(null);

  // Update DOM attributes dynamically when userSettings, playingGame, or user changes
  useEffect(() => {
    const root = document.documentElement;
    // Apply visual theme to the background of the site ONLY when logged in and NOT playing a game
    if (user && !playingGame) {
      root.setAttribute('data-theme', userSettings.theme);
    } else {
      root.removeAttribute('data-theme');
    }
    root.setAttribute('data-glass', userSettings.glassStyle);
    root.setAttribute('data-density', userSettings.density);

    try {
      localStorage.setItem('kreational_user_settings', JSON.stringify(userSettings));
    } catch (e) {
      console.warn('Failed to save user settings:', e);
    }
  }, [userSettings, playingGame, user]);

  // App Data
  const [tiers, setTiers] = useState<Tier[]>(INITIAL_TIERS);
  const [games, setGames] = useState<Game[]>(DEFAULT_GAMES);
  const [selectedTierId, setSelectedTierId] = useState<TierId>('bronze');
  const [serverTimeOffset, setServerTimeOffset] = useState<number>(0);
  const [pendingRequestsCount, setPendingRequestsCount] = useState<number>(0);

  // Active View Tab
  const [activeTab, setActiveTab] = useState<'games' | 'admin-accounts' | 'admin-requests' | 'admin-games'>('games');

  // Modals
  const [requestModal, setRequestModal] = useState<{
    isOpen: boolean;
    type: 'tier' | 'single_game';
    targetTier?: Tier | null;
    targetGame?: Game | null;
  }>({ isOpen: false, type: 'tier' });
  const [isRequestHistoryOpen, setIsRequestHistoryOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Sync Server Time
  const syncServerTime = async () => {
    setServerTimeOffset(0);
  };

  // Restore Session
  useEffect(() => {
    syncServerTime();

    const storedUser = localStorage.getItem('kreational_user') || localStorage.getItem('kreations_user');
    const storedToken = localStorage.getItem('kreational_token') || localStorage.getItem('kreations_token');

    if (storedUser && storedToken) {
      try {
        const parsed = JSON.parse(storedUser);
        setUser(parsed);
        setToken(storedToken);
        // Refresh user profile from Firestore
        fetchAllUsers().then((allUsers) => {
          const match = allUsers.find(
            (u) => u.id === parsed.id || u.username.toLowerCase() === parsed.username.toLowerCase()
          );
          if (match) {
            setUser(match);
            localStorage.setItem('kreational_user', JSON.stringify(match));
          }
        }).catch(console.error);
      } catch (err) {
        localStorage.removeItem('kreational_user');
        localStorage.removeItem('kreational_token');
        localStorage.removeItem('kreations_user');
        localStorage.removeItem('kreations_token');
      }
    }
    setLoadingAuth(false);
  }, []);

  // Fetch Tiers & Games
  const fetchTiersAndGames = async () => {
    try {
      const storeGames = await fetchAllGamesStore();
      if (Array.isArray(storeGames) && storeGames.length > 0) {
        setGames(storeGames);
      }
    } catch (err) {
      console.error('Error fetching games store:', err);
    }
  };

  useEffect(() => {
    fetchTiersAndGames();
  }, []);

  // Fetch Pending Requests Count for Kreator
  const fetchPendingRequestsCount = async () => {
    if (!user || (user.role !== 'admin' && user.username !== 'Kreator')) return;
    try {
      const allReqs = await fetchAllRequestsStore();
      const pendingCount = allReqs.filter((r) => r.status === 'pending').length;
      setPendingRequestsCount(pendingCount);
    } catch (err) {
      console.warn('Error fetching pending requests count:', err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchTiersAndGames();
      fetchPendingRequestsCount();
    }
  }, [user]);

  // Handle Login Success
  const handleLoginSuccess = (newUser: User, newToken: string) => {
    setUser(newUser);
    setToken(newToken);
    localStorage.setItem('kreational_user', JSON.stringify(newUser));
    localStorage.setItem('kreational_token', newToken);
  };

  // Global "Override" typing bypass listener when not focused in an input box
  useEffect(() => {
    let keyBuffer = '';
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        (activeEl as HTMLElement)?.isContentEditable;

      if (isInput) return;

      if (e.key && e.key.length === 1) {
        keyBuffer = (keyBuffer + e.key).slice(-20);
        if (keyBuffer.toLowerCase().endsWith('override')) {
          keyBuffer = '';
          handleLoginSuccess(KREATOR_ADMIN_USER, `token-kreator-${Date.now()}`);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handle Logout
  const handleLogout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('kreational_user');
    localStorage.removeItem('kreational_token');
    localStorage.removeItem('kreations_user');
    localStorage.removeItem('kreations_token');
    setActiveTab('games');
  };

  // Refresh current user profile
  const refreshUserProfile = async () => {
    if (!user) return;
    try {
      const allUsers = await fetchAllUsers();
      const match = allUsers.find(
        (u) => u.id === user.id || u.username.toLowerCase() === user.username.toLowerCase()
      );
      if (match) {
        setUser(match);
        localStorage.setItem('kreational_user', JSON.stringify(match));
      }
    } catch (err) {
      console.warn('User profile refresh failed:', err);
    }
  };

  useEffect(() => {
    ArcadeContextManager.setSelectedTier(selectedTierId);
  }, [selectedTierId]);

  if (loadingAuth) {
    return <LoadingScreen message="INITIALIZING KREATIONAL" subMessage="Verifying credentials & session..." />;
  }

  if (!user) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  const selectedTier = tiers.find((t) => t.id === selectedTierId) || tiers[0] || INITIAL_TIERS[0];
  const currentTierGames = games.filter((g) => g.tier === selectedTierId);

  const canUserAccessGame = (game: Game): boolean => {
    if (!user) return false;
    const isAdmin = user.role === 'admin' || user.username === 'Kreator' || user.id === 'kreator-admin-id';
    if (isAdmin) return true;

    const userPurchasedTiers = user.purchasedTiers || [];
    if (userPurchasedTiers.includes(game.tier)) return true;

    const now = Date.now() - serverTimeOffset;
    const tempAccess = (user.temporaryAccess || []).find(
      (ta) => (ta.gameId && ta.gameId === game.id) || (ta.tierId && ta.tierId === game.tier)
    );
    if (tempAccess) {
      const expiresAt = Number(tempAccess.grantedAt) + Number(tempAccess.durationSeconds) * 1000;
      if (now < expiresAt) return true;
    }

    return false;
  };

  const handleOpenGameByName = (gameQuery: string) => {
    let query = gameQuery.toLowerCase().trim();
    if (!query || !games || games.length === 0) {
      return { success: false, reason: "I couldn't find that game." };
    }

    // Clean common vocal prefixes/suffixes like "a", "an", "the", "game", "games"
    const cleaned = query
      .replace(/^(a|an|the)\s+/i, '')
      .replace(/\s+(game|games)$/i, '')
      .trim();

    // 1. Exact title match
    let matched = games.find(
      (g) => g.title.toLowerCase() === query || g.title.toLowerCase() === cleaned
    );

    // 2. Substring match on title
    if (!matched && cleaned) {
      matched = games.find(
        (g) => g.title.toLowerCase().includes(cleaned) || cleaned.includes(g.title.toLowerCase())
      );
    }

    // 3. Category / Keyword fallback mapping (e.g., "racing game" -> MotoSpace Racing)
    if (!matched && cleaned) {
      const keywordMap: Record<string, string[]> = {
        racing: ['racing', 'racer', 'truck', 'moto', 'car', 'drive', 'speed', 'hills'],
        puzzle: ['puzzle', 'maze', 'wordle', 'circloo', 'stack', 'dragbox'],
        shooting: ['shoot', 'gun', 'strike', 'sniper', 'recoil', 'shot', 'defence'],
        ninja: ['ninja'],
        golf: ['golf'],
        soccer: ['soccer', 'ball', 'brawl'],
        tank: ['tank'],
        space: ['space', 'laser', 'waves'],
        action: ['brawl', 'ninja', 'strike', 'recoil', 'shoot'],
      };

      for (const [key, terms] of Object.entries(keywordMap)) {
        if (terms.some((t) => cleaned.includes(t)) || cleaned.includes(key)) {
          matched = games.find((g) => terms.some((t) => g.title.toLowerCase().includes(t)));
          if (matched) break;
        }
      }
    }

    if (matched) {
      if (!canUserAccessGame(matched)) {
        const tierObj = tiers.find((t) => t.id === matched.tier);
        const tierName = tierObj ? tierObj.name : matched.tier;
        return {
          success: false,
          reason: `Access denied. You do not have access to ${matched.title}. Unlock ${tierName} tier or request access.`,
        };
      }
      setPlayingGame(matched);
      return { success: true, gameName: matched.title };
    }
    return { success: false, reason: "I couldn't find that game." };
  };

  const handleOpenRandomGame = () => {
    if (!games || games.length === 0) {
      return { success: false, reason: 'No games available.' };
    }
    const accessibleGames = games.filter((g) => canUserAccessGame(g));
    if (accessibleGames.length === 0) {
      return { success: false, reason: 'You do not have access to any games in this library. Please request access first.' };
    }
    const randomIndex = Math.floor(Math.random() * accessibleGames.length);
    const chosen = accessibleGames[randomIndex];
    setPlayingGame(chosen);
    return { success: true, gameName: chosen.title };
  };

  const handleCloseCurrentGame = () => {
    const hasCloseBtn =
      typeof document !== 'undefined' &&
      Boolean(document.getElementById('game-modal-close-button') || document.getElementById('game-modal-overlay'));
    const isInGame = Boolean(playingGame);

    console.log(
      '[Kreational Assistant Game State Check] isInGame state:',
      isInGame,
      '| DOM modal visible:',
      hasCloseBtn,
      '| Matches:',
      isInGame === hasCloseBtn
    );

    if (isInGame || hasCloseBtn) {
      const name = playingGame?.title || 'Current Game';
      setPlayingGame(null);
      if (typeof document !== 'undefined') {
        const btn = document.getElementById('game-modal-close-button') as HTMLButtonElement | null;
        if (btn) {
          btn.click();
        }
      }
      return { success: true, gameName: name };
    }
    return { success: false, reason: 'Request failed. You are currently not in a game.' };
  };

  const handleShowTier = (tierTarget: string | number) => {
    const targetStr = String(tierTarget).toLowerCase().trim();

    // Parse numeric tier if present (e.g., "Tier 2", "2")
    const numMatch = targetStr.match(/\d+/);
    let matchedTier: Tier | undefined;

    if (numMatch) {
      const num = parseInt(numMatch[0], 10);
      matchedTier = tiers.find((t) => t.displayOrder === num) || tiers[num - 1];
    }

    if (!matchedTier) {
      matchedTier = tiers.find(
        (t) => t.name.toLowerCase() === targetStr || t.id.toLowerCase() === targetStr || targetStr.includes(t.name.toLowerCase())
      );
    }

    if (matchedTier) {
      setSelectedTierId(matchedTier.id);
      setActiveTab('games');
      return { success: true, tierName: matchedTier.name };
    }
    return { success: false, reason: "I couldn't find that tier." };
  };

  return (
    <AssistantProvider
      enabledInSettings={userSettings.enableAssistant ?? false}
      user={user}
      enablePersonalizedGreetings={userSettings.enablePersonalizedGreetings ?? true}
      onUpdateSettingsEnabled={(enabled) => {
        setUserSettings((prev) => ({ ...prev, enableAssistant: enabled }));
      }}
      onNavigateHome={() => {
        setActiveTab('games');
        setPlayingGame(null);
      }}
      onOpenSettings={() => {
        setIsSettingsOpen(true);
      }}
      games={games}
      tiers={tiers}
      currentlyPlayingGame={playingGame}
      onOpenGameByName={handleOpenGameByName}
      onOpenRandomGame={handleOpenRandomGame}
      onCloseCurrentGame={handleCloseCurrentGame}
      onShowTier={handleShowTier}
    >
      <div id="app-root" className={`min-h-screen ${user && !playingGame ? 'bg-transparent' : 'bg-[#050505]'} text-slate-100 flex flex-col font-sans relative overflow-x-hidden selection:bg-purple-500/30 selection:text-purple-200`}>
        {/* Background ambient lighting for Frosted Glass theme */}
        <div className="fixed -top-32 -left-32 w-96 h-96 bg-purple-600/15 rounded-full blur-[120px] pointer-events-none" />
        <div className="fixed top-1/3 -right-32 w-96 h-96 bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="fixed -bottom-32 left-1/3 w-96 h-96 bg-purple-900/15 rounded-full blur-[120px] pointer-events-none" />

        {/* Navbar */}
        <Navbar
          user={user}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onOpenRequestsHistory={() => setIsRequestHistoryOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onLogout={handleLogout}
          pendingRequestsCount={pendingRequestsCount}
          isOnline={isOnline}
        />

        {/* Main Content View */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          {activeTab === 'games' && (
            <div className="space-y-6">
              {/* Tier Selector */}
              <TierSelector
                tiers={tiers}
                selectedTierId={selectedTierId}
                onSelectTier={(tid) => setSelectedTierId(tid)}
                userPurchasedTiers={user.purchasedTiers || []}
                isAdmin={user.role === 'admin' || user.username === 'Kreator'}
                onRequestTierAccess={(tier) => {
                  setRequestModal({
                    isOpen: true,
                    type: 'tier',
                    targetTier: tier,
                  });
                }}
              />

              {/* Game Grid */}
              <GameGrid
                selectedTier={selectedTier}
                games={currentTierGames}
                allGames={games}
                tiers={tiers}
                user={user}
                onPlayGame={(game) => setPlayingGame(game)}
                onRequestGameAccess={(game) => {
                  setRequestModal({
                    isOpen: true,
                    type: 'single_game',
                    targetGame: game,
                  });
                }}
                onRequestTierAccess={(tier) => {
                  setRequestModal({
                    isOpen: true,
                    type: 'tier',
                    targetTier: tier,
                  });
                }}
                serverTimeOffset={serverTimeOffset}
                enableSearchBar={userSettings.enableSearchBar}
              />
            </div>
          )}

          {activeTab === 'admin-accounts' && (
            <AccountManagementPanel
              tiers={tiers}
              onAccountsUpdated={() => {
                refreshUserProfile();
                fetchPendingRequestsCount();
              }}
            />
          )}

          {activeTab === 'admin-requests' && (
            <RequestsPanel
              onRequestsUpdated={() => {
                refreshUserProfile();
                fetchPendingRequestsCount();
              }}
            />
          )}

          {activeTab === 'admin-games' && (
            <GameManagementPanel
              tiers={tiers}
              onGamesUpdated={() => {
                fetchTiersAndGames();
              }}
            />
          )}
        </main>

        {/* Unobtrusive Branding Footer on regular pages */}
        <BrandingFooter variant="unobtrusive" />

        {/* Assistant Floating Action Button */}
        <AssistantFloatingButton />

        {/* Assistant Controls & Permissions Modal */}
        <AssistantControlsModal />

        {/* Chalkboard Pop-up UI when Board Mode is Active */}
        <ChalkboardModal />

        {/* Active Game Play Modal */}
        {playingGame && (
          <GameModal
            game={playingGame}
            user={user}
            onClose={() => setPlayingGame(null)}
            serverTimeOffset={serverTimeOffset}
          />
        )}

        {/* Access Request Modal */}
        {requestModal.isOpen && (
          <RequestModal
            type={requestModal.type}
            targetTier={requestModal.targetTier}
            targetGame={requestModal.targetGame}
            user={user}
            onClose={() => setRequestModal({ isOpen: false, type: 'tier' })}
            onRequestSubmitted={() => {
              fetchPendingRequestsCount();
            }}
          />
        )}

        {/* User Request History Modal */}
        {isRequestHistoryOpen && (
          <RequestHistoryModal
            user={user}
            onClose={() => setIsRequestHistoryOpen(false)}
          />
        )}

        {/* App Customization & Settings Modal */}
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          isOnline={isOnline}
          settings={userSettings}
          onUpdateSettings={setUserSettings}
          onSyncOfflineData={() => {
            fetchTiersAndGames();
            fetchPendingRequestsCount();
            refreshUserProfile();
          }}
        />
      </div>
    </AssistantProvider>
  );
}
