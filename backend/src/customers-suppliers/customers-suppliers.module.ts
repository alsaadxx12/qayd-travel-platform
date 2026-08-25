import { Module } from '@nestjs/common';
import { CustomersSuppliersService } from './customers-suppliers.service';
import { CustomersSuppliersController } from './customers-suppliers.controller';

@Module({
  controllers: [CustomersSuppliersController],
  providers: [CustomersSuppliersService],
  exports: [CustomersSuppliersService],
})
export class CustomersSuppliersModule {}
