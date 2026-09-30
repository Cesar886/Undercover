-- Contenido aislado para /pruebas123.
-- Esta tabla no participa en feeds, busquedas, reportes ni consultas administrativas.
CREATE TABLE IF NOT EXISTS pruebas123_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pruebas123_entries_created_idx
  ON pruebas123_entries (created_at DESC, id DESC);
