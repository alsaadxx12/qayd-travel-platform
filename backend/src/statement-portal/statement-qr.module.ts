import { Module } from '@nestjs/common';
import { StatementQrService } from './statement-qr.service';

/**
 * Deliberately tiny, and deliberately free of any import but Prisma.
 *
 * The PDF module needs a barcode and the portal module needs the PDF. Keeping the
 * barcode here — where it depends on nothing that could depend back on it — is what
 * lets both import it without the two forming a cycle.
 */
@Module({
  providers: [StatementQrService],
  exports: [StatementQrService],
})
export class StatementQrModule {}
