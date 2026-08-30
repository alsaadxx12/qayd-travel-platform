import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ReportsModule } from '../reports/reports.module';
import { PdfModule } from '../pdf/pdf.module';
import { StatementQrModule } from './statement-qr.module';
import { StatementPortalService } from './statement-portal.service';
import { StatementPortalController } from './statement-portal.controller';
import { StatementTokensController } from './statement-tokens.controller';

/**
 * `JwtModule.register({})` on purpose: portal sessions are signed with a secret of
 * their own, passed per call, so no module-wide secret is registered here and a portal
 * session can never be mistaken for a staff token.
 */
@Module({
  imports: [ReportsModule, PdfModule, StatementQrModule, JwtModule.register({})],
  controllers: [StatementPortalController, StatementTokensController],
  providers: [StatementPortalService],
  exports: [StatementPortalService],
})
export class StatementPortalModule {}
