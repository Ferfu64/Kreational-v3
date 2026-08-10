import { db } from '../lib/firebase';
import {
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  collection,
  query,
  where,
  updateDoc,
} from 'firebase/firestore';

export interface ActiveCallDoc {
  id: string;
  callerId: string;
  callerName: string;
  recipientId: string;
  recipientName: string;
  isVideo: boolean;
  status: 'ringing' | 'accepted' | 'declined' | 'ended';
  callerInRoom: boolean;
  recipientInRoom: boolean;
  createdAt: number;
  updatedAt: number;
  offer?: { sdp: string; type: RTCSdpType };
  answer?: { sdp: string; type: RTCSdpType };
}

const CALLS_COLLECTION = 'kroze_active_calls';

// Initiate a call
export async function initiateCall(
  callerId: string,
  callerName: string,
  recipientId: string,
  recipientName: string,
  isVideo: boolean
): Promise<string> {
  const callId = `call_${callerId}_${recipientId}_${Date.now()}`;
  const callData: ActiveCallDoc = {
    id: callId,
    callerId,
    callerName,
    recipientId,
    recipientName,
    isVideo,
    status: 'ringing',
    callerInRoom: true,
    recipientInRoom: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  try {
    await setDoc(doc(db, CALLS_COLLECTION, callId), callData);
  } catch (e) {
    console.warn('Failed to save call to Firestore:', e);
  }

  return callId;
}

// Accept a call
export async function acceptCall(callId: string): Promise<void> {
  try {
    const docRef = doc(db, CALLS_COLLECTION, callId);
    await setDoc(
      docRef,
      {
        status: 'accepted',
        recipientInRoom: true,
        updatedAt: Date.now(),
      },
      { merge: true }
    );
  } catch (e) {
    console.warn('Failed to accept call in Firestore:', e);
  }
}

// Decline a call
export async function declineCall(callId: string): Promise<void> {
  try {
    const docRef = doc(db, CALLS_COLLECTION, callId);
    await setDoc(
      docRef,
      {
        status: 'declined',
        recipientInRoom: false,
        updatedAt: Date.now(),
      },
      { merge: true }
    );
  } catch (e) {
    console.warn('Failed to decline call in Firestore:', e);
  }
}

// Create a Shareable Private Call Room Link
export async function createPrivateCallRoom(
  callerId: string,
  callerName: string,
  isVideo: boolean = true
): Promise<{ roomId: string; shareUrl: string }> {
  const roomId = `room_${Math.random().toString(36).substring(2, 9)}`;
  const callData: ActiveCallDoc = {
    id: roomId,
    callerId,
    callerName,
    recipientId: 'pending_guest',
    recipientName: 'Private Room Guest',
    isVideo,
    status: 'ringing',
    callerInRoom: true,
    recipientInRoom: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  try {
    await setDoc(doc(db, CALLS_COLLECTION, roomId), callData);
  } catch (e) {
    console.warn('Failed to save room call to Firestore:', e);
  }

  const shareUrl = `${window.location.origin}${window.location.pathname}?callRoom=${roomId}`;
  return { roomId, shareUrl };
}

// Join an existing Private Call Room
export async function joinPrivateCallRoom(
  roomId: string,
  userId: string,
  userName: string
): Promise<boolean> {
  try {
    const docRef = doc(db, CALLS_COLLECTION, roomId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return false;

    const data = snap.data() as ActiveCallDoc;
    if (data.status === 'ended') return false;

    if (data.callerId === userId) {
      await setDoc(
        docRef,
        { callerInRoom: true, updatedAt: Date.now() },
        { merge: true }
      );
    } else {
      await setDoc(
        docRef,
        {
          recipientId: userId,
          recipientName: userName,
          recipientInRoom: true,
          status: 'accepted',
          updatedAt: Date.now(),
        },
        { merge: true }
      );
    }
    return true;
  } catch (e) {
    console.warn('Failed to join private call room:', e);
    return false;
  }
}
export async function endCall(
  callId: string,
  userId: string,
  isCaller: boolean
): Promise<void> {
  try {
    const docRef = doc(db, CALLS_COLLECTION, callId);
    const updateObj: Partial<ActiveCallDoc> = {
      status: 'ended',
      updatedAt: Date.now(),
    };
    if (isCaller) {
      updateObj.callerInRoom = false;
    } else {
      updateObj.recipientInRoom = false;
    }
    await setDoc(docRef, updateObj, { merge: true });
  } catch (e) {
    console.warn('Failed to end call in Firestore:', e);
  }
}

// Subscribe to active calls involving the user
export function subscribeToUserCalls(
  userId: string,
  onCallUpdate: (calls: ActiveCallDoc[]) => void
): () => void {
  try {
    const q1 = query(
      collection(db, CALLS_COLLECTION),
      where('recipientId', '==', userId)
    );
    const q2 = query(
      collection(db, CALLS_COLLECTION),
      where('callerId', '==', userId)
    );

    let callerCalls: ActiveCallDoc[] = [];
    let recipientCalls: ActiveCallDoc[] = [];

    const notify = () => {
      const combinedMap = new Map<string, ActiveCallDoc>();
      [...callerCalls, ...recipientCalls].forEach((call) => {
        // Only keep active/recent calls (within 2 hours)
        if (Date.now() - call.createdAt < 7200000) {
          combinedMap.set(call.id, call);
        }
      });
      onCallUpdate(Array.from(combinedMap.values()));
    };

    const unsub1 = onSnapshot(
      q1,
      (snap) => {
        recipientCalls = snap.docs.map((d) => d.data() as ActiveCallDoc);
        notify();
      },
      (err) => console.warn('Recipient calls listener error:', err)
    );

    const unsub2 = onSnapshot(
      q2,
      (snap) => {
        callerCalls = snap.docs.map((d) => d.data() as ActiveCallDoc);
        notify();
      },
      (err) => console.warn('Caller calls listener error:', err)
    );

    return () => {
      unsub1();
      unsub2();
    };
  } catch (e) {
    console.warn('Failed to subscribe to user calls:', e);
    return () => {};
  }
}
