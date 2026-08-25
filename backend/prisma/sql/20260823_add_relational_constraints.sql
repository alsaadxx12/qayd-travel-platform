BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'receipt_vouchers_cashboxOrBankAccountId_fkey') THEN
    ALTER TABLE "receipt_vouchers"
      ADD CONSTRAINT "receipt_vouchers_cashboxOrBankAccountId_fkey"
      FOREIGN KEY ("cashboxOrBankAccountId") REFERENCES "accounts"(id)
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payment_vouchers_cashboxOrBankAccountId_fkey') THEN
    ALTER TABLE "payment_vouchers"
      ADD CONSTRAINT "payment_vouchers_cashboxOrBankAccountId_fkey"
      FOREIGN KEY ("cashboxOrBankAccountId") REFERENCES "accounts"(id)
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'departments_branch_id_fkey') THEN
    ALTER TABLE "departments"
      ADD CONSTRAINT "departments_branch_id_fkey"
      FOREIGN KEY ("branch_id") REFERENCES "branches"(id)
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employees_branch_id_fkey') THEN
    ALTER TABLE "employees"
      ADD CONSTRAINT "employees_branch_id_fkey"
      FOREIGN KEY ("branch_id") REFERENCES "branches"(id)
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employees_department_id_fkey') THEN
    ALTER TABLE "employees"
      ADD CONSTRAINT "employees_department_id_fkey"
      FOREIGN KEY ("department_id") REFERENCES "departments"(id)
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tickets_customer_id_fkey') THEN
    ALTER TABLE "tickets"
      ADD CONSTRAINT "tickets_customer_id_fkey"
      FOREIGN KEY ("customer_id") REFERENCES "customers"(id)
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tickets_customer_account_id_fkey') THEN
    ALTER TABLE "tickets"
      ADD CONSTRAINT "tickets_customer_account_id_fkey"
      FOREIGN KEY ("customer_account_id") REFERENCES "accounts"(id)
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tickets_supplier_id_fkey') THEN
    ALTER TABLE "tickets"
      ADD CONSTRAINT "tickets_supplier_id_fkey"
      FOREIGN KEY ("supplier_id") REFERENCES "suppliers"(id)
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tickets_supplier_account_id_fkey') THEN
    ALTER TABLE "tickets"
      ADD CONSTRAINT "tickets_supplier_account_id_fkey"
      FOREIGN KEY ("supplier_account_id") REFERENCES "accounts"(id)
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tickets_airline_id_fkey') THEN
    ALTER TABLE "tickets"
      ADD CONSTRAINT "tickets_airline_id_fkey"
      FOREIGN KEY ("airline_id") REFERENCES "airlines"(id)
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tickets_cashbox_account_id_fkey') THEN
    ALTER TABLE "tickets"
      ADD CONSTRAINT "tickets_cashbox_account_id_fkey"
      FOREIGN KEY ("cashbox_account_id") REFERENCES "accounts"(id)
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tickets_branchId_fkey') THEN
    ALTER TABLE "tickets"
      ADD CONSTRAINT "tickets_branchId_fkey"
      FOREIGN KEY ("branchId") REFERENCES "branches"(id)
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "receipt_vouchers_cashboxOrBankAccountId_idx"
  ON "receipt_vouchers"("cashboxOrBankAccountId");
CREATE INDEX IF NOT EXISTS "payment_vouchers_cashboxOrBankAccountId_idx"
  ON "payment_vouchers"("cashboxOrBankAccountId");
CREATE INDEX IF NOT EXISTS "departments_branch_id_idx" ON "departments"("branch_id");
CREATE INDEX IF NOT EXISTS "employees_branch_id_idx" ON "employees"("branch_id");
CREATE INDEX IF NOT EXISTS "employees_department_id_idx" ON "employees"("department_id");
CREATE INDEX IF NOT EXISTS "tickets_customer_id_idx" ON "tickets"("customer_id");
CREATE INDEX IF NOT EXISTS "tickets_customer_account_id_idx" ON "tickets"("customer_account_id");
CREATE INDEX IF NOT EXISTS "tickets_supplier_id_idx" ON "tickets"("supplier_id");
CREATE INDEX IF NOT EXISTS "tickets_supplier_account_id_idx" ON "tickets"("supplier_account_id");
CREATE INDEX IF NOT EXISTS "tickets_airline_id_idx" ON "tickets"("airline_id");
CREATE INDEX IF NOT EXISTS "tickets_cashbox_account_id_idx" ON "tickets"("cashbox_account_id");

COMMIT;
