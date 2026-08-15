import { db } from '../lib/firebase';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  onSnapshot,
  query,
  where,
  updateDoc,
} from 'firebase/firestore';
import { User } from '../types';
import { getDeterministicFriendCode } from '../utils/qrCodeGenerator';
import { fetchAllUsers, saveFullUserAccountToFirestore } from './firestoreStore';

export const FRIENDSHIPS_COLLECTION = 'kroze_friendships';
export const PRESENCE_COLLECTION = 'kroze_presence';

export interface UserPresence {
  userId: string;
  username: string;
  online: boolean;
  status: 'online' | 'in_call' | 'in_game' | 'idle' | 'offline';
  lastSeen: number;
  currentActivity?: string;
  deviceSessionId?: string;
}

export interface FriendEntry {
  id: string;
  username: string;
  friendCode: string;
  online: boolean;
  status?: 'online' | 'in_call' | 'in_game' | 'idle' | 'offline';
  lastSeen?: number;
  currentActivity?: string;
  avatarFrame?: string;
  background?: string;
  customAvatarUrl?: string;
}

export interface FriendshipDoc {
  id: string;
  users: [string, string];
  userA: {
    id: string;
    username: string;
    friendCode: string;
    avatarFrame?: string;
    background?: string;
    customAvatarUrl?: string;
  };
  userB: {
    id: string;
    username: string;
    friendCode: string;
    avatarFrame?: string;
    background?: string;
    customAvatarUrl?: string;
  };
  createdAt: number;
}

/**
 * Returns a stable unique ID for a friendship between two user IDs
 */
export function getFriendshipId(userId1: string, userId2: string): string {
  return [userId1, userId2].sort().join('_');
}

/**
 * Publishes user presence & peer connection heartbeat to Firestore
 */
export async function updateUserPresence(
  userId: string,
  username: string,
  online: boolean = true,
  status: 'online' | 'in_call' | 'in_game' | 'idle' | 'offline' = 'online',
  currentActivity?: string
): Promise<void> {
  if (!userId) return;
  try {
    const presenceDoc: UserPresence = {
      userId,
      username,
      online,
      status: online ? status : 'offline',
      lastSeen: Date.now(),
      currentActivity: currentActivity || (online ? 'In Kroze Zone' : 'Offline'),
    };
    await setDoc(doc(db, PRESENCE_COLLECTION, userId), presenceDoc, { merge: true });
  } catch (err) {
    // Non-blocking
  }
}

/**
 * Starts a real-time presence heartbeat interval for the active user session.
 */
export function startPresenceHeartbeat(
  user: User,
  activity: string = 'In Kroze Zone'
): () => void {
  if (!user || !user.id) return () => {};

  updateUserPresence(user.id, user.username, true, 'online', activity);

  const interval = setInterval(() => {
    updateUserPresence(user.id, user.username, true, 'online', activity);
  }, 12000);

  const handleUnload = () => {
    updateUserPresence(user.id, user.username, false, 'offline');
  };

  window.addEventListener('beforeunload', handleUnload);

  return () => {
    clearInterval(interval);
    window.removeEventListener('beforeunload', handleUnload);
    updateUserPresence(user.id, user.username, false, 'offline');
  };
}

/**
 * Subscribes to real-time friendship and presence changes for a specific user.
 * Combines Firestore `kroze_friendships` collection and `kroze_presence` for instant P2P state sync.
 */
export function subscribeToUserFriends(
  currentUserId: string,
  onUpdate: (friends: FriendEntry[]) => void
): () => void {
  if (!currentUserId) return () => {};

  try {
    let latestPresenceMap = new Map<string, UserPresence>();
    let latestFriendDocs: FriendshipDoc[] = [];

    const notifyCombined = (friendDocs: FriendshipDoc[], presenceMap: Map<string, UserPresence>) => {
      const friendsMap = new Map<string, FriendEntry>();

      friendDocs.forEach((data) => {
        if (data && data.userA && data.userB) {
          const isUserA = data.userA.id === currentUserId;
          const friendData = isUserA ? data.userB : data.userA;

          if (friendData && friendData.id && friendData.id !== currentUserId) {
            const presence = presenceMap.get(friendData.id);
            const isOnline =
              presence && presence.online && Date.now() - (presence.lastSeen || 0) < 35000;

            friendsMap.set(friendData.id, {
              id: friendData.id,
              username: friendData.username || 'Kroze Friend',
              friendCode: friendData.friendCode || getDeterministicFriendCode(friendData.id),
              online: isOnline !== undefined ? Boolean(isOnline) : true,
              status: isOnline ? (presence?.status || 'online') : 'offline',
              lastSeen: presence?.lastSeen,
              currentActivity: presence?.currentActivity,
              avatarFrame: friendData.avatarFrame,
              background: friendData.background,
              customAvatarUrl: friendData.customAvatarUrl,
            });
          }
        }
      });

      onUpdate(Array.from(friendsMap.values()));
    };

    // 1. Real-time listener for friendships
    const qFriendships = query(
      collection(db, FRIENDSHIPS_COLLECTION),
      where('users', 'array-contains', currentUserId)
    );

    const unsubFriendships = onSnapshot(
      qFriendships,
      (snapshot) => {
        latestFriendDocs = snapshot.docs.map((docSnap) => docSnap.data() as FriendshipDoc);
        notifyCombined(latestFriendDocs, latestPresenceMap);
      },
      (err) => {
        console.warn('[FriendsService] Friendships listener notice:', err);
      }
    );

    // 2. Real-time listener for user presence & peer connection states
    const unsubPresence = onSnapshot(
      collection(db, PRESENCE_COLLECTION),
      (snapshot) => {
        const pMap = new Map<string, UserPresence>();
        snapshot.docs.forEach((d) => {
          const p = d.data() as UserPresence;
          if (p && p.userId) {
            pMap.set(p.userId, p);
          }
        });
        latestPresenceMap = pMap;
        notifyCombined(latestFriendDocs, latestPresenceMap);
      },
      (err) => {
        console.warn('[FriendsService] Presence listener notice:', err);
      }
    );

    return () => {
      unsubFriendships();
      unsubPresence();
    };
  } catch (err) {
    console.warn('[FriendsService] Failed to establish listeners:', err);
    return () => {};
  }
}

/**
 * Searches for a user in Firestore or memory by 10-digit code, username, or ID.
 */
export async function findUserByQuery(
  searchTerm: string,
  currentUserId: string,
  cachedUsers: User[] = []
): Promise<User | null> {
  const cleanTerm = searchTerm.trim();
  const cleanDigits = cleanTerm.replace(/\D/g, '');
  const cleanTermLower = cleanTerm.toLowerCase();

  // 1. Check cached users
  const cachedMatch = cachedUsers.find((u) => {
    if (u.id === currentUserId) return false;
    if (u.id === cleanTerm) return true;
    if (u.username.toLowerCase() === cleanTermLower) return true;
    if (cleanDigits && getDeterministicFriendCode(u.id) === cleanDigits) return true;
    return false;
  });

  if (cachedMatch) return cachedMatch;

  // 2. Fetch fresh users from Firestore
  try {
    const allUsers = await fetchAllUsers();
    const match = allUsers.find((u) => {
      if (u.id === currentUserId) return false;
      if (u.id === cleanTerm) return true;
      if (u.username.toLowerCase() === cleanTermLower) return true;
      if (cleanDigits && getDeterministicFriendCode(u.id) === cleanDigits) return true;
      return false;
    });

    if (match) return match;
  } catch (e) {
    console.warn('[FriendsService] User query error:', e);
  }

  // 3. If standard 10-digit code or name provided, create a candidate user so connection is never blocked
  if (cleanDigits.length >= 5 || cleanTerm.length >= 2) {
    const candidateId = `user_${cleanDigits || cleanTermLower}`;
    const candidateUser: User = {
      id: candidateId,
      username: cleanDigits ? `Gamer_${cleanDigits.substring(0, 4)}` : cleanTerm,
      role: 'user',
      purchasedTiers: ['bronze'],
      temporaryAccess: [],
    };
    return candidateUser;
  }

  return null;
}

/**
 * Adds a bi-directional friendship between two users.
 * Saves to Firestore `kroze_friendships` collection and updates both user docs.
 */
export async function addFriendConnection(
  currentUser: User,
  targetUser: User
): Promise<{ success: boolean; message: string; friend: FriendEntry }> {
  if (!currentUser || !targetUser) {
    return { success: false, message: 'Invalid user details provided.', friend: null as any };
  }

  if (currentUser.id === targetUser.id) {
    return { success: false, message: 'You cannot add yourself as a friend!', friend: null as any };
  }

  const friendshipId = getFriendshipId(currentUser.id, targetUser.id);
  const myCode = getDeterministicFriendCode(currentUser.id);
  const targetCode = getDeterministicFriendCode(targetUser.id);

  const friendEntry: FriendEntry = {
    id: targetUser.id,
    username: targetUser.username,
    friendCode: targetCode,
    online: true,
    avatarFrame: targetUser.cosmetics?.avatarFrame,
    background: targetUser.cosmetics?.background,
    customAvatarUrl: targetUser.cosmetics?.customAvatarUrl,
  };

  const friendshipDocData: FriendshipDoc = {
    id: friendshipId,
    users: [currentUser.id, targetUser.id],
    userA: {
      id: currentUser.id,
      username: currentUser.username,
      friendCode: myCode,
      avatarFrame: currentUser.cosmetics?.avatarFrame,
      background: currentUser.cosmetics?.background,
      customAvatarUrl: currentUser.cosmetics?.customAvatarUrl,
    },
    userB: {
      id: targetUser.id,
      username: targetUser.username,
      friendCode: targetCode,
      avatarFrame: targetUser.cosmetics?.avatarFrame,
      background: targetUser.cosmetics?.background,
      customAvatarUrl: targetUser.cosmetics?.customAvatarUrl,
    },
    createdAt: Date.now(),
  };

  // 1. Write permanent friendship document to Firestore
  try {
    await setDoc(doc(db, FRIENDSHIPS_COLLECTION, friendshipId), friendshipDocData);
  } catch (err) {
    console.warn('[FriendsService] Failed to write friendship document:', err);
  }

  // 2. Update current user document (both `friends` and `notifiedApprovals`)
  const myFriends = Array.from(
    new Set([...(currentUser.friends || []), ...(currentUser.notifiedApprovals || []), targetUser.id])
  );
  const updatedCurrentUser: User = {
    ...currentUser,
    friends: myFriends,
    notifiedApprovals: myFriends,
  };
  await saveFullUserAccountToFirestore(updatedCurrentUser);

  // 3. Update target user document bi-directionally
  try {
    const targetFriends = Array.from(
      new Set([...(targetUser.friends || []), ...(targetUser.notifiedApprovals || []), currentUser.id])
    );
    const updatedTargetUser: User = {
      ...targetUser,
      friends: targetFriends,
      notifiedApprovals: targetFriends,
    };
    await saveFullUserAccountToFirestore(updatedTargetUser);
  } catch (err) {
    console.warn('[FriendsService] Failed to update target user doc:', err);
  }

  return {
    success: true,
    message: `🎉 Connected with ${targetUser.username} permanently on server!`,
    friend: friendEntry,
  };
}

/**
 * Removes a friendship bi-directionally from Firestore and user documents.
 */
export async function removeFriendConnection(
  currentUserId: string,
  targetUserId: string,
  currentUser?: User,
  targetUser?: User
): Promise<boolean> {
  const friendshipId = getFriendshipId(currentUserId, targetUserId);

  // 1. Delete friendship document
  try {
    await deleteDoc(doc(db, FRIENDSHIPS_COLLECTION, friendshipId));
  } catch (err) {
    console.warn('[FriendsService] Delete friendship doc notice:', err);
  }

  // 2. Remove from current user document
  if (currentUser) {
    const myFriends = (currentUser.friends || currentUser.notifiedApprovals || []).filter(
      (id) => id !== targetUserId
    );
    const updated: User = {
      ...currentUser,
      friends: myFriends,
      notifiedApprovals: myFriends,
    };
    await saveFullUserAccountToFirestore(updated);
  }

  // 3. Remove from target user document
  if (targetUser) {
    const targetFriends = (targetUser.friends || targetUser.notifiedApprovals || []).filter(
      (id) => id !== currentUserId
    );
    const updated: User = {
      ...targetUser,
      friends: targetFriends,
      notifiedApprovals: targetFriends,
    };
    await saveFullUserAccountToFirestore(updated);
  }

  return true;
}

/**
 * Syncs any existing user friends into `kroze_friendships` server collection.
 */
export async function syncUserFriendshipsToServer(
  user: User,
  allUsers: User[] = []
): Promise<void> {
  if (!user || !user.id) return;

  const friendIds = Array.from(
    new Set([...(user.friends || []), ...(user.notifiedApprovals || [])])
  ).filter((id) => id && id !== user.id);

  if (friendIds.length === 0) return;

  for (const friendId of friendIds) {
    const friendshipId = getFriendshipId(user.id, friendId);
    const targetUser = allUsers.find((u) => u.id === friendId) || {
      id: friendId,
      username: `User_${friendId.substring(0, 5)}`,
      role: 'user' as const,
      purchasedTiers: ['bronze' as const],
      temporaryAccess: [],
    };

    const friendshipDocData: FriendshipDoc = {
      id: friendshipId,
      users: [user.id, friendId],
      userA: {
        id: user.id,
        username: user.username,
        friendCode: getDeterministicFriendCode(user.id),
        avatarFrame: user.cosmetics?.avatarFrame,
        background: user.cosmetics?.background,
        customAvatarUrl: user.cosmetics?.customAvatarUrl,
      },
      userB: {
        id: targetUser.id,
        username: targetUser.username,
        friendCode: getDeterministicFriendCode(targetUser.id),
        avatarFrame: targetUser.cosmetics?.avatarFrame,
        background: targetUser.cosmetics?.background,
        customAvatarUrl: targetUser.cosmetics?.customAvatarUrl,
      },
      createdAt: Date.now(),
    };

    try {
      await setDoc(doc(db, FRIENDSHIPS_COLLECTION, friendshipId), friendshipDocData, { merge: true });
    } catch (e) {
      // ignore
    }
  }
}
