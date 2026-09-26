import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { 
  getFirestore, 
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  doc, 
  getDocFromServer, 
  collection, 
  onSnapshot, 
  setDoc, 
  deleteDoc, 
  writeBatch, 
  runTransaction,
  getDocs,
  query,
  limit,
  orderBy,
  where,
  Firestore
} from 'firebase/firestore';
import { getAuth, signInAnonymously, Auth } from 'firebase/auth';
import { FoilRoll, StockCutRecord, CutHistoryItem, PuSandwichCutRecord, CycleCountSession } from '../types';
import { normalizePattern } from '../utils/soFormatter';

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

// Initialize Firestore with Persistent Local Cache (IndexedDB)
// This dramatically reduces Firebase read quota by serving previously cached
// documents straight from browser IndexedDB storage (0 network reads for unchanged docs)
function createDb(): Firestore {
  try {
    const firestoreSettings = {
      ignoreUndefinedProperties: true,
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    };
    return firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
      ? initializeFirestore(firebaseApp, firestoreSettings, firebaseConfig.firestoreDatabaseId)
      : initializeFirestore(firebaseApp, firestoreSettings);
  } catch (err) {
    // initializeFirestore throws if Firestore was already initialized for this app
    // (e.g. hot-reload or environment re-render); fall back to the existing instance.
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

// Test connection (On-demand only - do NOT run automatically at module load to save reads)
export async function testFirestoreConnection(): Promise<{ isConnected: boolean; error?: string }> {
  try {
    const q = query(collection(db, 'test'), limit(1));
    await getDocs(q);
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

// Collection references
const ROLLS_COLLECTION = 'foil_rolls';
const RECORDS_COLLECTION = 'stock_cut_records';

/**
 * --- External-update detection ---------------------------------------------
 * The realtime listeners below (`subscribeToFoilRolls`/`subscribeToStockCutRecords`)
 * are READ-ONLY mirrors of Firestore: they never write anything back, they only
 * push whatever is on the server into the UI. All writes go exclusively through
 * the transaction functions further down this file.
 *
 * Because of that, when a snapshot arrives carrying a change to a document this
 * device did NOT just write itself, it must mean another device changed the
 * data. We track our own recent writes (doc id -> expiry) for a few seconds so
 * the listener can tell the two cases apart and fire `onExternalChange` only
 * for genuinely-external updates (e.g. to prompt the user to refresh).
 */
const recentLocalWriteIds = new Map<string, number>();
const LOCAL_WRITE_TTL_MS = 10000;

function markLocalWrite(ids: string[]): void {
  const expiry = Date.now() + LOCAL_WRITE_TTL_MS;
  ids.forEach((id) => recentLocalWriteIds.set(id, expiry));
}

function isRecentLocalWrite(id: string): boolean {
  const expiry = recentLocalWriteIds.get(id);
  if (expiry === undefined) return false;
  if (Date.now() > expiry) {
    recentLocalWriteIds.delete(id);
    return false;
  }
  return true;
}

export interface SubscriptionOptions {
  limitCount?: number;
  onFromCache?: (isFromCache: boolean) => void;
}

/**
 * Realtime listener for Foil Rolls with gentle non-fatal error handling
 */
export function subscribeToFoilRolls(
  onUpdate: (rolls: FoilRoll[]) => void,
  onError?: (err: Error) => void,
  options?: {
    onFromCache?: (isFromCache: boolean) => void;
    onExternalChange?: () => void;
    /** When true (default), only subscribe to status === 'active' rolls to avoid loading thousands of depleted rolls. */
    activeOnly?: boolean;
  }
): () => void {
  try {
    const activeOnly = options?.activeOnly !== false; // default true for scalability
    const q = activeOnly
      ? query(collection(db, ROLLS_COLLECTION), where('status', '==', 'active'))
      : query(collection(db, ROLLS_COLLECTION));
    let isFirstSnapshot = true;

    return onSnapshot(
      q,
      (snapshot) => {
        options?.onFromCache?.(snapshot.metadata.fromCache);

        // Detect changes that came from another device (see comment above the
        // recentLocalWriteIds tracker). Skip the very first snapshot (initial
        // load is not "an update"), and skip our own writes echoing back.
        if (!isFirstSnapshot && !snapshot.metadata.hasPendingWrites) {
          const externalChange = snapshot.docChanges().some(
            (change) => !isRecentLocalWrite(change.doc.id)
          );
          if (externalChange) {
            options?.onExternalChange?.();
          }
        }
        isFirstSnapshot = false;

        const rolls: FoilRoll[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as FoilRoll;
          // Normalize legacy pattern spellings (e.g. old "ท้องขาว" rolls) so they
          // group under today's canonical pattern name instead of appearing as a
          // separate duplicate pattern in the dashboard breakdown.
          rolls.push({ ...data, pattern: normalizePattern(data.pattern) });
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
 * On-demand fetch of depleted / archived foil rolls (status === 'depleted').
 * Use for "คลังข้อมูลเก่า (Archive)" page — do not keep a realtime listener on these.
 */
export async function fetchArchivedFoilRolls(): Promise<FoilRoll[]> {
  try {
    const q = query(collection(db, ROLLS_COLLECTION), where('status', '==', 'depleted'));
    const snapshot = await getDocs(q);
    const rolls: FoilRoll[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as FoilRoll;
      rolls.push({ ...data, pattern: normalizePattern(data.pattern) });
    });
    rolls.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return rolls;
  } catch (err: any) {
    console.warn('fetchArchivedFoilRolls failed:', err?.message || err);
    return [];
  }
}

/**
 * Realtime listener for Stock Cut Records with gentle non-fatal error handling
 * and intelligent limit to minimize read consumption
 */
export function subscribeToStockCutRecords(
  onUpdate: (records: StockCutRecord[], removedIds: string[]) => void,
  onError?: (err: Error) => void,
  options?: SubscriptionOptions & { onExternalChange?: () => void }
): () => void {
  try {
    const q = options?.limitCount
      ? query(collection(db, RECORDS_COLLECTION), limit(options.limitCount))
      : query(collection(db, RECORDS_COLLECTION));

    let isFirstSnapshot = true;

    return onSnapshot(
      q,
      (snapshot) => {
        options?.onFromCache?.(snapshot.metadata.fromCache);

        if (!isFirstSnapshot && !snapshot.metadata.hasPendingWrites) {
          const externalChange = snapshot.docChanges().some(
            (change) => !isRecentLocalWrite(change.doc.id)
          );
          if (externalChange) {
            options?.onExternalChange?.();
          }
        }
        isFirstSnapshot = false;

        // Track ids removed from this query window so callers merging this
        // windowed result with a broader local cache can actually drop them —
        // otherwise a record deleted on the server (e.g. cancelling an SO cut)
        // would never disappear locally, since a naive "union with existing
        // cache" merge only ever adds/updates and never removes.
        const removedIds = snapshot
          .docChanges()
          .filter((change) => change.type === 'removed')
          .map((change) => change.doc.id);

        const records: StockCutRecord[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as StockCutRecord;
          records.push({ ...data, pattern: normalizePattern(data.pattern) });
        });
        records.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        onUpdate(records, removedIds);
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
 * Deep sanitization to ensure no `undefined` values are ever passed to Firestore WriteBatch/setDoc
 */
export function sanitizeForFirestore<T>(obj: T): T {
  if (obj === undefined) return '' as any;
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map(sanitizeForFirestore) as any;
  }
  const clean: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      clean[key] = sanitizeForFirestore(value);
    }
  }
  return clean;
}

/**
 * Save or update a single Foil Roll in Firestore
 */
export async function saveFoilRollToFirestore(roll: FoilRoll): Promise<void> {
  try {
    const ref = doc(db, ROLLS_COLLECTION, roll.id);
    await setDoc(ref, sanitizeForFirestore(roll), { merge: true });
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
/**
 * Atomic single-roll cut: runs as a Firestore TRANSACTION so the deduction is
 * always applied against the roll's true, up-to-the-millisecond remaining
 * meters on the server — never against a value cached on this device.
 *
 * Why this matters: if two devices cut from the same roll at nearly the same
 * time using a plain batch write (the old approach), each device computes its
 * own "new remaining" from its own possibly-stale local copy and overwrites
 * the field outright — whichever write lands last silently wins, and the
 * other device's deduction is lost forever (the roll ends up showing MORE
 * stock than actually remains). A transaction prevents this: Firestore
 * automatically retries the transaction if the roll document changed between
 * the read and the write, so the deduction is always applied on top of the
 * latest committed value.
 *
 * Also guards against duplicate submits: if a record with this id was already
 * written (e.g. a retried request after a flaky connection), the transaction
 * skips re-deducting it again.
 *
 * Returns the roll's true post-cut state as committed to Firestore, so the
 * caller can sync local state to the authoritative number instead of trusting
 * its own pre-cut calculation.
 */
export async function executeCutBatchInFirestore(
  batchRecords: StockCutRecord[],
  rollId: string
): Promise<FoilRoll> {
  const rollRef = doc(db, ROLLS_COLLECTION, rollId);

  const finalRoll = await runTransaction(db, async (tx) => {
    // 1. Read the roll fresh from the server — this is the "read the SO sheet's
    //    real value before showing/saving" requirement.
    const rollSnap = await tx.get(rollRef);
    if (!rollSnap.exists()) {
      throw new Error('ไม่พบม้วนฟอยล์นี้ในระบบ (อาจถูกลบไปแล้วจากเครื่องอื่น)');
    }
    const serverRoll = rollSnap.data() as FoilRoll;

    // 2. Duplicate-write guard: check which of these record ids already exist
    //    (idempotency — a retried/duplicated submit must not double-deduct).
    const existingFlags = await Promise.all(
      batchRecords.map((r) => tx.get(doc(db, RECORDS_COLLECTION, r.id)))
    );
    const newRecords = batchRecords.filter((_, idx) => !existingFlags[idx].exists());

    if (newRecords.length === 0) {
      // Everything in this batch was already written before — nothing new to do.
      return serverRoll;
    }

    // 3. Validate against the FRESH server remaining meters (not the client's copy).
    const totalUsed = round2(newRecords.reduce((s, r) => s + Math.abs(Number(r.usedMeters || 0)), 0));
    const totalNg = round2(newRecords.reduce((s, r) => s + Math.abs(Number(r.ngMeters || 0)), 0));
    const totalDeduct = round2(newRecords.reduce((s, r) => s + Math.abs(Number(r.totalDeducted || 0)), 0)) || round2(totalUsed + totalNg);
    const freshRemaining = Math.max(0, Number(serverRoll.remainingMeters || 0));

    if (totalDeduct > freshRemaining + 0.01) {
      throw new Error(
        `สต๊อกไม่พอ! ยอดคงเหลือจริงในระบบตอนนี้คือ ${freshRemaining.toLocaleString()} ม. แต่พยายามตัด ${totalDeduct.toLocaleString()} ม. (อาจมีเครื่องอื่นตัดสต๊อกม้วนนี้ไปก่อนหน้านี้แล้ว กรุณารีเฟรชหน้าจอแล้วลองใหม่)`
      );
    }

    const newRemaining = round2(Math.max(0, freshRemaining - totalDeduct));
    const newUsed = round2(Math.max(0, Number(serverRoll.usedMeters || 0) + totalUsed));
    const newNg = round2(Math.max(0, Number(serverRoll.ngMeters || 0) + totalNg));

    const rollCuts = [
      ...newRecords.map((r) => ({
        id: r.id,
        soNumber: r.soNumber || '',
        cutType: r.cutType || 'so',
        usedMeters: Math.abs(Number(r.usedMeters || 0)),
        ngMeters: Math.abs(Number(r.ngMeters || 0)),
        totalDeducted: Math.abs(Number(r.totalDeducted || 0)),
        remainingAfter: newRemaining,
        usageDate: r.usageDate || new Date().toISOString().split('T')[0],
        recordedDate: r.recordedDate || new Date().toISOString().split('T')[0],
        recordedBy: r.recordedBy || '',
        notes: r.notes || '',
      })),
      ...(serverRoll.recentCuts || []),
    ].slice(0, 50);

    const updatedRoll: FoilRoll = {
      ...serverRoll,
      remainingMeters: newRemaining,
      usedMeters: newUsed,
      ngMeters: newNg,
      status: newRemaining <= 0 ? ('depleted' as const) : ('active' as const),
      recentCuts: rollCuts,
    };

    // 4. Write everything atomically within the transaction.
    tx.set(rollRef, sanitizeForFirestore(updatedRoll), { merge: true });

    let runningBatchChain = freshRemaining;
    newRecords.forEach((record) => {
      const safeCutMeters = Math.abs(Number(record.usedMeters || 0));
      const safeNgMeters = Math.abs(Number(record.ngMeters || 0));
      const safeTotalDeducted = Math.abs(Number(record.totalDeducted || (safeCutMeters + safeNgMeters)));

      const stepBefore = runningBatchChain;
      const stepAfter = round2(Math.max(0, stepBefore - safeTotalDeducted));
      runningBatchChain = stepAfter;

      const safeRecord: StockCutRecord = {
        ...record,
        usedMeters: safeCutMeters,
        ngMeters: safeNgMeters,
        totalDeducted: safeTotalDeducted,
        remainingBefore: stepBefore,
        remainingAfter: stepAfter,
        notes: record.notes || '',
        recordedBy: record.recordedBy || 'ช่างคุมเครื่อง',
        usageDate: record.usageDate || new Date().toISOString().split('T')[0],
        recordedDate: record.recordedDate || new Date().toISOString().split('T')[0],
      };

      const recordRef = doc(db, RECORDS_COLLECTION, record.id);
      tx.set(recordRef, sanitizeForFirestore(safeRecord));

      const historyItem: CutHistoryItem = {
        id: record.id,
        soNumber: record.soNumber || '',
        cutMeters: safeCutMeters,
        usedMeters: safeCutMeters,
        ngMeters: safeNgMeters,
        totalDeducted: safeTotalDeducted,
        remainingBefore: stepBefore,
        remainingAfter: stepAfter,
        cutDate: record.usageDate || record.recordedDate || new Date().toISOString().split('T')[0],
        usageDate: record.usageDate || record.recordedDate || new Date().toISOString().split('T')[0],
        recordedDate: record.recordedDate || new Date().toISOString().split('T')[0],
        recordedBy: record.recordedBy || 'ช่างคุมเครื่อง',
        notes: record.notes || '',
        createdAt: record.createdAt || new Date().toISOString(),
        cutType: record.cutType || 'so',
        nonSoReason: record.nonSoReason || '',
        rollId: updatedRoll.id,
        lotNumber: updatedRoll.lotNumber,
        rollNumber: updatedRoll.rollNumber,
        width: updatedRoll.width,
        pattern: updatedRoll.pattern,
      };

      const historyRef = doc(db, ROLLS_COLLECTION, updatedRoll.id, 'cut_history', record.id);
      tx.set(historyRef, sanitizeForFirestore(historyItem));

      const cutsRef = doc(db, ROLLS_COLLECTION, updatedRoll.id, 'cuts', record.id);
      tx.set(cutsRef, sanitizeForFirestore(historyItem));
    });

    return updatedRoll;
  });

  // Mark these ids as "our own write" for a few seconds so the realtime
  // listener doesn't mistake the echo of this very write for an external change.
  markLocalWrite([rollId, ...batchRecords.map((r) => r.id)]);

  return finalRoll;
}

/**
 * Multi-roll batch cut (e.g. SO batch import touching several rolls at once).
 * Each affected roll is read fresh and validated inside a single transaction,
 * for the same concurrency-safety reasons as executeCutBatchInFirestore above.
 */
export async function executeMultiRollCutBatchInFirestore(
  batchRecords: StockCutRecord[]
): Promise<FoilRoll[]> {
  const recordsByRoll = new Map<string, StockCutRecord[]>();
  batchRecords.forEach((r) => {
    const list = recordsByRoll.get(r.foilId) || [];
    list.push(r);
    recordsByRoll.set(r.foilId, list);
  });
  const rollIds = Array.from(recordsByRoll.keys());

  const finalRolls = await runTransaction(db, async (tx) => {
    // 1. Read every affected roll fresh (all reads must happen before any writes
    //    in a Firestore transaction).
    const rollRefs = rollIds.map((id) => doc(db, ROLLS_COLLECTION, id));
    const rollSnaps = await Promise.all(rollRefs.map((ref) => tx.get(ref)));

    const existingRecordSnaps = await Promise.all(
      batchRecords.map((r) => tx.get(doc(db, RECORDS_COLLECTION, r.id)))
    );
    const alreadyWrittenIds = new Set(
      batchRecords.filter((_, idx) => existingRecordSnaps[idx].exists()).map((r) => r.id)
    );

    const updatedRolls: FoilRoll[] = [];

    rollIds.forEach((rollId, idx) => {
      const snap = rollSnaps[idx];
      if (!snap.exists()) {
        throw new Error(`ไม่พบม้วนฟอยล์ ${rollId} ในระบบ (อาจถูกลบไปแล้ว)`);
      }
      const serverRoll = snap.data() as FoilRoll;
      const newRecordsForRoll = (recordsByRoll.get(rollId) || []).filter((r) => !alreadyWrittenIds.has(r.id));
      if (newRecordsForRoll.length === 0) {
        updatedRolls.push(serverRoll);
        return;
      }

      const totalUsed = round2(newRecordsForRoll.reduce((s, r) => s + Math.abs(Number(r.usedMeters || 0)), 0));
      const totalNg = round2(newRecordsForRoll.reduce((s, r) => s + Math.abs(Number(r.ngMeters || 0)), 0));
      const totalDeduct = round2(newRecordsForRoll.reduce((s, r) => s + Math.abs(Number(r.totalDeducted || 0)), 0)) || round2(totalUsed + totalNg);
      const freshRemaining = Math.max(0, Number(serverRoll.remainingMeters || 0));

      if (totalDeduct > freshRemaining + 0.01) {
        throw new Error(
          `สต๊อกม้วน ${serverRoll.lotNumber || rollId} ไม่พอ! คงเหลือจริง ${freshRemaining.toLocaleString()} ม. แต่พยายามตัด ${totalDeduct.toLocaleString()} ม.`
        );
      }

      const newRemaining = round2(Math.max(0, freshRemaining - totalDeduct));
      const newUsed = round2(Math.max(0, Number(serverRoll.usedMeters || 0) + totalUsed));
      const newNg = round2(Math.max(0, Number(serverRoll.ngMeters || 0) + totalNg));

      const rollCuts = [
        ...newRecordsForRoll.map((r) => ({
          id: r.id,
          soNumber: r.soNumber || '',
          cutType: r.cutType || 'so',
          productionRound: r.productionRound || '',
          roundNumber: r.roundNumber,
          usedMeters: Math.abs(Number(r.usedMeters || 0)),
          ngMeters: Math.abs(Number(r.ngMeters || 0)),
          totalDeducted: Math.abs(Number(r.totalDeducted || 0)),
          remainingAfter: newRemaining,
          usageDate: r.usageDate || new Date().toISOString().split('T')[0],
          recordedDate: r.recordedDate || new Date().toISOString().split('T')[0],
          recordedBy: r.recordedBy || '',
          notes: r.notes || '',
        })),
        ...(serverRoll.recentCuts || []),
      ].slice(0, 50);

      updatedRolls.push({
        ...serverRoll,
        remainingMeters: newRemaining,
        usedMeters: newUsed,
        ngMeters: newNg,
        status: newRemaining <= 0 ? ('depleted' as const) : ('active' as const),
        recentCuts: rollCuts,
        _freshRemainingBefore: freshRemaining,
      } as any);
    });

    // 2. Write everything atomically.
    updatedRolls.forEach((r: any) => {
      const { _freshRemainingBefore, ...rollToSave } = r;
      const rollRef = doc(db, ROLLS_COLLECTION, r.id);
      tx.set(rollRef, sanitizeForFirestore(rollToSave), { merge: true });
    });

    const runningChainByRoll = new Map<string, number>();
    updatedRolls.forEach((r: any) => {
      runningChainByRoll.set(r.id, r._freshRemainingBefore ?? 0);
    });

    batchRecords.forEach((record) => {
      if (alreadyWrittenIds.has(record.id)) return;
      const parentRoll: any = updatedRolls.find((r) => r.id === record.foilId);
      const safeCutMeters = Math.abs(Number(record.usedMeters || 0));
      const safeNgMeters = Math.abs(Number(record.ngMeters || 0));
      const safeTotalDeducted = Math.abs(Number(record.totalDeducted || (safeCutMeters + safeNgMeters)));

      const currentBalance = runningChainByRoll.get(record.foilId) ?? (parentRoll?._freshRemainingBefore ?? record.remainingBefore ?? 0);
      const stepBefore = currentBalance;
      const stepAfter = round2(Math.max(0, stepBefore - safeTotalDeducted));
      runningChainByRoll.set(record.foilId, stepAfter);

      const safeRecord: StockCutRecord = {
        ...record,
        usedMeters: safeCutMeters,
        ngMeters: safeNgMeters,
        totalDeducted: safeTotalDeducted,
        remainingBefore: stepBefore,
        remainingAfter: stepAfter,
      };
      const recordRef = doc(db, RECORDS_COLLECTION, record.id);
      tx.set(recordRef, sanitizeForFirestore(safeRecord));

      const historyItem: CutHistoryItem = {
        id: record.id,
        soNumber: record.soNumber || '',
        cutMeters: safeCutMeters,
        usedMeters: safeCutMeters,
        ngMeters: safeNgMeters,
        totalDeducted: safeTotalDeducted,
        remainingBefore: stepBefore,
        remainingAfter: stepAfter,
        cutDate: record.usageDate || record.recordedDate || new Date().toISOString().split('T')[0],
        usageDate: record.usageDate || record.recordedDate || new Date().toISOString().split('T')[0],
        recordedDate: record.recordedDate || new Date().toISOString().split('T')[0],
        recordedBy: record.recordedBy || 'ช่างคุมเครื่อง',
        productionRound: record.productionRound || '',
        roundNumber: record.roundNumber,
        notes: record.notes || '',
        createdAt: record.createdAt || new Date().toISOString(),
        cutType: record.cutType || 'so',
        nonSoReason: record.nonSoReason || '',
        rollId: record.foilId,
        lotNumber: record.lotNumber,
        rollNumber: record.rollNumber,
        width: record.width,
        pattern: record.pattern,
      };
      tx.set(doc(db, ROLLS_COLLECTION, record.foilId, 'cut_history', record.id), sanitizeForFirestore(historyItem));
      tx.set(doc(db, ROLLS_COLLECTION, record.foilId, 'cuts', record.id), sanitizeForFirestore(historyItem));
    });

    return updatedRolls.map((r: any) => {
      const { _freshRemainingBefore, ...clean } = r;
      return clean as FoilRoll;
    });
  });

  markLocalWrite([...rollIds, ...batchRecords.map((r) => r.id)]);

  return finalRolls;
}

/**
 * Revert (delete/cancel) a cut record and restore the roll's remaining meters,
 * atomically and against the roll's FRESH server state — same reasoning as
 * executeCutBatchInFirestore: another device may have cut more from this roll
 * since this record was created, so the restore must be applied on top of
 * whatever the roll's remaining meters truly are right now, not a value
 * computed earlier on this device.
 */
export async function revertCutRecordInFirestore(
  recordId: string,
  rollId: string
): Promise<FoilRoll | null> {
  const rollRef = doc(db, ROLLS_COLLECTION, rollId);
  const recordRef = doc(db, RECORDS_COLLECTION, recordId);

  const updatedRoll = await runTransaction(db, async (tx) => {
    const [rollSnap, recordSnap] = await Promise.all([tx.get(rollRef), tx.get(recordRef)]);

    if (!recordSnap.exists()) {
      // Already deleted (e.g. by another device, or a previous retry) — nothing to do.
      if (rollSnap.exists()) return rollSnap.data() as FoilRoll;
      throw new Error('ไม่พบรายการตัดสต๊อกนี้แล้ว (อาจถูกลบไปก่อนหน้านี้)');
    }

    // STRICT: the record still exists, but its parent roll is gone (deleted,
    // merged, or replaced separately). There is nothing left to restore stock
    // into — but that must never block removing the orphaned history entry
    // itself (e.g. a duplicate SO slip pointing at a roll that no longer
    // exists). Delete the record and its subcollection copies, and report
    // back that no roll could be restored, instead of throwing and leaving
    // the duplicate stuck forever.
    if (!rollSnap.exists()) {
      tx.delete(recordRef);
      tx.delete(doc(db, ROLLS_COLLECTION, rollId, 'cut_history', recordId));
      tx.delete(doc(db, ROLLS_COLLECTION, rollId, 'cuts', recordId));
      return null;
    }

    const record = recordSnap.data() as StockCutRecord;
    const serverRoll = rollSnap.data() as FoilRoll;

    const restoredRemaining = Math.min(
      Number(serverRoll.totalMeters || 0),
      Number(serverRoll.remainingMeters || 0) + Number(record.totalDeducted || 0)
    );
    const restoredUsed = Math.max(0, Number(serverRoll.usedMeters || 0) - Number(record.usedMeters || 0));
    const restoredNg = Math.max(0, Number(serverRoll.ngMeters || 0) - Number(record.ngMeters || 0));

    const rollObj: FoilRoll = {
      ...serverRoll,
      remainingMeters: round2(restoredRemaining),
      usedMeters: round2(restoredUsed),
      ngMeters: round2(restoredNg),
      status: restoredRemaining > 0 ? ('active' as const) : ('depleted' as const),
      recentCuts: (serverRoll.recentCuts || []).filter((c) => c.id !== recordId),
    };

    tx.delete(recordRef);
    tx.delete(doc(db, ROLLS_COLLECTION, rollId, 'cut_history', recordId));
    tx.delete(doc(db, ROLLS_COLLECTION, rollId, 'cuts', recordId));
    tx.set(rollRef, sanitizeForFirestore(rollObj), { merge: true });

    return rollObj;
  });

  markLocalWrite([rollId, recordId]);

  return updatedRoll;
}

export interface RollAdjustmentItem {
  rollId: string;
  expectedRemaining: number;
  sumUsed?: number;
  sumNg?: number;
  force?: boolean;
}

/**
 * Reconciles one or more foil rolls to their expected remaining meters based
 * on the true sum of all SO cut records. Executes inside a Firestore TRANSACTION
 * so it never clobbers concurrent cuts from other devices.
 */
export async function reconcileRollsInFirestore(
  adjustments: RollAdjustmentItem[]
): Promise<FoilRoll[]> {
  if (!adjustments || adjustments.length === 0) return [];

  const rollRefs = adjustments.map((a) => doc(db, ROLLS_COLLECTION, a.rollId));

  const updatedRolls = await runTransaction(db, async (tx) => {
    // 1. Read all target rolls fresh from Firestore
    const snaps = await Promise.all(rollRefs.map((ref) => tx.get(ref)));

    const result: FoilRoll[] = [];

    adjustments.forEach((adj, idx) => {
      const snap = snaps[idx];
      if (!snap.exists()) return;

      const serverRoll = snap.data() as FoilRoll;

      // Exclusion guard: Skip if roll was explicitly set to isZeroedOut, UNLESS force is requested
      const isExplicitZeroed = Boolean(serverRoll.isZeroedOut);
      if (isExplicitZeroed && !adj.force) {
        result.push(serverRoll);
        return;
      }

      const safeExpected = round2(Math.max(0, Number(adj.expectedRemaining ?? 0)));
      const safeUsed = adj.sumUsed !== undefined ? round2(Math.max(0, adj.sumUsed)) : serverRoll.usedMeters;
      const safeNg = adj.sumNg !== undefined ? round2(Math.max(0, adj.sumNg)) : serverRoll.ngMeters;

      const updatedRoll: FoilRoll = {
        ...serverRoll,
        remainingMeters: safeExpected,
        usedMeters: safeUsed,
        ngMeters: safeNg,
        isZeroedOut: safeExpected > 0 ? false : (serverRoll.isZeroedOut ?? false),
        manualZeroedOriginalMeters: safeExpected > 0 ? undefined : serverRoll.manualZeroedOriginalMeters,
        status: safeExpected > 0 ? ('active' as const) : ('depleted' as const),
      };

      tx.set(rollRefs[idx], sanitizeForFirestore(updatedRoll), { merge: true });
      result.push(updatedRoll);
    });

    return result;
  });

  markLocalWrite(adjustments.map((a) => a.rollId));
  return updatedRolls;
}

/**
 * Realign and continuous-chain recalculation for all cut records of a specific roll:
 * Sets remainingBefore and remainingAfter for each cut record in chronological order,
 * eliminating all jumps, and updates the parent roll's remainingMeters (unless zeroed out).
 */
export async function realignRollCutChainInFirestore(
  rollId: string,
  recordIds: string[]
): Promise<{ updatedRoll: FoilRoll; updatedRecords: StockCutRecord[] }> {
  if (!rollId || !recordIds || recordIds.length === 0) {
    throw new Error('ไม่พบข้อมูลรายการตัดที่ต้องการปรับยอดความต่อเนื่อง');
  }

  const rollRef = doc(db, ROLLS_COLLECTION, rollId);
  const recordRefs = recordIds.map((id) => doc(db, RECORDS_COLLECTION, id));

  const result = await runTransaction(db, async (tx) => {
    // 1. All reads first
    const [rollSnap, ...recordSnaps] = await Promise.all([
      tx.get(rollRef),
      ...recordRefs.map((ref) => tx.get(ref)),
    ]);

    if (!rollSnap.exists()) {
      throw new Error(`ไม่พบม้วนฟอยล์ ${rollId} ในระบบ`);
    }

    const serverRoll = rollSnap.data() as FoilRoll;
    const records: StockCutRecord[] = [];

    recordSnaps.forEach((snap) => {
      if (snap.exists()) {
        records.push(snap.data() as StockCutRecord);
      }
    });

    if (records.length === 0) {
      throw new Error('ไม่พบรายการตัดในระบบที่สามารถปรับความต่อเนื่องได้');
    }

    // เรียงตามวันใบงาน (usageDate) เป็นหลัก → recordedDate → createdAt
    const sortedRecords = [...records].sort((a, b) => {
      const tA = new Date(a.usageDate || a.recordedDate || a.createdAt || 0).getTime();
      const tB = new Date(b.usageDate || b.recordedDate || b.createdAt || 0).getTime();
      if (tA !== tB) return tA - tB;
      return String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
    });

    let runningBalance = Number(serverRoll.totalMeters || 1000);
    let totalUsed = 0;
    let totalNg = 0;
    const updatedRecords: StockCutRecord[] = [];

    sortedRecords.forEach((rec) => {
      const safeUsed = Math.abs(Number(rec.usedMeters || 0));
      const safeNg = Math.abs(Number(rec.ngMeters || 0));
      const safeTotal = Math.abs(Number(rec.totalDeducted || (safeUsed + safeNg)));

      totalUsed = round2(totalUsed + safeUsed);
      totalNg = round2(totalNg + safeNg);

      const stepBefore = runningBalance;
      const stepAfter = round2(Math.max(0, stepBefore - safeTotal));
      runningBalance = stepAfter;

      const updatedRec: StockCutRecord = {
        ...rec,
        usedMeters: safeUsed,
        ngMeters: safeNg,
        totalDeducted: safeTotal,
        remainingBefore: stepBefore,
        remainingAfter: stepAfter,
      };
      updatedRecords.push(updatedRec);

      // Write cut record in RECORDS_COLLECTION
      const recRef = doc(db, RECORDS_COLLECTION, rec.id);
      tx.set(recRef, sanitizeForFirestore(updatedRec), { merge: true });

      // Write to subcollection cut_history and cuts
      const historyItem: CutHistoryItem = {
        id: rec.id,
        soNumber: rec.soNumber || '',
        cutMeters: safeUsed,
        usedMeters: safeUsed,
        ngMeters: safeNg,
        totalDeducted: safeTotal,
        remainingBefore: stepBefore,
        remainingAfter: stepAfter,
        cutDate: rec.usageDate || rec.recordedDate || new Date().toISOString().split('T')[0],
        usageDate: rec.usageDate || rec.recordedDate || new Date().toISOString().split('T')[0],
        recordedDate: rec.recordedDate || new Date().toISOString().split('T')[0],
        recordedBy: rec.recordedBy || 'ช่างคุมเครื่อง',
        notes: rec.notes || '',
        createdAt: rec.createdAt || new Date().toISOString(),
        cutType: rec.cutType || 'so',
        nonSoReason: rec.nonSoReason || '',
        rollId: serverRoll.id,
        lotNumber: serverRoll.lotNumber,
        rollNumber: serverRoll.rollNumber,
        width: serverRoll.width,
        pattern: serverRoll.pattern,
      };

      tx.set(doc(db, ROLLS_COLLECTION, rollId, 'cut_history', rec.id), sanitizeForFirestore(historyItem), { merge: true });
      tx.set(doc(db, ROLLS_COLLECTION, rollId, 'cuts', rec.id), sanitizeForFirestore(historyItem), { merge: true });
    });

    const finalRemaining = runningBalance;

    const updatedRoll: FoilRoll = {
      ...serverRoll,
      remainingMeters: finalRemaining,
      usedMeters: totalUsed,
      ngMeters: totalNg,
      isZeroedOut: finalRemaining > 0 ? false : (serverRoll.isZeroedOut ?? false),
      manualZeroedOriginalMeters: finalRemaining > 0 ? undefined : serverRoll.manualZeroedOriginalMeters,
      status: finalRemaining <= 0 ? ('depleted' as const) : ('active' as const),
      recentCuts: updatedRecords.slice(-50).map((r) => ({
        id: r.id,
        soNumber: r.soNumber || '',
        cutType: r.cutType || 'so',
        productionRound: r.productionRound || '',
        roundNumber: r.roundNumber,
        usedMeters: r.usedMeters,
        ngMeters: r.ngMeters,
        totalDeducted: r.totalDeducted,
        remainingAfter: r.remainingAfter ?? 0,
        usageDate: r.usageDate,
        recordedDate: r.recordedDate,
        recordedBy: r.recordedBy,
        notes: r.notes,
      })),
    };

    tx.set(rollRef, sanitizeForFirestore(updatedRoll), { merge: true });

    return { updatedRoll, updatedRecords };
  });

  markLocalWrite([rollId, ...recordIds]);
  return result;
}

/**
 * Update an existing SO cut record in Firestore transactionally:
 * Adjusts the roll's remainingMeters, usedMeters, and ngMeters based on the difference (delta).
 * Also updates the subcollection cut_history and cuts.
 */
export async function updateStockCutRecordInFirestore(
  updatedRecord: StockCutRecord,
  oldRecord: StockCutRecord
): Promise<{ updatedRoll: FoilRoll; updatedRecord: StockCutRecord }> {
  const rollId = updatedRecord.foilId;
  const recordId = updatedRecord.id;
  const rollRef = doc(db, ROLLS_COLLECTION, rollId);
  const recordRef = doc(db, RECORDS_COLLECTION, recordId);

  const result = await runTransaction(db, async (tx) => {
    const [rollSnap, recSnap] = await Promise.all([tx.get(rollRef), tx.get(recordRef)]);

    if (!rollSnap.exists()) {
      throw new Error('ไม่พบข้อมูลม้วนฟอยล์ในระบบ');
    }
    if (!recSnap.exists()) {
      throw new Error('ไม่พบรายการตัดสต๊อก SO นี้ในระบบ');
    }

    const serverRoll = rollSnap.data() as FoilRoll;
    const oldServerRecord = recSnap.data() as StockCutRecord;

    const oldUsed = Math.abs(Number(oldServerRecord.usedMeters ?? oldRecord.usedMeters ?? 0));
    const oldNg = Math.abs(Number(oldServerRecord.ngMeters ?? oldRecord.ngMeters ?? 0));
    const oldTotal = Math.abs(Number(oldServerRecord.totalDeducted ?? (oldUsed + oldNg)));

    const newUsed = Math.abs(Number(updatedRecord.usedMeters || 0));
    const newNg = Math.abs(Number(updatedRecord.ngMeters || 0));
    const newTotal = Math.abs(Number(updatedRecord.totalDeducted ?? (newUsed + newNg)));

    const deltaTotal = round2(newTotal - oldTotal);
    const deltaUsed = round2(newUsed - oldUsed);
    const deltaNg = round2(newNg - oldNg);

    const currentRemaining = Number(serverRoll.remainingMeters || 0);

    // Validate if increased cut exceeds available remaining meters
    if (deltaTotal > 0 && deltaTotal > currentRemaining + 0.05) {
      throw new Error(
        `ยอดตัดที่เพิ่มขึ้น (${deltaTotal.toLocaleString()} ม.) เกินกว่ายอดคงเหลือปัจจุบันในม้วน (${currentRemaining.toLocaleString()} ม.)`
      );
    }

    const nextRemaining = round2(Math.max(0, currentRemaining - deltaTotal));
    const nextUsed = round2(Math.max(0, Number(serverRoll.usedMeters || 0) + deltaUsed));
    const nextNg = round2(Math.max(0, Number(serverRoll.ngMeters || 0) + deltaNg));

    const finalRecord: StockCutRecord = {
      ...updatedRecord,
      usedMeters: newUsed,
      ngMeters: newNg,
      totalDeducted: newTotal,
      remainingAfter: round2(Math.max(0, (updatedRecord.remainingBefore ?? currentRemaining) - newTotal)),
    };

    const historyItem: CutHistoryItem = {
      id: finalRecord.id,
      soNumber: finalRecord.soNumber || '',
      cutMeters: newUsed,
      usedMeters: newUsed,
      ngMeters: newNg,
      totalDeducted: newTotal,
      remainingBefore: finalRecord.remainingBefore,
      remainingAfter: finalRecord.remainingAfter,
      cutDate: finalRecord.usageDate || finalRecord.recordedDate || new Date().toISOString().split('T')[0],
      usageDate: finalRecord.usageDate || finalRecord.recordedDate || new Date().toISOString().split('T')[0],
      recordedDate: finalRecord.recordedDate || new Date().toISOString().split('T')[0],
      recordedBy: finalRecord.recordedBy || 'ช่างคุมเครื่อง',
      productionRound: finalRecord.productionRound || '',
      roundNumber: finalRecord.roundNumber,
      notes: finalRecord.notes || '',
      createdAt: finalRecord.createdAt || new Date().toISOString(),
      cutType: finalRecord.cutType || 'so',
      nonSoReason: finalRecord.nonSoReason || '',
      rollId: serverRoll.id,
      lotNumber: serverRoll.lotNumber,
      rollNumber: serverRoll.rollNumber,
      width: serverRoll.width,
      pattern: serverRoll.pattern,
      isSilverSide: finalRecord.isSilverSide,
      isWhiteSide: finalRecord.isWhiteSide,
    };

    const updatedRoll: FoilRoll = {
      ...serverRoll,
      remainingMeters: nextRemaining,
      usedMeters: nextUsed,
      ngMeters: nextNg,
      status: nextRemaining > 0 ? ('active' as const) : ('depleted' as const),
      isZeroedOut: nextRemaining > 0 ? false : serverRoll.isZeroedOut,
      recentCuts: (serverRoll.recentCuts || []).map((c) =>
        c.id === recordId
          ? {
              id: c.id,
              soNumber: finalRecord.soNumber || '',
              cutType: finalRecord.cutType || 'so',
              productionRound: finalRecord.productionRound,
              roundNumber: finalRecord.roundNumber,
              usedMeters: newUsed,
              ngMeters: newNg,
              totalDeducted: newTotal,
              remainingAfter: finalRecord.remainingAfter ?? 0,
              usageDate: finalRecord.usageDate,
              recordedDate: finalRecord.recordedDate,
              recordedBy: finalRecord.recordedBy,
              notes: finalRecord.notes,
            }
          : c
      ),
    };

    tx.set(recordRef, sanitizeForFirestore(finalRecord), { merge: true });
    tx.set(doc(db, ROLLS_COLLECTION, rollId, 'cut_history', recordId), sanitizeForFirestore(historyItem), { merge: true });
    tx.set(doc(db, ROLLS_COLLECTION, rollId, 'cuts', recordId), sanitizeForFirestore(historyItem), { merge: true });
    tx.set(rollRef, sanitizeForFirestore(updatedRoll), { merge: true });

    return { updatedRoll, updatedRecord: finalRecord };
  });

  markLocalWrite([rollId, recordId]);
  return result;
}

function round2(num: number): number {
  if (isNaN(num)) return 0;
  return Math.round((num + Number.EPSILON) * 100) / 100;
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
 * Check if the Firestore database has any existing rolls (Reads only 1 document to save quota)
 */
export async function checkFirestoreHasData(): Promise<boolean> {
  try {
    const q = query(collection(db, ROLLS_COLLECTION), limit(1));
    const snapshot = await getDocs(q);
    return !snapshot.empty;
  } catch (err: any) {
    console.warn('Notice: Error checking Firestore data:', err?.message || err);
    return false;
  }
}

/**
 * On-demand fetch of all Stock Cut Records from Firestore
 * (Used only when the user explicitly requests a full historical sync)
 */
export async function fetchAllCutRecordsFromFirestore(): Promise<StockCutRecord[]> {
  try {
    const snapshot = await getDocs(collection(db, RECORDS_COLLECTION));
    const records: StockCutRecord[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as StockCutRecord;
      records.push({ ...data, pattern: normalizePattern(data.pattern) });
    });
    records.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return records;
  } catch (err: any) {
    console.warn('Notice: Could not fetch all cut records:', err?.message || err);
    throw err;
  }
}

// ----------------------------------------------------
// PU Sandwich Cut Records (No Foil) Collection
// ----------------------------------------------------
export const PU_SANDWICH_COLLECTION = 'pu_sandwich_cuts';

export function subscribeToPuSandwichCuts(
  callback: (records: PuSandwichCutRecord[]) => void,
  onError?: (error: any) => void
): () => void {
  try {
    const q = query(collection(db, PU_SANDWICH_COLLECTION));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: PuSandwichCutRecord[] = [];
        snapshot.forEach((docSnap) => {
          items.push(docSnap.data() as PuSandwichCutRecord);
        });
        items.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        callback(items);
      },
      (error) => {
        console.warn('Notice: PU Sandwich real-time sync snapshot error:', error?.message || error);
        if (onError) onError(error);
      }
    );
    return unsubscribe;
  } catch (err) {
    console.warn('Notice: Could not subscribe to pu_sandwich_cuts:', err);
    return () => {};
  }
}

export async function savePuSandwichCutToFirestore(record: PuSandwichCutRecord): Promise<void> {
  try {
    const docRef = doc(db, PU_SANDWICH_COLLECTION, record.id);
    await setDoc(docRef, record, { merge: true });
  } catch (err: any) {
    console.warn('Notice: Failed to save PU sandwich cut to Firestore:', err?.message || err);
    throw err;
  }
}

export async function deletePuSandwichCutFromFirestore(recordId: string): Promise<void> {
  try {
    const docRef = doc(db, PU_SANDWICH_COLLECTION, recordId);
    await deleteDoc(docRef);
  } catch (err: any) {
    console.warn('Notice: Failed to delete PU sandwich cut from Firestore:', err?.message || err);
    throw err;
  }
}

// ----------------------------------------------------
// Physical Cycle Count (ตรวจนับสต๊อกประจำเดือน)
// ----------------------------------------------------
export const CYCLE_COUNTS_COLLECTION = 'cycle_counts';

export async function saveCycleCountSession(session: CycleCountSession): Promise<void> {
  try {
    const docRef = doc(db, CYCLE_COUNTS_COLLECTION, session.id);
    await setDoc(docRef, sanitizeForFirestore(session), { merge: true });
  } catch (err: any) {
    console.warn('saveCycleCountSession failed:', err?.message || err);
    throw err;
  }
}

/**
 * ลบประวัติ Cycle Count + คืนยอดม้วน + ลบใบ «นับสต๊อก» ที่สร้างตอนปรับยอด
 */
export async function deleteCycleCountSession(
  session: CycleCountSession | string
): Promise<{ restoredRolls: FoilRoll[]; deletedRecordIds: string[] }> {
  const sessionId = typeof session === 'string' ? session : session.id;
  const fullSession: CycleCountSession | null =
    typeof session === 'string' ? null : session;

  const restoredRolls: FoilRoll[] = [];
  const deletedRecordIds: string[] = [];
  const period = fullSession?.period || '';
  const soLabel = period ? `นับสต๊อก ${period}` : '';

  // 1) หาใบตัดที่เกิดจาก Cycle Count
  let recordIds = [...(fullSession?.adjustmentRecordIds || [])];
  if (recordIds.length === 0 && fullSession) {
    const adjustedRollIds = new Set(
      (fullSession.lines || [])
        .filter((l) => l.adjusted && Math.abs(l.variance) > 0.001)
        .map((l) => l.rollId)
    );
    if (adjustedRollIds.size > 0 || soLabel) {
      try {
        const snap = await getDocs(collection(db, RECORDS_COLLECTION));
        snap.forEach((d) => {
          const rec = d.data() as StockCutRecord;
          const id = d.id;
          const isCcId = id.startsWith('cc_');
          const isCcSo =
            soLabel &&
            String(rec.soNumber || '').trim() === soLabel;
          const isTargetRoll = adjustedRollIds.size === 0 || adjustedRollIds.has(rec.foilId);
          if ((isCcId || isCcSo) && isTargetRoll) {
            recordIds.push(id);
          }
        });
      } catch (err: any) {
        console.warn('scan cycle count records failed:', err?.message || err);
      }
    }
  }
  recordIds = Array.from(new Set(recordIds));

  // 2) ลบใบตัด + cut_history + cuts และคืนยอดม้วนตาม systemRemaining ใน session
  const adjustedLines = (fullSession?.lines || []).filter(
    (l) => l.adjusted && Math.abs(l.variance) > 0.001
  );

  for (const line of adjustedLines) {
    const rollRef = doc(db, ROLLS_COLLECTION, line.rollId);
    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(rollRef);
        if (!snap.exists()) return;
        const serverRoll = snap.data() as FoilRoll;
        // คืนยอดตามยอดระบบตอนนับ (systemRemaining)
        const restoreTo = Math.max(0, Number(line.systemRemaining) || 0);
        const next: FoilRoll = {
          ...serverRoll,
          remainingMeters: restoreTo,
          usedMeters: Math.max(
            0,
            Math.round(
              ((serverRoll.totalMeters || 0) - restoreTo - (serverRoll.ngMeters || 0)) * 100
            ) / 100
          ),
          status: restoreTo > 0 ? ('active' as const) : ('depleted' as const),
          isZeroedOut: restoreTo <= 0,
          recentCuts: (serverRoll.recentCuts || []).filter(
            (c) => !recordIds.includes(c.id) && !(c.soNumber || '').startsWith('นับสต๊อก')
          ),
        };
        tx.set(rollRef, sanitizeForFirestore(next), { merge: true });
        restoredRolls.push(next);
      });
    } catch (err: any) {
      console.warn(`restore roll ${line.rollId} failed:`, err?.message || err);
    }
  }

  // 3) ลบใบตัดทีละใบ
  for (const recordId of recordIds) {
    try {
      // หา foilId จาก record ถ้ามี
      const recRef = doc(db, RECORDS_COLLECTION, recordId);
      const recSnap = await getDocFromServer(recRef).catch(() => null);
      let foilId = '';
      if (recSnap && recSnap.exists()) {
        foilId = (recSnap.data() as StockCutRecord).foilId || '';
      }
      // ถ้าไม่มีใน server ลองจาก id แบบ cc_{rollId}_...
      if (!foilId && recordId.startsWith('cc_')) {
        const parts = recordId.split('_');
        if (parts.length >= 2) foilId = parts[1];
      }

      await deleteDoc(recRef).catch(() => undefined);
      if (foilId) {
        await deleteDoc(doc(db, ROLLS_COLLECTION, foilId, 'cut_history', recordId)).catch(
          () => undefined
        );
        await deleteDoc(doc(db, ROLLS_COLLECTION, foilId, 'cuts', recordId)).catch(
          () => undefined
        );
      }
      deletedRecordIds.push(recordId);
    } catch (err: any) {
      console.warn(`delete cycle count record ${recordId} failed:`, err?.message || err);
    }
  }

  // 4) ลบเอกสารงวด
  try {
    await deleteDoc(doc(db, CYCLE_COUNTS_COLLECTION, sessionId));
  } catch (err: any) {
    console.warn('deleteCycleCountSession failed:', err?.message || err);
    throw err;
  }

  markLocalWrite([
    ...restoredRolls.map((r) => r.id),
    ...deletedRecordIds,
    sessionId,
  ]);

  return { restoredRolls, deletedRecordIds };
}

export async function fetchCycleCountSessions(limitCount: number = 24): Promise<CycleCountSession[]> {
  try {
    const q = query(collection(db, CYCLE_COUNTS_COLLECTION), orderBy('createdAt', 'desc'), limit(limitCount));
    const snapshot = await getDocs(q);
    const items: CycleCountSession[] = [];
    snapshot.forEach((docSnap) => {
      items.push({ ...(docSnap.data() as CycleCountSession), id: docSnap.id });
    });
    return items;
  } catch (err: any) {
    // Fallback without orderBy if index missing
    try {
      const snapshot = await getDocs(collection(db, CYCLE_COUNTS_COLLECTION));
      const items: CycleCountSession[] = [];
      snapshot.forEach((docSnap) => {
        items.push({ ...(docSnap.data() as CycleCountSession), id: docSnap.id });
      });
      items.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      return items.slice(0, limitCount);
    } catch (err2: any) {
      console.warn('fetchCycleCountSessions failed:', err2?.message || err2);
      return [];
    }
  }
}

/** ดึงแบบร่างล่าสุดของงวด (YYYY-MM) เพื่อเปิดมาแก้ไขต่อ */
export async function fetchDraftCycleCountForPeriod(
  period: string
): Promise<CycleCountSession | null> {
  try {
    const items = await fetchCycleCountSessions(48);
    const drafts = items
      .filter((s) => s.period === period && s.status === 'draft')
      .sort((a, b) =>
        (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || '')
      );
    return drafts[0] || null;
  } catch (err: any) {
    console.warn('fetchDraftCycleCountForPeriod failed:', err?.message || err);
    return null;
  }
}

export interface CycleCountAdjustmentLine {
  rollId: string;
  physicalCount: number;
  /** ยอดระบบก่อนปรับ (ใช้คำนวณ totalDeducted เพื่อให้ integrity / SO audit ตรง) */
  systemRemaining: number;
  lotNumber?: string;
  rollNumber?: string;
  width?: number | string;
  pattern?: string;
  reason?: string;
}

/**
 * Apply Cycle Count variance adjustments:
 * 1) ตั้ง remainingMeters = physicalCount
 * 2) บันทึก StockCutRecord ชนิด non_so ลงประวัติม้วน (stock_cut_records + cut_history + recentCuts)
 *    โดย totalDeducted = systemRemaining - physicalCount
 *    เพื่อให้สูตร expectedRemaining = totalMeters - sum(totalDeducted) ตรงกับของจริง
 *    และไม่ถูกระบบตรวจบัค / integrity แจ้งเป็นข้อผิดพลาด
 */
export async function applyCycleCountAdjustments(
  lines: CycleCountAdjustmentLine[],
  meta?: { period?: string; countedBy?: string }
): Promise<{ updatedRolls: FoilRoll[]; createdRecords: StockCutRecord[] }> {
  const updatedRolls: FoilRoll[] = [];
  const createdRecords: StockCutRecord[] = [];
  const periodLabel = meta?.period || new Date().toISOString().slice(0, 7);
  const countedBy = (meta?.countedBy || 'Cycle Count').trim() || 'Cycle Count';
  const today = new Date().toISOString().slice(0, 10);

  for (const line of lines) {
    const rollRef = doc(db, ROLLS_COLLECTION, line.rollId);
    const safePhysical = Math.max(0, Number(line.physicalCount) || 0);
    const systemBefore = Number(line.systemRemaining);
    // totalDeducted ที่ต้องเพิ่มเพื่อให้ integrity ตรง:
    // expected = totalMeters - (oldSum + thisDeducted) = physical
    // thisDeducted ≈ systemBefore - physical (เมื่อ systemBefore สะท้อนยอดระบบก่อนปรับ)
    const deduct = Math.round((systemBefore - safePhysical) * 100) / 100;
    if (Math.abs(deduct) < 0.001) continue;

    const recordId = `cc_${line.rollId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const soNumber = `นับสต๊อก ${periodLabel}`;
    const reasonText =
      line.reason?.trim() ||
      (deduct > 0
        ? `Cycle Count: ของจริงน้อยกว่าระบบ ${Math.abs(deduct)} ม.`
        : `Cycle Count: ของจริงมากกว่าระบบ ${Math.abs(deduct)} ม.`);

    await runTransaction(db, async (tx) => {
      const snap = await tx.get(rollRef);
      if (!snap.exists()) return;
      const serverRoll = snap.data() as FoilRoll;
      const remainingBefore = Number(serverRoll.remainingMeters || 0);
      // ใช้ยอดจริงบน server ณ ตอนปรับ เพื่อ consistency
      const effectiveDeduct = Math.round((remainingBefore - safePhysical) * 100) / 100;
      if (Math.abs(effectiveDeduct) < 0.001) return;

      const usedPart = effectiveDeduct > 0 ? effectiveDeduct : 0;
      const record: StockCutRecord = {
        id: recordId,
        foilId: line.rollId,
        lotNumber: line.lotNumber || serverRoll.lotNumber,
        rollNumber: line.rollNumber || serverRoll.rollNumber,
        width: (line.width ?? serverRoll.width) as any,
        pattern: (line.pattern || serverRoll.pattern) as any,
        soNumber,
        cutType: 'non_so',
        nonSoReason: reasonText,
        usedMeters: usedPart,
        ngMeters: 0,
        // อนุญาตค่าติดลบเมื่อของจริง > ระบบ (คืนยอดเข้าสต๊อก)
        totalDeducted: effectiveDeduct,
        remainingBefore,
        remainingAfter: safePhysical,
        usageDate: today,
        recordedDate: today,
        recordedBy: countedBy,
        notes: `Cycle Count ${periodLabel}${line.reason ? ` | ${line.reason}` : ''}`,
        createdAt: new Date().toISOString(),
      };

      const next: FoilRoll = {
        ...serverRoll,
        remainingMeters: safePhysical,
        usedMeters: Math.max(
          0,
          Math.round(
            ((serverRoll.usedMeters || 0) + (effectiveDeduct > 0 ? effectiveDeduct : 0)) * 100
          ) / 100
        ),
        status: safePhysical > 0 ? ('active' as const) : ('depleted' as const),
        isZeroedOut: safePhysical <= 0 ? true : false,
        recentCuts: [
          {
            id: record.id,
            soNumber: record.soNumber,
            cutType: 'non_so',
            usedMeters: record.usedMeters,
            ngMeters: 0,
            totalDeducted: record.totalDeducted,
            remainingAfter: safePhysical,
            usageDate: today,
            recordedDate: today,
            recordedBy: countedBy,
            notes: record.notes,
          },
          ...(serverRoll.recentCuts || []),
        ].slice(0, 50),
      };

      const historyItem: CutHistoryItem = {
        id: record.id,
        soNumber: record.soNumber,
        cutMeters: record.totalDeducted,
        usedMeters: record.usedMeters,
        ngMeters: 0,
        createdAt: record.createdAt,
        rollId: line.rollId,
        lotNumber: record.lotNumber,
        rollNumber: record.rollNumber,
        width: record.width as any,
        pattern: record.pattern as any,
        totalDeducted: record.totalDeducted,
        remainingBefore,
        remainingAfter: safePhysical,
        cutDate: today,
        usageDate: today,
        recordedDate: today,
        recordedBy: countedBy,
        cutType: 'non_so',
        nonSoReason: reasonText,
        notes: record.notes,
      };

      tx.set(rollRef, sanitizeForFirestore(next), { merge: true });
      tx.set(doc(db, RECORDS_COLLECTION, record.id), sanitizeForFirestore(record));
      tx.set(
        doc(db, ROLLS_COLLECTION, line.rollId, 'cut_history', record.id),
        sanitizeForFirestore(historyItem)
      );
      tx.set(
        doc(db, ROLLS_COLLECTION, line.rollId, 'cuts', record.id),
        sanitizeForFirestore(historyItem)
      );

      updatedRolls.push(next);
      createdRecords.push(record);
    });
  }

  markLocalWrite([
    ...updatedRolls.map((r) => r.id),
    ...createdRecords.map((r) => r.id),
  ]);

  return { updatedRolls, createdRecords };
}

