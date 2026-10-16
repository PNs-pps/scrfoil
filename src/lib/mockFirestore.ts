/**
 * Local Firestore replacement for sandbox mode (โหมดทดลอง).
 *
 * This file implements ONLY the subset of the `firebase/firestore` API that
 * `src/lib/firebase.ts` actually calls, backed by an in-memory map persisted to
 * localStorage. It never imports anything from `firebase/*`, so enabling the
 * sandbox produces zero Firestore network traffic.
 *
 * Storage shape (single localStorage key):
 *   { [collectionPath: string]: { [docId: string]: dataObject } }
 * e.g. { "foil_rolls": { "roll-1": {...} },
 *        "foil_rolls/roll-1/cut_history": { "rec-1": {...} } }
 *
 * Fidelity notes vs. real Firestore:
 * - Snapshots always report `metadata.fromCache = false` and
 *   `hasPendingWrites = false`; there is no cache layer and no outbox.
 * - `docChanges()` is computed per listener by diffing against the previous
 *   delivery, so the external-change heuristics in firebase.ts behave the same
 *   as they would against the server.
 * - `runTransaction` reads the committed store (writes are buffered and applied
 *   atomically at the end) and does NOT implement server-side compare-and-set or
 *   automatic retries. A single tablet cannot race against itself, so the
 *   semantics the callers rely on (read fresh -> validate -> write) still hold.
 */

export { SANDBOX_STORE_KEY } from './localCache';
import { SANDBOX_STORE_KEY } from './localCache';

type DocMap = Record<string, any>;
export type SandboxStore = Record<string, DocMap>;

// --- store -----------------------------------------------------------------

let store: SandboxStore | null = null;

/** โหลด store จาก localStorage ครั้งแรกที่เรียกใช้ (cache ไว้ในหน่วยความจำ) */
export function getSandboxStore(): SandboxStore {
  if (store) return store;
  try {
    const raw = localStorage.getItem(SANDBOX_STORE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    store = parsed && typeof parsed === 'object' ? (parsed as SandboxStore) : {};
  } catch (err) {
    console.warn('Sandbox store load failed:', err);
    store = {};
  }
  return store;
}

function persistStore(): void {
  try {
    localStorage.setItem(SANDBOX_STORE_KEY, JSON.stringify(getSandboxStore()));
  } catch (err) {
    console.warn('Sandbox store persist failed:', err);
  }
}

/** แทนที่ store ทั้งก้อน (ใช้ตอน seed/ล้างข้อมูลทดลอง) แล้วแจ้ง listener ทุกตัว */
export function replaceSandboxStore(next: SandboxStore): void {
  store = next && typeof next === 'object' ? next : {};
  persistStore();
  notifyAllListeners();
}

/** deep-copy ข้อมูลเป็น JSON-safe (ข้อมูลที่เขียนผ่าน sanitizeForFirestore แล้วไม่มี undefined) */
function clone<T>(value: T): T {
  if (value === undefined || value === null) return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

function parentCollectionPath(path: string): string {
  const idx = path.lastIndexOf('/');
  return idx === -1 ? '' : path.slice(0, idx);
}

function docIdOf(path: string): string {
  const idx = path.lastIndexOf('/');
  return idx === -1 ? path : path.slice(idx + 1);
}

// --- references & constraints ----------------------------------------------

export interface SandboxDocumentReference {
  readonly type: 'document';
  /** path เต็มของเอกสาร เช่น foil_rolls/roll-1 */
  readonly path: string;
  readonly id: string;
}

interface SandboxConstraint {
  readonly kind: 'where' | 'orderBy' | 'limit';
  readonly field?: string;
  readonly op?: string;
  readonly value?: any;
  readonly direction?: 'asc' | 'desc';
  readonly count?: number;
}

export interface SandboxQuery {
  readonly type: 'query';
  /** path ของ collection ที่อ้างถึง */
  readonly path: string;
  readonly constraints: SandboxConstraint[];
}

/** mock db singleton — ตัวจริงถูกสร้างด้วย persistentLocalCache; ที่นี่ไม่ต้องมีอะไร */
const mockFirestoreInstance = { type: 'firestore', __sandbox: true };

export function getFirestore(..._args: any[]): any {
  return mockFirestoreInstance;
}

export function initializeFirestore(..._args: any[]): any {
  return mockFirestoreInstance;
}

export function persistentLocalCache(_options?: any): any {
  return { type: 'persistentLocalCache' };
}

export function persistentMultipleTabManager(): any {
  return { type: 'persistentMultipleTabManager' };
}

/**
 * `collection(db, 'a', 'b', ...)` -> query ที่ชี้ collection path
 */
export function collection(_db: any, ...segments: string[]): SandboxQuery {
  return { type: 'query', path: segments.join('/'), constraints: [] };
}

/**
 * `doc(db, 'a', 'b', ...)` -> document reference
 * (path เต็ม = ทุก segment ต่อกัน; segment สุดท้ายคือ id ของเอกสาร)
 */
export function doc(_base: any, ...segments: string[]): SandboxDocumentReference {
  const path = segments.filter((s) => s !== undefined && s !== null).join('/');
  return { type: 'document', path, id: docIdOf(path) };
}

export function where(field: string, op: string, value: any): SandboxConstraint {
  return { kind: 'where', field, op, value };
}

export function orderBy(field: string, direction: 'asc' | 'desc' = 'asc'): SandboxConstraint {
  return { kind: 'orderBy', field, direction };
}

export function limit(count: number): SandboxConstraint {
  return { kind: 'limit', count };
}

export function query(base: SandboxQuery, ...constraints: SandboxConstraint[]): SandboxQuery {
  const basePath = (base as any)?.path ?? '';
  const baseConstraints: SandboxConstraint[] = (base as any)?.constraints ?? [];
  return {
    type: 'query',
    path: basePath,
    constraints: [...baseConstraints, ...constraints.filter(Boolean)],
  };
}

function toQuery(target: any): SandboxQuery {
  if (target && target.type === 'query') return target as SandboxQuery;
  if (target && target.type === 'document') {
    // ไม่มีใคร subscribe ที่ documento ตรง ๆ ในโค้ดนี้ — คืน query ของ collection แม่
    return { type: 'query', path: parentCollectionPath(target.path), constraints: [] };
  }
  return { type: 'query', path: '', constraints: [] };
}

// --- snapshots --------------------------------------------------------------

class MockDocumentSnapshot {
  constructor(
    readonly id: string,
    readonly ref: SandboxDocumentReference,
    private readonly _data: any | undefined
  ) {}

  exists(): boolean {
    return this._data !== undefined;
  }

  data(): any {
    return this._data === undefined ? undefined : clone(this._data);
  }

  get(field: string): any {
    return this._data?.[field];
  }
}

interface MockDocumentChange {
  type: 'added' | 'modified' | 'removed';
  doc: any;
}

class MockQuerySnapshot {
  readonly metadata = { fromCache: false, hasPendingWrites: false };
  readonly docs: MockDocumentSnapshot[];
  private readonly _changes: MockDocumentChange[];

  constructor(docs: MockDocumentSnapshot[], changes: MockDocumentChange[]) {
    this.docs = docs;
    this._changes = changes;
  }

  get empty(): boolean {
    return this.docs.length === 0;
  }

  get size(): number {
    return this.docs.length;
  }

  forEach(callback: (docSnap: MockDocumentSnapshot) => void): void {
    this.docs.forEach(callback);
  }

  docChanges(): MockDocumentChange[] {
    return this._changes;
  }
}

function readDoc(path: string): any | undefined {
  const col = parentCollectionPath(path);
  const id = docIdOf(path);
  return getSandboxStore()[col]?.[id];
}

function makeDocSnapshot(path: string): MockDocumentSnapshot {
  const data = readDoc(path);
  return new MockDocumentSnapshot(docIdOf(path), {
    type: 'document',
    path,
    id: docIdOf(path),
  }, data);
}

// --- query execution --------------------------------------------------------

function matchesWhere(data: any, c: SandboxConstraint): boolean {
  const v = data?.[c.field as string];
  switch (c.op) {
    case '==':
      return v === c.value;
    case '!=':
      return v !== c.value;
    case '>':
      return v > c.value;
    case '>=':
      return v >= c.value;
    case '<':
      return v < c.value;
    case '<=':
      return v <= c.value;
    case 'array-contains':
      return Array.isArray(v) && v.includes(c.value);
    default:
      // ตัวดำเนินการที่ไม่รองรับ — ไม่กรอง (ไม่ให้ข้อมูลหายเงียบ ๆ)
      return true;
  }
}

function compareValues(a: any, b: any): number {
  if (a === b) return 0;
  if (a === undefined || a === null) return 1; // ค่าว่างไปท้าย
  if (b === undefined || b === null) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b));
}

function runQuery(q: SandboxQuery): { id: string; data: any }[] {
  const col = getSandboxStore()[q.path] || {};
  let entries = Object.keys(col).map((id) => ({ id, data: col[id] }));

  const whereFilters = q.constraints.filter((c) => c.kind === 'where');
  const orderBys = q.constraints.filter((c) => c.kind === 'orderBy');
  const limitC = q.constraints.find((c) => c.kind === 'limit');

  entries = entries.filter((e) => whereFilters.every((c) => matchesWhere(e.data, c)));

  if (orderBys.length > 0) {
    entries = [...entries].sort((a, b) => {
      for (const c of orderBys) {
        const cmp = compareValues(a.data?.[c.field as string], b.data?.[c.field as string]);
        if (cmp !== 0) return c.direction === 'desc' ? -cmp : cmp;
      }
      return 0;
    });
  } else {
    // Firestore เรียงตาม document id เมื่อไม่มี orderBy — ทำเหมือนกันเพื่อความเสถียร
    entries = [...entries].sort((a, b) => a.id.localeCompare(b.id));
  }

  if (limitC && typeof limitC.count === 'number') {
    entries = entries.slice(0, limitC.count);
  }
  return entries;
}

function buildSnapshot(q: SandboxQuery, changes: MockDocumentChange[]): MockQuerySnapshot {
  const docs = runQuery(q).map(
    (e) =>
      new MockDocumentSnapshot(e.id, { type: 'document', path: `${q.path}/${e.id}`, id: e.id }, e.data)
  );
  return new MockQuerySnapshot(docs, changes);
}

// --- listeners --------------------------------------------------------------

interface SandboxListener {
  query: SandboxQuery;
  collectionPath: string;
  onNext: (snapshot: MockQuerySnapshot) => void;
  /** docId -> JSON ของข้อมูลครั้งก่อน (ใช้คำนวณ docChanges) */
  prev: Map<string, string>;
}

const listeners = new Set<SandboxListener>();

function dataKey(data: any): string {
  try {
    return JSON.stringify(data ?? null);
  } catch {
    return String(data);
  }
}

function deliver(listener: SandboxListener): void {
  const entries = runQuery(listener.query);
  const changes: MockDocumentChange[] = [];

  for (const e of entries) {
    const key = dataKey(e.data);
    const before = listener.prev.get(e.id);
    if (before === undefined) {
      changes.push({
        type: 'added',
        doc: new MockDocumentSnapshot(e.id, { type: 'document', path: `${listener.collectionPath}/${e.id}`, id: e.id }, e.data),
      });
    } else if (before !== key) {
      changes.push({
        type: 'modified',
        doc: new MockDocumentSnapshot(e.id, { type: 'document', path: `${listener.collectionPath}/${e.id}`, id: e.id }, e.data),
      });
    }
  }

  for (const id of Array.from(listener.prev.keys())) {
    if (!entries.some((e) => e.id === id)) {
      changes.push({
        type: 'removed',
        doc: new MockDocumentSnapshot(id, { type: 'document', path: `${listener.collectionPath}/${id}`, id }, undefined),
      });
    }
  }

  listener.prev = new Map(entries.map((e) => [e.id, dataKey(e.data)]));
  listener.onNext(buildSnapshot(listener.query, changes));
}

function notifyListeners(collectionPaths: Set<string>): void {
  for (const listener of Array.from(listeners)) {
    if (collectionPaths.has(listener.collectionPath)) {
      try {
        deliver(listener);
      } catch (err) {
        console.warn('Sandbox listener delivery failed:', err);
      }
    }
  }
}

/** แจ้ง listener ทุกตัว (ใช้เมื่อ store ถูกแทนที่ทั้งก้อน) */
function notifyAllListeners(): void {
  for (const listener of Array.from(listeners)) {
    try {
      deliver(listener);
    } catch (err) {
      console.warn('Sandbox listener delivery failed:', err);
    }
  }
}

export function onSnapshot(
  target: any,
  onNext: (snapshot: MockQuerySnapshot) => void,
  onError?: (err: any) => void,
  _onCompletion?: () => void
): () => void {
  void onError;
  const q = toQuery(target);
  const listener: SandboxListener = {
    query: q,
    collectionPath: q.path,
    onNext,
    prev: new Map(),
  };
  listeners.add(listener);
  // ส่ง snapshot ปัจจุบันทันที (เทียบเท่า snapshot แรกจาก Firestore)
  try {
    deliver(listener);
  } catch (err) {
    console.warn('Sandbox initial snapshot failed:', err);
  }
  return () => {
    listeners.delete(listener);
  };
}

// --- reads ------------------------------------------------------------------

export async function getDocFromServer(ref: SandboxDocumentReference): Promise<MockDocumentSnapshot> {
  return makeDocSnapshot(ref.path);
}

export async function getDocs(target: any): Promise<MockQuerySnapshot> {
  return buildSnapshot(toQuery(target), []);
}

export async function getDocsFromServer(target: any): Promise<MockQuerySnapshot> {
  return buildSnapshot(toQuery(target), []);
}

// --- writes -----------------------------------------------------------------

function applySet(ref: SandboxDocumentReference, data: any, options?: { merge?: boolean }): void {
  const col = parentCollectionPath(ref.path);
  const st = getSandboxStore();
  const colMap = st[col] || (st[col] = {});
  if (options?.merge) {
    colMap[ref.id] = { ...(colMap[ref.id] || {}), ...clone(data) };
  } else {
    colMap[ref.id] = clone(data);
  }
}

function applyUpdate(ref: SandboxDocumentReference, data: any): void {
  const existing = readDoc(ref.path);
  if (existing === undefined) {
    throw new Error(`ไม่พบเอกสาร ${ref.path} (sandbox transaction update)`);
  }
  applySet(ref, { ...existing, ...clone(data) });
}

function applyDelete(ref: SandboxDocumentReference): void {
  const col = parentCollectionPath(ref.path);
  const colMap = getSandboxStore()[col];
  if (colMap) delete colMap[ref.id];
}

export async function setDoc(
  ref: SandboxDocumentReference,
  data: any,
  options?: { merge?: boolean }
): Promise<void> {
  applySet(ref, data, options);
  persistStore();
  notifyListeners(new Set([parentCollectionPath(ref.path)]));
}

export async function deleteDoc(ref: SandboxDocumentReference): Promise<void> {
  applyDelete(ref);
  persistStore();
  notifyListeners(new Set([parentCollectionPath(ref.path)]));
}

// --- batches / transactions -------------------------------------------------

export function writeBatch(_db: any): {
  set: (ref: SandboxDocumentReference, data: any, options?: { merge?: boolean }) => void;
  delete: (ref: SandboxDocumentReference) => void;
  commit: () => Promise<void>;
} {
  const ops: Array<() => void> = [];
  const touched = new Set<string>();

  return {
    set(ref, data, options) {
      ops.push(() => applySet(ref, data, options));
      touched.add(parentCollectionPath(ref.path));
    },
    delete(ref) {
      ops.push(() => applyDelete(ref));
      touched.add(parentCollectionPath(ref.path));
    },
    async commit() {
      // ทั้งชุดสำเร็จพร้อมกันหรือไม่ทำเลย
      ops.forEach((op) => op());
      persistStore();
      notifyListeners(touched);
    },
  };
}

export async function runTransaction(
  _db: any,
  updateFunction: (transaction: any) => Promise<any>
): Promise<any> {
  const ops: Array<() => void> = [];
  const touched = new Set<string>();

  const transaction = {
    // อ่านจาก store ที่ commit แล้วเท่านั้น (การเขียนจะถูก apply ทีหลังทั้งหมด)
    get: async (ref: SandboxDocumentReference) => makeDocSnapshot(ref.path),
    set(ref: SandboxDocumentReference, data: any, options?: { merge?: boolean }) {
      ops.push(() => applySet(ref, data, options));
      touched.add(parentCollectionPath(ref.path));
      return transaction;
    },
    update(ref: SandboxDocumentReference, data: any) {
      ops.push(() => applyUpdate(ref, data));
      touched.add(parentCollectionPath(ref.path));
      return transaction;
    },
    delete(ref: SandboxDocumentReference) {
      ops.push(() => applyDelete(ref));
      touched.add(parentCollectionPath(ref.path));
      return transaction;
    },
  };

  // หมายเหตุ: ตัวจริงจะ retry ถ้าเอกสารเปลี่ยนระหว่างอ่านกับเขียน (compare-and-set);
  // mock นี้ไม่ทำเพราะไม่มีเครื่องอื่นมาแข่ง — callback อาจถูกเรียกซ้ำได้ในตัวจริง
  // ดังนั้นผู้เรียกต้องกัน side-effect ซ้ำเองอยู่แล้ว (โค้ดเดิมทำไว้แล้ว)
  const result = await updateFunction(transaction);
  ops.forEach((op) => op());
  persistStore();
  notifyListeners(touched);
  return result;
}
