import React, { useState, useRef } from 'react';
import { User, UserCosmetics, ItemInstance } from '../types';
import { InventoryView } from './InventoryView';
import {
  COSMETICS_CATALOG,
  CosmeticOption,
  getHighestBadgeTitle,
  STREAK_REWARDS_CATALOG,
  applyStreakReward,
  getTodayDateString,
} from '../utils/userProfile';
import {
  X,
  Sparkles,
  Flame,
  Upload,
  Layers,
  Crown,
  Check,
  ShoppingBag,
  Shield,
  Palette,
  Image as ImageIcon,
  UserCheck,
  Gift,
  CheckCircle2,
} from 'lucide-react';
import { SFX } from '../utils/sfx';
import { AvatarCropModal } from './AvatarCropModal';
import { generateQRCodeSVG, getDeterministicFriendCode, formatFriendCode } from '../utils/qrCodeGenerator';
import kreationsLogo from '../assets/images/kreations_sleek_logo_1785626924672.jpg';

interface ProfileModalProps {
  user: User;
  onUpdateUser: (updatedUser: User) => void;
  onClose: () => void;
  onOpenShop: () => void;
  onNavigateToMarketplace?: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  user,
  onUpdateUser,
  onClose,
  onOpenShop,
  onNavigateToMarketplace,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'inventory' | 'streak' | 'backgrounds' | 'frames' | 'titles'>('overview');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [streakClaimMessage, setStreakClaimMessage] = useState<string | null>(null);
  const [pendingRawImage, setPendingRawImage] = useState<string | null>(null);

  const krests = user.krests || 0;
  const iconShards = user.iconShards || 0;
  const streak = user.dailyStreak || 1;
  const currentStreakDay = ((streak - 1) % 7) + 1;
  const todayStr = getTodayDateString();
  const canClaimToday = user.lastClaimedStreakDate !== todayStr;
  const badgeInfo = getHighestBadgeTitle(user);

  const cosmetics: UserCosmetics = user.cosmetics || {
    title: user.role === 'admin' ? 'Kreator Mastermind' : 'Arcade Rookie',
    background: 'bg_neon_cyber',
    avatarFrame: 'frame_default',
    unlockedBackgrounds: ['bg_neon_cyber', 'bg_cosmic_nebula'],
    unlockedFrames: ['frame_default'],
    unlockedTitles: ['Arcade Rookie', 'Glitch Runner'],
  };

  const selectedBgOption =
    COSMETICS_CATALOG.find((c) => c.id === cosmetics.background) || COSMETICS_CATALOG[0];
  const selectedFrameOption =
    COSMETICS_CATALOG.find((c) => c.id === cosmetics.avatarFrame) || COSMETICS_CATALOG[6];

  const handleClaimStreak = () => {
    SFX.playStreakClaim();
    const { updatedUser, rewardMessage } = applyStreakReward(user, streak);
    onUpdateUser(updatedUser);
    setStreakClaimMessage(rewardMessage);
  };

  // Custom Gallery Upload Handler (Allows scaling image before applying)
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (iconShards < 10 && krests < 5000 && user.role !== 'admin') {
      SFX.playError();
      setUploadError('You need 10 Icon Shards or 5,000 Krests to unlock custom photo upload!');
      return;
    }

    if (!file.type.startsWith('image/')) {
      SFX.playError();
      setUploadError('Please select a valid image file (PNG, JPG, WEBP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      SFX.playError();
      setUploadError('Image size is too large (max 5MB). Please pick a smaller image.');
      return;
    }

    setUploadError(null);
    const reader = new FileReader();
    reader.onload = () => {
      SFX.playClick();
      setPendingRawImage(reader.result as string);
    };
    reader.readAsDataURL(file);
    // Reset file input value so user can re-select same file if desired
    e.target.value = '';
  };

  const handleConfirmCroppedAvatar = (
    croppedUrl: string,
    paymentMethod: 'shards' | 'krests' | 'admin'
  ) => {
    let newShards = iconShards;
    let newKrests = krests;

    if (paymentMethod === 'shards') {
      newShards = Math.max(0, iconShards - 10);
    } else if (paymentMethod === 'krests') {
      newKrests = Math.max(0, krests - 5000);
    }

    const updatedUser: User = {
      ...user,
      iconShards: newShards,
      krests: newKrests,
      cosmetics: {
        ...cosmetics,
        customAvatarUrl: croppedUrl,
      },
    };

    onUpdateUser(updatedUser);
    setPendingRawImage(null);
  };

  const handleEquipCosmetic = (option: CosmeticOption) => {
    SFX.playClick();
    let updatedCosmetics: UserCosmetics = { ...cosmetics };

    if (option.type === 'background') {
      updatedCosmetics.background = option.id;
    } else if (option.type === 'frame') {
      updatedCosmetics.avatarFrame = option.id;
    } else if (option.type === 'title') {
      updatedCosmetics.title = option.name;
    }

    const updatedUser: User = {
      ...user,
      cosmetics: updatedCosmetics,
    };

    onUpdateUser(updatedUser);
  };

  return (
    <div id="profile-modal-overlay" className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xl flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn">
      <div
        id="profile-modal-card"
        className="w-full max-w-2xl rounded-3xl bg-slate-950 border border-purple-500/40 shadow-2xl shadow-purple-950/80 overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Profile Card Header Banner (Uses Selected Background Cosmetic) */}
        <div className={`p-6 sm:p-8 ${selectedBgOption.previewClass} relative overflow-hidden transition-all duration-500 shrink-0`}>
          {/* Subtle Grid Overlay */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:16px_16px]" />

          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-xl bg-black/40 hover:bg-black/60 text-slate-300 hover:text-white border border-white/10 transition-colors z-10 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6 text-center sm:text-left">
            {/* Avatar with Selected Frame Cosmetic */}
            <div className="relative shrink-0 group">
              <div className={`w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden bg-slate-900 ${selectedFrameOption.previewClass} transition-all`}>
                <img
                  src={cosmetics.customAvatarUrl || kreationsLogo}
                  alt={user.username}
                  className="w-full h-full object-cover select-none"
                  referrerPolicy="no-referrer"
                />
              </div>

              {/* Gallery Image Upload Trigger Button */}
              <button
                onClick={() => {
                  if (iconShards >= 10 || krests >= 5000 || user.role === 'admin') {
                    fileInputRef.current?.click();
                  } else {
                    setUploadError('Uploading a custom photo requires 10 Icon Shards or 5,000 Krests!');
                  }
                }}
                className="absolute -bottom-2 -right-2 p-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white border border-white/20 shadow-lg shadow-purple-950/80 transition-all cursor-pointer group-hover:scale-110"
                title="Scale & Upload Profile Photo (Costs 10 Shards or 5,000 Krests)"
              >
                <Upload className="w-3.5 h-3.5" />
              </button>

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageUpload}
                accept="image/*"
                className="hidden"
              />
            </div>

            {/* User Main Identity Info */}
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <h2 className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight truncate">
                  {user.username}
                </h2>

                {/* Badge Badge */}
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold uppercase border flex items-center gap-1 ${badgeInfo.color}`}>
                  <span>{badgeInfo.icon}</span>
                  <span>{badgeInfo.name}</span>
                </span>
              </div>

              {/* Equipped Title */}
              <p className="text-sm font-bold text-purple-300 font-mono tracking-wide">
                « {cosmetics.title} »
              </p>

              {/* Streak & Currency Pills */}
              <div className="pt-2 flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <div className="px-3 py-1 rounded-xl bg-orange-500/20 border border-orange-500/40 text-orange-300 text-xs font-mono font-bold flex items-center gap-1.5 shadow-md">
                  <Flame className="w-4 h-4 text-orange-400 animate-pulse" />
                  <span>{streak} Day Streak</span>
                </div>

                <div className="px-3 py-1 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-mono font-bold flex items-center gap-1.5 shadow-md">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>{krests} Krests</span>
                </div>

                <div className="px-3 py-1 rounded-xl bg-purple-500/20 border border-purple-500/40 text-purple-200 text-xs font-mono font-bold flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-purple-400" />
                  <span>{iconShards} / 10 Shards</span>
                </div>
              </div>
            </div>

            {/* Kroze Friend QR Code & 10-Digit ID Panel */}
            <div className="p-3 rounded-2xl bg-black/60 border border-rose-500/30 flex flex-col items-center text-center space-y-1 shadow-inner shrink-0 self-center sm:self-start">
              <div
                className="w-24 h-24"
                dangerouslySetInnerHTML={{
                  __html: generateQRCodeSVG(getDeterministicFriendCode(user.id), 120),
                }}
              />
              <span className="font-mono text-xs text-amber-300 font-extrabold tracking-wider">
                {formatFriendCode(getDeterministicFriendCode(user.id))}
              </span>
              <span className="text-[9px] text-purple-200/70 font-semibold">Kroze Friend Code</span>
            </div>
          </div>
        </div>

        {/* Upload error warning if any */}
        {uploadError && (
          <div className="mx-6 mt-3 p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs font-semibold flex items-center justify-between">
            <span>{uploadError}</span>
            <button onClick={() => setUploadError(null)} className="text-rose-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="px-6 pt-3 bg-slate-900/60 border-b border-white/10 flex items-center justify-between shrink-0 overflow-x-auto">
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                SFX.playClick();
                setActiveTab('overview');
              }}
              className={`px-3.5 py-2.5 rounded-t-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'overview'
                  ? 'bg-purple-600/30 text-white border-t border-x border-purple-500/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <UserCheck className="w-4 h-4" />
              <span>Overview</span>
            </button>

            <button
              onClick={() => {
                SFX.playClick();
                setActiveTab('inventory');
              }}
              className={`px-3.5 py-2.5 rounded-t-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'inventory'
                  ? 'bg-purple-600/30 text-white border-t border-x border-purple-500/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Gift className="w-4 h-4 text-purple-400" />
              <span>Inventory</span>
              {user.inventory && user.inventory.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-mono">
                  {user.inventory.length}
                </span>
              )}
            </button>

            <button
              onClick={() => {
                SFX.playClick();
                setActiveTab('streak');
              }}
              className={`px-3.5 py-2.5 rounded-t-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'streak'
                  ? 'bg-orange-600/30 text-orange-200 border-t border-x border-orange-500/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Flame className="w-4 h-4 text-orange-400" />
              <span>Streak Rewards</span>
            </button>

            <button
              onClick={() => {
                SFX.playClick();
                setActiveTab('backgrounds');
              }}
              className={`px-3.5 py-2.5 rounded-t-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'backgrounds'
                  ? 'bg-purple-600/30 text-white border-t border-x border-purple-500/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Palette className="w-4 h-4" />
              <span>Backgrounds</span>
            </button>

            <button
              onClick={() => {
                SFX.playClick();
                setActiveTab('frames');
              }}
              className={`px-3.5 py-2.5 rounded-t-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'frames'
                  ? 'bg-purple-600/30 text-white border-t border-x border-purple-500/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Shield className="w-4 h-4" />
              <span>Frames</span>
            </button>

            <button
              onClick={() => {
                SFX.playClick();
                setActiveTab('titles');
              }}
              className={`px-3.5 py-2.5 rounded-t-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'titles'
                  ? 'bg-purple-600/30 text-white border-t border-x border-purple-500/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Crown className="w-4 h-4" />
              <span>Titles</span>
            </button>
          </div>

          <button
            onClick={() => {
              SFX.playClick();
              onClose();
              onOpenShop();
            }}
            className="px-3.5 py-1.5 mb-1 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
          >
            <ShoppingBag className="w-3.5 h-3.5 text-amber-400" />
            <span>Visit Shop</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {/* Claim message banner */}
          {streakClaimMessage && (
            <div className="p-3.5 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs font-bold font-mono flex items-center gap-2 animate-fadeIn shadow-lg shadow-emerald-950/50">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>{streakClaimMessage}</span>
            </div>
          )}

          {activeTab === 'inventory' && (
            <InventoryView
              user={user}
              onUpdateUser={onUpdateUser}
              onNavigateToMarketplace={() => {
                onClose();
                if (onNavigateToMarketplace) onNavigateToMarketplace();
              }}
            />
          )}

          {activeTab === 'overview' && (
            <div className="space-y-4">
              {/* Daily Streak Highlight Banner */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-orange-950/60 via-amber-950/40 to-slate-950 border border-orange-500/40 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-orange-500/20 border border-orange-500/40 text-orange-400">
                    <Flame className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-2 font-mono">
                      <span>Daily Streak: Day {currentStreakDay} / 7</span>
                    </h4>
                    <p className="text-xs text-orange-200/90 mt-0.5">
                      Log in daily to earn Krests, Krates, Icon Shards, Badges, and Titles!
                    </p>
                  </div>
                </div>

                {canClaimToday ? (
                  <button
                    onClick={handleClaimStreak}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-slate-950 font-black text-xs cursor-pointer shadow-lg shadow-orange-950/80 animate-bounce shrink-0"
                  >
                    Claim Day {currentStreakDay} Reward!
                  </button>
                ) : (
                  <span className="px-3 py-1.5 rounded-xl bg-slate-800 border border-white/10 text-slate-400 font-mono text-xs font-bold shrink-0">
                    Day {currentStreakDay} Claimed!
                  </span>
                )}
              </div>

              {/* Custom Profile Picture Status Card */}
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      <ImageIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">Custom Profile Photo</h4>
                      <p className="text-xs text-slate-400">
                        Upload custom image from your device gallery (Requires 10 Icon Shards)
                      </p>
                    </div>
                  </div>

                  {iconShards >= 10 || user.role === 'admin' ? (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md shadow-purple-950/60"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Select File</span>
                    </button>
                  ) : (
                    <span className="px-3 py-1 rounded-lg bg-slate-800 text-slate-400 font-mono text-xs border border-white/10">
                      {iconShards} / 10 Shards
                    </span>
                  )}
                </div>

                {/* Progress bar for shards */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-mono text-slate-400">
                    <span>Icon Shards Collected</span>
                    <span>{iconShards} / 10 Shards</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden border border-white/10">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 to-indigo-400 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, (iconShards / 10) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Tiers & Account Badges */}
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2">
                <h4 className="text-xs font-mono font-bold text-purple-300 uppercase tracking-wider">
                  Unlocked Tier Access
                </h4>
                <div className="flex flex-wrap gap-2 pt-1">
                  {(user.purchasedTiers || ['bronze']).map((tierId) => (
                    <span
                      key={tierId}
                      className="px-3 py-1 rounded-xl bg-purple-500/20 border border-purple-500/40 text-purple-200 text-xs font-mono font-bold uppercase"
                    >
                      {tierId} Tier
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 7-Day Streak Rewards Tab */}
          {activeTab === 'streak' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-gradient-to-r from-orange-950/80 via-purple-950/60 to-slate-950 border border-orange-500/40 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-orange-500/20 border border-orange-500/40 text-orange-400">
                    <Flame className="w-8 h-8 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white font-mono flex items-center gap-2">
                      <span>7-Day Daily Streak Roadmap</span>
                      <span className="px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300 text-xs border border-orange-500/40">
                        Day {currentStreakDay} Active
                      </span>
                    </h3>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Keep your login streak alive! Miss a day and your streak resets back to Day 1.
                    </p>
                  </div>
                </div>

                {canClaimToday ? (
                  <button
                    onClick={handleClaimStreak}
                    className="w-full sm:w-auto py-2.5 px-5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-slate-950 font-black text-xs cursor-pointer shadow-lg shadow-orange-950/80 animate-bounce shrink-0"
                  >
                    Claim Day {currentStreakDay} Reward
                  </button>
                ) : (
                  <span className="px-4 py-2 rounded-xl bg-slate-800 border border-white/10 text-emerald-400 font-mono text-xs font-bold flex items-center gap-1.5 shrink-0">
                    <CheckCircle2 className="w-4 h-4" /> Day {currentStreakDay} Claimed!
                  </span>
                )}
              </div>

              {/* 7 Day Roadmap Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {STREAK_REWARDS_CATALOG.map((item) => {
                  const isCurrentDay = currentStreakDay === item.day;
                  const isPassed = currentStreakDay > item.day || (!canClaimToday && currentStreakDay === item.day);

                  return (
                    <div
                      key={item.day}
                      className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 transition-all ${
                        isCurrentDay
                          ? 'bg-gradient-to-r from-orange-950/80 to-amber-950/60 border-orange-400 shadow-lg shadow-orange-950/60 ring-1 ring-orange-400/50'
                          : isPassed
                          ? 'bg-slate-900/40 border-white/10 text-slate-400'
                          : 'bg-white/[0.02] border-white/10 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl font-bold ${
                            isCurrentDay
                              ? 'bg-orange-500/30 border border-orange-400 text-amber-200'
                              : isPassed
                              ? 'bg-slate-800 border border-white/10 text-slate-500'
                              : 'bg-white/5 border border-white/10 text-slate-300'
                          }`}
                        >
                          {item.icon}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono font-bold text-orange-400 uppercase">
                              Day {item.day}
                            </span>
                            {isCurrentDay && canClaimToday && (
                              <span className="px-1.5 py-0.2 rounded bg-amber-400 text-slate-950 text-[9px] font-black uppercase tracking-wider animate-pulse">
                                READY!
                              </span>
                            )}
                          </div>
                          <h4 className="text-xs font-bold text-white">{item.title}</h4>
                          <p className="text-[10px] text-slate-400 leading-tight">{item.description}</p>
                        </div>
                      </div>

                      {isPassed && (
                        <div className="p-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                          <Check className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Backgrounds Locker */}
          {activeTab === 'backgrounds' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {COSMETICS_CATALOG.filter((c) => c.type === 'background').map((bg) => {
                const isUnlocked = cosmetics.unlockedBackgrounds?.includes(bg.id);
                const isEquipped = cosmetics.background === bg.id;

                return (
                  <div
                    key={bg.id}
                    className={`p-4 rounded-2xl ${bg.previewClass} border relative flex items-center justify-between transition-all`}
                  >
                    <div>
                      <h4 className="text-sm font-bold text-white">{bg.name}</h4>
                      <span className="text-[10px] uppercase font-mono text-purple-300">
                        {bg.rarity}
                      </span>
                    </div>

                    {isEquipped ? (
                      <span className="px-3 py-1 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Equipped
                      </span>
                    ) : isUnlocked ? (
                      <button
                        onClick={() => handleEquipCosmetic(bg)}
                        className="px-3 py-1 rounded-xl bg-white/20 hover:bg-white/30 text-white font-bold text-xs transition-all cursor-pointer"
                      >
                        Equip
                      </button>
                    ) : (
                      <span className="text-xs font-mono text-slate-400">In Krates</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Avatar Frames Locker */}
          {activeTab === 'frames' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {COSMETICS_CATALOG.filter((c) => c.type === 'frame').map((frame) => {
                const isUnlocked = cosmetics.unlockedFrames?.includes(frame.id);
                const isEquipped = cosmetics.avatarFrame === frame.id;

                return (
                  <div
                    key={frame.id}
                    className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl bg-slate-900 ${frame.previewClass} overflow-hidden shrink-0`}>
                        <img src={kreationsLogo} alt="Preview" className="w-full h-full object-cover" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white">{frame.name}</h4>
                        <span className="text-[10px] uppercase font-mono text-purple-300">{frame.rarity}</span>
                      </div>
                    </div>

                    {isEquipped ? (
                      <span className="px-3 py-1 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Equipped
                      </span>
                    ) : isUnlocked ? (
                      <button
                        onClick={() => handleEquipCosmetic(frame)}
                        className="px-3 py-1 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs cursor-pointer transition-all"
                      >
                        Equip
                      </button>
                    ) : (
                      <span className="text-xs font-mono text-slate-500">In Krates</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Titles Locker */}
          {activeTab === 'titles' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {COSMETICS_CATALOG.filter((c) => c.type === 'title').map((titleItem) => {
                const isUnlocked = cosmetics.unlockedTitles?.includes(titleItem.name);
                const isEquipped = cosmetics.title === titleItem.name;

                return (
                  <div
                    key={titleItem.id}
                    className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-between"
                  >
                    <div>
                      <h4 className={`text-xs font-bold ${titleItem.previewClass}`}>
                        « {titleItem.name} »
                      </h4>
                      <span className="text-[10px] uppercase font-mono text-slate-400">{titleItem.rarity}</span>
                    </div>

                    {isEquipped ? (
                      <span className="px-3 py-1 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Equipped
                      </span>
                    ) : isUnlocked ? (
                      <button
                        onClick={() => handleEquipCosmetic(titleItem)}
                        className="px-3 py-1 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs cursor-pointer transition-all"
                      >
                        Equip
                      </button>
                    ) : (
                      <span className="text-xs font-mono text-slate-500">Locked</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Interactive Avatar Scaling & Cropping Modal */}
      {pendingRawImage && (
        <AvatarCropModal
          imageSrc={pendingRawImage}
          user={user}
          onConfirm={handleConfirmCroppedAvatar}
          onClose={() => setPendingRawImage(null)}
        />
      )}
    </div>
  );
};
