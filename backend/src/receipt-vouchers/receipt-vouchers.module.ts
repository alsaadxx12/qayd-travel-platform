import { Module } from '@nestjs/common';
import { ReceiptVouchersService } from './receipt-vouchers.service';
import { ReceiptVouchersController } from './receipt-vouchers.controller';

@Module({
  controllers: [ReceiptVouchersController],
  providers: [ReceiptVouchersService],
  exports: [ReceiptVouchersService],
})
export class ReceiptVouchersModule {}
