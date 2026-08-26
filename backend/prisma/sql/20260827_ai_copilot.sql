-- AI Copilot storage: conversations, messages and a tool-call audit trail.
-- Additive only: no existing table is touched.
BEGIN;

CREATE TABLE IF NOT EXISTS "ai_conversations" (
  "id"              TEXT PRIMARY KEY,
  "tenant_id"       TEXT,
  "company_id"      TEXT        NOT NULL,
  "user_id"         TEXT        NOT NULL,
  "title"           TEXT        NOT NULL DEFAULT 'محادثة جديدة',
  "last_message_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "is_pinned"       BOOLEAN     NOT NULL DEFAULT false,
  "is_deleted"      BOOLEAN     NOT NULL DEFAULT false,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "ai_conversations_scope_idx"
  ON "ai_conversations" ("company_id", "user_id", "is_deleted", "last_message_at");

CREATE TABLE IF NOT EXISTS "ai_messages" (
  "id"              TEXT PRIMARY KEY,
  "conversation_id" TEXT        NOT NULL,
  "role"            TEXT        NOT NULL,
  "content"         TEXT        NOT NULL DEFAULT '',
  "tool_calls"      TEXT,
  "ui_blocks"       TEXT,
  "image_base64"    TEXT,
  "model"           TEXT,
  "latency_ms"      INTEGER,
  "feedback"        TEXT,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_messages_conversation_id_fkey"
    FOREIGN KEY ("conversation_id") REFERENCES "ai_conversations" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ai_messages_conversation_idx"
  ON "ai_messages" ("conversation_id", "created_at");

CREATE TABLE IF NOT EXISTS "ai_action_logs" (
  "id"              TEXT PRIMARY KEY,
  "tenant_id"       TEXT,
  "company_id"      TEXT        NOT NULL,
  "user_id"         TEXT        NOT NULL,
  "conversation_id" TEXT,
  "question"        TEXT        NOT NULL DEFAULT '',
  "tool_name"       TEXT        NOT NULL,
  "tool_args"       TEXT        NOT NULL DEFAULT '{}',
  "result_summary"  TEXT,
  "mutated_data"    BOOLEAN     NOT NULL DEFAULT false,
  "status"          TEXT        NOT NULL DEFAULT 'ok',
  "duration_ms"     INTEGER,
  "ip_address"      TEXT,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "ai_action_logs_company_idx"
  ON "ai_action_logs" ("company_id", "created_at");

CREATE INDEX IF NOT EXISTS "ai_action_logs_user_idx"
  ON "ai_action_logs" ("user_id", "created_at");

COMMIT;
