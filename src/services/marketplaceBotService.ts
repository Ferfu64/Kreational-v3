import { User, ItemInstance, MarketplaceListing } from '../types';
import { db } from '../lib/firebase';
import { collection, getDocs, doc, setDoc } from 'firebase/firestore';
import {
  generateBotAccounts,
  ensureBotsInFirestore,
  getRandomBot,
  calculateNextBotBid,
  runBotMarketplaceSimulation,
} from './marketplaceBots';

export interface BotValuationRule {
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  baseValuation: number;
}

const RARITY_VALUATIONS: Record<string, number> = {
  common: 200,
  uncommon: 400,
  rare: 750,
  epic: 1500,
  legendary: 3000,
};

/**
 * Calculates a bot's internal valuation for a given item instance.
 */
export function getItemValuation(item: ItemInstance, botId: string): number {
  const base = RARITY_VALUATIONS[item.rarity] || 250;
  // Seed pseudo-random variation based on botId string hash
  let hash = 0;
  for (let i = 0; i < botId.length; i++) {
    hash = (hash << 5) - hash + botId.charCodeAt(i);
    hash |= 0;
  }
  const varianceFactor = 0.85 + (Math.abs(hash) % 30) / 100; // 0.85x to 1.15x
  return Math.floor(base * varianceFactor);
}

/**
 * Service to manage 50 marketplace bots that periodically scan Firestore,
 * analyze current bids against valuation logic, and bid in 10 Krest increments.
 */
export class MarketplaceBotService {
  private static instance: MarketplaceBotService;

  private constructor() {}

  public static getInstance(): MarketplaceBotService {
    if (!MarketplaceBotService.instance) {
      MarketplaceBotService.instance = new MarketplaceBotService();
    }
    return MarketplaceBotService.instance;
  }

  public getBotAccounts(): User[] {
    return generateBotAccounts();
  }

  public async initializeBotsInCloud(): Promise<User[]> {
    return await ensureBotsInFirestore();
  }

  /**
   * Scans active listings and places competitive bids if below bot item valuation.
   */
  public async evaluateAndPlaceBids(
    listings: MarketplaceListing[],
    placeBidFn: (bidder: User, listingId: string, amount: number) => Promise<boolean>
  ): Promise<boolean> {
    const bots = await this.initializeBotsInCloud();
    const activeListings = listings.filter((l) => l.status === 'active' && !l.isLimited);

    for (const listing of activeListings) {
      // Pick a random bot
      const eligibleBots = bots.filter(
        (b) => b.id !== listing.sellerId && b.id !== listing.highestBidderId
      );

      if (eligibleBots.length === 0) continue;

      const bot = eligibleBots[Math.floor(Math.random() * eligibleBots.length)];
      const valuation = getItemValuation(listing.itemInstance, bot.id);
      const nextBid = calculateNextBotBid(listing.currentBid);

      const botAvailableKrests = (bot.krests || 0) - (bot.reservedKrests || 0);

      // Place bid if nextBid <= valuation and bot has sufficient funds
      if (nextBid <= valuation && botAvailableKrests >= nextBid) {
        const success = await placeBidFn(bot, listing.id, nextBid);
        if (success) return true;
      }
    }

    return false;
  }

  public async runCycle(
    listings: MarketplaceListing[],
    createListingFn: Function,
    placeBidFn: Function,
    cashOutFn: Function
  ): Promise<boolean> {
    return await runBotMarketplaceSimulation(listings, createListingFn, placeBidFn, cashOutFn);
  }
}

export const marketplaceBotService = MarketplaceBotService.getInstance();
