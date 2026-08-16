import { User, TierId } from '../types';
import { safeGet, safeSet } from './persistentStorage';

export const KREATOR_ADMIN_USER: User = {
  id: 'kreator-admin-id',
  username: 'Kreator',
  secretWord: 'Override',
  role: 'admin',
  krests: 250,
  reservedKrests: 0,
  purchasedTiers: ['bronze', 'silver', 'gold', 'diamond', 'mythic', 'legendary', 'master', 'pro'],
  temporaryAccess: [],
  createdAt: Date.now(),
};

export interface LocalAccountRecord {
  user: User;
  secretWord: string;
}

const LOCAL_ACCOUNTS_STORAGE_KEY = 'kreational_accounts_vault_v2';

// Memory cache for runtime operations; persistent data is saved to Firestore
const memoryAccountsCache: LocalAccountRecord[] = [];

export function getLocalAccounts(): LocalAccountRecord[] {
  if (memoryAccountsCache.length === 0) {
    try {
      const raw = safeGet(LOCAL_ACCOUNTS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          memoryAccountsCache.push(...parsed);
        }
      }
    } catch {}
  }
  return [...memoryAccountsCache];
}

export function saveLocalAccounts(accounts: LocalAccountRecord[]): void {
  memoryAccountsCache.length = 0;
  memoryAccountsCache.push(...accounts);
  try {
    safeSet(LOCAL_ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
  } catch {}
}

export function authenticateLocally(nameInput: string, wordInput: string): { user: User; token: string } | null {
  const cleanName = nameInput.trim();
  const cleanNameLower = cleanName.toLowerCase();
  const cleanWordLower = wordInput.trim().toLowerCase();

  const localAccounts = getLocalAccounts();

  // 1. Direct Kreator admin check
  if (cleanNameLower === 'kreator' && (cleanWordLower === 'override' || cleanWordLower === 'tjkqqybv')) {
    const existingKreator = localAccounts.find(
      (a) => a.user.id === KREATOR_ADMIN_USER.id || a.user.username.toLowerCase() === 'kreator'
    );
    if (existingKreator) {
      const u = {
        ...existingKreator.user,
        secretWord: existingKreator.secretWord || existingKreator.user.secretWord || 'Override',
      };
      return {
        user: u,
        token: `token-kreator-${Date.now()}`,
      };
    }
    return {
      user: KREATOR_ADMIN_USER,
      token: `token-kreator-${Date.now()}`,
    };
  }

  // 2. Memory/local cache check
  const found = localAccounts.find((acc) => {
    const uNameMatch = acc.user.username.toLowerCase() === cleanNameLower;
    const wordMatch = (acc.secretWord && acc.secretWord.toLowerCase() === cleanWordLower) ||
                      (acc.user.secretWord && acc.user.secretWord.toLowerCase() === cleanWordLower);
    return uNameMatch && wordMatch;
  });

  if (found) {
    const userWithWord = { ...found.user, secretWord: found.secretWord || found.user.secretWord };
    return {
      user: userWithWord,
      token: `token-${userWithWord.id}-${Date.now()}`,
    };
  }

  return null;
}

export function addLocalAccount(user: User, secretWord: string): void {
  const accounts = getLocalAccounts();
  const updatedUser = { ...user, secretWord };
  const existingIdx = accounts.findIndex(
    (a) => a.user.id === user.id || a.user.username.toLowerCase() === user.username.toLowerCase()
  );
  if (existingIdx >= 0) {
    accounts[existingIdx] = { user: updatedUser, secretWord };
  } else {
    accounts.push({ user: updatedUser, secretWord });
  }
  saveLocalAccounts(accounts);
}

export function updateLocalAccount(
  userId: string,
  updates: { username?: string; secretWord?: string; purchasedTiers?: TierId[]; removeAllAccess?: boolean }
): User | null {
  const accounts = getLocalAccounts();
  const idx = accounts.findIndex((a) => a.user.id === userId);
  if (idx < 0) return null;

  const current = accounts[idx];
  const updatedWord = updates.secretWord ? updates.secretWord : (current.secretWord || current.user.secretWord || '');
  const updatedUser: User = {
    ...current.user,
    username: updates.username ? updates.username : current.user.username,
    secretWord: updatedWord,
    purchasedTiers: updates.removeAllAccess
      ? []
      : updates.purchasedTiers !== undefined
      ? updates.purchasedTiers
      : current.user.purchasedTiers,
  };

  accounts[idx] = { user: updatedUser, secretWord: updatedWord };
  saveLocalAccounts(accounts);
  return updatedUser;
}

export function deleteLocalAccount(userId: string): void {
  const accounts = getLocalAccounts();
  const filtered = accounts.filter((a) => a.user.id !== userId);
  saveLocalAccounts(filtered);
}

export function getAllUsersList(): User[] {
  const accounts = getLocalAccounts();
  const userList = [KREATOR_ADMIN_USER, ...accounts.map((a) => ({ ...a.user, secretWord: a.secretWord || a.user.secretWord }))];
  const uniqueUsers: User[] = [];
  const seenIds = new Set<string>();
  for (const u of userList) {
    if (!seenIds.has(u.id)) {
      seenIds.add(u.id);
      uniqueUsers.push(u);
    }
  }
  return uniqueUsers;
}
