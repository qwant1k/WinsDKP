import {
  BadRequestException,
  Controller,
  DefaultValuePipe,
  ForbiddenException,
  Get,
  ParseIntPipe,
  Post,
  Query,
  Body,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FortuneService } from './fortune.service';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { SpinDto } from './dto/spin.dto';

@ApiTags('fortune')
@ApiBearerAuth()
@Controller('fortune')
export class FortuneController {
  constructor(private readonly fortuneService: FortuneService) {}

  @Get('items')
  @ApiOperation({ summary: 'List items available in Fortune Wheel' })
  async getFortuneItems(@CurrentUser() user: JwtPayload) {
    const clanId = this.requireClanId(user);
    return this.fortuneService.getFortuneItems(clanId);
  }

  @Get('logs')
  @ApiOperation({ summary: 'Recent Fortune Wheel spins' })
  async getLogs(
    @CurrentUser() user: JwtPayload,
    @Query('limit', new DefaultValuePipe(30), ParseIntPipe) limit: number,
  ) {
    const clanId = this.requireClanId(user);
    return this.fortuneService.getSpinLogs(clanId, Math.min(Math.max(limit, 1), 100));
  }

  @Get('chances')
  @ApiOperation({ summary: 'Rarity chances per bet tier' })
  getChances() {
    return this.fortuneService.getChances();
  }

  @Get('balance')
  @ApiOperation({ summary: 'Current user available DKP balance' })
  async getBalance(@CurrentUser() user: JwtPayload) {
    return this.fortuneService.getBalance(user.sub);
  }

  @Post('spin')
  @ApiOperation({ summary: 'Spin Fortune Wheel' })
  async spin(
    @CurrentUser() user: JwtPayload,
    @Body() dto: SpinDto,
  ) {
    const clanId = this.requireClanId(user);
    return this.fortuneService.spin(user.sub, clanId, dto);
  }

  private requireClanId(user: JwtPayload): string {
    if (!user.clanId) {
      throw new ForbiddenException('You are not in a clan');
    }
    if (typeof user.clanId !== 'string' || user.clanId.trim().length === 0) {
      throw new BadRequestException('Invalid clan context');
    }
    return user.clanId;
  }
}
