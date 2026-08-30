import { Controller, Get, Post, Body, Param, Query, Headers, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { StatementPortalService } from './statement-portal.service';

/**
 * The only controller in the system with NO auth guard, by design: it is what a
 * customer's phone camera reaches after scanning the QR on their statement.
 *
 * Nothing here trusts the caller for anything. The token in the path is the only input
 * that selects data, the account is taken from the verified session and never from a
 * query parameter, and no endpoint accepts a companyId. There is deliberately no
 * endpoint that lists tokens, searches customers, or returns anything about an account
 * the caller has not already proven they hold the phone for.
 */
@ApiTags('بوابة كشف الحساب للعملاء (Public Statement Portal)')
@Controller('portal/statement')
export class StatementPortalController {
  constructor(private readonly portal: StatementPortalService) {}

  @Get(':token')
  @ApiOperation({
    summary:
      'ما يظهر قبل التحقق: اسم الوكالة واسم صاحب الحساب وتلميح الهاتف. لا مبالغ ولا حركات.',
  })
  async describe(@Param('token') token: string) {
    return this.portal.describe(token);
  }

  @Post(':token/verify')
  @HttpCode(200)
  @ApiOperation({ summary: 'التحقق بآخر أربعة أرقام من الهاتف، ويعيد جلسة قصيرة لقراءة الكشف' })
  async verify(@Param('token') token: string, @Body() body: { last4?: string }) {
    return this.portal.verify(token, String(body?.last4 || ''));
  }

  @Get(':token/data')
  @ApiOperation({ summary: 'الكشف الكامل. يتطلب جلسة صادرة عن التحقق أعلاه.' })
  async statement(
    @Headers('x-portal-session') session: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    // The token in the path is ignored here on purpose: the session already names the
    // one account this visitor may read, and honouring the path as well would let a
    // valid session be pointed at a different token's account.
    return this.portal.statement(String(session || ''), startDate, endDate);
  }
}
