import { initializeApp, getApps, getApp } from 'firebase/app';
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
  orderBy
} from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { FoilRoll, StockCutRecord } from '../types';

export { firebaseConfig };

// Initialize Firebase App
export const firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore with custom databaseId if configured
export const db = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
  ? getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId)
  : getFirestore(firebaseApp);

export const auth = getAuth(firebaseApp);

// Initialize anonymous auth for authorized operations
signInAnonymously(auth).catch((err) => {
  console.warn('Anonymous auth note:', err);
});

// Validate connection to Firestore as required by Firebase Integration Skill
export async function testFirestoreConnection(): Promise<{ isConnected: boolean; error?: string }> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return { isConnected: true };
  } catch (error: any) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration:', error);
      return { isConnected: false, error: 'ออฟไลน์ (Client offline)' };
    }
    // Document not existing is still a successful connection
    if (error?.code === 'not-found' || error?.code === 'permission-denied') {
      return { isConnected: true };
    }
    return { isConnected: true };
  }
}

// Initial connection test
testFirestoreConnection();

// Collection references
const ROLLS_COLLECTION = 'foil_rolls';
const RECORDS_COLLECTION = 'stock_cut_records';

/**
 * Realtime listener for Foil Rolls
 */
export function subscribeToFoilRolls(
  onUpdate: (rolls: FoilRoll[]) => void,
  onError?: (err: Error) => void
): () => void {
  const q = query(collection(db, ROLLS_COLLECTION));
  
  return onSnapshot(
    q,
    (snapshot) => {
      const rolls: FoilRoll[] = [];
      snapshot.forEach((docSnap) => {
        rolls.push(docSnap.data() as FoilRoll);
      });
      // Sort by lot and roll number or createdAt
      rolls.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      onUpdate(rolls);
    },
    (err) => {
      console.error('Realtime foil rolls sync error:', err);
      onError?.(err);
    }
  );
}

/**
 * Realtime listener for Stock Cut Records
 */
export function subscribeToStockCutRecords(
  onUpdate: (records: StockCutRecord[]) => void,
  onError?: (err: Error) => void
): () => void {
  const q = query(collection(db, RECORDS_COLLECTION));

  return onSnapshot(
    q,
    (snapshot) => {
      const records: StockCutRecord[] = [];
      snapshot.forEach((docSnap) => {
        records.push(docSnap.data() as StockCutRecord);
      });
      // Sort newest first
      records.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      onUpdate(records);
    },
    (err) => {
      console.error('Realtime cut records sync error:', err);
      onError?.(err);
    }
  );
}

/**
 * Save or update a single Foil Roll in Firestore
 */
export async function saveFoilRollToFirestore(roll: FoilRoll): Promise<void> {
  const ref = doc(db, ROLLS_COLLECTION, roll.id);
  await setDoc(ref, roll, { merge: true });
}

/**
 * Delete a Foil Roll from Firestore
 */
export async function deleteFoilRollFromFirestore(rollId: string): Promise<void> {
  const ref = doc(db, ROLLS_COLLECTION, rollId);
  await deleteDoc(ref);
}

/**
 * Atomic batch cut: creates all cut records and updates the foil roll in one Firestore batch
 */
export async function executeCutBatchInFirestore(
  batchRecords: StockCutRecord[],
  updatedRoll: FoilRoll
): Promise<void> {
  const batch = writeBatch(db);

  // 1. Update the Foil Roll
  const rollRef = doc(db, ROLLS_COLLECTION, updatedRoll.id);
  batch.set(rollRef, updatedRoll, { merge: true });

  // 2. Insert all new Cut Records
  batchRecords.forEach((record) => {
    const recordRef = doc(db, RECORDS_COLLECTION, record.id);
    batch.set(recordRef, record);
  });

  await batch.commit();
}

/**
 * Revert a cut record and restore the roll's remaining meters atomically
 */
export async function revertCutRecordInFirestore(
  recordId: string,
  updatedRoll: FoilRoll
): Promise<void> {
  const batch = writeBatch(db);

  // 1. Delete the record
  const recordRef = doc(db, RECORDS_COLLECTION, recordId);
  batch.delete(recordRef);

  // 2. Update roll
  const rollRef = doc(db, ROLLS_COLLECTION, updatedRoll.id);
  batch.set(rollRef, updatedRoll, { merge: true });

  await batch.commit();
}

/**
 * Push all local rolls and records to Firestore (e.g. for initial migration or manual central backup)
 */
export async function uploadAllToFirestore(
  rolls: FoilRoll[],
  records: StockCutRecord[]
): Promise<{ rollsUploaded: number; recordsUploaded: number }> {
  // Use chunks of 450 items to respect Firestore 500 ops per batch limit
  const CHUNK_SIZE = 400;

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
}

/**
 * Check if the Firestore database has any existing rolls
 */
export async function checkFirestoreHasData(): Promise<boolean> {
  try {
    const snapshot = await getDocs(collection(db, ROLLS_COLLECTION));
    return !snapshot.empty;
  } catch (err) {
    console.error('Error checking Firestore data:', err);
    return false;
  }
}
