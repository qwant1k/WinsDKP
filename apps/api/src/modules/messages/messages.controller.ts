import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MessagesService } from './messages.service';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';

@ApiTags('messages')
@ApiBearerAuth()
@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get()
  @ApiOperation({ summary: 'Get conversations list' })
  async getConversations(@CurrentUser() user: JwtPayload) {
    return this.messagesService.getConversations(user.sub);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread message count' })
  async getUnreadCount(@CurrentUser() user: JwtPayload) {
    return this.messagesService.getUnreadCount(user.sub);
  }

  @Get(':userId')
  @ApiOperation({ summary: 'Get message thread with user' })
  async getThread(
    @CurrentUser() user: JwtPayload,
    @Param('userId') otherUserId: string,
    @Query() query: PaginationDto,
  ) {
    return this.messagesService.getThread(user.sub, otherUserId, query);
  }

  @Post(':userId')
  @ApiOperation({ summary: 'Send message to user' })
  async sendMessage(
    @CurrentUser() user: JwtPayload,
    @Param('userId') receiverId: string,
    @Body('content') content: string,
  ) {
    return this.messagesService.sendMessage(user.sub, receiverId, content);
  }
}
