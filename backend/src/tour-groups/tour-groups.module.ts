import { Module } from '@nestjs/common';
import { TourGroupsService } from './tour-groups.service';
import { TourGroupsController } from './tour-groups.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { SequencesModule } from '../sequences/sequences.module';

@Module({
  imports: [PrismaModule, SequencesModule],
  controllers: [TourGroupsController],
  providers: [TourGroupsService],
  exports: [TourGroupsService],
})
export class TourGroupsModule {}
