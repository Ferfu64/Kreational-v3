import React, { useState, useEffect, useRef } from 'react';
import {
  User,
  ItemInstance,
  MarketplaceListing,
  MarketplaceHistoryEntry,
  ItemRarity,
} from '../types';
import {
  Store,
  Sparkles,
  Gavel,
  History,
  Tag,
  PlusCircle,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Shield,
  Zap,
  Ticket,
  Dices,
  Key,
  ArrowRight,
  TrendingUp,
  Award,
  LogOut,
  Star,
  Lock,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
} from 'lucide-react';
import { SFX } from '../utils/sfx';
import {
  fetchAllListings,
  subscribeToListings,
  subscribeToHistory,
  createListingInStore,
  placeBidInStore,
  buyNowInStore,
  cashOutListingInStore,
  cancelListingInStore,
  fetchMarketplaceHistory,
} from '../services/marketplaceStore';
import { runBotMarketplaceSimulation, getItemEstimatedValue } from '../services/marketplaceBots';

interface MarketplacePageProps {
  user: User;
  onUpdateUser: (updatedUser: User) => void;
  onNavigateHome?: () => void;
}

const RARITY_THEMES: Record<
  ItemRarity,
  { bg: string; border: string; text: string; badge: string; glow: string }
> = {
  common: {
    bg: 'bg-slate-900/90',
    border: 'border-slate-800',
    text: 'text-slate-300',
    badge: 'bg-slate-800 text-slate-300 border-slate-600',
    glow: 'shadow-slate-950/40',
  },
  uncommon: {
    bg: 'bg-emerald-950/80',
    border: 'border-emerald-600/60',
    text: 'text-emerald-300',
    badge: 'bg-emerald-900 text-emerald-200 border-emerald-600 font-semibold',
    glow: 'shadow-emerald-950/50',
  },
  rare: {
    bg: 'bg-blue-950/80',
    border: 'border-blue-500/60',
    text: 'text-blue-300',
    badge: 'bg-blue-900 text-blue-200 border-blue-600 font-semibold',
    glow: 'shadow-blue-950/50',
  },
  epic: {
    bg: 'bg-purple-950/80',
    border: 'border-purple-500/60',
    text: 'text-purple-300',
    badge: 'bg-purple-900 text-purple-200 border-purple-500 font-bold',
    glow: 'shadow-purple-950/60',
  },
  legendary: {
    bg: 'bg-amber-950/80',
    border: 'border-amber-500/80',
    text: 'text-amber-300',
    badge: 'bg-amber-900 text-amber-200 border-amber-400 font-extrabold',
    glow: 'shadow-amber-950/80 ring-1 ring-amber-500/30',
  },
};

export const MarketplacePage: React.FC<MarketplacePageProps> = ({
  user,
  onUpdateUser,
  onNavigateHome,
}) => {
  const [activeTab, setActiveTab] = useState<'browse' | 'limited' | 'my-listings' | 'my-bids' | 'history'>(
    'browse'
  );
  const [viewMode, setViewMode] = useState<'horizontal' | 'grid'>('horizontal');
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [history, setHistory] = useState<MarketplaceHistoryEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterRarity, setFilterRarity] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'highest' | 'lowest'>('newest');

  // Modal states
  const [biddingListing, setBiddingListing] = useState<MarketplaceListing | null>(null);
  const [proposedBidAmount, setProposedBidAmount] = useState<number>(0);
  const [cashOutListingModal, setCashOutListingModal] = useState<MarketplaceListing | null>(null);
  const [isCreateListingOpen, setIsCreateListingOpen] = useState<boolean>(false);

  // Listing creation state
  const [selectedInventoryItem, setSelectedInventoryItem] = useState<ItemInstance | null>(null);
  const [startingBidInput, setStartingBidInput] = useState<number>(50);
  const [isLimitedInput, setIsLimitedInput] = useState<boolean>(false);

  // Status message
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const availableKrests = Math.max(0, (user.krests || 0) - (user.reservedKrests || 0));

  const listingsRef = useRef<MarketplaceListing[]>([]);
  listingsRef.current = listings;

  // Real-time Firestore subscription for listings & history
  useEffect(() => {
    setLoading(true);

    const unsubscribeListings = subscribeToListings((updatedListings) => {
      setListings(updatedListings);
      setLoading(false);
    });

    const unsubscribeHistory = subscribeToHistory((updatedHistory) => {
      setHistory(updatedHistory);
    });

    let isMounted = true;
    let timerId: NodeJS.Timeout;

    const runRandomBotTick = () => {
      const delay = Math.floor(Math.random() * 99000) + 1000; // 1 to 100 seconds
      timerId = setTimeout(async () => {
        if (!isMounted) return;
        try {
          await runBotMarketplaceSimulation(
            listingsRef.current,
            createListingInStore,
            placeBidInStore,
            cashOutListingInStore
          );
        } catch (e) {}
        if (isMounted) runRandomBotTick();
      }, delay);
    };

    runRandomBotTick();

    return () => {
      isMounted = false;
      unsubscribeListings();
      unsubscribeHistory();
      clearTimeout(timerId);
    };
  }, []);

  // Filter & Sort active listings
  const activeListings = listings.filter((l) => l.status === 'active');

  const featuredListings = activeListings
    .filter((l) => ['legendary', 'epic', 'rare'].includes(l.itemInstance.rarity) || l.currentBid >= 100)
    .slice(0, 8);

  const filteredListings = activeListings
    .filter((l) => {
      if (searchQuery.trim() !== '') {
        const queryLower = searchQuery.toLowerCase();
        const matchesName = l.itemInstance.name.toLowerCase().includes(queryLower);
        const matchesSeller = l.sellerUsername.toLowerCase().includes(queryLower);
        if (!matchesName && !matchesSeller) return false;
      }
      if (filterRarity !== 'all' && l.itemInstance.rarity !== filterRarity) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'highest') return b.currentBid - a.currentBid;
      if (sortBy === 'lowest') return a.currentBid - b.currentBid;
      return b.createdAt - a.createdAt; // newest
    });

  // User specific subsets
  const myListings = activeListings.filter((l) => l.sellerId === user.id);
  const myActiveBidsListings = activeListings.filter(
    (l) => l.bidHistory && l.bidHistory.some((b) => b.bidderId === user.id)
  );

  // Scroll helpers for horizontal stand track
  const scrollLeft = () => {
    SFX.playClick();
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -320, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    SFX.playClick();
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 320, behavior: 'smooth' });
    }
  };

  // Render individual Merchant Stand Card
  const renderStandCard = (listing: MarketplaceListing, widthClass = 'w-72 sm:w-80 shrink-0 snap-start') => {
    const theme = RARITY_THEMES[listing.itemInstance.rarity] || RARITY_THEMES.common;
    const isOwner = listing.sellerId === user.id;
    const isWinning = listing.highestBidderId === user.id;

    return (
      <div
        key={listing.id}
        className={`${widthClass} p-4 rounded-3xl ${theme.bg} border ${theme.border} ${theme.glow} transition-all space-y-3 relative flex flex-col justify-between h-full shadow-xl hover:border-amber-400/50 group`}
      >
        {/* Vendor Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="p-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
              <Store className="w-3.5 h-3.5" />
            </div>
            <span className="font-bold text-xs text-amber-200 truncate">
              Seller: {listing.sellerUsername}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {listing.isLimited && (
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] font-mono font-bold flex items-center gap-0.5">
                <Lock className="w-2.5 h-2.5 text-amber-400" />
                LIMITED
              </span>
            )}
            {isOwner && (
              <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[9px] font-mono font-bold">
                YOUR LISTING
              </span>
            )}
            {isWinning && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9px] font-mono font-bold animate-pulse">
                WINNING
              </span>
            )}
          </div>
        </div>

        {/* Item Content */}
        <div className="text-center py-2 space-y-1.5">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-black/60 border border-white/10 flex items-center justify-center text-3xl shadow-inner group-hover:scale-105 transition-transform">
            {listing.itemInstance.icon}
          </div>
          <div>
            <h3 className="font-bold text-white text-sm truncate leading-tight">
              {listing.itemInstance.name}
            </h3>
            <span className={`inline-block mt-1 px-2 py-0.5 rounded-md text-[9px] uppercase border ${theme.badge}`}>
              {listing.itemInstance.rarity}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 line-clamp-2 px-1 leading-normal">
            {listing.itemInstance.description}
          </p>
        </div>

        {/* Price / Bid Stats */}
        <div className="p-2.5 rounded-2xl bg-black/60 border border-white/10 space-y-1 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-[11px]">{listing.isLimited ? 'Current Bid:' : 'Price:'}</span>
            <span className="font-mono font-extrabold text-amber-300 text-sm">
              {listing.currentBid || listing.startingBid} Krests
            </span>
          </div>
          <div className="flex items-center justify-between text-[10px] text-cyan-300/90 font-mono">
            <span>Est. Valuation:</span>
            <span className="font-bold">~{getItemEstimatedValue(listing.itemInstance)} Krests</span>
          </div>
          {listing.isLimited && (
            <div className="flex items-center justify-between text-[10px] text-slate-400">
              <span>Highest Bidder:</span>
              <span className="font-bold text-purple-300 truncate max-w-[100px]">
                {listing.highestBidderUsername || 'No bids yet'}
              </span>
            </div>
          )}
        </div>

        {/* Action Button */}
        <div>
          {isOwner ? (
            <div className="flex items-center gap-1.5">
              {listing.highestBidderId ? (
                <button
                  onClick={() => setCashOutListingModal(listing)}
                  className="w-full py-2 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Cash Out ({listing.currentBid})</span>
                </button>
              ) : (
                <button
                  onClick={() => handleCancelListing(listing.id)}
                  className="w-full py-2 rounded-xl font-semibold text-xs bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-600/50 cursor-pointer"
                >
                  Cancel Listing
                </button>
              )}
            </div>
          ) : listing.isLimited ? (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleBuyNow(listing)}
                className="py-2.5 rounded-xl font-black text-xs bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-950/50 transition-all cursor-pointer flex items-center justify-center gap-1 uppercase tracking-wider"
                title="Instantly buy this limited edition item"
              >
                <Tag className="w-3.5 h-3.5" />
                <span>Buy ({listing.currentBid || listing.startingBid})</span>
              </button>
              <button
                onClick={() => handleOpenBidModal(listing)}
                className="py-2.5 rounded-xl font-black text-xs bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-950/50 transition-all cursor-pointer flex items-center justify-center gap-1 uppercase tracking-wider"
                title="Place a higher auction bid"
              >
                <Gavel className="w-3.5 h-3.5" />
                <span>Bid</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => handleBuyNow(listing)}
              className="w-full py-2.5 rounded-xl font-black text-xs bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-950/50 transition-all cursor-pointer flex items-center justify-center gap-1.5 uppercase tracking-wide"
            >
              <Tag className="w-3.5 h-3.5" />
              <span>Buy Now ({listing.currentBid || listing.startingBid} Krests)</span>
            </button>
          )}
        </div>
      </div>
    );
  };

  // Direct Buy Handler
  const handleBuyNow = async (listing: MarketplaceListing) => {
    try {
      const { updatedBuyer } = await buyNowInStore(user, listing.id);
      SFX.playCoin();
      onUpdateUser(updatedBuyer);
      setStatusMessage({
        text: `Successfully bought ${listing.itemInstance.name} for ${listing.currentBid || listing.startingBid} Krests!`,
        type: 'success',
      });
    } catch (err: any) {
      SFX.playError();
      setStatusMessage({ text: err.message || 'Failed to buy item.', type: 'error' });
    }
  };

  // Handle Open Bid Modal
  const handleOpenBidModal = (listing: MarketplaceListing) => {
    const minBid = listing.highestBidderId
      ? Math.ceil((listing.currentBid + 10) / 10) * 10
      : Math.ceil((listing.startingBid || 10) / 10) * 10;
    setProposedBidAmount(minBid);
    setBiddingListing(listing);
  };

  // Submit Bid
  const handleConfirmBid = async () => {
    if (!biddingListing) return;
    try {
      const { updatedBidder, updatedListing } = await placeBidInStore(
        user,
        biddingListing.id,
        proposedBidAmount
      );
      SFX.playCoin();
      onUpdateUser(updatedBidder);
      setStatusMessage({
        text: `Bid of ${proposedBidAmount} Krests successfully placed on ${biddingListing.itemInstance.name}!`,
        type: 'success',
      });
      setBiddingListing(null);
    } catch (err: any) {
      SFX.playError();
      setStatusMessage({ text: err.message || 'Failed to place bid.', type: 'error' });
    }
  };

  // Submit Cash Out
  const handleConfirmCashOut = async () => {
    if (!cashOutListingModal) return;
    try {
      const { updatedSeller } = await cashOutListingInStore(user, cashOutListingModal.id);
      SFX.playSuccess();
      onUpdateUser(updatedSeller);
      setStatusMessage({
        text: `Cashed out ${cashOutListingModal.itemInstance.name} for ${cashOutListingModal.currentBid} Krests!`,
        type: 'success',
      });
      setCashOutListingModal(null);
    } catch (err: any) {
      SFX.playError();
      setStatusMessage({ text: err.message || 'Cash out failed.', type: 'error' });
    }
  };

  // Cancel Listing
  const handleCancelListing = async (listingId: string) => {
    if (!window.confirm('Are you sure you want to cancel this listing?')) return;
    try {
      const { updatedSeller } = await cancelListingInStore(user, listingId);
      SFX.playSuccess();
      onUpdateUser(updatedSeller);
      setStatusMessage({ text: 'Listing cancelled successfully.', type: 'success' });
    } catch (err: any) {
      SFX.playError();
      setStatusMessage({ text: err.message || 'Cancel failed.', type: 'error' });
    }
  };

  // Submit Create Listing
  const handleConfirmCreateListing = async () => {
    if (!selectedInventoryItem) {
      setStatusMessage({ text: 'Please select an item from your inventory.', type: 'error' });
      return;
    }
    if (startingBidInput < 1) {
      setStatusMessage({ text: 'Starting bid must be at least 1 Krest.', type: 'error' });
      return;
    }

    try {
      const { updatedSeller } = await createListingInStore(
        user,
        selectedInventoryItem,
        startingBidInput,
        isLimitedInput
      );
      SFX.playSuccess();
      onUpdateUser(updatedSeller);
      setStatusMessage({
        text: `Successfully listed ${selectedInventoryItem.name}${isLimitedInput ? ' (Limited Edition)' : ''} on the Marketplace for starting bid of ${startingBidInput} Krests!`,
        type: 'success',
      });
      setIsCreateListingOpen(false);
      setSelectedInventoryItem(null);
      setIsLimitedInput(false);
    } catch (err: any) {
      SFX.playError();
      setStatusMessage({ text: err.message || 'Failed to list item.', type: 'error' });
    }
  };

  const unlistedInventory = (user.inventory || []).filter((i) => !i.isListed && i.tradable);

  return (
    <div id="kreational-marketplace-page" className="min-h-screen bg-slate-950 text-white pb-20">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-purple-950 via-slate-900 to-amber-950 border-b border-purple-500/30 sticky top-0 z-30 backdrop-blur-xl shadow-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            {/* Title & Brand */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  SFX.playClick();
                  if (onNavigateHome) onNavigateHome();
                }}
                className="px-3.5 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/40 text-xs font-bold flex items-center gap-2 cursor-pointer shadow-lg transition-all shrink-0"
                title="Return to Main Kreational App"
              >
                <LogOut className="w-4 h-4 text-rose-400 rotate-180" />
                <span>Exit to Kreational</span>
              </button>

              <div>
                <div className="flex items-center gap-2">
                  <Store className="w-6 h-6 text-amber-400 animate-pulse" />
                  <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white uppercase font-mono">
                    KREATIONAL MARKETPLACE
                  </h1>
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  Player-to-Player Tool & Power-Up Marketplace
                </p>
              </div>
            </div>

            {/* Krests Balance & Bids Breakdown Box */}
            <div className="flex items-center gap-3 bg-black/60 p-2.5 rounded-2xl border border-amber-500/40 backdrop-blur-md">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <div>
                  <span className="text-[10px] text-amber-300/80 font-mono block leading-none">TOTAL BALANCE</span>
                  <span className="font-mono font-bold text-sm text-amber-300">{user.krests || 0} Krests</span>
                </div>
              </div>

              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/30">
                <Gavel className="w-4 h-4 text-purple-400" />
                <div>
                  <span className="text-[10px] text-purple-300/80 font-mono block leading-none">IN ACTIVE BIDS</span>
                  <span className="font-mono font-bold text-sm text-purple-300">{user.reservedKrests || 0} Held</span>
                </div>
              </div>

              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <div>
                  <span className="text-[10px] text-emerald-300/80 font-mono block leading-none">AVAILABLE TO BID</span>
                  <span className="font-mono font-bold text-sm text-emerald-300">{availableKrests} Krests</span>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Sub-Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto mt-4 pt-2 border-t border-white/10 no-scrollbar">
            <button
              onClick={() => {
                SFX.playClick();
                setActiveTab('browse');
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'browse'
                  ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-950/60 font-black border border-amber-300'
                  : 'bg-slate-900/80 text-amber-300/80 hover:text-amber-200 border border-white/5'
              }`}
            >
              <Store className="w-4 h-4 text-amber-400" />
              <span>All Listings</span>
              <span className="px-2 py-0.5 rounded-full bg-black/40 text-[10px] font-mono text-white">
                {activeListings.length}
              </span>
            </button>

            <button
              onClick={() => {
                SFX.playClick();
                setActiveTab('limited');
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'limited'
                  ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-950/60 font-black border border-amber-300'
                  : 'bg-slate-900/80 text-amber-300/80 hover:text-amber-200 border border-white/5'
              }`}
            >
              <Lock className="w-4 h-4 text-amber-400" />
              <span>Limited Auctions</span>
              <span className="px-2 py-0.5 rounded-full bg-black/40 text-[10px] font-mono">
                {activeListings.filter((l) => l.isLimited).length}
              </span>
            </button>

            <button
              onClick={() => {
                SFX.playClick();
                setActiveTab('my-listings');
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'my-listings'
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-950/60 border border-purple-400'
                  : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-white/5'
              }`}
            >
              <Tag className="w-4 h-4 text-purple-300" />
              <span>My Listings</span>
              <span className="px-2 py-0.5 rounded-full bg-black/40 text-[10px] font-mono">
                {myListings.length}
              </span>
            </button>

            <button
              onClick={() => {
                SFX.playClick();
                setActiveTab('my-bids');
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'my-bids'
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-950/60 border border-purple-400'
                  : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-white/5'
              }`}
            >
              <Gavel className="w-4 h-4 text-amber-400" />
              <span>My Bids</span>
              <span className="px-2 py-0.5 rounded-full bg-black/40 text-[10px] font-mono">
                {myActiveBidsListings.length}
              </span>
            </button>

            <button
              onClick={() => {
                SFX.playClick();
                setActiveTab('history');
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'history'
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-950/60 border border-purple-400'
                  : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-white/5'
              }`}
            >
              <History className="w-4 h-4 text-blue-400" />
              <span>Marketplace History</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Status Toast Message */}
        {statusMessage && (
          <div
            className={`p-4 rounded-2xl border text-xs font-bold flex items-center justify-between shadow-xl animate-fade-in ${
              statusMessage.type === 'success'
                ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-200'
                : 'bg-rose-950/80 border-rose-600/60 text-rose-200'
            }`}
          >
            <span>{statusMessage.text}</span>
            <button
              onClick={() => setStatusMessage(null)}
              className="px-2 py-1 rounded bg-black/40 hover:bg-black/60 text-white cursor-pointer ml-3"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* TAB 1: BROWSE & LIMITED STAND ALLEY */}
        {(activeTab === 'browse' || activeTab === 'limited') && (
          <div className="space-y-6">
            {/* Search & Filter Toolbar */}
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/10 flex flex-col md:flex-row items-center justify-between gap-4 shadow-lg">
              <div className="relative w-full md:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search item name or seller..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-xl bg-black/60 border border-white/10 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto no-scrollbar">
                <div className="flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <select
                    value={filterRarity}
                    onChange={(e) => setFilterRarity(e.target.value)}
                    className="bg-black/60 border border-white/10 text-slate-200 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-purple-500 cursor-pointer"
                  >
                    <option value="all">All Rarities</option>
                    <option value="common">Common</option>
                    <option value="uncommon">Uncommon</option>
                    <option value="rare">Rare</option>
                    <option value="epic">Epic</option>
                    <option value="legendary">Legendary</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="bg-black/60 border border-white/10 text-slate-200 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-purple-500 cursor-pointer"
                  >
                    <option value="newest">Newest First</option>
                    <option value="highest">Highest Bid</option>
                    <option value="lowest">Lowest Bid</option>
                  </select>
                </div>

                <button
                  onClick={() => setIsCreateListingOpen(true)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>+ List Item</span>
                </button>
              </div>
            </div>

            {/* Stand Alley Header & Layout Switcher */}
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-amber-500/30 flex items-center justify-between shadow-xl gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30">
                  <Store className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h2 className="text-base font-black text-white uppercase font-mono tracking-wide flex items-center gap-2">
                    <span>{activeTab === 'limited' ? 'LIMITED EDITION AUCTIONS' : 'MARKETPLACE LISTINGS'}</span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    Explore active tool power-up listings and auctions from players and sellers.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {/* View Mode Toggle */}
                <div className="flex items-center bg-black/60 p-1 rounded-xl border border-white/10">
                  <button
                    onClick={() => {
                      SFX.playClick();
                      setViewMode('horizontal');
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
                      viewMode === 'horizontal' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Track (Scroll)</span>
                  </button>
                  <button
                    onClick={() => {
                      SFX.playClick();
                      setViewMode('grid');
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
                      viewMode === 'grid' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Grid View</span>
                  </button>
                </div>

                {/* Left / Right Scroll Buttons for Horizontal Track */}
                {viewMode === 'horizontal' && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={scrollLeft}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/10 text-slate-200 cursor-pointer shadow-md transition-all active:scale-95"
                      title="Scroll Left"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      onClick={scrollRight}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/10 text-slate-200 cursor-pointer shadow-md transition-all active:scale-95"
                      title="Scroll Right"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Listing Track or Grid */}
            {loading ? (
              <div className="p-12 text-center text-slate-400 text-sm">
                Loading active listings...
              </div>
            ) : (
              (() => {
                const displayListings = activeTab === 'limited'
                  ? filteredListings.filter((l) => l.isLimited)
                  : filteredListings;

                if (displayListings.length === 0) {
                  return (
                    <div className="p-12 text-center rounded-3xl bg-slate-900/40 border border-slate-800 space-y-3">
                      <Store className="w-12 h-12 text-slate-600 mx-auto" />
                      <h3 className="font-bold text-slate-300 text-base">No active listings available.</h3>
                      <p className="text-xs text-slate-400">
                        Be the first to list a tool power-up on the Marketplace!
                      </p>
                      <button
                        onClick={() => setIsCreateListingOpen(true)}
                        className="mt-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 font-bold text-xs text-white shadow-lg cursor-pointer"
                      >
                        List Item Now
                      </button>
                    </div>
                  );
                }

                if (viewMode === 'horizontal') {
                  return (
                    <div className="relative group">
                      <div
                        ref={scrollContainerRef}
                        className="flex gap-4 overflow-x-auto pb-6 pt-2 px-1 snap-x snap-mandatory scroll-smooth no-scrollbar"
                      >
                        {displayListings.map((listing) => renderStandCard(listing, 'w-72 sm:w-80 shrink-0 snap-start'))}
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {displayListings.map((listing) => renderStandCard(listing, 'w-full'))}
                  </div>
                );
              })()
            )}
          </div>
        )}

        {/* TAB 2: MY LISTINGS */}
        {activeTab === 'my-listings' && (
          <div className="space-y-6">
            <div className="p-6 rounded-3xl bg-slate-900/80 border border-purple-500/30 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Store className="w-5 h-5 text-amber-400" />
                  <span>{user.username}'s Active Listings</span>
                </h2>
                <p className="text-xs text-slate-300 mt-1">
                  Manage your active listings. Cash out winning bids or list new utility items!
                </p>
              </div>

              <button
                onClick={() => setIsCreateListingOpen(true)}
                className="px-5 py-3 rounded-xl font-bold text-xs bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg flex items-center gap-2 cursor-pointer shrink-0"
              >
                <PlusCircle className="w-4 h-4" />
                <span>+ List New Utility Item</span>
              </button>
            </div>

            {myListings.length === 0 ? (
              <div className="p-12 text-center rounded-3xl bg-slate-900/40 border border-slate-800 space-y-3">
                <Tag className="w-12 h-12 text-slate-600 mx-auto" />
                <h3 className="font-bold text-slate-300 text-base">You have no active listings.</h3>
                <p className="text-xs text-slate-300">
                  List tool power-ups from your inventory to start earning Krests!
                </p>
                <button
                  onClick={() => setIsCreateListingOpen(true)}
                  className="mt-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 font-bold text-xs text-white shadow-lg cursor-pointer"
                >
                  List Item Now
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {myListings.map((listing) => (
                  <div
                    key={listing.id}
                    className="p-5 rounded-3xl bg-slate-900 border border-amber-500/40 shadow-xl space-y-4"
                  >
                    <div className="flex items-center justify-between border-b border-white/10 pb-2">
                      <span className="text-xs font-bold text-amber-300">YOUR LISTING</span>
                      <span className="text-[10px] text-slate-300 font-mono">{listing.id}</span>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-black/60 border border-white/10 flex items-center justify-center text-2xl shrink-0">
                        {listing.itemInstance.icon}
                      </div>
                      <div>
                        <h4 className="font-bold text-white text-sm">{listing.itemInstance.name}</h4>
                        <span className="text-[10px] text-amber-400 uppercase font-semibold">
                          {listing.itemInstance.rarity}
                        </span>
                      </div>
                    </div>

                    <div className="p-3 rounded-2xl bg-black/60 border border-white/10 space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-300">Current Highest Bid:</span>
                        <span className="font-mono font-bold text-amber-300 text-sm">
                          {listing.currentBid} Krests
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-300">Highest Bidder:</span>
                        <span className="font-bold text-purple-300">
                          {listing.highestBidderUsername || 'No bids yet'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      {listing.highestBidderId ? (
                        <button
                          onClick={() => setCashOutListingModal(listing)}
                          className="flex-1 py-3 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg cursor-pointer flex items-center justify-center gap-2"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>CASH OUT ({listing.currentBid} KRESTS)</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleCancelListing(listing.id)}
                          className="flex-1 py-3 rounded-xl font-semibold text-xs bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-600/50 cursor-pointer"
                        >
                          Cancel Listing
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: MY ACTIVE BIDS */}
        {activeTab === 'my-bids' && (
          <div className="space-y-6">
            <div className="p-6 rounded-3xl bg-slate-900/80 border border-amber-500/30 shadow-xl">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Gavel className="w-5 h-5 text-amber-400" />
                <span>My Active Marketplace Bids</span>
              </h2>
              <p className="text-xs text-slate-300 mt-1">
                Track your active Krest bids. Your Krests are reserved until you are outbid or the seller cashes out.
              </p>
            </div>

            {myActiveBidsListings.length === 0 ? (
              <div className="p-12 text-center rounded-3xl bg-slate-900/40 border border-slate-800 space-y-3">
                <Gavel className="w-12 h-12 text-slate-600 mx-auto" />
                <h3 className="font-bold text-slate-300 text-base">You have no active bids.</h3>
                <p className="text-xs text-slate-300">
                  Browse active listings and place a bid on rare utility items!
                </p>
                <button
                  onClick={() => setActiveTab('browse')}
                  className="mt-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 font-bold text-xs text-white shadow-lg cursor-pointer"
                >
                  Browse Listings Now
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {myActiveBidsListings.map((listing) => {
                  const isWinning = listing.highestBidderId === user.id;

                  return (
                    <div
                      key={listing.id}
                      className={`p-5 rounded-3xl bg-slate-900 border ${
                        isWinning ? 'border-emerald-500/80' : 'border-rose-500/80'
                      } shadow-xl space-y-4`}
                    >
                      <div className="flex items-center justify-between border-b border-white/10 pb-2">
                        <span className="text-xs font-bold text-amber-200">
                          Seller: {listing.sellerUsername}
                        </span>
                        {isWinning ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500 text-[10px] font-bold">
                            👑 WINNING
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500 text-[10px] font-bold animate-pulse">
                            ⚠️ OUTBID
                          </span>
                        )}
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-black/60 border border-white/10 flex items-center justify-center text-2xl shrink-0">
                          {listing.itemInstance.icon}
                        </div>
                        <div>
                          <h4 className="font-bold text-white text-sm">{listing.itemInstance.name}</h4>
                          <span className="text-[10px] text-amber-400 uppercase font-semibold">
                            {listing.itemInstance.rarity}
                          </span>
                        </div>
                      </div>

                      <div className="p-3 rounded-2xl bg-black/60 border border-white/10 space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-300">Current Highest Bid:</span>
                          <span className="font-mono font-bold text-amber-300">
                            {listing.currentBid} Krests
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-300">Highest Bidder:</span>
                          <span className="font-bold text-purple-300">
                            {listing.highestBidderUsername}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleOpenBidModal(listing)}
                        className={`w-full py-2.5 rounded-xl font-bold text-xs shadow-lg transition-all cursor-pointer ${
                          isWinning
                            ? 'bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/40'
                            : 'bg-rose-600 hover:bg-rose-500 text-white'
                        }`}
                      >
                        {isWinning ? 'Raise Bid Further' : 'Raise Bid (Outbid!)'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: MARKETPLACE HISTORY */}
        {activeTab === 'history' && (
          <div className="space-y-6">
            <div className="p-6 rounded-3xl bg-slate-900/80 border border-blue-500/30 shadow-xl">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <History className="w-5 h-5 text-blue-400" />
                <span>Completed Marketplace Transactions</span>
              </h2>
              <p className="text-xs text-slate-300 mt-1">
                Recent completed cash-outs and finalized item purchases across Kreational Marketplace.
              </p>
            </div>

            {history.length === 0 ? (
              <div className="p-12 text-center rounded-3xl bg-slate-900/40 border border-slate-800 space-y-2">
                <History className="w-12 h-12 text-slate-600 mx-auto" />
                <p className="text-slate-300 text-sm font-semibold">No recorded marketplace transactions yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {history.map((entry) => (
                  <div
                    key={entry.id}
                    className="p-4 rounded-2xl bg-slate-900/80 border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-md"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-purple-950/60 border border-purple-500/40 flex items-center justify-center text-2xl shrink-0">
                        {entry.itemInstance.icon}
                      </div>
                      <div>
                        <h4 className="font-bold text-white text-sm">{entry.itemInstance.name}</h4>
                        <p className="text-xs text-slate-300">
                          Seller: <strong className="text-amber-300">{entry.sellerUsername}</strong> →
                          Buyer: <strong className="text-emerald-300">{entry.buyerUsername}</strong>
                        </p>
                      </div>
                    </div>

                    <div className="text-right sm:text-right w-full sm:w-auto">
                      <span className="font-mono font-extrabold text-amber-300 text-sm block">
                        {entry.finalPrice} Krests
                      </span>
                      <span className="text-[10px] text-slate-300 block">
                        {new Date(entry.timestamp).toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL 1: PLACE BID CONFIRMATION MODAL */}
      {biddingListing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-md p-6 rounded-3xl bg-slate-900 border border-amber-500/50 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Gavel className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-white text-lg uppercase font-mono">PLACE BID</h3>
              </div>
              <button
                onClick={() => setBiddingListing(null)}
                className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-950/80 border border-white/10">
              <div className="w-12 h-12 rounded-xl bg-purple-950/60 border border-purple-500/40 flex items-center justify-center text-2xl shrink-0">
                {biddingListing.itemInstance.icon}
              </div>
              <div>
                <h4 className="font-bold text-white text-sm">{biddingListing.itemInstance.name}</h4>
                <p className="text-xs text-slate-300">
                  Seller: <strong className="text-amber-300">{biddingListing.sellerUsername}</strong>
                </p>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-black/60 border border-white/10 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-300">Current Highest Bid:</span>
                <span className="font-mono font-bold text-amber-300">
                  {biddingListing.currentBid} Krests
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">Your Available Krests:</span>
                <span className="font-mono font-bold text-emerald-300">{availableKrests} Krests</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="block text-xs font-bold text-slate-200">
                  Your Bid Amount (Increments of 10 Krests)
                </label>
                <span className="text-[10px] text-amber-400 font-mono font-semibold">Min: {biddingListing.highestBidderId ? biddingListing.currentBid + 10 : biddingListing.startingBid} Krests</span>
              </div>
              <input
                type="number"
                step="10"
                min={biddingListing.highestBidderId ? biddingListing.currentBid + 10 : biddingListing.startingBid}
                value={proposedBidAmount}
                onChange={(e) => setProposedBidAmount(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full px-4 py-3 rounded-xl bg-black/80 border border-amber-500/50 text-amber-300 font-mono font-extrabold text-lg focus:outline-none focus:border-amber-400"
              />

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setProposedBidAmount((prev) => prev + 10)}
                  className="flex-1 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-mono text-xs font-bold cursor-pointer transition-all"
                >
                  +10 Krests
                </button>
                <button
                  type="button"
                  onClick={() => setProposedBidAmount((prev) => prev + 50)}
                  className="flex-1 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-mono text-xs font-bold cursor-pointer transition-all"
                >
                  +50 Krests
                </button>
                <button
                  type="button"
                  onClick={() => setProposedBidAmount((prev) => prev + 100)}
                  className="flex-1 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-mono text-xs font-bold cursor-pointer transition-all"
                >
                  +100 Krests
                </button>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/40 text-[11px] text-amber-200/90 leading-relaxed">
              <strong>Instant Refund Protection:</strong> Bidding {proposedBidAmount} Krests will deduct {proposedBidAmount} Krests from your active balance. If another bidder or bot outbids you, your full bid amount will be instantly refunded back to your account!
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleConfirmBid}
                className="flex-1 py-3.5 rounded-xl font-black text-xs bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg cursor-pointer uppercase tracking-wider"
              >
                CONFIRM PLACE BID
              </button>
              <button
                onClick={() => setBiddingListing(null)}
                className="py-3.5 px-5 rounded-xl font-semibold text-xs bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: CASH OUT CONFIRMATION MODAL */}
      {cashOutListingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-md p-6 rounded-3xl bg-slate-900 border border-emerald-500/60 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-white text-lg">Cash Out Listing?</h3>
              </div>
              <button
                onClick={() => setCashOutListingModal(null)}
                className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-black/60 border border-white/10 space-y-2 text-xs text-slate-300">
              <p>
                Your <strong className="text-white">{cashOutListingModal.itemInstance.name}</strong> currently has a winning bid of:
              </p>
              <p className="font-mono font-extrabold text-amber-300 text-xl">
                {cashOutListingModal.currentBid} Krests
              </p>
              <p>
                Highest Bidder: <strong className="text-purple-300">{cashOutListingModal.highestBidderUsername}</strong>
              </p>
              <p className="text-[11px] text-slate-300 pt-2 border-t border-white/10">
                The highest bidder will receive the item and you will immediately receive <strong>{cashOutListingModal.currentBid} Krests</strong>. This action cannot be undone.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleConfirmCashOut}
                className="flex-1 py-3.5 rounded-xl font-black text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg cursor-pointer uppercase tracking-wider"
              >
                CASH OUT NOW
              </button>
              <button
                onClick={() => setCashOutListingModal(null)}
                className="py-3.5 px-5 rounded-xl font-semibold text-xs bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: CREATE LISTING MODAL */}
      {isCreateListingOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-lg p-6 rounded-3xl bg-slate-900 border border-purple-500/50 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Tag className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-white text-lg">List Item on Marketplace</h3>
              </div>
              <button
                onClick={() => setIsCreateListingOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Select an unlisted utility item from your inventory to list on the Marketplace.
            </p>

            {/* Inventory Item Selection */}
            {unlistedInventory.length === 0 ? (
              <div className="p-6 text-center rounded-2xl bg-black/40 border border-slate-800 space-y-2">
                <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto" />
                <p className="text-xs font-bold text-slate-300">
                  No unlisted tradable items in inventory.
                </p>
                <p className="text-[11px] text-slate-300">
                  Unbox Krates in the Shop to acquire tradable Utility Items!
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1 no-scrollbar">
                <label className="block text-xs font-bold text-slate-300 uppercase font-mono">
                  Select Item to List:
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {unlistedInventory.map((item) => (
                    <div
                      key={item.instanceId}
                      onClick={() => setSelectedInventoryItem(item)}
                      className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                        selectedInventoryItem?.instanceId === item.instanceId
                          ? 'bg-purple-950/80 border-purple-400 shadow-md'
                          : 'bg-black/40 border-white/10 hover:border-white/30'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-xl shrink-0">
                          {item.icon}
                        </div>
                        <div>
                          <h5 className="font-bold text-white text-xs">{item.name}</h5>
                          <span className="text-[10px] text-amber-300 uppercase font-semibold">
                            {item.rarity}
                          </span>
                        </div>
                      </div>

                      {selectedInventoryItem?.instanceId === item.instanceId && (
                        <CheckCircle2 className="w-5 h-5 text-purple-400 shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Starting Bid Input */}
            <div className="space-y-2 pt-2 border-t border-white/10">
              <label className="block text-xs font-bold text-slate-200">
                Starting Bid (Minimum 1 Krest)
              </label>
              <input
                type="number"
                min="1"
                value={startingBidInput}
                onChange={(e) => setStartingBidInput(parseInt(e.target.value) || 1)}
                className="w-full px-4 py-2.5 rounded-xl bg-black/80 border border-white/20 text-amber-300 font-mono font-bold text-sm focus:outline-none focus:border-purple-500"
              />
            </div>

            {/* Limited Setting Toggle */}
            <div className="pt-3 border-t border-white/10 flex items-center justify-between bg-black/40 p-3.5 rounded-2xl border border-white/10">
              <div className="space-y-0.5 pr-2">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-purple-400" />
                  <span className="text-xs font-bold text-white uppercase font-mono">Limited Setting</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Mark this auction listing as a Limited Edition exclusive sale.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsLimitedInput(!isLimitedInput)}
                className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 ease-in-out cursor-pointer shrink-0 ${
                  isLimitedInput ? 'bg-purple-600 border border-purple-400' : 'bg-slate-800 border border-slate-700'
                }`}
                title="Toggle Limited Setting"
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-transform duration-200 ease-in-out ${
                    isLimitedInput ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleConfirmCreateListing}
                disabled={!selectedInventoryItem}
                className={`flex-1 py-3.5 rounded-xl font-bold text-xs shadow-lg transition-all cursor-pointer ${
                  selectedInventoryItem
                    ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                CREATE LISTING
              </button>
              <button
                onClick={() => setIsCreateListingOpen(false)}
                className="py-3.5 px-5 rounded-xl font-semibold text-xs bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
