import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './common/prisma/prisma.module';
import { RedisModule } from './common/redis/redis.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ClansModule } from './modules/clans/clans.module';
import { DkpModule } from './modules/dkp/dkp.module';
import { ActivitiesModule } from './modules/activities/activities.module';
import { AuctionsModule } from './modules/auctions/auctions.module';
import { RandomizerModule } from './modules/randomizer/randomizer.module';
import { WarehouseModule } from './modules/warehouse/warehouse.module';
import { NewsModule } from './modules/news/news.module';
import { FeedModule } from './modules/feed/feed.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AuditModule } from './modules/audit/audit.module';
import { AdminModule } from './modules/admin/admin.module';
import { HealthModule } from './modules/health/health.module';
import { MessagesModule } from './modules/messages/messages.module';
import { SearchModule } from './modules/search/search.module';
import { SocketModule } from './common/socket/socket.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    PrismaModule,
    RedisModule,
    SocketModule,
    AuthModule,
    UsersModule,
    ClansModule,
    DkpModule,
    ActivitiesModule,
    AuctionsModule,
    RandomizerModule,
    WarehouseModule,
    NewsModule,
    FeedModule,
    NotificationsModule,
    AuditModule,
    AdminModule,
    HealthModule,
    MessagesModule,
    SearchModule,
  ],
})
export class AppModule {}
