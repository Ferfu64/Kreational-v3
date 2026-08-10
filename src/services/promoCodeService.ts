import { db } from '../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export interface PromoCode {
  id: string;
  code: string;
  rewardHours: number;
  bonusKrests?: number;
  description: string;
  createdAt: number;
}

const DEFAULT_CODES: PromoCode[] = [
  {
    id: 'promo_kroze2026',
    code: 'KROZE2026',
    rewardHours: 2,
    bonusKrests: 100,
    description: 'Kroze Zone Official Launch Pass',
    createdAt: Date.now(),
  },
  {
    id: 'promo_azgames2026',
    code: 'AZGAMES2026',
    rewardHours: 5,
    bonusKrests: 250,
    description: '25 AZGAMES Special VIP Pass',
    createdAt: Date.now(),
  },
];

export async function getActivePromoCodes(): Promise<PromoCode[]> {
  try {
    const docRef = doc(db, 'system', 'promo_codes');
    const snap = await getDoc(docRef);
    if (snap.exists() && snap.data()?.codes) {
      const codes = snap.data().codes as PromoCode[];
      localStorage.setItem('kreational_promo_codes', JSON.stringify(codes));
      return codes;
    }
  } catch (e) {
    console.warn('Failed to fetch promo codes from Firestore, fallback to local', e);
  }

  const local = localStorage.getItem('kreational_promo_codes');
  if (local) {
    try {
      return JSON.parse(local);
    } catch (e) {}
  }

  return DEFAULT_CODES;
}

export async function savePromoCodes(codes: PromoCode[]): Promise<void> {
  localStorage.setItem('kreational_promo_codes', JSON.stringify(codes));
  try {
    const docRef = doc(db, 'system', 'promo_codes');
    await setDoc(docRef, { codes, updatedAt: Date.now() });
  } catch (e) {
    console.warn('Failed to save promo codes to Firestore', e);
  }
}
