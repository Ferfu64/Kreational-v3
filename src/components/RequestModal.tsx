import React, { useState } from 'react';
import { Game, GameRequest, Tier, TierId, User } from '../types';
import { X, Send, Key, Sparkles, Gamepad2 } from 'lucide-react';
import { createRequestStore } from '../services/firestoreStore';

interface RequestModalProps {
  type: 'tier' | 'single_game';
  targetTier?: Tier | null;
  targetGame?: Game | null;
  user: User;
  onClose: () => void;
  onRequestSubmitted: () => void;
}

export const RequestModal: React.FC<RequestModalProps> = ({
  type,
  targetTier,
  targetGame,
  user,
  onClose,
  onRequestSubmitted,
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    if (!navigator.onLine) {
      setError('Offline Mode Notice: You are currently offline. Submitting access requests requires an internet connection. Local gameplay and features remain available.');
      setSubmitting(false);
      return;
    }

    const targetId = type === 'tier' ? targetTier?.id : targetGame?.id;
    const targetTitle = type === 'tier' ? targetTier?.name : targetGame?.title;
    const tierId = type === 'tier' ? targetTier?.id : targetGame?.tier;

    if (!targetId || !targetTitle || !tierId) {
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
      setSuccess(true);
      setTimeout(() => {
        onRequestSubmitted();
        onClose();
      }, 1500);
    } catch (err: any) {
      setError('Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div id="request-modal-overlay" className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn">
      <div id="request-modal-card" className="glass-modal w-full max-w-md p-5 sm:p-6 shadow-2xl relative space-y-4 max-h-[88vh] sm:max-h-[90vh] overflow-y-auto my-auto [scrollbar-width:thin]">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-300 flex items-center justify-center backdrop-blur-md">
            {type === 'tier' ? <Sparkles className="w-6 h-6" /> : <Gamepad2 className="w-6 h-6" />}
          </div>
          <div>
            <h3 className="text-lg font-bold text-white font-mono tracking-tight">
              Request Access
            </h3>
            <p className="text-xs text-purple-300">
              {type === 'tier' ? 'Full Tier Unlock Request' : 'Time-Limited Game Request'}
            </p>
          </div>
        </div>

        {success ? (
          <div className="p-4 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-center font-mono text-xs backdrop-blur-md">
            🎉 Request sent successfully! Kreator admin will review it shortly.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 text-xs space-y-1">
              <span className="text-slate-400 block">Requesting Target:</span>
              <span className="font-bold text-amber-300 font-mono text-sm block">
                {type === 'tier' ? `${targetTier?.name} Tier` : targetGame?.title}
              </span>
              {type === 'single_game' && (
                <span className="text-slate-400 block text-[11px]">
                  Belongs to: {targetGame?.tier.toUpperCase()} Tier
                </span>
              )}
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              {type === 'tier'
                ? 'Requesting permanent tier ownership. Kreator will grant or deny access in the admin panel.'
                : 'Requesting temporary play pass. Kreator will specify a custom duration (e.g. 1 hour, 24 hours) upon approval.'}
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
