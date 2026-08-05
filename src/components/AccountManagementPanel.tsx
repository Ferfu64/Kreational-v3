import React, { useState, useEffect } from 'react';
import { Tier, TierId, User } from '../types';
import { BrandingFooter } from './BrandingFooter';
import { UserPlus, Edit3, Trash2, Lock, Check, RefreshCw, Users, KeyRound } from 'lucide-react';
import {
  fetchAllUsers,
  createUserAccount,
  updateUserAccount,
  deleteUserAccount,
} from '../services/firestoreStore';

interface AccountManagementPanelProps {
  tiers: Tier[];
  onAccountsUpdated?: () => void;
}

export const AccountManagementPanel: React.FC<AccountManagementPanelProps> = ({
  tiers,
  onAccountsUpdated,
}) => {
  const [accounts, setAccounts] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [, setError] = useState<string | null>(null);

  // New Account State
  const [newName, setNewName] = useState('');
  const [newSecretWord, setNewSecretWord] = useState('');
  const [newTiers, setNewTiers] = useState<TierId[]>([]);
  const [creating, setCreating] = useState(false);

  // Edit Account State
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editName, setEditName] = useState('');
  const [editSecretWord, setEditSecretWord] = useState('');
  const [editTiers, setEditTiers] = useState<TierId[]>([]);
  const [updating, setUpdating] = useState(false);

  const fetchAccounts = async () => {
    setLoading(true);
    setError(null);
    try {
      const usersList = await fetchAllUsers();
      setAccounts(usersList);
    } catch (err: any) {
      console.warn('Fetch accounts failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
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
      createdAt: Date.now(),
    };

    try {
      await createUserAccount(newUserObj, wordClean);
    } catch (err) {
      console.warn('Account creation error:', err);
    }

    setNewName('');
    setNewSecretWord('');
    setNewTiers([]);
    await fetchAccounts();
    if (onAccountsUpdated) onAccountsUpdated();
    setCreating(false);
  };

  const handleOpenEdit = (user: User) => {
    setEditingUser(user);
    setEditName(user.username);
    setEditSecretWord(user.secretWord || '');
    setEditTiers(user.purchasedTiers || []);
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
      });
    } catch (err) {
      console.warn('Account update error:', err);
    }

    setEditingUser(null);
    await fetchAccounts();
    if (onAccountsUpdated) onAccountsUpdated();
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

  return (
    <div id="account-admin-panel" className="space-y-6">
      {/* Prominent Branding Banner on Admin Panel */}
      <div className="flex justify-center">
        <BrandingFooter variant="prominent" />
      </div>

      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-2xl font-mono font-bold text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-purple-400" />
            <span>Account Management Panel</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Admin interface for creating users, setting unique secret words, tier granting, and deleting accounts.
          </p>
        </div>
        <button
          onClick={fetchAccounts}
          className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Refresh Accounts</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Create Account Form */}
        <div id="create-account-card" className="glass-card p-6 space-y-4 shadow-xl h-fit">
          <div className="flex items-center gap-2.5 pb-3 border-b border-white/10">
            <UserPlus className="w-5 h-5 text-purple-400" />
            <h3 className="text-base font-bold text-white font-mono tracking-tight">Create New User</h3>
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
                className="w-full glass-input px-3.5 py-2.5 text-xs"
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

            <button
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
            </button>
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
      </div>

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
                  className="w-full glass-input px-3.5 py-2 text-xs"
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
    </div>
  );
};
