import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  query,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { User, Game, GameRequest, TierId, TemporaryAccess, RequestStatus, AccountCreationRequest } from '../types';
import { DEFAULT_GAMES } from '../data/defaultGames';
import {
  KREATOR_ADMIN_USER,
  getLocalAccounts,
  addLocalAccount,
  deleteLocalAccount,
} from '../utils/localAuth';
import { safeGet, safeSet } from '../utils/persistentStorage';
import { sharedGamesModule } from './gamesModule';

const USERS_COLLECTION = 'users';
const GAMES_COLLECTION = 'games';
const REQUESTS_COLLECTION = 'requests';

export interface UserAccountRecord {
  user: User;
  secretWord: string;
  krests?: number;
  updatedAt?: number;
}

// Sanitize objects for Firestore to prevent undefined field errors
function sanitizeForFirestore<T>(data: T): T {
  return JSON.parse(JSON.stringify(data));
}

// Timeout helper to avoid infinite hanging when network or firestore is slow
function withTimeout<T>(promise: Promise<T>, timeoutMs: number = 3000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Firestore operation timed out after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}

// Ensure initial Kreator Admin Account in Firestore without overwriting existing data
export async function ensureKreatorAdminInFirestore(): Promise<UserAccountRecord> {
  try {
    const docRef = doc(db, USERS_COLLECTION, KREATOR_ADMIN_USER.id);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      if (data) {
        let loadedUser: User | null = null;
        let secretWord = 'Override';

        if (data.user && typeof data.user === 'object') {
          loadedUser = {
            ...KREATOR_ADMIN_USER,
            ...data.user,
            krests: typeof data.user.krests === 'number' ? data.user.krests : (typeof data.krests === 'number' ? data.krests : 250),
          };
          secretWord = data.secretWord || data.user.secretWord || 'Override';
        } else if (data.username) {
          loadedUser = {
            ...KREATOR_ADMIN_USER,
            ...(data as unknown as User),
            krests: typeof data.krests === 'number' ? data.krests : 250,
          };
          secretWord = data.secretWord || 'Override';
        }

        if (loadedUser) {
          loadedUser.secretWord = secretWord;
          addLocalAccount(loadedUser, secretWord);
          return { user: loadedUser, secretWord, krests: loadedUser.krests };
        }
      }
    }

    // Only create initial document if it genuinely does not exist
    const initialKreator: User = {
      ...KREATOR_ADMIN_USER,
      krests: 250,
      secretWord: 'Override',
    };
    const kreatorRecord: UserAccountRecord = {
      user: initialKreator,
      secretWord: 'Override',
      krests: 250,
      updatedAt: Date.now(),
    };
    await setDoc(docRef, sanitizeForFirestore(kreatorRecord));
    addLocalAccount(initialKreator, 'Override');
    return kreatorRecord;
  } catch (err) {
    console.warn('Firestore ensure Kreator Admin check failed, checking local store:', err);
  }

  // Fallback to local accounts cache if offline
  const localAccounts = getLocalAccounts();
  const existing = localAccounts.find(
    (a) => a.user.id === KREATOR_ADMIN_USER.id || a.user.username.toLowerCase() === 'kreator'
  );
  if (existing) {
    return existing;
  }

  return { user: KREATOR_ADMIN_USER, secretWord: 'Override' };
}

// Get User Document from Firestore by ID
export async function getUserDocFromFirestore(userId: string): Promise<User | null> {
  try {
    const docRef = doc(db, USERS_COLLECTION, userId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      if (data) {
        let userObj: User | null = null;
        let secWord = '';

        if (data.user && typeof data.user === 'object') {
          userObj = data.user as User;
          secWord = data.secretWord || data.user.secretWord || '';
        } else if (data.username) {
          userObj = data as unknown as User;
          secWord = data.secretWord || '';
        }

        if (userObj) {
          const finalUser: User = {
            ...userObj,
            krests: typeof userObj.krests === 'number' ? userObj.krests : (typeof data.krests === 'number' ? data.krests : 50),
            secretWord: secWord || userObj.secretWord || '',
          };
          addLocalAccount(finalUser, finalUser.secretWord || '');
          return finalUser;
        }
      }
    }
  } catch (err) {
    console.warn('getUserDocFromFirestore error:', err);
  }
  return null;
}

// Subscribe to real-time updates for a user document in Firestore
export function subscribeToUserDoc(userId: string, callback: (user: User) => void): () => void {
  try {
    const docRef = doc(db, USERS_COLLECTION, userId);
    const unsubscribe = onSnapshot(
      docRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data) {
            let userObj: User | null = null;
            let secWord = '';

            if (data.user && typeof data.user === 'object') {
              userObj = data.user as User;
              secWord = data.secretWord || data.user.secretWord || '';
            } else if (data.username) {
              userObj = data as unknown as User;
              secWord = data.secretWord || '';
            }

            if (userObj) {
              const finalUser: User = {
                ...userObj,
                krests: typeof userObj.krests === 'number' ? userObj.krests : (typeof data.krests === 'number' ? data.krests : 50),
                secretWord: secWord || userObj.secretWord || '',
              };
              callback(finalUser);
            }
          }
        }
      },
      (err) => {
        console.warn('subscribeToUserDoc listener error:', err);
      }
    );
    return unsubscribe;
  } catch (err) {
    console.warn('subscribeToUserDoc error:', err);
    return () => {};
  }
}

// AUTHENTICATION
export async function authenticateAccount(
  nameInput: string,
  wordInput: string
): Promise<{ user: User; token: string } | null> {
  const cleanName = nameInput.trim();
  const cleanNameLower = cleanName.toLowerCase();
  const cleanWordLower = wordInput.trim().toLowerCase();

  // 1. Direct Kreator admin check - preserves Firestore document
  if (cleanNameLower === 'kreator' && (cleanWordLower === 'override' || cleanWordLower === 'tjkqqybv')) {
    const adminRecord = await ensureKreatorAdminInFirestore();
    const adminUser = adminRecord.user || KREATOR_ADMIN_USER;
    return {
      user: adminUser,
      token: `token-kreator-${Date.now()}`,
    };
  }

  // 2. Query Firestore users collection
  try {
    const q = query(collection(db, USERS_COLLECTION));
    const querySnapshot = await getDocs(q);
    let matchedDoc: UserAccountRecord | null = null;

    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data) {
        let userObj: User | null = null;
        let secWord = '';

        if (data.user && typeof data.user === 'object') {
          userObj = data.user as User;
          secWord = data.secretWord || data.user.secretWord || '';
        } else if (data.username) {
          userObj = data as unknown as User;
          secWord = data.secretWord || '';
        }

        if (userObj && userObj.username) {
          const uNameMatch = userObj.username.toLowerCase() === cleanNameLower;
          const wordMatch =
            (secWord && secWord.toLowerCase() === cleanWordLower) ||
            (userObj.secretWord && userObj.secretWord.toLowerCase() === cleanWordLower);

          if (uNameMatch && wordMatch) {
            matchedDoc = {
              user: {
                ...userObj,
                krests: typeof userObj.krests === 'number' ? userObj.krests : (typeof data.krests === 'number' ? data.krests : 50),
                secretWord: secWord || userObj.secretWord || '',
              },
              secretWord: secWord || userObj.secretWord || '',
            };
          }
        }
      }
    });

    if (matchedDoc) {
      const matchedUser = (matchedDoc as UserAccountRecord).user;
      addLocalAccount(matchedUser, (matchedDoc as UserAccountRecord).secretWord || '');
      return {
        user: matchedUser,
        token: `token-${matchedUser.id}-${Date.now()}`,
      };
    }
  } catch (err) {
    console.warn('Firestore authentication check failed, falling back to local accounts:', err);
  }

  // 3. Fallback to local accounts storage
  const localAccounts = getLocalAccounts();
  const foundLocal = localAccounts.find((acc) => {
    const uNameMatch = acc.user.username.toLowerCase() === cleanNameLower;
    const wordMatch =
      (acc.secretWord && acc.secretWord.toLowerCase() === cleanWordLower) ||
      (acc.user.secretWord && acc.user.secretWord.toLowerCase() === cleanWordLower);
    return uNameMatch && wordMatch;
  });

  if (foundLocal) {
    const userObj = {
      ...foundLocal.user,
      secretWord: foundLocal.secretWord || foundLocal.user.secretWord,
    };
    return {
      user: userObj,
      token: `token-${userObj.id}-${Date.now()}`,
    };
  }

  return null;
}

// USERS MANAGEMENT
export async function fetchAllUsers(): Promise<User[]> {
  const userMap = new Map<string, User>();

  try {
    const querySnapshot = await getDocs(collection(db, USERS_COLLECTION));
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data) {
        let userObj: User | null = null;
        let secWord = '';

        if (data.user && typeof data.user === 'object') {
          userObj = data.user as User;
          secWord = data.secretWord || data.user.secretWord || '';
        } else if (data.username) {
          userObj = data as unknown as User;
          secWord = data.secretWord || '';
        }

        if (userObj && !userObj.isBot && !userObj.id?.startsWith('bot-')) {
          const completeUser: User = {
            ...userObj,
            krests: typeof userObj.krests === 'number' ? userObj.krests : (typeof data.krests === 'number' ? data.krests : 50),
            secretWord: secWord || userObj.secretWord || '',
          };
          userMap.set(completeUser.id, completeUser);
          if (secWord) {
            addLocalAccount(completeUser, secWord);
          }
        }
      }
    });
  } catch (err) {
    console.warn('Firestore fetch all users failed, using local accounts:', err);
    getLocalAccounts().forEach((a) => {
      if (!a.user.isBot && !a.user.id?.startsWith('bot-')) {
        userMap.set(a.user.id, { ...a.user, secretWord: a.secretWord || a.user.secretWord });
      }
    });
  }

  if (!userMap.has(KREATOR_ADMIN_USER.id)) {
    userMap.set(KREATOR_ADMIN_USER.id, KREATOR_ADMIN_USER);
  }

  return Array.from(userMap.values());
}

export async function createUserAccount(userObj: User, secretWordStr: string): Promise<void> {
  const userWithWord: User = { ...userObj, secretWord: secretWordStr };
  const accountRecord: UserAccountRecord = {
    user: userWithWord,
    secretWord: secretWordStr,
    krests: userWithWord.krests !== undefined ? userWithWord.krests : 50,
    updatedAt: Date.now(),
  };

  addLocalAccount(userWithWord, secretWordStr);

  try {
    const docRef = doc(db, USERS_COLLECTION, userWithWord.id);
    await setDoc(docRef, sanitizeForFirestore(accountRecord));
  } catch (err) {
    console.warn('Firestore create user account failed:', err);
  }
}

// DATASTORE EXPORT & IMPORT BACKUP SYSTEM
export function generateDatastoreSnapshot(user: User): string {
  try {
    const keysToBackup = [
      'kreational_user',
      'favorite_games',
      'recent_games',
      'kreational_sound_effects',
      'kreational_bg_music',
      'kreational_voice_assistant',
      'game_history',
    ];
    const snapshotData: Record<string, string | null> = {};
    keysToBackup.forEach((key) => {
      snapshotData[key] = safeGet(key);
    });
    snapshotData['_user_state'] = JSON.stringify(user);
    return JSON.stringify(snapshotData);
  } catch (err) {
    console.warn('Failed to generate datastore snapshot:', err);
    return '';
  }
}

export function applyDatastoreSnapshot(snapshotStr: string | undefined): boolean {
  if (!snapshotStr || snapshotStr.trim() === '') return false;
  try {
    const parsed = JSON.parse(snapshotStr);
    if (typeof parsed === 'object' && parsed !== null) {
      Object.keys(parsed).forEach((key) => {
        if (
          key !== '_user_state' &&
          key !== 'kreational_user' &&
          key !== 'kreations_user' &&
          typeof parsed[key] === 'string'
        ) {
          safeSet(key, parsed[key] as string);
        }
      });
      return true;
    }
  } catch (err) {
    console.warn('Failed to apply datastore snapshot:', err);
  }
  return false;
}

export async function saveFullUserAccountToFirestore(updatedUser: User): Promise<User> {
  const secretWord = updatedUser.secretWord || '';
  const cleanUser: User = JSON.parse(JSON.stringify(updatedUser));

  // Harmonize friends and notifiedApprovals
  const unifiedFriends = Array.from(
    new Set([...(cleanUser.friends || []), ...(cleanUser.notifiedApprovals || [])])
  );
  cleanUser.friends = unifiedFriends;
  cleanUser.notifiedApprovals = unifiedFriends;

  const accountRecord: UserAccountRecord = {
    user: cleanUser,
    secretWord,
    krests: cleanUser.krests,
    updatedAt: Date.now(),
  };

  addLocalAccount(cleanUser, secretWord);

  try {
    const docRef = doc(db, USERS_COLLECTION, cleanUser.id);
    await setDoc(docRef, sanitizeForFirestore(accountRecord));
  } catch (err) {
    console.warn('Firestore save full user account failed:', err);
  }

  return cleanUser;
}

export async function updateUserAccount(
  userId: string,
  updates: { username?: string; secretWord?: string; purchasedTiers?: TierId[]; removeAllAccess?: boolean; krests?: number }
): Promise<User | null> {
  let existingAccount: UserAccountRecord | null = null;

  try {
    const docRef = doc(db, USERS_COLLECTION, userId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data) {
        if (data.user && typeof data.user === 'object') {
          existingAccount = {
            user: data.user as User,
            secretWord: data.secretWord || data.user.secretWord || '',
            krests: data.user.krests,
          };
        } else if (data.username) {
          existingAccount = {
            user: data as unknown as User,
            secretWord: data.secretWord || '',
            krests: data.krests,
          };
        }
      }
    }
  } catch (err) {
    console.warn('Firestore fetch doc for update failed:', err);
  }

  if (!existingAccount) {
    const local = getLocalAccounts().find((a) => a.user.id === userId);
    if (local) existingAccount = local;
  }

  if (!existingAccount) {
    if (userId === KREATOR_ADMIN_USER.id) {
      existingAccount = { user: KREATOR_ADMIN_USER, secretWord: 'Override', krests: 250 };
    } else {
      return null;
    }
  }

  const newWord = updates.secretWord !== undefined ? updates.secretWord : (existingAccount.secretWord || existingAccount.user.secretWord || '');
  const updatedKrests = updates.krests !== undefined ? updates.krests : (existingAccount.user.krests !== undefined ? existingAccount.user.krests : 0);

  const updatedUser: User = {
    ...existingAccount.user,
    username: updates.username !== undefined ? updates.username : existingAccount.user.username,
    secretWord: newWord,
    krests: updatedKrests,
    purchasedTiers: updates.removeAllAccess
      ? []
      : updates.purchasedTiers !== undefined
      ? updates.purchasedTiers
      : existingAccount.user.purchasedTiers,
  };

  const updatedRecord: UserAccountRecord = {
    user: updatedUser,
    secretWord: newWord,
    krests: updatedKrests,
    updatedAt: Date.now(),
  };

  addLocalAccount(updatedUser, newWord);

  try {
    const docRef = doc(db, USERS_COLLECTION, userId);
    await setDoc(docRef, sanitizeForFirestore(updatedRecord));
  } catch (err) {
    console.warn('Firestore update user account failed:', err);
  }

  return updatedUser;
}

export async function deleteUserAccount(userId: string): Promise<void> {
  deleteLocalAccount(userId);

  try {
    const docRef = doc(db, USERS_COLLECTION, userId);
    await deleteDoc(docRef);
  } catch (err) {
    console.warn('Firestore delete user failed:', err);
  }
}

// GAMES MANAGEMENT
export async function fetchAllGamesStore(): Promise<Game[]> {
  let gamesFromDb: Game[] = [];
  try {
    const querySnapshot = await withTimeout(getDocs(collection(db, GAMES_COLLECTION)), 3000);
    querySnapshot.forEach((docSnap) => {
      gamesFromDb.push(docSnap.data() as Game);
    });

    // Merge default games with database games
    const dbGameIds = new Set(gamesFromDb.map((g) => g.id));
    const missingDefaults = DEFAULT_GAMES.filter((g) => !dbGameIds.has(g.id));

    if (missingDefaults.length > 0) {
      // Seed missing default games into Firestore
      for (const game of missingDefaults) {
        setDoc(doc(db, GAMES_COLLECTION, game.id), game).catch(() => {});
        gamesFromDb.push(game);
      }
    }

    sharedGamesModule.syncFromFirestore(gamesFromDb);
  } catch (err) {
    console.warn('Firestore fetch games failed, relying on shared games module & default list:', err);
    sharedGamesModule.syncActiveGamesToDefault();
  }

  return sharedGamesModule.getAllGames();
}

/**
 * Synchronizes all currently active games into the default games registry and Firestore.
 */
export async function syncAllActiveGamesToDefaultStore(extraGames: Game[] = []): Promise<Game[]> {
  const allSynced = sharedGamesModule.syncActiveGamesToDefault(extraGames);

  // Persist all active games to Firestore
  try {
    for (const game of allSynced) {
      await setDoc(doc(db, GAMES_COLLECTION, game.id), game).catch(() => {});
    }
  } catch (err) {
    console.warn('Sync all games to Firestore failed:', err);
  }

  return allSynced;
}

export async function createGameStore(game: Game): Promise<void> {
  sharedGamesModule.addOrUpdateGame(game);

  try {
    await setDoc(doc(db, GAMES_COLLECTION, game.id), game);
  } catch (err) {
    console.warn('Firestore create game failed:', err);
  }
}

export async function updateGameStore(game: Game): Promise<void> {
  sharedGamesModule.addOrUpdateGame(game);

  try {
    await setDoc(doc(db, GAMES_COLLECTION, game.id), game);
  } catch (err) {
    console.warn('Firestore update game failed:', err);
  }
}

export async function deleteGameStore(gameId: string): Promise<void> {
  sharedGamesModule.removeGame(gameId);

  try {
    await deleteDoc(doc(db, GAMES_COLLECTION, gameId));
  } catch (err) {
    console.warn('Firestore delete game failed:', err);
  }
}

// REQUESTS MANAGEMENT
export async function fetchAllRequestsStore(): Promise<GameRequest[]> {
  const requestMap = new Map<string, GameRequest>();

  try {
    const querySnapshot = await withTimeout(getDocs(collection(db, REQUESTS_COLLECTION)), 3000);
    querySnapshot.forEach((docSnap) => {
      const req = docSnap.data() as GameRequest;
      requestMap.set(req.id, req);
    });
  } catch (err) {
    console.warn('Firestore fetch requests failed:', err);
  }

  return Array.from(requestMap.values()).sort((a, b) => b.createdAt - a.createdAt);
}

export async function fetchUserRequestsStore(userId: string): Promise<GameRequest[]> {
  const all = await fetchAllRequestsStore();
  return all.filter((r) => r.userId === userId);
}

export async function createRequestStore(req: GameRequest): Promise<void> {
  try {
    await setDoc(doc(db, REQUESTS_COLLECTION, req.id), req);
  } catch (err) {
    console.warn('Firestore create request failed:', err);
  }
}

export async function resolveRequestStore(
  requestId: string,
  status: RequestStatus,
  durationSeconds?: number
): Promise<void> {
  let reqObj: GameRequest | null = null;

  try {
    const docRef = doc(db, REQUESTS_COLLECTION, requestId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      reqObj = snap.data() as GameRequest;
      reqObj.status = status;
      reqObj.resolvedAt = Date.now();
      if (durationSeconds) reqObj.durationSeconds = durationSeconds;
      await setDoc(docRef, reqObj);
    }
  } catch (err) {
    console.warn('Firestore update request status failed:', err);
  }

  if (status === 'denied' && reqObj) {
    const targetUserId = reqObj.userId;
    const currentUsers = await fetchAllUsers();
    const targetUser = currentUsers.find((u) => u.id === targetUserId || u.username === reqObj?.username);

    if (targetUser) {
      const updatedKrests = (targetUser.krests || 0) + 25;
      targetUser.krests = updatedKrests;

      const localAccounts = getLocalAccounts();
      const acc = localAccounts.find((a) => a.user.id === targetUser.id);
      if (acc) {
        addLocalAccount(targetUser, acc.secretWord || targetUser.secretWord || '');
      }
      try {
        const uDocRef = doc(db, USERS_COLLECTION, targetUser.id);
        const uSnap = await getDoc(uDocRef);
        if (uSnap.exists()) {
          const uData = uSnap.data() as UserAccountRecord;
          uData.user.krests = updatedKrests;
          await setDoc(uDocRef, uData);
        }
      } catch (e) {}
    }
  }

  if (status === 'accepted' && reqObj) {
    const targetUserId = reqObj.userId;
    const currentUsers = await fetchAllUsers();
    const targetUser = currentUsers.find((u) => u.id === targetUserId || u.username === reqObj?.username);

    if (targetUser) {
      if (reqObj.type === 'tier' && reqObj.tierId) {
        if (durationSeconds) {
          // Grant Temporary Tier Access
          const currentTemp = targetUser.temporaryAccess || [];
          const newTemp: TemporaryAccess[] = [
            ...currentTemp.filter((t) => t.tierId !== reqObj?.tierId),
            { tierId: reqObj.tierId, grantedAt: Date.now(), durationSeconds },
          ];
          targetUser.temporaryAccess = newTemp;

          const localAccounts = getLocalAccounts();
          const acc = localAccounts.find((a) => a.user.id === targetUser.id);
          if (acc) {
            addLocalAccount(targetUser, acc.secretWord || targetUser.secretWord || '');
          }
          try {
            const uDocRef = doc(db, USERS_COLLECTION, targetUser.id);
            const uSnap = await getDoc(uDocRef);
            if (uSnap.exists()) {
              const uData = uSnap.data() as UserAccountRecord;
              uData.user.temporaryAccess = newTemp;
              await setDoc(uDocRef, uData);
            }
          } catch (e) {}
        } else {
          // Grant Permanent Tier Access
          const currentTiers = targetUser.purchasedTiers || [];
          if (!currentTiers.includes(reqObj.tierId)) {
            await updateUserAccount(targetUser.id, {
              purchasedTiers: [...currentTiers, reqObj.tierId],
            });
          }
        }
      } else if (reqObj.type === 'single_game' && reqObj.targetId) {
        const currentTemp = targetUser.temporaryAccess || [];
        const durSecs = durationSeconds || reqObj.durationSeconds || 3600;
        const newTemp: TemporaryAccess[] = [
          ...currentTemp.filter((t) => t.gameId !== reqObj?.targetId),
          { gameId: reqObj.targetId, grantedAt: Date.now(), durationSeconds: durSecs },
        ];

        targetUser.temporaryAccess = newTemp;
        const localAccounts = getLocalAccounts();
        const acc = localAccounts.find((a) => a.user.id === targetUser.id);
        if (acc) {
          addLocalAccount(targetUser, acc.secretWord || targetUser.secretWord || '');
        }
        try {
          const uDocRef = doc(db, USERS_COLLECTION, targetUser.id);
          const uSnap = await getDoc(uDocRef);
          if (uSnap.exists()) {
            const uData = uSnap.data() as UserAccountRecord;
            uData.user.temporaryAccess = newTemp;
            await setDoc(uDocRef, uData);
          }
        } catch (e) {}
      }
    }
  }
}

// ACCOUNT CREATION REQUESTS MANAGEMENT
const ACCOUNT_REQUESTS_COLLECTION = 'account_requests';
const LOCAL_ACCOUNT_REQUESTS_KEY = 'kreational_account_requests_cache';

export async function createAccountRequestStore(req: AccountCreationRequest): Promise<void> {
  // 1. Cache locally
  try {
    const raw = safeGet(LOCAL_ACCOUNT_REQUESTS_KEY);
    const list: AccountCreationRequest[] = raw ? JSON.parse(raw) : [];
    const filtered = list.filter((r) => r.id !== req.id && r.preferredUsername.toLowerCase() !== req.preferredUsername.toLowerCase());
    filtered.unshift(req);
    safeSet(LOCAL_ACCOUNT_REQUESTS_KEY, JSON.stringify(filtered));
  } catch {}

  // 2. Persist to Firestore
  try {
    const docRef = doc(db, ACCOUNT_REQUESTS_COLLECTION, req.id);
    await setDoc(docRef, sanitizeForFirestore(req));
  } catch (err) {
    console.warn('Firestore create account request failed:', err);
  }
}

export async function fetchAllAccountRequestsStore(): Promise<AccountCreationRequest[]> {
  const reqMap = new Map<string, AccountCreationRequest>();

  // 1. Fetch from Firestore
  try {
    const querySnapshot = await getDocs(collection(db, ACCOUNT_REQUESTS_COLLECTION));
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data() as AccountCreationRequest;
      if (data && data.id && data.preferredUsername) {
        reqMap.set(data.id, data);
      }
    });
  } catch (err) {
    console.warn('Firestore fetch account requests failed:', err);
  }

  // 2. Merge local cache
  try {
    const raw = safeGet(LOCAL_ACCOUNT_REQUESTS_KEY);
    if (raw) {
      const parsed: AccountCreationRequest[] = JSON.parse(raw);
      parsed.forEach((r) => {
        if (!reqMap.has(r.id)) {
          reqMap.set(r.id, r);
        }
      });
    }
  } catch {}

  return Array.from(reqMap.values()).sort((a, b) => b.createdAt - a.createdAt);
}

export function subscribeToAccountRequests(callback: (requests: AccountCreationRequest[]) => void): () => void {
  try {
    const q = query(collection(db, ACCOUNT_REQUESTS_COLLECTION));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: AccountCreationRequest[] = [];
        snapshot.forEach((d) => {
          const item = d.data() as AccountCreationRequest;
          if (item && item.id && item.preferredUsername) {
            list.push(item);
          }
        });
        list.sort((a, b) => b.createdAt - a.createdAt);
        try {
          safeSet(LOCAL_ACCOUNT_REQUESTS_KEY, JSON.stringify(list));
        } catch {}
        callback(list);
      },
      (err) => {
        console.warn('subscribeToAccountRequests error:', err);
      }
    );
    return unsubscribe;
  } catch (err) {
    console.warn('Failed to subscribe to account requests:', err);
    return () => {};
  }
}

export async function checkAccountRequestStatus(username: string): Promise<AccountCreationRequest | null> {
  const clean = username.trim().toLowerCase();
  const all = await fetchAllAccountRequestsStore();
  const found = all.find((r) => r.preferredUsername.toLowerCase() === clean);
  return found || null;
}

export async function resolveAccountRequestStore(
  requestId: string,
  status: 'accepted' | 'denied',
  options?: { reviewerNotes?: string; grantedTiers?: TierId[]; initialKrests?: number }
): Promise<{ success: boolean; user?: User; error?: string }> {
  let requestObj: AccountCreationRequest | null = null;

  try {
    const docRef = doc(db, ACCOUNT_REQUESTS_COLLECTION, requestId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      requestObj = snap.data() as AccountCreationRequest;
    }
  } catch (err) {
    console.warn('Fetch account request doc failed:', err);
  }

  if (!requestObj) {
    const local = (await fetchAllAccountRequestsStore()).find((r) => r.id === requestId);
    if (local) requestObj = local;
  }

  if (!requestObj) {
    return { success: false, error: 'Account request not found' };
  }

  const updatedReq: AccountCreationRequest = {
    ...requestObj,
    status,
    resolvedAt: Date.now(),
    reviewerNotes: options?.reviewerNotes || (status === 'accepted' ? 'Approved by Kreator' : 'Declined by Kreator'),
    grantedTiers: options?.grantedTiers,
    initialKrests: options?.initialKrests,
  };

  // Update in Firestore
  try {
    const docRef = doc(db, ACCOUNT_REQUESTS_COLLECTION, requestId);
    await setDoc(docRef, sanitizeForFirestore(updatedReq));
  } catch (err) {
    console.warn('Failed to save resolved account request in Firestore:', err);
  }

  // Update local cache
  try {
    const raw = safeGet(LOCAL_ACCOUNT_REQUESTS_KEY);
    const list: AccountCreationRequest[] = raw ? JSON.parse(raw) : [];
    const updatedList = list.map((r) => (r.id === requestId ? updatedReq : r));
    safeSet(LOCAL_ACCOUNT_REQUESTS_KEY, JSON.stringify(updatedList));
  } catch {}

  // If approved, create the user account in Firestore
  if (status === 'accepted') {
    const krestsAmount = typeof options?.initialKrests === 'number' ? options.initialKrests : 50;
    const initialTiers: TierId[] = options?.grantedTiers && options.grantedTiers.length > 0 ? options.grantedTiers : ['bronze'];

    const newUserId = `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newUser: User = {
      id: newUserId,
      username: updatedReq.preferredUsername.trim(),
      secretWord: updatedReq.preferredSecretWord.trim(),
      role: 'user',
      purchasedTiers: initialTiers,
      temporaryAccess: [],
      krests: krestsAmount,
      createdAt: Date.now(),
      dailyStreak: 1,
      cosmetics: {
        title: 'New Initiate',
      },
    };

    await createUserAccount(newUser, updatedReq.preferredSecretWord.trim());
    return { success: true, user: newUser };
  }

  return { success: true };
}

export async function deleteAccountRequestStore(requestId: string): Promise<void> {
  try {
    const docRef = doc(db, ACCOUNT_REQUESTS_COLLECTION, requestId);
    await deleteDoc(docRef);
  } catch (err) {
    console.warn('Firestore delete account request failed:', err);
  }

  try {
    const raw = safeGet(LOCAL_ACCOUNT_REQUESTS_KEY);
    if (raw) {
      const list: AccountCreationRequest[] = JSON.parse(raw);
      const filtered = list.filter((r) => r.id !== requestId);
      safeSet(LOCAL_ACCOUNT_REQUESTS_KEY, JSON.stringify(filtered));
    }
  } catch {}
}
