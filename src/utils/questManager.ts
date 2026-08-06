import { User } from '../types';
import { getTodayDateString } from './userProfile';

export interface QuestDef {
  id: 'login_today' | 'play_5_games' | 'open_krate';
  title: string;
  description: string;
  rewardKrests: number;
  icon: string;
  targetProgress: number;
}

export const QUEST_CATALOG: QuestDef[] = [
  {
    id: 'login_today',
    title: 'Daily Check-In',
    description: 'Log in to Kreational today',
    rewardKrests: 30,
    icon: '⚡',
    targetProgress: 1,
  },
  {
    id: 'play_5_games',
    title: 'Gamer Extraordinaire',
    description: 'Play 5 games across any tier',
    rewardKrests: 50,
    icon: '🎮',
    targetProgress: 5,
  },
  {
    id: 'open_krate',
    title: 'Unboxer Supreme',
    description: 'Open 1 Krate in the Shop',
    rewardKrests: 25,
    icon: '📦',
    targetProgress: 1,
  },
];

export interface ActiveQuestState {
  def: QuestDef;
  currentProgress: number;
  completed: boolean;
  claimed: boolean;
}

export function getActiveQuestsForUser(user: User): ActiveQuestState[] {
  const today = getTodayDateString();
  const questData = user.dailyQuestsData;

  const isTodayData = questData && questData.lastResetDate === today;
  const userQuests = isTodayData ? questData.quests || {} : {};

  return QUEST_CATALOG.map((def) => {
    let progress = userQuests[def.id]?.progress || 0;
    let claimed = userQuests[def.id]?.claimed || false;

    // Login today is automatically completed if user is active today
    if (def.id === 'login_today') {
      progress = 1;
    }

    const completed = progress >= def.targetProgress;

    return {
      def,
      currentProgress: Math.min(def.targetProgress, progress),
      completed,
      claimed,
    };
  });
}

export function recordGamePlayedInQuests(user: User): User {
  const today = getTodayDateString();
  const activeQuests = getActiveQuestsForUser(user);

  const questMap: Record<string, { progress: number; claimed: boolean }> = {};
  activeQuests.forEach((q) => {
    let p = q.currentProgress;
    if (q.def.id === 'play_5_games') {
      p = Math.min(q.def.targetProgress, p + 1);
    }
    questMap[q.def.id] = {
      progress: p,
      claimed: q.claimed,
    };
  });

  return {
    ...user,
    dailyQuestsData: {
      lastResetDate: today,
      quests: questMap,
    },
  };
}

export function recordKrateOpenedInQuests(user: User): User {
  const today = getTodayDateString();
  const activeQuests = getActiveQuestsForUser(user);

  const questMap: Record<string, { progress: number; claimed: boolean }> = {};
  activeQuests.forEach((q) => {
    let p = q.currentProgress;
    if (q.def.id === 'open_krate') {
      p = Math.min(q.def.targetProgress, p + 1);
    }
    questMap[q.def.id] = {
      progress: p,
      claimed: q.claimed,
    };
  });

  return {
    ...user,
    dailyQuestsData: {
      lastResetDate: today,
      quests: questMap,
    },
  };
}

export function claimQuestRewardInQuests(
  user: User,
  questId: 'login_today' | 'play_5_games' | 'open_krate'
): { updatedUser: User; rewardKrests: number } {
  const today = getTodayDateString();
  const activeQuests = getActiveQuestsForUser(user);
  const targetQuest = activeQuests.find((q) => q.def.id === questId);

  if (!targetQuest || !targetQuest.completed || targetQuest.claimed) {
    return { updatedUser: user, rewardKrests: 0 };
  }

  const rewardKrests = targetQuest.def.rewardKrests;
  const questMap: Record<string, { progress: number; claimed: boolean }> = {};

  activeQuests.forEach((q) => {
    questMap[q.def.id] = {
      progress: q.currentProgress,
      claimed: q.def.id === questId ? true : q.claimed,
    };
  });

  const updatedUser: User = {
    ...user,
    krests: (user.krests || 0) + rewardKrests,
    dailyQuestsData: {
      lastResetDate: today,
      quests: questMap,
    },
  };

  return { updatedUser, rewardKrests };
}
