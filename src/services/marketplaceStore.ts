import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
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
import { safeGet, safeSet } from '../utils/persistentStorage';

const LISTINGS_COLLECTION = 'marketplace_listings';
const HISTORY_COLLECTION = 'marketplace_history';
const USERS_COLLECTION = 'users';

function getCurrentLoggedInUserId(): string {
  try {
    const stored = safeGet('kreational_user') || safeGet('kreational_current_user') || safeGet('kreations_user');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && parsed.id) return parsed.id;
    }
  } catch (e) {}
  return '';
}

function updateLoggedInUserLocally(userObj: User): void {
  try {
    const cleanUser = JSON.parse(JSON.stringify(userObj));
    safeSet('kreational_user', JSON.stringify(cleanUser));
    safeSet('kreational_current_user', JSON.stringify(cleanUser));
    window.dispatchEvent(new Event('user_updated'));
  } catch (e) {}
}

// In-memory fallback cache for fast synchronous UI rendering and offline mode
let localListingsMemory: MarketplaceListing[] = [];
let localHistoryMemory: MarketplaceHistoryEntry[] = [];

function isCleanPowerupListing(listing: MarketplaceListing): boolean {
  if (!listing || !listing.itemInstance) return false;
  const name = (listing.itemInstance.name || '').toLowerCase();
  const itemId = (listing.itemInstance.itemId || '').toLowerCase();
  if (
    name.includes('stand') ||
    itemId.includes('stand') ||
    name.includes('shard') ||
    itemId.includes('shard') ||
    name.includes('pass token')
  ) {
    return false;
  }
  return true;
}

export function subscribeToListings(callback: (listings: MarketplaceListing[]) => void): () => void {
  try {
    const q = query(collection(db, LISTINGS_COLLECTION));
    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const listings: MarketplaceListing[] = [];
        querySnapshot.forEach((docSnap) => {
          const item = docSnap.data() as MarketplaceListing;
          if (isCleanPowerupListing(item)) {
            listings.push(item);
          }
        });
        listings.sort((a, b) => b.createdAt - a.createdAt);
        localListingsMemory = listings;
        callback(listings);
      },
      (err) => {
        console.warn('subscribeToListings error:', err);
      }
    );
    return unsubscribe;
  } catch (err) {
    console.warn('subscribeToListings init error:', err);
    return () => {};
  }
}

export function subscribeToHistory(callback: (history: MarketplaceHistoryEntry[]) => void): () => void {
  try {
    const q = query(collection(db, HISTORY_COLLECTION));
    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const history: MarketplaceHistoryEntry[] = [];
        querySnapshot.forEach((docSnap) => {
          history.push(docSnap.data() as MarketplaceHistoryEntry);
        });
        history.sort((a, b) => b.timestamp - a.timestamp);
        localHistoryMemory = history;
        callback(history);
      },
      (err) => {
        console.warn('subscribeToHistory error:', err);
      }
    );
    return unsubscribe;
  } catch (err) {
    console.warn('subscribeToHistory init error:', err);
    return () => {};
  }
}

export async function fetchAllListings(): Promise<MarketplaceListing[]> {
  try {
    const q = query(collection(db, LISTINGS_COLLECTION));
    const querySnapshot = await getDocs(q);
    const listings: MarketplaceListing[] = [];
    querySnapshot.forEach((docSnap) => {
      const item = docSnap.data() as MarketplaceListing;
      if (isCleanPowerupListing(item)) {
        listings.push(item);
      }
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
  if (seller.id === getCurrentLoggedInUserId()) {
    updateLoggedInUserLocally(updatedSeller);
  }

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

  // Get current logged in user ID to guard client notifications and local sync
  const currentLoggedInUserId = getCurrentLoggedInUserId();

  // Calculate actual Krest cost needed for this bid
  const costNeeded = previousHighestBidderId === bidder.id
    ? roundedBid - previousCurrentBid
    : roundedBid;

  if ((bidder.krests || 0) < costNeeded) {
    throw new Error(`Insufficient Krests balance. You need ${costNeeded} Krests to place this bid.`);
  }

  // Notify seller if a bid was placed on their item by another user
  if (listing.sellerId === currentLoggedInUserId && bidder.id !== currentLoggedInUserId) {
    triggerNotification(
      'New Bid on Your Item!',
      `${bidder.username} placed a bid of ${roundedBid} Krests on ${listing.itemInstance.name}!`
    );
  }

  // Handle Outbid Previous Highest Bidder: refund full bid back to previous bidder's Krests
  if (previousHighestBidderId && previousHighestBidderId !== bidder.id) {
    try {
      const prevDocRef = doc(db, USERS_COLLECTION, previousHighestBidderId);
      const prevSnap = await getDoc(prevDocRef);
      if (prevSnap.exists()) {
        const prevAccount = prevSnap.data();
        const prevUser: User = prevAccount.user;
        const updatedPrevUser: User = {
          ...prevUser,
          krests: (prevUser.krests || 0) + previousCurrentBid,
          reservedKrests: 0,
        };
        await saveFullUserAccountToFirestore(updatedPrevUser);

        if (previousHighestBidderId === currentLoggedInUserId) {
          updateLoggedInUserLocally(updatedPrevUser);
          triggerNotification(
            '🎉 Outbid Refund!',
            `You were outbid on ${listing.itemInstance.name}. ${previousCurrentBid} Krests refunded to your balance!`
          );
        }
      }
    } catch (err) {
      console.warn('Error refunding outbid bidder Krests:', err);
    }
  }

  // Deduct costNeeded from active bidder's Krests
  const updatedBidder: User = {
    ...bidder,
    krests: Math.max(0, (bidder.krests || 0) - costNeeded),
    reservedKrests: 0,
  };

  if (bidder.id === currentLoggedInUserId) {
    updateLoggedInUserLocally(updatedBidder);
  }

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

  // Auto cash-out rule: After 3 bids, ONLY bot sellers auto cash out! Player sellers can wait and accept whenever they want.
  if (updatedListing.bidHistory.length >= 3 && listing.sellerId.startsWith('bot-')) {
    try {
      // Find seller user
      let sellerUser: User | null = null;
      const sellerDocRef = doc(db, USERS_COLLECTION, listing.sellerId);
      const sellerSnap = await getDoc(sellerDocRef);
      if (sellerSnap.exists()) {
        sellerUser = sellerSnap.data().user;
      }
      if (!sellerUser) {
        // Fallback for bot seller
        sellerUser = {
          id: listing.sellerId,
          username: listing.sellerUsername,
          role: 'user',
          krests: 1000,
          inventory: [listing.itemInstance],
        } as User;
      }
      const { completedListing } = await cashOutListingInStore(sellerUser, listingId);
      return { updatedBidder, updatedListing: completedListing };
    } catch (err) {
      console.warn('Auto cash out after 3 bids error:', err);
    }
  }

  return { updatedBidder, updatedListing };
}

export async function buyNowInStore(
  buyer: User,
  listingId: string
): Promise<{ updatedBuyer: User; completedListing: MarketplaceListing }> {
  let listing: MarketplaceListing | null = null;
  try {
    const docRef = doc(db, LISTINGS_COLLECTION, listingId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      listing = snap.data() as MarketplaceListing;
    }
  } catch (err) {
    console.warn('Firestore fetch listing for buy now error:', err);
  }

  if (!listing) {
    listing = localListingsMemory.find((l) => l.id === listingId) || null;
  }

  if (!listing || listing.status !== 'active') {
    throw new Error('Listing is no longer active.');
  }

  if (listing.sellerId === buyer.id) {
    throw new Error('You cannot buy your own item.');
  }

  const price = Math.max(1, listing.currentBid || listing.startingBid || 1);
  const actualDeduction = listing.highestBidderId === buyer.id ? 0 : price;
  const buyerAvailable = (buyer.krests || 0) - (buyer.reservedKrests || 0);

  if (buyerAvailable < actualDeduction) {
    throw new Error(`Insufficient Krests. You have ${buyerAvailable} Krests available.`);
  }

  // Get current logged in user ID to guard notifications
  const currentLoggedInUserId = getCurrentLoggedInUserId();

  // If there was a previous bidder on this listing, refund their bid!
  if (listing.highestBidderId && listing.highestBidderId !== buyer.id) {
    try {
      const prevDocRef = doc(db, USERS_COLLECTION, listing.highestBidderId);
      const prevSnap = await getDoc(prevDocRef);
      if (prevSnap.exists()) {
        const prevAccount = prevSnap.data();
        const prevUser: User = prevAccount.user;
        const updatedPrevUser: User = {
          ...prevUser,
          krests: (prevUser.krests || 0) + listing.currentBid,
          reservedKrests: 0,
        };
        await saveFullUserAccountToFirestore(updatedPrevUser);

        if (listing.highestBidderId === currentLoggedInUserId) {
          updateLoggedInUserLocally(updatedPrevUser);
          triggerNotification(
            '🎉 Bid Refunded!',
            `The item ${listing.itemInstance.name} was purchased by another buyer. ${listing.currentBid} Krests refunded to your balance!`
          );
        }
      }
    } catch (err) {
      console.warn('Error refunding previous bidder on buy now:', err);
    }
  }

  const boughtItem = { ...listing.itemInstance, isListed: false };

  // Update Buyer Account: deduct actualDeduction, add item to inventory
  const buyerInv = buyer.inventory || [];
  const updatedBuyer: User = {
    ...buyer,
    krests: Math.max(0, (buyer.krests || 0) - actualDeduction),
    reservedKrests: 0,
    inventory: [boughtItem, ...buyerInv],
  };

  await saveFullUserAccountToFirestore(updatedBuyer);
  if (buyer.id === currentLoggedInUserId) {
    updateLoggedInUserLocally(updatedBuyer);
  }

  // Update Seller Account: add price to Krests, remove item from inventory
  try {
    const sellerRef = doc(db, USERS_COLLECTION, listing.sellerId);
    const sellerSnap = await getDoc(sellerRef);
    if (sellerSnap.exists()) {
      const sellerAccount = sellerSnap.data();
      const sellerUser: User = sellerAccount.user;
      const sellerInv = (sellerUser.inventory || []).filter(
        (i) => i.instanceId !== listing!.itemInstance.instanceId
      );
      const updatedSellerUser: User = {
        ...sellerUser,
        krests: (sellerUser.krests || 0) + price,
        inventory: sellerInv,
      };
      await saveFullUserAccountToFirestore(updatedSellerUser);

      if (listing.sellerId === currentLoggedInUserId) {
        updateLoggedInUserLocally(updatedSellerUser);
        triggerNotification(
          '🎉 Item Sold!',
          `${buyer.username} bought ${boughtItem.name} for ${price} Krests!`
        );
      }
    }
  } catch (err) {
    console.warn('Error updating seller account on buy now:', err);
  }

  // Update Listing
  const completedListing: MarketplaceListing = {
    ...listing,
    status: 'sold',
    highestBidderId: buyer.id,
    highestBidderUsername: buyer.username,
    cashedOutAt: Date.now(),
  };

  try {
    const docRef = doc(db, LISTINGS_COLLECTION, listingId);
    await setDoc(docRef, completedListing, { merge: true });
  } catch (err) {
    console.warn('Firestore set sold listing error:', err);
  }

  // Save History
  const historyEntry: MarketplaceHistoryEntry = {
    id: `HIST-${Date.now()}`,
    listingId,
    sellerId: listing.sellerId,
    sellerUsername: listing.sellerUsername,
    buyerId: buyer.id,
    buyerUsername: buyer.username,
    itemInstance: boughtItem,
    finalPrice: price,
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

  if (buyer.id === currentLoggedInUserId) {
    triggerNotification(
      '🎉 Item Purchased!',
      `You bought ${boughtItem.name} for ${price} Krests!`
    );
  }

  return { updatedBuyer, completedListing };
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

  // Get current logged in user ID to guard client notifications and local sync
  const currentLoggedInUserId = getCurrentLoggedInUserId();

  // Update Winning Bidder Account: add item to inventory (Krests were already paid during bidding)
  try {
    const winnerDocRef = doc(db, USERS_COLLECTION, winningBidderId);
    const winnerSnap = await getDoc(winnerDocRef);
    if (winnerSnap.exists()) {
      const winnerAccount = winnerSnap.data();
      const winnerUser: User = winnerAccount.user;
      const winnerInv = winnerUser.inventory || [];

      const updatedWinnerUser: User = {
        ...winnerUser,
        reservedKrests: 0,
        inventory: [soldItem, ...winnerInv],
      };

      await saveFullUserAccountToFirestore(updatedWinnerUser);

      if (winningBidderId === currentLoggedInUserId) {
        updateLoggedInUserLocally(updatedWinnerUser);
      }
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
    reservedKrests: 0,
    inventory: sellerInventory,
  };

  await saveFullUserAccountToFirestore(updatedSeller);

  if (seller.id === currentLoggedInUserId) {
    updateLoggedInUserLocally(updatedSeller);
  }

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

  // If there was a bidder, refund listing.currentBid to bidder's Krests
  if (listing.highestBidderId) {
    try {
      const bidderRef = doc(db, USERS_COLLECTION, listing.highestBidderId);
      const bidderSnap = await getDoc(bidderRef);
      if (bidderSnap.exists()) {
        const bidderAccount = bidderSnap.data();
        const bidderUser: User = bidderAccount.user;
        const updatedBidder: User = {
          ...bidderUser,
          krests: (bidderUser.krests || 0) + listing.currentBid,
          reservedKrests: 0,
        };
        await saveFullUserAccountToFirestore(updatedBidder);

        // Sync local storage if current user is highest bidder
        const currentLoggedInUserId = getCurrentLoggedInUserId();

        if (listing.highestBidderId === currentLoggedInUserId) {
          updateLoggedInUserLocally(updatedBidder);
          triggerNotification(
            'Auction Cancelled',
            `${listing.currentBid} Krests were refunded because the listing was cancelled.`
          );
        }
      }
    } catch (err) {
      console.warn('Error refunding bidder Krests on cancel:', err);
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
  if (seller.id === getCurrentLoggedInUserId()) {
    updateLoggedInUserLocally(updatedSeller);
  }

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
