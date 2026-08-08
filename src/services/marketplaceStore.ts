import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  User,
  ItemInstance,
  MarketplaceListing,
  MarketplaceHistoryEntry,
} from '../types';
import { saveFullUserAccountToFirestore } from './firestoreStore';
import { triggerNotification } from '../utils/notificationManager';

const LISTINGS_COLLECTION = 'marketplace_listings';
const HISTORY_COLLECTION = 'marketplace_history';
const USERS_COLLECTION = 'users';

// In-memory fallback cache for fast synchronous UI rendering and offline mode
let localListingsMemory: MarketplaceListing[] = [];
let localHistoryMemory: MarketplaceHistoryEntry[] = [];

export async function fetchAllListings(): Promise<MarketplaceListing[]> {
  try {
    const q = query(collection(db, LISTINGS_COLLECTION));
    const querySnapshot = await getDocs(q);
    const listings: MarketplaceListing[] = [];
    querySnapshot.forEach((docSnap) => {
      listings.push(docSnap.data() as MarketplaceListing);
    });

    listings.sort((a, b) => b.createdAt - a.createdAt);
    localListingsMemory = listings;
    return listings;
  } catch (err) {
    console.warn('Firestore fetchAllListings fallback:', err);
    return localListingsMemory;
  }
}

export async function createListingInStore(
  seller: User,
  itemInstance: ItemInstance,
  startingBid: number,
  isLimited: boolean = false
): Promise<{ updatedSeller: User; listing: MarketplaceListing }> {
  const minBid = Math.max(1, Math.floor(startingBid));

  // Check item ownership and listing status
  const inventory = seller.inventory || [];
  const targetItemIndex = inventory.findIndex(
    (i) => i.instanceId === itemInstance.instanceId
  );

  if (targetItemIndex === -1) {
    throw new Error('Item not found in your inventory.');
  }

  if (inventory[targetItemIndex].isListed) {
    throw new Error('This item is already listed on the Marketplace.');
  }

  // Update seller inventory item as listed
  const updatedInventory = [...inventory];
  updatedInventory[targetItemIndex] = {
    ...updatedInventory[targetItemIndex],
    isListed: true,
  };

  const updatedSeller: User = {
    ...seller,
    inventory: updatedInventory,
  };

  const listingId = `LISTING-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

  const newListing: MarketplaceListing = {
    id: listingId,
    sellerId: seller.id,
    sellerUsername: seller.username,
    itemInstance: { ...updatedInventory[targetItemIndex] },
    startingBid: minBid,
    currentBid: minBid,
    highestBidderId: null,
    highestBidderUsername: null,
    createdAt: Date.now(),
    bidHistory: [],
    status: 'active',
    isLimited: !!isLimited,
  };

  // Save updated seller account and new listing doc
  await saveFullUserAccountToFirestore(updatedSeller);

  try {
    const docRef = doc(db, LISTINGS_COLLECTION, listingId);
    await setDoc(docRef, newListing);
  } catch (err) {
    console.warn('Firestore set listing error:', err);
  }

  localListingsMemory = [newListing, ...localListingsMemory];

  return { updatedSeller, listing: newListing };
}

export async function placeBidInStore(
  bidder: User,
  listingId: string,
  proposedBid: number
): Promise<{ updatedBidder: User; updatedListing: MarketplaceListing }> {
  let listing: MarketplaceListing | null = null;

  try {
    const docRef = doc(db, LISTINGS_COLLECTION, listingId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      listing = snap.data() as MarketplaceListing;
    }
  } catch (err) {
    console.warn('Firestore fetch listing error:', err);
  }

  if (!listing) {
    listing = localListingsMemory.find((l) => l.id === listingId) || null;
  }

  if (!listing || listing.status !== 'active') {
    throw new Error('Listing is no longer active.');
  }

  if (bidder.id === listing.sellerId) {
    throw new Error('You cannot bid on your own item.');
  }

  const roundedBid = Math.floor(proposedBid);

  if (roundedBid <= listing.currentBid && listing.highestBidderId !== null) {
    throw new Error(`Bid must be higher than current bid of ${listing.currentBid} Krests.`);
  }

  if (roundedBid < listing.startingBid) {
    throw new Error(`Bid must be at least the starting bid of ${listing.startingBid} Krests.`);
  }

  // Calculate available Krests
  const availableKrests = (bidder.krests || 0) - (bidder.reservedKrests || 0);
  if (availableKrests < roundedBid) {
    throw new Error(`Insufficient available Krests. You have ${availableKrests} available Krests.`);
  }

  const previousHighestBidderId = listing.highestBidderId;
  const previousCurrentBid = listing.currentBid;

  // Get current logged in user ID to guard client notifications
  let currentLoggedInUserId = '';
  try {
    const stored = localStorage.getItem('kreational_current_user');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && parsed.id) currentLoggedInUserId = parsed.id;
    }
  } catch (e) {}

  // Notify seller if a bid was placed on their item by another user
  if (listing.sellerId === currentLoggedInUserId && bidder.id !== currentLoggedInUserId) {
    triggerNotification(
      'New Bid on Your Item!',
      `${bidder.username} placed a bid of ${roundedBid} Krests on ${listing.itemInstance.name}!`
    );
  }

  // Handle Outbid Previous Highest Bidder if different user
  if (previousHighestBidderId && previousHighestBidderId !== bidder.id) {
    try {
      const prevDocRef = doc(db, USERS_COLLECTION, previousHighestBidderId);
      const prevSnap = await getDoc(prevDocRef);
      if (prevSnap.exists()) {
        const prevAccount = prevSnap.data();
        const prevUser: User = prevAccount.user;
        const newReserved = Math.max(
          0,
          (prevUser.reservedKrests || 0) - previousCurrentBid
        );
        const updatedPrevUser: User = {
          ...prevUser,
          reservedKrests: newReserved,
        };
        await saveFullUserAccountToFirestore(updatedPrevUser);
      }
    } catch (err) {
      console.warn('Error releasing previous bidder reserved Krests:', err);
    }

    if (previousHighestBidderId === currentLoggedInUserId) {
      triggerNotification(
        'You were outbid!',
        `${listing.itemInstance.name} - New highest bid is ${roundedBid} Krests.`
      );
    }
  }

  // Calculate bidder's new reserved Krests
  let bidderReserved = bidder.reservedKrests || 0;
  if (previousHighestBidderId === bidder.id) {
    // Same bidder raising their bid
    const diff = roundedBid - previousCurrentBid;
    bidderReserved += diff;
  } else {
    bidderReserved += roundedBid;
  }

  const updatedBidder: User = {
    ...bidder,
    reservedKrests: bidderReserved,
  };

  // Update listing
  const updatedListing: MarketplaceListing = {
    ...listing,
    currentBid: roundedBid,
    highestBidderId: bidder.id,
    highestBidderUsername: bidder.username,
    bidHistory: [
      {
        bidderId: bidder.id,
        bidderUsername: bidder.username,
        amount: roundedBid,
        timestamp: Date.now(),
      },
      ...(listing.bidHistory || []),
    ],
  };

  // Save updated bidder user
  await saveFullUserAccountToFirestore(updatedBidder);

  // Save updated listing
  try {
    const docRef = doc(db, LISTINGS_COLLECTION, listingId);
    await setDoc(docRef, updatedListing, { merge: true });
  } catch (err) {
    console.warn('Firestore set listing update error:', err);
  }

  // Update local memory
  localListingsMemory = localListingsMemory.map((l) =>
    l.id === listingId ? updatedListing : l
  );

  if (bidder.id === currentLoggedInUserId) {
    triggerNotification(
      'New Bid Placed!',
      `You are currently the highest bidder on ${listing.itemInstance.name} at ${roundedBid} Krests!`
    );
  }

  return { updatedBidder, updatedListing };
}

export async function cashOutListingInStore(
  seller: User,
  listingId: string
): Promise<{ updatedSeller: User; completedListing: MarketplaceListing }> {
  let listing: MarketplaceListing | null = null;

  try {
    const docRef = doc(db, LISTINGS_COLLECTION, listingId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      listing = snap.data() as MarketplaceListing;
    }
  } catch (err) {
    console.warn('Firestore fetch listing for cash out error:', err);
  }

  if (!listing) {
    listing = localListingsMemory.find((l) => l.id === listingId) || null;
  }

  if (!listing || listing.status !== 'active') {
    throw new Error('Listing is not active.');
  }

  if (listing.sellerId !== seller.id) {
    throw new Error('You can only cash out your own listings.');
  }

  if (!listing.highestBidderId) {
    throw new Error('There are no bids on this listing yet.');
  }

  const winningBidderId = listing.highestBidderId;
  const finalPrice = listing.currentBid;
  const soldItem = { ...listing.itemInstance, isListed: false };

  // Update Winning Bidder Account: deduct total Krests & reserved Krests, add item to inventory
  try {
    const winnerDocRef = doc(db, USERS_COLLECTION, winningBidderId);
    const winnerSnap = await getDoc(winnerDocRef);
    if (winnerSnap.exists()) {
      const winnerAccount = winnerSnap.data();
      const winnerUser: User = winnerAccount.user;
      const winnerInv = winnerUser.inventory || [];

      const updatedWinnerUser: User = {
        ...winnerUser,
        krests: Math.max(0, (winnerUser.krests || 0) - finalPrice),
        reservedKrests: Math.max(0, (winnerUser.reservedKrests || 0) - finalPrice),
        inventory: [soldItem, ...winnerInv],
      };

      await saveFullUserAccountToFirestore(updatedWinnerUser);
    }
  } catch (err) {
    console.warn('Error finalizing winner account during cash out:', err);
  }

  // Update Seller Account: add finalPrice to seller Krests & remove item from seller inventory
  const sellerInventory = (seller.inventory || []).filter(
    (i) => i.instanceId !== listing!.itemInstance.instanceId
  );

  const updatedSeller: User = {
    ...seller,
    krests: (seller.krests || 0) + finalPrice,
    inventory: sellerInventory,
  };

  await saveFullUserAccountToFirestore(updatedSeller);

  // Update Listing Status
  const completedListing: MarketplaceListing = {
    ...listing,
    status: 'cashed_out',
    cashedOutAt: Date.now(),
  };

  try {
    const docRef = doc(db, LISTINGS_COLLECTION, listingId);
    await setDoc(docRef, completedListing, { merge: true });
  } catch (err) {
    console.warn('Firestore set completed listing error:', err);
  }

  // Save History Entry
  const historyEntry: MarketplaceHistoryEntry = {
    id: `HIST-${Date.now()}`,
    listingId,
    sellerId: seller.id,
    sellerUsername: seller.username,
    buyerId: winningBidderId,
    buyerUsername: listing.highestBidderUsername || 'Winning Bidder',
    itemInstance: soldItem,
    finalPrice,
    timestamp: Date.now(),
  };

  try {
    const histRef = doc(db, HISTORY_COLLECTION, historyEntry.id);
    await setDoc(histRef, historyEntry);
  } catch (err) {
    console.warn('Firestore history record error:', err);
  }

  localListingsMemory = localListingsMemory.map((l) =>
    l.id === listingId ? completedListing : l
  );
  localHistoryMemory = [historyEntry, ...localHistoryMemory];

  // Get current logged in user ID to guard client notifications
  let currentLoggedInUserId = '';
  try {
    const stored = localStorage.getItem('kreational_current_user');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && parsed.id) currentLoggedInUserId = parsed.id;
    }
  } catch (e) {}

  if (seller.id === currentLoggedInUserId) {
    triggerNotification(
      'Cash Out Successful!',
      `You earned ${finalPrice} Krests for selling ${soldItem.name}!`
    );
  } else if (winningBidderId === currentLoggedInUserId) {
    triggerNotification(
      '🎉 Auction Won!',
      `You won ${soldItem.name} from ${seller.username} for ${finalPrice} Krests!`
    );
  }

  return { updatedSeller, completedListing };
}

export async function cancelListingInStore(
  seller: User,
  listingId: string
): Promise<{ updatedSeller: User }> {
  let listing: MarketplaceListing | null = null;

  try {
    const docRef = doc(db, LISTINGS_COLLECTION, listingId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      listing = snap.data() as MarketplaceListing;
    }
  } catch (err) {
    console.warn('Firestore fetch listing error:', err);
  }

  if (!listing) {
    listing = localListingsMemory.find((l) => l.id === listingId) || null;
  }

  if (!listing || listing.status !== 'active') {
    throw new Error('Listing is not active.');
  }

  if (listing.sellerId !== seller.id) {
    throw new Error('You can only cancel your own listings.');
  }

  // If there was a bidder, release bidder's reserved Krests
  if (listing.highestBidderId) {
    try {
      const bidderRef = doc(db, USERS_COLLECTION, listing.highestBidderId);
      const bidderSnap = await getDoc(bidderRef);
      if (bidderSnap.exists()) {
        const bidderAccount = bidderSnap.data();
        const bidderUser: User = bidderAccount.user;
        const updatedBidder: User = {
          ...bidderUser,
          reservedKrests: Math.max(
            0,
            (bidderUser.reservedKrests || 0) - listing.currentBid
          ),
        };
        await saveFullUserAccountToFirestore(updatedBidder);
      }
    } catch (err) {
      console.warn('Error releasing bidder reserved Krests on cancel:', err);
    }
  }

  // Reset seller inventory item isListed = false
  const updatedInventory = (seller.inventory || []).map((i) => {
    if (i.instanceId === listing!.itemInstance.instanceId) {
      return { ...i, isListed: false };
    }
    return i;
  });

  const updatedSeller: User = {
    ...seller,
    inventory: updatedInventory,
  };

  await saveFullUserAccountToFirestore(updatedSeller);

  const cancelledListing: MarketplaceListing = {
    ...listing,
    status: 'cancelled',
  };

  try {
    const docRef = doc(db, LISTINGS_COLLECTION, listingId);
    await setDoc(docRef, cancelledListing, { merge: true });
  } catch (err) {
    console.warn('Firestore set cancelled listing error:', err);
  }

  localListingsMemory = localListingsMemory.map((l) =>
    l.id === listingId ? cancelledListing : l
  );

  return { updatedSeller };
}

export async function fetchMarketplaceHistory(): Promise<MarketplaceHistoryEntry[]> {
  try {
    const q = query(collection(db, HISTORY_COLLECTION));
    const snap = await getDocs(q);
    const history: MarketplaceHistoryEntry[] = [];
    snap.forEach((docSnap) => {
      history.push(docSnap.data() as MarketplaceHistoryEntry);
    });
    history.sort((a, b) => b.timestamp - a.timestamp);
    localHistoryMemory = history;
    return history;
  } catch (err) {
    console.warn('Firestore history error:', err);
    return localHistoryMemory;
  }
}
