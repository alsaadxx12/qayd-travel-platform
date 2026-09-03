-- ترقيم المستندات: عدّاد واحد في القاعدة بدل عدّاد في كل متصفّح.
--
-- كان التسلسل يُحفظ في localStorage، فلكل جهاز عدّاده: يبدأ موظفان من الرقم
-- نفسه، فيحفظ أحدهما ويفشل الآخر على قيد التفرّد. والعدّاد هنا يُخصَّص بعبارة
-- UPDATE ... RETURNING ذرّية، فلا يأخذ اثنان رقماً واحداً مهما تزامنا.
--
-- الملف إضافي بالكامل: لا يحذف بياناً ولا يغيّر قيمة قائمة.

BEGIN;

CREATE TABLE IF NOT EXISTS document_sequences (
  id            TEXT PRIMARY KEY,
  "companyId"   TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  -- NULL يعني تسلسلاً عاماً للشركة كلها، لا لفرعٍ بعينه.
  "branchId"    TEXT,
  "docType"     TEXT NOT NULL,
  prefix        TEXT NOT NULL,
  "branchCode"  TEXT NOT NULL DEFAULT '',
  "includeYear" BOOLEAN NOT NULL DEFAULT TRUE,
  year          INTEGER,
  "nextNumber"  INTEGER NOT NULL DEFAULT 1001,
  padding       INTEGER NOT NULL DEFAULT 5,
  separator     TEXT NOT NULL DEFAULT '-',
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- الفهرس الفريد يقبل NULL في branchId مرةً واحدة لكل نوع، وهو المطلوب:
-- تسلسل الشركة العام صفٌّ واحد، ولكل فرعٍ صفّه.
CREATE UNIQUE INDEX IF NOT EXISTS document_sequences_company_branch_doc_key
  ON document_sequences ("companyId", COALESCE("branchId", ''), "docType");

CREATE INDEX IF NOT EXISTS document_sequences_company_doc_idx
  ON document_sequences ("companyId", "docType");

-- رقم الفاتورة يُفرَّد داخل الشركة لا في العالم.
--
-- كان القيد عالمياً، فلا تستطيع شركتان في المنظومة استعمال الرقم نفسه — وهو
-- خطأ في نظام متعدّد الشركات. أُسقط القيد القديم وحلّ محلّه قيدٌ مركّب.
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS "tickets_invoiceNumber_key";
DROP INDEX IF EXISTS "tickets_invoiceNumber_key";

CREATE UNIQUE INDEX IF NOT EXISTS tickets_company_invoice_key
  ON tickets ("companyId", "invoiceNumber");

COMMIT;
