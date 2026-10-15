/**
 * Local Auth replacement for sandbox mode (โหมดทดลอง).
 *
 * In the sandbox the operator must already be signed in as staff so the login
 * screen never appears and the whole app is usable on the tablet. Every call
 * resolves locally; nothing here touches the network.
 *
 * Behaviour:
 * - `onAuthStateChanged` fires immediately with the fake staff user and returns
 *   a no-op unsubscribe.
 * - Sign-in helpers resolve with the same fake user (harmless if ever called).
 * - `signOut` is a no-op: sandbox mode has no real session to end.
 */

export const SANDBOX_STAFF_EMAIL = 'ikuyisad@ikwai.com';

/** ผู้ใช้ปลอมสำหรับโหมดทดลอง — ต้องเป็นอีเมลทีมงานเพื่อให้ได้สิทธิ์ editor */
const sandboxUser = {
  uid: 'sandbox-staff',
  email: SANDBOX_STAFF_EMAIL,
  emailVerified: true,
  displayName: 'โหมดทดลอง (Sandbox)',
  isAnonymous: false,
  photoURL: null,
  providerId: 'sandbox',
  providerData: [] as any[],
  metadata: { creationTime: '', lastSignInTime: '' },
  refreshToken: '',
  tenantId: null,
  phoneNumber: null,
  delete: async () => {},
  getIdToken: async () => 'sandbox-token',
  getIdTokenResult: async () => ({ token: 'sandbox-token', claims: {}, authTime: '', issuedAtTime: '', expirationTime: '', signInProvider: 'sandbox', signInSecondFactor: null }),
  reload: async () => {},
  toJSON: () => ({ uid: 'sandbox-staff', email: SANDBOX_STAFF_EMAIL }),
};

const mockAuthInstance = {
  name: 'sandbox-auth',
  currentUser: sandboxUser,
  setPersistence: async () => {},
  onAuthStateChanged: () => () => {},
} as any;

export function getAuth(_app?: any): any {
  return mockAuthInstance;
}

export class GoogleAuthProvider {
  setCustomParameters(_params: any): this {
    return this;
  }
  addScope(_scope: string): this {
    return this;
  }
}

export class FacebookAuthProvider {
  setCustomParameters(_params: any): this {
    return this;
  }
  addScope(_scope: string): this {
    return this;
  }
}

export class OAuthProvider {
  constructor(_providerId?: string) {}
  setCustomParameters(_params: any): this {
    return this;
  }
  addScope(_scope: string): this {
    return this;
  }
}

/** ผลลัพธ์ปลอมของ sign-in — โครงเดียวกับที่ firebase.ts คาดหวัง (result.user) */
function fakeCredential(): any {
  return { user: sandboxUser, providerId: 'sandbox', operationType: 'signIn' };
}

export async function signInWithPopup(_auth: any, _provider: any): Promise<any> {
  return fakeCredential();
}

export async function signInWithRedirect(_auth: any, _provider: any): Promise<void> {
  // ไม่มีการนำทางจริงในโหมดทดลอง
  return;
}

export async function getRedirectResult(_auth: any): Promise<any> {
  return fakeCredential();
}

export async function signInWithEmailAndPassword(
  _auth: any,
  email: string,
  _password: string
): Promise<any> {
  void email;
  return fakeCredential();
}

export async function createUserWithEmailAndPassword(
  _auth: any,
  email: string,
  _password: string
): Promise<any> {
  void email;
  return fakeCredential();
}

export async function sendPasswordResetEmail(_auth: any, _email: string): Promise<void> {
  return;
}

export async function updateProfile(_user: any, _profile: any): Promise<void> {
  return;
}

export async function signOut(_auth: any): Promise<void> {
  // ไม่ออกจากระบบในโหมดทดลอง — คงสถานะ staff เพื่อให้ใช้งานแอปได้ทันที
  return;
}

export function onAuthStateChanged(
  _auth: any,
  callback: (user: any) => void,
  _onError?: any,
  _onCompletion?: any
): () => void {
  try {
    callback(sandboxUser);
  } catch (err) {
    console.warn('Sandbox auth callback failed:', err);
  }
  return () => {};
}
