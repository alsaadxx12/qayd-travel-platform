import { IsString, IsNotEmpty, IsOptional, IsArray, ValidateNested, IsIn, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ChatMessageDto {
  @IsString()
  @IsNotEmpty()
  role!: 'user' | 'assistant';

  @IsString()
  @IsOptional()
  content!: string;

  @IsString()
  @IsOptional()
  imageBase64?: string;
}

export class PageContextDto {
  @IsString()
  @IsOptional()
  route?: string;

  @IsString()
  @IsOptional()
  entity?: string;

  @IsString()
  @IsOptional()
  recordId?: string;

  @IsString()
  @IsOptional()
  label?: string;
}

export class ChatRequestDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  messages!: ChatMessageDto[];

  @IsString()
  @IsOptional()
  currentPage?: string;

  @IsString()
  @IsOptional()
  conversationId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => PageContextDto)
  page?: PageContextDto;

  @IsString()
  @IsOptional()
  @IsIn(['ar', 'en'])
  locale?: 'ar' | 'en';
}

export class CreateConversationDto {
  @IsString()
  @IsOptional()
  title?: string;
}

export class MessageFeedbackDto {
  @IsString()
  @IsIn(['up', 'down'])
  feedback!: 'up' | 'down';
}

export class SetAiCreditGrantDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  grantUsd!: number;
}

export class ImportSessionDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  messages!: ChatMessageDto[];
}
