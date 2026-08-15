// LocalStorage-Backed Persistent Storage Engine for Kreational
// Persists logged-in user, token, settings, and client state on the device
// with fallback to in-memory store if localStorage is unavailable.

const inMemoryStore = new Map<string, string>();

export function safeGet(key: string): string | null {
  try {
    if (typeof localStorage !== 'undefined') {
      const val = localStorage.getItem(key);
      if (val !== null) {
        inMemoryStore.set(key, val);
        return val;
      }
    }
  } catch (err) {
    console.warn(`[Storage] localStorage.getItem failed for key "${key}":`, err);
  }
  return inMemoryStore.get(key) || null;
}

export function safeSet(key: string, value: string): void {
  inMemoryStore.set(key, value);
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
    }
  } catch (err) {
    console.warn(`[Storage] localStorage.setItem failed for key "${key}":`, err);
  }
}

export function safeRemove(key: string): void {
  inMemoryStore.delete(key);
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(key);
    }
  } catch (err) {
    console.warn(`[Storage] localStorage.removeItem failed for key "${key}":`, err);
  }
}

/**
 * Initializes persistent device storage.
 * Ensures the device session is preserved and hydrated.
 */
export async function initPersistentStorage(): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    if (typeof localStorage !== 'undefined') {
      // Hydrate in-memory cache with persisted keys
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('kreational') || k.startsWith('kreations') || k === 'favorite_games' || k === 'recent_games')) {
          const val = localStorage.getItem(k);
          if (val) {
            inMemoryStore.set(k, val);
          }
        }
      }
    }
  } catch (err) {
    console.warn('[PersistentStorage] Initialization notice:', err);
  }
}

