-- Persistent Copilot learning: company-specific rules, aliases and preferences.
BEGIN;

CREATE TABLE IF NOT EXISTS "ai_learned_facts" (
  "id"          TEXT PRIMARY KEY,
  "tenant_id"   TEXT,
  "company_id"  TEXT        NOT NULL,
  "user_id"     TEXT,
  "kind"        TEXT        NOT NULL,
  "title"       TEXT        NOT NULL,
  "content"     TEXT        NOT NULL,
  "entity_kind" TEXT,
  "entity_id"   TEXT,
  "source"      TEXT        NOT NULL DEFAULT 'user',
  "is_active"   BOOLEAN     NOT NULL DEFAULT true,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "ai_learned_facts_company_idx"
  ON "ai_learned_facts" ("company_id", "is_active", "updated_at");

COMMIT;
