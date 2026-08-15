import React, { useState, useEffect } from 'react';
import { Game, Tier, TierId } from '../types';
import { BrandingFooter } from './BrandingFooter';
import {
  fetchAllGamesStore,
  createGameStore,
  updateGameStore,
  deleteGameStore,
  syncAllActiveGamesToDefaultStore,
} from '../services/firestoreStore';
import { Shield, Plus, Edit3, Trash2, RefreshCw, Gamepad2, Code, Check, Sparkles } from 'lucide-react';

interface GameManagementPanelProps {
  tiers: Tier[];
  onGamesUpdated?: () => void;
}

export const GameManagementPanel: React.FC<GameManagementPanelProps> = ({
  tiers,
  onGamesUpdated,
}) => {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);

  // New Game State
  const [title, setTitle] = useState('');
  const [tierId, setTierId] = useState<TierId>('bronze');
  const [embedCode, setEmbedCode] = useState('');
  const [order, setOrder] = useState('1');
  const [creating, setCreating] = useState(false);

  // Edit Game State
  const [editingGame, setEditingGame] = useState<Game | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editTierId, setEditTierId] = useState<TierId>('bronze');
  const [editEmbedCode, setEditEmbedCode] = useState('');
  const [editOrder, setEditOrder] = useState('1');
  const [updating, setUpdating] = useState(false);
  const [syncingDefault, setSyncingDefault] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);

  const fetchGames = async () => {
    setLoading(true);
    try {
      const storeGames = await fetchAllGamesStore();
      setGames(storeGames);
    } catch (err) {
      console.warn('Fetch games store error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncToDefault = async () => {
    setSyncingDefault(true);
    setSyncSuccess(false);
    try {
      const synced = await syncAllActiveGamesToDefaultStore(games);
      setGames(synced);
      if (onGamesUpdated) onGamesUpdated();
      setSyncSuccess(true);
      setTimeout(() => setSyncSuccess(false), 3500);
    } catch (err) {
      console.warn('Sync to default failed:', err);
    } finally {
      setSyncingDefault(false);
    }
  };

  useEffect(() => {
    fetchGames();
  }, []);

  const handleCreateGame = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !embedCode.trim()) {
      alert('Game title and embed code/URL are required');
      return;
    }

    setCreating(true);
    const newGame: Game = {
      id: `game-custom-${Date.now()}`,
      title: title.trim(),
      tier: tierId,
      embedCode: embedCode.trim(),
      order: Number(order) || 1,
    };

    try {
      await createGameStore(newGame);
    } catch (err) {
      console.warn('Create game store error:', err);
    }

    setTitle('');
    setEmbedCode('');
    await fetchGames();
    if (onGamesUpdated) onGamesUpdated();
    setCreating(false);
  };

  const handleOpenEdit = (game: Game) => {
    setEditingGame(game);
    setEditTitle(game.title);
    setEditTierId(game.tier);
    setEditEmbedCode(game.embedCode);
    setEditOrder(String(game.order || 1));
  };

  const handleSaveEdit = async () => {
    if (!editingGame) return;
    setUpdating(true);

    const updatedGame: Game = {
      ...editingGame,
      title: editTitle.trim(),
      tier: editTierId,
      embedCode: editEmbedCode.trim(),
      order: Number(editOrder),
    };

    try {
      await updateGameStore(updatedGame);
    } catch (err) {
      console.warn('Update game store error:', err);
    }

    setEditingGame(null);
    await fetchGames();
    if (onGamesUpdated) onGamesUpdated();
    setUpdating(false);
  };

  const handleDeleteGame = async (gameId: string, gameTitle: string) => {
    if (!confirm(`Are you sure you want to delete game "${gameTitle}"?`)) return;

    try {
      await deleteGameStore(gameId);
    } catch (err) {
      console.warn('Delete game store error:', err);
    }

    await fetchGames();
    if (onGamesUpdated) onGamesUpdated();
  };

  return (
    <div id="games-admin-panel" className="space-y-6">
      {/* Prominent Branding Banner on Games Panel */}
      <div className="flex justify-center">
        <BrandingFooter variant="prominent" />
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-2xl font-mono font-bold text-white flex items-center gap-2">
            <Shield className="w-6 h-6 text-rose-400" />
            <span>Games Management Panel</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Add, update, or remove games across all tiers. Supports full iframe tags or bare URLs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSyncToDefault}
            disabled={syncingDefault}
            className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              syncSuccess
                ? 'bg-emerald-600/30 border border-emerald-500/50 text-emerald-300'
                : 'bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-950/60'
            }`}
            title="Sync all currently active games into the permanent default list and Firestore"
          >
            {syncSuccess ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span>Default List Synced!</span>
              </>
            ) : (
              <>
                <Sparkles className={`w-4 h-4 ${syncingDefault ? 'animate-spin' : ''}`} />
                <span>{syncingDefault ? 'Syncing...' : 'Sync Games to Default'}</span>
              </>
            )}
          </button>
          <button
            onClick={fetchGames}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Add Game Form */}
        <div id="add-game-card" className="glass-card p-6 space-y-4 shadow-xl h-fit">
          <div className="flex items-center gap-2.5 pb-3 border-b border-white/10">
            <Plus className="w-5 h-5 text-purple-400" />
            <h3 className="text-base font-bold text-white font-mono tracking-tight">Add New Game</h3>
          </div>

          <form onSubmit={handleCreateGame} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                Game Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Cyber Runner 2099"
                className="w-full glass-input px-3.5 py-2.5 text-xs"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                Assigned Tier
              </label>
              <select
                value={tierId}
                onChange={(e) => setTierId(e.target.value as TierId)}
                className="w-full glass-input px-3.5 py-2.5 text-xs font-mono capitalize"
              >
                {tiers.map((t) => (
                  <option key={t.id} value={t.id} className="bg-slate-900 text-white">
                    {t.name} Tier
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                Embed Code or Bare URL
              </label>
              <textarea
                value={embedCode}
                onChange={(e) => setEmbedCode(e.target.value)}
                placeholder='e.g. https://play2048.co/ OR <iframe src="..."></iframe>'
                rows={3}
                className="w-full glass-input px-3.5 py-2.5 text-xs font-mono"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                Display Order
              </label>
              <input
                type="number"
                value={order}
                onChange={(e) => setOrder(e.target.value)}
                className="w-full glass-input px-3.5 py-2.5 text-xs font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={creating}
              className="w-full mt-2 btn-primary py-2.5 px-4 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {creating ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Add Game to Library</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Existing Games List */}
        <div id="games-list-card" className="lg:col-span-2 glass-card p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <h3 className="text-base font-bold text-white font-mono tracking-tight">
              Library Games ({games.length})
            </h3>
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-400 font-mono text-xs flex justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-purple-400" />
              Loading games...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-slate-400 uppercase font-mono text-[10px]">
                    <th className="py-2.5 px-3">Title</th>
                    <th className="py-2.5 px-3">Tier</th>
                    <th className="py-2.5 px-3">Format</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {games.map((g) => {
                    const isIframe = g.embedCode.trim().toLowerCase().startsWith('<iframe');
                    return (
                      <tr key={g.id} className="hover:bg-white/[0.03] transition-colors">
                        <td className="py-3 px-3 font-mono font-bold text-slate-200">
                          {g.title}
                        </td>
                        <td className="py-3 px-3 capitalize">
                          <span className="px-2 py-0.5 rounded-full bg-white/10 text-purple-200 font-mono text-[10px]">
                            {g.tier}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-400 text-[11px]">
                          {isIframe ? (
                            <span className="text-purple-300 font-mono">iframe tag</span>
                          ) : (
                            <span className="text-cyan-300 font-mono">bare URL</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenEdit(g)}
                              className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 transition-colors cursor-pointer"
                              title="Edit Game"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteGame(g.id, g.title)}
                              className="p-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/40 transition-colors cursor-pointer backdrop-blur-md"
                              title="Delete Game"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
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

      {/* Edit Game Modal */}
      {editingGame && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn">
          <div className="glass-modal w-full max-w-md p-5 sm:p-6 space-y-4 shadow-2xl relative max-h-[88vh] sm:max-h-[90vh] overflow-y-auto my-auto [scrollbar-width:thin]">
            <h3 className="text-lg font-bold text-white font-mono flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-purple-400" />
              <span>Edit Game: {editingGame.title}</span>
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full glass-input px-3.5 py-2 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Tier
                </label>
                <select
                  value={editTierId}
                  onChange={(e) => setEditTierId(e.target.value as TierId)}
                  className="w-full glass-input px-3.5 py-2 text-xs font-mono capitalize"
                >
                  {tiers.map((t) => (
                    <option key={t.id} value={t.id} className="bg-slate-900 text-white">
                      {t.name} Tier
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Embed Code / URL
                </label>
                <textarea
                  value={editEmbedCode}
                  onChange={(e) => setEditEmbedCode(e.target.value)}
                  rows={3}
                  className="w-full glass-input px-3.5 py-2 text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Order
                </label>
                <input
                  type="number"
                  value={editOrder}
                  onChange={(e) => setEditOrder(e.target.value)}
                  className="w-full glass-input px-3.5 py-2 text-xs font-mono"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
              <button
                onClick={() => setEditingGame(null)}
                className="py-2 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={updating}
                className="btn-primary py-2 px-4 text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                {updating ? 'Saving...' : 'Save Game'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
