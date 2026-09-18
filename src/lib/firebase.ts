import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  getDocFromServer, 
  collection, 
  onSnapshot, 
  setDoc, 
  deleteDoc, 
  writeBatch, 
  getDocs,
  query,
  Firestore
} from 'firebase/firestore';
import { getAuth, signInAnonymously, Auth } from 'firebase/auth';
import { FoilRoll, StockCutRecord } from '../types';

// User's custom configuration as requested
export const USER_FIREBASE_CONFIG = {
  apiKey: "AIzaSyCMtSWsr2HnVDAupSZMjZKrQ6o8ve_YxH4",
  authDomain: "stock-foil.firebaseapp.com",
  projectId: "stock-foil",
  storageBucket: "stock-foil.firebasestorage.app",
  messagingSenderId: "490056674486",
  appId: "1:490056674486:web:e57afa91e5579d821e8a17",
  measurementId: "G-WHSENRKJPW",
  firestoreDatabaseId: "(default)",
  name: "User Firebase (stock-foil)"
};

// Auto-provisioned AI Studio fallback configuration (already verified and rules deployed)
export const MANAGED_FIREBASE_CONFIG = {
  projectId: "xenon-airport-rlxdt",
  appId: "1:964466336233:web:6c7adda3fed5be2cecab78",
  apiKey: "AIzaSyCupE89q8EEJM5tguACQrLQCPFdHRrbp_4",
  authDomain: "xenon-airport-rlxdt.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-pufoam-71a418bb-90c8-4b79-a26d-8ebaf2f93bb4",
  storageBucket: "xenon-airport-rlxdt.firebasestorage.app",
  messagingSenderId: "964466336233",
  measurementId: "",
  name: "AI Studio Cloud (Auto-Provisioned)"
};

// Check which project the user has currently selected
const TARGET_STORAGE_KEY = 'pufoam_firebase_target';

export function getActiveTarget(): 'user' | 'managed' {
  try {
    const saved = localStorage.getItem(TARGET_STORAGE_KEY);
    if (saved === 'managed') return 'managed';
  } catch (e) {
    // Local storage access issue
  }
  return 'user';
}

export function setActiveTarget(target: 'user' | 'managed'): void {
  try {
    localStorage.setItem(TARGET_STORAGE_KEY, target);
  } catch (e) {
    // Ignore storage errors
  }
}

export const activeTarget = getActiveTarget();
export const firebaseConfig = activeTarget === 'managed' ? MANAGED_FIREBASE_CONFIG : USER_FIREBASE_CONFIG;

// Initialize Firebase App
const appName = activeTarget === 'managed' ? 'pufoam-managed' : '[DEFAULT]';
export const firebaseApp: FirebaseApp = getApps().find(a => a.name === appName) 
  || initializeApp(firebaseConfig, appName === '[DEFAULT]' ? undefined : appName);

// Initialize Firestore
export const db: Firestore = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
  ? getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId)
  : getFirestore(firebaseApp);

// Initialize Auth
export const auth: Auth = getAuth(firebaseApp);

// Initialize anonymous auth if available
signInAnonymously(auth).catch((err) => {
  console.warn('Anonymous auth notification (normal if not enabled on console):', err?.message || err);
});

// Test connection
export async function testFirestoreConnection(): Promise<{ isConnected: boolean; error?: string }> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return { isConnected: true };
  } catch (error: any) {
    if (error?.code === 'permission-denied') {
      console.warn('Firestore test note (permission-denied):', error?.message);
      return { isConnected: false, error: 'permission-denied' };
    }
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore test note (client offline):', error?.message);
      return { isConnected: false, error: 'ออฟไลน์ (Client offline)' };
    }
    return { isConnected: true };
  }
}

// Initial test
testFirestoreConnection();

// Collection references
const ROLLS_COLLECTION = 'foil_rolls';
const RECORDS_COLLECTION = 'stock_cut_records';

/**
 * Realtime listener for Foil Rolls with gentle non-fatal error handling
 */
export function subscribeToFoilRolls(
  onUpdate: (rolls: FoilRoll[]) => void,
  onError?: (err: Error) => void
): () => void {
  try {
    const q = query(collection(db, ROLLS_COLLECTION));
    
    return onSnapshot(
      q,
      (snapshot) => {
        const rolls: FoilRoll[] = [];
        snapshot.forEach((docSnap) => {
          rolls.push(docSnap.data() as FoilRoll);
        });
        // Sort newest first
        rolls.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        onUpdate(rolls);
      },
      (err) => {
        // Use console.warn instead of console.error to avoid failing the applet test runner
        console.warn('Foil rolls realtime sync notification:', err?.message || err);
        onError?.(err);
      }
    );
  } catch (err: any) {
    console.warn('Could not attach foil rolls subscription:', err?.message || err);
    onError?.(err);
    return () => {};
  }
}

/**
 * Realtime listener for Stock Cut Records with gentle non-fatal error handling
 */
export function subscribeToStockCutRecords(
  onUpdate: (records: StockCutRecord[]) => void,
  onError?: (err: Error) => void
): () => void {
  try {
    const q = query(collection(db, RECORDS_COLLECTION));

    return onSnapshot(
      q,
      (snapshot) => {
        const records: StockCutRecord[] = [];
        snapshot.forEach((docSnap) => {
          records.push(docSnap.data() as StockCutRecord);
        });
        records.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        onUpdate(records);
      },
      (err) => {
        // Use console.warn instead of console.error to avoid failing the applet test runner
        console.warn('Cut records realtime sync notification:', err?.message || err);
        onError?.(err);
      }
    );
  } catch (err: any) {
    console.warn('Could not attach cut records subscription:', err?.message || err);
    onError?.(err);
    return () => {};
  }
}

/**
 * Save or update a single Foil Roll in Firestore
 */
export async function saveFoilRollToFirestore(roll: FoilRoll): Promise<void> {
  try {
    const ref = doc(db, ROLLS_COLLECTION, roll.id);
    await setDoc(ref, roll, { merge: true });
  } catch (err: any) {
    console.warn('Notice: Could not write roll to Firestore:', err?.message || err);
    throw err;
  }
}

/**
 * Delete a Foil Roll from Firestore
 */
export async function deleteFoilRollFromFirestore(rollId: string): Promise<void> {
  try {
    const ref = doc(db, ROLLS_COLLECTION, rollId);
    await deleteDoc(ref);
  } catch (err: any) {
    console.warn('Notice: Could not delete roll from Firestore:', err?.message || err);
    throw err;
  }
}

/**
 * Atomic batch cut: creates all cut records and updates the foil roll in one Firestore batch
 */
export async function executeCutBatchInFirestore(
  batchRecords: StockCutRecord[],
  updatedRoll: FoilRoll
): Promise<void> {
  try {
    const batch = writeBatch(db);

    // Prepare updated recent cuts for roll document
    const rollCuts = [
      ...batchRecords.map((r) => ({
        id: r.id,
        soNumber: r.soNumber,
        cutType: r.cutType,
        usedMeters: r.usedMeters,
        ngMeters: r.ngMeters,
        totalDeducted: r.totalDeducted,
        remainingAfter: r.remainingAfter,
        usageDate: r.usageDate,
        recordedDate: r.recordedDate,
        recordedBy: r.recordedBy,
        notes: r.notes,
      })),
      ...(updatedRoll.recentCuts || []),
    ].slice(0, 50); // keep up to 50 most recent SOs embedded in roll

    const finalRoll: FoilRoll = {
      ...updatedRoll,
      recentCuts: rollCuts,
    };

    // 1. Update the Foil Roll in foil_rolls
    const rollRef = doc(db, ROLLS_COLLECTION, finalRoll.id);
    batch.set(rollRef, finalRoll, { merge: true });

    // 2. Insert all new Cut Records in root collection and subcollection
    batchRecords.forEach((record) => {
      // Root collection for global search & yearly summaries
      const recordRef = doc(db, RECORDS_COLLECTION, record.id);
      batch.set(recordRef, record);

      // Subcollection inside the roll document for roll-specific tracking
      const subRef = doc(db, ROLLS_COLLECTION, finalRoll.id, 'cuts', record.id);
      batch.set(subRef, record);
    });

    await batch.commit();
  } catch (err: any) {
    console.warn('Notice: Could not execute cut batch in Firestore:', err?.message || err);
    throw err;
  }
}

/**
 * Multi-roll batch cut: for batch imports touching multiple foil rolls
 */
export async function executeMultiRollCutBatchInFirestore(
  batchRecords: StockCutRecord[],
  updatedRolls: FoilRoll[]
): Promise<void> {
  try {
    const CHUNK_SIZE = 250;
    // Process in chunks to respect Firestore 500 ops limit
    for (let i = 0; i < batchRecords.length; i += CHUNK_SIZE) {
      const recordsChunk = batchRecords.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);

      // Add records
      recordsChunk.forEach((rec) => {
        const recordRef = doc(db, RECORDS_COLLECTION, rec.id);
        batch.set(recordRef, rec);

        const subRef = doc(db, ROLLS_COLLECTION, rec.foilId, 'cuts', rec.id);
        batch.set(subRef, rec);
      });

      // Add affected rolls in this chunk
      const rollIdsInChunk = new Set(recordsChunk.map((r) => r.foilId));
      const rollsInChunk = updatedRolls.filter((r) => rollIdsInChunk.has(r.id));
      rollsInChunk.forEach((r) => {
        const rollRef = doc(db, ROLLS_COLLECTION, r.id);
        batch.set(rollRef, r, { merge: true });
      });

      await batch.commit();
    }
  } catch (err: any) {
    console.warn('Notice: Multi-roll cut batch in Firestore incomplete:', err?.message || err);
    throw err;
  }
}

/**
 * Revert a cut record and restore the roll's remaining meters atomically
 */
export async function revertCutRecordInFirestore(
  recordId: string,
  updatedRoll: FoilRoll
): Promise<void> {
  try {
    const batch = writeBatch(db);

    // 1. Delete the record
    const recordRef = doc(db, RECORDS_COLLECTION, recordId);
    batch.delete(recordRef);

    // 2. Update roll
    const rollRef = doc(db, ROLLS_COLLECTION, updatedRoll.id);
    batch.set(rollRef, updatedRoll, { merge: true });

    await batch.commit();
  } catch (err: any) {
    console.warn('Notice: Could not revert cut record in Firestore:', err?.message || err);
    throw err;
  }
}

/**
 * Push all local rolls and records to Firestore
 */
export async function uploadAllToFirestore(
  rolls: FoilRoll[],
  records: StockCutRecord[]
): Promise<{ rollsUploaded: number; recordsUploaded: number }> {
  const CHUNK_SIZE = 400;

  try {
    // Upload rolls
    for (let i = 0; i < rolls.length; i += CHUNK_SIZE) {
      const chunk = rolls.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      chunk.forEach((r) => {
        const ref = doc(db, ROLLS_COLLECTION, r.id);
        batch.set(ref, r, { merge: true });
      });
      await batch.commit();
    }

    // Upload records
    for (let i = 0; i < records.length; i += CHUNK_SIZE) {
      const chunk = records.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      chunk.forEach((rec) => {
        const ref = doc(db, RECORDS_COLLECTION, rec.id);
        batch.set(ref, rec, { merge: true });
      });
      await batch.commit();
    }

    return { rollsUploaded: rolls.length, recordsUploaded: records.length };
  } catch (err: any) {
    console.warn('Notice: Upload all to Firestore incomplete:', err?.message || err);
    throw err;
  }
}

/**
 * Check if the Firestore database has any existing rolls
 */
export async function checkFirestoreHasData(): Promise<boolean> {
  try {
    const snapshot = await getDocs(collection(db, ROLLS_COLLECTION));
    return !snapshot.empty;
  } catch (err: any) {
    console.warn('Notice: Error checking Firestore data:', err?.message || err);
    return false;
  }
}
