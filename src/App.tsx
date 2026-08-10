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
import { ProfileModal } from './components/ProfileModal';
import { ShopModal } from './components/ShopModal';
import { InventoryModal } from './components/InventoryModal';
import { MarketplacePage } from './components/MarketplacePage';
import { BrandingFooter } from './components/BrandingFooter';
import { LoadingScreen } from './components/LoadingScreen';
import {
  KreditGainAnimation,
  KreditGainEvent,
} from './components/KreditGainAnimation';
import {
  recordGamePlayedInQuests,
  recordOnlineTimeMinutesInQuests,
  recordGameTimeMinutesInQuests,
} from './utils/questManager';
import { SFX } from './utils/sfx';
import { DEFAULT_GAMES } from './data/defaultGames';
import { KREATOR_ADMIN_USER } from './utils/localAuth';
import { safeGet, safeSet, safeRemove } from './utils/persistentStorage';
import { normalizeUserWithProfile } from './utils/userProfile';
import {
  fetchAllGamesStore,
  fetchAllRequestsStore,
  fetchAllUsers,
  getUserDocFromFirestore,
  subscribeToUserDoc,
  updateUserAccount,
  authenticateAccount,
  saveFullUserAccountToFirestore,
  generateDatastoreSnapshot,
  applyDatastoreSnapshot,
} from './services/firestoreStore';
import { AssistantProvider } from './assistant/AssistantContext';
import { AssistantFloatingButton } from './assistant/AssistantFloatingButton';
import { AssistantControlsModal } from './assistant/AssistantControlsModal';
import { ChalkboardModal } from './assistant/ChalkboardModal';
import { ArcadeContextManager } from './assistant/ArcadeContextManager';
import { ApprovalNotifications } from './components/ApprovalNotifications';
import { GlobalAnnouncementBanner } from './components/GlobalAnnouncementBanner';
import { AZGamesChallengesModal } from './components/AZGamesChallengesModal';
import { KreatorFunPanel } from './components/KreatorFunPanel';
import { KrozeZone } from './components/KrozeZone';
import { GlobalCallAndMessageManager } from './components/GlobalCallAndMessageManager';
import { NotificationToastContainer } from './components/NotificationToastContainer';
import { NotificationDrawer } from './components/NotificationDrawer';
import {
  fetchAllListings,
  createListingInStore,
  placeBidInStore,
  cashOutListingInStore,
} from './services/marketplaceStore';
import { runBotMarketplaceSimulation } from './services/marketplaceBots';

const INITIAL_TIERS: Tier[] = [
  { id: 'bronze', name: 'Bronze', displayOrder: 1 },
  { id: 'silver', name: 'Silver', displayOrder: 2 },
  { id: 'gold', name: 'Gold', displayOrder: 3 },
  { id: 'diamond', name: 'Diamond', displayOrder: 4 },
  { id: 'mythic', name: 'Mythic', displayOrder: 5 },
  { id: 'legendary', name: 'Legendary', displayOrder: 6 },
  { id: 'master', name: 'Master', displayOrder: 7 },
  { id: 'pro', name: 'Pro', displayOrder: 8 },
  { id: 'azgames', name: 'AZGAMES', displayOrder: 99 },
];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [kreditGainEvents, setKreditGainEvents] = useState<KreditGainEvent[]>([]);
  const [playingGame, setPlayingGame] = useState<Game | null>(null);

  // Refs for background intervals and beforeunload handlers
  const userRef = React.useRef<User | null>(null);
  userRef.current = user;

  const playingGameRef = React.useRef<Game | null>(null);
  playingGameRef.current = playingGame;

  const handleTriggerKreditGain = (amount: number, sourceX?: number, sourceY?: number) => {
    SFX.playCoin();
    const newEvent: KreditGainEvent = {
      id: `kredit_gain_${Date.now()}_${Math.random()}`,
      amount,
      sourceX,
      sourceY,
    };
    setKreditGainEvents((prev) => [...prev, newEvent]);
  };

  const handleKreditEventComplete = (id: string) => {
    setKreditGainEvents((prev) => prev.filter((e) => e.id !== id));
  };

  // Passive Krests earning: 2 Krests every 1 minute active on site + quest progression
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      setUser((currentUser) => {
        if (!currentUser) return null;
        const isBoosterActive =
          !!currentUser.krestBoosterExpiresAt &&
          currentUser.krestBoosterExpiresAt > Date.now();
        const earnedKrests = isBoosterActive ? 4 : 2;

        let updatedUser: User = {
          ...currentUser,
          krests: (currentUser.krests || 0) + earnedKrests,
        };

        // Record online time quest progress (+1 minute)
        updatedUser = recordOnlineTimeMinutesInQuests(updatedUser, 1);

        // Record game played time quest progress (+1 minute if active)
        if (playingGameRef.current) {
          updatedUser = recordGameTimeMinutesInQuests(updatedUser, 1);
        }

        safeSet('kreational_user', JSON.stringify(updatedUser));
        safeSet('kreational_current_user', JSON.stringify(updatedUser));
        saveFullUserAccountToFirestore(updatedUser).catch(() => {});
        handleTriggerKreditGain(earnedKrests);
        return updatedUser;
      });
    }, 60000);

    return () => clearInterval(interval);
  }, [user?.id]);

  // User Settings State
  const [userSettings, setUserSettings] = useState<UserSettings>(() => {
    try {
      const stored = safeGet('kreational_user_settings');
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

  const handlePlayGame = (game: Game) => {
    SFX.playClick();
    setPlayingGame(game);
    if (user) {
      const updatedUser = recordGamePlayedInQuests(user);
      handleUpdateUser(updatedUser);
    }
  };

  // Modals & Panels
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isShopOpen, setIsShopOpen] = useState(false);
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);
  const [isNotificationDrawerOpen, setIsNotificationDrawerOpen] = useState(false);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState<number>(0);

  // Kroze Zone & Kreator Fun States
  const [isKreatorFunOpen, setIsKreatorFunOpen] = useState(false);
  const [isAZChallengesOpen, setIsAZChallengesOpen] = useState(false);
  const [isKrozePage, setIsKrozePage] = useState(() => window.location.pathname === '/kroze');

  useEffect(() => {
    const handleLocationCheck = () => {
      setIsKrozePage(window.location.pathname === '/kroze');
    };
    window.addEventListener('popstate', handleLocationCheck);
    return () => window.removeEventListener('popstate', handleLocationCheck);
  }, []);

  // Real-time user document sync from Firestore server
  useEffect(() => {
    if (!user?.id) return;

    const unsubscribe = subscribeToUserDoc(user.id, (realtimeUser) => {
      const { updatedUser } = normalizeUserWithProfile(realtimeUser);
      setUser(updatedUser);
      safeSet('kreational_user', JSON.stringify(updatedUser));
    });

    const handleUserUpdated = () => {
      try {
        const stored = safeGet('kreational_user');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && userRef.current && parsed.id === userRef.current.id) {
            setUser(parsed);
          }
        }
      } catch (e) {}
    };

    window.addEventListener('user_updated', handleUserUpdated);

    return () => {
      unsubscribe();
      window.removeEventListener('user_updated', handleUserUpdated);
    };
  }, [user?.id]);

  // Poll unread notifications count from local storage
  useEffect(() => {
    const updateUnreadCount = () => {
      try {
        const stored = safeGet('kreational_user_notifications');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            const unread = parsed.filter((n: any) => !n.read).length;
            setUnreadNotificationsCount(unread);
          }
        }
      } catch (e) {}
    };

    updateUnreadCount();
    const interval = setInterval(updateUnreadCount, 3000);
    return () => clearInterval(interval);
  }, []);

  // Global background marketplace auto-bidding engine (runs even when offline or in other views)
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(async () => {
      try {
        const activeListings = await fetchAllListings();
        await runBotMarketplaceSimulation(
          activeListings,
          createListingInStore,
          placeBidInStore,
          cashOutListingInStore
        );
      } catch (e) {
        // Silent catch for background execution
      }
    }, 6000);
    return () => clearInterval(interval);
  }, [user?.id]);

  // Update DOM attributes dynamically when userSettings, playingGame, or user changes
  useEffect(() => {
    const root = document.documentElement;
    if (user && !playingGame) {
      root.setAttribute('data-theme', userSettings.theme);
    } else {
      root.removeAttribute('data-theme');
    }
    root.setAttribute('data-glass', userSettings.glassStyle);
    root.setAttribute('data-density', userSettings.density);

    try {
      safeSet('kreational_user_settings', JSON.stringify(userSettings));
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
  const [activeTab, setActiveTab] = useState<'games' | 'marketplace' | 'admin-accounts' | 'admin-requests' | 'admin-games'>(() => {
    const path = window.location.pathname.toLowerCase();
    if (path.includes('marketplace')) {
      return 'marketplace';
    }
    return 'games';
  });

  const handleSetActiveTab = (tab: 'games' | 'marketplace' | 'admin-accounts' | 'admin-requests' | 'admin-games') => {
    setActiveTab(tab);
    if (tab === 'marketplace') {
      if (!window.location.pathname.toLowerCase().includes('marketplace')) {
        window.history.pushState(null, '', '/Marketplace');
      }
    } else if (tab === 'games') {
      if (window.location.pathname.toLowerCase().includes('marketplace')) {
        window.history.pushState(null, '', '/');
      }
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname.toLowerCase();
      if (path.includes('marketplace')) {
        setActiveTab('marketplace');
      } else if (path === '/' || path === '' || path.includes('games')) {
        setActiveTab('games');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

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

  const handleUpdateUser = (updated: User) => {
    setUser(updated);
    safeSet('kreational_user', JSON.stringify(updated));
    safeSet('kreational_current_user', JSON.stringify(updated));
    saveFullUserAccountToFirestore(updated).catch(() => {});
  };

  // Auto-backup datastore on beforeunload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (userRef.current) {
        const snapshot = generateDatastoreSnapshot(userRef.current);
        const userWithBackup: User = {
          ...userRef.current,
          datastoreBackup: snapshot,
        };
        saveFullUserAccountToFirestore(userWithBackup).catch(() => {});
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // Restore Session
  useEffect(() => {
    syncServerTime();

    const storedUser = safeGet('kreational_user') || safeGet('kreations_user');
    const storedToken = safeGet('kreational_token') || safeGet('kreations_token');

    if (storedUser && storedToken) {
      try {
        const parsed: User = JSON.parse(storedUser);
        const { updatedUser } = normalizeUserWithProfile(parsed);

        if (parsed.datastoreBackup) {
          applyDatastoreSnapshot(parsed.datastoreBackup);
        }

        setUser(updatedUser);
        setToken(storedToken);

        // Refresh user profile directly from Firestore document by ID
        getUserDocFromFirestore(parsed.id)
          .then((freshDoc) => {
            if (freshDoc) {
              if (freshDoc.datastoreBackup) {
                applyDatastoreSnapshot(freshDoc.datastoreBackup);
              }
              const { updatedUser: freshUser } = normalizeUserWithProfile(freshDoc);
              setUser(freshUser);
              safeSet('kreational_user', JSON.stringify(freshUser));
            }
          })
          .catch(console.error);
      } catch (err) {
        safeRemove('kreational_user');
        safeRemove('kreational_token');
        safeRemove('kreations_user');
        safeRemove('kreations_token');
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
    if (newUser.datastoreBackup) {
      applyDatastoreSnapshot(newUser.datastoreBackup);
    }
    const { updatedUser } = normalizeUserWithProfile(newUser);
    setUser(updatedUser);
    setToken(newToken);
    safeSet('kreational_user', JSON.stringify(updatedUser));
    safeSet('kreational_current_user', JSON.stringify(updatedUser));
    safeSet('kreational_token', newToken);
    saveFullUserAccountToFirestore(updatedUser).catch(() => {});
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
          authenticateAccount('Kreator', 'Override').then((match) => {
            if (match) {
              handleLoginSuccess(match.user, match.token);
            } else {
              handleLoginSuccess(KREATOR_ADMIN_USER, `token-kreator-${Date.now()}`);
            }
          });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handle Logout
  const handleLogout = () => {
    if (userRef.current) {
      const snapshot = generateDatastoreSnapshot(userRef.current);
      const userWithBackup: User = {
        ...userRef.current,
        datastoreBackup: snapshot,
      };
      saveFullUserAccountToFirestore(userWithBackup).catch(() => {});
    }
    setUser(null);
    setToken(null);
    safeRemove('kreational_user');
    safeRemove('kreational_current_user');
    safeRemove('kreational_token');
    safeRemove('kreations_user');
    safeRemove('kreations_token');
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
        const { updatedUser } = normalizeUserWithProfile(match);
        setUser(updatedUser);
        safeSet('kreational_user', JSON.stringify(updatedUser));
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

    const cleaned = query
      .replace(/^(a|an|the)\s+/i, '')
      .replace(/\s+(game|games)$/i, '')
      .trim();

    let matched = games.find(
      (g) => g.title.toLowerCase() === query || g.title.toLowerCase() === cleaned
    );

    if (!matched && cleaned) {
      matched = games.find(
        (g) => g.title.toLowerCase().includes(cleaned) || cleaned.includes(g.title.toLowerCase())
      );
    }

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
      onOpenMarketplace={() => {
        handleSetActiveTab('marketplace');
      }}
      games={games}
      tiers={tiers}
      currentlyPlayingGame={playingGame}
      onOpenGameByName={handleOpenGameByName}
      onOpenRandomGame={handleOpenRandomGame}
      onCloseCurrentGame={handleCloseCurrentGame}
      onShowTier={handleShowTier}
    >
      {isKrozePage ? (
        <KrozeZone
          user={user}
          onUpdateUser={handleUpdateUser}
          onReturnToKreational={() => {
            window.history.pushState({}, '', '/');
            setIsKrozePage(false);
          }}
          onOpenAZChallenges={() => setIsAZChallengesOpen(true)}
        />
      ) : (
        <div id="app-root" className={`min-h-screen ${user && !playingGame ? 'bg-transparent' : 'bg-[#050505]'} text-slate-100 flex flex-col font-sans relative overflow-x-hidden selection:bg-purple-500/30 selection:text-purple-200`}>
          {/* Global Announcement Banner */}
          <GlobalAnnouncementBanner />

          {/* Background ambient lighting */}
          <div className="fixed -top-32 -left-32 w-96 h-96 bg-purple-600/15 rounded-full blur-[120px] pointer-events-none" />
          <div className="fixed top-1/3 -right-32 w-96 h-96 bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />
          <div className="fixed -bottom-32 left-1/3 w-96 h-96 bg-purple-900/15 rounded-full blur-[120px] pointer-events-none" />

          {/* Navbar */}
          {activeTab !== 'marketplace' && (
            <Navbar
              user={user}
              activeTab={activeTab}
              setActiveTab={handleSetActiveTab}
              onOpenRequestsHistory={() => setIsRequestHistoryOpen(true)}
              onOpenSettings={() => setIsSettingsOpen(true)}
              onOpenProfile={() => setIsProfileOpen(true)}
              onOpenShop={() => setIsShopOpen(true)}
              onOpenInventory={() => setIsInventoryOpen(true)}
              onOpenNotifications={() => setIsNotificationDrawerOpen(true)}
              onOpenKreatorFun={() => setIsKreatorFunOpen(true)}
              onOpenAZChallenges={() => setIsAZChallengesOpen(true)}
              onOpenKrozeZone={() => {
                window.history.pushState({}, '', '/kroze');
                setIsKrozePage(true);
              }}
              onLogout={handleLogout}
              pendingRequestsCount={pendingRequestsCount}
              unreadNotificationsCount={unreadNotificationsCount}
              isOnline={isOnline}
            />
          )}

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
                onOpenAZChallenges={() => setIsAZChallengesOpen(true)}
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
                onPlayGame={handlePlayGame}
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

          {activeTab === 'marketplace' && (
            <MarketplacePage
              user={user}
              onUpdateUser={handleUpdateUser}
              onNavigateHome={() => handleSetActiveTab('games')}
            />
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

        {/* Unobtrusive Branding Footer */}
        <BrandingFooter variant="unobtrusive" />

        {/* Access Approval Notifications (Headless system/push notifier) */}
        <ApprovalNotifications
          user={user}
          tiers={tiers}
          games={games}
          onSelectTier={(tierId) => {
            setSelectedTierId(tierId as TierId);
            setActiveTab('games');
          }}
          onPlayGame={handlePlayGame}
        />

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

        {/* Access Request & Krests Instant Unlock Modal */}
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
            onUpdateUser={handleUpdateUser}
            onPlayGame={(g) => setPlayingGame(g)}
          />
        )}

        {/* User Profile Modal */}
        {isProfileOpen && (
          <ProfileModal
            user={user}
            onUpdateUser={handleUpdateUser}
            onClose={() => setIsProfileOpen(false)}
            onOpenShop={() => setIsShopOpen(true)}
            onNavigateToMarketplace={() => handleSetActiveTab('marketplace')}
          />
        )}

        {/* Shop & Krates Modal */}
        {isShopOpen && (
          <ShopModal
            user={user}
            onUpdateUser={handleUpdateUser}
            onClose={() => setIsShopOpen(false)}
            onOpenProfile={() => setIsProfileOpen(true)}
            onTriggerKreditGain={handleTriggerKreditGain}
          />
        )}

        {/* User Collection & Inventory Modal */}
        <InventoryModal
          isOpen={isInventoryOpen}
          onClose={() => setIsInventoryOpen(false)}
          user={user}
          onUpdateUser={handleUpdateUser}
          onNavigateToMarketplace={() => handleSetActiveTab('marketplace')}
        />

        {/* Global Kredit Flying Coin Animation overlay */}
        <KreditGainAnimation
          events={kreditGainEvents}
          onEventComplete={handleKreditEventComplete}
        />

        {/* User Request History Modal */}
        {isRequestHistoryOpen && (
          <RequestHistoryModal
            user={user}
            onClose={() => setIsRequestHistoryOpen(false)}
          />
        )}

        {/* Global Real-Time Call and Message Manager Overlay */}
        <GlobalCallAndMessageManager currentUser={user} />

        {/* Notification Toast Container */}
        <NotificationToastContainer />

        {/* Notification Drawer History View */}
        <NotificationDrawer
          isOpen={isNotificationDrawerOpen}
          onClose={() => setIsNotificationDrawerOpen(false)}
        />

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

        {/* 25 AZGAMES Challenges Modal */}
        <AZGamesChallengesModal
          isOpen={isAZChallengesOpen}
          onClose={() => setIsAZChallengesOpen(false)}
          user={user}
          onUpdateUser={handleUpdateUser}
        />

        {/* Kreator Fun Admin Panel */}
        <KreatorFunPanel
          isOpen={isKreatorFunOpen}
          onClose={() => setIsKreatorFunOpen(false)}
          user={user}
          onUpdateUser={handleUpdateUser}
        />
      </div>
      )}
    </AssistantProvider>
  );
}
