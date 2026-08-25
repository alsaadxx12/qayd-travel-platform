import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { FeedbackService } from './feedback.service';
import { CreateFeedbackDto, ResolveFeedbackDto } from './feedback.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('feedback')
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post()
  async submitFeedback(@Body() dto: CreateFeedbackDto, @Request() req: any) {
    const user = req.user;
    const tenantId = user?.tenantId || user?.companyId;
    return await this.feedbackService.createFeedback(dto, user, tenantId);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async getAllFeedbacks(
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('severity') severity?: string,
    @Query('search') search?: string,
  ) {
    return await this.feedbackService.getAllFeedbacks({ status, type, severity, search });
  }

  @Get('my/tickets')
  @UseGuards(JwtAuthGuard)
  async getMyFeedbacks(@Request() req: any) {
    const userId = req.user?.id || req.user?.userId || req.user?.sub;
    const tenantId = req.user?.tenantId || req.user?.companyId;
    const userEmail = req.user?.email;
    const userName = req.user?.name;
    const companyName = req.user?.companyName;
    const tenantName = req.user?.tenantName;
    return await this.feedbackService.getMyFeedbacks(
      userId,
      tenantId,
      userEmail,
      userName,
      companyName,
      tenantName,
    );
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getFeedbackById(@Param('id') id: string) {
    return await this.feedbackService.getFeedbackById(id);
  }

  @Put(':id/resolve')
  @UseGuards(JwtAuthGuard)
  async resolveFeedback(
    @Param('id') id: string,
    @Body() dto: ResolveFeedbackDto,
    @Request() req: any,
  ) {
    return await this.feedbackService.resolveFeedback(id, dto, req.user);
  }

  @Put(':id/status')
  @UseGuards(JwtAuthGuard)
  async updateStatus(@Param('id') id: string, @Body('status') status: string) {
    return await this.feedbackService.updateStatus(id, status);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async deleteFeedback(@Param('id') id: string) {
    return await this.feedbackService.deleteFeedback(id);
  }
}
