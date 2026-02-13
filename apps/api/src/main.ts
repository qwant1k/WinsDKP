import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { IoAdapter } from '@nestjs/platform-socket.io';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: {
        level: process.env['LOG_LEVEL'] || 'info',
        transport:
          process.env['NODE_ENV'] !== 'production'
            ? { target: 'pino-pretty', options: { colorize: true } }
            : undefined,
      },
      trustProxy: true,
    }),
  );

  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.enableCors({
    origin: process.env['NODE_ENV'] === 'production'
      ? (process.env['CORS_ORIGINS'] || process.env['WEB_URL'] || 'http://localhost:5173').split(',').map((s) => s.trim())
      : true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Idempotency-Key', 'X-Request-ID'],
  });

  app.useWebSocketAdapter(new IoAdapter(app));

  const config = new DocumentBuilder()
    .setTitle('Ymir Clan Hub API')
    .setDescription('API documentation for the Ymir Clan Hub MMORPG clan management system')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth', 'Authentication & Authorization')
    .addTag('users', 'User Management')
    .addTag('clans', 'Clan Management')
    .addTag('dkp', 'DKP Economy')
    .addTag('activities', 'Clan Activities')
    .addTag('auctions', 'Live Auctions')
    .addTag('randomizer', 'Loot Randomizer')
    .addTag('warehouse', 'Clan Warehouse')
    .addTag('news', 'News Posts')
    .addTag('feed', 'Feed Posts')
    .addTag('notifications', 'Notifications')
    .addTag('audit', 'Audit Logs')
    .addTag('admin', 'Admin Panel')
    .addTag('health', 'Health Checks')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = parseInt(process.env['APP_PORT'] || '3000', 10);
  await app.listen(port, '0.0.0.0');
  logger.log(`🚀 Ymir Clan Hub API running on http://0.0.0.0:${port}`);
  logger.log(`📚 Swagger docs at http://0.0.0.0:${port}/api/docs`);
}

bootstrap();
