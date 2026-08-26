-- Payment vouchers keep the entered currency and the rate used to post the journal entry.
BEGIN;

ALTER TABLE "payment_vouchers"
  ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'IQD';

ALTER TABLE "payment_vouchers"
  ADD COLUMN IF NOT EXISTS "exchange_rate" DECIMAL(65, 30) NOT NULL DEFAULT 1;

COMMIT;
