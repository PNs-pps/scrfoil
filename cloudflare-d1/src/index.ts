/**
 * Cloudflare Worker API — Snapshot backup ไป D1
 *
 * Auth (either one):
 *   Authorization: Bearer <Firebase ID token>   ← แนะนำ ต้องตั้ง FIREBASE_PROJECT_IDS + ALLOWED_EMAILS
 *   X-Backup-Secret: <BACKUP_SECRET>            ← แบบเดิม ปิดได้ด้วย DISABLE_SECRET_AUTH=1
 *   Content-Type: application/json
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
  /** comma-separated Firebase project ids whose ID tokens are accepted */
  FIREBASE_PROJECT_IDS?: string;
  /** comma-separated staff emails allowed to use the API with an ID token */
  ALLOWED_EMAILS?: string;
  /** "1" = reject X-Backup-Secret entirely (token auth only) */
  DISABLE_SECRET_AUTH?: string;
  /** optional single origin for CORS (default "*") */
  ALLOWED_ORIGIN?: string;
}

// D1 rejects rows over 2 MB; fail with a clear message instead of an opaque 500.
const MAX_PAYLOAD_BYTES = 1_900_000;

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

let corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Backup-Secret, Authorization',
  'Access-Control-Max-Age': '86400',
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders },
  });
}

function unauthorized(detail?: string): Response {
  return json({ ok: false, error: `Unauthorized${detail ? ` — ${detail}` : ''}` }, 401);
}

/** Constant-time string compare (hash both so length differences leak nothing). */
async function safeEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b)),
  ]);
  const x = new Uint8Array(ha);
  const y = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

// ---- Firebase ID token verification (RS256 against Google's public keys) ----

const JWKS_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
let jwksCache: { keys: any[]; expires: number } | null = null;

async function getJwks(): Promise<any[]> {
  if (jwksCache && jwksCache.expires > Date.now()) return jwksCache.keys;
  const res = await fetch(JWKS_URL);
  if (!res.ok) throw new Error(`JWKS fetch failed (${res.status})`);
  const body = (await res.json()) as { keys: any[] };
  const maxAge = Number(/max-age=(\d+)/.exec(res.headers.get('Cache-Control') || '')?.[1] || 3600);
  jwksCache = { keys: body.keys || [], expires: Date.now() + Math.min(maxAge, 86400) * 1000 };
  return jwksCache.keys;
}

function b64urlToBytes(input: string): Uint8Array {
  const pad = '='.repeat((4 - (input.length % 4)) % 4);
  const bin = atob(input.replace(/-/g, '+').replace(/_/g, '/') + pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function csv(value?: string): string[] {
  return (value || '')
    .split(',')
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
}

/** Returns the verified staff email, or null. Fails closed when not configured. */
async function verifyFirebaseToken(token: string, env: Env): Promise<string | null> {
  const projects = csv(env.FIREBASE_PROJECT_IDS);
  const allowed = csv(env.ALLOWED_EMAILS);
  if (projects.length === 0 || allowed.length === 0) return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const dec = new TextDecoder();
    const header = JSON.parse(dec.decode(b64urlToBytes(parts[0])));
    const claims = JSON.parse(dec.decode(b64urlToBytes(parts[1])));
    if (header.alg !== 'RS256' || !header.kid) return null;

    const jwk = (await getJwks()).find((k) => k.kid === header.kid);
    if (!jwk) return null;
    const key = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const ok = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      key,
      b64urlToBytes(parts[2]),
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
    );
    if (!ok) return null;

    const now = Math.floor(Date.now() / 1000);
    const aud = String(claims.aud || '').toLowerCase();
    if (!projects.includes(aud)) return null;
    if (claims.iss !== `https://securetoken.google.com/${claims.aud}`) return null;
    if (!claims.sub || typeof claims.exp !== 'number' || claims.exp <= now) return null;
    if (typeof claims.iat === 'number' && claims.iat > now + 60) return null;
    const email = String(claims.email || '').toLowerCase();
    if (!email || claims.email_verified !== true || !allowed.includes(email)) return null;
    return email;
  } catch {
    return null;
  }
}

async function authorize(request: Request, env: Env): Promise<boolean> {
  const bearer = /^Bearer\s+(.+)$/i.exec(request.headers.get('Authorization') || '');
  if (bearer) {
    if (await verifyFirebaseToken(bearer[1], env)) return true;
    // Invalid/unconfigured token: fall through. This never widens access — the
    // shared secret below must still be valid (and enabled) on its own.
  }
  if (env.DISABLE_SECRET_AUTH === '1') return false;
  const secret = env.BACKUP_SECRET || '';
  if (!secret) return false;
  return safeEqual(request.headers.get('X-Backup-Secret') || '', secret);
}

function safeDecode(v: string): string | null {
  try {
    return decodeURIComponent(v);
  } catch {
    return null;
  }
}

const ID_PATTERN = /^[A-Za-z0-9._:-]{1,100}$/;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (env.ALLOWED_ORIGIN) {
      corsHeaders = { ...corsHeaders, 'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN, Vary: 'Origin' };
    }
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    // Health ไม่ต้องมี secret
    if (path === '/health' || path === '/') {
      return json({
        ok: true,
        app: env.APP_NAME || 'foil-stock-d1-backup',
        service: 'd1-snapshot-backup',
        time: new Date().toISOString(),
      });
    }

    if (!(await authorize(request, env))) {
      return unauthorized('ตรวจ Authorization (Firebase token) หรือ X-Backup-Secret');
    }

    try {
      // GET /backups — list
      if (request.method === 'GET' && path === '/backups') {
        const rawLimit = Number(url.searchParams.get('limit') || 20);
        const limit = Number.isFinite(rawLimit) ? Math.min(50, Math.max(1, Math.floor(rawLimit))) : 20;
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
        const id = safeDecode(getMatch[1]);
        if (!id) return json({ ok: false, error: 'id ไม่ถูกต้อง' }, 400);
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
        let body: PostBody;
        try {
          body = (await request.json()) as PostBody;
        } catch {
          return json({ ok: false, error: 'body ต้องเป็น JSON' }, 400);
        }
        if (!body?.payload || !Array.isArray(body.payload.rolls) || !Array.isArray(body.payload.records)) {
          return json({ ok: false, error: 'payload.rolls และ payload.records จำเป็น' }, 400);
        }

        if (body.id !== undefined && !ID_PATTERN.test(String(body.id))) {
          return json({ ok: false, error: 'id ต้องเป็น A-Z a-z 0-9 . _ : - ยาวไม่เกิน 100' }, 400);
        }
        const payloadJson = JSON.stringify(body.payload);
        if (new TextEncoder().encode(payloadJson).length > MAX_PAYLOAD_BYTES) {
          return json({ ok: false, error: 'ข้อมูลใหญ่เกิน 1.9 MB (ขีดจำกัดแถวของ D1)' }, 413);
        }
        const id = body.id || `d1-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const createdAt = new Date().toISOString();
        const rollsCount = body.rollsCount ?? body.payload.rolls.length;
        const recordsCount = body.recordsCount ?? body.payload.records.length;
        const sandwichCount =
          body.sandwichCount ??
          (Array.isArray(body.payload.sandwichRecords) ? body.payload.sandwichRecords.length : 0);
        const totalRemaining = Number(body.totalRemaining ?? 0);

        try {
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
        } catch (insertErr: any) {
          if (/UNIQUE|constraint/i.test(String(insertErr?.message || insertErr))) {
            return json({ ok: false, error: `มี snapshot id นี้อยู่แล้ว (${id})` }, 409);
          }
          throw insertErr;
        }

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
        const id = safeDecode(delMatch[1]);
        if (!id) return json({ ok: false, error: 'id ไม่ถูกต้อง' }, 400);
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
