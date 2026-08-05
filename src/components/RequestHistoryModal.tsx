import React, { useState, useEffect } from 'react';
import { GameRequest, User } from '../types';
import { X, Clock, CheckCircle2, XCircle, RefreshCw, Inbox } from 'lucide-react';
import { fetchUserRequestsStore } from '../services/firestoreStore';

interface RequestHistoryModalProps {
  user: User;
  onClose: () => void;
}

export const RequestHistoryModal: React.FC<RequestHistoryModalProps> = ({
  user,
  onClose,
}) => {
  const [requests, setRequests] = useState<GameRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const userReqs = await fetchUserRequestsStore(user.id);
      setRequests(userReqs);
    } catch (err) {
      console.warn('Fetch user requests store error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [user.id]);

  const formatDate = (ts: number) => {
    return new Date(ts).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div id="request-history-modal-overlay" className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn">
      <div id="request-history-card" className="glass-modal w-full max-w-lg p-5 sm:p-6 shadow-2xl relative space-y-4 max-h-[88vh] sm:max-h-[90vh] flex flex-col my-auto [scrollbar-width:thin]">
        <div className="flex items-center justify-between pb-3.5 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <Inbox className="w-5 h-5 text-purple-400" />
            <h3 className="text-lg font-bold text-white font-mono tracking-tight">My Request History</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
          {loading ? (
            <div className="p-8 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-purple-400" />
              <span className="text-xs font-mono">Fetching request status...</span>
            </div>
          ) : requests.length === 0 ? (
            <div className="p-8 text-center text-slate-400 font-mono text-xs glass rounded-xl">
              No access requests submitted yet.
            </div>
          ) : (
            requests.map((req) => (
              <div
                key={req.id}
                className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-between gap-3 text-xs backdrop-blur-md"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-100 font-mono">{req.targetTitle}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase bg-white/10 text-purple-200 border border-white/10">
                      {req.type === 'tier' ? 'Tier' : 'Game'}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 block">
                    Submitted: {formatDate(req.createdAt)}
                  </span>
                </div>

                <div>
                  {req.status === 'pending' && (
                    <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold text-[10px] flex items-center gap-1 backdrop-blur-md">
                      <Clock className="w-3 h-3 animate-pulse" /> Pending
                    </span>
                  )}
                  {req.status === 'accepted' && (
                    <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold text-[10px] flex items-center gap-1 backdrop-blur-md">
                      <CheckCircle2 className="w-3 h-3" /> Approved
                    </span>
                  )}
                  {req.status === 'denied' && (
                    <span className="px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 font-semibold text-[10px] flex items-center gap-1 backdrop-blur-md">
                      <XCircle className="w-3 h-3" /> Denied
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
