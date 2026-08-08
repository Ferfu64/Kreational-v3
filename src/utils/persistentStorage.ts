// Server-Sided Storage Engine for Kreational
// All platform state (users, accounts, requests, games, favorites, notes, marketplace)
// is stored directly in Firestore server-side.
// LocalStorage is completely disabled for Kreational platform state.

const inMemoryStore = new Map<string, string>();

export function safeGet(key: string): string | null {
  return inMemoryStore.get(key) || null;
}

export function safeSet(key: string, value: string): void {
  inMemoryStore.set(key, value);
}

export function safeRemove(key: string): void {
  inMemoryStore.delete(key);
}

/**
 * Initializes server-sided storage. Clears any legacy local storage data for Kreational.
 */
export async function initPersistentStorage(): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    if (typeof localStorage !== 'undefined') {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('kreational') || k.startsWith('kreations') || k === 'favorite_games' || k === 'recent_games' || k.startsWith('game_notes'))) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    }
  } catch (err) {
    console.warn('[ServerStorage] Initialization notice:', err);
  }
}
