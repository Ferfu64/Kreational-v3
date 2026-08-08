import { User, ItemInstance, MarketplaceListing } from '../types';
import { db } from '../lib/firebase';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { saveFullUserAccountToFirestore } from './firestoreStore';
import { UTILITY_ITEMS_CATALOG, createItemInstance } from '../data/utilityItems';
import { triggerNotification } from '../utils/notificationManager';

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

export async function ensureBotsInFirestore(): Promise<User[]> {
  const bots = generateBotAccounts();
  if (isBotsInitialized) return bots;

  try {
    const snap = await getDocs(collection(db, 'marketplace_bots'));
    if (snap.empty) {
      for (const bot of bots) {
        await setDoc(doc(db, 'marketplace_bots', bot.id), bot);
      }
    } else {
      const cloudBots: User[] = [];
      snap.forEach((docSnap) => cloudBots.push(docSnap.data() as User));
      if (cloudBots.length > 0) {
        botsMemoryCache = cloudBots;
      }
    }
    isBotsInitialized = true;
  } catch (err) {
    console.warn('Bot Firestore sync fallback:', err);
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

    // 1. Bot item listing: Ensure at least 8-12 active listings on the marketplace
    if (currentActive.length < 10) {
      const bot = getRandomBot();
      let unlistedItem = (bot.inventory || []).find((i) => !i.isListed);

      // Restock inventory if empty
      if (!unlistedItem) {
        unlistedItem = generateBotItem(bot.id, Math.floor(Math.random() * 100));
        bot.inventory = [...(bot.inventory || []), unlistedItem];
      }

      const startingPrices = [50, 100, 150, 200, 250, 300, 500];
      const startingBid = startingPrices[Math.floor(Math.random() * startingPrices.length)];
      await createListingFn(bot, unlistedItem, startingBid);
      isSimulationRunning = false;
      return true;
    }

    // 2. Counter-bidding on BOTH Player Listings & Community Listings (excluding Limited listings)
    const biddableActiveListings = currentActive.filter((l) => !l.isLimited);

    if (biddableActiveListings.length > 0 && Math.random() < 0.75) {
      // Prioritize human player listings to give instant active player feedback
      const playerListings = biddableActiveListings.filter((l) => !l.sellerId.startsWith('bot-'));
      const targetListing =
        playerListings.length > 0 && Math.random() < 0.7
          ? playerListings[Math.floor(Math.random() * playerListings.length)]
          : biddableActiveListings[Math.floor(Math.random() * biddableActiveListings.length)];

      // Choose an eligible bidder that is not the seller and not already the highest bidder
      const eligibleBots = bots.filter(
        (b) => b.id !== targetListing.sellerId && b.id !== targetListing.highestBidderId
      );

      if (eligibleBots.length > 0) {
        const bidderBot = eligibleBots[Math.floor(Math.random() * eligibleBots.length)];
        const nextBid = calculateNextBotBid(targetListing.currentBid);
        const availableKrests = (bidderBot.krests || 0) - (bidderBot.reservedKrests || 0);

        // Max valuation threshold check
        const rarityValuation: Record<string, number> = {
          common: 300,
          uncommon: 500,
          rare: 1000,
          epic: 2000,
          legendary: 4000,
        };
        const maxValuation = rarityValuation[targetListing.itemInstance.rarity] || 600;

        if (nextBid <= maxValuation && availableKrests >= nextBid) {
          await placeBidFn(bidderBot, targetListing.id, nextBid);
          isSimulationRunning = false;
          return true;
        }
      }
    }

    // 3. Bot seller cash-out when an auction has bids
    if (currentActive.length > 0 && Math.random() < 0.25) {
      const biddedListings = currentActive.filter(
        (l) => l.highestBidderId !== null && l.sellerId.startsWith('bot-')
      );
      if (biddedListings.length > 0) {
        const listingToCashOut = biddedListings[Math.floor(Math.random() * biddedListings.length)];
        const sellerBot = bots.find((b) => b.id === listingToCashOut.sellerId) || getRandomBot();

        await cashOutFn(sellerBot, listingToCashOut.id);

        // Notify human player if they won the auction!
        let currentLoggedInUserId = '';
        try {
          const stored = localStorage.getItem('kreational_current_user');
          if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed && parsed.id) currentLoggedInUserId = parsed.id;
          }
        } catch (e) {}

        if (listingToCashOut.highestBidderId === currentLoggedInUserId) {
          triggerNotification(
            '🎉 Auction Won!',
            `You won ${listingToCashOut.itemInstance.name} from ${listingToCashOut.sellerUsername} for ${listingToCashOut.currentBid} Krests!`
          );
        }

        isSimulationRunning = false;
        return true;
      }
    }
  } catch (err) {
    console.warn('Bot simulation error:', err);
  } finally {
    isSimulationRunning = false;
  }

  return false;
}

