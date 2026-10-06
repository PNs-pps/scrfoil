/**
 * Cloudflare Worker API — Snapshot backup ไป D1
 *
 * Auth: Authorization: Bearer <Firebase ID token>
 *   Worker ตรวจลายเซ็น (JWKS ของ Google), iss/aud/exp, email_verified และอีเมลต้องอยู่ใน STAFF_EMAILS
 *   ไม่มี shared secret อยู่ฝั่ง client อีกต่อไป
 * Headers: Content-Type: application/json
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
  APP_NAME?: string;
  /** comma-separated Firebase project IDs ที่ยอมรับ token (หลัก + สำรอง) */
  FIREBASE_PROJECT_IDS: string;
  /** comma-separated อีเมลพนักงาน (ตัวพิมพ์เล็ก) */
  STAFF_EMAILS: string;
  /** comma-separated origin ที่เรียก Worker ได้ เช่น https://user.github.io */
  ALLOWED_ORIGINS: string;
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

let currentCors: Record<string, string> = {};

function buildCors(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get('Origin') || '';
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean);
  const h: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
  if (origin && allowed.includes(origin)) h['Access-Control-Allow-Origin'] = origin;
  return h;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...currentCors },
  });
}

function unauthorized(reason = 'Unauthorized'): Response {
  return json({ ok: false, error: reason }, 401);
}

// ---- Firebase ID token verification (RS256 via Google JWKS) ----------------
const JWKS_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
let jwksCache: { keys: any[]; expires: number } | null = null;

async function getJwks(): Promise<any[]> {
  if (jwksCache && jwksCache.expires > Date.now()) return jwksCache.keys;
  const res = await fetch(JWKS_URL);
  if (!res.ok) throw new Error('JWKS fetch failed');
  const data = (await res.json()) as { keys: any[] };
  jwksCache = { keys: data.keys || [], expires: Date.now() + 60 * 60 * 1000 };
  return jwksCache.keys;
}

function b64urlToBytes(input: string): Uint8Array {
  const pad = '='.repeat((4 - (input.length % 4)) % 4);
  const bin = atob(input.replace(/-/g, '+').replace(/_/g, '/') + pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function verifyFirebaseToken(token: string, env: Env): Promise<string | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const header = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[0])));
    const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[1])));
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
    const projects = (env.FIREBASE_PROJECT_IDS || '').split(',').map((p) => p.trim()).filter(Boolean);
    if (!projects.includes(payload.aud)) return null;
    if (payload.iss !== `https://securetoken.google.com/${payload.aud}`) return null;
    if (!payload.sub || typeof payload.exp !== 'number' || payload.exp < now) return null;
    if (typeof payload.iat === 'number' && payload.iat > now + 300) return null;
    if (payload.email_verified !== true || typeof payload.email !== 'string') return null;

    const staff = (env.STAFF_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
    const email = payload.email.toLowerCase();
    return staff.includes(email) ? email : null;
  } catch {
    return null;
  }
}

async function authenticate(request: Request, env: Env): Promise<boolean> {
  const auth = request.headers.get('Authorization') || '';
  const m = auth.match(/^Bearer (.+)$/);
  if (!m) return false;
  return (await verifyFirebaseToken(m[1], env)) !== null;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    currentCors = buildCors(request, env);
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: currentCors });
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

    if (!(await authenticate(request, env))) {
      return unauthorized('Unauthorized — ต้องล็อกอินด้วยบัญชีพนักงานที่ยืนยันอีเมลแล้ว');
    }

    try {
      // GET /backups — list
      if (request.method === 'GET' && path === '/backups') {
        const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit') || 20)));
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
        const body = (await request.json()) as PostBody;
        if (!body?.payload || !Array.isArray(body.payload.rolls) || !Array.isArray(body.payload.records)) {
          return json({ ok: false, error: 'payload.rolls และ payload.records จำเป็น' }, 400);
        }

        const id = body.id || `d1-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const createdAt = new Date().toISOString();
        const rollsCount = body.rollsCount ?? body.payload.rolls.length;
        const recordsCount = body.recordsCount ?? body.payload.records.length;
        const sandwichCount =
          body.sandwichCount ??
          (Array.isArray(body.payload.sandwichRecords) ? body.payload.sandwichRecords.length : 0);
        const totalRemaining = Number(body.totalRemaining ?? 0);

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
            JSON.stringify(body.payload)
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
