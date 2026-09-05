import { Controller, Get, Post, Body, Param, Query, Headers, HttpCode, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
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
  // التحقق بأربعة أرقام فقط — بلا كابحٍ يُستنفد فضاؤها كله في دقائق.
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @HttpCode(200)
  @ApiOperation({ summary: 'التحقق بآخر أربعة أرقام من الهاتف، ويعيد جلسة قصيرة لقراءة الكشف' })
  async verify(@Param('token') token: string, @Body() body: { last4?: string }) {
    return this.portal.verify(token, String(body?.last4 || ''));
  }

  /**
   * The statement as a file, so a scan ends in a download rather than in reading a
   * page. Falls back to the HTML document when the server has no browser to print a
   * PDF with — the customer still gets the whole statement, in a file their phone can
   * open, and the response says which kind it is.
   */
  @Get(':token/download')
  async download(
    @Headers('x-portal-session') headerSession: string,
    @Query('session') querySession: string,
    @Res() res: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const session = headerSession || querySession;
    const file = await this.portal.statementFile(String(session || ''), startDate, endDate);
    const encoded = encodeURIComponent(file.filename);

    res.setHeader('Content-Type', file.kind === 'pdf' ? 'application/pdf' : 'text/html; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="statement.${file.kind}"; filename*=UTF-8''${encoded}`,
    );
    res.setHeader('Content-Length', String(file.buffer.length));
    // Read by the page so it can tell the visitor what it just handed them.
    res.setHeader('X-Statement-Kind', file.kind);
    res.setHeader('Access-Control-Expose-Headers', 'X-Statement-Kind,Content-Disposition');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(file.buffer);
  }

  @Get(':token/data')
  @ApiOperation({ summary: 'الكشف الكامل. يتطلب جلسة صادرة عن التحقق أعلاه.' })
  async statement(
    @Headers('x-portal-session') headerSession: string,
    @Query('session') querySession: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const session = headerSession || querySession;
    // The token in the path is ignored here on purpose: the session already names the
    // one account this visitor may read, and honouring the path as well would let a
    // valid session be pointed at a different token's account.
    return this.portal.statement(String(session || ''), startDate, endDate);
  }
}
