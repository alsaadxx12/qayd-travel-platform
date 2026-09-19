import { IsString, IsOptional, IsNumber, IsDateString, IsIn } from 'class-validator';

// ── Salaries DTOs ──
export class CreateSalaryDto {
  @IsString()
  employeeId: string;

  @IsString()
  month: string; // e.g. "2026-09"

  @IsNumber()
  baseSalary: number;

  @IsOptional()
  @IsNumber()
  allowances?: number;

  @IsOptional()
  @IsNumber()
  bonuses?: number;

  @IsOptional()
  @IsNumber()
  deductions?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateSalaryDto {
  @IsOptional()
  @IsNumber()
  baseSalary?: number;

  @IsOptional()
  @IsNumber()
  allowances?: number;

  @IsOptional()
  @IsNumber()
  bonuses?: number;

  @IsOptional()
  @IsNumber()
  deductions?: number;

  @IsOptional()
  @IsString()
  @IsIn(['PENDING', 'APPROVED', 'PAID'])
  status?: string;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

// ── Attendance DTOs ──
export class CreateAttendanceDto {
  @IsString()
  employeeId: string;

  @IsString()
  date: string; // ISO date or "YYYY-MM-DD"

  @IsOptional()
  @IsString()
  checkIn?: string;

  @IsOptional()
  @IsString()
  checkOut?: string;

  @IsOptional()
  @IsString()
  @IsIn(['PRESENT', 'LATE', 'ABSENT', 'EXCUSED', 'ON_LEAVE'])
  status?: string;

  @IsOptional()
  @IsNumber()
  lateMinutes?: number;

  @IsOptional()
  @IsNumber()
  overtimeHours?: number;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsString()
  deviceId?: string;

  @IsOptional()
  @IsString()
  deviceModel?: string;

  @IsOptional()
  @IsString()
  devicePlatform?: string;

  @IsOptional()
  @IsString()
  attestationType?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateAttendanceDto {
  @IsOptional()
  @IsString()
  checkIn?: string;

  @IsOptional()
  @IsString()
  checkOut?: string;

  @IsOptional()
  @IsString()
  @IsIn(['PRESENT', 'LATE', 'ABSENT', 'EXCUSED', 'ON_LEAVE'])
  status?: string;

  @IsOptional()
  @IsNumber()
  lateMinutes?: number;

  @IsOptional()
  @IsNumber()
  overtimeHours?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

// ── Leaves DTOs ──
export class CreateLeaveDto {
  @IsString()
  employeeId: string;

  @IsString()
  @IsIn(['ANNUAL', 'SICK', 'EMERGENCY', 'HOURLY', 'UNPAID', 'OTHER'])
  leaveType: string;

  @IsString()
  startDate: string;

  @IsString()
  endDate: string;

  @IsOptional()
  @IsNumber()
  daysCount?: number;

  @IsOptional()
  @IsNumber()
  hoursCount?: number;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateLeaveStatusDto {
  @IsString()
  @IsIn(['PENDING', 'APPROVED', 'REJECTED'])
  status: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

// ── Leave Balances DTOs ──
export class SetLeaveBalanceDto {
  @IsString()
  employeeId: string;

  @IsNumber()
  year: number;

  @IsString()
  @IsIn(['ANNUAL', 'SICK', 'EMERGENCY', 'HOURLY'])
  leaveType: string;

  @IsNumber()
  totalBalance: number;

  @IsOptional()
  @IsString()
  @IsIn(['DAYS', 'HOURS'])
  unit?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class BatchSetLeaveBalancesDto {
  @IsOptional()
  @IsString()
  branchId?: string;

  @IsNumber()
  year: number;

  @IsString()
  @IsIn(['ANNUAL', 'SICK', 'EMERGENCY', 'HOURLY'])
  leaveType: string;

  @IsNumber()
  totalBalance: number;

  @IsOptional()
  @IsString()
  @IsIn(['DAYS', 'HOURS'])
  unit?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

// ── Points DTOs ──
export class AwardPointsDto {
  @IsString()
  employeeId: string;

  @IsNumber()
  points: number; // can be positive or negative

  @IsString()
  reason: string;

  @IsOptional()
  @IsString()
  @IsIn(['ACHIEVEMENT', 'ATTENDANCE', 'SALES', 'DISCIPLINE', 'BONUS'])
  category?: string;

  @IsOptional()
  @IsString()
  date?: string;
}

// ── Competitions DTOs ──
export class CreateCompetitionDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  @IsIn(['SALES_VOLUME', 'TICKETS_COUNT', 'ATTENDANCE_STREAK', 'POINTS_EARNED'])
  targetType: string;

  @IsNumber()
  targetValue: number;

  @IsString()
  reward: string;

  @IsString()
  startDate: string;

  @IsString()
  endDate: string;
}

export class UpdateCompetitionDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  reward?: string;

  @IsOptional()
  @IsString()
  @IsIn(['ACTIVE', 'COMPLETED', 'CANCELLED'])
  status?: string;

  @IsOptional()
  @IsString()
  winnerEmployeeId?: string;
}
