import React, { useState, useEffect } from 'react';
import { User } from '../types';
import {
  Sparkles,
  Megaphone,
  Gift,
  Search,
  CheckCircle2,
  X,
  Coins,
  ShieldAlert,
  Send,
  Trash2,
  Users,
  Zap,
  KeyRound,
  Plus,
} from 'lucide-react';
import { SFX } from '../utils/sfx';
import { fetchAllUsers, saveFullUserAccountToFirestore } from '../services/firestoreStore';
import { db } from '../lib/firebase';
import { doc, setDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { triggerNotification } from '../utils/notificationManager';
import { getActivePromoCodes, savePromoCodes, PromoCode } from '../services/promoCodeService';

interface KreatorFunPanelProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  onUpdateUser: (updatedUser: User) => void;
}

export interface GlobalAnnouncement {
  id: string;
  sender: string;
  message: string;
  createdAt: number;
}

export const KreatorFunPanel: React.FC<KreatorFunPanelProps> = ({
  isOpen,
  onClose,
  user,
  onUpdateUser,
}) => {
  const [announcementText, setAnnouncementText] = useState('');
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [selectedRecipientId, setSelectedRecipientId] = useState<string>('');
  const [krestsAmount, setKrestsAmount] = useState<number>(500);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusMsg, setStatusMsg] = useState<{ text: string; success: boolean } | null>(null);

  // Promo Code States
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [newCodeName, setNewCodeName] = useState('');
  const [newCodeHours, setNewCodeHours] = useState<number>(2);
  const [newCodeKrests, setNewCodeKrests] = useState<number>(100);
  const [newCodeDesc, setNewCodeDesc] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchAllUsers().then((users) => {
        setAllUsers(users);
        if (users.length > 0 && !selectedRecipientId) {
          setSelectedRecipientId(users[0].id);
        }
      });
      getActivePromoCodes().then((codes) => {
        setPromoCodes(codes);
      });
    }
  }, [isOpen]);

  const handleAddPromoCode = async () => {
    const codeClean = newCodeName.trim().toUpperCase();
    if (!codeClean) return;

    if (promoCodes.some((c) => c.code === codeClean)) {
      SFX.playError();
      setStatusMsg({ text: `Code '${codeClean}' already exists!`, success: false });
      return;
    }

    const newCodeObj: PromoCode = {
      id: `promo_${Date.now()}`,
      code: codeClean,
      rewardHours: newCodeHours || 1,
      bonusKrests: newCodeKrests || 0,
      description: newCodeDesc.trim() || 'Kreator Special Pass',
      createdAt: Date.now(),
    };

    const updated = [...promoCodes, newCodeObj];
    setPromoCodes(updated);
    await savePromoCodes(updated);
    SFX.playSuccess();
    setStatusMsg({ text: `🎉 Created new Promo Code '${codeClean}'!`, success: true });
    setNewCodeName('');
    setNewCodeDesc('');
  };

  const handleRemovePromoCode = async (id: string, codeName: string) => {
    const updated = promoCodes.filter((c) => c.id !== id);
    setPromoCodes(updated);
    await savePromoCodes(updated);
    SFX.playClick();
    setStatusMsg({ text: `Removed promo code '${codeName}'.`, success: true });
  };

  if (!isOpen) return null;

  // Post Global Announcement
  const handlePostGlobalAnnouncement = async () => {
    if (!announcementText.trim()) return;
    try {
      SFX.playSuccess();
      const announcementDoc: GlobalAnnouncement = {
        id: `announcement_${Date.now()}`,
        sender: user.username || 'Kreator',
        message: announcementText.trim(),
        createdAt: Date.now(),
      };

      await setDoc(doc(db, 'global_announcements', 'latest'), announcementDoc);
      localStorage.setItem('kreational_global_announcement', JSON.stringify(announcementDoc));
      window.dispatchEvent(new Event('announcement_updated'));

      setStatusMsg({ text: '🎉 Global Announcement broadcasted to all players!', success: true });
      setAnnouncementText('');
    } catch (err: any) {
      SFX.playError();
      setStatusMsg({ text: 'Failed to broadcast announcement.', success: false });
    }
  };

  // Clear Announcement
  const handleClearAnnouncement = async () => {
    try {
      await deleteDoc(doc(db, 'global_announcements', 'latest'));
      localStorage.removeItem('kreational_global_announcement');
      window.dispatchEvent(new Event('announcement_updated'));
      setStatusMsg({ text: 'Global announcement cleared.', success: true });
    } catch (e) {}
  };

  // Give Krests to a specific user
  const handleGiveKrests = async () => {
    if (!selectedRecipientId || krestsAmount <= 0) return;
    const targetUser = allUsers.find((u) => u.id === selectedRecipientId);
    if (!targetUser) return;

    try {
      SFX.playCoin();
      const newKrests = (targetUser.krests || 0) + krestsAmount;
      const updatedTargetUser: User = {
        ...targetUser,
        krests: newKrests,
      };

      await saveFullUserAccountToFirestore(updatedTargetUser);

      // If granting to self
      if (targetUser.id === user.id) {
        onUpdateUser(updatedTargetUser);
      }

      triggerNotification(
        '🎁 Kreator Gift!',
        `Kreator granted you +${krestsAmount} Krests!`
      );

      setStatusMsg({
        text: `Successfully granted +${krestsAmount} Krests to ${targetUser.username}!`,
        success: true,
      });
    } catch (err) {
      SFX.playError();
      setStatusMsg({ text: 'Failed to transfer Krests.', success: false });
    }
  };

  // Krest Rain (+500 Krests to ALL users)
  const handleKrestRain = async () => {
    try {
      SFX.playSuccess();
      for (const u of allUsers) {
        const updated = { ...u, krests: (u.krests || 0) + 500 };
        await saveFullUserAccountToFirestore(updated);
      }
      if (user) {
        onUpdateUser({ ...user, krests: (user.krests || 0) + 500 });
      }
      setStatusMsg({ text: '🌧️ Krest Rain Triggered! +500 Krests given to all players!', success: true });
    } catch (e) {}
  };

  const filteredUsers = allUsers.filter(
    (u) =>
      u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-gradient-to-b from-slate-900 via-purple-950/40 to-slate-950 border border-purple-500/40 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-6 bg-gradient-to-r from-purple-950 via-slate-900 to-indigo-950 border-b border-purple-500/30 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-purple-500/20 border border-purple-400/40 text-purple-300 shadow-lg shadow-purple-950/50">
              <Sparkles className="w-6 h-6 animate-spin" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                👑 Kreator Fun Panel
              </h2>
              <p className="text-xs text-purple-200/80 font-medium">
                Admin powers: Broadcast announcements & gift Krests to players!
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              SFX.playClick();
              onClose();
            }}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {statusMsg && (
          <div
            className={`p-3 text-xs font-bold text-center border-b ${
              statusMsg.success
                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                : 'bg-rose-950/80 text-rose-300 border-rose-500/40'
            }`}
          >
            {statusMsg.text}
          </div>
        )}

        <div className="p-4 sm:p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1">
          {/* Section 1: Global Announcement */}
          <div className="p-4 rounded-2xl bg-black/50 border border-purple-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-purple-300 font-bold text-sm">
                <Megaphone className="w-4 h-4 text-purple-400" />
                <span>Global Broadcast Message</span>
              </div>
              <button
                onClick={handleClearAnnouncement}
                className="text-[11px] text-rose-400 hover:text-rose-300 font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
                Clear Active Banner
              </button>
            </div>

            <textarea
              rows={2}
              placeholder="Type message for all online players (e.g., '🎉 KROZE ZONE PARTY LIVE NOW! +1000 KREST BONUS!')"
              value={announcementText}
              onChange={(e) => setAnnouncementText(e.target.value)}
              className="w-full p-3 rounded-xl bg-slate-950/80 border border-purple-500/30 text-white text-xs focus:outline-none focus:border-purple-400 resize-none"
            />

            <button
              onClick={handlePostGlobalAnnouncement}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg cursor-pointer flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              <span>Broadcast Global Message</span>
            </button>
          </div>

          {/* Section 2: Gift Krests */}
          <div className="p-4 rounded-2xl bg-black/50 border border-amber-500/30 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
                <Gift className="w-4 h-4 text-amber-400" />
                <span>Grant Krests to Player</span>
              </div>
              <button
                onClick={handleKrestRain}
                className="px-3 py-1 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-400/40 text-xs font-bold hover:bg-amber-500/30 cursor-pointer flex items-center gap-1"
              >
                <Coins className="w-3.5 h-3.5" />
                <span>Trigger Krest Rain</span>
              </button>
            </div>

            <div className="space-y-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search player username..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-950/80 border border-white/10 text-white text-xs focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-36 overflow-y-auto custom-scrollbar p-1">
                {filteredUsers.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => setSelectedRecipientId(u.id)}
                    className={`p-2 rounded-xl border text-left cursor-pointer transition-all ${
                      selectedRecipientId === u.id
                        ? 'bg-amber-500/20 border-amber-400 text-amber-200 font-bold'
                        : 'bg-slate-950/60 border-white/5 text-slate-300 hover:border-white/20'
                    }`}
                  >
                    <div className="text-xs truncate">{u.username}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{(u.krests || 0)} Krests</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className="text-[11px] text-amber-200/80 font-bold block mb-1">Amount of Krests:</label>
                <input
                  type="number"
                  min={10}
                  step={100}
                  value={krestsAmount}
                  onChange={(e) => setKrestsAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950/90 border border-amber-500/40 text-amber-300 font-mono font-bold text-sm focus:outline-none"
                />
              </div>
              <button
                onClick={handleGiveKrests}
                className="mt-5 px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider cursor-pointer shadow-lg"
              >
                Grant Krests
              </button>
            </div>
          </div>

          {/* Section 3: Manage Promo Codes */}
          <div className="p-4 rounded-2xl bg-black/50 border border-purple-500/30 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-purple-300 font-bold text-sm">
                <KeyRound className="w-4 h-4 text-purple-400" />
                <span>AZGAMES & Krest Promo Codes</span>
              </div>
              <span className="text-[11px] text-purple-300 font-mono">
                {promoCodes.length} Active Codes
              </span>
            </div>

            {/* Create Code Form */}
            <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-500/20 space-y-3">
              <div className="text-xs font-bold text-purple-200">Create New Promo Code</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Code Name (e.g. VIP2026)"
                  value={newCodeName}
                  onChange={(e) => setNewCodeName(e.target.value.toUpperCase())}
                  className="px-3 py-1.5 rounded-lg bg-slate-950 border border-purple-500/40 text-white text-xs font-mono font-bold uppercase focus:outline-none focus:border-purple-300"
                />
                <input
                  type="text"
                  placeholder="Description (optional)"
                  value={newCodeDesc}
                  onChange={(e) => setNewCodeDesc(e.target.value)}
                  className="px-3 py-1.5 rounded-lg bg-slate-950 border border-purple-500/40 text-white text-xs focus:outline-none focus:border-purple-300"
                />
              </div>

              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="text-[10px] text-purple-300 font-bold block mb-1">AZGAMES Hours:</label>
                  <input
                    type="number"
                    min={1}
                    max={168}
                    value={newCodeHours}
                    onChange={(e) => setNewCodeHours(Number(e.target.value))}
                    className="w-full px-2 py-1 rounded-lg bg-slate-950 border border-purple-500/30 text-purple-200 font-mono text-xs focus:outline-none"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] text-purple-300 font-bold block mb-1">Bonus Krests:</label>
                  <input
                    type="number"
                    min={0}
                    step={50}
                    value={newCodeKrests}
                    onChange={(e) => setNewCodeKrests(Number(e.target.value))}
                    className="w-full px-2 py-1 rounded-lg bg-slate-950 border border-purple-500/30 text-amber-300 font-mono text-xs focus:outline-none"
                  />
                </div>
                <button
                  onClick={handleAddPromoCode}
                  className="mt-4 px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs uppercase cursor-pointer flex items-center gap-1 shadow-md"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Code</span>
                </button>
              </div>
            </div>

            {/* List of Active Promo Codes */}
            <div className="space-y-2">
              <div className="text-[11px] font-bold text-slate-400">Active Codes List:</div>
              {promoCodes.length === 0 ? (
                <div className="text-xs text-slate-500 italic p-2 text-center">No active promo codes.</div>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                  {promoCodes.map((c) => (
                    <div
                      key={c.id}
                      className="p-2.5 rounded-xl bg-slate-950/80 border border-purple-500/20 flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-mono font-black text-amber-300 flex items-center gap-2">
                          <span>{c.code}</span>
                          <span className="text-[10px] font-normal text-purple-300 bg-purple-950 px-2 py-0.5 rounded-full border border-purple-500/30">
                            +{c.rewardHours}h AZGAMES {c.bonusKrests ? `| +${c.bonusKrests} Krests` : ''}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400">{c.description}</div>
                      </div>
                      <button
                        onClick={() => handleRemovePromoCode(c.id, c.code)}
                        className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 cursor-pointer transition-colors"
                        title="Delete Promo Code"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
