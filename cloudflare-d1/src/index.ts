/**
 * Cloudflare Worker API — Snapshot backup ไป D1
 *
 * Auth (เลือกใช้ได้ทั้งสอง แต่แนะนำ token):
 *   Authorization: Bearer <Firebase ID token>   ← ตรวจกับ public key ของ Google
 *   X-Backup-Secret: <secret>                    ← ทางสำรองช่วงเปลี่ยนผ่าน
 *
 * ตั้ง env:
 *   FIREBASE_PROJECT_IDS = "stock-foil,xenon-airport-rlxdt"
 *   ALLOWED_EMAILS       = "ikuyisad@ikwai.com"
 *   DISABLE_SECRET_AUTH  = "1"  → ปิดทางใช้ secret (ใช้เฉพาะ token)
 *   BACKUP_SECRET        = (secret เดิม, ใช้เมื่อยังไม่ปิด secret auth)
 *
 * Routes:
 *   GET  /health
 *   GET  /backups              → รายการ (ไม่มี payload เต็ม)
 *   GET  /backups/:id          → snapshot เต็มรวม payload
 *   POST /backups              → บันทึก snapshot ใหม่
 *   DELETE /backups/:id        → ลบ
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type D1DatabaseInstance = any;

export interface Env {
  DB: D1DatabaseInstance;
  BACKUP_SECRET?: string;
  APP_NAME?: string;
  /** comma/space separated Firebase project ids ที่ยอมรับ token */
  FIREBASE_PROJECT_IDS?: string;
  /** อีเมลพนักงานที่อนุญาต (ว่าง = ไม่เช็คอีเมล, แต่ยังต้อง token valid) */
  ALLOWED_EMAILS?: string;
  /** "1" = ใช้เฉพาะ Firebase token, ปฏิเสธ X-Backup-Secret */
  DISABLE_SECRET_AUTH?: string;
}

interface BackupPayload {
  rolls: unknown[];
  records: unknown[];
  sandwichRecords?: unknown[];
  cycleCounts?: unknown[];
  meta?: Record<string, unknown>;
}

interface PostBody {
  id?: string;
  label?: string;
  reason?: string;
  rollsCount?: number;
  recordsCount?: number;
  sandwichCount?: number;
  totalRemaining?: number;
  payload: BackupPayload;
}

/** Firebase ID tokens are always RS256 and serve their public keys here. */
const GOOGLE_JWKS_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

/** Refuse snapshots larger than this before touching D1. */
const MAX_PAYLOAD_BYTES = 8 * 1024 * 1024; // 8 MB

/** Allowed clock skew (seconds) when checking exp / iat. */
const CLOCK_SKEW_SECONDS = 60;

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  // Authorization MUST be listed here, otherwise the browser's preflight for a
  // request that carries a Bearer token fails and no D1 request can be made.
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Backup-Secret',
  'Access-Control-Max-Age': '86400',
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders },
  });
}

function unauthorized(message = 'Unauthorized — ต้องยืนยันตัวตนก่อน'): Response {
  return json({ ok: false, error: message }, 401);
}

/** Split a comma/whitespace separated env list into trimmed non-empty values. */
function parseList(value?: string): string[] {
  return (value || '')
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Constant-time string comparison (digest first so length is not leaked). */
async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b)),
  ]);
  const va = new Uint8Array(ha);
  const vb = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < va.length; i++) diff |= va[i] ^ vb[i];
  return diff === 0;
}

async function checkSecret(request: Request, env: Env): Promise<boolean> {
  const secret = env.BACKUP_SECRET || '';
  if (!secret) return false;
  const header = request.headers.get('X-Backup-Secret') || '';
  if (!header) return false;
  return timingSafeEqual(header, secret);
}

// --- Firebase ID token verification ----------------------------------------

interface JwtHeader {
  alg?: string;
  kid?: string;
  typ?: string;
}

interface FirebaseClaims {
  iss?: string;
  aud?: string;
  exp?: number;
  iat?: number;
  auth_time?: number;
  sub?: string;
  email?: string;
  email_verified?: boolean;
  [key: string]: unknown;
}

interface TokenVerificationResult {
  ok: boolean;
  email?: string;
  reason?: string;
}

function base64UrlToBytes(input: string) {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
  const bin = atob(b64 + pad);
  const bytes = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function base64UrlToString(input: string): string {
  return new TextDecoder().decode(base64UrlToBytes(input));
}

let jwksCache: { keys: JsonWebKey[]; expiresAt: number } | null = null;

function parseMaxAge(cacheControl: string | null): number | null {
  if (!cacheControl) return null;
  const m = cacheControl.match(/max-age=(\d+)/i);
  return m ? Number(m[1]) : null;
}

async function getFirebaseJwks(): Promise<JsonWebKey[]> {
  const now = Date.now();
  if (jwksCache && jwksCache.expiresAt > now) return jwksCache.keys;

  let res: Response;
  try {
    res = await fetch(GOOGLE_JWKS_URL, {
      cf: { cacheEverything: true, cacheTtl: 3600 },
    });
  } catch (err: any) {
    throw new Error(`เชื่อมต่อ public key ของ Firebase ไม่ได้: ${err?.message || err}`);
  }
  if (!res.ok) {
    throw new Error(`ดึง public key ของ Firebase ไม่สำเร็จ (HTTP ${res.status})`);
  }

  const data = (await res.json()) as { keys?: JsonWebKey[] };
  if (!data?.keys || data.keys.length === 0) {
    throw new Error('public key ของ Firebase ว่างเปล่า');
  }

  const maxAge = parseMaxAge(res.headers.get('cache-control')) ?? 3600;
  jwksCache = { keys: data.keys, expiresAt: now + maxAge * 1000 };
  return data.keys;
}

export async function verifyFirebaseToken(
  token: string,
  projectIds: string[],
  allowedEmails: string[]
): Promise<TokenVerificationResult> {
  const parts = token.split('.');
  if (parts.length !== 3) return { ok: false, reason: 'รูปแบบ token ไม่ถูกต้อง' };
  const [headerB64, payloadB64, sigB64] = parts;

  let header: JwtHeader;
  let claims: FirebaseClaims;
  try {
    header = JSON.parse(base64UrlToString(headerB64));
    claims = JSON.parse(base64UrlToString(payloadB64));
  } catch {
    return { ok: false, reason: 'ถอดรหัส token ไม่ได้' };
  }

  if (header.alg !== 'RS256') return { ok: false, reason: 'อัลกอริทึมของ token ไม่รองรับ' };
  if (!header.kid) return { ok: false, reason: 'token ไม่มี kid' };

  const aud = typeof claims.aud === 'string' ? claims.aud : '';
  if (!aud || !projectIds.includes(aud)) {
    return { ok: false, reason: `โปรเจกต์ "${aud || '(ไม่ระบุ)'}" ไม่อยู่ในรายการที่อนุญาต` };
  }
  if (claims.iss !== `https://securetoken.google.com/${aud}`) {
    return { ok: false, reason: 'issuer ของ token ไม่ถูกต้อง' };
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (typeof claims.exp !== 'number' || claims.exp <= nowSeconds - CLOCK_SKEW_SECONDS) {
    return { ok: false, reason: 'token หมดอายุ' };
  }
  if (typeof claims.iat === 'number' && claims.iat > nowSeconds + CLOCK_SKEW_SECONDS) {
    return { ok: false, reason: 'เวลาออก token อยู่ในอนาคต' };
  }
  if (!claims.sub) return { ok: false, reason: 'token ไม่มี sub' };

  const keys = await getFirebaseJwks();
  const jwk = keys.find((k) => (k as { kid?: string }).kid === header.kid);
  if (!jwk) return { ok: false, reason: 'ไม่พบ public key ที่ตรงกับ token' };

  let key: CryptoKey;
  try {
    key = await crypto.subtle.importKey(
      'jwk',
      { ...jwk, alg: 'RS256', ext: true } as JsonWebKey,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    );
  } catch {
    return { ok: false, reason: 'นำเข้า public key ไม่ได้' };
  }

  let valid = false;
  try {
    valid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      key,
      base64UrlToBytes(sigB64),
      new TextEncoder().encode(`${headerB64}.${payloadB64}`)
    );
  } catch {
    return { ok: false, reason: 'ตรวจลายเซ็นไม่สำเร็จ' };
  }
  if (!valid) return { ok: false, reason: 'ลายเซ็นของ token ไม่ถูกต้อง' };

  const email = typeof claims.email === 'string' ? claims.email.trim().toLowerCase() : '';
  if (allowedEmails.length > 0) {
    if (!email) return { ok: false, reason: 'token ไม่มีอีเมล' };
    if (claims.email_verified === false) return { ok: false, reason: 'อีเมลยังไม่ได้ยืนยัน' };
    if (!allowedEmails.includes(email)) {
      return { ok: false, reason: `อีเมล ${email} ไม่อยู่ในรายการพนักงาน` };
    }
  }

  return { ok: true, email: email || undefined };
}

interface AuthResult {
  ok: boolean;
  via?: 'token' | 'secret';
  email?: string;
  error?: string;
}

async function authenticate(request: Request, env: Env): Promise<AuthResult> {
  const projectIds = parseList(env.FIREBASE_PROJECT_IDS);
  const allowedEmails = parseList(env.ALLOWED_EMAILS).map((e) => e.toLowerCase());
  const secretAuthDisabled = String(env.DISABLE_SECRET_AUTH || '') === '1';

  const authHeader = request.headers.get('Authorization') || '';
  const bearer = authHeader.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();

  if (bearer) {
    if (projectIds.length === 0) {
      return { ok: false, error: 'Worker ยังไม่ได้ตั้งค่า FIREBASE_PROJECT_IDS' };
    }
    const result = await verifyFirebaseToken(bearer, projectIds, allowedEmails);
    if (result.ok) return { ok: true, via: 'token', email: result.email };
    if (secretAuthDisabled || !(await checkSecret(request, env))) {
      return { ok: false, error: `token ใช้ไม่ได้: ${result.reason}` };
    }
    // token ไม่ผ่านแต่ยังอนุญาต secret → ตกไปตรวจ secret ด้านล่าง
  }

  if (secretAuthDisabled) {
    return { ok: false, error: 'ต้องส่ง Firebase ID token (Authorization: Bearer)' };
  }

  if (await checkSecret(request, env)) return { ok: true, via: 'secret' };

  return { ok: false, error: 'ต้องส่ง Firebase ID token หรือ X-Backup-Secret ที่ถูกต้อง' };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    // Health ไม่ต้องมี credentials
    if (path === '/health' || path === '/') {
      return json({
        ok: true,
        app: env.APP_NAME || 'foil-stock-d1-backup',
        service: 'd1-snapshot-backup',
        tokenAuth: parseList(env.FIREBASE_PROJECT_IDS).length > 0,
        secretAuthDisabled: String(env.DISABLE_SECRET_AUTH || '') === '1',
        time: new Date().toISOString(),
      });
    }

    let auth: AuthResult;
    try {
      auth = await authenticate(request, env);
    } catch (err: any) {
      console.error('D1 auth error:', err);
      return unauthorized(`ตรวจสอบสิทธิ์ไม่สำเร็จ: ${err?.message || err}`);
    }
    if (!auth.ok) {
      return unauthorized(auth.error);
    }

    try {
      // GET /backups — list
      if (request.method === 'GET' && path === '/backups') {
        const requested = Number(url.searchParams.get('limit') ?? 20);
        const limit = Number.isFinite(requested)
          ? Math.min(50, Math.max(1, Math.floor(requested)))
          : 20;
        const { results } = await env.DB.prepare(
          `SELECT id, created_at, label, reason, rolls_count, records_count, sandwich_count, total_remaining
           FROM backups ORDER BY created_at DESC LIMIT ?`
        )
          .bind(limit)
          .all();
        return json({ ok: true, backups: results || [] });
      }

      // GET /backups/:id
      const getMatch = path.match(/^\/backups\/([^/]+)$/);
      if (request.method === 'GET' && getMatch) {
        const id = decodeURIComponent(getMatch[1]);
        const row = await env.DB.prepare(`SELECT * FROM backups WHERE id = ?`).bind(id).first();
        if (!row) return json({ ok: false, error: 'ไม่พบ snapshot' }, 404);
        let payload: unknown = null;
        try {
          payload = JSON.parse(String(row.payload || '{}'));
        } catch {
          payload = null;
        }
        return json({
          ok: true,
          backup: {
            id: row.id,
            created_at: row.created_at,
            label: row.label,
            reason: row.reason,
            rolls_count: row.rolls_count,
            records_count: row.records_count,
            sandwich_count: row.sandwich_count,
            total_remaining: row.total_remaining,
            payload,
          },
        });
      }

      // POST /backups
      if (request.method === 'POST' && path === '/backups') {
        const declaredLength = Number(request.headers.get('Content-Length') || 0);
        if (Number.isFinite(declaredLength) && declaredLength > MAX_PAYLOAD_BYTES) {
          return json(
            { ok: false, error: `payload ใหญ่เกินไป (สูงสุด ${MAX_PAYLOAD_BYTES / (1024 * 1024)} MB)` },
            413
          );
        }

        let body: PostBody;
        try {
          body = (await request.json()) as PostBody;
        } catch {
          return json({ ok: false, error: 'อ่าน JSON ในคำขอไม่ได้' }, 400);
        }

        if (!body?.payload || !Array.isArray(body.payload.rolls) || !Array.isArray(body.payload.records)) {
          return json({ ok: false, error: 'payload.rolls และ payload.records จำเป็น' }, 400);
        }

        const payloadJson = JSON.stringify(body.payload);
        if (payloadJson.length > MAX_PAYLOAD_BYTES) {
          return json(
            { ok: false, error: `payload ใหญ่เกินไป (สูงสุด ${MAX_PAYLOAD_BYTES / (1024 * 1024)} MB)` },
            413
          );
        }

        const id = body.id || `d1-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const createdAt = new Date().toISOString();
        const rollsCount = body.rollsCount ?? body.payload.rolls.length;
        const recordsCount = body.recordsCount ?? body.payload.records.length;
        const sandwichCount =
          body.sandwichCount ??
          (Array.isArray(body.payload.sandwichRecords) ? body.payload.sandwichRecords.length : 0);
        const requestedTotal = Number(body.totalRemaining);
        const totalRemaining = Number.isFinite(requestedTotal) ? requestedTotal : 0;

        await env.DB.prepare(
          `INSERT INTO backups (id, created_at, label, reason, rolls_count, records_count, sandwich_count, total_remaining, payload)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
          .bind(
            id,
            createdAt,
            body.label || 'manual',
            body.reason || 'manual',
            rollsCount,
            recordsCount,
            sandwichCount,
            totalRemaining,
            payloadJson
          )
          .run();

        // เก็บสูงสุด ~30 ชุด — ลบของเก่าเกิน
        await env.DB.prepare(
          `DELETE FROM backups WHERE id NOT IN (
             SELECT id FROM backups ORDER BY created_at DESC LIMIT 30
           )`
        ).run();

        return json({
          ok: true,
          id,
          created_at: createdAt,
          rolls_count: rollsCount,
          records_count: recordsCount,
        });
      }

      // DELETE /backups/:id
      const delMatch = path.match(/^\/backups\/([^/]+)$/);
      if (request.method === 'DELETE' && delMatch) {
        const id = decodeURIComponent(delMatch[1]);
        await env.DB.prepare(`DELETE FROM backups WHERE id = ?`).bind(id).run();
        return json({ ok: true, deleted: id });
      }

      return json({ ok: false, error: 'Not found' }, 404);
    } catch (err: any) {
      console.error('D1 backup error:', err);
      return json({ ok: false, error: String(err?.message || err) }, 500);
    }
  },
};
