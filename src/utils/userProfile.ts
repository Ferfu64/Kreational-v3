import { User, UserCosmetics } from '../types';
import { generateStarterUtilityItems } from '../data/utilityItems';

export interface CosmeticOption {
  id: string;
  name: string;
  type: 'background' | 'frame' | 'title';
  previewClass: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

export const COSMETICS_CATALOG: CosmeticOption[] = [
  // BACKGROUNDS
  {
    id: 'bg_neon_cyber',
    name: 'Neon Cyber Grid',
    type: 'background',
    previewClass: 'bg-gradient-to-br from-purple-950 via-slate-950 to-indigo-950 border-purple-500/50',
    rarity: 'common',
  },
  {
    id: 'bg_cosmic_nebula',
    name: 'Cosmic Nebula',
    type: 'background',
    previewClass: 'bg-gradient-to-br from-blue-950 via-slate-950 to-purple-950 border-blue-500/50',
    rarity: 'common',
  },
  {
    id: 'bg_retro_synthwave',
    name: 'Retro Synthwave',
    type: 'background',
    previewClass: 'bg-gradient-to-br from-pink-950 via-slate-950 to-fuchsia-950 border-pink-500/50',
    rarity: 'rare',
  },
  {
    id: 'bg_golden_glitch',
    name: 'Golden Glitch',
    type: 'background',
    previewClass: 'bg-gradient-to-br from-amber-950 via-slate-950 to-yellow-950 border-amber-500/50',
    rarity: 'epic',
  },
  {
    id: 'bg_obsidian_flame',
    name: 'Obsidian Flame',
    type: 'background',
    previewClass: 'bg-gradient-to-br from-rose-950 via-slate-950 to-red-950 border-rose-500/50',
    rarity: 'epic',
  },
  {
    id: 'bg_emerald_matrix',
    name: 'Emerald Matrix',
    type: 'background',
    previewClass: 'bg-gradient-to-br from-emerald-950 via-slate-950 to-teal-950 border-emerald-500/50',
    rarity: 'legendary',
  },

  // AVATAR FRAMES
  {
    id: 'frame_default',
    name: 'Standard Pulse',
    type: 'frame',
    previewClass: 'border-2 border-purple-500/60 shadow-lg shadow-purple-900/50',
    rarity: 'common',
  },
  {
    id: 'frame_neon_cyan',
    name: 'Neon Cyan Ring',
    type: 'frame',
    previewClass: 'border-2 border-cyan-400 shadow-lg shadow-cyan-500/50 animate-pulse',
    rarity: 'rare',
  },
  {
    id: 'frame_golden_crest',
    name: 'Golden Crest',
    type: 'frame',
    previewClass: 'border-2 border-amber-400 shadow-xl shadow-amber-500/60 ring-2 ring-amber-300/30',
    rarity: 'epic',
  },
  {
    id: 'frame_emerald_cyber',
    name: 'Emerald Cyber',
    type: 'frame',
    previewClass: 'border-2 border-emerald-400 shadow-xl shadow-emerald-500/60 ring-2 ring-emerald-300/30',
    rarity: 'legendary',
  },
  {
    id: 'frame_rose_glitch',
    name: 'Rose Glitch',
    type: 'frame',
    previewClass: 'border-2 border-rose-500 shadow-xl shadow-rose-900/80 ring-2 ring-rose-400/40',
    rarity: 'legendary',
  },

  // TITLES (Titles unlock via tiers/streaks, but can be chosen)
  {
    id: 'title_arcade_rookie',
    name: 'Arcade Rookie',
    type: 'title',
    previewClass: 'text-purple-300',
    rarity: 'common',
  },
  {
    id: 'title_glitch_runner',
    name: 'Glitch Runner',
    type: 'title',
    previewClass: 'text-cyan-300 font-mono',
    rarity: 'rare',
  },
  {
    id: 'title_active_user',
    name: 'Active User',
    type: 'title',
    previewClass: 'text-emerald-400 font-bold',
    rarity: 'epic',
  },
  {
    id: 'title_synth_master',
    name: 'Synth Master',
    type: 'title',
    previewClass: 'text-amber-300 font-bold',
    rarity: 'epic',
  },
  {
    id: 'title_concurrent_king',
    name: 'Concurrent King',
    type: 'title',
    previewClass: 'text-amber-300 font-black tracking-wider uppercase',
    rarity: 'legendary',
  },
  {
    id: 'title_kreator_legend',
    name: 'Kreator Legend',
    type: 'title',
    previewClass: 'text-rose-400 font-black',
    rarity: 'legendary',
  },
];

export interface StreakRewardDef {
  day: number;
  title: string;
  description: string;
  icon: string;
}

export const STREAK_REWARDS_CATALOG: StreakRewardDef[] = [
  { day: 1, title: '30 Krests', description: 'Instant currency boost', icon: '✨' },
  { day: 2, title: '2 Free Krates', description: '2 Krates worth of shards & cosmetics', icon: '📦' },
  { day: 3, title: '100 Krests', description: 'Big currency reward', icon: '💰' },
  { day: 4, title: 'Free Background', description: 'Unlocks a random profile background', icon: '🎨' },
  { day: 5, title: 'Active User Badge', description: 'Exclusive Active User profile badge', icon: '⚡' },
  { day: 6, title: '5 Icon Shards', description: '5 Icon Shards towards custom avatar upload', icon: '🧩' },
  { day: 7, title: 'Concurrent King Title', description: 'Exclusive title (or 400 Krests if owned)', icon: '👑' },
];

export function getTodayDateString(): string {
  const now = new Date();
  return now.toISOString().split('T')[0]; // 'YYYY-MM-DD'
}

export interface StreakRewardResult {
  updatedUser: User;
  rewardMessage: string;
}

export function applyStreakReward(user: User, day: number): StreakRewardResult {
  let krests = user.krests || 0;
  let iconShards = user.iconShards || 0;
  let unlockedBgs = user.cosmetics?.unlockedBackgrounds || ['bg_neon_cyber', 'bg_cosmic_nebula'];
  let unlockedFrames = user.cosmetics?.unlockedFrames || ['frame_default'];
  let unlockedTitles = user.cosmetics?.unlockedTitles || ['Arcade Rookie', 'Glitch Runner'];
  let currentTitle = user.cosmetics?.title || 'Arcade Rookie';
  let message = '';

  const currentStreakDay = ((day - 1) % 7) + 1;

  if (currentStreakDay === 1) {
    krests += 30;
    message = 'Day 1 Streak Reward Claimed: +30 Krests!';
  } else if (currentStreakDay === 2) {
    iconShards += 3;
    const bgsAvailable = COSMETICS_CATALOG.filter((c) => c.type === 'background' && !unlockedBgs.includes(c.id));
    if (bgsAvailable.length > 0) {
      unlockedBgs.push(bgsAvailable[0].id);
    }
    krests += 50;
    message = 'Day 2 Streak Reward Claimed: 2 Krates Unboxed (+3 Icon Shards, Background & +50 Krests)!';
  } else if (currentStreakDay === 3) {
    krests += 100;
    message = 'Day 3 Streak Reward Claimed: +100 Krests!';
  } else if (currentStreakDay === 4) {
    const lockedBgs = COSMETICS_CATALOG.filter((c) => c.type === 'background' && !unlockedBgs.includes(c.id));
    if (lockedBgs.length > 0) {
      const picked = lockedBgs[Math.floor(Math.random() * lockedBgs.length)];
      unlockedBgs.push(picked.id);
      message = `Day 4 Streak Reward Claimed: Unlocked Free Background "${picked.name}"!`;
    } else {
      krests += 100;
      message = 'Day 4 Streak Reward Claimed: Free Background (All owned! Granted +100 Krests instead)!';
    }
  } else if (currentStreakDay === 5) {
    if (!unlockedTitles.includes('Active User')) {
      unlockedTitles.push('Active User');
    }
    currentTitle = 'Active User';
    message = 'Day 5 Streak Reward Claimed: Unlocked & Equipped "Active User" Badge!';
  } else if (currentStreakDay === 6) {
    iconShards += 5;
    message = 'Day 6 Streak Reward Claimed: +5 Profile Icon Shards!';
  } else if (currentStreakDay === 7) {
    if (unlockedTitles.includes('Concurrent King')) {
      krests += 400;
      message = 'Day 7 Streak Reward Claimed: "Concurrent King" already owned! Granted +400 Krests!';
    } else {
      unlockedTitles.push('Concurrent King');
      currentTitle = 'Concurrent King';
      message = 'Day 7 Streak Reward Claimed: Unlocked & Equipped "Concurrent King" Title!';
    }
  }

  const updatedUser: User = {
    ...user,
    krests,
    iconShards,
    lastClaimedStreakDay: currentStreakDay,
    lastClaimedStreakDate: getTodayDateString(),
    cosmetics: {
      ...user.cosmetics,
      title: currentTitle,
      background: user.cosmetics?.background || 'bg_neon_cyber',
      avatarFrame: user.cosmetics?.avatarFrame || 'frame_default',
      unlockedBackgrounds: Array.from(new Set(unlockedBgs)),
      unlockedFrames: Array.from(new Set(unlockedFrames)),
      unlockedTitles: Array.from(new Set(unlockedTitles)),
    },
  };

  return { updatedUser, rewardMessage: message };
}

export function normalizeUserWithProfile(user: User): { updatedUser: User; bonusKrestsGranted: number } {
  let krests = user.krests !== undefined ? user.krests : (user.role === 'admin' ? 250 : 50);
  let reservedKrests = user.reservedKrests || 0;
  let iconShards = user.iconShards !== undefined ? user.iconShards : (user.role === 'admin' ? 10 : 0);
  let dailyStreak = user.dailyStreak || 1;
  let lastLoginDate = user.lastLoginDate || '';
  let activeStreakShields = user.activeStreakShields || 0;
  let inventory = user.inventory && user.inventory.length > 0 ? user.inventory : generateStarterUtilityItems(user.id);
  let bonusKrestsGranted = 0;

  const today = getTodayDateString();

  if (!lastLoginDate) {
    lastLoginDate = today;
    dailyStreak = 1;
  } else if (lastLoginDate !== today) {
    const lastDate = new Date(lastLoginDate);
    const currentDate = new Date(today);
    const diffDays = Math.round((currentDate.getTime() - lastDate.getTime()) / (1000 * 3600 * 24));

    if (diffDays === 1) {
      dailyStreak += 1;
    } else if (diffDays > 1) {
      // Check for streak shield protection
      if (activeStreakShields > 0) {
        activeStreakShields -= 1; // Shield absorbed the missed day
      } else {
        // Check if user has an unlisted streak_shield in inventory to auto-consume
        const shieldIdx = inventory.findIndex((i) => i.itemId === 'streak_shield' && !i.isListed);
        if (shieldIdx !== -1) {
          inventory = inventory.filter((_, idx) => idx !== shieldIdx); // consume shield
        } else {
          dailyStreak = 1; // reset streak if no shield
        }
      }
    }
    lastLoginDate = today;
  }

  const cosmetics: UserCosmetics = {
    title: user.cosmetics?.title || (user.role === 'admin' ? 'Kreator Mastermind' : 'Arcade Rookie'),
    background: user.cosmetics?.background || 'bg_neon_cyber',
    avatarFrame: user.cosmetics?.avatarFrame || 'frame_default',
    customAvatarUrl: user.cosmetics?.customAvatarUrl || undefined,
    unlockedBackgrounds: Array.from(
      new Set(['bg_neon_cyber', 'bg_cosmic_nebula', ...(user.cosmetics?.unlockedBackgrounds || [])])
    ),
    unlockedFrames: Array.from(new Set(['frame_default', ...(user.cosmetics?.unlockedFrames || [])])),
    unlockedTitles: Array.from(
      new Set([
        'Arcade Rookie',
        'Glitch Runner',
        ...(user.role === 'admin' ? ['Kreator Mastermind', 'Kreator Legend'] : []),
        ...(user.cosmetics?.unlockedTitles || []),
      ])
    ),
  };

  const updatedUser: User = {
    ...user,
    krests,
    reservedKrests,
    activeStreakShields,
    inventory,
    iconShards,
    dailyStreak,
    lastLoginDate,
    cosmetics,
  };

  return { updatedUser, bonusKrestsGranted };
}

export function getHighestBadgeTitle(user: User): { name: string; color: string; icon: string } {
  if (user.role === 'admin' || user.username === 'Kreator') {
    return { name: 'KREATOR ADMIN', color: 'text-amber-400 border-amber-500/50 bg-amber-500/20', icon: '👑' };
  }
  const unlockedTitles = user.cosmetics?.unlockedTitles || [];
  if (unlockedTitles.includes('Concurrent King') || user.cosmetics?.title === 'Concurrent King') {
    return { name: 'CONCURRENT KING', color: 'text-amber-300 border-amber-500/80 bg-amber-500/30 font-black', icon: '👑' };
  }
  if (unlockedTitles.includes('Active User') || user.cosmetics?.title === 'Active User') {
    return { name: 'ACTIVE USER BADGE', color: 'text-emerald-300 border-emerald-500/50 bg-emerald-500/20', icon: '⚡' };
  }

  const purchased = user.purchasedTiers || [];
  if (purchased.includes('azgames')) {
    return { name: 'AZGAMES VIP', color: 'text-rose-400 border-rose-500/60 bg-rose-950/40', icon: '☣️' };
  }
  if (purchased.includes('pro')) {
    return { name: 'PRO BADGE', color: 'text-purple-300 border-purple-500/50 bg-purple-500/20', icon: '⚡' };
  }
  if (purchased.includes('master')) {
    return { name: 'MASTER BADGE', color: 'text-rose-400 border-rose-500/50 bg-rose-500/20', icon: '🔥' };
  }
  if (purchased.includes('legendary')) {
    return { name: 'LEGENDARY BADGE', color: 'text-amber-300 border-amber-500/50 bg-amber-500/20', icon: '⭐' };
  }
  if (purchased.includes('mythic')) {
    return { name: 'MYTHIC BADGE', color: 'text-fuchsia-300 border-fuchsia-500/50 bg-fuchsia-500/20', icon: '🔮' };
  }
  if (purchased.includes('diamond')) {
    return { name: 'DIAMOND BADGE', color: 'text-cyan-300 border-cyan-500/50 bg-cyan-500/20', icon: '💎' };
  }
  if (purchased.includes('gold')) {
    return { name: 'GOLD BADGE', color: 'text-yellow-300 border-yellow-500/50 bg-yellow-500/20', icon: '🏆' };
  }
  if (purchased.includes('silver')) {
    return { name: 'SILVER BADGE', color: 'text-slate-300 border-slate-500/50 bg-slate-500/20', icon: '🛡️' };
  }
  return { name: 'BRONZE BADGE', color: 'text-amber-600 border-amber-600/50 bg-amber-950/40', icon: '🥉' };
}
