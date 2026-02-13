import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { NewsService } from './news.service';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';

@ApiTags('news')
@ApiBearerAuth()
@Controller('clans/:clanId/news')
export class NewsController {
  constructor(private readonly newsService: NewsService) {}

  @Get()
  @ApiOperation({ summary: 'List news posts' })
  async findAll(@Param('clanId') clanId: string, @Query() query: PaginationDto) {
    return this.newsService.findAll(clanId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get news post with comments' })
  async findOne(@Param('id') id: string) {
    return this.newsService.findById(id);
  }

  @Post()
  @Roles('ELDER')
  @ApiOperation({ summary: 'Create news post' })
  async create(
    @Param('clanId') clanId: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: { title: string; content: string; isPinned?: boolean },
  ) {
    return this.newsService.create(clanId, user.sub, body);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update news post (author or admin)' })
  async update(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: { title?: string; content?: string; isPinned?: boolean },
  ) {
    return this.newsService.update(id, user.sub, body, user.globalRole);
  }

  @Delete(':id')
  @Roles('ELDER')
  @ApiOperation({ summary: 'Delete news post' })
  async remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.newsService.delete(id, user.sub);
  }

  @Post(':id/comments')
  @ApiOperation({ summary: 'Add comment to news post' })
  async addComment(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: { content: string; parentId?: string },
  ) {
    return this.newsService.addComment(id, user.sub, body.content, body.parentId);
  }

  @Patch('comments/:commentId/hide')
  @Roles('ELDER')
  @ApiOperation({ summary: 'Hide/moderate a comment' })
  async hideComment(@Param('commentId') commentId: string, @CurrentUser() user: JwtPayload) {
    return this.newsService.hideComment(commentId, user.sub);
  }

  @Post(':id/reactions')
  @ApiOperation({ summary: 'Toggle reaction on news post' })
  async react(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body('emoji') emoji: string,
  ) {
    return this.newsService.addReaction(id, user.sub, emoji);
  }
}
