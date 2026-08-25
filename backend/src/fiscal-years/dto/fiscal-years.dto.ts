import { IsString, IsNotEmpty, IsOptional, IsDateString, IsBoolean, IsArray, IsEnum } from 'class-validator';

export enum FiscalYearStatusEnum {
  DRAFT = 'DRAFT',
  OPEN = 'OPEN',
  SOFT_CLOSED = 'SOFT_CLOSED',
  CLOSED = 'CLOSED',
  REOPENED = 'REOPENED',
}

export class CreateFiscalYearDto {
  @IsString()
  @IsNotEmpty()
  name: string; // e.g. "2026"

  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @IsDateString()
  @IsNotEmpty()
  endDate: string;

  @IsOptional()
  @IsString()
  baseCurrency?: string;

  @IsOptional()
  @IsBoolean()
  isCurrent?: boolean;

  @IsOptional()
  @IsString()
  previousYearId?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  createMonthlyPeriods?: boolean;
}

export class UpdateFiscalYearDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  isCurrent?: boolean;
}

export class ExecuteClosingDto {
  @IsString()
  @IsNotEmpty()
  fiscalYearId: string;

  @IsString()
  @IsNotEmpty()
  targetFiscalYearId: string;

  @IsString()
  @IsNotEmpty()
  retainedEarningsAccountId: string; // Dynamic from chart of accounts

  @IsOptional()
  @IsString()
  closingDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ReopenFiscalYearDto {
  @IsString()
  @IsNotEmpty()
  reason: string;
}

export class RecloseFiscalYearDto {
  @IsString()
  @IsNotEmpty()
  reason: string;
}

export class RecalculateCascadingDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

export class SetActiveFiscalYearDto {
  @IsString()
  @IsNotEmpty()
  fiscalYearId: string;
}
