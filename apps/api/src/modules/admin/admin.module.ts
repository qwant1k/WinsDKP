import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { DkpModule } from '../dkp/dkp.module';

@Module({
  imports: [DkpModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
