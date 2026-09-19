-- ميزة تحديد موقع الفرع بدقة جغرافية ونطاق الحضور الجغرافي (Geofencing)
-- وربط الجهاز المعتمد والموثق لكل موظف (Hardware Keystore & Secure Enclave Attestation)

BEGIN;

-- 1. إضافة إحداثيات الفرع الجغرافية ونطاق السماح بالمتر
ALTER TABLE branches
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "allowedRadiusMeters" DOUBLE PRECISION DEFAULT 150;

-- 2. إضافة بيانات الجهاز المعتمد والموثق لكل موظف
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS "trustedDeviceId" TEXT,
  ADD COLUMN IF NOT EXISTS "deviceModel" TEXT,
  ADD COLUMN IF NOT EXISTS "devicePlatform" TEXT,
  ADD COLUMN IF NOT EXISTS "deviceBoundAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deviceAttestationType" TEXT,
  ADD COLUMN IF NOT EXISTS "deviceAttestationKey" TEXT;

COMMIT;
