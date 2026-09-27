-- Cloudflare D1 schema: snapshot backups for foil stock app
-- Run once: wrangler d1 execute FOIL_BACKUPS --file=./schema.sql

CREATE TABLE IF NOT EXISTS backups (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  label TEXT,
  reason TEXT,
  rolls_count INTEGER NOT NULL DEFAULT 0,
  records_count INTEGER NOT NULL DEFAULT 0,
  sandwich_count INTEGER NOT NULL DEFAULT 0,
  total_remaining REAL NOT NULL DEFAULT 0,
  -- Full JSON payload (rolls + records + optional sandwich + cycle_counts)
  payload TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_backups_created_at ON backups(created_at DESC);
