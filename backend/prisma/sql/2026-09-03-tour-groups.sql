-- نظام الكروبات: ملف مالي وتشغيلي كامل — ستة جداول إضافية، لا مساس بأي جدول قائم.

BEGIN;

CREATE TABLE IF NOT EXISTS tour_groups (
  id             TEXT PRIMARY KEY,
  "companyId"    TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  "branchId"     TEXT,
  "groupName"    TEXT NOT NULL,
  "groupType"    TEXT NOT NULL DEFAULT 'FULL',
  country        TEXT,
  "buyDate"      TIMESTAMP(3),
  "travelDate"   TIMESTAMP(3),
  active         BOOLEAN NOT NULL DEFAULT TRUE,
  status         TEXT NOT NULL DEFAULT 'OPEN',
  "openSale"     BOOLEAN NOT NULL DEFAULT FALSE,
  currency       TEXT NOT NULL DEFAULT 'USD',
  "exchangeRate" DECIMAL(65,30) NOT NULL DEFAULT 1,
  notes          TEXT,
  "createdById"  TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS tour_groups_company_created_idx ON tour_groups ("companyId", "createdAt");

CREATE TABLE IF NOT EXISTS group_price_systems (
  id          TEXT PRIMARY KEY,
  "groupId"   TEXT NOT NULL REFERENCES tour_groups(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  seats       INTEGER NOT NULL DEFAULT 0,
  currency    TEXT NOT NULL DEFAULT 'USD',
  "salePrice" DECIMAL(65,30) NOT NULL DEFAULT 0,
  active      BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS group_price_systems_group_idx ON group_price_systems ("groupId");

CREATE TABLE IF NOT EXISTS group_template_items (
  id                  TEXT PRIMARY KEY,
  "priceSystemId"     TEXT NOT NULL REFERENCES group_price_systems(id) ON DELETE CASCADE,
  kind                TEXT NOT NULL,
  "supplierName"      TEXT,
  "supplierAccountId" TEXT,
  "expectedBuy"       DECIMAL(65,30) NOT NULL DEFAULT 0,
  currency            TEXT NOT NULL DEFAULT 'USD'
);
CREATE INDEX IF NOT EXISTS group_template_items_ps_idx ON group_template_items ("priceSystemId");

CREATE TABLE IF NOT EXISTS group_charges (
  id                  TEXT PRIMARY KEY,
  "groupId"           TEXT NOT NULL REFERENCES tour_groups(id) ON DELETE CASCADE,
  "chargeType"        TEXT NOT NULL,
  category            TEXT NOT NULL,
  "supplierName"      TEXT,
  "supplierAccountId" TEXT,
  amount              DECIMAL(65,30) NOT NULL DEFAULT 0,
  currency            TEXT NOT NULL DEFAULT 'USD',
  date                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  notes               TEXT
);
CREATE INDEX IF NOT EXISTS group_charges_group_type_idx ON group_charges ("groupId", "chargeType");

CREATE TABLE IF NOT EXISTS group_passengers (
  id                  TEXT PRIMARY KEY,
  "groupId"           TEXT NOT NULL REFERENCES tour_groups(id) ON DELETE CASCADE,
  "priceSystemId"     TEXT REFERENCES group_price_systems(id) ON DELETE SET NULL,
  "customerName"      TEXT NOT NULL,
  "customerId"        TEXT,
  "customerAccountId" TEXT,
  "passengerName"     TEXT NOT NULL,
  passport            TEXT,
  agent               TEXT,
  "salePrice"         DECIMAL(65,30) NOT NULL DEFAULT 0,
  currency            TEXT NOT NULL DEFAULT 'USD',
  "payType"           TEXT NOT NULL DEFAULT 'CASH',
  "paymentAccountId"  TEXT,
  "collectedAmount"   DECIMAL(65,30) NOT NULL DEFAULT 0,
  "voucherNumber"     TEXT,
  "fCode"             TEXT,
  state               TEXT NOT NULL DEFAULT 'RESERVED',
  notes               TEXT,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS group_passengers_group_state_idx ON group_passengers ("groupId", state);

CREATE TABLE IF NOT EXISTS group_passenger_services (
  id                  TEXT PRIMARY KEY,
  "passengerId"       TEXT NOT NULL REFERENCES group_passengers(id) ON DELETE CASCADE,
  kind                TEXT NOT NULL,
  "supplierName"      TEXT,
  "supplierAccountId" TEXT,
  "expectedBuy"       DECIMAL(65,30) NOT NULL DEFAULT 0,
  "finalBuy"          DECIMAL(65,30),
  currency            TEXT NOT NULL DEFAULT 'USD',
  status              TEXT NOT NULL DEFAULT 'NOT_COMPLETE',
  "completedAt"       TIMESTAMP(3)
);
CREATE INDEX IF NOT EXISTS group_passenger_services_pax_status_idx ON group_passenger_services ("passengerId", status);

COMMIT;
