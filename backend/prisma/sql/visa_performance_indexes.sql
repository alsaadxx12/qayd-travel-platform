CREATE INDEX IF NOT EXISTS "tickets_companyId_tripType_createdAt_idx"
ON "tickets" ("companyId", "tripType", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "tickets_companyId_branchId_tripType_createdAt_idx"
ON "tickets" ("companyId", "branchId", "tripType", "createdAt" DESC);

ANALYZE "tickets";
