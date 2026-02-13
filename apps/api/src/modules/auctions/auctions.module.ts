import { Module } from '@nestjs/common';
import { AuctionsService } from './auctions.service';
import { AuctionsController } from './auctions.controller';
import { DkpModule } from '../dkp/dkp.module';
import { WarehouseModule } from '../warehouse/warehouse.module';

@Module({
  imports: [DkpModule, WarehouseModule],
  controllers: [AuctionsController],
  providers: [AuctionsService],
  exports: [AuctionsService],
})
export class AuctionsModule {}
