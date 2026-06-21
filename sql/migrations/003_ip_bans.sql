-- IP ban system

ALTER TABLE posts    ADD COLUMN IF NOT EXISTS poster_ip TEXT;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS poster_ip TEXT;

CREATE TABLE IF NOT EXISTS ip_bans (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ip            TEXT        NOT NULL,
  reason        TEXT        NOT NULL DEFAULT 'contenido reportado',
  expires_at    TIMESTAMPTZ NOT NULL,
  offense_count INT         NOT NULL DEFAULT 1,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ip_bans_lookup
  ON ip_bans (ip, expires_at DESC);
