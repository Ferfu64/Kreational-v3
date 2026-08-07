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

export interface User {
  id: string;
  username: string;
  secretWord?: string;
  role: 'admin' | 'user';
  purchasedTiers: TierId[];
  temporaryAccess: TemporaryAccess[];
  createdAt?: number;
  krests?: number;
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
