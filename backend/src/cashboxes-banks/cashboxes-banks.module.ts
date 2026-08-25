import { Module } from '@nestjs/common';
import { CashboxesBanksService } from './cashboxes-banks.service';
import { CashboxesBanksController } from './cashboxes-banks.controller';
import { AccountsModule } from '../accounts/accounts.module';

@Module({
  imports: [AccountsModule],
  controllers: [CashboxesBanksController],
  providers: [CashboxesBanksService],
  exports: [CashboxesBanksService],
})
export class CashboxesBanksModule {}
