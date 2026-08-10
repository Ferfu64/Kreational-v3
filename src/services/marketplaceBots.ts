import { User, ItemInstance, MarketplaceListing } from '../types';
import { db } from '../lib/firebase';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { saveFullUserAccountToFirestore } from './firestoreStore';
import { UTILITY_ITEMS_CATALOG, createItemInstance } from '../data/utilityItems';
import { triggerNotification } from '../utils/notificationManager';
import { safeGet } from '../utils/persistentStorage';

export interface BotAccount {
  id: string;
  username: string;
  isBot: true;
  krests: number;
  reservedKrests: number;
  inventory: ItemInstance[];
}

// 10 clean gamer names that make sense + 40 random gamer-style usernames
const BOT_NAMES = [
  // 10 Clean Gamer Names
  'ZenithMaster',
  'ShadowStriker',
  'NexusRider',
  'AetherBlade',
  'CosmicHunter',
  'VortexKnight',
  'StarlightEcho',
  'TitanMerchant',
  'PrismWanderer',
  'NebulaRunner',
  // 40 Realistic Gamer Handles
  'thatoneguy123',
  '99ikku99',
  'xX_ShadowGamer_Xx',
  'noobmaster69',
  'pixel_samurai_00',
  'vortex_legend',
  'l33t_trader',
  'just_a_bot_lol',
  'krest_king_99',
  'big_brain_trader',
  'silly_goose_42',
  'sniper_wolf99',
  'hyper_active_guy',
  'zero_cool_88',
  'speedy_gonzales_00',
  'chill_vibes_21',
  'dark_knight_x',
  'pro_gamer_2026',
  'ghost_rider_777',
  'cyber_ninja_101',
  'random_dude_404',
  'epic_fail_guy',
  'galaxy_brain_99',
  'stealth_master_x',
  'alpha_wolf_22',
  'frost_byte_12',
  'iron_man_3000',
  'shadow_realm_guy',
  'matrix_coder_99',
  'pixel_junkie_42',
  'skywalker_99',
  'thunder_bolt_07',
  'neo_trader_x',
  'blaze_runner_420',
  'astro_boy_88',
  'omega_supreme_00',
  'quantum_leap_11',
  'sonic_speed_99',
  'turbo_boost_55',
  'phantom_thief_00',
];

let botsMemoryCache: User[] = [];
let isBotsInitialized = false;

export function getItemEstimatedValue(item: ItemInstance): number {
  const rarityValuations: Record<string, number> = {
    common: 25,
    uncommon: 70,
    rare: 180,
    epic: 500,
    legendary: 1400,
  };
  const base = rarityValuations[item.rarity] || 100;
  // Small variance hash based on instanceId or name length
  let hash = 0;
  const str = item.instanceId || item.name || 'item';
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
  }
  const variance = 0.9 + (Math.abs(hash) % 20) / 100; // 0.9x to 1.1x
  const calculated = Math.floor(base * variance);
  return Math.min(calculated, 2000);
}

function generateBotItem(botId: string, idx: number): ItemInstance {
  const keys = Object.keys(UTILITY_ITEMS_CATALOG);
  const chosenKey = keys[(idx + Math.floor(Math.random() * keys.length)) % keys.length];
  return createItemInstance(chosenKey, botId);
}

export function generateBotAccounts(): User[] {
  if (botsMemoryCache.length === 50) return botsMemoryCache;

  const bots: User[] = BOT_NAMES.map((name, idx) => {
    const botId = `bot-${(idx + 1).toString().padStart(2, '0')}`;
    const baseKrests = 3000 + idx * 250 + Math.floor(Math.random() * 1200);

    const inventory: ItemInstance[] = [
      generateBotItem(botId, idx * 2 + 1),
      generateBotItem(botId, idx * 2 + 2),
      generateBotItem(botId, idx * 2 + 3),
    ];

    return {
      id: botId,
      username: name,
      role: 'user',
      isBot: true,
      krests: baseKrests,
      reservedKrests: 0,
      purchasedTiers: ['bronze', 'silver', 'gold'],
      temporaryAccess: [],
      createdAt: Date.now() - 1000000,
      inventory,
    };
  });

  botsMemoryCache = bots;
  return bots;
}

function sanitizeBotInventory(bot: User): User {
  const cleanKeys = ['krate_reroll', 'streak_shield', 'request_token', 'krest_booster'];
  const sanitizedInv = (bot.inventory || []).map((item, idx) => {
    const name = (item.name || '').toLowerCase();
    const itemId = (item.itemId || '').toLowerCase();
    if (name.includes('stand') || itemId.includes('stand') || name.includes('shard') || itemId.includes('shard') || name.includes('pass token')) {
      const newKey = cleanKeys[idx % cleanKeys.length];
      return createItemInstance(newKey, bot.id);
    }
    return item;
  });
  return { ...bot, inventory: sanitizedInv };
}

export async function ensureBotsInFirestore(): Promise<User[]> {
  const bots = generateBotAccounts();
  if (isBotsInitialized) return botsMemoryCache.length > 0 ? botsMemoryCache : bots;

  try {
    const snap = await getDocs(collection(db, 'marketplace_bots'));
    if (snap.empty) {
      for (const bot of bots) {
        await setDoc(doc(db, 'marketplace_bots', bot.id), bot);
      }
      botsMemoryCache = bots;
    } else {
      const cloudBots: User[] = [];
      snap.forEach((docSnap) => {
        const rawBot = docSnap.data() as User;
        const cleanBot = sanitizeBotInventory(rawBot);
        cloudBots.push(cleanBot);
      });
      if (cloudBots.length > 0) {
        botsMemoryCache = cloudBots;
      }
    }
    isBotsInitialized = true;
  } catch (err) {
    console.warn('Bot Firestore sync fallback:', err);
    botsMemoryCache = bots;
  }

  return botsMemoryCache;
}

export function getRandomBot(): User {
  const bots = generateBotAccounts();
  return bots[Math.floor(Math.random() * bots.length)];
}

/**
 * Calculates the next bot bid incremented strictly by multiples of 10.
 */
export function calculateNextBotBid(currentBid: number): number {
  const nextStep = currentBid + 10;
  return Math.ceil(nextStep / 10) * 10;
}

let isSimulationRunning = false;

/**
 * Runs active simulation for 50 marketplace bots.
 * Ensures active listings, bids on BOTH human player listings and bot listings,
 * places bids in increments of 10, and auctions items.
 */
export async function runBotMarketplaceSimulation(
  activeListings: MarketplaceListing[],
  createListingFn: Function,
  placeBidFn: Function,
  cashOutFn: Function
): Promise<boolean> {
  if (isSimulationRunning) return false;
  isSimulationRunning = true;

  try {
    const bots = await ensureBotsInFirestore();
    const currentActive = activeListings.filter((l) => l.status === 'active');

    let currentLoggedInUserId = '';
    try {
      const stored = safeGet('kreational_user') || safeGet('kreational_current_user');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.id) currentLoggedInUserId = parsed.id;
      }
    } catch (e) {}

    // 1. Auto Cash-Out: Any BOT listing with 3 or more bids auto cashes out! Player stands stay active for player decision.
    const botThreeBidListings = currentActive.filter(
      (l) => l.status === 'active' && l.sellerId.startsWith('bot-') && l.bidHistory && l.bidHistory.length >= 3 && l.highestBidderId
    );
    if (botThreeBidListings.length > 0) {
      const targetCashOut = botThreeBidListings[0];
      const sellerBot = bots.find((b) => b.id === targetCashOut.sellerId) || {
        id: targetCashOut.sellerId,
        username: targetCashOut.sellerUsername,
        role: 'user',
        krests: 1000,
        inventory: [targetCashOut.itemInstance],
      } as User;

      await cashOutFn(sellerBot, targetCashOut.id);

      // Notify human player ONLY if they won the auction
      if (targetCashOut.highestBidderId === currentLoggedInUserId) {
        triggerNotification(
          '🎉 Auction Won!',
          `You won ${targetCashOut.itemInstance.name} from ${targetCashOut.sellerUsername} for ${targetCashOut.currentBid} Krests!`
        );
      }

      isSimulationRunning = false;
      return true;
    }

    // 2. Bot item listing: Keep 6-10 active bot listings on marketplace. Bot items are ALWAYS direct buy (isLimited: false) with fair price 100-600 Krests.
    const botListingsCount = currentActive.filter((l) => l.sellerId.startsWith('bot-')).length;
    if (botListingsCount < 8) {
      const bot = getRandomBot();
      let unlistedItem = (bot.inventory || []).find((i) => !i.isListed);

      // Restock inventory if empty
      if (!unlistedItem) {
        unlistedItem = generateBotItem(bot.id, Math.floor(Math.random() * 100));
        bot.inventory = [...(bot.inventory || []), unlistedItem];
      }

      // Fair price randomly generated between 100 and 600 Krests
      const fairPrice = Math.floor(Math.random() * 501) + 100;
      // Bot items are direct buy (isLimited = false)
      await createListingFn(bot, unlistedItem, fairPrice, false);
      isSimulationRunning = false;
      return true;
    }

    // 3. Bot Counter-bidding: Bots ONLY bid on PLAYER LIMITED listings (isLimited === true and seller is human)
    const playerLimitedListings = currentActive.filter(
      (l) => !l.sellerId.startsWith('bot-') && l.isLimited && (!l.bidHistory || l.bidHistory.length < 5)
    );

    if (playerLimitedListings.length > 0) {
      const targetListing = playerLimitedListings[Math.floor(Math.random() * playerLimitedListings.length)];

      // Choose an eligible bidder bot (not seller, not current highest bidder)
      const eligibleBots = bots.filter(
        (b) => b.id !== targetListing.sellerId && b.id !== targetListing.highestBidderId
      );

      if (eligibleBots.length > 0) {
        const bidderBot = eligibleBots[Math.floor(Math.random() * eligibleBots.length)];
        const nextBid = calculateNextBotBid(targetListing.currentBid);
        const availableKrests = (bidderBot.krests || 0) - (bidderBot.reservedKrests || 0);

        // Nerfed valuation check: Bots will NOT bid above the item's estimated value
        const maxValuation = getItemEstimatedValue(targetListing.itemInstance);

        if (nextBid <= maxValuation && availableKrests >= nextBid) {
          const prevHighestBidderId = targetListing.highestBidderId;
          await placeBidFn(bidderBot, targetListing.id, nextBid);

          // Notify human player ONLY if they are the seller or if they were outbid
          if (targetListing.sellerId === currentLoggedInUserId) {
            triggerNotification(
              'New Bid on Your Listing!',
              `${bidderBot.username} placed a bid of ${nextBid} Krests on ${targetListing.itemInstance.name}!`
            );
          } else if (prevHighestBidderId === currentLoggedInUserId) {
            triggerNotification(
              '🎉 Outbid Notice!',
              `${bidderBot.username} outbid you on ${targetListing.itemInstance.name} with ${nextBid} Krests! Your Krests were refunded.`
            );
          }

          isSimulationRunning = false;
          return true;
        }
      }
    }
  } catch (err) {
    console.warn('Bot simulation error:', err);
  } finally {
    isSimulationRunning = false;
  }

  return false;
}

