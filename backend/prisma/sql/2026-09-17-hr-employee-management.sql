-- منظومة إدارة الموظفين والموارد البشرية (HR Suite)
-- 1. الرواتب والأجور (Salaries & Payroll)
-- 2. سجل الحضور والانصراف (Attendance)
-- 3. طلبات الإجازات (Leaves)
-- 4. سجل النقاط والتحفيز (Points)
-- 5. مسابقات وتحديات الموظفين (Competitions)

BEGIN;

-- جدول مسيرات الرواتب
CREATE TABLE IF NOT EXISTS hr_salaries (
  id             TEXT PRIMARY KEY,
  "companyId"    TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  "employeeId"   TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  month          TEXT NOT NULL, -- e.g. "2026-09"
  "baseSalary"   DECIMAL(65,30) NOT NULL DEFAULT 0,
  allowances     DECIMAL(65,30) NOT NULL DEFAULT 0,
  bonuses        DECIMAL(65,30) NOT NULL DEFAULT 0,
  deductions     DECIMAL(65,30) NOT NULL DEFAULT 0,
  "netSalary"    DECIMAL(65,30) NOT NULL DEFAULT 0,
  currency       TEXT NOT NULL DEFAULT 'USD',
  status         TEXT NOT NULL DEFAULT 'PENDING', -- PENDING, APPROVED, PAID
  "paymentMethod" TEXT,
  "paidAt"       TIMESTAMP(3),
  notes          TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS hr_salaries_company_month_idx ON hr_salaries ("companyId", month);
CREATE INDEX IF NOT EXISTS hr_salaries_employee_idx ON hr_salaries ("employeeId");

-- جدول سجل الحضور والانصراف
CREATE TABLE IF NOT EXISTS hr_attendances (
  id             TEXT PRIMARY KEY,
  "companyId"    TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  "employeeId"   TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date           TIMESTAMP(3) NOT NULL,
  "checkIn"      TEXT,
  "checkOut"     TEXT,
  status         TEXT NOT NULL DEFAULT 'PRESENT', -- PRESENT, LATE, ABSENT, EXCUSED, ON_LEAVE
  "lateMinutes"  INTEGER NOT NULL DEFAULT 0,
  "overtimeHours" DECIMAL(65,30) NOT NULL DEFAULT 0,
  notes          TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS hr_attendances_company_date_idx ON hr_attendances ("companyId", date);
CREATE INDEX IF NOT EXISTS hr_attendances_employee_idx ON hr_attendances ("employeeId");

-- جدول طلبات الإجازات
CREATE TABLE IF NOT EXISTS hr_leaves (
  id             TEXT PRIMARY KEY,
  "companyId"    TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  "employeeId"   TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  "leaveType"    TEXT NOT NULL DEFAULT 'ANNUAL', -- ANNUAL, SICK, EMERGENCY, UNPAID, OTHER
  "startDate"    TIMESTAMP(3) NOT NULL,
  "endDate"      TIMESTAMP(3) NOT NULL,
  "daysCount"    INTEGER NOT NULL DEFAULT 1,
  reason         TEXT,
  status         TEXT NOT NULL DEFAULT 'PENDING', -- PENDING, APPROVED, REJECTED
  "approvedBy"   TEXT,
  "actionDate"   TIMESTAMP(3),
  notes          TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS hr_leaves_company_status_idx ON hr_leaves ("companyId", status);
CREATE INDEX IF NOT EXISTS hr_leaves_employee_idx ON hr_leaves ("employeeId");

-- جدول سجل النقاط والتحفيز
CREATE TABLE IF NOT EXISTS hr_points (
  id             TEXT PRIMARY KEY,
  "companyId"    TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  "employeeId"   TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  points         INTEGER NOT NULL DEFAULT 0,
  reason         TEXT NOT NULL,
  category       TEXT NOT NULL DEFAULT 'ACHIEVEMENT', -- ACHIEVEMENT, ATTENDANCE, SALES, DISCIPLINE, BONUS
  "awardedBy"    TEXT,
  date           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS hr_points_company_idx ON hr_points ("companyId");
CREATE INDEX IF NOT EXISTS hr_points_employee_idx ON hr_points ("employeeId");

-- جدول مسابقات وتحديات الموظفين
CREATE TABLE IF NOT EXISTS hr_competitions (
  id             TEXT PRIMARY KEY,
  "companyId"    TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  description    TEXT,
  "targetType"   TEXT NOT NULL DEFAULT 'SALES_VOLUME', -- SALES_VOLUME, TICKETS_COUNT, ATTENDANCE_STREAK, POINTS_EARNED
  "targetValue"  DECIMAL(65,30) NOT NULL DEFAULT 0,
  reward         TEXT NOT NULL,
  "startDate"    TIMESTAMP(3) NOT NULL,
  "endDate"      TIMESTAMP(3) NOT NULL,
  status         TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, COMPLETED, CANCELLED
  "winnerEmployeeId" TEXT REFERENCES employees(id) ON DELETE SET NULL,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS hr_competitions_company_status_idx ON hr_competitions ("companyId", status);

COMMIT;
