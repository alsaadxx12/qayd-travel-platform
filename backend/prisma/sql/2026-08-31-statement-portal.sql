-- بوابة كشف الحساب بالباركود
--
-- جدول واحد جديد لا يمسّ أي بيانات قائمة. كل باركود مفتاح لحساب واحد فقط،
-- ويمكن إبطاله في أي لحظة دون أن يتأثر شيء آخر.
--
-- التنفيذ: `npx prisma db push` من مجلد backend، أو لصق هذا الملف في SQL Editor
-- داخل Supabase. ثم أعد نشر الخادم.

CREATE TABLE IF NOT EXISTS "statement_access_tokens" (
  "id"              TEXT         NOT NULL,
  "token"           TEXT         NOT NULL,
  "companyId"       TEXT         NOT NULL,
  "accountId"       TEXT         NOT NULL,
  "customerId"      TEXT,
  "supplierId"      TEXT,
  "label"           TEXT,
  "expires_at"      TIMESTAMP(3),
  "revoked_at"      TIMESTAMP(3),
  "failed_attempts" INTEGER      NOT NULL DEFAULT 0,
  "locked_until"    TIMESTAMP(3),
  "view_count"      INTEGER      NOT NULL DEFAULT 0,
  "last_viewed_at"  TIMESTAMP(3),
  "created_by_id"   TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,

  CONSTRAINT "statement_access_tokens_pkey" PRIMARY KEY ("id")
);

-- الفهرس الفريد على token هو ما يجعل البحث عنه فورياً مهما كثرت البطاقات،
-- ويمنع تكرار مفتاح بالصدفة.
CREATE UNIQUE INDEX IF NOT EXISTS "statement_access_tokens_token_key"
  ON "statement_access_tokens" ("token");

CREATE INDEX IF NOT EXISTS "statement_access_tokens_companyId_idx"
  ON "statement_access_tokens" ("companyId");
CREATE INDEX IF NOT EXISTS "statement_access_tokens_accountId_idx"
  ON "statement_access_tokens" ("accountId");
CREATE INDEX IF NOT EXISTS "statement_access_tokens_customerId_idx"
  ON "statement_access_tokens" ("customerId");
CREATE INDEX IF NOT EXISTS "statement_access_tokens_supplierId_idx"
  ON "statement_access_tokens" ("supplierId");

-- إضافة لاحقة: رقم تحقّق للحسابات التي لا يقف خلفها عميل أو مورد (حسابات السلف مثلاً).
-- هاتف الطرف المرتبط — إن وُجد — يبقى هو المرجع دائماً، وهذا العمود بديل عند غيابه فقط.
ALTER TABLE "statement_access_tokens"
  ADD COLUMN IF NOT EXISTS "verify_phone" TEXT;
