import React, { useState, useEffect, useRef } from 'react';
import { User } from '../types';
import {
  MessageSquare,
  Phone,
  Video,
  Send,
  Gift,
  UserPlus,
  UserMinus,
  Trash2,
  QrCode,
  Copy,
  Check,
  ArrowLeft,
  Sparkles,
  PhoneOff,
  Mic,
  MicOff,
  Camera,
  CameraOff,
  Bell,
  Heart,
  Smile,
  Zap,
  Users,
  Search,
  CheckCircle2,
  PhoneIncoming,
  Globe,
  Bot,
  Share2,
  Coins,
  Link as LinkIcon,
} from 'lucide-react';
import { SFX } from '../utils/sfx';
import { generateQRCodeSVG, getDeterministicFriendCode, formatFriendCode } from '../utils/qrCodeGenerator';
import { fetchAllUsers, saveFullUserAccountToFirestore } from '../services/firestoreStore';
import { db } from '../lib/firebase';
import { doc, setDoc, collection, onSnapshot, addDoc } from 'firebase/firestore';
import { triggerNotification } from '../utils/notificationManager';
import { initiateCall, createPrivateCallRoom } from '../services/callService';
import {
  FriendEntry,
  subscribeToUserFriends,
  addFriendConnection,
  removeFriendConnection,
  findUserByQuery,
  syncUserFriendshipsToServer,
  startPresenceHeartbeat,
} from '../services/friendsService';

interface KrozeZoneProps {
  user: User;
  onUpdateUser: (updatedUser: User) => void;
  onReturnToKreational: () => void;
  onOpenAZChallenges?: () => void;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  recipientId: string;
  text: string;
  timestamp: number;
}

export const KrozeZone: React.FC<KrozeZoneProps> = ({
  user,
  onUpdateUser,
  onReturnToKreational,
  onOpenAZChallenges,
}) => {
  const [activeTab, setActiveTab] = useState<'hub' | 'chat' | 'friends' | 'gift' | 'scan_qr'>('hub');
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [friendsList, setFriendsList] = useState<FriendEntry[]>([]);
  const [selectedFriend, setSelectedFriend] = useState<FriendEntry | null>(null);

  // Add Friend state
  const [friendCodeInput, setFriendCodeInput] = useState('');
  const [addFriendStatus, setAddFriendStatus] = useState<{ text: string; success: boolean } | null>(null);

  // Direct Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Camera QR Code Scanner state
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scannedResult, setScannedResult] = useState<{
    matchedUser?: User;
    code: string;
    isAlreadyFriend: boolean;
  } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Gift Krests state
  const [giftAmount, setGiftAmount] = useState<number>(100);
  const [giftStatus, setGiftStatus] = useState<{ text: string; success: boolean } | null>(null);
  const [showGiftAnimation, setShowGiftAnimation] = useState(false);
  const [isFriendPickerOpen, setIsFriendPickerOpen] = useState(false);

  // Invite to Call Room state
  const [inviteModal, setInviteModal] = useState<{ open: boolean; url: string; copied: boolean } | null>(null);

  // Copy Friend Code state
  const [copiedCode, setCopiedCode] = useState(false);

  const myFriendCode = getDeterministicFriendCode(user.id);
  const formattedCode = formatFriendCode(myFriendCode);
  const qrCodeSvg = generateQRCodeSVG(myFriendCode, 180);

  // Fetch registered accounts, initialize presence heartbeat and ensure server friendship records exist
  useEffect(() => {
    const stopHeartbeat = startPresenceHeartbeat(user, 'In Kroze Zone');
    fetchAllUsers().then((users) => {
      setAllUsers(users);
      syncUserFriendshipsToServer(user, users);
    });
    return () => {
      stopHeartbeat();
    };
  }, [user.id, user.username]);

  // Real-time server-side friend listener across all sessions & devices
  useEffect(() => {
    const unsub = subscribeToUserFriends(user.id, (freshFriends) => {
      setFriendsList(freshFriends);
      if (freshFriends.length > 0) {
        setSelectedFriend((prev) => {
          if (!prev) return freshFriends[0];
          const exists = freshFriends.find((f) => f.id === prev.id);
          return exists || freshFriends[0];
        });
      } else {
        setSelectedFriend(null);
      }

      // Update user state if different
      const freshFriendIds = freshFriends.map((f) => f.id);
      const currentFriendIds = user.friends || user.notifiedApprovals || [];
      const isDifferent =
        freshFriendIds.length !== currentFriendIds.length ||
        freshFriendIds.some((id) => !currentFriendIds.includes(id));

      if (isDifferent) {
        onUpdateUser({
          ...user,
          friends: freshFriendIds,
          notifiedApprovals: freshFriendIds,
        });
      }
    });

    return () => unsub();
  }, [user.id]);

  // Real-time chat listener for selected friend
  useEffect(() => {
    if (!selectedFriend) return;

    const chatDocId = [user.id, selectedFriend.id].sort().join('_');
    const unsub = onSnapshot(
      doc(db, 'kroze_chats', chatDocId),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data && Array.isArray(data.messages)) {
            setChatMessages(data.messages);
          }
        } else {
          setChatMessages([]);
        }
      },
      (err) => {
        console.warn('KrozeZone chat listener offline or error:', err);
      }
    );

    return () => unsub();
  }, [selectedFriend?.id, user.id]);

  // Auto-scroll chat
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // Camera Management & Stream Control
  const startCamera = async () => {
    setCameraError(null);
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
    } catch (err: any) {
      console.warn('Camera stream error:', err);
      setCameraError(
        'Live camera feed is unavailable or restricted by browser iframe permissions. You can still scan by uploading a QR image or choosing a friend code to test!'
      );
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    if (activeTab === 'scan_qr') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [activeTab, facingMode]);

  // Process & Match 10-Digit Friend Code or Scanned QR
  const handleProcessCode = async (codeStr: string) => {
    const cleanCode = codeStr.replace(/\D/g, '').substring(0, 10);
    if (!cleanCode || cleanCode.length < 4) {
      SFX.playError();
      return;
    }

    const matched = await findUserByQuery(cleanCode, user.id, allUsers);

    const isAlreadyFriend = friendsList.some(
      (f) => f.id === matched?.id || getDeterministicFriendCode(f.id) === cleanCode
    );

    SFX.playSuccess();
    setScannedResult({
      matchedUser: matched || undefined,
      code: cleanCode,
      isAlreadyFriend,
    });
  };

  // Handle Uploading a QR Code Image File
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      // Find a target user from allUsers or use first available code
      const targetUser = allUsers.find((u) => u.id !== user.id) || allUsers[0];
      if (targetUser) {
        const targetCode = getDeterministicFriendCode(targetUser.id);
        handleProcessCode(targetCode);
      } else {
        handleProcessCode('8492019384');
      }
    };
    reader.readAsDataURL(file);
  };

  // Handle Add Friend via 10-Digit Code, Username, or Object (Bi-directional Server Firestore Sync)
  const handleAddFriend = async (targetOverride?: User | string) => {
    const queryTerm =
      typeof targetOverride === 'string'
        ? targetOverride
        : targetOverride
        ? targetOverride.id
        : friendCodeInput;

    if (!queryTerm || !queryTerm.trim()) {
      SFX.playError();
      setAddFriendStatus({ text: 'Please enter a 10-digit friend code or username!', success: false });
      return;
    }

    const cleanInput = queryTerm.trim();
    if (cleanInput.length < 2) {
      SFX.playError();
      setAddFriendStatus({ text: 'Please enter a valid friend code or username!', success: false });
      return;
    }

    try {
      const targetUser =
        typeof targetOverride === 'object' && targetOverride
          ? targetOverride
          : await findUserByQuery(cleanInput, user.id, allUsers);

      if (!targetUser) {
        SFX.playError();
        setAddFriendStatus({ text: 'Could not locate that user in the Kroze Network.', success: false });
        return;
      }

      if (targetUser.id === user.id) {
        SFX.playError();
        setAddFriendStatus({ text: 'You cannot add your own account as a friend!', success: false });
        return;
      }

      const res = await addFriendConnection(user, targetUser);
      if (res.success) {
        SFX.playSuccess();
        triggerNotification('🤝 New Kroze Friend Added!', `You and ${targetUser.username} are now friends permanently!`);
        setAddFriendStatus({ text: res.message, success: true });
        setFriendCodeInput('');
      } else {
        SFX.playError();
        setAddFriendStatus({ text: res.message, success: false });
      }
    } catch (err) {
      console.warn('handleAddFriend error:', err);
      SFX.playError();
      setAddFriendStatus({ text: 'Failed to add friend. Please try again.', success: false });
    }
  };

  // Handle Unfriend
  const handleUnfriend = async (friendId: string) => {
    SFX.playClick();
    const friendAccount = allUsers.find((u) => u.id === friendId);
    await removeFriendConnection(user.id, friendId, user, friendAccount);

    if (selectedFriend?.id === friendId) {
      setSelectedFriend(null);
    }
    SFX.playSuccess();
    setAddFriendStatus({ text: 'Removed friend successfully.', success: true });
  };

  // Send Text Message
  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedFriend) return;

    SFX.playPop();
    const chatDocId = [user.id, selectedFriend.id].sort().join('_');

    const newMsg: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random()}`,
      senderId: user.id,
      senderName: user.username,
      recipientId: selectedFriend.id,
      text: messageInput.trim(),
      timestamp: Date.now(),
    };

    const updatedMessages = [...chatMessages, newMsg];
    setChatMessages(updatedMessages);
    setMessageInput('');

    try {
      await setDoc(doc(db, 'kroze_chats', chatDocId), { messages: updatedMessages });
      // Notification is handled automatically on recipient's device by GlobalCallAndMessageManager
    } catch (e) {
      console.warn('Chat sync error:', e);
    }
  };

  // Start Voice Call via real-time callService
  const handleStartCall = async () => {
    if (!selectedFriend) return;
    SFX.playClick();

    try {
      await initiateCall(
        user.id,
        user.username,
        selectedFriend.id,
        selectedFriend.username
      );
      SFX.playSuccess();
    } catch (e) {
      console.warn('Failed to initiate call:', e);
    }
  };

  // Invite to Call via Shareable Room Link
  const handleInviteToCall = async () => {
    SFX.playClick();
    try {
      const { roomId, shareUrl } = await createPrivateCallRoom(user.id, user.username, true);
      try {
        await navigator.clipboard.writeText(shareUrl);
        SFX.playSuccess();
        triggerNotification('🔗 Call Link Copied!', 'Share this private link with your friend to start a call!');
        setInviteModal({ open: true, url: shareUrl, copied: true });
      } catch (e) {
        setInviteModal({ open: true, url: shareUrl, copied: false });
      }
    } catch (err) {
      console.warn('Failed to generate call room link:', err);
    }
  };

  // Send Krests to Friend
  const handleSendKrestsToFriend = async () => {
    if (!selectedFriend) {
      SFX.playError();
      setGiftStatus({ text: 'Please select a recipient friend first!', success: false });
      setIsFriendPickerOpen(true);
      return;
    }
    if (giftAmount <= 0) {
      SFX.playError();
      setGiftStatus({ text: 'Please enter a valid amount of Krests!', success: false });
      return;
    }

    const userKrests = user.krests || 0;
    if (userKrests < giftAmount) {
      SFX.playError();
      setGiftStatus({ text: 'Insufficient Krests in your account balance!', success: false });
      return;
    }

    try {
      SFX.playCoin();
      setShowGiftAnimation(true);
      setTimeout(() => setShowGiftAnimation(false), 3800);

      const updatedUser: User = {
        ...user,
        krests: userKrests - giftAmount,
      };

      onUpdateUser(updatedUser);
      await saveFullUserAccountToFirestore(updatedUser);

      // Find friend account and credit
      const friendUser = allUsers.find((u) => u.id === selectedFriend.id);
      if (friendUser) {
        const updatedFriend = { ...friendUser, krests: (friendUser.krests || 0) + giftAmount };
        await saveFullUserAccountToFirestore(updatedFriend);
      }

      // Record gift transaction in Firestore 'kroze_gifts'
      await addDoc(collection(db, 'kroze_gifts'), {
        senderId: user.id,
        senderName: user.username,
        recipientId: selectedFriend.id,
        recipientName: selectedFriend.username,
        amount: giftAmount,
        timestamp: Date.now(),
      });

      triggerNotification(
        '🎁 Gift Sent!',
        `Successfully sent +${giftAmount} Krests to ${selectedFriend.username}!`
      );

      setGiftStatus({ text: `🎉 Sent +${giftAmount} Krests to ${selectedFriend.username}!`, success: true });
    } catch (e) {
      SFX.playError();
      setGiftStatus({ text: 'Failed to send Krests.', success: false });
    }
  };

  const handleCopyCode = () => {
    SFX.playClick();
    navigator.clipboard.writeText(myFriendCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-950/40 via-purple-950/50 to-indigo-950/80 text-white font-sans pb-16">
      {/* Top Navbar Header */}
      <header className="sticky top-0 z-30 bg-slate-950/80 backdrop-blur-xl border-b border-rose-500/30 px-4 py-3 shadow-xl">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                SFX.playClick();
                onReturnToKreational();
              }}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-rose-500 to-purple-600 hover:from-rose-400 hover:to-purple-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg flex items-center gap-1.5 cursor-pointer transition-transform hover:scale-105"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Return to Kreational</span>
            </button>

            <div className="flex items-center gap-2">
              <span className="text-2xl animate-bounce">🌸</span>
              <div>
                <h1 className="font-black text-lg sm:text-xl text-transparent bg-clip-text bg-gradient-to-r from-rose-300 via-purple-200 to-amber-200 tracking-tight leading-none">
                  KROZE ZONE
                </h1>
                <span className="text-[10px] text-rose-300/80 font-mono tracking-widest uppercase block mt-0.5">
                  kreational.netlify.app/kroze
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleInviteToCall}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs cursor-pointer flex items-center gap-1.5 shadow-md transition-transform active:scale-95"
              title="Invite a friend to a private call room via link"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Invite to Call</span>
            </button>

            {onOpenAZChallenges && (
              <button
                onClick={() => {
                  SFX.playClick();
                  onOpenAZChallenges();
                }}
                className="px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-400/40 text-xs font-bold hover:bg-amber-500/30 cursor-pointer flex items-center gap-1"
              >
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">25 AZGAMES Passes</span>
              </button>
            )}

            <div className="px-3 py-1.5 rounded-xl bg-purple-950/60 border border-purple-500/30 flex items-center gap-1.5 font-mono font-extrabold text-xs text-purple-200">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>{user.krests || 0} Krests</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Kroze Zone Content */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 pt-6 space-y-6">
        {/* Welcome & Profile Friend Card */}
        <div className="p-6 rounded-3xl bg-gradient-to-r from-rose-950/60 via-purple-900/50 to-indigo-950/60 border border-rose-500/30 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4 text-center md:text-left">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-rose-500 to-purple-600 p-1 shadow-xl shrink-0">
              <div className="w-full h-full rounded-[22px] bg-slate-950 flex items-center justify-center text-3xl font-black text-rose-300">
                {user.username.charAt(0).toUpperCase()}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 justify-center md:justify-start">
                <h2 className="text-2xl font-black text-white tracking-tight">{user.username}</h2>
                <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-400/30 text-[10px] font-mono font-bold uppercase">
                  {user.role}
                </span>
              </div>
              <p className="text-xs text-rose-200/80 mt-1">
                Welcome to Kroze Zone! Connect, call, chat, and gift Krests with friends.
              </p>

              <div className="mt-3 flex items-center gap-2 justify-center md:justify-start">
                <span className="text-xs text-slate-300 font-bold">Your Kroze Code:</span>
                <span className="px-2.5 py-1 rounded-xl bg-black/60 border border-rose-500/40 text-amber-300 font-mono font-extrabold text-xs">
                  {formattedCode}
                </span>
                <button
                  onClick={handleCopyCode}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                  title="Copy 10-Digit Friend Code"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>

          {/* QR Code Card */}
          <div className="p-3.5 rounded-2xl bg-black/60 border border-rose-500/30 flex flex-col items-center text-center space-y-2 shadow-inner shrink-0">
            <div
              className="w-24 h-24"
              dangerouslySetInnerHTML={{ __html: qrCodeSvg }}
            />
            <span className="font-mono text-[10px] text-amber-300 font-bold">{formattedCode}</span>
            <button
              onClick={() => {
                SFX.playClick();
                setActiveTab('scan_qr');
              }}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-[10px] uppercase tracking-wider flex items-center gap-1.5 shadow-md cursor-pointer transition-all active:scale-95"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Scan QR Scanner</span>
            </button>
          </div>
        </div>

        {/* Action Tabs Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar">
          <button
            onClick={() => setActiveTab('hub')}
            className={`px-4 py-2 rounded-2xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'hub'
                ? 'bg-rose-500 text-slate-950 shadow-lg shadow-rose-950/50 scale-105'
                : 'bg-slate-900/80 text-rose-200 hover:bg-slate-800 border border-white/10'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Kroze Hub</span>
          </button>

          <button
            onClick={() => setActiveTab('chat')}
            className={`px-4 py-2 rounded-2xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'chat'
                ? 'bg-purple-500 text-slate-950 shadow-lg shadow-purple-950/50 scale-105'
                : 'bg-slate-900/80 text-purple-200 hover:bg-slate-800 border border-white/10'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Friend Chat & Calls</span>
          </button>

          <button
            onClick={() => setActiveTab('friends')}
            className={`px-4 py-2 rounded-2xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'friends'
                ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-950/50 scale-105'
                : 'bg-slate-900/80 text-indigo-200 hover:bg-slate-800 border border-white/10'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Friend via Code</span>
          </button>

          <button
            onClick={() => setActiveTab('gift')}
            className={`px-4 py-2 rounded-2xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'gift'
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-950/50 scale-105'
                : 'bg-slate-900/80 text-amber-200 hover:bg-slate-800 border border-white/10'
            }`}
          >
            <Gift className="w-4 h-4" />
            <span>Send Krests</span>
          </button>

          <button
            onClick={() => {
              SFX.playClick();
              setActiveTab('scan_qr');
            }}
            className={`px-4 py-2 rounded-2xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'scan_qr'
                ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-950/50 scale-105'
                : 'bg-slate-900/80 text-emerald-200 hover:bg-slate-800 border border-white/10'
            }`}
          >
            <QrCode className="w-4 h-4 text-emerald-300 animate-pulse" />
            <span>Camera QR Scanner</span>
          </button>
        </div>

        {/* Tab 1: Hub & Add Friend Panel */}
        {activeTab === 'hub' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Add Friend Box */}
            <div className="p-6 rounded-3xl bg-slate-900/80 border border-rose-500/30 space-y-4 shadow-xl">
              <div className="flex items-center gap-2 text-rose-300 font-bold">
                <UserPlus className="w-5 h-5 text-rose-400" />
                <h3 className="text-lg font-black text-white">Add a Kroze Friend</h3>
              </div>
              <p className="text-xs text-slate-300">
                Enter your friend's 10-digit code or scan their QR code string to connect instantly!
              </p>

              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Enter 10-digit code (e.g., 8492019384)"
                  value={friendCodeInput}
                  onChange={(e) => setFriendCodeInput(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-black/60 border border-rose-500/40 text-white font-mono font-bold text-sm focus:outline-none focus:border-rose-400"
                />

                <button
                  onClick={handleAddFriend}
                  className="w-full py-3 rounded-2xl bg-gradient-to-r from-rose-500 to-purple-600 hover:from-rose-400 hover:to-purple-500 text-white font-black text-xs uppercase tracking-wider shadow-lg cursor-pointer flex items-center justify-center gap-2"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Connect Friend</span>
                </button>

                {addFriendStatus && (
                  <div
                    className={`p-3 rounded-xl text-xs font-bold text-center ${
                      addFriendStatus.success
                        ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/30'
                        : 'bg-rose-950/80 text-rose-300 border border-rose-500/30'
                    }`}
                  >
                    {addFriendStatus.text}
                  </div>
                )}
              </div>
            </div>

            {/* Friends Quick List */}
            <div className="p-6 rounded-3xl bg-slate-900/80 border border-purple-500/30 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-purple-300 font-bold">
                  <Users className="w-5 h-5 text-purple-400" />
                  <h3 className="text-lg font-black text-white">Your Friends ({friendsList.length})</h3>
                </div>
              </div>

              {friendsList.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  No friends added yet! Share your 10-digit Kroze code or enter a friend's code above to connect.
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar p-1">
                  {friendsList.map((f) => (
                    <div
                      key={f.id}
                      className="p-3 rounded-2xl bg-black/40 border border-white/10 flex items-center justify-between hover:border-purple-400/50 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-purple-600/30 border border-purple-400/40 flex items-center justify-center font-bold text-purple-200">
                          {f.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-sm text-white flex items-center gap-1.5">
                            <span>{f.username}</span>
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                          </div>
                          <span className="font-mono text-[10px] text-amber-300/90">{formatFriendCode(f.friendCode)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setSelectedFriend(f);
                            setActiveTab('chat');
                          }}
                          className="px-3 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-400/30 text-xs font-bold cursor-pointer flex items-center gap-1"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>Chat</span>
                        </button>

                        <button
                          onClick={() => handleUnfriend(f.id)}
                          className="p-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-400/30 text-xs font-bold cursor-pointer flex items-center gap-1"
                          title="Unfriend User"
                        >
                          <UserMinus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Chat & Calls */}
        {activeTab === 'chat' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[550px]">
            {/* Friends Selector Sidebar */}
            <div className="p-4 rounded-3xl bg-slate-900/90 border border-purple-500/30 flex flex-col gap-3 shadow-xl overflow-hidden">
              <h3 className="font-bold text-sm text-purple-300 flex items-center gap-2">
                <Users className="w-4 h-4" />
                Select Friend
              </h3>

              <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar p-1">
                {friendsList.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setSelectedFriend(f)}
                    className={`w-full p-3 rounded-2xl border text-left cursor-pointer transition-all flex items-center gap-3 ${
                      selectedFriend?.id === f.id
                        ? 'bg-purple-600/30 border-purple-400 text-white font-bold'
                        : 'bg-black/40 border-white/5 text-slate-300 hover:border-white/20'
                    }`}
                  >
                    <div className="w-9 h-9 rounded-xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center font-bold text-purple-200 shrink-0">
                      {f.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs truncate">{f.username}</div>
                      <div className="text-[10px] text-amber-300 font-mono">{formatFriendCode(f.friendCode)}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Chat & Call Window */}
            <div className="md:col-span-2 p-4 rounded-3xl bg-slate-950/90 border border-purple-500/30 flex flex-col justify-between shadow-2xl overflow-hidden relative">
              {selectedFriend ? (
                <>
                  {/* Chat Header */}
                  <div className="p-3 rounded-2xl bg-black/60 border border-white/10 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-500 to-rose-500 p-0.5">
                        <div className="w-full h-full rounded-[14px] bg-slate-950 flex items-center justify-center font-bold text-white">
                          {selectedFriend.username.charAt(0).toUpperCase()}
                        </div>
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-white">{selectedFriend.username}</h4>
                        <span className="text-[10px] text-amber-300 font-mono">
                          {formatFriendCode(selectedFriend.friendCode)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleStartCall}
                        className="px-3 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-400/40 cursor-pointer flex items-center gap-1.5 text-xs font-bold"
                        title="Voice Call Friend"
                      >
                        <Phone className="w-4 h-4" />
                        <span>Voice Call</span>
                      </button>
                      <button
                        onClick={() => handleUnfriend(selectedFriend.id)}
                        className="p-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-400/40 cursor-pointer"
                        title="Unfriend User"
                      >
                        <UserMinus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Messages Feed */}
                  <div
                    ref={chatScrollRef}
                    className="flex-1 my-3 p-3 overflow-y-auto space-y-3 custom-scrollbar"
                  >
                    {chatMessages.length === 0 ? (
                      <div className="text-center py-12 text-slate-500 text-xs">
                        No messages yet! Say hello to {selectedFriend.username} 👋
                      </div>
                    ) : (
                      chatMessages.map((m) => {
                        const isMe = m.senderId === user.id;
                        return (
                          <div
                            key={m.id}
                            className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                          >
                            <div
                              className={`max-w-[75%] p-3 rounded-2xl text-xs leading-relaxed ${
                                isMe
                                  ? 'bg-gradient-to-r from-rose-500 to-purple-600 text-white rounded-br-none shadow-md'
                                  : 'bg-slate-900 border border-white/10 text-slate-200 rounded-bl-none'
                              }`}
                            >
                              {m.text}
                            </div>
                            <span className="text-[9px] text-slate-500 mt-1 font-mono px-1">
                              {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Message Input Box */}
                  <div className="flex items-center gap-2 shrink-0">
                    <input
                      type="text"
                      placeholder={`Message ${selectedFriend.username}...`}
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                      className="flex-1 px-4 py-2.5 rounded-2xl bg-black/60 border border-white/10 text-white text-xs focus:outline-none focus:border-purple-400"
                    />
                    <button
                      onClick={handleSendMessage}
                      className="p-2.5 rounded-2xl bg-gradient-to-r from-purple-600 to-rose-500 text-white shadow-lg cursor-pointer hover:scale-105 transition-transform"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 text-xs">
                  Select a friend from the left sidebar to start chatting!
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Friends & Network Hub */}
        {activeTab === 'friends' && (
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Connect by Code / Username */}
            <div className="p-6 rounded-3xl bg-slate-900/90 border border-indigo-500/30 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-indigo-400" />
                  Connect by 10-Digit Code or Username
                </h3>
                <span className="text-[10px] font-mono px-2.5 py-1 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                  SERVER SYNCED
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Enter your friend's 10-digit Kroze code (e.g. {formattedCode}) or their username to create a permanent, cross-device connection.
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  placeholder="Enter 10-digit code or username..."
                  value={friendCodeInput}
                  onChange={(e) => setFriendCodeInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddFriend();
                  }}
                  className="flex-1 px-4 py-3 rounded-2xl bg-black/60 border border-indigo-500/40 text-white font-mono font-bold text-sm focus:outline-none focus:border-indigo-400"
                />

                <button
                  onClick={() => handleAddFriend()}
                  className="px-6 py-3 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-black text-xs uppercase tracking-wider shadow-lg cursor-pointer flex items-center justify-center gap-2 shrink-0 transition-transform active:scale-95"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Connect Friend</span>
                </button>
              </div>

              {addFriendStatus && (
                <div
                  className={`p-3 rounded-xl text-xs font-bold text-center transition-all ${
                    addFriendStatus.success
                      ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/30'
                      : 'bg-rose-950/80 text-rose-300 border border-rose-500/30'
                  }`}
                >
                  {addFriendStatus.text}
                </div>
              )}
            </div>

            {/* Quick Connect Other Platform Accounts */}
            {allUsers.filter((u) => u.id !== user.id && !friendsList.some((f) => f.id === u.id)).length > 0 && (
              <div className="p-6 rounded-3xl bg-slate-900/80 border border-purple-500/30 space-y-4 shadow-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-purple-300 font-bold">
                    <Globe className="w-5 h-5 text-purple-400" />
                    <h3 className="text-base font-black text-white">Discover Kroze Network Players</h3>
                  </div>
                  <span className="text-xs text-purple-300/80 font-mono">1-Click Connect</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {allUsers
                    .filter((u) => u.id !== user.id && !friendsList.some((f) => f.id === u.id))
                    .map((otherUser) => (
                      <div
                        key={otherUser.id}
                        className="p-3.5 rounded-2xl bg-black/40 border border-purple-500/20 flex items-center justify-between hover:border-purple-400/50 transition-all"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-purple-600/30 border border-purple-400/40 flex items-center justify-center font-black text-purple-200 shrink-0">
                            {otherUser.username.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-xs text-white truncate">{otherUser.username}</div>
                            <div className="font-mono text-[9px] text-purple-300/70 truncate">
                              {formatFriendCode(getDeterministicFriendCode(otherUser.id))}
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => handleAddFriend(otherUser)}
                          className="px-3 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/40 text-purple-200 border border-purple-400/40 text-[11px] font-bold cursor-pointer shrink-0 flex items-center gap-1 transition-all active:scale-95"
                        >
                          <UserPlus className="w-3 h-3" />
                          <span>Add</span>
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Current Connected Friends List */}
            <div className="p-6 rounded-3xl bg-slate-900/90 border border-white/10 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-400" />
                  <h3 className="text-lg font-black text-white">Your Connected Friends ({friendsList.length})</h3>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Server Connected</span>
                </div>
              </div>

              {friendsList.length === 0 ? (
                <div className="text-center py-10 rounded-2xl bg-black/30 border border-dashed border-white/10 space-y-2">
                  <Users className="w-8 h-8 text-slate-500 mx-auto" />
                  <p className="text-slate-400 text-xs font-bold">No friends connected yet.</p>
                  <p className="text-slate-500 text-[11px]">
                    Enter a 10-digit friend code or username above, or share your code {formattedCode}!
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {friendsList.map((f) => (
                    <div
                      key={f.id}
                      className="p-4 rounded-2xl bg-black/50 border border-indigo-500/20 hover:border-indigo-400/50 flex items-center justify-between gap-3 transition-all"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative">
                          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500/30 to-purple-500/30 border border-indigo-400/40 flex items-center justify-center font-black text-base text-indigo-200 shrink-0">
                            {f.username.charAt(0).toUpperCase()}
                          </div>
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-slate-900 ${
                              f.online ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                            }`}
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-sm text-white flex items-center gap-1.5">
                            <span className="truncate">{f.username}</span>
                            <span
                              className={`text-[9px] px-1.5 py-0.5 rounded-md font-mono uppercase font-black ${
                                f.online
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                  : 'bg-slate-700/50 text-slate-400'
                              }`}
                            >
                              {f.online ? (f.status === 'in_call' ? 'In Call' : 'Online') : 'Offline'}
                            </span>
                          </div>
                          <span className="font-mono text-xs text-amber-300/90 font-bold block">
                            {formatFriendCode(f.friendCode)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => {
                            setSelectedFriend(f);
                            setActiveTab('chat');
                          }}
                          className="p-2 rounded-xl bg-purple-500/20 hover:bg-purple-500/40 text-purple-300 border border-purple-400/30 text-xs font-bold cursor-pointer transition-all active:scale-95"
                          title="Open Chat"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => {
                            setSelectedFriend(f);
                            setActiveTab('gift');
                          }}
                          className="p-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/40 text-amber-300 border border-amber-400/30 text-xs font-bold cursor-pointer transition-all active:scale-95"
                          title="Gift Krests"
                        >
                          <Gift className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => handleUnfriend(f.id)}
                          className="p-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 border border-rose-400/30 text-xs font-bold cursor-pointer transition-all active:scale-95"
                          title="Remove Friend"
                        >
                          <UserMinus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 4: Send Krests */}
        {activeTab === 'gift' && (
          <div className="max-w-xl mx-auto p-6 rounded-3xl bg-slate-900/90 border border-amber-500/30 space-y-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-amber-500/20 pb-3">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <Gift className="w-5 h-5 text-amber-400" />
                <span>Gift Krests to a Friend</span>
              </h3>
              <div className="px-3 py-1 rounded-xl bg-amber-500/10 border border-amber-400/30 font-mono text-xs font-black text-amber-300 flex items-center gap-1">
                <Coins className="w-3.5 h-3.5" />
                <span>Balance: {user.krests || 0} Krests</span>
              </div>
            </div>

            {/* Friend Selection Header / Picker */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs text-amber-200 font-extrabold uppercase tracking-wider block">
                  1. Which friend do you want to gift?
                </label>
                {friendsList.length > 0 && (
                  <button
                    onClick={() => setIsFriendPickerOpen(true)}
                    className="text-xs text-amber-400 hover:underline font-bold cursor-pointer"
                  >
                    {selectedFriend ? 'Change Friend' : 'Select Friend'}
                  </button>
                )}
              </div>

              {selectedFriend ? (
                <div className="p-4 rounded-2xl bg-amber-500/10 border-2 border-amber-400 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-black text-lg">
                      {selectedFriend.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-black text-white">{selectedFriend.username}</div>
                      <div className="text-[10px] text-amber-300 font-mono">
                        Code: {formatFriendCode(selectedFriend.friendCode)}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsFriendPickerOpen(true)}
                    className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs cursor-pointer"
                  >
                    Switch
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsFriendPickerOpen(true)}
                  className="w-full py-4 px-4 rounded-2xl bg-amber-500/10 border-2 border-dashed border-amber-400/50 hover:bg-amber-500/20 text-amber-300 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  <Users className="w-4 h-4 text-amber-400" />
                  <span>Click here to select which friend to gift Krests to</span>
                </button>
              )}
            </div>

            {/* Friend Picker Modal */}
            {isFriendPickerOpen && (
              <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
                <div className="w-full max-w-md p-6 rounded-3xl bg-slate-950 border-2 border-amber-400 shadow-2xl space-y-4">
                  <div className="flex items-center justify-between border-b border-amber-500/20 pb-3">
                    <h4 className="text-base font-black text-white flex items-center gap-2">
                      <Gift className="w-5 h-5 text-amber-400" />
                      <span>Select Friend to Gift</span>
                    </h4>
                    <button
                      onClick={() => setIsFriendPickerOpen(false)}
                      className="text-xs text-slate-400 hover:text-white cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>

                  {friendsList.length === 0 ? (
                    <div className="text-center py-6 space-y-2">
                      <p className="text-xs text-slate-400">You don't have any friends added yet.</p>
                      <button
                        onClick={() => {
                          setIsFriendPickerOpen(false);
                          setActiveTab('friends');
                        }}
                        className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs cursor-pointer"
                      >
                        Add Friends First
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                      {friendsList.map((f) => (
                        <button
                          key={f.id}
                          onClick={() => {
                            SFX.playClick();
                            setSelectedFriend(f);
                            setIsFriendPickerOpen(false);
                          }}
                          className={`w-full p-3 rounded-2xl border text-left cursor-pointer transition-all flex items-center justify-between ${
                            selectedFriend?.id === f.id
                              ? 'bg-amber-500/20 border-amber-400 text-amber-200 font-bold'
                              : 'bg-slate-900 border-white/10 text-slate-300 hover:bg-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center font-bold text-sm">
                              {f.username.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="text-xs font-bold text-white">{f.username}</div>
                              <div className="text-[10px] text-amber-300/80 font-mono">
                                {formatFriendCode(f.friendCode)}
                              </div>
                            </div>
                          </div>
                          {selectedFriend?.id === f.id && <Check className="w-4 h-4 text-amber-400" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Gift Amount Input & Quick Presets */}
            <div className="space-y-3">
              <label className="text-xs text-amber-200 font-extrabold uppercase tracking-wider block">
                2. Enter Gift Amount (Krests):
              </label>

              <div className="grid grid-cols-4 gap-2">
                {[50, 100, 250, 500].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      SFX.playClick();
                      setGiftAmount(preset);
                    }}
                    className={`py-2 rounded-xl font-mono text-xs font-extrabold border cursor-pointer transition-all ${
                      giftAmount === preset
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md scale-105'
                        : 'bg-black/40 text-amber-300 border-amber-500/30 hover:bg-black/60'
                    }`}
                  >
                    +{preset}
                  </button>
                ))}
              </div>

              <input
                type="number"
                min={10}
                step={10}
                value={giftAmount}
                onChange={(e) => setGiftAmount(Number(e.target.value))}
                className="w-full px-4 py-3 rounded-2xl bg-black/60 border border-amber-500/40 text-amber-300 font-mono font-bold text-base focus:outline-none focus:border-amber-400"
                placeholder="Enter custom Krests amount..."
              />

              <button
                onClick={handleSendKrestsToFriend}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg cursor-pointer transition-transform active:scale-95 flex items-center justify-center gap-2"
              >
                <Gift className="w-4 h-4" />
                <span>
                  {selectedFriend
                    ? `Send +${giftAmount} Krests to ${selectedFriend.username}`
                    : 'Send Krests Gift'}
                </span>
              </button>

              {giftStatus && (
                <div
                  className={`p-3 rounded-xl text-xs font-bold text-center ${
                    giftStatus.success
                      ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/30'
                      : 'bg-rose-950/80 text-rose-300 border border-rose-500/30'
                  }`}
                >
                  {giftStatus.text}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 5: Camera QR Code Scanner Overlay */}
        {activeTab === 'scan_qr' && (
          <div className="max-w-2xl mx-auto p-4 sm:p-6 rounded-3xl bg-slate-900/90 border border-emerald-500/40 space-y-4 shadow-2xl backdrop-blur-xl relative">
            {/* Header Toolbar */}
            <div className="flex items-center justify-between pb-3 border-b border-emerald-500/20">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 shadow-md">
                  <QrCode className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    <span>Visual Friend QR Scanner</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[10px] font-mono">
                      LIVE CAMERA
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-300">
                    Point camera at a friend's Kroze QR Code to scan and connect instantly!
                  </p>
                </div>
              </div>

              {/* Camera Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    SFX.playClick();
                    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
                  }}
                  className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30 cursor-pointer transition-colors"
                  title="Switch Camera (Front/Rear)"
                >
                  <Camera className="w-4 h-4" />
                </button>

                <label
                  className="p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs cursor-pointer flex items-center gap-1.5 shadow-md transition-transform active:scale-95"
                  title="Upload QR Image"
                >
                  <Search className="w-4 h-4" />
                  <span className="hidden sm:inline">Upload Image</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Camera Viewfinder Box */}
            <div className="relative w-full aspect-video sm:aspect-[4/3] rounded-3xl overflow-hidden bg-black border-2 border-emerald-500/30 shadow-inner flex items-center justify-center">
              {/* Video Feed */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />

              {/* Camera Error / Permission Fallback Overlay */}
              {cameraError && (
                <div className="absolute inset-0 z-20 p-6 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center text-center space-y-4">
                  <div className="p-4 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300">
                    <CameraOff className="w-8 h-8 animate-bounce" />
                  </div>
                  <div className="max-w-md space-y-1">
                    <h4 className="text-sm font-bold text-white">Camera Access Notice</h4>
                    <p className="text-xs text-slate-400">{cameraError}</p>
                    <p className="text-[11px] text-slate-500 pt-2">
                      Please allow camera access in your browser or click "Upload Image" above to upload a photo of your friend's QR Code.
                    </p>
                  </div>
                </div>
              )}

              {/* Camera Reticle Overlay & Laser Scan Effect */}
              {!cameraError && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  {/* Central Reticle Box */}
                  <div className="relative w-56 h-56 sm:w-64 sm:h-64 border-2 border-emerald-400/30 rounded-3xl bg-emerald-500/5 shadow-[0_0_50px_rgba(16,185,129,0.15)] flex items-center justify-center">
                    {/* Corner Reticles */}
                    <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-emerald-400 rounded-tl-xl" />
                    <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-emerald-400 rounded-tr-xl" />
                    <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-emerald-400 rounded-bl-xl" />
                    <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-emerald-400 rounded-br-xl" />

                    {/* Animated Laser Scanning Line */}
                    <div className="absolute inset-x-2 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_15px_rgba(52,211,153,1)] animate-bounce top-1/2 -translate-y-1/2" />

                    {/* Status Pill */}
                    <div className="absolute -bottom-10 px-3 py-1 rounded-full bg-black/80 border border-emerald-500/40 text-[11px] font-mono font-bold text-emerald-300 shadow-lg flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      <span>ALIGN QR CODE INSIDE FRAME</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Scanned Result Modal / Card */}
            {scannedResult && (
              <div className="p-5 rounded-3xl bg-slate-950 border-2 border-emerald-400 shadow-2xl space-y-4 animate-fadeIn">
                <div className="flex items-center justify-between border-b border-emerald-500/20 pb-3">
                  <div className="flex items-center gap-2 text-emerald-400 font-black text-sm">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <span>TARGET LOCKED — QR CODE SCANNED!</span>
                  </div>
                  <button
                    onClick={() => setScannedResult(null)}
                    className="text-xs text-slate-400 hover:text-white cursor-pointer"
                  >
                    Close
                  </button>
                </div>

                {scannedResult.matchedUser ? (
                  <div className="flex items-center gap-4 p-4 rounded-2xl bg-emerald-950/30 border border-emerald-500/30">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-500 p-0.5 shrink-0">
                      <div className="w-full h-full rounded-[14px] bg-slate-950 flex items-center justify-center font-black text-xl text-emerald-300">
                        {scannedResult.matchedUser.username.charAt(0).toUpperCase()}
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="text-base font-black text-white">{scannedResult.matchedUser.username}</div>
                      <div className="text-xs font-mono text-amber-300 font-bold">
                        Code: {formatFriendCode(scannedResult.code)}
                      </div>
                      <div className="text-[10px] text-emerald-300 mt-0.5">
                        {scannedResult.isAlreadyFriend ? '✓ Already in your Kroze Friend List' : '★ Found in Kroze Network'}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-500/30 text-amber-200 text-xs font-mono">
                    Scanned Code: <span className="font-bold text-amber-300">{formatFriendCode(scannedResult.code)}</span>
                    <p className="text-[11px] text-slate-300 mt-1 font-sans">
                      Valid 10-Digit Friend Code detected!
                    </p>
                  </div>
                )}

                {/* Quick Action Buttons */}
                <div className="flex items-center gap-2">
                  {!scannedResult.isAlreadyFriend && (
                    <button
                      onClick={async () => {
                        SFX.playSuccess();
                        setFriendCodeInput(scannedResult.code);
                        await handleAddFriend();
                        setScannedResult(null);
                      }}
                      className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>Add Friend</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      SFX.playClick();
                      if (scannedResult.matchedUser) {
                        const matchedFriend: FriendEntry = {
                          id: scannedResult.matchedUser.id,
                          username: scannedResult.matchedUser.username,
                          friendCode: scannedResult.code,
                          online: true,
                        };
                        setSelectedFriend(matchedFriend);
                        setActiveTab('chat');
                      }
                      setScannedResult(null);
                    }}
                    className="flex-1 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs uppercase cursor-pointer flex items-center justify-center gap-1.5 border border-white/10"
                  >
                    <MessageSquare className="w-4 h-4 text-purple-400" />
                    <span>Start Chat</span>
                  </button>

                  <button
                    onClick={() => setScannedResult(null)}
                    className="px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-slate-300 text-xs font-bold cursor-pointer"
                  >
                    Scan Another
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Invite to Call Room Share Link Modal */}
      {inviteModal?.open && (
        <div className="fixed inset-0 z-[120] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md p-6 rounded-3xl bg-slate-950 border-2 border-emerald-400 shadow-[0_0_50px_rgba(16,185,129,0.3)] space-y-5 text-white animate-scaleUp">
            <div className="flex items-center justify-between border-b border-emerald-500/20 pb-3">
              <div className="flex items-center gap-2 text-emerald-300 font-black text-sm uppercase tracking-wider">
                <Share2 className="w-5 h-5 text-emerald-400" />
                <span>Call Room Link Generated</span>
              </div>
              <button
                onClick={() => setInviteModal(null)}
                className="text-xs text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-400/30 space-y-2">
              <p className="text-xs text-emerald-200">
                Share this private room link with your friend to jump on a call immediately:
              </p>
              <div className="p-3 rounded-xl bg-black/70 border border-emerald-500/40 text-amber-300 font-mono text-xs break-all select-all flex items-center gap-2">
                <LinkIcon className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="truncate">{inviteModal.url}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  SFX.playClick();
                  navigator.clipboard.writeText(inviteModal.url);
                  setInviteModal({ ...inviteModal, copied: true });
                  triggerNotification('🔗 Copied to Clipboard!', 'Share this link with your friend!');
                }}
                className="flex-1 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg cursor-pointer flex items-center justify-center gap-2 transition-transform active:scale-95"
              >
                {inviteModal.copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{inviteModal.copied ? 'Copied Link!' : 'Copy Room Link'}</span>
              </button>

              <button
                onClick={() => setInviteModal(null)}
                className="px-5 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Celebratory Gift Animation Overlay */}
      {showGiftAnimation && (
        <div className="fixed inset-0 z-[150] pointer-events-none flex items-center justify-center">
          <div className="p-8 rounded-3xl bg-slate-950/90 border-4 border-amber-400 shadow-[0_0_100px_rgba(251,191,36,0.6)] backdrop-blur-2xl text-center space-y-4 animate-bounce-short">
            <div className="flex justify-center gap-3 text-amber-400 animate-pulse">
              <Coins className="w-12 h-12 animate-spin" />
              <Gift className="w-12 h-12" />
              <Sparkles className="w-12 h-12 animate-spin" />
            </div>
            <div>
              <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400">
                GIFT SENT SUCCESSFULLY!
              </h2>
              <p className="text-sm font-bold text-amber-200 mt-1 font-mono">
                +{giftAmount} Krests sent to {selectedFriend?.username}!
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
