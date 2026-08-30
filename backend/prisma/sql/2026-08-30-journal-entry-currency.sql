-- سند القيد: عملة وسعر صرف حقيقيان في قاعدة البيانات
--
-- الدفتر يبقى بعملة واحدة (الدينار): debit/credit وtotalDebit/totalCredit تبقى كما هي،
-- لأن أرصدة الحسابات وكل التقارير تقرأها مباشرة. الأعمدة الجديدة تحفظ ما كتبه المستخدم
-- فعلاً: عملة القيد، سعر الصرف المستعمل، والمبلغ الأصلي في كل سطر.
--
-- كل الأعمدة إما لها قيمة افتراضية أو تقبل NULL، فالإضافة آمنة على البيانات الموجودة
-- ولا تحتاج توقّف الخدمة.
--
-- التنفيذ: إما `npx prisma db push` من مجلد backend، أو لصق هذا الملف في
-- SQL Editor داخل Supabase. ثم أعد نشر الخادم.

ALTER TABLE "journal_entries"
  ADD COLUMN IF NOT EXISTS "currency"      TEXT           NOT NULL DEFAULT 'IQD',
  ADD COLUMN IF NOT EXISTS "exchange_rate" DECIMAL(65, 30) NOT NULL DEFAULT 1;

ALTER TABLE "journal_entry_lines"
  ADD COLUMN IF NOT EXISTS "debit_original"  DECIMAL(65, 30),
  ADD COLUMN IF NOT EXISTS "credit_original" DECIMAL(65, 30);

-- القيود المسجَّلة قبل اليوم كُتبت كلها بالدينار فعلياً (لم يكن هناك تحويل)،
-- فالقيمة الافتراضية أعلاه تصفها وصفاً صحيحاً ولا حاجة لأي تصحيح رجعي.
