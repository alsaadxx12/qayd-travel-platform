import { Module } from '@nestjs/common';
import { PaymentVouchersService } from './payment-vouchers.service';
import { PaymentVouchersController } from './payment-vouchers.controller';

@Module({
  controllers: [PaymentVouchersController],
  providers: [PaymentVouchersService],
  exports: [PaymentVouchersService],
})
export class PaymentVouchersModule {}
