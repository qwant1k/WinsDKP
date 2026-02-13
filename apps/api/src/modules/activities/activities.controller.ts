import { Controller, Get, Post, Patch, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ActivitiesService } from './activities.service';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { ActivityStatus, ActivityType } from '@prisma/client';

@ApiTags('activities')
@ApiBearerAuth()
@Controller('clans/:clanId/activities')
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Get()
  @ApiOperation({ summary: 'List clan activities' })
  async findAll(@Param('clanId') clanId: string, @Query() query: PaginationDto) {
    return this.activitiesService.findAll(clanId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get activity details' })
  async findOne(@Param('id') id: string) {
    return this.activitiesService.findById(id);
  }

  @Post()
  @Roles('ELDER')
  @ApiOperation({ summary: 'Create a new activity' })
  async create(
    @Param('clanId') clanId: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: { type: ActivityType; title: string; description?: string; baseDkp: number; startAt?: string; endAt?: string },
  ) {
    return this.activitiesService.create({
      clanId,
      type: body.type,
      title: body.title,
      description: body.description,
      baseDkp: body.baseDkp,
      startAt: body.startAt ? new Date(body.startAt) : undefined,
      endAt: body.endAt ? new Date(body.endAt) : undefined,
      createdBy: user.sub,
    });
  }

  @Patch(':id/status')
  @Roles('ELDER')
  @ApiOperation({ summary: 'Update activity status' })
  async updateStatus(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body('status') status: ActivityStatus,
  ) {
    return this.activitiesService.updateStatus(id, status, user.sub);
  }

  @Post(':id/join')
  @ApiOperation({ summary: 'Join an activity' })
  async join(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.activitiesService.joinActivity(id, user.sub);
  }

  @Post(':id/leave')
  @ApiOperation({ summary: 'Leave an activity' })
  async leave(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.activitiesService.leaveActivity(id, user.sub);
  }

  @Post(':id/complete')
  @Roles('ELDER')
  @ApiOperation({ summary: 'Complete activity and distribute DKP rewards' })
  async complete(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.activitiesService.completeAndReward(id, user.sub);
  }
}
