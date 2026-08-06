// Dual Persistent Storage Engine (localStorage + IndexedDB mirror) for PWA & Mobile WebViews
// Ensures settings, login session, local accounts, custom games, requests, favorites, and notes are never lost.

const DB_NAME = 'kreational_pwa_persistent_db';
const DB_VERSION = 1;
const STORE_NAME = 'kv_store';

let dbInstance: IDBDatabase | null = null;
let isDbReady = false;

function openDB(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.resolve(null);
  }
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = (e) => {
        dbInstance = (e.target as IDBOpenDBRequest).result;
        isDbReady = true;
        resolve(dbInstance);
      };
      request.onerror = (err) => {
        console.warn('[PersistentStorage] IndexedDB open error:', err);
        resolve(null);
      };
    } catch (err) {
      console.warn('[PersistentStorage] IndexedDB error:', err);
      resolve(null);
    }
  });
}

async function writeIndexedDB(key: string, value: string | null): Promise<void> {
  const db = await openDB();
  if (!db) return;
  try {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    if (value === null) {
      store.delete(key);
    } else {
      store.put(value, key);
    }
  } catch (err) {
    console.warn('[PersistentStorage] writeIndexedDB error:', err);
  }
}

async function readIndexedDB(key: string): Promise<string | null> {
  const db = await openDB();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    } catch (err) {
      resolve(null);
    }
  });
}

async function getAllIndexedDBKeys(): Promise<{ key: string; value: string }[]> {
  const db = await openDB();
  if (!db) return [];
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.openCursor();
      const results: { key: string; value: string }[] = [];
      req.onsuccess = (e) => {
        const cursor = (e.target as IDBRequest).result as IDBCursorWithValue;
        if (cursor) {
          results.push({ key: cursor.key as string, value: cursor.value as string });
          cursor.continue();
        } else {
          resolve(results);
        }
      };
      req.onerror = () => resolve([]);
    } catch (err) {
      resolve([]);
    }
  });
}

export function safeGet(key: string): string | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    return localStorage.getItem(key);
  } catch (err) {
    console.warn(`[PersistentStorage] safeGet error for ${key}:`, err);
    return null;
  }
}

export function safeSet(key: string, value: string): void {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(key, value);
    } catch (err) {
      console.warn(`[PersistentStorage] safeSet error for ${key}:`, err);
    }
  }
  // Mirror to IndexedDB
  writeIndexedDB(key, value);
}

export function safeRemove(key: string): void {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(key);
    } catch (err) {
      console.warn(`[PersistentStorage] safeRemove error for ${key}:`, err);
    }
  }
  // Remove from IndexedDB
  writeIndexedDB(key, null);
}

/**
 * Initializes persistent storage on app boot.
 * Restores any keys missing from localStorage using IndexedDB backup.
 */
export async function initPersistentStorage(): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    const idbEntries = await getAllIndexedDBKeys();
    for (const { key, value } of idbEntries) {
      if (key && value) {
        const localVal = safeGet(key);
        if (!localVal) {
          // Restore to localStorage if cleared or missing
          try {
            localStorage.setItem(key, value);
            console.log(`[PersistentStorage] Restored key '${key}' from IndexedDB`);
          } catch (e) {
            // ignore
          }
        }
      }
    }

    // Also backup current localStorage keys to IndexedDB
    if (typeof localStorage !== 'undefined') {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('kreational')) {
          const val = localStorage.getItem(k);
          if (val) {
            writeIndexedDB(k, val);
          }
        }
      }
    }
  } catch (err) {
    console.warn('[PersistentStorage] initPersistentStorage warning:', err);
  }
}
