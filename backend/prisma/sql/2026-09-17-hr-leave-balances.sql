-- جدول أرصدة الإجازات للموظفين
-- hr_leave_balances
CREATE TABLE IF NOT EXISTS hr_leave_balances (
  id                 TEXT PRIMARY KEY,
  "companyId"        TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  "employeeId"       TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  year               INTEGER NOT NULL DEFAULT 2026,
  "leaveType"        TEXT NOT NULL, -- ANNUAL, SICK, EMERGENCY, HOURLY
  "totalBalance"     DECIMAL(65,30) NOT NULL DEFAULT 0,
  "usedBalance"      DECIMAL(65,30) NOT NULL DEFAULT 0,
  "remainingBalance" DECIMAL(65,30) NOT NULL DEFAULT 0,
  unit               TEXT NOT NULL DEFAULT 'DAYS', -- DAYS, HOURS
  notes              TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT hr_leave_balances_company_employee_year_type_key UNIQUE ("companyId", "employeeId", year, "leaveType")
);

CREATE INDEX IF NOT EXISTS hr_leave_balances_company_year_idx ON hr_leave_balances ("companyId", year);
CREATE INDEX IF NOT EXISTS hr_leave_balances_employee_idx ON hr_leave_balances ("employeeId");

-- إضافة عمود hoursCount لجدول hr_leaves لدعم الإجازات الزمنية بالساعات
ALTER TABLE hr_leaves ADD COLUMN IF NOT EXISTS "hoursCount" DECIMAL(65,30) DEFAULT 0;
