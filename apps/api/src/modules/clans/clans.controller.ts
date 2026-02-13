import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ClansService } from './clans.service';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { ClanRole } from '@prisma/client';

@ApiTags('clans')
@ApiBearerAuth()
@Controller('clans')
export class ClansController {
  constructor(private readonly clansService: ClansService) {}

  @Get()
  @ApiOperation({ summary: 'List all clans' })
  async findAll(@Query() query: PaginationDto) {
    return this.clansService.findAll(query);
  }

  @Get(':clanId')
  @ApiOperation({ summary: 'Get clan details' })
  async findOne(@Param('clanId') clanId: string) {
    return this.clansService.findById(clanId);
  }

  @Get(':clanId/members')
  @ApiOperation({ summary: 'Get clan members' })
  async getMembers(@Param('clanId') clanId: string, @Query() query: PaginationDto) {
    return this.clansService.getMembers(clanId, query);
  }

  @Post(':clanId/join')
  @ApiOperation({ summary: 'Request to join clan' })
  async requestJoin(
    @Param('clanId') clanId: string,
    @CurrentUser() user: JwtPayload,
    @Body('message') message?: string,
  ) {
    return this.clansService.requestJoin(clanId, user.sub, message);
  }

  @Get(':clanId/join-requests')
  @Roles('ELDER')
  @ApiOperation({ summary: 'Get pending join requests' })
  async getJoinRequests(@Param('clanId') clanId: string, @Query() query: PaginationDto) {
    return this.clansService.getJoinRequests(clanId, query);
  }

  @Patch(':clanId/join-requests/:requestId/review')
  @Roles('ELDER')
  @ApiOperation({ summary: 'Approve or reject join request' })
  async reviewJoinRequest(
    @Param('clanId') clanId: string,
    @Param('requestId') requestId: string,
    @CurrentUser() user: JwtPayload,
    @Body('approved') approved: boolean,
  ) {
    return this.clansService.reviewJoinRequest(requestId, user.sub, approved);
  }

  @Get(':clanId/report')
  @Roles('ELDER')
  @ApiOperation({ summary: 'Get clan members report with stats' })
  async getClanReport(
    @Param('clanId') clanId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.clansService.getClanReport(clanId, from, to);
  }

  @Patch(':clanId/members/:userId/role')
  @Roles('CLAN_LEADER')
  @ApiOperation({ summary: 'Change member role' })
  async changeMemberRole(
    @Param('clanId') clanId: string,
    @Param('userId') userId: string,
    @CurrentUser() user: JwtPayload,
    @Body('role') role: ClanRole,
  ) {
    return this.clansService.changeMemberRole(clanId, userId, role, user.sub);
  }

  @Delete(':clanId/members/:userId')
  @Roles('ELDER')
  @ApiOperation({ summary: 'Kick member from clan' })
  async kickMember(
    @Param('clanId') clanId: string,
    @Param('userId') userId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.clansService.kickMember(clanId, userId, user.sub);
  }
}
