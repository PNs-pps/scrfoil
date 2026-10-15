/**
 * ชั้นเลือกผู้ให้บริการข้อมูล (gateway)
 *
 * ตัดสินใจครั้งเดียวตอนโมดูลถูกโหลด: ถ้าเปิดโหมดทดลอง (sandbox) จะใช้ implementation
 * ในเครื่อง (mockFirestore / mockAuth) แทน SDK จริง — ไม่มีการเรียกเครือข่ายเลย
 * ถ้าไม่เปิด จะใช้ `firebase/firestore` และ `firebase/auth` ตามปกติ (พฤติกรรมเดิมทุกอย่าง)
 *
 * ชื่อที่ re-export เหมือนของจริงทั้งหมด เพื่อให้ src/lib/firebase.ts แค่เปลี่ยนปลายทาง
 * ของ import โดยไม่ต้องแก้โค้ดส่วนอื่น
 *
 * สำคัญ: การ import SDK จริงไว้ที่นี่ไม่ทำให้เกิดเครือข่าย — SDK จะต่อเมื่อ "เรียกใช้"
 * เท่านั้น และในโหมดทดลองเราจะไม่เรียกมันเลย
 */

import * as realFirestore from 'firebase/firestore';
import * as realAuth from 'firebase/auth';
import * as mockFirestore from './mockFirestore';
import * as mockAuth from './mockAuth';
import { isSandboxActive } from './sandbox';

/** true เมื่อโหมดทดลองถูกเปิด (อ่านครั้งเดียวตอน module-eval) */
export const isSandboxMode = isSandboxActive();

const firestoreApi = (isSandboxMode ? mockFirestore : realFirestore) as unknown as typeof realFirestore;
const authApi = (isSandboxMode ? mockAuth : realAuth) as unknown as typeof realAuth;

// --- firebase/firestore -----------------------------------------------------
export const getFirestore = firestoreApi.getFirestore;
export const initializeFirestore = firestoreApi.initializeFirestore;
export const persistentLocalCache = firestoreApi.persistentLocalCache;
export const persistentMultipleTabManager = firestoreApi.persistentMultipleTabManager;
export const doc = firestoreApi.doc;
export const getDocFromServer = firestoreApi.getDocFromServer;
export const collection = firestoreApi.collection;
export const onSnapshot = firestoreApi.onSnapshot;
export const setDoc = firestoreApi.setDoc;
export const deleteDoc = firestoreApi.deleteDoc;
export const writeBatch = firestoreApi.writeBatch;
export const runTransaction = firestoreApi.runTransaction;
export const getDocs = firestoreApi.getDocs;
export const getDocsFromServer = firestoreApi.getDocsFromServer;
export const query = firestoreApi.query;
export const limit = firestoreApi.limit;
export const orderBy = firestoreApi.orderBy;
export const where = firestoreApi.where;

// --- firebase/auth ----------------------------------------------------------
export const getAuth = authApi.getAuth;
export const GoogleAuthProvider = authApi.GoogleAuthProvider;
export const FacebookAuthProvider = authApi.FacebookAuthProvider;
export const OAuthProvider = authApi.OAuthProvider;
export const signInWithPopup = authApi.signInWithPopup;
export const signInWithRedirect = authApi.signInWithRedirect;
export const getRedirectResult = authApi.getRedirectResult;
export const signOut = authApi.signOut;
export const onAuthStateChanged = authApi.onAuthStateChanged;
export const createUserWithEmailAndPassword = authApi.createUserWithEmailAndPassword;
export const signInWithEmailAndPassword = authApi.signInWithEmailAndPassword;
export const sendPasswordResetEmail = authApi.sendPasswordResetEmail;
export const updateProfile = authApi.updateProfile;

// --- types (หายไปตอน compile ไม่มีผลตอนรัน) --------------------------------
export type { Firestore } from 'firebase/firestore';
export type { Auth, User } from 'firebase/auth';

// คลาส provider ถูก re-export เป็น "ค่า" (const) จึงต้องประกาศ "ชนิด" คู่กันไว้ด้วย
// เพื่อให้ firebase.ts ใช้ชื่อเดิมเป็น type ได้ (เช่น พารามิเตอร์ของ signInWithProviderPopup)
export type GoogleAuthProvider = InstanceType<typeof realAuth.GoogleAuthProvider>;
export type FacebookAuthProvider = InstanceType<typeof realAuth.FacebookAuthProvider>;
export type OAuthProvider = InstanceType<typeof realAuth.OAuthProvider>;
