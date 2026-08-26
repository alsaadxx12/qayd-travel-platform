-- All chart-of-accounts rows support IQD and USD (stored as MULTI).
BEGIN;

ALTER TABLE "accounts" ALTER COLUMN "currency" SET DEFAULT 'MULTI';

UPDATE "accounts"
SET "currency" = 'MULTI'
WHERE "currency" IS DISTINCT FROM 'MULTI';

COMMIT;
