BEGIN;

ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "branch_id" TEXT;
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "branch_id" TEXT;
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "department_id" TEXT;

ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "customer_id" TEXT;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "customer_account_id" TEXT;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "supplier_id" TEXT;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "supplier_account_id" TEXT;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "airline_id" TEXT;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "cashbox_account_id" TEXT;

-- Resolve departments to a real branch. Exact IDs/codes/names win, then the main branch.
UPDATE "departments" AS d
SET "branch_id" = COALESCE(
  (
    SELECT b.id
    FROM "branches" AS b
    WHERE b."companyId" = d."companyId"
      AND (b.id = d."branch_id" OR b.id = d."branchName" OR b.code = d."branchName"
        OR b."nameAr" = d."branchName" OR b."nameEn" = d."branchName")
    ORDER BY CASE WHEN b.id = d."branch_id" THEN 0 WHEN b.id = d."branchName" THEN 1 ELSE 2 END
    LIMIT 1
  ),
  (
    SELECT b.id FROM "branches" AS b
    WHERE b."companyId" = d."companyId"
    ORDER BY b."isMain" DESC, b."createdAt" ASC
    LIMIT 1
  )
);

UPDATE "departments" AS d
SET "branchName" = b."nameAr"
FROM "branches" AS b
WHERE b.id = d."branch_id";

-- Materialize real department names found on legacy employees when no Department row exists.
INSERT INTO "departments" (
  id, "branch_id", "branchName", code, name, "companyId", "createdAt", "updatedAt"
)
SELECT DISTINCT
  md5(e."companyId" || ':legacy-department:' || e."branch_id" || ':' || BTRIM(e."departmentName"))::uuid::text,
  e."branch_id",
  b."nameAr",
  'LEG-D-' || UPPER(SUBSTRING(md5(e."companyId" || ':' || e."branch_id" || ':' || BTRIM(e."departmentName")), 1, 10)),
  BTRIM(e."departmentName"),
  e."companyId",
  NOW(),
  NOW()
FROM "employees" AS e
JOIN "branches" AS b ON b.id = e."branch_id" AND b."companyId" = e."companyId"
WHERE NULLIF(BTRIM(e."departmentName"), '') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "departments" d
    WHERE d."companyId" = e."companyId"
      AND d."branch_id" = e."branch_id"
      AND (d.id = e."departmentName" OR d.code = e."departmentName" OR BTRIM(d.name) = BTRIM(e."departmentName"))
  )
  AND NOT EXISTS (
    SELECT 1 FROM "departments" d
    WHERE d.id = md5(e."companyId" || ':legacy-department:' || e."branch_id" || ':' || BTRIM(e."departmentName"))::uuid::text
  );

-- Resolve employees to their branch and department in the same company.
UPDATE "employees" AS e
SET "branch_id" = COALESCE(
  (
    SELECT b.id
    FROM "branches" AS b
    WHERE b."companyId" = e."companyId"
      AND (b.id = e."branch_id" OR b.id = e."branchName" OR b.code = e."branchName"
        OR b."nameAr" = e."branchName" OR b."nameEn" = e."branchName")
    ORDER BY CASE WHEN b.id = e."branch_id" THEN 0 WHEN b.id = e."branchName" THEN 1 ELSE 2 END
    LIMIT 1
  ),
  (
    SELECT b.id FROM "branches" AS b
    WHERE b."companyId" = e."companyId"
    ORDER BY b."isMain" DESC, b."createdAt" ASC
    LIMIT 1
  )
);

UPDATE "employees" AS e
SET "department_id" = (
  SELECT d.id
  FROM "departments" AS d
  WHERE d."companyId" = e."companyId"
    AND (d.id = e."department_id" OR d.id = e."departmentName" OR d.code = e."departmentName" OR d.name = e."departmentName")
  ORDER BY
    CASE WHEN d.id = e."department_id" THEN 0 WHEN d."branch_id" = e."branch_id" THEN 1 ELSE 2 END,
    d."createdAt" ASC
  LIMIT 1
);

UPDATE "employees" AS e
SET "branchName" = b."nameAr"
FROM "branches" AS b
WHERE b.id = e."branch_id";

UPDATE "employees" AS e
SET "departmentName" = d.name
FROM "departments" AS d
WHERE d.id = e."department_id";

-- Normalize every legacy ticket branch to a real branch in its company.
UPDATE "tickets" AS t
SET "branchId" = COALESCE(
  (
    SELECT b.id
    FROM "branches" AS b
    WHERE b."companyId" = t."companyId"
      AND (b.id = t."branchId" OR b.code = t."branchId" OR b."nameAr" = t."branchId" OR b."nameEn" = t."branchId")
    ORDER BY CASE WHEN b.id = t."branchId" THEN 0 ELSE 1 END
    LIMIT 1
  ),
  (
    SELECT b.id FROM "branches" AS b
    WHERE b."companyId" = t."companyId"
    ORDER BY b."isMain" DESC, b."createdAt" ASC
    LIMIT 1
  )
);

-- Customer entity and account.
-- Legacy party names become real zero-balance master records; no financial movements are invented.
WITH customer_labels AS (
  SELECT DISTINCT t."companyId", BTRIM(t."customerName") AS name
  FROM "tickets" t
  WHERE COALESCE(t."netSell", 0) > 0
    AND UPPER(COALESCE(t."paymentType", '')) IN ('CREDIT', 'آجل')
    AND NULLIF(BTRIM(t."customerName"), '') IS NOT NULL
)
INSERT INTO "accounts" (
  id, code, "nameAr", type, category, "isParent", "companyId", balance, level,
  "isSystem", currency, "branchScope", "branchIds", "createdAt", "updatedAt"
)
SELECT
  md5(l."companyId" || ':legacy-customer-account:' || l.name)::uuid::text,
  'LEG-C-' || UPPER(SUBSTRING(md5(l."companyId" || ':' || l.name), 1, 10)),
  l.name,
  'ASSET',
  'CUSTOMER',
  FALSE,
  l."companyId",
  0,
  1,
  FALSE,
  'IQD',
  'ALL_BRANCHES',
  ARRAY[]::TEXT[],
  NOW(),
  NOW()
FROM customer_labels l
WHERE NOT EXISTS (
    SELECT 1 FROM "customers" c
    WHERE c."companyId" = l."companyId" AND BTRIM(c."nameAr") = l.name
  )
  AND NOT EXISTS (
    SELECT 1 FROM "accounts" a
    WHERE a."companyId" = l."companyId"
      AND (a.id = l.name OR a.code = l.name OR BTRIM(a."nameAr") = l.name OR BTRIM(COALESCE(a."nameEn", '')) = l.name)
  )
  AND NOT EXISTS (
    SELECT 1 FROM "accounts" a
    WHERE a.id = md5(l."companyId" || ':legacy-customer-account:' || l.name)::uuid::text
  );

WITH customer_labels AS (
  SELECT DISTINCT t."companyId", BTRIM(t."customerName") AS name
  FROM "tickets" t
  WHERE COALESCE(t."netSell", 0) > 0
    AND UPPER(COALESCE(t."paymentType", '')) IN ('CREDIT', 'آجل')
    AND NULLIF(BTRIM(t."customerName"), '') IS NOT NULL
), resolved AS (
  SELECT l."companyId", l.name, a.id AS "accountId"
  FROM customer_labels l
  JOIN LATERAL (
    SELECT a.id FROM "accounts" a
    WHERE a."companyId" = l."companyId"
      AND (a.id = l.name OR a.code = l.name OR BTRIM(a."nameAr") = l.name OR BTRIM(COALESCE(a."nameEn", '')) = l.name)
    ORDER BY CASE WHEN a.id = l.name THEN 0 WHEN a.code = l.name THEN 1 ELSE 2 END
    LIMIT 1
  ) a ON TRUE
)
INSERT INTO "customers" (id, code, "nameAr", "accountId", "companyId", "isActive", "createdAt")
SELECT
  md5(r."companyId" || ':legacy-customer:' || r.name)::uuid::text,
  'LEG-C-' || UPPER(SUBSTRING(md5(r."companyId" || ':' || r.name), 1, 10)),
  r.name,
  r."accountId",
  r."companyId",
  TRUE,
  NOW()
FROM resolved r
WHERE NOT EXISTS (
    SELECT 1 FROM "customers" c
    WHERE c."companyId" = r."companyId" AND (BTRIM(c."nameAr") = r.name OR c."accountId" = r."accountId")
  )
  AND NOT EXISTS (
    SELECT 1 FROM "customers" c
    WHERE c.id = md5(r."companyId" || ':legacy-customer:' || r.name)::uuid::text
  );

UPDATE "tickets" AS t
SET "customer_id" = (
  SELECT c.id
  FROM "customers" AS c
  WHERE c."companyId" = t."companyId"
    AND (c.id = BTRIM(t."customerName") OR c.code = BTRIM(t."customerName") OR BTRIM(c."nameAr") = BTRIM(t."customerName") OR BTRIM(COALESCE(c."nameEn", '')) = BTRIM(t."customerName"))
  ORDER BY CASE WHEN c.id = t."customerName" THEN 0 WHEN c.code = t."customerName" THEN 1 ELSE 2 END
  LIMIT 1
)
WHERE t."customer_id" IS NULL AND NULLIF(BTRIM(t."customerName"), '') IS NOT NULL;

UPDATE "tickets" AS t
SET "customer_account_id" = c."accountId"
FROM "customers" AS c
WHERE c.id = t."customer_id" AND t."customer_account_id" IS NULL;

UPDATE "tickets" AS t
SET "customer_account_id" = (
  SELECT a.id
  FROM "accounts" AS a
  WHERE a."companyId" = t."companyId"
    AND (a.id = BTRIM(t."customerName") OR a.code = BTRIM(t."customerName") OR BTRIM(a."nameAr") = BTRIM(t."customerName") OR BTRIM(COALESCE(a."nameEn", '')) = BTRIM(t."customerName"))
  ORDER BY CASE WHEN a.id = t."customerName" THEN 0 WHEN a.code = t."customerName" THEN 1 ELSE 2 END
  LIMIT 1
)
WHERE t."customer_account_id" IS NULL AND NULLIF(BTRIM(t."customerName"), '') IS NOT NULL;

-- Supplier entity and account.
WITH supplier_labels AS (
  SELECT DISTINCT t."companyId", BTRIM(COALESCE(NULLIF(t."supplierAccountName", ''), t."supplierAccount")) AS name
  FROM "tickets" t
  WHERE COALESCE(t."netBuy", 0) > 0
    AND NULLIF(BTRIM(COALESCE(NULLIF(t."supplierAccountName", ''), t."supplierAccount")), '') IS NOT NULL
)
INSERT INTO "accounts" (
  id, code, "nameAr", type, category, "isParent", "companyId", balance, level,
  "isSystem", currency, "branchScope", "branchIds", "createdAt", "updatedAt"
)
SELECT
  md5(l."companyId" || ':legacy-supplier-account:' || l.name)::uuid::text,
  'LEG-S-' || UPPER(SUBSTRING(md5(l."companyId" || ':' || l.name), 1, 10)),
  l.name,
  'LIABILITY',
  'SUPPLIER',
  FALSE,
  l."companyId",
  0,
  1,
  FALSE,
  'IQD',
  'ALL_BRANCHES',
  ARRAY[]::TEXT[],
  NOW(),
  NOW()
FROM supplier_labels l
WHERE NOT EXISTS (
    SELECT 1 FROM "suppliers" s
    WHERE s."companyId" = l."companyId" AND BTRIM(s."nameAr") = l.name
  )
  AND NOT EXISTS (
    SELECT 1 FROM "accounts" a
    WHERE a."companyId" = l."companyId"
      AND (a.id = l.name OR a.code = l.name OR BTRIM(a."nameAr") = l.name OR BTRIM(COALESCE(a."nameEn", '')) = l.name)
  )
  AND NOT EXISTS (
    SELECT 1 FROM "accounts" a
    WHERE a.id = md5(l."companyId" || ':legacy-supplier-account:' || l.name)::uuid::text
  );

WITH supplier_labels AS (
  SELECT DISTINCT t."companyId", BTRIM(COALESCE(NULLIF(t."supplierAccountName", ''), t."supplierAccount")) AS name
  FROM "tickets" t
  WHERE COALESCE(t."netBuy", 0) > 0
    AND NULLIF(BTRIM(COALESCE(NULLIF(t."supplierAccountName", ''), t."supplierAccount")), '') IS NOT NULL
), resolved AS (
  SELECT l."companyId", l.name, a.id AS "accountId"
  FROM supplier_labels l
  JOIN LATERAL (
    SELECT a.id FROM "accounts" a
    WHERE a."companyId" = l."companyId"
      AND (a.id = l.name OR a.code = l.name OR BTRIM(a."nameAr") = l.name OR BTRIM(COALESCE(a."nameEn", '')) = l.name)
    ORDER BY CASE WHEN a.id = l.name THEN 0 WHEN a.code = l.name THEN 1 ELSE 2 END
    LIMIT 1
  ) a ON TRUE
)
INSERT INTO "suppliers" (id, code, "nameAr", "isAirline", "accountId", "companyId", "isActive", "createdAt")
SELECT
  md5(r."companyId" || ':legacy-supplier:' || r.name)::uuid::text,
  'LEG-S-' || UPPER(SUBSTRING(md5(r."companyId" || ':' || r.name), 1, 10)),
  r.name,
  FALSE,
  r."accountId",
  r."companyId",
  TRUE,
  NOW()
FROM resolved r
WHERE NOT EXISTS (
    SELECT 1 FROM "suppliers" s
    WHERE s."companyId" = r."companyId" AND (BTRIM(s."nameAr") = r.name OR s."accountId" = r."accountId")
  )
  AND NOT EXISTS (
    SELECT 1 FROM "suppliers" s
    WHERE s.id = md5(r."companyId" || ':legacy-supplier:' || r.name)::uuid::text
  );

UPDATE "tickets" AS t
SET "supplier_id" = (
  SELECT s.id
  FROM "suppliers" AS s
  WHERE s."companyId" = t."companyId"
    AND (
      s.id = BTRIM(t."supplierAccount") OR s.code = BTRIM(t."supplierAccount") OR BTRIM(s."nameAr") = BTRIM(t."supplierAccount") OR BTRIM(COALESCE(s."nameEn", '')) = BTRIM(t."supplierAccount")
      OR s.id = BTRIM(t."supplierAccountName") OR s.code = BTRIM(t."supplierAccountName")
      OR BTRIM(s."nameAr") = BTRIM(t."supplierAccountName") OR BTRIM(COALESCE(s."nameEn", '')) = BTRIM(t."supplierAccountName")
    )
  ORDER BY CASE WHEN s.id = t."supplierAccount" THEN 0 WHEN s.code = t."supplierAccount" THEN 1 ELSE 2 END
  LIMIT 1
)
WHERE t."supplier_id" IS NULL
  AND (NULLIF(BTRIM(t."supplierAccount"), '') IS NOT NULL OR NULLIF(BTRIM(t."supplierAccountName"), '') IS NOT NULL);

UPDATE "tickets" AS t
SET "supplier_account_id" = s."accountId"
FROM "suppliers" AS s
WHERE s.id = t."supplier_id" AND t."supplier_account_id" IS NULL;

UPDATE "tickets" AS t
SET "supplier_account_id" = (
  SELECT a.id
  FROM "accounts" AS a
  WHERE a."companyId" = t."companyId"
    AND (
      a.id = BTRIM(t."supplierAccount") OR a.code = BTRIM(t."supplierAccount") OR BTRIM(a."nameAr") = BTRIM(t."supplierAccount") OR BTRIM(COALESCE(a."nameEn", '')) = BTRIM(t."supplierAccount")
      OR a.id = BTRIM(t."supplierAccountName") OR a.code = BTRIM(t."supplierAccountName")
      OR BTRIM(a."nameAr") = BTRIM(t."supplierAccountName") OR BTRIM(COALESCE(a."nameEn", '')) = BTRIM(t."supplierAccountName")
    )
  ORDER BY CASE WHEN a.id = t."supplierAccount" THEN 0 WHEN a.code = t."supplierAccount" THEN 1 ELSE 2 END
  LIMIT 1
)
WHERE t."supplier_account_id" IS NULL
  AND (NULLIF(BTRIM(t."supplierAccount"), '') IS NOT NULL OR NULLIF(BTRIM(t."supplierAccountName"), '') IS NOT NULL);

-- Airline relation is relevant to tickets; VISA rows keep destination text without inventing an airline.
UPDATE "tickets" AS t
SET "airline_id" = (
  SELECT a.id
  FROM "airlines" AS a
  WHERE a."companyId" = t."companyId"
    AND (
      a.id = BTRIM(t.airline) OR a.code = BTRIM(t.airline)
      OR BTRIM(a."nameAr") = BTRIM(t.airline) OR BTRIM(COALESCE(a."nameEn", '')) = BTRIM(t.airline)
      OR BTRIM(a."nameAr") ILIKE BTRIM(t.airline) || ' (%'
    )
  ORDER BY CASE WHEN a.id = t.airline THEN 0 WHEN a.code = t.airline THEN 1 ELSE 2 END
  LIMIT 1
)
WHERE t."airline_id" IS NULL AND t."tripType" IS DISTINCT FROM 'VISA' AND NULLIF(BTRIM(t.airline), '') IS NOT NULL;

-- Cashbox/bank fields already contain either an Account ID or a Cashbox ID/code/name.
UPDATE "tickets" AS t
SET "cashbox_account_id" = (
  SELECT a.id
  FROM "accounts" AS a
  WHERE a."companyId" = t."companyId"
    AND (
      a.id = t."receiving_cashbox" OR a.code = t."receiving_cashbox" OR a."nameAr" = t."receiving_cashbox"
      OR a.id = t.cashbox OR a.code = t.cashbox OR a."nameAr" = t.cashbox
      OR (t."payment_method" IS DISTINCT FROM 'CASH_HAND'
        AND (a.id = t."payment_method" OR a.code = t."payment_method" OR a."nameAr" = t."payment_method"))
    )
  ORDER BY CASE WHEN a.id = t."receiving_cashbox" THEN 0 WHEN a.id = t.cashbox THEN 1 ELSE 2 END
  LIMIT 1
)
WHERE t."cashbox_account_id" IS NULL;

UPDATE "tickets" AS t
SET "cashbox_account_id" = (
  SELECT c."accountId"
  FROM "cashboxes" AS c
  WHERE c."companyId" = t."companyId"
    AND (
      c.id = t."receiving_cashbox" OR c.code = t."receiving_cashbox" OR c."nameAr" = t."receiving_cashbox"
      OR c.id = t.cashbox OR c.code = t.cashbox OR c."nameAr" = t.cashbox
    )
  ORDER BY CASE WHEN c.id = t."receiving_cashbox" THEN 0 ELSE 1 END
  LIMIT 1
)
WHERE t."cashbox_account_id" IS NULL;

-- Convert legacy voucher values that pointed to Cashbox/Bank rather than Account.
UPDATE "receipt_vouchers" AS v
SET "cashboxOrBankAccountId" = c."accountId"
FROM "cashboxes" AS c
WHERE c."companyId" = v."companyId"
  AND NOT EXISTS (SELECT 1 FROM "accounts" a WHERE a.id = v."cashboxOrBankAccountId")
  AND (c.id = v."cashboxOrBankAccountId" OR c.code = v."cashboxOrBankAccountId" OR c."nameAr" = v."cashboxOrBankAccountId");

UPDATE "payment_vouchers" AS v
SET "cashboxOrBankAccountId" = c."accountId"
FROM "cashboxes" AS c
WHERE c."companyId" = v."companyId"
  AND NOT EXISTS (SELECT 1 FROM "accounts" a WHERE a.id = v."cashboxOrBankAccountId")
  AND (c.id = v."cashboxOrBankAccountId" OR c.code = v."cashboxOrBankAccountId" OR c."nameAr" = v."cashboxOrBankAccountId");

UPDATE "receipt_vouchers" AS v
SET "cashboxOrBankAccountId" = b."accountId"
FROM "banks" AS b
WHERE b."companyId" = v."companyId"
  AND NOT EXISTS (SELECT 1 FROM "accounts" a WHERE a.id = v."cashboxOrBankAccountId")
  AND (b.id = v."cashboxOrBankAccountId" OR b.code = v."cashboxOrBankAccountId" OR b."nameAr" = v."cashboxOrBankAccountId");

UPDATE "payment_vouchers" AS v
SET "cashboxOrBankAccountId" = b."accountId"
FROM "banks" AS b
WHERE b."companyId" = v."companyId"
  AND NOT EXISTS (SELECT 1 FROM "accounts" a WHERE a.id = v."cashboxOrBankAccountId")
  AND (b.id = v."cashboxOrBankAccountId" OR b.code = v."cashboxOrBankAccountId" OR b."nameAr" = v."cashboxOrBankAccountId");

COMMIT;
