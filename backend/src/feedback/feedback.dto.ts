import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';

export class CreateFeedbackDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsString()
  @IsOptional()
  type?: string; // BUG, FEEDBACK, INQUIRY, FEATURE

  @IsString()
  @IsOptional()
  severity?: string; // LOW, MEDIUM, HIGH, CRITICAL

  @IsString()
  @IsOptional()
  screenshotUrl?: string;

  @IsString()
  @IsOptional()
  pageUrl?: string;

  @IsString()
  @IsOptional()
  userName?: string;

  @IsString()
  @IsOptional()
  userEmail?: string;

  @IsString()
  @IsOptional()
  userPhone?: string;

  @IsString()
  @IsOptional()
  tenantName?: string;
}

export class ResolveFeedbackDto {
  @IsString()
  @IsNotEmpty()
  adminReply!: string;

  @IsString()
  @IsOptional()
  status?: string; // RESOLVED, CLOSED
}
