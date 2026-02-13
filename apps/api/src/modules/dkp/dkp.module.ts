import { Module } from '@nestjs/common';
import { DkpService } from './dkp.service';
import { DkpController } from './dkp.controller';

@Module({
  controllers: [DkpController],
  providers: [DkpService],
  exports: [DkpService],
})
export class DkpModule {}
