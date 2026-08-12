import React, { useState, useEffect, useRef } from 'react';
import { User } from '../types';
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Maximize2,
  Minimize2,
  PhoneIncoming,
  Sparkles,
  User as UserIcon,
  Gift,
  Coins,
  Volume2,
  Activity,
  Radio,
} from 'lucide-react';
import { SFX } from '../utils/sfx';
import { triggerNotification, requestNotificationPermission } from '../utils/notificationManager';
import {
  ActiveCallDoc,
  subscribeToUserCalls,
  acceptCall,
  declineCall,
  endCall,
  joinPrivateCallRoom,
} from '../services/callService';
import { db } from '../lib/firebase';
import {
  doc,
  onSnapshot,
  collection,
  query,
  where,
  addDoc,
  updateDoc,
} from 'firebase/firestore';

interface GlobalCallAndMessageManagerProps {
  currentUser: User | null;
}

export const GlobalCallAndMessageManager: React.FC<GlobalCallAndMessageManagerProps> = ({
  currentUser,
}) => {
  const [activeCall, setActiveCall] = useState<ActiveCallDoc | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'reconnecting'>('connecting');

  // Incoming Gift Modal State
  const [receivedGiftInfo, setReceivedGiftInfo] = useState<{
    senderName: string;
    amount: number;
  } | null>(null);

  // Audio Stream Refs
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const iceCandidatesQueueRef = useRef<RTCIceCandidateInit[]>([]);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Track session start time to prevent duplicate notification triggers
  const sessionStartTimeRef = useRef<number>(Date.now());
  const notifiedMsgsRef = useRef<Set<string>>(new Set());
  const notifiedCallsRef = useRef<Set<string>>(new Set());
  const notifiedGiftsRef = useRef<Set<string>>(new Set());

  // Request browser device notification permissions on mount
  useEffect(() => {
    requestNotificationPermission();
  }, []);

  // Ensure AudioContext and audio elements play on any user gesture
  const resumeAudioOnGesture = () => {
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume().catch(() => {});
    }
    if (remoteAudioRef.current && remoteAudioRef.current.paused && remoteStreamRef.current) {
      remoteAudioRef.current.play().catch(() => {});
    }
  };

  // -------------------------------------------------------------
  // 0. AUTO-JOIN PRIVATE CALL ROOM IF URL PARAMETER PRESENT
  // -------------------------------------------------------------
  useEffect(() => {
    if (!currentUser) return;

    const checkAndJoinRoom = () => {
      const urlParams = new URLSearchParams(window.location.search);
      let callRoomParam = urlParams.get('callRoom');
      if (!callRoomParam && window.location.pathname.startsWith('/calls/')) {
        callRoomParam = window.location.pathname.split('/calls/')[1];
      }

      if (callRoomParam) {
        joinPrivateCallRoom(callRoomParam, currentUser.id, currentUser.username).then((success) => {
          if (success) {
            SFX.playSuccess();
            triggerNotification('📞 Joined Voice Call Room', 'Connected to private voice room!');
          }
        });
      }
    };

    checkAndJoinRoom();
    window.addEventListener('popstate', checkAndJoinRoom);
    return () => window.removeEventListener('popstate', checkAndJoinRoom);
  }, [currentUser?.id]);

  // -------------------------------------------------------------
  // 1. REAL-TIME CHAT & GIFT NOTIFICATIONS LISTENERS
  // -------------------------------------------------------------
  useEffect(() => {
    if (!currentUser) return;

    // Listen to incoming chat messages
    const chatsQuery = query(collection(db, 'kroze_chats'));
    const unsubChats = onSnapshot(
      chatsQuery,
      (snapshot) => {
        snapshot.docs.forEach((d) => {
          const data = d.data();
          if (data && Array.isArray(data.messages)) {
            data.messages.forEach((msg: any) => {
              if (
                msg &&
                msg.recipientId === currentUser.id &&
                msg.senderId !== currentUser.id &&
                msg.timestamp > sessionStartTimeRef.current - 5000 &&
                !notifiedMsgsRef.current.has(msg.id)
              ) {
                notifiedMsgsRef.current.add(msg.id);
                SFX.playPop();
                triggerNotification(
                  `💬 Message from ${msg.senderName || 'Kroze Friend'}`,
                  msg.text || 'Sent you a message!'
                );
              }
            });
          }
        });
      },
      (err) => console.warn('Global chat notifications listener error:', err)
    );

    // Listen to incoming gifts
    const giftsQuery = query(
      collection(db, 'kroze_gifts'),
      where('recipientId', '==', currentUser.id)
    );

    const unsubGifts = onSnapshot(
      giftsQuery,
      (snapshot) => {
        snapshot.docs.forEach((docSnap) => {
          const giftData = docSnap.data();
          if (
            giftData &&
            giftData.timestamp > sessionStartTimeRef.current - 5000 &&
            !notifiedGiftsRef.current.has(docSnap.id)
          ) {
            notifiedGiftsRef.current.add(docSnap.id);
            SFX.playCoin();
            setReceivedGiftInfo({
              senderName: giftData.senderName || 'A Kroze Friend',
              amount: giftData.amount || 100,
            });
            triggerNotification(
              '🎁 YOU RECEIVED A GIFT!',
              `${giftData.senderName || 'A friend'} sent you +${giftData.amount} Krests!`
            );
          }
        });
      },
      (err) => console.warn('Global gift listener error:', err)
    );

    return () => {
      unsubChats();
      unsubGifts();
    };
  }, [currentUser?.id]);

  // -------------------------------------------------------------
  // 2. REAL-TIME ACTIVE CALL LISTENER
  // -------------------------------------------------------------
  useEffect(() => {
    if (!currentUser) {
      setActiveCall(null);
      return;
    }

    const unsub = subscribeToUserCalls(currentUser.id, (calls) => {
      const active = calls.find(
        (c) =>
          c.status !== 'ended' &&
          c.status !== 'declined' &&
          (c.callerId === currentUser.id || c.recipientId === currentUser.id)
      );

      if (active) {
        setActiveCall(active);

        // If current user is recipient and call is ringing
        if (
          active.recipientId === currentUser.id &&
          active.status === 'ringing' &&
          !notifiedCallsRef.current.has(active.id)
        ) {
          notifiedCallsRef.current.add(active.id);

          triggerNotification(
            `📞 Incoming Voice Call!`,
            `${active.callerName} is calling you on Kroze Zone!`
          );

          if ('Notification' in window && Notification.permission === 'granted') {
            try {
              const notif = new Notification(
                `📞 Incoming Call from ${active.callerName}`,
                {
                  body: `${active.callerName} is calling you on Kroze Zone! Click to accept call now.`,
                  icon: '/pwa-192x192.png',
                  tag: active.id,
                  requireInteraction: true,
                }
              );
              notif.onclick = () => {
                window.focus();
                acceptCall(active.id);
                notif.close();
              };
            } catch (e) {
              console.warn('Native notification trigger error:', e);
            }
          }
        }
      } else {
        setActiveCall(null);
      }
    });

    return () => unsub();
  }, [currentUser?.id]);

  // Ringtone interval when ringing
  useEffect(() => {
    if (!activeCall) return;

    let ringtoneInterval: any = null;
    if (activeCall.status === 'ringing') {
      SFX.playRingtone();
      ringtoneInterval = setInterval(() => {
        SFX.playRingtone();
      }, 2400);
    }

    return () => {
      if (ringtoneInterval) clearInterval(ringtoneInterval);
    };
  }, [activeCall?.status, activeCall?.id]);

  // -------------------------------------------------------------
  // 3. CALL DURATION TIMER
  // -------------------------------------------------------------
  const isParticipant =
    activeCall &&
    (activeCall.callerId === currentUser?.id ||
      activeCall.recipientId === currentUser?.id);

  const isCaller = activeCall?.callerId === currentUser?.id;

  const bothInRoom =
    activeCall?.status === 'accepted' &&
    activeCall?.callerInRoom &&
    activeCall?.recipientInRoom;

  useEffect(() => {
    if (!bothInRoom) {
      setCallDuration(0);
      return;
    }

    const timer = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [bothInRoom]);

  // -------------------------------------------------------------
  // 4. WebRTC AUDIO PIPELINE & AUDIO VISUALIZER
  // -------------------------------------------------------------
  const setupAudioVisualizer = (stream: MediaStream) => {
    try {
      if (window.AudioContext || (window as any).webkitAudioContext) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioCtx();
        if (ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }
        audioContextRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        source.connect(analyser);
        analyserRef.current = analyser;

        drawVoiceWaveform();
      }
    } catch (e) {
      console.warn('AudioContext visualizer setup error:', e);
    }
  };

  const drawVoiceWaveform = () => {
    if (!canvasRef.current || !analyserRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
      animationFrameRef.current = requestAnimationFrame(render);
      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 1.6;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height;
        ctx.fillStyle = `rgba(52, 211, 153, ${Math.max(0.35, dataArray[i] / 255)})`;
        ctx.fillRect(x, canvas.height - barHeight, barWidth - 2, barHeight);
        x += barWidth + 1;
      }
    };

    render();
  };

  const cleanupWebRTC = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (remoteStreamRef.current) {
      remoteStreamRef.current.getTracks().forEach((t) => t.stop());
      remoteStreamRef.current = null;
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
    iceCandidatesQueueRef.current = [];
  };

  const addOrQueueCandidate = async (pc: RTCPeerConnection, candidateData: RTCIceCandidateInit) => {
    if (pc.remoteDescription && pc.remoteDescription.type) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidateData));
      } catch (err) {
        console.warn('Error adding ICE candidate:', err);
      }
    } else {
      iceCandidatesQueueRef.current.push(candidateData);
    }
  };

  const flushIceCandidates = async (pc: RTCPeerConnection) => {
    if (pc.remoteDescription && pc.remoteDescription.type && iceCandidatesQueueRef.current.length > 0) {
      const candidates = [...iceCandidatesQueueRef.current];
      iceCandidatesQueueRef.current = [];
      for (const cand of candidates) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(cand));
        } catch (err) {
          console.warn('Error flushing queued candidate:', err);
        }
      }
    }
  };

  useEffect(() => {
    if (!bothInRoom || !activeCall || !currentUser) {
      cleanupWebRTC();
      return;
    }

    let isMounted = true;
    let unsubCallDoc: (() => void) | null = null;
    let unsubCandidates: (() => void) | null = null;

    const setupWebRTC = async () => {
      try {
        setConnectionStatus('connecting');

        // 1. Get Local Audio Microphone Stream
        const constraints: MediaStreamConstraints = {
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false,
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        localStreamRef.current = stream;
        setupAudioVisualizer(stream);

        // 2. Create WebRTC PeerConnection with STUN servers
        const pc = new RTCPeerConnection({
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
          ],
        });
        peerConnectionRef.current = pc;

        // Add local audio track
        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream);
        });

        // Connection State Observer
        pc.onconnectionstatechange = () => {
          if (!isMounted) return;
          console.log('WebRTC connectionState:', pc.connectionState);
          if (pc.connectionState === 'connected') {
            setConnectionStatus('connected');
            if (remoteAudioRef.current) {
              remoteAudioRef.current.play().catch(() => {});
            }
          } else if (pc.connectionState === 'connecting' || pc.connectionState === 'new') {
            setConnectionStatus('connecting');
          } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
            setConnectionStatus('reconnecting');
          }
        };

        // 3. Handle Remote Audio Track
        pc.ontrack = (event) => {
          if (!isMounted) return;
          console.log('Received remote audio track:', event.track.kind);

          if (!remoteStreamRef.current) {
            remoteStreamRef.current = new MediaStream();
          }
          const remoteStream = remoteStreamRef.current;

          if (event.streams && event.streams[0]) {
            event.streams[0].getAudioTracks().forEach((track) => {
              if (!remoteStream.getTracks().some((t) => t.id === track.id)) {
                remoteStream.addTrack(track);
              }
            });
          } else if (event.track) {
            if (!remoteStream.getTracks().some((t) => t.id === event.track.id)) {
              remoteStream.addTrack(event.track);
            }
          }

          if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = remoteStream;
            remoteAudioRef.current.play().catch((e) => console.warn('Remote audio play error:', e));
          }
        };

        // 4. Handle Local ICE Candidates
        pc.onicecandidate = (event) => {
          if (event.candidate && isMounted) {
            const candidateCol = isCaller ? 'callerCandidates' : 'recipientCandidates';
            addDoc(
              collection(db, 'kroze_active_calls', activeCall.id, candidateCol),
              event.candidate.toJSON()
            ).catch((err) => console.warn('Candidate add error:', err));
          }
        };

        // 5. Signalling Flow
        if (isCaller) {
          const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: false });
          await pc.setLocalDescription(offer);

          await updateDoc(doc(db, 'kroze_active_calls', activeCall.id), {
            offer: { sdp: offer.sdp, type: offer.type },
            updatedAt: Date.now(),
          });

          // Caller listens for Answer
          unsubCallDoc = onSnapshot(
            doc(db, 'kroze_active_calls', activeCall.id),
            async (snapshot) => {
              const data = snapshot.data();
              if (data?.answer && pc.signalingState !== 'closed' && !pc.currentRemoteDescription) {
                try {
                  const rtcAnswer = new RTCSessionDescription(data.answer);
                  await pc.setRemoteDescription(rtcAnswer);
                  await flushIceCandidates(pc);
                } catch (e) {
                  console.warn('Set remote desc error:', e);
                }
              }
            }
          );

          // Caller listens for Recipient's ICE Candidates
          unsubCandidates = onSnapshot(
            collection(db, 'kroze_active_calls', activeCall.id, 'recipientCandidates'),
            (snapshot) => {
              snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                  addOrQueueCandidate(pc, change.doc.data() as RTCIceCandidateInit);
                }
              });
            }
          );
        } else {
          // Recipient listens for Offer -> Creates Answer
          unsubCallDoc = onSnapshot(
            doc(db, 'kroze_active_calls', activeCall.id),
            async (snapshot) => {
              const data = snapshot.data();
              if (
                data?.offer &&
                pc.signalingState !== 'closed' &&
                !pc.currentRemoteDescription
              ) {
                try {
                  const rtcOffer = new RTCSessionDescription(data.offer);
                  await pc.setRemoteDescription(rtcOffer);
                  await flushIceCandidates(pc);

                  const answer = await pc.createAnswer();
                  await pc.setLocalDescription(answer);

                  await updateDoc(doc(db, 'kroze_active_calls', activeCall.id), {
                    answer: { sdp: answer.sdp, type: answer.type },
                    updatedAt: Date.now(),
                  });
                } catch (err) {
                  console.warn('Recipient offer handling error:', err);
                }
              }
            }
          );

          // Recipient listens for Caller's ICE Candidates
          unsubCandidates = onSnapshot(
            collection(db, 'kroze_active_calls', activeCall.id, 'callerCandidates'),
            (snapshot) => {
              snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                  addOrQueueCandidate(pc, change.doc.data() as RTCIceCandidateInit);
                }
              });
            }
          );
        }
      } catch (err) {
        console.warn('WebRTC setup error:', err);
      }
    };

    setupWebRTC();

    return () => {
      isMounted = false;
      if (unsubCallDoc) unsubCallDoc();
      if (unsubCandidates) unsubCandidates();
      cleanupWebRTC();
    };
  }, [bothInRoom, activeCall?.id, isCaller]);

  // Ensure remote audio element stays bound to remoteStreamRef
  useEffect(() => {
    if (bothInRoom && remoteAudioRef.current && remoteStreamRef.current) {
      if (remoteAudioRef.current.srcObject !== remoteStreamRef.current) {
        remoteAudioRef.current.srcObject = remoteStreamRef.current;
        remoteAudioRef.current.play().catch(() => {});
      }
    }
  }, [bothInRoom, isFullscreen, isMuted]);

  // Toggle Mute
  const handleToggleMute = () => {
    resumeAudioOnGesture();
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = isMuted;
      });
    }
    setIsMuted(!isMuted);
    SFX.playClick();
  };

  // -------------------------------------------------------------
  // 5. CALL ACTIONS (Accept, Decline, Hangup)
  // -------------------------------------------------------------
  const handleAcceptIncomingCall = async () => {
    resumeAudioOnGesture();
    if (!activeCall) return;
    SFX.playSuccess();
    await acceptCall(activeCall.id);
  };

  const handleDeclineIncomingCall = async () => {
    resumeAudioOnGesture();
    if (!activeCall) return;
    SFX.playHangup();
    await declineCall(activeCall.id);
    setActiveCall(null);
  };

  const handleHangupCall = async () => {
    resumeAudioOnGesture();
    if (!activeCall || !currentUser) return;
    SFX.playHangup();
    cleanupWebRTC();
    await endCall(activeCall.id, currentUser.id, isCaller);
    setActiveCall(null);
  };

  // Automatically end call on page unload / tab close
  useEffect(() => {
    const handleUnload = () => {
      if (activeCall && currentUser) {
        endCall(activeCall.id, currentUser.id, isCaller);
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [activeCall?.id, currentUser?.id, isCaller]);

  // Render Received Gift Notification Popup
  const giftOverlay = receivedGiftInfo && (
    <div className="fixed top-8 right-8 z-[130] w-[90%] max-w-sm p-5 rounded-3xl bg-slate-950/95 border-2 border-amber-400 shadow-[0_0_50px_rgba(251,191,36,0.4)] backdrop-blur-2xl text-white space-y-3 animate-bounce-short">
      <div className="flex items-center justify-between border-b border-amber-500/20 pb-2">
        <div className="flex items-center gap-2 text-amber-300 font-black text-xs uppercase tracking-wider">
          <Gift className="w-5 h-5 text-amber-400 animate-bounce" />
          <span>YOU RECEIVED A GIFT!</span>
        </div>
        <button
          onClick={() => setReceivedGiftInfo(null)}
          className="text-xs text-slate-400 hover:text-white cursor-pointer"
        >
          ✕
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="p-3 rounded-2xl bg-amber-500/20 border border-amber-400/40 text-amber-300">
          <Coins className="w-8 h-8 text-amber-400 animate-spin" />
        </div>
        <div>
          <div className="text-base font-black text-white">{receivedGiftInfo.senderName}</div>
          <p className="text-xs font-mono text-amber-300 font-bold">
            Gifted you +{receivedGiftInfo.amount} Krests!
          </p>
        </div>
      </div>

      <button
        onClick={() => {
          SFX.playClick();
          setReceivedGiftInfo(null);
        }}
        className="w-full py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider shadow-md cursor-pointer"
      >
        Awesome!
      </button>
    </div>
  );

  // Always keep audio element in DOM for continuous audio playback
  const globalAudioElement = (
    <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
  );

  // If no active call, render gift overlay if present
  if (!activeCall || !currentUser || !isParticipant) {
    return (
      <>
        {globalAudioElement}
        {giftOverlay}
      </>
    );
  }

  const otherUserName = isCaller ? activeCall.recipientName : activeCall.callerName;
  const isIncoming = !isCaller && activeCall.status === 'ringing';

  // Format Call Duration mm:ss
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`;
  };

  // -------------------------------------------------------------
  // UI CASE A: INCOMING VOICE CALL RINGING OVERLAY
  // -------------------------------------------------------------
  if (isIncoming) {
    return (
      <>
        {globalAudioElement}
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[120] w-[92%] max-w-md p-5 rounded-3xl bg-slate-950/95 border-2 border-emerald-400 shadow-[0_0_50px_rgba(16,185,129,0.3)] backdrop-blur-2xl text-white flex flex-col space-y-4 animate-bounce-short">
          <div className="flex items-center gap-3">
            <div className="relative p-3.5 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300">
              <PhoneIncoming className="w-7 h-7 animate-pulse" />
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-400 animate-ping" />
            </div>
            <div className="flex-1">
              <div className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                <span>INCOMING VOICE CALL</span>
              </div>
              <h3 className="text-lg font-black text-white">{activeCall.callerName}</h3>
              <p className="text-[11px] text-slate-300">Calling you on Kroze Zone...</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleAcceptIncomingCall}
              className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg cursor-pointer flex items-center justify-center gap-2 transition-transform active:scale-95"
            >
              <Phone className="w-4 h-4 fill-slate-950" />
              <span>Accept Voice</span>
            </button>

            <button
              onClick={handleDeclineIncomingCall}
              className="flex-1 py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs uppercase tracking-wider shadow-lg cursor-pointer flex items-center justify-center gap-2 transition-transform active:scale-95"
            >
              <PhoneOff className="w-4 h-4" />
              <span>Decline</span>
            </button>
          </div>
        </div>
      </>
    );
  }

  // -------------------------------------------------------------
  // UI CASE B: OUTGOING CALL / WAITING FOR BOTH PARTIES
  // -------------------------------------------------------------
  if (!bothInRoom) {
    return (
      <>
        {globalAudioElement}
        <div className="fixed bottom-6 right-6 z-[120] w-[90%] max-w-sm p-5 rounded-3xl bg-slate-950/95 border border-emerald-500/40 shadow-2xl backdrop-blur-xl text-white space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
              <Sparkles className="w-4 h-4 text-amber-300 animate-spin" />
              <span>KROZE VOICE CALL</span>
            </div>
            <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider">
              HD VOICE
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 p-0.5 shrink-0 shadow-md">
              <div className="w-full h-full rounded-[14px] bg-slate-900 flex items-center justify-center font-black text-lg text-emerald-300">
                {otherUserName.charAt(0).toUpperCase()}
              </div>
            </div>
            <div className="flex-1">
              <h4 className="text-base font-black text-white">{otherUserName}</h4>
              <p className="text-xs text-amber-300 font-mono animate-pulse">
                {!isCaller
                  ? 'Connecting to voice room...'
                  : 'Ringing... Waiting for answer...'}
              </p>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 italic text-center">
            Voice connects automatically when friend joins.
          </p>

          <button
            onClick={handleHangupCall}
            className="w-full py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs uppercase tracking-wider shadow-lg cursor-pointer flex items-center justify-center gap-2"
          >
            <PhoneOff className="w-4 h-4" />
            <span>Cancel Call</span>
          </button>
        </div>
      </>
    );
  }

  // -------------------------------------------------------------
  // UI CASE C: ACTIVE LIVE VOICE CALL ROOM
  // -------------------------------------------------------------
  return (
    <div
      className={
        isFullscreen
          ? 'fixed inset-0 z-[120] bg-slate-950/98 backdrop-blur-2xl p-6 sm:p-10 flex flex-col justify-between text-white transition-all duration-300'
          : 'fixed bottom-6 right-6 z-[120] w-[90%] max-w-sm p-5 rounded-3xl bg-slate-950/95 border-2 border-emerald-500/50 shadow-[0_0_40px_rgba(16,185,129,0.25)] backdrop-blur-xl text-white space-y-4 transition-all duration-300'
      }
    >
      {globalAudioElement}

      {/* Top Bar Header */}
      <div className="flex items-center justify-between border-b border-emerald-500/20 pb-3">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
          <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider">
            VOICE CALL — {formatTime(callDuration)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-[10px] font-mono text-emerald-300 flex items-center gap-1">
            <Activity className="w-3 h-3 text-emerald-400" />
            <span>{connectionStatus === 'connected' ? 'HD CONNECTED' : 'CONNECTING'}</span>
          </span>

          <button
            onClick={() => {
              SFX.playClick();
              setIsFullscreen(!isFullscreen);
            }}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30 cursor-pointer transition-colors"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Call'}
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Main Voice Display Area */}
      <div
        className={
          isFullscreen
            ? 'flex-1 my-6 rounded-3xl bg-slate-900/80 border-2 border-emerald-500/30 p-8 flex flex-col items-center justify-center space-y-6 relative overflow-hidden shadow-2xl'
            : 'w-full py-6 rounded-2xl bg-slate-900/80 border border-emerald-500/30 flex flex-col items-center justify-center space-y-3 relative overflow-hidden'
        }
      >
        {/* Animated Background Pulse */}
        <div className="absolute w-48 h-48 rounded-full bg-emerald-500/10 blur-3xl animate-pulse pointer-events-none" />

        {/* User Avatar with Glowing Pulse Ring */}
        <div className="relative">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-tr from-emerald-500 via-teal-600 to-indigo-600 p-1 shadow-[0_0_30px_rgba(16,185,129,0.3)]">
            <div className="w-full h-full rounded-full bg-slate-950 flex items-center justify-center font-black text-2xl sm:text-3xl text-emerald-300">
              {otherUserName.charAt(0).toUpperCase()}
            </div>
          </div>
          <span className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-emerald-400 border-2 border-slate-950 flex items-center justify-center">
            <Volume2 className="w-3.5 h-3.5 text-slate-950 animate-pulse" />
          </span>
        </div>

        {/* Participant Name & Status */}
        <div className="text-center z-10">
          <h3 className="text-lg font-black text-white">{otherUserName}</h3>
          <p className="text-xs text-emerald-400 font-mono">
            {connectionStatus === 'connected' ? '🎤 2-Way Voice Active' : 'Connecting Audio...'}
          </p>
        </div>

        {/* Live Audio Visualizer Canvas */}
        <div className="w-48 sm:w-64 h-8 rounded-xl bg-black/50 border border-emerald-500/30 px-2 flex items-center justify-center z-10 mt-2">
          <canvas ref={canvasRef} className="w-full h-full" width={220} height={32} />
        </div>
      </div>

      {/* Bottom Control Bar */}
      <div className="flex items-center justify-center gap-4 pt-1">
        {/* Mute/Unmute Mic Button */}
        <button
          onClick={handleToggleMute}
          className={`p-4 rounded-2xl font-bold text-xs flex items-center gap-2 cursor-pointer transition-transform active:scale-95 ${
            isMuted
              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
          }`}
          title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
        >
          {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
        </button>

        {/* Fullscreen Toggle */}
        <button
          onClick={() => {
            SFX.playClick();
            setIsFullscreen(!isFullscreen);
          }}
          className="p-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs cursor-pointer border border-white/10"
          title={isFullscreen ? 'Unfullscreen' : 'Fullscreen'}
        >
          {isFullscreen ? <Minimize2 className="w-6 h-6" /> : <Maximize2 className="w-6 h-6" />}
        </button>

        {/* End Call Button */}
        <button
          onClick={handleHangupCall}
          className="px-7 py-4 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs uppercase tracking-wider shadow-lg cursor-pointer flex items-center gap-2 transition-transform active:scale-95"
        >
          <PhoneOff className="w-6 h-6" />
          <span>End Call</span>
        </button>
      </div>

      {giftOverlay}
    </div>
  );
};
