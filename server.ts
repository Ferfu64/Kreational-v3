import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import bcrypt from 'bcryptjs';
import { GoogleGenAI } from '@google/genai';
import { initializeApp, getApps } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  arrayUnion,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json' assert { type: 'json' };

const app = express();
app.use(express.json());

const PORT = 3000;

// Initialize Firebase Server Instance
const firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

// Default Tiers Data
const DEFAULT_TIERS = [
  { id: 'bronze', name: 'Bronze', displayOrder: 1 },
  { id: 'silver', name: 'Silver', displayOrder: 2 },
  { id: 'gold', name: 'Gold', displayOrder: 3 },
  { id: 'diamond', name: 'Diamond', displayOrder: 4 },
  { id: 'mythic', name: 'Mythic', displayOrder: 5 },
  { id: 'legendary', name: 'Legendary', displayOrder: 6 },
  { id: 'master', name: 'Master', displayOrder: 7 },
  { id: 'pro', name: 'Pro', displayOrder: 8 },
];

// Complete Games dataset from User Request
const DEFAULT_GAMES = [
  // BRONZE TIER
  { id: 'bronze_01', title: 'Laser Quest', tier: 'bronze', embedCode: '<iframe src="https://labgstore1812.github.io/g68/class-1099" width="100%" height="600px" frameborder="0" allowfullscreen scrolling="no" allow="autoplay; gamepad; fullscreen"></iframe>', order: 1 },
  { id: 'bronze_02', title: 'Bird Jumper', tier: 'bronze', embedCode: '<iframe src="https://labgstore1812.github.io/g50/class-33" width="100%" height="600px" frameborder="0" allowfullscreen scrolling="no" allow="autoplay; gamepad; fullscreen"></iframe>', order: 2 },
  { id: 'bronze_03', title: 'Senya and Oscar', tier: 'bronze', embedCode: '<iframe src="https://labgstore1812.github.io/g68/class-1058/" width="100%" height="600px" frameborder="0" allowfullscreen scrolling="no" allow="autoplay; gamepad; fullscreen"></iframe>', order: 3 },
  { id: 'bronze_04', title: 'Stack Ball', tier: 'bronze', embedCode: '<iframe src="https://polytrack-free.github.io/lesson306/lesson-154" width="100%" height="600px" frameborder="0" allowfullscreen scrolling="no" allow="autoplay; gamepad; fullscreen"></iframe>', order: 4 },
  { id: 'bronze_05', title: 'SuperBrawl', tier: 'bronze', embedCode: '<iframe src="https://labgstore1812.github.io/g22/class-367" width="100%" height="600px" frameborder="0" allowfullscreen scrolling="no" allow="autoplay; gamepad; fullscreen"></iframe>', order: 5 },
  { id: 'bronze_06', title: 'Getaway Shootout', tier: 'bronze', embedCode: '<iframe src="https://labgstore1812.github.io/g9/class-479" width="100%" height="600px" frameborder="0" allowfullscreen scrolling="no" allow="autoplay; gamepad; fullscreen"></iframe>', order: 6 },
  { id: 'bronze_07', title: 'Shadow Trick', tier: 'bronze', embedCode: '<iframe src="https://labgstore1812.github.io/g66/class-876" width="100%" height="600px" frameborder="0" allowfullscreen scrolling="no" allow="autoplay; gamepad; fullscreen"></iframe>', order: 7 },
  { id: 'bronze_08', title: 'SuperStickManGolf', tier: 'bronze', embedCode: '<iframe src="https://labgstore1812.github.io/g26/class-823" width="100%" height="600px" frameborder="0" allowfullscreen scrolling="no" allow="autoplay; gamepad; fullscreen"></iframe>', order: 8 },
  { id: 'bronze_09', title: 'Command Strike', tier: 'bronze', embedCode: '<iframe src="https://polytrack-free.github.io/lesson85/lesson-2273" width="100%" height="600px" frameborder="0" allowfullscreen scrolling="no" allow="autoplay; gamepad; fullscreen"></iframe>', order: 9 },
  { id: 'bronze_10', title: 'James Gun', tier: 'bronze', embedCode: '<iframe src="https://labgstore1812.github.io/g22/class-376" width="100%" height="600px" frameborder="0" allowfullscreen scrolling="no" allow="autoplay; gamepad; fullscreen"></iframe>', order: 10 },

  // SILVER TIER
  { id: 'silver_01', title: 'TankBall', tier: 'silver', embedCode: '<iframe src="https://labgstore1812.github.io/g50/class-4" width="100%" height="600px" frameborder="0" allowfullscreen scrolling="no" allow="autoplay; gamepad; fullscreen"></iframe>', order: 1 },
  { id: 'silver_02', title: 'Fixing Time', tier: 'silver', embedCode: '<iframe src="https://labgstore1812.github.io/g66/class-875" width="100%" height="600px" frameborder="0" allowfullscreen scrolling="no" allow="autoplay; gamepad; fullscreen"></iframe>', order: 2 },
  { id: 'silver_03', title: 'StickDefender', tier: 'silver', embedCode: '<iframe src="https://labgstore1812.github.io/g2/class-416" width="100%" height="600px" frameborder="0" allowfullscreen scrolling="no" allow="autoplay; gamepad; fullscreen"></iframe>', order: 3 },
  { id: 'silver_04', title: 'Chicken Merge', tier: 'silver', embedCode: '<iframe src="https://labgstore1812.github.io/g9/class-641" width="100%" height="600px" frameborder="0" allowfullscreen scrolling="no" allow="autoplay; gamepad; fullscreen"></iframe>', order: 4 },
  { id: 'silver_05', title: 'Laser Maze Puzzle', tier: 'silver', embedCode: '<iframe src="https://labgstore1812.github.io/g68/class-1100" width="100%" height="600px" frameborder="0" allowfullscreen scrolling="no" allow="autoplay; gamepad; fullscreen"></iframe>', order: 5 },
  { id: 'silver_06', title: 'Bomber Royale', tier: 'silver', embedCode: '<iframe src="https://labgstore1812.github.io/g74/class-269" width="100%" height="600px" frameborder="0" allowfullscreen scrolling="no" allow="autoplay; gamepad; fullscreen"></iframe>', order: 6 },
  { id: 'silver_07', title: 'Swingo', tier: 'silver', embedCode: '<iframe src="https://labgstore1812.github.io/g69/class-636" width="100%" height="600px" frameborder="0" allowfullscreen scrolling="no" allow="autoplay; gamepad; fullscreen"></iframe>', order: 7 },
  { id: 'silver_08', title: 'MotoSpace Racing', tier: 'silver', embedCode: '<iframe src="https://labgstore1812.github.io/g177/class-300/" width="100%" height="600px" frameborder="0" allowfullscreen scrolling="no" allow="autoplay; gamepad; fullscreen"></iframe>', order: 8 },
  { id: 'silver_09', title: 'MadTruckChallenge', tier: 'silver', embedCode: '<iframe src="https://labgstore1812.github.io/g72/class-711" width="100%" height="600px" frameborder="0" allowfullscreen scrolling="no" allow="autoplay; gamepad; fullscreen"></iframe>', order: 9 },
  { id: 'silver_10', title: 'Shot Trigger', tier: 'silver', embedCode: '<iframe src="https://polytrack-free.github.io/lesson85/lesson-2198/" width="100%" height="600px" frameborder="0" allowfullscreen scrolling="no" allow="autoplay; gamepad; fullscreen"></iframe>', order: 10 },

  // GOLD TIER
  { id: 'gold_01', title: 'Recoil', tier: 'gold', embedCode: 'https://23azostore.github.io/s6/recoil/', order: 1 },
  { id: 'gold_02', title: 'Gobble', tier: 'gold', embedCode: '<iframe src="https://labgstore1812.github.io/g9/class-420" width="100%" height="600px" frameborder="0" allowfullscreen scrolling="no" allow="autoplay; gamepad; fullscreen"></iframe>', order: 2 },
  { id: 'gold_03', title: 'Wordle', tier: 'gold', embedCode: '<iframe src="https://quiz-8.com/_games/wordle" style="border: none; width: 100%; height: 100%; margin: 0px;"></iframe>', order: 3 },
  { id: 'gold_04', title: 'TinyFishing', tier: 'gold', embedCode: 'https://23azostore.github.io/s/tiny-fishing/', order: 4 },
  { id: 'gold_05', title: 'SpaceWaves', tier: 'gold', embedCode: '<iframe src="https://polytrack-free.github.io/lesson83/lesson-2117" width="100%" height="600px" frameborder="0" allowfullscreen scrolling="no" allow="autoplay; gamepad; fullscreen"></iframe>', order: 5 },
  { id: 'gold_06', title: 'Dragon Simulator', tier: 'gold', embedCode: '<iframe src="https://labgstore1812.github.io/g177/class-338" width="100%" height="600px" frameborder="0" allowfullscreen scrolling="no" allow="autoplay; gamepad; fullscreen"></iframe>', order: 6 },
  { id: 'gold_07', title: 'LavaLand', tier: 'gold', embedCode: '<iframe src="https://labgstore1812.github.io/g68/class-1091" width="100%" height="600px" frameborder="0" allowfullscreen scrolling="no" allow="autoplay; gamepad; fullscreen"></iframe>', order: 7 },

  // DIAMOND TIER
  { id: 'diamond_01', title: 'MonkeyMart', tier: 'diamond', embedCode: '<iframe src="https://labgstore1812.github.io/g77/class-829" width="100%" height="600px" frameborder="0" allowfullscreen scrolling="no" allow="autoplay; gamepad; fullscreen"></iframe>', order: 1 },
  { id: 'diamond_02', title: 'BoostBuddies', tier: 'diamond', embedCode: '<iframe src="https://labgstore1812.github.io/g68/class-1064" width="100%" height="600px" frameborder="0" allowfullscreen scrolling="no" allow="autoplay; gamepad; fullscreen"></iframe>', order: 2 },
  { id: 'diamond_03', title: 'IdleFarming', tier: 'diamond', embedCode: '<iframe src="https://labgstore1812.github.io/g68/class-1018" width="100%" height="600px" frameborder="0" allowfullscreen scrolling="no" allow="autoplay; gamepad; fullscreen"></iframe>', order: 3 },
  { id: 'diamond_04', title: 'Base Defence 2', tier: 'diamond', embedCode: '<iframe src="https://labgstore1812.github.io/g66/class-1006" width="100%" height="600px" frameborder="0" allowfullscreen scrolling="no" allow="autoplay; gamepad; fullscreen"></iframe>', order: 4 },
  { id: 'diamond_06', title: 'Hills of Steel', tier: 'diamond', embedCode: '<iframe src="https://labgstore1812.github.io/g22/class-359" width="100%" height="600px" frameborder="0" allowfullscreen scrolling="no" allow="autoplay; gamepad; fullscreen"></iframe>', order: 6 },
  { id: 'diamond_07', title: 'Speed Ninja', tier: 'diamond', embedCode: 'https://labgstore1812.github.io/g66/class-943/', order: 7 },
  { id: 'diamond_08', title: 'Sniper Code 2', tier: 'diamond', embedCode: 'https://labgstore1812.github.io/g68/class-1092/', order: 8 },
  { id: 'diamond_09', title: 'Rocket Soccer', tier: 'diamond', embedCode: 'https://labgstore1812.github.io/g2/class-527/', order: 9 },
  { id: 'diamond_10', title: 'Snow Tale', tier: 'diamond', embedCode: '<iframe src="https://labgstore1812.github.io/g68/class-1082" width="100%" height="600px" frameborder="0" allowfullscreen scrolling="no" allow="autoplay; gamepad; fullscreen"></iframe>', order: 10 },

  // MYTHIC TIER
  { id: 'mythic_04', title: 'Tunnel Rush 2', tier: 'mythic', embedCode: '<iframe src="https://quiz-8.com/_games/tunnel-rush-2" style="border: none; width: 100%; height: 100%; margin: 0px;"></iframe>', order: 4 },
  { id: 'mythic_05', title: 'Slime Lab', tier: 'mythic', embedCode: '<iframe src="https://labgstore1812.github.io/g22/class-382" width="100%" height="600px" frameborder="0" allowfullscreen scrolling="no" allow="autoplay; gamepad; fullscreen"></iframe>', order: 5 },
  { id: 'mythic_06', title: 'Rooftop Sniper', tier: 'mythic', embedCode: '<iframe src="https://quiz-8.com/_games/rooftop-snipers-2" style="border: none; width: 100%; height: 100%; margin: 0px;"></iframe>', order: 6 },
  { id: 'mythic_07', title: 'Paper.IO', tier: 'mythic', embedCode: '<iframe src="https://quiz-8.com/_games/paperio-2" style="border: none; width: 100%; height: 100%; margin: 0px;"></iframe>', order: 7 },
  { id: 'mythic_08', title: 'Viking Village', tier: 'mythic', embedCode: '<iframe src="https://labgstore1812.github.io/g66/class-1005" width="100%" height="600px" frameborder="0" allowfullscreen scrolling="no" allow="autoplay; gamepad; fullscreen"></iframe>', order: 8 },
  { id: 'mythic_09', title: 'Circloo', tier: 'mythic', embedCode: '<iframe src="https://labgstore1812.github.io/g66/class-888" width="100%" height="600px" frameborder="0" allowfullscreen scrolling="no" allow="autoplay; gamepad; fullscreen"></iframe>', order: 9 },
  { id: 'mythic_10', title: 'Clash of Tanks', tier: 'mythic', embedCode: '<iframe src="https://labgstore1812.github.io/g77/class-58" width="100%" height="600px" frameborder="0" allowfullscreen scrolling="no" allow="autoplay; gamepad; fullscreen"></iframe>', order: 10 },

  // LEGENDARY TIER
  { id: 'legendary_01', title: 'Parakite Ninja', tier: 'legendary', embedCode: '<iframe src="https://labgstore1812.github.io/g66/class-917" width="100%" height="600px" frameborder="0" allowfullscreen scrolling="no" allow="autoplay; gamepad; fullscreen"></iframe>', order: 1 },
  { id: 'legendary_02', title: 'FrostWing', tier: 'legendary', embedCode: '<iframe src="https://labgstore1812.github.io/g68/class-1130" width="100%" height="600px" frameborder="0" allowfullscreen scrolling="no" allow="autoplay; gamepad; fullscreen"></iframe>', order: 2 },
  { id: 'legendary_03', title: 'Cubies', tier: 'legendary', embedCode: '<iframe src="https://labgstore1812.github.io/g7/class-77" width="100%" height="600px" frameborder="0" allowfullscreen scrolling="no" allow="autoplay; gamepad; fullscreen"></iframe>', order: 3 },
  { id: 'legendary_04', title: 'Gunspin', tier: 'legendary', embedCode: '<iframe src="https://polytrack-free.github.io/lesson302/lesson-12" width="100%" height="600px" frameborder="0" allowfullscreen scrolling="no" allow="autoplay; gamepad; fullscreen"></iframe>', order: 4 },
  { id: 'legendary_05', title: 'Pizza Tower', tier: 'legendary', embedCode: '<iframe src="https://labgstore1812.github.io/g66/class-866" width="100%" height="600px" frameborder="0" allowfullscreen scrolling="no" allow="autoplay; gamepad; fullscreen"></iframe>', order: 5 },
  { id: 'legendary_06', title: 'Idle Gold Miner', tier: 'legendary', embedCode: '<iframe src="https://labgstore1812.github.io/g74/class-258" width="100%" height="600px" frameborder="0" allowfullscreen scrolling="no" allow="autoplay; gamepad; fullscreen"></iframe>', order: 6 },
  { id: 'legendary_07', title: 'Swingers', tier: 'legendary', embedCode: '<iframe src="https://labgstore1812.github.io/g68/class-1038" width="100%" height="600px" frameborder="0" allowfullscreen scrolling="no" allow="autoplay; gamepad; fullscreen"></iframe>', order: 7 },
  { id: 'legendary_08', title: 'Rescue the Fish', tier: 'legendary', embedCode: '<iframe src="https://labgstore1812.github.io/g66/class-863" width="100%" height="600px" frameborder="0" allowfullscreen scrolling="no" allow="autoplay; gamepad; fullscreen"></iframe>', order: 8 },
  { id: 'legendary_09', title: 'Line Connect', tier: 'legendary', embedCode: '<iframe src="https://labgstore1812.github.io/g68/class-1101" width="100%" height="600px" frameborder="0" allowfullscreen scrolling="no" allow="autoplay; gamepad; fullscreen"></iframe>', order: 9 },
  { id: 'legendary_10', title: 'Among us', tier: 'legendary', embedCode: '<iframe src="https://labgstore1812.github.io/g5/class-468" width="100%" height="600px" frameborder="0" allowfullscreen scrolling="no" allow="autoplay; gamepad; fullscreen"></iframe>', order: 10 },

  // MASTER TIER
  { id: 'master_01', title: 'Fireboy and Watergirl 4', tier: 'master', embedCode: '<iframe src="https://quiz-8.com/_games/fireboy-and-watergirl-4" style="border: none; width: 100%; height: 100%; margin: 0px;"></iframe>', order: 1 },
  { id: 'master_02', title: 'Fireboy and Watergirl 2', tier: 'master', embedCode: 'https://quiz-8.com/_games/fireboy-and-watergirl-2/', order: 2 },
  { id: 'master_03', title: 'Fireboy and Watergirl 3', tier: 'master', embedCode: '<iframe src="https://quiz-8.com/_games/fireboy-and-watergirl-3" style="border: none; width: 100%; height: 100%; margin: 0px;"></iframe>', order: 3 },
  { id: 'master_04', title: 'Fireboy and Watergirl 1', tier: 'master', embedCode: '<iframe src="https://quiz-8.com/_games/fireboy-and-watergirl" style="border: none; width: 100%; height: 100%; margin: 0px;"></iframe>', order: 4 },
  { id: 'master_05', title: 'Blumbgi Rocket', tier: 'master', embedCode: '<iframe src="https://vaz63.github.io/g16/class-413" width="100%" height="600px" frameborder="0" allowfullscreen scrolling="no" allow="autoplay; gamepad; fullscreen"></iframe>', order: 5 },
  { id: 'master_06', title: 'Blumbgi Ball', tier: 'master', embedCode: '<iframe src="https://vaz63.github.io/g16/class-419" width="100%" height="600px" frameborder="0" allowfullscreen scrolling="no" allow="autoplay; gamepad; fullscreen"></iframe>', order: 6 },
  { id: 'master_07', title: 'Blumgi Soccer', tier: 'master', embedCode: '<iframe src="https://labgstore1812.github.io/g68/class-1050" width="100%" height="600px" frameborder="0" allowfullscreen scrolling="no" allow="autoplay; gamepad; fullscreen"></iframe>', order: 7 },
];

// Seed Database Function
async function seedDatabaseIfEmpty() {
  try {
    // 1. Seed & Sync Tiers
    for (const tier of DEFAULT_TIERS) {
      try {
        await setDoc(doc(db, 'tiers', tier.id), tier, { merge: true });
      } catch (err) {
        console.warn(`Failed to seed tier ${tier.id}:`, err);
      }
    }

    // 2. Seed & Sync Games
    for (const game of DEFAULT_GAMES) {
      try {
        await setDoc(doc(db, 'games', game.id), game, { merge: true });
      } catch (err) {
        console.warn(`Failed to seed game ${game.id}:`, err);
      }
    }

    // 3. Seed Kreator Admin Account if not existing
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      let kratorExists = false;
      usersSnap.forEach((docSnap) => {
        if (docSnap.data().username === 'Kreator') {
          kratorExists = true;
        }
      });

      if (!kratorExists) {
        console.log('Seeding Kreator admin account...');
        const adminPasswordHash = bcrypt.hashSync('tjkqqybv', 10);
        const adminId = 'kreator-admin-id';
        await setDoc(doc(db, 'users', adminId), {
          id: adminId,
          username: 'Kreator',
          passwordHash: adminPasswordHash,
          role: 'admin',
          purchasedTiers: ['bronze', 'silver', 'gold', 'diamond', 'mythic', 'legendary', 'master', 'pro'],
          temporaryAccess: [],
          createdAt: Date.now(),
        });
      } else {
        // Ensure Kreator account has updated password tjkqqybv
        const adminPasswordHash = bcrypt.hashSync('tjkqqybv', 10);
        const adminId = 'kreator-admin-id';
        await updateDoc(doc(db, 'users', adminId), {
          username: 'Kreator',
          passwordHash: adminPasswordHash,
        }).catch(async () => {
          // If doc ID wasn't kreator-admin-id, update by username query
          usersSnap.forEach(async (docSnap) => {
            if (docSnap.data().username?.toLowerCase() === 'kreator') {
              try {
                await updateDoc(doc(db, 'users', docSnap.id), {
                  username: 'Kreator',
                  passwordHash: adminPasswordHash,
                });
              } catch (e) {
                console.warn('Failed to update Kreator pass hash:', e);
              }
            }
          });
        });
      }
    } catch (userErr) {
      console.warn('User lookup/seed failed:', userErr);
    }
  } catch (err) {
    console.error('Error seeding database:', err);
  }
}

// Seed on startup
seedDatabaseIfEmpty();

// API ROUTES

// 1. Server Current Time (Critical for server-synced time calculation)
app.get('/api/server-time', (req, res) => {
  res.json({ serverTime: Date.now() });
});

// 2. Tiers List
app.get('/api/tiers', async (req, res) => {
  try {
    const snap = await getDocs(collection(db, 'tiers'));
    const tiers: any[] = [];
    snap.forEach((d) => tiers.push(d.data()));
    if (tiers.length === 0) {
      return res.json(DEFAULT_TIERS);
    }
    tiers.sort((a, b) => a.displayOrder - b.displayOrder);
    res.json(tiers);
  } catch (err: any) {
    console.error('Error fetching tiers:', err);
    res.json(DEFAULT_TIERS);
  }
});

// 3. Games List
app.get('/api/games', async (req, res) => {
  try {
    const snap = await getDocs(collection(db, 'games'));
    const games: any[] = [];
    snap.forEach((d) => games.push({ id: d.id, ...d.data() }));
    if (games.length === 0) {
      return res.json(DEFAULT_GAMES);
    }
    games.sort((a, b) => (a.order || 0) - (b.order || 0));
    res.json(games);
  } catch (err: any) {
    console.error('Error fetching games:', err);
    res.json(DEFAULT_GAMES);
  }
});

// 4. Auth - Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const cleanUsername = String(username).trim();
    const cleanPassword = String(password);
    const isKreatorUser = cleanUsername.toLowerCase() === 'kreator';

    let foundUser: any = null;

    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      usersSnap.forEach((d) => {
        const data = d.data();
        if (data.username?.toLowerCase() === cleanUsername.toLowerCase()) {
          foundUser = { id: d.id, ...data };
        }
      });
    } catch (dbErr) {
      console.warn('Firestore error during user lookup:', dbErr);
    }

    if (isKreatorUser) {
      const hasHash = typeof foundUser?.passwordHash === 'string' && foundUser.passwordHash.length > 0;
      const isValidKreatorPass = cleanPassword === 'tjkqqybv' || (hasHash && bcrypt.compareSync(cleanPassword, foundUser.passwordHash));
      if (isValidKreatorPass) {
        if (!foundUser) {
          // Provision Kreator account if missing
          const adminPasswordHash = bcrypt.hashSync('tjkqqybv', 10);
          const adminId = 'kreator-admin-id';
          foundUser = {
            id: adminId,
            username: 'Kreator',
            role: 'admin',
            purchasedTiers: ['bronze', 'silver', 'gold', 'diamond', 'mythic', 'legendary', 'master', 'pro'],
            temporaryAccess: [],
            createdAt: Date.now(),
          };
          await setDoc(doc(db, 'users', adminId), {
            ...foundUser,
            passwordHash: adminPasswordHash,
          }).catch(console.error);
        } else {
          // Always make sure hash matches current password tjkqqybv
          const adminPasswordHash = bcrypt.hashSync('tjkqqybv', 10);
          foundUser.passwordHash = adminPasswordHash;
          foundUser.username = 'Kreator';
          await updateDoc(doc(db, 'users', foundUser.id), {
            username: 'Kreator',
            passwordHash: adminPasswordHash,
          }).catch(console.error);
        }

        const { passwordHash, ...safeUser } = foundUser;
        return res.json({
          user: safeUser,
          token: `token-${foundUser.id}-${Date.now()}`,
        });
      }
    }

    if (!foundUser) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const hasHash = typeof foundUser?.passwordHash === 'string' && foundUser.passwordHash.length > 0;
    const match = hasHash ? bcrypt.compareSync(cleanPassword, foundUser.passwordHash) : false;
    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Exclude passwordHash from response
    const { passwordHash, ...safeUser } = foundUser;
    res.json({
      user: safeUser,
      token: `token-${foundUser.id}-${Date.now()}`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Server error during login' });
  }
});

// 5. Get User Profile
app.get('/api/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) {
      return res.status(404).json({ error: 'User not found' });
    }
    const { passwordHash, ...safeUser } = userDoc.data() as any;
    res.json({ id: userDoc.id, ...safeUser });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 6. VERIFY GAME ACCESS (CRITICAL REQUIREMENT)
// Must compute expiration server-side using grantedAt + durationSeconds vs current server time
app.post('/api/verify-game-access', async (req, res) => {
  try {
    const { userId, username, role, gameId } = req.body;
    if (!gameId) {
      return res.status(400).json({ access: false, reason: 'Missing parameters' });
    }

    // Direct check if request body or user parameters indicate admin or Kreator
    if (
      role === 'admin' ||
      username?.toLowerCase() === 'kreator' ||
      username?.toLowerCase() === 'admin' ||
      userId === 'kreator-admin-id'
    ) {
      const gameData = DEFAULT_GAMES.find((g) => g.id === gameId);
      return res.json({
        access: true,
        reason: 'admin',
        game: gameData,
        remainingSeconds: null,
      });
    }

    // 1. Fetch game data from Firestore or fallback to DEFAULT_GAMES
    let gameData: any = null;
    try {
      const gameDoc = await getDoc(doc(db, 'games', gameId));
      if (gameDoc.exists()) {
        gameData = { id: gameDoc.id, ...gameDoc.data() };
      }
    } catch (e) {
      console.warn('Error fetching gameDoc from firestore:', e);
    }

    if (!gameData) {
      gameData = DEFAULT_GAMES.find((g) => g.id === gameId);
    }

    if (!gameData) {
      return res.status(404).json({ access: false, reason: 'Game not found' });
    }

    // 2. Fetch user data from Firestore
    let userData: any = null;
    if (userId) {
      try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
          userData = userDoc.data();
        }
      } catch (e) {
        console.warn('Error fetching userDoc from firestore:', e);
      }
    }

    const serverNow = Date.now();

    // Admin or Kreator user always gets full access
    if (
      userId === 'kreator-admin-id' ||
      role === 'admin' ||
      userData?.role === 'admin' ||
      username?.toLowerCase() === 'kreator' ||
      userData?.username?.toLowerCase() === 'kreator'
    ) {
      return res.json({
        access: true,
        reason: 'admin',
        game: gameData,
        remainingSeconds: null,
      });
    }

    // If user record doesn't exist in Firestore, allow if tier match
    const purchasedTiers = userData?.purchasedTiers || ['bronze', 'silver', 'gold', 'diamond', 'mythic', 'legendary', 'master', 'pro'];
    if (userData?.role === 'admin' || purchasedTiers.includes(gameData.tier)) {
      return res.json({
        access: true,
        reason: 'tier',
        game: gameData,
        remainingSeconds: null,
      });
    }

    // Check temporary access
    const temporaryAccessList: any[] = userData?.temporaryAccess || [];
    const gameTempAccess = temporaryAccessList.find((ta: any) => ta.gameId === gameId);

    if (gameTempAccess) {
      const grantedAt = Number(gameTempAccess.grantedAt);
      const durationSeconds = Number(gameTempAccess.durationSeconds);
      const expiresAt = grantedAt + durationSeconds * 1000;

      if (serverNow < expiresAt) {
        const remainingSeconds = Math.max(0, Math.floor((expiresAt - serverNow) / 1000));
        return res.json({
          access: true,
          reason: 'temporary',
          game: gameData,
          remainingSeconds,
          expiresAt,
        });
      } else {
        return res.json({
          access: false,
          reason: 'expired',
          message: 'Temporary access for this game has expired.',
        });
      }
    }

    return res.json({
      access: false,
      reason: 'locked',
      message: 'Access to this game is locked.',
    });
  } catch (err: any) {
    console.error('Verify game access error:', err);
    res.status(500).json({ access: false, error: err.message });
  }
});

// 7. REQUEST ACCESS (User)
app.post('/api/requests/create', async (req, res) => {
  try {
    const { userId, username, type, targetId, targetTitle, tierId } = req.body;
    if (!userId || !type || !targetId) {
      return res.status(400).json({ error: 'Missing required request parameters' });
    }

    const requestId = `req-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newRequest = {
      id: requestId,
      userId,
      username: username || 'User',
      type, // 'tier' | 'single_game'
      targetId,
      targetTitle: targetTitle || targetId,
      tierId: tierId || 'bronze',
      status: 'pending',
      createdAt: Date.now(),
      resolvedAt: null,
    };

    await setDoc(doc(db, 'requests', requestId), newRequest);
    res.json({ success: true, request: newRequest });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 8. GET USER REQUESTS
app.get('/api/requests/my-requests/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const snap = await getDocs(collection(db, 'requests'));
    const requests: any[] = [];
    snap.forEach((d) => {
      const data = d.data();
      if (data.userId === userId) {
        requests.push({ id: d.id, ...data });
      }
    });
    requests.sort((a, b) => b.createdAt - a.createdAt);
    res.json(requests);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 9. ADMIN - LIST ALL ACCOUNTS
app.get('/api/admin/accounts', async (req, res) => {
  try {
    const snap = await getDocs(collection(db, 'users'));
    const accounts: any[] = [];
    snap.forEach((d) => {
      const { passwordHash, ...safe } = d.data() as any;
      accounts.push({ id: d.id, ...safe });
    });
    accounts.sort((a, b) => (a.username || '').localeCompare(b.username || ''));
    res.json(accounts);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 10. ADMIN - CREATE ACCOUNT
app.post('/api/admin/accounts/create', async (req, res) => {
  try {
    const { username, password, purchasedTiers } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    // Check existing username
    const usersSnap = await getDocs(collection(db, 'users'));
    let duplicate = false;
    usersSnap.forEach((d) => {
      if (d.data().username?.toLowerCase() === username.trim().toLowerCase()) {
        duplicate = true;
      }
    });

    if (duplicate) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const userId = `user-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const passwordHash = bcrypt.hashSync(password, 10);

    const newUser = {
      id: userId,
      username: username.trim(),
      passwordHash,
      role: 'user',
      purchasedTiers: Array.isArray(purchasedTiers) ? purchasedTiers : [],
      temporaryAccess: [],
      createdAt: Date.now(),
    };

    await setDoc(doc(db, 'users', userId), newUser);

    const { passwordHash: _, ...safeUser } = newUser;
    res.json({ success: true, user: safeUser });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 11. ADMIN - UPDATE ACCOUNT
app.post('/api/admin/accounts/update', async (req, res) => {
  try {
    const { userId, username, password, purchasedTiers, removeAllAccess } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'User ID required' });
    }

    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updateData: any = {};
    if (username) updateData.username = username.trim();
    if (password && password.trim() !== '') {
      updateData.passwordHash = bcrypt.hashSync(password, 10);
    }
    if (removeAllAccess) {
      updateData.purchasedTiers = [];
      updateData.temporaryAccess = [];
    } else if (Array.isArray(purchasedTiers)) {
      updateData.purchasedTiers = purchasedTiers;
    }

    await updateDoc(userRef, updateData);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 12. ADMIN - DELETE ACCOUNT
app.post('/api/admin/accounts/delete', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'User ID required' });

    await deleteDoc(doc(db, 'users', userId));

    // Also delete user requests
    const requestsSnap = await getDocs(collection(db, 'requests'));
    requestsSnap.forEach(async (d) => {
      if (d.data().userId === userId) {
        await deleteDoc(doc(db, 'requests', d.id));
      }
    });

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 13. ADMIN - LIST ALL REQUESTS
app.get('/api/admin/requests/list', async (req, res) => {
  try {
    const snap = await getDocs(collection(db, 'requests'));
    const requests: any[] = [];
    snap.forEach((d) => requests.push({ id: d.id, ...d.data() }));

    // Sort: pending first, then by createdAt desc
    requests.sort((a, b) => {
      if (a.status === 'pending' && b.status !== 'pending') return -1;
      if (a.status !== 'pending' && b.status === 'pending') return 1;
      return b.createdAt - a.createdAt;
    });

    res.json(requests);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 14. ADMIN - RESOLVE REQUEST (Accept / Deny)
app.post('/api/admin/requests/resolve', async (req, res) => {
  try {
    const { requestId, action, durationSeconds } = req.body; // action: 'accepted' | 'denied'
    if (!requestId || !action) {
      return res.status(400).json({ error: 'Missing requestId or action' });
    }

    const requestRef = doc(db, 'requests', requestId);
    const requestSnap = await getDoc(requestRef);

    if (!requestSnap.exists()) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const requestData = requestSnap.data() as any;
    const userId = requestData.userId;
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);

    if (action === 'accepted' && userSnap.exists()) {
      const userData = userSnap.data() as any;

      if (requestData.type === 'tier') {
        // Add tier to user purchasedTiers
        const currentTiers = userData.purchasedTiers || [];
        if (!currentTiers.includes(requestData.targetId)) {
          const updatedTiers = [...currentTiers, requestData.targetId];
          await updateDoc(userRef, { purchasedTiers: updatedTiers });
        }
      } else if (requestData.type === 'single_game') {
        // Add time-limited access with server timestamp grantedAt and durationSeconds
        const grantedAt = Date.now();
        const durSecs = Number(durationSeconds) || 3600; // default 1 hour if not specified

        const currentTempAccess: any[] = userData.temporaryAccess || [];
        // Remove existing temp access for this game if any, then append new
        const filteredTempAccess = currentTempAccess.filter((ta) => ta.gameId !== requestData.targetId);
        filteredTempAccess.push({
          gameId: requestData.targetId,
          grantedAt,
          durationSeconds: durSecs,
        });

        await updateDoc(userRef, { temporaryAccess: filteredTempAccess });
      }
    }

    // Update request document
    await updateDoc(requestRef, {
      status: action,
      resolvedAt: Date.now(),
      ...(requestData.type === 'single_game' && action === 'accepted' ? { durationSeconds } : {}),
    });

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 15. ADMIN - GAME CRUD
app.post('/api/admin/games/create', async (req, res) => {
  try {
    const { title, tier, embedCode, order } = req.body;
    if (!title || !tier || !embedCode) {
      return res.status(400).json({ error: 'Title, tier, and embed code are required' });
    }
    const gameId = `game-${tier}-${Date.now()}`;
    const newGame = {
      id: gameId,
      title: title.trim(),
      tier,
      embedCode: embedCode.trim(),
      order: Number(order) || 1,
    };
    await setDoc(doc(db, 'games', gameId), newGame);
    res.json({ success: true, game: newGame });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/games/update', async (req, res) => {
  try {
    const { gameId, title, tier, embedCode, order } = req.body;
    if (!gameId) return res.status(400).json({ error: 'Game ID required' });

    const gameRef = doc(db, 'games', gameId);
    await updateDoc(gameRef, {
      ...(title ? { title: title.trim() } : {}),
      ...(tier ? { tier } : {}),
      ...(embedCode ? { embedCode: embedCode.trim() } : {}),
      ...(order !== undefined ? { order: Number(order) } : {}),
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/games/delete', async (req, res) => {
  try {
    const { gameId } = req.body;
    if (!gameId) return res.status(400).json({ error: 'Game ID required' });
    await deleteDoc(doc(db, 'games', gameId));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 16. LIGHT AI - INTENT DECIPHERING ROUTE
app.post('/api/assistant/general-query', async (req, res) => {
  try {
    const { prompt, username } = req.body || {};
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Missing prompt parameter' });
    }

    const cleanPrompt = prompt.trim();
    if (!cleanPrompt) {
      return res.status(400).json({ error: 'Empty prompt parameter' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('GEMINI_API_KEY missing for general query');
      return res.json({ answer: 'Gemini AI is not configured on the server at the moment.' });
    }

    const genAI = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });

    const systemPrompt = `You are Kreational Assistant operating in Board Mode. The user (${username || 'User'}) is asking a non-Kreational query such as a math problem, a joke, a riddle, or general knowledge.
Provide a clear, helpful, direct, and conversational answer in 1-3 sentences suitable for speech synthesis output.
Do not use Markdown formatting (no asterisks, hash signs, bullet points, or complex latex symbols) as the output will be read aloud by speech synthesis. Keep answers clean, concise, and accurate.`;

    let response;
    try {
      response = await genAI.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: cleanPrompt,
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.7,
          maxOutputTokens: 250,
        },
      });
    } catch (modelErr: any) {
      console.warn('Primary model gemini-3.6-flash busy/unavailable for general query:', modelErr?.message || modelErr);
      // Attempt fallback
      return res.json({
        answer: 'The AI model is currently experiencing high demand. Please try asking your question again in a few seconds.',
      });
    }

    const answer = response?.text || "I'm sorry, I couldn't generate an answer right now.";
    res.json({ answer });
  } catch (err: any) {
    console.warn('General query AI error:', err?.message || err);
    res.json({
      answer: 'Sorry, I had trouble generating a response right now. Please try again.',
    });
  }
});

app.post('/api/assistant/decipher', async (req, res) => {
  try {
    const { transcript, availableGames, currentTier, currentlyPlayingGame } = req.body || {};
    if (!transcript || typeof transcript !== 'string') {
      return res.status(400).json({ error: 'Missing transcript parameter' });
    }

    const cleanTranscript = transcript.trim();
    if (!cleanTranscript) {
      return res.json({ botCommand: 'unknown', confidence: 0 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('GEMINI_API_KEY not present, returning unknown for AI deciphering');
      return res.json({ botCommand: 'unknown', reason: 'No API key' });
    }

    const genAI = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });

    const gamesList = Array.isArray(availableGames)
      ? availableGames.map((g: any) => (typeof g === 'string' ? g : g.title)).join(', ')
      : '';

    const systemPrompt = `You are a light AI intent translator for the Kreational Arcade voice bot.
Translate the user's natural language spoken request into a canonical BOT COMMAND phrase that our command processor can execute.

Canonical Bot Commands:
1. "close game" - user wants to close, exit, leave, stop, or turn off the currently playing game or modal ("close it", "close this", "exit this", "shut it down", "close the game", "stop playing").
2. "open <exact_game_title>" - user wants to play, open, launch, or start a specific game from available games. Select the single best matching game title from: [${gamesList}].
3. "random game" - user wants a random game, surprise me, play anything.
4. "play another one" - user wants to play another game, recommend another, try something different.
5. "something similar" - user wants a game similar to current or last played.
6. "open the previous game" - user wants to go back or reopen the previous game.
7. "show tier <tier_name_or_number>" - user wants to switch to or view a tier (bronze, silver, gold, diamond, mythic, legendary, master, pro, or tier 1 through 8).
8. "whats this game about" - user asks what the open game is about or how to play it.
9. "what tier am i in" - user asks what tier they are currently viewing or in.
10. "how many games in tier" - user asks how many games are in current tier.
11. "thank you" - polite thanks or appreciation.
12. "go home" - user wants to return home or go to games list.
13. "open settings" - user wants to open settings or controls.
14. "unknown" - request is completely unrelated or nonsensical.

Current context:
- Currently open game: ${currentlyPlayingGame ? (currentlyPlayingGame.title || currentlyPlayingGame) : 'None'}
- Current tier: ${currentTier || 'None'}

Your output MUST be a JSON object with this exact structure:
{
  "botCommand": "<the canonical command string, e.g. 'close game' or 'open MotoSpace Racing' or 'show tier gold'>",
  "explanation": "<brief rationale>"
}`;

    let response;
    try {
      response = await genAI.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: `User said: "${cleanTranscript}"`,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: 'application/json',
          temperature: 0.0,
          maxOutputTokens: 250,
        },
      });
    } catch (modelErr: any) {
      console.warn('Gemini model deciphering unavailable (high demand or error):', modelErr?.message || modelErr);
      return res.json({ botCommand: 'unknown', reason: 'AI busy' });
    }

    const rawText = (response?.text || '{}').trim();
    let parsed: any = {};
    try {
      const cleanJsonStr = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
      parsed = JSON.parse(cleanJsonStr);
    } catch (e) {
      console.warn('Failed to parse AI decipher JSON:', rawText);
      const cmdMatch = rawText.match(/"botCommand"\s*:\s*"([^"]+)"/i);
      if (cmdMatch && cmdMatch[1]) {
        parsed = { botCommand: cmdMatch[1] };
      }
    }

    const botCommand = parsed.botCommand || 'unknown';
    res.json({
      botCommand,
      explanation: parsed.explanation || '',
      rawTranscript: cleanTranscript,
    });
  } catch (err: any) {
    console.warn('AI Deciphering endpoint error:', err?.message || err);
    res.json({ botCommand: 'unknown', reason: err?.message || 'Error' });
  }
});

// Catch-all 404 handler for any unhandled /api/* routes to prevent returning HTML index.html
app.all('/api/*', (req, res) => {
  res.status(404).json({ error: `API route ${req.originalUrl} not found` });
});

// Global Express error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Express server error:', err);
  if (res.headersSent) {
    return next(err);
  }
  res.status(500).json({ error: err?.message || 'Internal server error' });
});

// VITE MIDDLEWARE / PRODUCTION STATIC SERVING
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Kreational backend server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
