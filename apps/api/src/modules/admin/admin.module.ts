import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { DkpModule } from '../dkp/dkp.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [DkpModule, AuthModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
