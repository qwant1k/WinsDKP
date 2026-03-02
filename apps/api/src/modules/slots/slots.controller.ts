import {
  BadRequestException,
  Controller,
  DefaultValuePipe,
  ForbiddenException,
  Get,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { SlotsService } from './slots.service';

@ApiTags('slots')
@ApiBearerAuth()
@Controller('slots')
export class SlotsController {
  constructor(private readonly slotsService: SlotsService) {}

  @Get('info')
  @ApiOperation({ summary: 'Slot machine payout table' })
  getInfo() {
    return this.slotsService.getInfo();
  }

  @Get('logs')
  @ApiOperation({ summary: 'Recent slot spins in the clan' })
  async getLogs(
    @CurrentUser() user: JwtPayload,
    @Query('limit', new DefaultValuePipe(40), ParseIntPipe) limit: number,
  ) {
    const clanId = this.requireClanId(user);
    return this.slotsService.getLogs(clanId, Math.min(Math.max(limit, 1), 100));
  }

  @Get('balance')
  @ApiOperation({ summary: 'Current user available DKP balance' })
  async getBalance(@CurrentUser() user: JwtPayload) {
    return this.slotsService.getBalance(user.sub);
  }

  @Post('spin')
  @ApiOperation({ summary: 'Spin slot machine for 5 DKP' })
  async spin(@CurrentUser() user: JwtPayload) {
    const clanId = this.requireClanId(user);
    return this.slotsService.spin(user.sub, clanId);
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