import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DkpService } from './dkp.service';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';

@ApiTags('dkp')
@ApiBearerAuth()
@Controller('dkp')
export class DkpController {
  constructor(private readonly dkpService: DkpService) {}

  @Get('wallet')
  @ApiOperation({ summary: 'Get current user DKP wallet' })
  async getMyWallet(@CurrentUser() user: JwtPayload) {
    return this.dkpService.getWallet(user.sub);
  }

  @Get('wallet/:userId')
  @ApiOperation({ summary: 'Get user DKP wallet' })
  async getWallet(@Param('userId') userId: string) {
    return this.dkpService.getWallet(userId);
  }

  @Get('transactions')
  @ApiOperation({ summary: 'Get current user DKP transactions' })
  async getMyTransactions(@CurrentUser() user: JwtPayload, @Query() query: PaginationDto) {
    return this.dkpService.getTransactions(user.sub, query);
  }

  @Get('transactions/:userId')
  @ApiOperation({ summary: 'Get user DKP transactions' })
  async getTransactions(@Param('userId') userId: string, @Query() query: PaginationDto) {
    return this.dkpService.getTransactions(userId, query);
  }

  @Post('penalty')
  @Roles('ELDER')
  @ApiOperation({ summary: 'Issue DKP penalty to a member' })
  async issuePenalty(
    @CurrentUser() user: JwtPayload,
    @Body() body: { userId: string; amount: number; reason: string; clanId: string },
  ) {
    return this.dkpService.issuePenalty({
      userId: body.userId,
      amount: body.amount,
      reason: body.reason,
      issuedBy: user.sub,
      clanId: body.clanId,
    });
  }

  @Post('admin/adjust')
  @Roles('PORTAL_ADMIN')
  @ApiOperation({ summary: 'Admin DKP adjustment' })
  async adminAdjust(
    @CurrentUser() user: JwtPayload,
    @Body() body: { userId: string; amount: number; description: string; idempotencyKey?: string },
  ) {
    return this.dkpService.adminAdjust({
      userId: body.userId,
      amount: body.amount,
      description: body.description,
      actorId: user.sub,
      idempotencyKey: body.idempotencyKey,
    });
  }
}
