import { Controller, Post, Body, Get, Patch, Param, UseGuards, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

@ApiTags('المصادقة وتسجيل الدخول')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  // عشر محاولات في الدقيقة لكل عنوان: تكفي أخطاء الكتابة، وتخنق التخمين الآلي.
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({ summary: 'تسجيل الدخول إلى النظام المحاسبي' })
  @ApiResponse({ status: 200, description: 'تم تسجيل الدخول بنجاح وتوليد Token JWT' })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'جلب بيانات المستخدم الحالي والشركة وصلاحياته' })
  async getProfile(@Req() req: any) {
    return this.authService.getProfile(req.user.userId);
  }

  @Get('users')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'جلب قائمة جميع مستخدمي النظام' })
  async getAllUsers(@Req() req: any) {
    return this.authService.getAllUsers(req.user.companyId);
  }

  @Post('users')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'إنشاء مستخدم نظام جديد' })
  async createUser(@Req() req: any, @Body() body: any) {
    return this.authService.createUser({
      name: body.name,
      email: body.email,
      password: body.password || '12345678',
      companyId: req.user.companyId,
      roleId: body.roleId,
      phone: body.phone,
    });
  }

  @Patch('users/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'تحديث بيانات مستخدم نظام' })
  async updateUser(@Param('id') id: string, @Body() body: any) {
    return this.authService.updateUser(id, body);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'تغيير كلمة المرور للمستخدم الحالي' })
  async changePassword(@Req() req: any, @Body() body: { oldPassword: string; newPassword: string }) {
    return this.authService.changePassword(req.user.userId, body.oldPassword, body.newPassword);
  }
}
