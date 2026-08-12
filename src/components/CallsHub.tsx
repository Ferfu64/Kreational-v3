import React, { useState, useEffect } from 'react';
import { User } from '../types';
import {
  Phone,
  Radio,
  Copy,
  Check,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Mic,
  MessageSquare,
  Gamepad2,
  Share2,
} from 'lucide-react';
import { SFX } from '../utils/sfx';
import { triggerNotification } from '../utils/notificationManager';
import { createPrivateCallRoom, joinPrivateCallRoom } from '../services/callService';

interface CallsHubProps {
  user: User | null;
  onOpenKrozeZone: () => void;
  onReturnToGames: () => void;
}

export const CallsHub: React.FC<CallsHubProps> = ({
  user,
  onOpenKrozeZone,
  onReturnToGames,
}) => {
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [createdRoomUrl, setCreatedRoomUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  // Check if room param was in URL
  const urlParams = new URLSearchParams(window.location.search);
  const urlRoomCode = urlParams.get('callRoom');

  useEffect(() => {
    if (urlRoomCode) {
      setRoomCodeInput(urlRoomCode);
    }
  }, [urlRoomCode]);

  const handleCreateRoom = async () => {
    if (!user) {
      triggerNotification('⚠️ Log In Required', 'Please log in to create a voice call room!');
      return;
    }

    SFX.playClick();
    setIsCreating(true);

    try {
      const { roomId, shareUrl } = await createPrivateCallRoom(user.id, user.username);
      setCreatedRoomUrl(shareUrl);
      
      try {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        SFX.playSuccess();
        triggerNotification('🔗 Voice Room Link Copied!', 'Share this link with a friend to call!');
        setTimeout(() => setCopied(false), 3000);
      } catch (e) {
        // Fallback
      }
    } catch (err) {
      console.warn('Failed to create call room:', err);
      SFX.playError();
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinRoom = async (codeToJoin?: string) => {
    if (!user) {
      triggerNotification('⚠️ Log In Required', 'Please log in to join a voice call room!');
      return;
    }

    const targetCode = (codeToJoin || roomCodeInput).trim();
    if (!targetCode) {
      SFX.playError();
      return;
    }

    // Extract roomId if user pasted a full URL
    let cleanRoomId = targetCode;
    if (targetCode.includes('callRoom=')) {
      cleanRoomId = targetCode.split('callRoom=')[1].split('&')[0];
    } else if (targetCode.includes('/calls/')) {
      cleanRoomId = targetCode.split('/calls/')[1].split('?')[0];
    }

    SFX.playClick();
    setIsJoining(true);

    const success = await joinPrivateCallRoom(cleanRoomId, user.id, user.username);
    setIsJoining(false);

    if (success) {
      SFX.playSuccess();
      triggerNotification('📞 Joining Voice Room...', 'Connecting to private voice call room!');
    } else {
      SFX.playError();
      triggerNotification('❌ Room Not Found', 'Invalid or expired call room code!');
    }
  };

  return (
    <div className="min-h-screen bg-[#05070f] text-slate-100 flex flex-col justify-between p-4 sm:p-8 relative overflow-hidden">
      {/* Background Ambient Glows */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-emerald-500/10 blur-[140px] pointer-events-none" />
      <div className="fixed bottom-0 right-0 w-96 h-96 bg-teal-600/10 blur-[140px] pointer-events-none" />

      {/* Top Nav Header */}
      <header className="w-full max-w-5xl mx-auto flex items-center justify-between py-4 border-b border-emerald-500/20 relative z-10">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.3)]">
            <Radio className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              KROZE VOICE HUB
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-[10px] font-mono font-bold text-emerald-300">
                LIVE
              </span>
            </h1>
            <p className="text-xs text-slate-400 font-mono">
              High-definition, low-latency 2-way audio calling
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onOpenKrozeZone}
            className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors"
          >
            <MessageSquare className="w-4 h-4" />
            <span className="hidden sm:inline">Kroze Zone</span>
          </button>
          <button
            onClick={onReturnToGames}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-white/10 text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors"
          >
            <Gamepad2 className="w-4 h-4" />
            <span className="hidden sm:inline">Kreational Games</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="w-full max-w-3xl mx-auto my-auto py-10 space-y-8 relative z-10">
        {/* Intro Banner */}
        <div className="p-6 sm:p-8 rounded-3xl bg-slate-950/80 border-2 border-emerald-500/30 shadow-[0_0_50px_rgba(16,185,129,0.15)] backdrop-blur-2xl text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-400/30 text-xs font-mono font-bold text-emerald-300">
            <Mic className="w-4 h-4 text-emerald-400 animate-pulse" />
            <span>Voice-Only Calling Active</span>
          </div>

          <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-tight">
            Connect Instantly with Voice Calls
          </h2>
          <p className="text-sm text-slate-300 max-w-lg mx-auto">
            Start a 1-on-1 private voice call with any Kroze friend or generate a shareable private room link that anyone can join instantly!
          </p>

          {/* Quick Action: Generate Share Room Link */}
          <div className="pt-2">
            <button
              onClick={handleCreateRoom}
              disabled={isCreating}
              className="px-8 py-4 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-sm uppercase tracking-wider shadow-[0_0_30px_rgba(16,185,129,0.4)] cursor-pointer transition-transform active:scale-95 flex items-center justify-center gap-3 mx-auto"
            >
              <Phone className="w-5 h-5 fill-slate-950" />
              <span>{isCreating ? 'Generating Room...' : 'Create Private Voice Room'}</span>
            </button>
          </div>

          {/* Created Room Share Box */}
          {createdRoomUrl && (
            <div className="mt-4 p-4 rounded-2xl bg-slate-900 border border-emerald-500/40 text-left space-y-2 animate-fade-in">
              <div className="text-xs font-mono text-emerald-400 font-bold flex items-center justify-between">
                <span>YOUR PRIVATE VOICE ROOM LINK:</span>
                {copied && <span className="text-emerald-300 text-[11px]">Copied to Clipboard!</span>}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={createdRoomUrl}
                  className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 select-all"
                />
                <button
                  onClick={async () => {
                    await navigator.clipboard.writeText(createdRoomUrl);
                    setCopied(true);
                    SFX.playSuccess();
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Join Room Box */}
        <div className="p-6 sm:p-8 rounded-3xl bg-slate-950/60 border border-slate-800 backdrop-blur-xl space-y-4">
          <h3 className="text-lg font-black text-white flex items-center gap-2">
            <Share2 className="w-5 h-5 text-emerald-400" />
            <span>Join Existing Voice Room</span>
          </h3>
          <p className="text-xs text-slate-400">
            Received a call room link or code? Paste it below to connect immediately.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <input
              type="text"
              placeholder="Paste Room Link or Room ID (e.g. room_xyz)..."
              value={roomCodeInput}
              onChange={(e) => setRoomCodeInput(e.target.value)}
              className="w-full sm:flex-1 px-4 py-3.5 rounded-2xl bg-slate-900 border border-slate-800 text-sm font-mono text-white focus:outline-none focus:border-emerald-500 transition-colors"
            />
            <button
              onClick={() => handleJoinRoom()}
              disabled={isJoining || !roomCodeInput.trim()}
              className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-emerald-300 font-bold text-xs uppercase tracking-wider border border-emerald-500/30 cursor-pointer flex items-center justify-center gap-2 transition-colors"
            >
              <span>{isJoining ? 'Connecting...' : 'Join Call'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Features List */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800/80 flex items-start gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 shrink-0">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white">2-Way Voice Audio</h4>
              <p className="text-[11px] text-slate-400 mt-0.5">Crystal clear WebRTC speech with echo suppression.</p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800/80 flex items-start gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white">Private & Encrypted</h4>
              <p className="text-[11px] text-slate-400 mt-0.5">Direct peer-to-peer audio streaming with secure signaling.</p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800/80 flex items-start gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white">Background Visualizer</h4>
              <p className="text-[11px] text-slate-400 mt-0.5">Real-time live waveform equalizer bar during calls.</p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-5xl mx-auto py-4 text-center text-xs text-slate-500 font-mono relative z-10">
        Kreational Voice Hub &bull; WebRTC Real-Time Audio Infrastructure
      </footer>
    </div>
  );
};
