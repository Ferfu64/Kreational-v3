import { ItemInstance, ItemRarity, UtilityEffect } from '../types';

export interface CatalogUtilityItem {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: ItemRarity;
  utilityEffect: UtilityEffect;
}

export const UTILITY_ITEMS_CATALOG: Record<string, CatalogUtilityItem> = {
  streak_shield: {
    id: 'streak_shield',
    name: 'Streak Shield',
    description: 'Protects your current streak from being lost if you miss a daily login.',
    icon: '🛡️',
    rarity: 'rare',
    utilityEffect: {
      type: 'streak_shield',
      value: 1,
      description: 'Absorbs 1 missed daily streak day automatically.',
    },
  },
  krest_booster: {
    id: 'krest_booster',
    name: 'Krest Booster',
    description: 'Temporarily doubles your passive Krest earnings (+100%) for 30 minutes of activity.',
    icon: '⚡',
    rarity: 'epic',
    utilityEffect: {
      type: 'krest_booster',
      value: 2,
      durationMinutes: 30,
      description: '2x passive Krest generation rate for 30 mins.',
    },
  },
  request_token: {
    id: 'request_token',
    name: 'Request Token',
    description: 'Allows you to submit 1 game or tier access request without paying the normal Krest fee.',
    icon: '🎫',
    rarity: 'rare',
    utilityEffect: {
      type: 'request_token',
      value: 1,
      description: 'Waives Krest cost for 1 request submission.',
    },
  },
  krate_reroll: {
    id: 'krate_reroll',
    name: 'Krate Reroll',
    description: 'Allows you to reroll the result of a Shop Krate once if you want another roll.',
    icon: '🎲',
    rarity: 'uncommon',
    utilityEffect: {
      type: 'krate_reroll',
      value: 1,
      description: 'Rerolls 1 Krate loot drop.',
    },
  },
  cyber_auto_bidder: {
    id: 'cyber_auto_bidder',
    name: 'Cyber Auto-Bidder Chip',
    description: 'Automatically places counter-bids on your active marketplace auctions when outbid.',
    icon: '🤖',
    rarity: 'rare',
    utilityEffect: {
      type: 'auto_bid',
      value: 5,
      description: 'Auto-bids up to 5 times on your selected auctions.',
    },
  },
  auction_shield_charm: {
    id: 'auction_shield_charm',
    name: 'Auction Shield Charm',
    description: 'Prevents snipe-bids in the final seconds of your marketplace auctions.',
    icon: '🛡️',
    rarity: 'epic',
    utilityEffect: {
      type: 'auction_shield',
      value: 1,
      description: 'Extends auction timer by 2 minutes on late bids.',
    },
  },
  fee_rebate_pass: {
    id: 'fee_rebate_pass',
    name: 'Marketplace Fee Rebate Pass',
    description: 'Waives marketplace seller transaction fees on your next 3 cash-out sales.',
    icon: '💳',
    rarity: 'uncommon',
    utilityEffect: {
      type: 'fee_rebate',
      value: 3,
      description: '0% commission on next 3 completed auctions.',
    },
  },
  xp_booster_overclock: {
    id: 'xp_booster_overclock',
    name: 'Overclocked Krest Amplifier',
    description: 'Quadruples (+300%) your passive Krest earnings for 1 full hour!',
    icon: '⚡',
    rarity: 'legendary',
    utilityEffect: {
      type: 'krest_booster',
      value: 4,
      durationMinutes: 60,
      description: '4x passive Krest generation rate for 60 mins.',
    },
  },
  mythic_shard_token: {
    id: 'mythic_shard_token',
    name: 'Mythic Shard Token',
    description: 'Can be redeemed or traded in the Marketplace to grant legendary status power-ups.',
    icon: '🔮',
    rarity: 'legendary',
    utilityEffect: {
      type: 'stand_shard',
      value: 1,
      description: 'Rare crafting material for high-tier boosters.',
    },
  },
  quantum_reroll_cube: {
    id: 'quantum_reroll_cube',
    name: 'Quantum Reroll Cube',
    description: 'Instantly grants 3 free Krate rerolls with increased Legendary drop chances.',
    icon: '🎲',
    rarity: 'epic',
    utilityEffect: {
      type: 'krate_reroll',
      value: 3,
      description: 'Grants 3 Krate rerolls.',
    },
  },
  temp_access_token: {
    id: 'temp_access_token',
    name: 'Temporary Access Token',
    description: 'Grants 1 hour of temporary access to any locked game or tier of your choice.',
    icon: '🔑',
    rarity: 'uncommon',
    utilityEffect: {
      type: 'temp_access_token',
      value: 3600,
      description: 'Gives 60 minutes of instant unlocked access to 1 game.',
    },
  },
};

export function createItemInstance(itemId: string, creatorId: string = 'System'): ItemInstance {
  const catalogItem = UTILITY_ITEMS_CATALOG[itemId] || UTILITY_ITEMS_CATALOG['streak_shield'];
  const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
  const instanceId = `ITEM-${randomSuffix}`;

  return {
    instanceId,
    itemId: catalogItem.id,
    name: catalogItem.name,
    description: catalogItem.description,
    icon: catalogItem.icon,
    rarity: catalogItem.rarity,
    itemType: 'utility',
    utilityEffect: catalogItem.utilityEffect,
    tradable: true,
    isListed: false,
    creatorId,
    dateObtained: Date.now(),
  };
}

export function generateStarterUtilityItems(userId: string): ItemInstance[] {
  return [
    createItemInstance('streak_shield', userId),
    createItemInstance('request_token', userId),
    createItemInstance('krest_booster', userId),
    createItemInstance('krate_reroll', userId),
  ];
}
