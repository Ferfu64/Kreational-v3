import React, { useState } from 'react';
import { Game, GameRequest, Tier, TierId, User, TemporaryAccess } from '../types';
import { X, Send, Sparkles, Gamepad2, Clock, CheckCircle2, Zap } from 'lucide-react';
import { createRequestStore, updateUserAccount } from '../services/firestoreStore';
import { VoiceManager } from '../assistant/VoiceManager';
import { SFX } from '../utils/sfx';

interface RequestModalProps {
  type: 'tier' | 'single_game';
  targetTier?: Tier | null;
  targetGame?: Game | null;
  user: User;
  onClose: () => void;
  onRequestSubmitted: () => void;
  onUpdateUser: (updatedUser: User) => void;
  onPlayGame?: (game: Game) => void;
}

export const RequestModal: React.FC<RequestModalProps> = ({
  type,
  targetTier,
  targetGame,
  user,
  onClose,
  onRequestSubmitted,
  onUpdateUser,
  onPlayGame,
}) => {
  const [activeTab, setActiveTab] = useState<'request' | 'krests'>('krests');
  const [selectedMinutes, setSelectedMinutes] = useState<number>(15);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const krests = user.krests || 0;
  const targetTitle = type === 'tier' ? targetTier?.name : targetGame?.title;

  const handleInstantKrestsUnlock = async () => {
    if (krests < selectedMinutes) {
      setError(`Not enough Krests! You need ${selectedMinutes} Krests (You currently have ${krests}).`);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const durationSeconds = selectedMinutes * 60;
      const gameId = targetGame?.id;
      const tierId = targetTier?.id;

      const currentTemp = user.temporaryAccess || [];
      const updatedTemp: TemporaryAccess[] = [
        ...currentTemp.filter((t) => (gameId ? t.gameId !== gameId : t.tierId !== tierId)),
        {
          gameId,
          tierId: tierId as TierId,
          grantedAt: Date.now(),
          durationSeconds,
        },
      ];

      const newKrestsBalance = krests - selectedMinutes;

      const updatedUser: User = {
        ...user,
        krests: newKrestsBalance,
        temporaryAccess: updatedTemp,
      };

      // Persist update
      await updateUserAccount(user.id, {
        purchasedTiers: user.purchasedTiers,
      });

      onUpdateUser(updatedUser);

      try {
        VoiceManager.speak(`Successfully unlocked ${targetTitle} for ${selectedMinutes} minutes!`, {
          configOverride: { rate: 1.1, pitch: 1.1 },
        });
      } catch (e) {}

      setSuccess(`🎉 Unlocked for ${selectedMinutes} minutes using ${selectedMinutes} Krests! Launching game...`);

      setTimeout(() => {
        onClose();
        if (type === 'single_game' && targetGame && onPlayGame) {
          onPlayGame(targetGame);
        }
      }, 1200);
    } catch (err) {
      setError('Failed to process Krests unlock. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (krests < 50) {
      SFX.playError();
      setError(`Sending a request costs 50 Krests! (You have ${krests} Krests).`);
      return;
    }

    setSubmitting(true);
    setError(null);

    if (!navigator.onLine) {
      SFX.playError();
      setError('You are currently offline. Access requests require an internet connection.');
      setSubmitting(false);
      return;
    }

    const targetId = type === 'tier' ? targetTier?.id : targetGame?.id;
    const tierId = type === 'tier' ? targetTier?.id : targetGame?.tier;

    if (!targetId || !targetTitle || !tierId) {
      SFX.playError();
      setError('Invalid request parameters');
      setSubmitting(false);
      return;
    }

    const newReq: GameRequest = {
      id: `req-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      userId: user.id,
      username: user.username,
      type,
      targetId,
      targetTitle,
      tierId: tierId as TierId,
      status: 'pending',
      createdAt: Date.now(),
    };

    try {
      await createRequestStore(newReq);

      // Deduct 50 Krests cost
      const updatedKrests = krests - 50;
      const updatedUser: User = {
        ...user,
        krests: updatedKrests,
      };
      onUpdateUser(updatedUser);

      SFX.playRequestSent();
      setSuccess('🎉 Request sent successfully (-50 Krests)! Kreator admin will review it shortly.');
      setTimeout(() => {
        onRequestSubmitted();
        onClose();
      }, 1500);
    } catch (err: any) {
      SFX.playError();
      setError('Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div id="request-modal-overlay" className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn">
      <div id="request-modal-card" className="glass-modal w-full max-w-md p-5 sm:p-6 shadow-2xl relative space-y-4 max-h-[90vh] overflow-y-auto my-auto [scrollbar-width:thin] border border-amber-500/40">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-300 flex items-center justify-center backdrop-blur-md shrink-0">
            {type === 'tier' ? <Sparkles className="w-6 h-6" /> : <Gamepad2 className="w-6 h-6" />}
          </div>
          <div>
            <h3 className="text-lg font-bold text-white font-mono tracking-tight">
              Unlock or Request Access
            </h3>
            <p className="text-xs text-purple-300">
              {targetTitle} ({type === 'tier' ? 'Tier' : targetGame?.tier.toUpperCase() + ' Game'})
            </p>
          </div>
        </div>

        {/* Tab Switcher: Instant Krests vs Request Kreator */}
        <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-900 border border-white/10 text-xs font-bold">
          <button
            onClick={() => setActiveTab('krests')}
            className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'krests'
                ? 'bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-950/50'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Unlock with Krests</span>
          </button>

          <button
            onClick={() => setActiveTab('request')}
            className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'request'
                ? 'bg-purple-600 text-white font-bold shadow-md shadow-purple-950/50'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>Request Kreator</span>
          </button>
        </div>

        {/* Balance Indicator */}
        <div className="px-3.5 py-2 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-between text-xs font-mono">
          <span className="text-slate-400">Your Krests Balance:</span>
          <span className="text-amber-300 font-bold flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            {krests} Krests
          </span>
        </div>

        {success ? (
          <div className="p-4 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-center font-mono text-xs flex items-center justify-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>{success}</span>
          </div>
        ) : activeTab === 'krests' ? (
          /* Instant Unlock with Krests Tab */
          <div className="space-y-4">
            <p className="text-xs text-slate-300 leading-relaxed">
              Instantly unlock temporary access using Krests currency! <strong className="text-amber-300">1 Krest = 1 Minute of Playtime</strong>. No admin wait needed.
            </p>

            <div className="space-y-2">
              <label className="text-xs font-mono text-purple-300 font-bold block">
                Select Access Duration:
              </label>

              <div className="grid grid-cols-2 gap-2">
                {[5, 15, 30, 60].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setSelectedMinutes(mins)}
                    className={`p-3 rounded-xl border text-xs font-bold font-mono flex flex-col items-center gap-1 transition-all cursor-pointer ${
                      selectedMinutes === mins
                        ? 'bg-amber-500/20 border-amber-400 text-amber-200 shadow-md shadow-amber-950/50 ring-1 ring-amber-400'
                        : 'bg-slate-900 border-white/10 text-slate-400 hover:border-amber-500/40 hover:text-slate-200'
                    }`}
                  >
                    <span className="flex items-center gap-1 text-sm font-black text-white">
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      {mins} Minutes
                    </span>
                    <span className="text-[10px] text-amber-300">
                      Cost: {mins} Krests
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs">
                {error}
              </div>
            )}

            <button
              onClick={handleInstantKrestsUnlock}
              disabled={submitting || krests < selectedMinutes}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-amber-950/60 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Zap className="w-4 h-4 fill-current" />
                  <span>Instant Unlock ({selectedMinutes} Krests)</span>
                </>
              )}
            </button>
          </div>
        ) : (
          /* Request Kreator Tab */
          <form onSubmit={handleSubmitRequest} className="space-y-4">
            <p className="text-xs text-slate-400 leading-relaxed">
              Submit a free request to Kreator admin. Kreator will review and grant full tier or time-limited access.
            </p>

            {error && (
              <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full btn-primary py-3 px-4 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Submit Request to Kreator</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
