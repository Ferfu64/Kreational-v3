import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  query,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { User, Game, GameRequest, TierId, TemporaryAccess, RequestStatus } from '../types';
import { DEFAULT_GAMES } from '../data/defaultGames';
import {
  KREATOR_ADMIN_USER,
  getLocalAccounts,
  addLocalAccount,
  deleteLocalAccount,
} from '../utils/localAuth';
import { sharedGamesModule } from './gamesModule';

const USERS_COLLECTION = 'users';
const GAMES_COLLECTION = 'games';
const REQUESTS_COLLECTION = 'requests';

function withTimeout<T>(promise: Promise<T>, timeoutMs = 3500): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Firestore timeout: backend unreachable')), timeoutMs)
    ),
  ]);
}

export interface UserAccountRecord {
  user: User;
  secretWord: string;
}

// Ensure initial Kreator Admin Account in Firestore
export async function ensureKreatorAdminInFirestore(): Promise<UserAccountRecord> {
  const kreatorRecord: UserAccountRecord = {
    user: KREATOR_ADMIN_USER,
    secretWord: 'Override',
  };
  try {
    const docRef = doc(db, USERS_COLLECTION, KREATOR_ADMIN_USER.id);
    const snap = await withTimeout(getDoc(docRef), 2500);
    if (!snap.exists()) {
      await withTimeout(setDoc(docRef, kreatorRecord), 2500);
    }
  } catch (err) {
    console.warn('Firestore ensure Kreator Admin failed:', err);
  }
  return kreatorRecord;
}

// AUTHENTICATION
export async function authenticateAccount(
  nameInput: string,
  wordInput: string
): Promise<{ user: User; token: string } | null> {
  const cleanName = nameInput.trim();
  const cleanNameLower = cleanName.toLowerCase();
  const cleanWordLower = wordInput.trim().toLowerCase();

  // 1. Direct Kreator admin check
  if (cleanNameLower === 'kreator' && (cleanWordLower === 'override' || cleanWordLower === 'tjkqqybv')) {
    ensureKreatorAdminInFirestore().catch(() => {});
    return {
      user: KREATOR_ADMIN_USER,
      token: `token-kreator-${Date.now()}`,
    };
  }

  // 2. Query Firestore users collection
  try {
    const q = query(collection(db, USERS_COLLECTION));
    const querySnapshot = await withTimeout(getDocs(q), 3000);
    let matchedDoc: UserAccountRecord | null = null;

    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data() as UserAccountRecord;
      if (data && data.user && data.user.username) {
        const uNameMatch = data.user.username.toLowerCase() === cleanNameLower;
        const wordMatch =
          (data.secretWord && data.secretWord.toLowerCase() === cleanWordLower) ||
          (data.user.secretWord && data.user.secretWord.toLowerCase() === cleanWordLower);
        if (uNameMatch && wordMatch) {
          matchedDoc = data;
        }
      }
    });

    if (matchedDoc) {
      const matchedUser = {
        ...(matchedDoc as UserAccountRecord).user,
        secretWord: (matchedDoc as UserAccountRecord).secretWord || (matchedDoc as UserAccountRecord).user.secretWord,
      };
      addLocalAccount(matchedUser, matchedUser.secretWord || '');
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
  userMap.set(KREATOR_ADMIN_USER.id, KREATOR_ADMIN_USER);

  try {
    const querySnapshot = await withTimeout(getDocs(collection(db, USERS_COLLECTION)), 3000);
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data() as UserAccountRecord;
      if (data && data.user) {
        const word = data.secretWord || data.user.secretWord || '';
        const userObj = { ...data.user, secretWord: word };
        userMap.set(userObj.id, userObj);
        if (word) {
          addLocalAccount(userObj, word);
        }
      }
    });
  } catch (err) {
    console.warn('Firestore fetch all users failed, using local accounts:', err);
    getLocalAccounts().forEach((a) => userMap.set(a.user.id, { ...a.user, secretWord: a.secretWord || a.user.secretWord }));
  }

  return Array.from(userMap.values());
}

export async function createUserAccount(userObj: User, secretWordStr: string): Promise<void> {
  const userWithWord: User = { ...userObj, secretWord: secretWordStr };
  const accountRecord: UserAccountRecord = {
    user: userWithWord,
    secretWord: secretWordStr,
  };

  addLocalAccount(userWithWord, secretWordStr);

  try {
    const docRef = doc(db, USERS_COLLECTION, userWithWord.id);
    await setDoc(docRef, accountRecord);
  } catch (err) {
    console.warn('Firestore create user account failed:', err);
  }
}

export async function updateUserAccount(
  userId: string,
  updates: { username?: string; secretWord?: string; purchasedTiers?: TierId[]; removeAllAccess?: boolean }
): Promise<User | null> {
  let existingAccount: UserAccountRecord | null = null;

  try {
    const docRef = doc(db, USERS_COLLECTION, userId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      existingAccount = docSnap.data() as UserAccountRecord;
    }
  } catch (err) {
    console.warn('Firestore fetch doc for update failed:', err);
  }

  if (!existingAccount) {
    const local = getLocalAccounts().find((a) => a.user.id === userId);
    if (local) existingAccount = local;
  }

  if (!existingAccount) return null;

  const newWord = updates.secretWord ? updates.secretWord : (existingAccount.secretWord || existingAccount.user.secretWord || '');

  const updatedUser: User = {
    ...existingAccount.user,
    username: updates.username ? updates.username : existingAccount.user.username,
    secretWord: newWord,
    purchasedTiers: updates.removeAllAccess
      ? []
      : updates.purchasedTiers !== undefined
      ? updates.purchasedTiers
      : existingAccount.user.purchasedTiers,
  };

  const updatedRecord: UserAccountRecord = {
    user: updatedUser,
    secretWord: newWord,
  };

  addLocalAccount(updatedUser, newWord);

  try {
    const docRef = doc(db, USERS_COLLECTION, userId);
    await setDoc(docRef, updatedRecord);
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

    if (gamesFromDb.length === 0) {
      for (const game of DEFAULT_GAMES) {
        await setDoc(doc(db, GAMES_COLLECTION, game.id), game).catch(() => {});
      }
      gamesFromDb = [...DEFAULT_GAMES];
    }
    sharedGamesModule.syncFromFirestore(gamesFromDb);
  } catch (err) {
    console.warn('Firestore fetch games failed, relying on shared games module:', err);
  }

  return sharedGamesModule.getAllGames();
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

  try {
    const raw = localStorage.getItem('kreational_local_requests');
    if (raw) {
      const localReqs: GameRequest[] = JSON.parse(raw);
      localReqs.forEach((r) => requestMap.set(r.id, r));
    }
  } catch (e) {}

  return Array.from(requestMap.values()).sort((a, b) => b.createdAt - a.createdAt);
}

export async function fetchUserRequestsStore(userId: string): Promise<GameRequest[]> {
  const all = await fetchAllRequestsStore();
  return all.filter((r) => r.userId === userId);
}

export async function createRequestStore(req: GameRequest): Promise<void> {
  try {
    const raw = localStorage.getItem('kreational_local_requests');
    const localReqs: GameRequest[] = raw ? JSON.parse(raw) : [];
    localReqs.push(req);
    localStorage.setItem('kreational_local_requests', JSON.stringify(localReqs));
  } catch (e) {}

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
    const raw = localStorage.getItem('kreational_local_requests');
    if (raw) {
      const localReqs: GameRequest[] = JSON.parse(raw);
      const idx = localReqs.findIndex((r) => r.id === requestId);
      if (idx >= 0) {
        localReqs[idx].status = status;
        localReqs[idx].resolvedAt = Date.now();
        if (durationSeconds) localReqs[idx].durationSeconds = durationSeconds;
        reqObj = localReqs[idx];
        localStorage.setItem('kreational_local_requests', JSON.stringify(localReqs));
      }
    }
  } catch (e) {}

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
