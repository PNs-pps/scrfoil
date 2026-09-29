/**
 * Cloudflare Worker API — Snapshot backup ไป D1
 *
 * Headers:
 *   X-Backup-Secret: <secret ที่ตั้งด้วย wrangler secret put BACKUP_SECRET>
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
  BACKUP_SECRET: string;
  APP_NAME?: string;
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

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Backup-Secret',
  'Access-Control-Max-Age': '86400',
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders },
  });
}

function unauthorized(): Response {
  return json({ ok: false, error: 'Unauthorized — ตรวจ X-Backup-Secret' }, 401);
}

function checkSecret(request: Request, env: Env): boolean {
  const secret = env.BACKUP_SECRET || '';
  if (!secret) return false;
  const header = request.headers.get('X-Backup-Secret') || '';
  return header === secret;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
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

    if (!checkSecret(request, env)) {
      return unauthorized();
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
