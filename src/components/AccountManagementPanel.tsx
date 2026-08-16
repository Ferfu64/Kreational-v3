import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Tier, TierId, User, AccountCreationRequest } from '../types';
import { BrandingFooter } from './BrandingFooter';
import {
  UserPlus,
  Edit3,
  Trash2,
  Lock,
  Check,
  RefreshCw,
  Users,
  KeyRound,
  Inbox,
  CheckCircle2,
  XCircle,
  Clock,
  Coins,
  ShieldCheck,
  Filter,
} from 'lucide-react';
import {
  fetchAllUsers,
  createUserAccount,
  updateUserAccount,
  deleteUserAccount,
  fetchAllAccountRequestsStore,
  subscribeToAccountRequests,
  resolveAccountRequestStore,
  deleteAccountRequestStore,
} from '../services/firestoreStore';

interface AccountManagementPanelProps {
  tiers: Tier[];
  onAccountsUpdated?: () => void;
}

export const AccountManagementPanel: React.FC<AccountManagementPanelProps> = ({
  tiers,
  onAccountsUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<'accounts' | 'requests'>('accounts');
  const [accounts, setAccounts] = useState<User[]>([]);
  const [requests, setRequests] = useState<AccountCreationRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestFilter, setRequestFilter] = useState<'all' | 'pending' | 'accepted' | 'denied'>('all');

  // New Account State
  const [newName, setNewName] = useState('');
  const [newSecretWord, setNewSecretWord] = useState('');
  const [newTiers, setNewTiers] = useState<TierId[]>(['bronze']);
  const [newKrests, setNewKrests] = useState<number>(50);
  const [creating, setCreating] = useState(false);

  // Edit Account State
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editName, setEditName] = useState('');
  const [editSecretWord, setEditSecretWord] = useState('');
  const [editTiers, setEditTiers] = useState<TierId[]>([]);
  const [editKrests, setEditKrests] = useState<number>(0);
  const [updating, setUpdating] = useState(false);

  // Approve Request Dialog State
  const [approvingReq, setApprovingReq] = useState<AccountCreationRequest | null>(null);
  const [approveTiers, setApproveTiers] = useState<TierId[]>(['bronze']);
  const [approveKrests, setApproveKrests] = useState<number>(50);
  const [approveNotes, setApproveNotes] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const usersList = await fetchAllUsers();
      setAccounts(usersList);
    } catch (err: any) {
      console.warn('Fetch accounts failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRequests = async () => {
    setRequestsLoading(true);
    try {
      const reqList = await fetchAllAccountRequestsStore();
      setRequests(reqList);
    } catch (err) {
      console.warn('Fetch requests failed:', err);
    } finally {
      setRequestsLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
    fetchRequests();

    const unsub = subscribeToAccountRequests((fresh) => {
      setRequests(fresh);
    });
    return () => unsub();
  }, []);

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    const nameClean = newName.trim();
    const wordClean = newSecretWord.trim();

    if (!nameClean || !wordClean) {
      alert('Name and secret word are required');
      return;
    }

    setCreating(true);

    const newUserObj: User = {
      id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      username: nameClean,
      secretWord: wordClean,
      role: 'user',
      purchasedTiers: newTiers,
      temporaryAccess: [],
      krests: newKrests,
      createdAt: Date.now(),
    };

    try {
      await createUserAccount(newUserObj, wordClean);
    } catch (err) {
      console.warn('Account creation error:', err);
    }

    setNewName('');
    setNewSecretWord('');
    setNewTiers(['bronze']);
    setNewKrests(50);
    await fetchAccounts();
    if (onAccountsUpdated) onAccountsUpdated();
    setCreating(false);
  };

  const handleGrantKrests = async (targetUser: User, amount: number) => {
    const current = typeof targetUser.krests === 'number' ? targetUser.krests : (Number(targetUser.krests) || 0);
    const updatedKrests = Math.max(0, current + amount);
    try {
      await updateUserAccount(targetUser.id, { krests: updatedKrests });

      setAccounts((prev) =>
        prev.map((a) => (a.id === targetUser.id ? { ...a, krests: updatedKrests } : a))
      );

      try {
        const stored = localStorage.getItem('kreational_user');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && (parsed.id === targetUser.id || parsed.username === targetUser.username)) {
            const updatedCurrent = { ...parsed, krests: updatedKrests };
            localStorage.setItem('kreational_user', JSON.stringify(updatedCurrent));
            localStorage.setItem('kreational_current_user', JSON.stringify(updatedCurrent));
          }
        }
      } catch (e) {}

      await fetchAccounts();
      if (onAccountsUpdated) onAccountsUpdated();
      window.dispatchEvent(new Event('user_updated'));
    } catch (err) {
      console.warn('Grant Krests error:', err);
    }
  };

  const handleOpenEdit = (user: User) => {
    setEditingUser(user);
    setEditName(user.username);
    setEditSecretWord(user.secretWord || '');
    setEditTiers(user.purchasedTiers || []);
    setEditKrests(typeof user.krests === 'number' ? user.krests : (Number(user.krests) || 0));
  };

  const handleSaveEdit = async () => {
    if (!editingUser) return;
    setUpdating(true);

    const cleanName = editName.trim();
    const cleanWord = editSecretWord.trim() || undefined;

    try {
      await updateUserAccount(editingUser.id, {
        username: cleanName,
        secretWord: cleanWord,
        purchasedTiers: editTiers,
        krests: editKrests,
      });

      setAccounts((prev) =>
        prev.map((a) =>
          a.id === editingUser.id
            ? { ...a, username: cleanName, purchasedTiers: editTiers, krests: editKrests }
            : a
        )
      );

      try {
        const stored = localStorage.getItem('kreational_user');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && (parsed.id === editingUser.id || parsed.username === editingUser.username)) {
            const updatedCurrent = {
              ...parsed,
              username: cleanName,
              purchasedTiers: editTiers,
              krests: editKrests,
            };
            localStorage.setItem('kreational_user', JSON.stringify(updatedCurrent));
            localStorage.setItem('kreational_current_user', JSON.stringify(updatedCurrent));
          }
        }
      } catch (e) {}
    } catch (err) {
      console.warn('Account update error:', err);
    }

    setEditingUser(null);
    await fetchAccounts();
    if (onAccountsUpdated) onAccountsUpdated();
    window.dispatchEvent(new Event('user_updated'));
    setUpdating(false);
  };

  const handleRemoveAllAccess = async (userId: string) => {
    if (!confirm('Are you sure you want to revoke ALL tier access for this account?')) return;

    try {
      await updateUserAccount(userId, { removeAllAccess: true });
    } catch (err) {
      console.warn('Remove access error:', err);
    }

    await fetchAccounts();
    if (onAccountsUpdated) onAccountsUpdated();
  };

  const handleDeleteAccount = async (userId: string, username: string) => {
    if (username === 'Kreator') {
      alert('The primary Kreator admin account cannot be deleted!');
      return;
    }
    if (!confirm(`Are you sure you want to permanently delete account "${username}"?`)) return;

    try {
      await deleteUserAccount(userId);
    } catch (err) {
      console.warn('Delete account error:', err);
    }

    await fetchAccounts();
    if (onAccountsUpdated) onAccountsUpdated();
  };

  const toggleTierInList = (list: TierId[], tierId: TierId) => {
    if (list.includes(tierId)) {
      return list.filter((t) => t !== tierId);
    }
    return [...list, tierId];
  };

  // Request resolution handlers
  const handleOpenApproveDialog = (req: AccountCreationRequest) => {
    setApprovingReq(req);
    setApproveTiers(['bronze']);
    setApproveKrests(50);
    setApproveNotes('Welcome to Kreational!');
  };

  const handleConfirmApprove = async () => {
    if (!approvingReq) return;
    setActionLoadingId(approvingReq.id);
    try {
      await resolveAccountRequestStore(approvingReq.id, 'accepted', {
        reviewerNotes: approveNotes.trim() || 'Approved by Kreator',
        grantedTiers: approveTiers,
        initialKrests: approveKrests,
      });
      await fetchAccounts();
      await fetchRequests();
      if (onAccountsUpdated) onAccountsUpdated();
    } catch (err) {
      console.warn('Approve request failed:', err);
    } finally {
      setActionLoadingId(null);
      setApprovingReq(null);
    }
  };

  const handleQuickDecline = async (req: AccountCreationRequest) => {
    if (!confirm(`Decline account creation request for "${req.preferredUsername}"?`)) return;
    setActionLoadingId(req.id);
    try {
      await resolveAccountRequestStore(req.id, 'denied', {
        reviewerNotes: 'Request was declined by Kreator.',
      });
      await fetchRequests();
    } catch (err) {
      console.warn('Decline request failed:', err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeleteRequest = async (requestId: string) => {
    if (!confirm('Remove this request entry from history?')) return;
    try {
      await deleteAccountRequestStore(requestId);
      await fetchRequests();
    } catch (err) {
      console.warn('Delete request failed:', err);
    }
  };

  const pendingRequestsCount = requests.filter((r) => r.status === 'pending').length;

  const filteredRequests = requests.filter((r) => {
    if (requestFilter === 'all') return true;
    return r.status === requestFilter;
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      id="account-admin-panel"
      className="space-y-6"
    >
      {/* Prominent Branding Banner on Admin Panel */}
      <div className="flex justify-center">
        <BrandingFooter variant="prominent" />
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-2xl font-mono font-bold text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-purple-400" />
            <span>Account Control Hub</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Admin interface for user creation, credential management, tier approvals, and incoming account requests.
          </p>
        </div>

        {/* Tab Selector Switcher */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-black/50 p-1 rounded-xl border border-white/10">
            <button
              onClick={() => setActiveTab('accounts')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'accounts'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Accounts ({accounts.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('requests')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition-all flex items-center gap-1.5 cursor-pointer relative ${
                activeTab === 'requests'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Inbox className="w-3.5 h-3.5" />
              <span>Account Requests</span>
              {pendingRequestsCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-black text-[10px] font-black animate-pulse">
                  {pendingRequestsCount}
                </span>
              )}
            </button>
          </div>

          <button
            onClick={() => {
              fetchAccounts();
              fetchRequests();
            }}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Refresh All"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {/* TAB 1: ACCOUNTS LIST & DIRECT CREATION */}
        {activeTab === 'accounts' && (
          <motion.div
            key="tab-accounts"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          >
            {/* Create Account Form */}
            <div id="create-account-card" className="glass-card p-6 space-y-4 shadow-xl h-fit">
              <div className="flex items-center gap-2.5 pb-3 border-b border-white/10">
                <UserPlus className="w-5 h-5 text-purple-400" />
                <h3 className="text-base font-bold text-white font-mono tracking-tight">Create User Direct</h3>
              </div>

              <form onSubmit={handleCreateAccount} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">
                    User Name
                  </label>
                  <input
                    id="new-account-name"
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Name (e.g. Alex)"
                    className="w-full glass-input px-3.5 py-2.5 text-xs font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5 flex items-center gap-1">
                    <KeyRound className="w-3.5 h-3.5 text-purple-400" />
                    <span>Secret Word</span>
                  </label>
                  <input
                    id="new-account-secret-word"
                    type="text"
                    value={newSecretWord}
                    onChange={(e) => setNewSecretWord(e.target.value)}
                    placeholder="Unique secret word (e.g. Dragon)"
                    className="w-full glass-input px-3.5 py-2.5 text-xs font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5 flex items-center gap-1">
                    <Coins className="w-3.5 h-3.5 text-amber-400" />
                    <span>Starting Krests 🪙</span>
                  </label>
                  <input
                    type="number"
                    value={newKrests}
                    onChange={(e) => setNewKrests(parseInt(e.target.value) || 0)}
                    placeholder="Starting balance"
                    className="w-full glass-input px-3.5 py-2.5 text-xs font-mono text-amber-300 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">
                    Grant Initial Tier Access
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {tiers.map((t) => {
                      const active = newTiers.includes(t.id);
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setNewTiers(toggleTierInList(newTiers, t.id))}
                          className={`py-1.5 px-2.5 rounded-xl text-[11px] font-mono border text-left flex items-center justify-between cursor-pointer transition-all ${
                            active
                              ? 'bg-purple-500/20 border-purple-500/50 text-purple-200 backdrop-blur-md'
                              : 'bg-white/[0.02] border-white/10 text-slate-400 hover:border-white/20'
                          }`}
                        >
                          <span>{t.name}</span>
                          {active && <Check className="w-3 h-3 text-purple-400" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  id="submit-create-account"
                  type="submit"
                  disabled={creating}
                  className="w-full mt-2 btn-primary py-2.5 px-4 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {creating ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      <span>Create User Account</span>
                    </>
                  )}
                </motion.button>
              </form>
            </div>

            {/* Existing Accounts Table */}
            <div id="accounts-list-card" className="lg:col-span-2 glass-card p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <h3 className="text-base font-bold text-white font-mono tracking-tight">
                  Registered Accounts ({accounts.length})
                </h3>
                <span className="text-xs text-slate-400">Managed by Kreator</span>
              </div>

              {loading ? (
                <div className="p-8 text-center text-slate-400 font-mono text-xs flex justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-purple-400" />
                  Loading accounts...
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-white/10 text-slate-400 uppercase font-mono text-[10px]">
                        <th className="py-2.5 px-3">Name</th>
                        <th className="py-2.5 px-3">Secret Word</th>
                        <th className="py-2.5 px-3">Role</th>
                        <th className="py-2.5 px-3">Krests</th>
                        <th className="py-2.5 px-3">Purchased Tiers</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {accounts.map((acc) => {
                        const isKreator = acc.username === 'Kreator';
                        return (
                          <tr key={acc.id} className="hover:bg-white/[0.03] transition-colors">
                            <td className="py-3 px-3 font-mono font-bold text-slate-200">
                              {acc.username}
                            </td>
                            <td className="py-3 px-3 font-mono text-purple-300 font-semibold">
                              {acc.secretWord || (isKreator ? 'Override' : '—')}
                            </td>
                            <td className="py-3 px-3">
                              {isKreator ? (
                                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold">
                                  Kreator
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full bg-white/10 text-slate-300 text-[10px]">
                                  User
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3 font-mono">
                              <div className="flex items-center gap-1.5">
                                <span className="text-amber-300 font-bold text-xs">
                                  {(acc.krests || 0).toLocaleString()} 🪙
                                </span>
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => handleGrantKrests(acc, 500)}
                                    className="px-1.5 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/40 text-amber-200 text-[10px] font-bold border border-amber-500/30 cursor-pointer"
                                    title="Grant +500 Krests"
                                  >
                                    +500
                                  </button>
                                  <button
                                    onClick={() => handleGrantKrests(acc, 1000)}
                                    className="px-1.5 py-0.5 rounded bg-purple-500/20 hover:bg-purple-500/40 text-purple-200 text-[10px] font-bold border border-purple-500/30 cursor-pointer"
                                    title="Grant +1000 Krests"
                                  >
                                    +1K
                                  </button>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <div className="flex flex-wrap gap-1">
                                {(acc.purchasedTiers || []).length === 0 ? (
                                  <span className="text-slate-500 text-[10px]">No Tiers</span>
                                ) : (
                                  acc.purchasedTiers.map((tierId) => (
                                    <span
                                      key={tierId}
                                      className="px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-200 text-[10px] font-mono capitalize backdrop-blur-md"
                                    >
                                      {tierId}
                                    </span>
                                  ))
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => handleOpenEdit(acc)}
                                  className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 transition-colors cursor-pointer"
                                  title="Edit Account"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                {!isKreator && (
                                  <>
                                    <button
                                      onClick={() => handleRemoveAllAccess(acc.id)}
                                      className="p-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 transition-colors cursor-pointer backdrop-blur-md"
                                      title="Remove All Access"
                                    >
                                      <Lock className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteAccount(acc.id, acc.username)}
                                      className="p-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/40 transition-colors cursor-pointer backdrop-blur-md"
                                      title="Delete Account"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* TAB 2: INCOMING ACCOUNT CREATION REQUESTS */}
        {activeTab === 'requests' && (
          <motion.div
            key="tab-requests"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            {/* Filter Bar */}
            <div className="flex items-center justify-between bg-white/[0.02] p-3 rounded-2xl border border-white/10">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-mono text-slate-300 font-bold">Filter Requests:</span>
                <div className="flex gap-1.5">
                  {(['all', 'pending', 'accepted', 'denied'] as const).map((status) => (
                    <button
                      key={status}
                      onClick={() => setRequestFilter(status)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono capitalize transition-colors cursor-pointer ${
                        requestFilter === status
                          ? 'bg-purple-600 text-white font-bold'
                          : 'bg-white/5 text-slate-400 hover:text-white'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>

              <span className="text-xs text-slate-400 font-mono">
                Showing {filteredRequests.length} of {requests.length} requests
              </span>
            </div>

            {/* Requests Cards List */}
            {requestsLoading ? (
              <div className="p-12 text-center text-slate-400 font-mono text-xs flex justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-purple-400" />
                Loading account requests...
              </div>
            ) : filteredRequests.length === 0 ? (
              <div className="glass-card p-12 text-center space-y-3">
                <Inbox className="w-12 h-12 text-slate-600 mx-auto" />
                <h4 className="text-sm font-mono font-bold text-slate-300">
                  No {requestFilter !== 'all' ? requestFilter : ''} account requests found
                </h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  When new users submit an account request on the login page, their requests will appear here for your approval.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredRequests.map((req) => {
                  const isPending = req.status === 'pending';
                  const isAccepted = req.status === 'accepted';
                  const isDenied = req.status === 'denied';
                  const isBusy = actionLoadingId === req.id;

                  return (
                    <motion.div
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      key={req.id}
                      className={`glass-card p-5 space-y-3 relative overflow-hidden border ${
                        isPending
                          ? 'border-amber-500/30 shadow-lg shadow-amber-950/20'
                          : isAccepted
                          ? 'border-emerald-500/30'
                          : 'border-rose-500/20 opacity-80'
                      }`}
                    >
                      {/* Top status indicator */}
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(req.createdAt).toLocaleDateString()} {new Date(req.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {isPending && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold flex items-center gap-1 animate-pulse">
                            <Clock className="w-3 h-3" />
                            Pending Review
                          </span>
                        )}
                        {isAccepted && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Approved
                          </span>
                        )}
                        {isDenied && (
                          <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-bold flex items-center gap-1">
                            <XCircle className="w-3 h-3" />
                            Declined
                          </span>
                        )}
                      </div>

                      {/* Request Details */}
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-baseline justify-between">
                          <span className="text-xs text-slate-400 uppercase font-mono">Preferred Name</span>
                          <span className="font-mono font-bold text-white text-base">
                            {req.preferredUsername}
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between">
                          <span className="text-xs text-slate-400 uppercase font-mono">Secret Key</span>
                          <span className="font-mono text-purple-300 text-xs font-semibold bg-purple-950/40 px-2 py-0.5 rounded border border-purple-800/50">
                            {req.preferredSecretWord}
                          </span>
                        </div>
                      </div>

                      {/* Optional Note */}
                      {req.note && (
                        <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 text-xs text-slate-300 italic">
                          "{req.note}"
                        </div>
                      )}

                      {/* Reviewer Note */}
                      {req.reviewerNotes && (
                        <div className="text-[11px] text-slate-400 bg-black/40 p-2 rounded-lg border border-white/5">
                          <strong className="text-purple-300 font-mono">Feedback:</strong> {req.reviewerNotes}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="pt-2 border-t border-white/10 flex items-center gap-2">
                        {isPending ? (
                          <>
                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              disabled={isBusy}
                              onClick={() => handleOpenApproveDialog(req)}
                              className="flex-1 btn-primary py-2 px-3 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Approve</span>
                            </motion.button>
                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              disabled={isBusy}
                              onClick={() => handleQuickDecline(req)}
                              className="px-3 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/40 text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Decline</span>
                            </motion.button>
                          </>
                        ) : (
                          <div className="w-full flex justify-end">
                            <button
                              onClick={() => handleDeleteRequest(req.id)}
                              className="p-1.5 rounded-xl bg-white/5 hover:bg-rose-500/20 hover:text-rose-200 text-slate-400 text-xs transition-colors cursor-pointer flex items-center gap-1 font-mono"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Dismiss</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Approve Account Request Modal */}
      {approvingReq && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="glass-modal w-full max-w-md p-5 sm:p-6 space-y-4 shadow-2xl relative"
          >
            <div className="flex items-center gap-2 pb-3 border-b border-white/10">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <h3 className="text-lg font-bold text-white font-mono">
                Approve Account: {approvingReq.preferredUsername}
              </h3>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/30 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">Username:</span>
                  <span className="font-bold text-white font-mono">{approvingReq.preferredUsername}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Secret Word:</span>
                  <span className="font-bold text-purple-300 font-mono">{approvingReq.preferredSecretWord}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1 flex items-center gap-1">
                  <Coins className="w-3.5 h-3.5 text-amber-400" />
                  <span>Initial Krests Balance 🪙</span>
                </label>
                <input
                  type="number"
                  value={approveKrests}
                  onChange={(e) => setApproveKrests(parseInt(e.target.value) || 0)}
                  className="w-full glass-input px-3.5 py-2 text-xs font-mono font-bold text-amber-300"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Initial Tier Access
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {tiers.map((t) => {
                    const active = approveTiers.includes(t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setApproveTiers(toggleTierInList(approveTiers, t.id))}
                        className={`py-1.5 px-2.5 rounded-xl text-[11px] font-mono border text-left flex items-center justify-between cursor-pointer transition-all ${
                          active
                            ? 'bg-purple-500/20 border-purple-500/50 text-purple-200 backdrop-blur-md'
                            : 'bg-white/[0.02] border-white/10 text-slate-400 hover:border-white/20'
                        }`}
                      >
                        <span>{t.name}</span>
                        {active && <Check className="w-3 h-3 text-purple-400" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Welcome Note / Response (Optional)
                </label>
                <input
                  type="text"
                  value={approveNotes}
                  onChange={(e) => setApproveNotes(e.target.value)}
                  placeholder="Welcome to Kreational!"
                  className="w-full glass-input px-3.5 py-2 text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
              <button
                onClick={() => setApprovingReq(null)}
                className="py-2 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmApprove}
                disabled={actionLoadingId === approvingReq.id}
                className="btn-primary py-2 px-4 text-xs font-bold cursor-pointer disabled:opacity-50 bg-gradient-to-r from-emerald-600 to-teal-600"
              >
                {actionLoadingId === approvingReq.id ? 'Creating Account...' : 'Confirm & Create Account'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Edit Account Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn">
          <div className="glass-modal w-full max-w-md p-5 sm:p-6 space-y-4 shadow-2xl relative max-h-[88vh] sm:max-h-[90vh] overflow-y-auto my-auto [scrollbar-width:thin]">
            <h3 className="text-lg font-bold text-white font-mono flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-purple-400" />
              <span>Edit Account: {editingUser.username}</span>
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full glass-input px-3.5 py-2 text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Krests Balance 🪙
                </label>
                <input
                  type="number"
                  value={editKrests}
                  onChange={(e) => setEditKrests(parseInt(e.target.value) || 0)}
                  placeholder="Krests balance"
                  className="w-full glass-input px-3.5 py-2 text-xs font-mono font-bold text-amber-300"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Secret Word
                </label>
                <input
                  type="text"
                  value={editSecretWord}
                  onChange={(e) => setEditSecretWord(e.target.value)}
                  placeholder="Set unique word"
                  className="w-full glass-input px-3.5 py-2 text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Granted Tiers
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {tiers.map((t) => {
                    const active = editTiers.includes(t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setEditTiers(toggleTierInList(editTiers, t.id))}
                        className={`py-1.5 px-2.5 rounded-xl text-[11px] font-mono border text-left flex items-center justify-between cursor-pointer transition-all ${
                          active
                            ? 'bg-purple-500/20 border-purple-500/50 text-purple-200 backdrop-blur-md'
                            : 'bg-white/[0.02] border-white/10 text-slate-400 hover:border-white/20'
                        }`}
                      >
                        <span>{t.name}</span>
                        {active && <Check className="w-3 h-3 text-purple-400" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
              <button
                onClick={() => setEditingUser(null)}
                className="py-2 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={updating}
                className="btn-primary py-2 px-4 text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                {updating ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};

