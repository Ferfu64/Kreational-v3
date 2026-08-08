export type TierId =
  | 'bronze'
  | 'silver'
  | 'gold'
  | 'diamond'
  | 'mythic'
  | 'legendary'
  | 'master'
  | 'pro'
  | 'azgames';

export interface Tier {
  id: TierId;
  name: string;
  displayOrder: number;
}

export interface TemporaryAccess {
  gameId?: string;
  tierId?: TierId;
  grantedAt: number; // UTC timestamp in ms
  durationSeconds: number; // Duration in seconds
}

export interface UserCosmetics {
  title?: string;
  background?: string;
  avatarFrame?: string;
  customAvatarUrl?: string;
  unlockedBackgrounds?: string[];
  unlockedFrames?: string[];
  unlockedTitles?: string[];
}

export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export interface UtilityEffect {
  type: string;
  value?: number;
  durationMinutes?: number;
  description?: string;
}

export interface ItemInstance {
  instanceId: string; // Unique ID per item e.g. ITEM-8F92A1
  itemId: string; // Catalog ID
  name: string;
  description: string;
  icon: string;
  rarity: ItemRarity;
  itemType: 'utility';
  utilityEffect: UtilityEffect;
  tradable: boolean;
  isListed: boolean;
  creatorId: string;
  dateObtained: number;
}

export interface User {
  id: string;
  username: string;
  secretWord?: string;
  role: 'admin' | 'user';
  isBot?: boolean;
  purchasedTiers: TierId[];
  temporaryAccess: TemporaryAccess[];
  createdAt?: number;
  krests?: number;
  reservedKrests?: number; // Krests held in active marketplace bids
  krestBoosterExpiresAt?: number;
  activeStreakShields?: number;
  freeRequestTokens?: number;
  krateRerolls?: number;
  inventory?: ItemInstance[];
  iconShards?: number;
  dailyStreak?: number;
  lastLoginDate?: string;
  lastClaimedStreakDay?: number;
  lastClaimedStreakDate?: string;
  dailyQuestsData?: {
    lastResetDate: string;
    quests: Record<string, { progress: number; claimed: boolean }>;
  };
  cosmetics?: UserCosmetics;
  datastoreBackup?: string;
  favoriteGames?: string[];
  playHistory?: string[];
  gameNotes?: Record<string, string>;
  userSettings?: {
    soundEffectsEnabled?: boolean;
    bgMusicEnabled?: boolean;
    voiceAssistantEnabled?: boolean;
    sleepWord?: string;
    wakeWord?: string;
    voiceURI?: string;
    voiceRate?: number;
    voicePitch?: number;
    voiceVolume?: number;
  };
  notifiedApprovals?: string[];
}

export interface BidRecord {
  bidderId: string;
  bidderUsername: string;
  amount: number;
  timestamp: number;
}

export interface MarketplaceListing {
  id: string;
  sellerId: string;
  sellerUsername: string;
  itemInstance: ItemInstance;
  startingBid: number;
  currentBid: number;
  highestBidderId: string | null;
  highestBidderUsername: string | null;
  createdAt: number;
  bidHistory: BidRecord[];
  status: 'active' | 'cashed_out' | 'cancelled';
  cashedOutAt?: number;
  isLimited?: boolean;
}

export interface MarketplaceHistoryEntry {
  id: string;
  listingId: string;
  sellerId: string;
  sellerUsername: string;
  buyerId: string;
  buyerUsername: string;
  itemInstance: ItemInstance;
  finalPrice: number;
  timestamp: number;
}

export interface UserNotification {
  id: string;
  userId?: string;
  title: string;
  message: string;
  createdAt: number;
  read: boolean;
  type?: 'outbid' | 'new_bid' | 'item_won' | 'cashed_out' | 'info' | 'krate_unboxed' | 'krests_gained' | 'auction_win' | 'system';
}

export interface Game {
  id: string;
  title: string;
  tier: TierId;
  embedCode: string; // iframe HTML string OR bare URL
  order: number;
}

export type RequestType = 'tier' | 'single_game';
export type RequestStatus = 'pending' | 'accepted' | 'denied';

export interface GameRequest {
  id: string;
  userId: string;
  username: string;
  type: RequestType;
  targetId: string; // tierId or gameId
  targetTitle: string; // Tier name or Game title
  tierId: TierId; // Tier it belongs to
  status: RequestStatus;
  createdAt: number;
  resolvedAt?: number | null;
  durationSeconds?: number;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
}
