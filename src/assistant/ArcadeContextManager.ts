import { Game, Tier } from '../types';

export interface ArcadeContextState {
  currentlyOpenGame: Game | null;
  previouslyPlayedGame: Game | null;
  currentGameCategory: string | null;
  currentTier: string | number | null;
  lastSuccessfulVoiceCommand: string | null;
  lastRecommendedGame: Game | null;
  lastSearchResult: Game[] | null;
  isInsideGame: boolean;
  allGames: Game[];
  currentTierGames: Game[];
}

export const INITIAL_CONTEXT_STATE: ArcadeContextState = {
  currentlyOpenGame: null,
  previouslyPlayedGame: null,
  currentGameCategory: null,
  currentTier: 'bronze',
  lastSuccessfulVoiceCommand: null,
  lastRecommendedGame: null,
  lastSearchResult: null,
  isInsideGame: false,
  allGames: [],
  currentTierGames: [],
};

const KEYWORD_CATEGORIES: Record<string, string[]> = {
  racing: ['racing', 'racer', 'truck', 'moto', 'car', 'drive', 'speed', 'hills', 'drift'],
  puzzle: ['puzzle', 'maze', 'wordle', 'circloo', 'stack', 'dragbox', '2048', 'block', 'logic'],
  shooting: ['shoot', 'gun', 'strike', 'sniper', 'recoil', 'shot', 'defence', 'war'],
  sports: ['golf', 'soccer', 'ball', 'brawl', 'football', 'basketball'],
  ninja: ['ninja', 'slash', 'blade', 'katana'],
  space: ['space', 'laser', 'waves', 'galaxy', 'alien', 'orbit', 'glide'],
  action: ['brawl', 'tank', 'combat', 'fight', 'action'],
};

export function deriveGameCategory(game: Game | null): string {
  if (!game) return 'arcade';
  const titleLower = game.title.toLowerCase();
  for (const [category, keywords] of Object.entries(KEYWORD_CATEGORIES)) {
    if (keywords.some((kw) => titleLower.includes(kw))) {
      return category;
    }
  }
  return game.tier || 'arcade';
}

class ArcadeContextManagerClass {
  private state: ArcadeContextState = { ...INITIAL_CONTEXT_STATE };
  private listeners: Set<() => void> = new Set();

  public getState(): ArcadeContextState {
    return { ...this.state };
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((fn) => fn());
  }

  public setGames(allGames: Game[]): void {
    this.state.allGames = allGames || [];
    if (this.state.currentTier) {
      this.state.currentTierGames = this.state.allGames.filter(
        (g) => String(g.tier).toLowerCase() === String(this.state.currentTier).toLowerCase()
      );
    } else {
      this.state.currentTierGames = this.state.allGames;
    }
    this.notify();
  }

  public setCurrentlyPlayingGame(game: Game | null): void {
    if (game) {
      if (this.state.currentlyOpenGame && this.state.currentlyOpenGame.id !== game.id) {
        this.state.previouslyPlayedGame = this.state.currentlyOpenGame;
      }
      this.state.currentlyOpenGame = game;
      this.state.isInsideGame = true;
      this.state.currentGameCategory = deriveGameCategory(game);
      this.state.currentTier = game.tier;
    } else {
      if (this.state.currentlyOpenGame) {
        this.state.previouslyPlayedGame = this.state.currentlyOpenGame;
      }
      this.state.currentlyOpenGame = null;
      this.state.isInsideGame = false;
    }
    this.notify();
  }

  public setSelectedTier(tierId: string | number, currentTierGames?: Game[]): void {
    this.state.currentTier = tierId;
    if (currentTierGames) {
      this.state.currentTierGames = currentTierGames;
    } else if (this.state.allGames.length > 0) {
      this.state.currentTierGames = this.state.allGames.filter(
        (g) => String(g.tier).toLowerCase() === String(tierId).toLowerCase()
      );
    }
    this.notify();
  }

  public setLastVoiceCommand(commandName: string): void {
    this.state.lastSuccessfulVoiceCommand = commandName;
    this.notify();
  }

  public setLastSearchResult(games: Game[]): void {
    this.state.lastSearchResult = games;
    this.notify();
  }

  /**
   * Find another game from the same category or tier as referenceGame (or current/previous game).
   */
  public findAnotherGame(refGame?: Game | null): Game | null {
    const reference = refGame || this.state.currentlyOpenGame || this.state.previouslyPlayedGame;
    const all = this.state.allGames;

    if (all.length === 0) return null;

    if (!reference) {
      // Pick random from current tier or all games
      const pool = this.state.currentTierGames.length > 0 ? this.state.currentTierGames : all;
      return pool[Math.floor(Math.random() * pool.length)] || null;
    }

    const category = deriveGameCategory(reference);

    // 1. Same derived category (excluding reference)
    const sameCategoryGames = all.filter(
      (g) => g.id !== reference.id && deriveGameCategory(g) === category
    );
    if (sameCategoryGames.length > 0) {
      const chosen = sameCategoryGames[Math.floor(Math.random() * sameCategoryGames.length)];
      this.state.lastRecommendedGame = chosen;
      return chosen;
    }

    // 2. Same tier (excluding reference)
    const sameTierGames = all.filter(
      (g) => g.id !== reference.id && String(g.tier).toLowerCase() === String(reference.tier).toLowerCase()
    );
    if (sameTierGames.length > 0) {
      const chosen = sameTierGames[Math.floor(Math.random() * sameTierGames.length)];
      this.state.lastRecommendedGame = chosen;
      return chosen;
    }

    // 3. Any other game
    const otherGames = all.filter((g) => g.id !== reference.id);
    if (otherGames.length > 0) {
      const chosen = otherGames[Math.floor(Math.random() * otherGames.length)];
      this.state.lastRecommendedGame = chosen;
      return chosen;
    }

    return null;
  }

  /**
   * Find a game similar to referenceGame (or current/previous game).
   */
  public findSimilarGame(refGame?: Game | null): Game | null {
    return this.findAnotherGame(refGame);
  }

  /**
   * Returns previously played game if available.
   */
  public getPreviousGame(): Game | null {
    return this.state.previouslyPlayedGame;
  }

  /**
   * Get description metadata for currently open or active game.
   */
  public getGameDescription(refGame?: Game | null): string | null {
    const game = refGame || this.state.currentlyOpenGame || this.state.previouslyPlayedGame;
    if (!game) return null;

    const category = deriveGameCategory(game);
    const tierName = String(game.tier).toUpperCase();

    return `${game.title} is an exciting ${category} game in the ${tierName} tier.`;
  }
}

export const ArcadeContextManager = new ArcadeContextManagerClass();
