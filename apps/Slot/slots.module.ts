// ── slots.controller.ts ───────────────────────────────────────
import { Controller, Get, Post, Query, UseGuards, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentClan } from '../../common/decorators/current-clan.decorator';
import { SlotsService } from './slots.service';

@ApiTags('Arcane Slots')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('slots')
export class SlotsController {
  constructor(private readonly slotsService: SlotsService) {}

  @Get('info')
  @ApiOperation({ summary: 'Таблица выплат и правила' })
  getInfo() { return this.slotsService.getInfo(); }

  @Get('logs')
  @ApiOperation({ summary: 'История спинов' })
  getLogs(
    @CurrentClan() clanId: string,
    @Query('limit', new DefaultValuePipe(40), ParseIntPipe) limit: number,
  ) { return this.slotsService.getLogs(clanId, limit); }

  @Get('balance')
  @ApiOperation({ summary: 'DKP баланс' })
  getBalance(@CurrentUser() userId: string, @CurrentClan() clanId: string) {
    return this.slotsService.getBalance(userId, clanId);
  }

  @Post('spin')
  @ApiOperation({ summary: 'Сделать ставку (5 DKP)' })
  spin(@CurrentUser() userId: string, @CurrentClan() clanId: string) {
    return this.slotsService.spin(userId, clanId);
  }
}

// ── slots.module.ts ───────────────────────────────────────────
import { Module } from '@nestjs/common';
// import { SlotsController } from './slots.controller'; // split into separate files
// import { SlotsService }    from './slots.service';

@Module({
  controllers: [SlotsController],
  providers:   [SlotsService],
  exports:     [SlotsService],
})
export class SlotsModule {}
