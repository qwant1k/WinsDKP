import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentClan } from '../../common/decorators/current-clan.decorator';
import { FortuneService } from './fortune.service';
import { SpinDto } from './dto/spin.dto';

@ApiTags('Fortune Wheel')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('fortune')
export class FortuneController {
  constructor(private readonly fortuneService: FortuneService) {}

  @Get('items')
  @ApiOperation({ summary: 'Список предметов доступных в Колесе Фортуны' })
  getFortuneItems(@CurrentClan() clanId: string) {
    return this.fortuneService.getFortuneItems(clanId);
  }

  @Get('logs')
  @ApiOperation({ summary: 'Лог выигрышей Колеса Фортуны' })
  getLogs(
    @CurrentClan() clanId: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    return this.fortuneService.getSpinLogs(clanId, Math.min(limit, 100));
  }

  @Get('chances')
  @ApiOperation({ summary: 'Шансы выпадения по уровням ставок' })
  getChances() {
    return this.fortuneService.getChances();
  }

  @Get('balance')
  @ApiOperation({ summary: 'Текущий DKP баланс игрока' })
  getBalance(
    @CurrentUser() userId: string,
    @CurrentClan() clanId: string,
  ) {
    return this.fortuneService.getBalance(userId, clanId);
  }

  @Post('spin')
  @ApiOperation({ summary: 'Крутить Колесо Фортуны' })
  spin(
    @CurrentUser() userId: string,
    @CurrentClan() clanId: string,
    @Body() dto: SpinDto,
  ) {
    return this.fortuneService.spin(userId, clanId, dto);
  }
}
