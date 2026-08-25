import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin@travel.com', description: 'البريد الإلكتروني أو اسم المستخدم' })
  @IsString({ message: 'البريد الإلكتروني أو اسم المستخدم غير صالح' })
  @IsNotEmpty({ message: 'البريد الإلكتروني أو اسم المستخدم مطلوب' })
  email: string;

  @ApiProperty({ example: 'admin123', description: 'كلمة المرور' })
  @IsString()
  @IsNotEmpty({ message: 'كلمة المرور مطلوبة' })
  @MinLength(6, { message: 'كلمة المرور يجب أن لا تقل عن 6 أحرف' })
  password: string;
}
