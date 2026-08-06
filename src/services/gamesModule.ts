import { Game } from '../types';
import { DEFAULT_GAMES } from '../data/defaultGames';
import { safeGet, safeSet } from '../utils/persistentStorage';

const STORAGE_KEY = 'kreational_shared_games_module_v1';

/**
 * Shared Games Registry / Repository Module
 * Manages permanent games loaded across the app.
 * Uploaded custom games are added to this module and persisted locally and to Firestore.
 */
class GamesModule {
  private static instance: GamesModule;
  private gamesMap: Map<string, Game> = new Map();

  private constructor() {
    this.init();
  }

  public static getInstance(): GamesModule {
    if (!GamesModule.instance) {
      GamesModule.instance = new GamesModule();
    }
    return GamesModule.instance;
  }

  private init() {
    // 1. Load default static games
    DEFAULT_GAMES.forEach((game) => {
      this.gamesMap.set(game.id, game);
    });

    // Remove legacy duplicates if present
    this.gamesMap.delete('bronze_07');
    this.gamesMap.delete('silver_01');

    // 2. Load stored custom/uploaded games
    try {
      const storedRaw = safeGet(STORAGE_KEY);
      if (storedRaw) {
        const storedGames: Game[] = JSON.parse(storedRaw);
        storedGames.forEach((game) => {
          if (game.id !== 'bronze_07' && game.id !== 'silver_01') {
            this.gamesMap.set(game.id, game);
          }
        });
      }
    } catch (err) {
      console.warn('GamesModule failed to load from localStorage:', err);
    }

    this.enforceExclusiveGoldGames();
  }

  private enforceExclusiveGoldGames(): void {
    const idsToRemove: string[] = [];
    this.gamesMap.forEach((game, id) => {
      const titleLower = game.title.toLowerCase().trim();
      const isShadowTrick = titleLower.includes('shadow trick') || id.includes('shadow_trick');
      const isTankBall = titleLower.includes('tank ball') || titleLower.includes('tankball') || id.includes('tankball') || id.includes('tank_ball');

      if ((isShadowTrick || isTankBall) && game.tier !== 'gold') {
        idsToRemove.push(id);
      }
    });

    idsToRemove.forEach((id) => this.gamesMap.delete(id));
  }

  public getAllGames(): Game[] {
    return Array.from(this.gamesMap.values()).sort((a, b) => a.order - b.order);
  }

  public addOrUpdateGame(game: Game): void {
    this.gamesMap.set(game.id, game);
    this.persistCustomGames();
  }

  public removeGame(gameId: string): void {
    this.gamesMap.delete(gameId);
    this.persistCustomGames();
  }

  public syncFromFirestore(cloudGames: Game[]): void {
    cloudGames.forEach((game) => {
      this.gamesMap.set(game.id, game);
    });
    this.enforceExclusiveGoldGames();
    this.persistCustomGames();
  }

  private persistCustomGames(): void {
    try {
      // Save all non-default or customized games to local storage
      const customGames = Array.from(this.gamesMap.values());
      safeSet(STORAGE_KEY, JSON.stringify(customGames));
    } catch (err) {
      console.warn('GamesModule failed to persist games:', err);
    }
  }
}

export const sharedGamesModule = GamesModule.getInstance();
