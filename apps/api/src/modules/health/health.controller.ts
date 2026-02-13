import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get('live')
  @Public()
  @ApiOperation({ summary: 'Liveness probe' })
  async live() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('ready')
  @Public()
  @ApiOperation({ summary: 'Readiness probe' })
  async ready() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      await this.redis.client.ping();
      return { status: 'ok', timestamp: new Date().toISOString() };
    } catch (error) {
      return { status: 'error', timestamp: new Date().toISOString(), error: String(error) };
    }
  }

  @Get('deps')
  @Public()
  @ApiOperation({ summary: 'Dependency health check' })
  async deps() {
    const checks: Record<string, { status: string; latency?: number }> = {};

    const pgStart = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks['postgres'] = { status: 'ok', latency: Date.now() - pgStart };
    } catch {
      checks['postgres'] = { status: 'error', latency: Date.now() - pgStart };
    }

    const redisStart = Date.now();
    try {
      await this.redis.client.ping();
      checks['redis'] = { status: 'ok', latency: Date.now() - redisStart };
    } catch {
      checks['redis'] = { status: 'error', latency: Date.now() - redisStart };
    }

    const allOk = Object.values(checks).every((c) => c.status === 'ok');

    return {
      status: allOk ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      checks,
    };
  }
}
