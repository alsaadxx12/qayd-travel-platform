-- قفل الحساب عند تكرار فشل الدخول: أعمدة إضافية بحتة، القيم الافتراضية تغني
-- عن أي تهيئة، والكود القديم يتجاهلها فلا خطر في تطبيقها قبل النشر.

ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_failed_login_at TIMESTAMP(3);
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP(3);
