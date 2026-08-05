import React, { useState, useEffect } from 'react';
import { GameRequest } from '../types';
import { BrandingFooter } from './BrandingFooter';
import { Inbox, CheckCircle2, XCircle, Clock, RefreshCw, Send } from 'lucide-react';
import { fetchAllRequestsStore, resolveRequestStore } from '../services/firestoreStore';

interface RequestsPanelProps {
  onRequestsUpdated?: () => void;
}

export const RequestsPanel: React.FC<RequestsPanelProps> = ({ onRequestsUpdated }) => {
  const [requests, setRequests] = useState<GameRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Duration Modal State for single_game accepts
  const [selectedRequest, setSelectedRequest] = useState<GameRequest | null>(null);
  const [durationOption, setDurationOption] = useState<string>('3600'); // default 1 hour
  const [customMinutes, setCustomMinutes] = useState<string>('45');
  const [resolving, setResolving] = useState(false);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const storeReqs = await fetchAllRequestsStore();
      setRequests(storeReqs);
    } catch (err) {
      console.warn('Fetch requests store error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleResolve = async (requestId: string, action: 'accepted' | 'denied', durSecs?: number) => {
    setResolving(true);

    try {
      await resolveRequestStore(requestId, action, durSecs);
    } catch (err) {
      console.warn('Resolve request store error:', err);
    }

    setSelectedRequest(null);
    await fetchRequests();
    if (onRequestsUpdated) onRequestsUpdated();
    setResolving(false);
  };

  const handleOpenAcceptPrompt = (req: GameRequest) => {
    setSelectedRequest(req);
    // Default durationOption to 'permanent' for tier requests or '3600' for game requests
    setDurationOption(req.type === 'tier' ? 'permanent' : '3600');
  };

  const handleConfirmAccept = () => {
    if (!selectedRequest) return;
    if (durationOption === 'permanent') {
      handleResolve(selectedRequest.id, 'accepted');
      return;
    }
    let finalSecs = Number(durationOption);
    if (durationOption === 'custom') {
      finalSecs = (Number(customMinutes) || 30) * 60;
    }
    handleResolve(selectedRequest.id, 'accepted', finalSecs);
  };

  const formatDate = (ts: number) => {
    return new Date(ts).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const pendingCount = requests.filter((r) => r.status === 'pending').length;

  return (
    <div id="requests-admin-panel" className="space-y-6">
      {/* Prominent Branding Banner on Requests Panel */}
      <div className="flex justify-center">
        <BrandingFooter variant="prominent" />
      </div>

      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-2xl font-mono font-bold text-white flex items-center gap-2">
            <Inbox className="w-6 h-6 text-amber-400" />
            <span>Requests Admin Panel</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Review pending access requests from users and grant permanent or time-limited access.
          </p>
        </div>
        <button
          onClick={fetchRequests}
          className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Refresh Requests</span>
        </button>
      </div>

      {/* Requests Table Card */}
      <div id="requests-list-card" className="glass-card p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-white font-mono tracking-tight">
              Access Requests Queue
            </h3>
            {pendingCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold text-xs animate-pulse backdrop-blur-md">
                {pendingCount} Pending
              </span>
            )}
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400 font-mono text-xs flex justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
            Loading request queue...
          </div>
        ) : requests.length === 0 ? (
          <div className="p-8 text-center text-slate-400 font-mono text-xs glass rounded-xl">
            No requests found in database.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 text-slate-400 uppercase font-mono text-[10px]">
                  <th className="py-2.5 px-3">Username</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Target</th>
                  <th className="py-2.5 px-3">Requested At</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {requests.map((req) => {
                  const isPending = req.status === 'pending';
                  return (
                    <tr key={req.id} className={isPending ? 'bg-amber-500/10' : ''}>
                      <td className="py-3 px-3 font-mono font-bold text-slate-200">
                        {req.username}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase backdrop-blur-md ${
                            req.type === 'tier'
                              ? 'bg-purple-500/20 text-purple-200 border border-purple-500/40'
                              : 'bg-indigo-500/20 text-indigo-200 border border-indigo-500/40'
                          }`}
                        >
                          {req.type === 'tier' ? 'Tier Unlock' : 'Single Game'}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-medium text-amber-300">
                        {req.targetTitle}
                      </td>
                      <td className="py-3 px-3 text-slate-400 text-[11px]">
                        {formatDate(req.createdAt)}
                      </td>
                      <td className="py-3 px-3">
                        {req.status === 'pending' && (
                          <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-semibold flex items-center gap-1 w-fit backdrop-blur-md">
                            <Clock className="w-3 h-3 animate-pulse" /> Pending
                          </span>
                        )}
                        {req.status === 'accepted' && (
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-semibold flex items-center gap-1 w-fit backdrop-blur-md">
                            <CheckCircle2 className="w-3 h-3" /> Approved
                          </span>
                        )}
                        {req.status === 'denied' && (
                          <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-semibold flex items-center gap-1 w-fit backdrop-blur-md">
                            <XCircle className="w-3 h-3" /> Denied
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        {isPending ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleOpenAcceptPrompt(req)}
                              className="py-1.5 px-3 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-500/40 font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer shadow-sm backdrop-blur-md"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Accept</span>
                            </button>
                            <button
                              onClick={() => handleResolve(req.id, 'denied')}
                              className="py-1.5 px-3 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/40 font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer backdrop-blur-md"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Deny</span>
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-500 text-[11px]">Resolved</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Prompt Duration Modal for Requests (Tier or Game) */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn">
          <div className="glass-modal w-full max-w-md p-5 sm:p-6 space-y-4 shadow-2xl relative max-h-[88vh] sm:max-h-[90vh] overflow-y-auto my-auto [scrollbar-width:thin]">
            <h3 className="text-lg font-bold text-white font-mono flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-400" />
              <span>Grant Access Duration</span>
            </h3>

            <p className="text-xs text-slate-300 leading-relaxed">
              User <strong className="text-amber-300">{selectedRequest.username}</strong> requested access for{' '}
              <strong className="text-indigo-300">
                {selectedRequest.type === 'tier' ? `${selectedRequest.targetTitle} Tier` : selectedRequest.targetTitle}
              </strong>
              . Choose access duration:
            </p>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setDurationOption('permanent')}
                className={`w-full p-2.5 rounded-xl border text-xs font-mono text-center cursor-pointer transition-all ${
                  durationOption === 'permanent'
                    ? 'bg-purple-500/30 border-purple-500/60 text-purple-200 font-bold backdrop-blur-md shadow-md'
                    : 'bg-white/[0.02] border-white/10 text-slate-400 hover:border-white/20'
                }`}
              >
                Permanent Access (Forever)
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDurationOption('1800')} // 30 mins
                  className={`p-2.5 rounded-xl border text-xs font-mono text-center cursor-pointer transition-all ${
                    durationOption === '1800'
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-200 font-bold backdrop-blur-md'
                      : 'bg-white/[0.02] border-white/10 text-slate-400 hover:border-white/20'
                  }`}
                >
                  30 Minutes
                </button>
                <button
                  type="button"
                  onClick={() => setDurationOption('3600')} // 1 hour
                  className={`p-2.5 rounded-xl border text-xs font-mono text-center cursor-pointer transition-all ${
                    durationOption === '3600'
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-200 font-bold backdrop-blur-md'
                      : 'bg-white/[0.02] border-white/10 text-slate-400 hover:border-white/20'
                  }`}
                >
                  1 Hour
                </button>
                <button
                  type="button"
                  onClick={() => setDurationOption('10800')} // 3 hours
                  className={`p-2.5 rounded-xl border text-xs font-mono text-center cursor-pointer transition-all ${
                    durationOption === '10800'
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-200 font-bold backdrop-blur-md'
                      : 'bg-white/[0.02] border-white/10 text-slate-400 hover:border-white/20'
                  }`}
                >
                  3 Hours
                </button>
                <button
                  type="button"
                  onClick={() => setDurationOption('86400')} // 24 hours
                  className={`p-2.5 rounded-xl border text-xs font-mono text-center cursor-pointer transition-all ${
                    durationOption === '86400'
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-200 font-bold backdrop-blur-md'
                      : 'bg-white/[0.02] border-white/10 text-slate-400 hover:border-white/20'
                  }`}
                >
                  24 Hours
                </button>
              </div>

              {/* Custom Minutes Input Option */}
              <div className="pt-2 border-t border-white/10 flex items-center gap-2">
                <input
                  type="radio"
                  id="custom-dur"
                  name="duration"
                  checked={durationOption === 'custom'}
                  onChange={() => setDurationOption('custom')}
                  className="accent-amber-500"
                />
                <label htmlFor="custom-dur" className="text-xs text-slate-300 font-mono">
                  Custom Minutes:
                </label>
                <input
                  type="number"
                  min="1"
                  max="10000"
                  value={customMinutes}
                  onChange={(e) => {
                    setCustomMinutes(e.target.value);
                    setDurationOption('custom');
                  }}
                  className="w-20 glass-input px-2 py-1 text-xs text-slate-100 font-mono"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
              <button
                onClick={() => setSelectedRequest(null)}
                className="py-2 px-4 rounded-xl bg-white/10 text-slate-300 text-xs font-semibold hover:bg-white/20 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAccept}
                disabled={resolving}
                className="py-2 px-4 rounded-xl bg-emerald-500/30 hover:bg-emerald-500/40 text-emerald-100 border border-emerald-500/50 text-xs font-bold cursor-pointer disabled:opacity-50 flex items-center gap-1.5 backdrop-blur-md"
              >
                {resolving ? (
                  'Granting...'
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Confirm & Grant Access</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
