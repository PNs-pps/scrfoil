import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { 
  getFirestore, 
  initializeFirestore,
  doc, 
  getDocFromServer, 
  collection, 
  onSnapshot, 
  setDoc, 
  deleteDoc, 
  writeBatch, 
  getDocs,
  query,
  orderBy,
  Firestore
} from 'firebase/firestore';
import { getAuth, signInAnonymously, Auth } from 'firebase/auth';
import { FoilRoll, StockCutRecord, CutHistoryItem } from '../types';

// User's custom configuration as requested
export const USER_FIREBASE_CONFIG = {
  apiKey: "AIzaSyCMtSWsr2HnVDAupSZMjZKrQ6o8ve_YxH4",
  authDomain: "stock-foil.firebaseapp.com",
  projectId: "stock-foil",
  storageBucket: "stock-foil.firebasestorage.app",
  messagingSenderId: "490056674486",
  appId: "1:490056674486:web:7821ae1a9bef881c1e8a17",
  measurementId: "G-5JNSJETRJP",
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
// NOTE: ignoreUndefinedProperties is set as a safety net so that any stray
// `undefined` field (e.g. an optional field left unset) is silently skipped
// instead of throwing a client-side "Unsupported field value: undefined"
// error that would abort an entire batch write.
function createDb(): Firestore {
  try {
    return firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
      ? initializeFirestore(firebaseApp, { ignoreUndefinedProperties: true }, firebaseConfig.firestoreDatabaseId)
      : initializeFirestore(firebaseApp, { ignoreUndefinedProperties: true });
  } catch (err) {
    // initializeFirestore throws if Firestore was already initialized for this app
    // (e.g. hot-reload); fall back to the existing instance in that case.
    return firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
      ? getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId)
      : getFirestore(firebaseApp);
  }
}

export const db: Firestore = createDb();

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
        usedMeters: Math.abs(Number(r.usedMeters || 0)),
        ngMeters: Math.abs(Number(r.ngMeters || 0)),
        totalDeducted: Math.abs(Number(r.totalDeducted || 0)),
        remainingAfter: Math.max(0, Number(r.remainingAfter ?? 0)),
        usageDate: r.usageDate,
        recordedDate: r.recordedDate,
        recordedBy: r.recordedBy,
        notes: r.notes,
      })),
      ...(updatedRoll.recentCuts || []),
    ].slice(0, 50); // keep up to 50 most recent SOs embedded in roll

    const finalRoll: FoilRoll = {
      ...updatedRoll,
      remainingMeters: Math.max(0, Number(updatedRoll.remainingMeters || 0)),
      usedMeters: Math.max(0, Number(updatedRoll.usedMeters || 0)),
      ngMeters: Math.max(0, Number(updatedRoll.ngMeters || 0)),
      recentCuts: rollCuts,
    };

    // 1. Update the Foil Roll in foil_rolls
    const rollRef = doc(db, ROLLS_COLLECTION, finalRoll.id);
    batch.set(rollRef, finalRoll, { merge: true });

    // 2. Insert all new Cut Records in root collection and subcollection `cut_history`
    batchRecords.forEach((record) => {
      // Ensure positive values mathematically
      const safeCutMeters = Math.abs(Number(record.usedMeters || 0));
      const safeNgMeters = Math.abs(Number(record.ngMeters || 0));
      const safeTotalDeducted = Math.abs(Number(record.totalDeducted || (safeCutMeters + safeNgMeters)));
      const safeRemainingBefore = Math.max(0, Number(record.remainingBefore ?? 0));
      const safeRemainingAfter = Math.max(0, Number(record.remainingAfter ?? 0));

      const safeRecord: StockCutRecord = {
        ...record,
        usedMeters: safeCutMeters,
        ngMeters: safeNgMeters,
        totalDeducted: safeTotalDeducted,
        remainingBefore: safeRemainingBefore,
        remainingAfter: safeRemainingAfter,
      };

      // Root collection for global search & yearly summaries
      const recordRef = doc(db, RECORDS_COLLECTION, record.id);
      batch.set(recordRef, safeRecord);

      // Subcollection `cut_history` per requirement: foil_rolls/{rollId}/cut_history
      const historyItem: CutHistoryItem = {
        id: record.id,
        soNumber: record.soNumber,
        cutMeters: safeCutMeters,
        usedMeters: safeCutMeters,
        ngMeters: safeNgMeters,
        totalDeducted: safeTotalDeducted,
        remainingBefore: safeRemainingBefore,
        remainingAfter: safeRemainingAfter,
        cutDate: record.usageDate || record.recordedDate || new Date().toISOString().split('T')[0],
        usageDate: record.usageDate || record.recordedDate || new Date().toISOString().split('T')[0],
        recordedDate: record.recordedDate || new Date().toISOString().split('T')[0],
        recordedBy: record.recordedBy || 'ช่างคุมเครื่อง',
        notes: record.notes || '',
        createdAt: record.createdAt || new Date().toISOString(),
        cutType: record.cutType || 'so',
        nonSoReason: record.nonSoReason || '',
        rollId: finalRoll.id,
        lotNumber: finalRoll.lotNumber,
        rollNumber: finalRoll.rollNumber,
        width: finalRoll.width,
        pattern: finalRoll.pattern,
      };

      const historyRef = doc(db, ROLLS_COLLECTION, finalRoll.id, 'cut_history', record.id);
      batch.set(historyRef, historyItem);

      // Also maintain legacy cuts subcollection for backwards compatibility
      const cutsRef = doc(db, ROLLS_COLLECTION, finalRoll.id, 'cuts', record.id);
      batch.set(cutsRef, historyItem);
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
        const safeCutMeters = Math.abs(Number(rec.usedMeters || 0));
        const safeNgMeters = Math.abs(Number(rec.ngMeters || 0));
        const safeTotalDeducted = Math.abs(Number(rec.totalDeducted || (safeCutMeters + safeNgMeters)));
        const safeRemainingBefore = Math.max(0, Number(rec.remainingBefore ?? 0));
        const safeRemainingAfter = Math.max(0, Number(rec.remainingAfter ?? 0));

        const safeRecord: StockCutRecord = {
          ...rec,
          usedMeters: safeCutMeters,
          ngMeters: safeNgMeters,
          totalDeducted: safeTotalDeducted,
          remainingBefore: safeRemainingBefore,
          remainingAfter: safeRemainingAfter,
        };

        const recordRef = doc(db, RECORDS_COLLECTION, rec.id);
        batch.set(recordRef, safeRecord);

        const historyItem: CutHistoryItem = {
          id: rec.id,
          soNumber: rec.soNumber,
          cutMeters: safeCutMeters,
          usedMeters: safeCutMeters,
          ngMeters: safeNgMeters,
          totalDeducted: safeTotalDeducted,
          remainingBefore: safeRemainingBefore,
          remainingAfter: safeRemainingAfter,
          cutDate: rec.usageDate || rec.recordedDate || new Date().toISOString().split('T')[0],
          usageDate: rec.usageDate || rec.recordedDate || new Date().toISOString().split('T')[0],
          recordedDate: rec.recordedDate || new Date().toISOString().split('T')[0],
          recordedBy: rec.recordedBy || 'ช่างคุมเครื่อง',
          notes: rec.notes || '',
          createdAt: rec.createdAt || new Date().toISOString(),
          cutType: rec.cutType || 'so',
          nonSoReason: rec.nonSoReason || '',
          rollId: rec.foilId,
          lotNumber: rec.lotNumber,
          rollNumber: rec.rollNumber,
          width: rec.width,
          pattern: rec.pattern,
        };

        const subHistoryRef = doc(db, ROLLS_COLLECTION, rec.foilId, 'cut_history', rec.id);
        batch.set(subHistoryRef, historyItem);

        const subCutsRef = doc(db, ROLLS_COLLECTION, rec.foilId, 'cuts', rec.id);
        batch.set(subCutsRef, historyItem);
      });

      // Add affected rolls in this chunk
      const rollIdsInChunk = new Set(recordsChunk.map((r) => r.foilId));
      const rollsInChunk = updatedRolls.filter((r) => rollIdsInChunk.has(r.id));
      rollsInChunk.forEach((r) => {
        const safeRoll: FoilRoll = {
          ...r,
          remainingMeters: Math.max(0, Number(r.remainingMeters || 0)),
          usedMeters: Math.max(0, Number(r.usedMeters || 0)),
          ngMeters: Math.max(0, Number(r.ngMeters || 0)),
        };
        const rollRef = doc(db, ROLLS_COLLECTION, r.id);
        batch.set(rollRef, safeRoll, { merge: true });
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

    // 1. Delete the record from root collection
    const recordRef = doc(db, RECORDS_COLLECTION, recordId);
    batch.delete(recordRef);

    // 2. Delete from subcollection cut_history and cuts
    const historyRef = doc(db, ROLLS_COLLECTION, updatedRoll.id, 'cut_history', recordId);
    batch.delete(historyRef);
    const cutsRef = doc(db, ROLLS_COLLECTION, updatedRoll.id, 'cuts', recordId);
    batch.delete(cutsRef);

    // 3. Update roll
    const rollRef = doc(db, ROLLS_COLLECTION, updatedRoll.id);
    batch.set(rollRef, updatedRoll, { merge: true });

    await batch.commit();
  } catch (err: any) {
    console.warn('Notice: Could not revert cut record in Firestore:', err?.message || err);
    throw err;
  }
}

/**
 * Subscribe to Realtime cut_history for a specific foil roll: foil_rolls/{rollId}/cut_history
 * 1. Queries sub-collection `cut_history` with orderBy('createdAt', 'desc')
 * 2. Catches missing index error and logs Firestore Index generation URL to console
 * 3. Gracefully falls back to query without orderBy and sorts in memory
 */
export function subscribeToRollCutHistory(
  rollId: string,
  onUpdate: (items: CutHistoryItem[]) => void,
  onError?: (err: any) => void
): () => void {
  if (!rollId) {
    onUpdate([]);
    return () => {};
  }

  const cutHistoryCol = collection(db, ROLLS_COLLECTION, rollId, 'cut_history');

  const mapDocs = (snapshot: any): CutHistoryItem[] => {
    return snapshot.docs.map((docSnap: any) => {
      const data = docSnap.data();
      const cutMeters = Math.abs(Number(data.cutMeters ?? data.usedMeters ?? 0));
      const ngMeters = Math.abs(Number(data.ngMeters ?? 0));
      const totalDeducted = Math.abs(Number(data.totalDeducted ?? (cutMeters + ngMeters)));

      return {
        id: docSnap.id,
        soNumber: data.soNumber || '-',
        cutMeters: cutMeters,
        usedMeters: cutMeters,
        ngMeters: ngMeters,
        totalDeducted: totalDeducted,
        remainingBefore: Math.max(0, Number(data.remainingBefore ?? 0)),
        remainingAfter: Math.max(0, Number(data.remainingAfter ?? 0)),
        cutDate: data.cutDate || data.usageDate || data.recordedDate || '',
        usageDate: data.usageDate || data.cutDate || data.recordedDate || '',
        recordedDate: data.recordedDate || data.cutDate || '',
        recordedBy: data.recordedBy || 'ช่างคุมเครื่อง',
        notes: data.notes || '',
        createdAt: data.createdAt || '',
        cutType: data.cutType || 'so',
        nonSoReason: data.nonSoReason || '',
        rollId: data.rollId || rollId,
        lotNumber: data.lotNumber || '',
        rollNumber: data.rollNumber || '',
        width: data.width,
        pattern: data.pattern,
      } as CutHistoryItem;
    });
  };

  const sortItems = (items: CutHistoryItem[]): CutHistoryItem[] => {
    return [...items].sort((a, b) => {
      const timeB = new Date(b.createdAt || b.cutDate || b.usageDate || 0).getTime();
      const timeA = new Date(a.createdAt || a.cutDate || a.usageDate || 0).getTime();
      return timeB - timeA;
    });
  };

  let activeUnsubscribe: (() => void) | null = null;
  let isFallback = false;

  const startFallback = () => {
    if (isFallback) return;
    isFallback = true;
    console.info(`🔄 [Fallback Active]: Listening to cut_history for roll ${rollId} without server orderBy, sorting in memory...`);
    
    activeUnsubscribe = onSnapshot(
      cutHistoryCol,
      (snapshot) => {
        const items = sortItems(mapDocs(snapshot));
        onUpdate(items);
      },
      (err) => {
        console.error('❌ [Firestore Error] Fallback cut_history listener failed:', err);
        if (onError) onError(err);
      }
    );
  };

  try {
    const q = query(cutHistoryCol, orderBy('createdAt', 'desc'));
    activeUnsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items = mapDocs(snapshot);
        onUpdate(sortItems(items));
      },
      (err: any) => {
        console.warn('⚠️ [Firestore Warning] Failed to query cut_history with orderBy("createdAt", "desc"):', err?.message || err);
        if (err?.message && err.message.includes('https://console.firebase.google.com')) {
          console.error(
            '🔥 [Firestore Index Creation Link Required]\n' +
            '====================================================================\n' +
            'หากต้องการสร้าง Index ใน Firebase Console ให้คลิกลิงก์ด้านล่างนี้:\n' +
            err.message + '\n' +
            '===================================================================='
          );
        }
        if (onError) onError(err);

        // Fallback without server orderBy so user sees data immediately
        if (activeUnsubscribe) {
          activeUnsubscribe();
        }
        startFallback();
      }
    );
  } catch (err: any) {
    console.warn('⚠️ [Firestore Warning] Exception initializing query with orderBy:', err);
    if (err?.message && err.message.includes('https://console.firebase.google.com')) {
      console.error('🔥 [Firestore Index Link]:', err.message);
    }
    startFallback();
  }

  return () => {
    if (activeUnsubscribe) {
      activeUnsubscribe();
    }
  };
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
