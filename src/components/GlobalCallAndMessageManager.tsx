import React, { useState, useEffect, useRef } from 'react';
import { User } from '../types';
import {
  Phone,
  Video,
  PhoneOff,
  Mic,
  MicOff,
  Camera,
  CameraOff,
  Maximize2,
  Minimize2,
  PhoneIncoming,
  CheckCircle2,
  Sparkles,
  User as UserIcon,
  Gift,
  Coins,
  Share2,
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
import { doc, onSnapshot, collection, query, where } from 'firebase/firestore';

interface GlobalCallAndMessageManagerProps {
  currentUser: User | null;
}

export const GlobalCallAndMessageManager: React.FC<GlobalCallAndMessageManagerProps> = ({
  currentUser,
}) => {
  const [activeCall, setActiveCall] = useState<ActiveCallDoc | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isCamOff, setIsCamOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  // Incoming Gift Modal State
  const [receivedGiftInfo, setReceivedGiftInfo] = useState<{
    senderName: string;
    amount: number;
  } | null>(null);

  // Local media stream refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Track session start time to prevent duplicate notification triggers on historical items
  const sessionStartTimeRef = useRef<number>(Date.now());
  const notifiedMsgsRef = useRef<Set<string>>(new Set());
  const notifiedCallsRef = useRef<Set<string>>(new Set());
  const notifiedGiftsRef = useRef<Set<string>>(new Set());

  // Request browser device notification permissions on mount
  useEffect(() => {
    requestNotificationPermission();
  }, []);

  // -------------------------------------------------------------
  // 0. AUTO-JOIN PRIVATE CALL ROOM IF URL PARAMETER PRESENT
  // -------------------------------------------------------------
  useEffect(() => {
    if (!currentUser) return;
    const urlParams = new URLSearchParams(window.location.search);
    const callRoomParam = urlParams.get('callRoom');

    if (callRoomParam) {
      joinPrivateCallRoom(callRoomParam, currentUser.id, currentUser.username).then((success) => {
        if (success) {
          SFX.playSuccess();
          triggerNotification('📞 Joined Call Room', 'Connected to private call room!');
        }
      });
    }
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
      // Find the most relevant call for current user that is not ended/declined
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

          // In-App Toast & Audio SFX
          triggerNotification(
            `📞 Incoming ${active.isVideo ? 'Video' : 'Audio'} Call!`,
            `${active.callerName} is calling you on Kroze Zone!`
          );

          // Native Browser Device Notification (In case user is outside app)
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
  // 3. CALL DURATION TIMER (Runs only when BOTH parties in room)
  // -------------------------------------------------------------
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
  // 4. MEDIA STREAM & MIC / CAMERA CONTROL
  // -------------------------------------------------------------
  const isParticipant =
    activeCall &&
    (activeCall.callerId === currentUser?.id ||
      activeCall.recipientId === currentUser?.id);

  const isCaller = activeCall?.callerId === currentUser?.id;

  const startMediaStream = async (needVideo: boolean) => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }

      const constraints: MediaStreamConstraints = {
        audio: true,
        video: needVideo
          ? {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              facingMode: 'user',
            }
          : false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (localVideoRef.current && needVideo) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play().catch(() => {});
      }

      // Voice Visualizer Waveform Setup
      if (window.AudioContext || (window as any).webkitAudioContext) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioCtx();
        audioContextRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        source.connect(analyser);
        analyserRef.current = analyser;

        drawVoiceWaveform();
      }
    } catch (err) {
      console.warn('MediaStream permission or device warning:', err);
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

      const barWidth = (canvas.width / bufferLength) * 1.5;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height;
        ctx.fillStyle = `rgba(52, 211, 153, ${Math.max(0.3, dataArray[i] / 255)})`;
        ctx.fillRect(x, canvas.height - barHeight, barWidth - 2, barHeight);
        x += barWidth + 1;
      }
    };

    render();
  };

  const stopMediaStream = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    if (bothInRoom && activeCall) {
      startMediaStream(activeCall.isVideo);
    } else {
      stopMediaStream();
    }

    return () => {
      stopMediaStream();
    };
  }, [bothInRoom, activeCall?.isVideo]);

  // Toggle Mute
  const handleToggleMute = () => {
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = isMuted; // Toggle
      });
    }
    setIsMuted(!isMuted);
    SFX.playClick();
  };

  // Toggle Camera
  const handleToggleCam = () => {
    if (streamRef.current) {
      streamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = isCamOff; // Toggle
      });
    }
    setIsCamOff(!isCamOff);
    SFX.playClick();
  };

  // -------------------------------------------------------------
  // 5. CALL ACTIONS (Accept, Decline, Hangup)
  // -------------------------------------------------------------
  const handleAcceptIncomingCall = async () => {
    if (!activeCall) return;
    SFX.playSuccess();
    await acceptCall(activeCall.id);
  };

  const handleDeclineIncomingCall = async () => {
    if (!activeCall) return;
    SFX.playHangup();
    await declineCall(activeCall.id);
    setActiveCall(null);
  };

  const handleHangupCall = async () => {
    if (!activeCall || !currentUser) return;
    SFX.playHangup();
    stopMediaStream();
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

  // If no active call, render gift overlay if present
  if (!activeCall || !currentUser || !isParticipant) {
    return giftOverlay;
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
  // UI CASE A: INCOMING CALL RINGING OVERLAY
  // -------------------------------------------------------------
  if (isIncoming) {
    return (
      <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[120] w-[92%] max-w-md p-5 rounded-3xl bg-slate-950/95 border-2 border-emerald-400 shadow-[0_0_50px_rgba(16,185,129,0.3)] backdrop-blur-2xl text-white flex flex-col space-y-4 animate-bounce-short">
        <div className="flex items-center gap-3">
          <div className="relative p-3 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300">
            <PhoneIncoming className="w-6 h-6 animate-pulse" />
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
          </div>
          <div className="flex-1">
            <div className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <span>INCOMING {activeCall.isVideo ? 'VIDEO' : 'AUDIO'} CALL</span>
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
            <span>Accept</span>
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
    );
  }

  // -------------------------------------------------------------
  // UI CASE B: CALLING OUTGOING / WAITING FOR BOTH PARTIES
  // -------------------------------------------------------------
  if (!bothInRoom) {
    return (
      <div className="fixed bottom-6 right-6 z-[120] w-[90%] max-w-sm p-5 rounded-3xl bg-slate-950/95 border border-emerald-500/40 shadow-2xl backdrop-blur-xl text-white space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
            <Sparkles className="w-4 h-4 text-amber-300 animate-spin" />
            <span>KROZE CALL ROOM</span>
          </div>
          <span className="text-[10px] font-mono text-slate-400">
            {activeCall.isVideo ? 'VIDEO' : 'AUDIO'}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-500 to-purple-600 p-0.5 shrink-0 shadow-md">
            <div className="w-full h-full rounded-[14px] bg-slate-900 flex items-center justify-center font-black text-lg text-white">
              {otherUserName.charAt(0).toUpperCase()}
            </div>
          </div>
          <div className="flex-1">
            <h4 className="text-base font-black text-white">{otherUserName}</h4>
            <p className="text-xs text-amber-300 font-mono animate-pulse">
              {!isCaller
                ? 'Connecting to call room...'
                : 'Calling... Waiting for answer...'}
            </p>
          </div>
        </div>

        <p className="text-[11px] text-slate-400 italic text-center">
          Call starts as soon as both players enter the call room.
        </p>

        <button
          onClick={handleHangupCall}
          className="w-full py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs uppercase tracking-wider shadow-lg cursor-pointer flex items-center justify-center gap-2"
        >
          <PhoneOff className="w-4 h-4" />
          <span>Cancel Call</span>
        </button>
      </div>
    );
  }

  // -------------------------------------------------------------
  // UI CASE C: ACTIVE CALL ROOM (FULLSCREEN OR FLOATING PIP)
  // -------------------------------------------------------------
  return (
    <div
      className={
        isFullscreen
          ? 'fixed inset-0 z-[120] bg-slate-950/98 backdrop-blur-2xl p-4 sm:p-8 flex flex-col justify-between text-white transition-all duration-300'
          : 'fixed bottom-6 right-6 z-[120] w-[90%] max-w-sm p-4 rounded-3xl bg-slate-950/95 border-2 border-emerald-500/50 shadow-[0_0_40px_rgba(16,185,129,0.2)] backdrop-blur-xl text-white space-y-3 transition-all duration-300'
      }
    >
      {/* Top Bar Header */}
      <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
          <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider">
            LIVE CALL — {formatTime(callDuration)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Fullscreen / Unfullscreen toggle button */}
          <button
            onClick={() => {
              SFX.playClick();
              setIsFullscreen(!isFullscreen);
            }}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30 cursor-pointer transition-colors"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Video'}
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Main Video / Visual Feed Container */}
      <div
        className={
          isFullscreen
            ? 'flex-1 my-4 relative rounded-3xl overflow-hidden bg-slate-900 border-2 border-emerald-500/30 flex items-center justify-center shadow-2xl'
            : 'relative w-full aspect-video rounded-2xl overflow-hidden bg-slate-900 border border-emerald-500/30 flex items-center justify-center shadow-inner'
        }
      >
        {activeCall.isVideo && !isCamOff ? (
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover scale-x-[-1]"
          />
        ) : (
          <div className="flex flex-col items-center justify-center space-y-3 text-center p-6">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-tr from-rose-500 via-purple-600 to-indigo-600 p-1 shadow-2xl">
              <div className="w-full h-full rounded-full bg-slate-950 flex items-center justify-center font-black text-2xl sm:text-3xl text-emerald-300">
                {otherUserName.charAt(0).toUpperCase()}
              </div>
            </div>
            <div>
              <h3 className="text-lg font-black text-white">{otherUserName}</h3>
              <p className="text-xs text-emerald-400 font-mono">
                {isMuted ? 'Muted' : 'Microphone Connected'}
              </p>
            </div>
          </div>
        )}

        {/* Remote/Local Visual Overlay Label */}
        <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-black/70 border border-white/10 text-[10px] font-mono font-bold text-white backdrop-blur-md flex items-center gap-1.5">
          <UserIcon className="w-3 h-3 text-emerald-400" />
          <span>{otherUserName}</span>
        </div>

        {/* Live Microphone Audio Waveform Bar */}
        <div className="absolute bottom-3 left-3 right-3 h-6 rounded-xl bg-black/60 border border-emerald-500/30 px-2 flex items-center justify-center">
          <canvas ref={canvasRef} className="w-full h-full" width={200} height={24} />
        </div>
      </div>

      {/* Bottom Controls Bar */}
      <div className="flex items-center justify-center gap-3 pt-1">
        {/* Mute Mic Toggle */}
        <button
          onClick={handleToggleMute}
          className={`p-3 rounded-2xl font-bold text-xs flex items-center gap-2 cursor-pointer transition-transform active:scale-95 ${
            isMuted
              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
          }`}
          title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
        >
          {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        {/* Camera Toggle if video */}
        {activeCall.isVideo && (
          <button
            onClick={handleToggleCam}
            className={`p-3 rounded-2xl font-bold text-xs flex items-center gap-2 cursor-pointer transition-transform active:scale-95 ${
              isCamOff
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
            }`}
            title={isCamOff ? 'Turn Camera On' : 'Turn Camera Off'}
          >
            {isCamOff ? <CameraOff className="w-5 h-5" /> : <Camera className="w-5 h-5" />}
          </button>
        )}

        {/* Fullscreen Toggle */}
        <button
          onClick={() => {
            SFX.playClick();
            setIsFullscreen(!isFullscreen);
          }}
          className="p-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs cursor-pointer border border-white/10"
          title={isFullscreen ? 'Unfullscreen' : 'Fullscreen'}
        >
          {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
        </button>

        {/* Hang Up Button */}
        <button
          onClick={handleHangupCall}
          className="px-6 py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs uppercase tracking-wider shadow-lg cursor-pointer flex items-center gap-2 transition-transform active:scale-95"
        >
          <PhoneOff className="w-5 h-5" />
          <span>Hang Up</span>
        </button>
      </div>

      {giftOverlay}
    </div>
  );
};
