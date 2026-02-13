import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FeedService } from './feed.service';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';

@ApiTags('feed')
@ApiBearerAuth()
@Controller('clans/:clanId/feed')
export class FeedController {
  constructor(private readonly feedService: FeedService) {}

  @Get()
  @ApiOperation({ summary: 'List feed posts' })
  async findAll(@Param('clanId') clanId: string, @Query() query: PaginationDto) {
    return this.feedService.findAll(clanId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get feed post with comments' })
  async findOne(@Param('id') id: string) {
    return this.feedService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create feed post' })
  async create(
    @Param('clanId') clanId: string,
    @CurrentUser() user: JwtPayload,
    @Body('content') content: string,
  ) {
    return this.feedService.create(clanId, user.sub, content);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update feed post' })
  async update(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body('content') content: string,
  ) {
    return this.feedService.update(id, user.sub, content);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete feed post' })
  async remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.feedService.delete(id, user.sub);
  }

  @Post(':id/report')
  @ApiOperation({ summary: 'Report a feed post' })
  async report(@Param('id') id: string) {
    return this.feedService.report(id);
  }

  @Post(':id/comments')
  @ApiOperation({ summary: 'Add comment to feed post' })
  async addComment(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: { content: string; parentId?: string },
  ) {
    return this.feedService.addComment(id, user.sub, body.content, body.parentId);
  }

  @Patch('comments/:commentId/hide')
  @Roles('ELDER')
  @ApiOperation({ summary: 'Hide/moderate a comment' })
  async hideComment(@Param('commentId') commentId: string) {
    return this.feedService.hideComment(commentId);
  }

  @Post(':id/reactions')
  @ApiOperation({ summary: 'Toggle reaction on feed post' })
  async react(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body('emoji') emoji: string,
  ) {
    return this.feedService.addReaction(id, user.sub, emoji);
  }
}
