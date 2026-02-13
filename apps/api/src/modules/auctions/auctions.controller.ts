import { Controller, Get, Post, Patch, Body, Param, Query, Headers } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuctionsService } from './auctions.service';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';

@ApiTags('auctions')
@ApiBearerAuth()
@Controller('clans/:clanId/auctions')
export class AuctionsController {
  constructor(private readonly auctionsService: AuctionsService) {}

  @Get()
  @ApiOperation({ summary: 'List clan auctions' })
  async findAll(@Param('clanId') clanId: string, @Query() query: PaginationDto) {
    return this.auctionsService.findAll(clanId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get auction details with lots, bids, chat' })
  async findOne(@Param('id') id: string) {
    return this.auctionsService.findById(id);
  }

  @Post()
  @Roles('ELDER')
  @ApiOperation({ summary: 'Create a new auction' })
  async create(
    @Param('clanId') clanId: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: {
      title: string;
      description?: string;
      startAt?: string;
      endAt?: string;
      antiSniperEnabled?: boolean;
      antiSniperSeconds?: number;
      antiSniperExtendSec?: number;
    },
  ) {
    return this.auctionsService.create({
      clanId,
      title: body.title,
      description: body.description,
      startAt: body.startAt ? new Date(body.startAt) : undefined,
      endAt: body.endAt ? new Date(body.endAt) : undefined,
      antiSniperEnabled: body.antiSniperEnabled,
      antiSniperSeconds: body.antiSniperSeconds,
      antiSniperExtendSec: body.antiSniperExtendSec,
      createdBy: user.sub,
    });
  }

  @Post(':id/lots')
  @Roles('ELDER')
  @ApiOperation({ summary: 'Add lot to auction' })
  async addLot(
    @Param('id') id: string,
    @Body() body: { warehouseItemId: string; quantity: number; startPrice: number; minStep: number; sortOrder?: number },
  ) {
    return this.auctionsService.addLot(id, body);
  }

  @Post(':id/start')
  @Roles('ELDER')
  @ApiOperation({ summary: 'Start the auction' })
  async start(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.auctionsService.startAuction(id, user.sub);
  }

  @Post(':id/join')
  @ApiOperation({ summary: 'Join auction as participant' })
  async join(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.auctionsService.joinAuction(id, user.sub);
  }

  @Post('lots/:lotId/bid')
  @ApiOperation({ summary: 'Place a bid on a lot' })
  async placeBid(
    @Param('lotId') lotId: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: { amount: number; maxAutoBid?: number },
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ) {
    return this.auctionsService.placeBid(lotId, user.sub, body.amount, idempotencyKey, body.maxAutoBid);
  }

  @Post('lots/:lotId/finish')
  @Roles('ELDER')
  @ApiOperation({ summary: 'Finish a lot (determine winner, advance to next)' })
  async finishLot(@Param('lotId') lotId: string, @CurrentUser() user: JwtPayload) {
    return this.auctionsService.finishLot(lotId, user.sub);
  }

  @Get(':id/chat')
  @ApiOperation({ summary: 'Get auction chat messages' })
  async getChatMessages(@Param('id') id: string, @Query() query: PaginationDto) {
    return this.auctionsService.getChatMessages(id, query);
  }

  @Post(':id/chat')
  @ApiOperation({ summary: 'Send auction chat message' })
  async sendChatMessage(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body('message') message: string,
  ) {
    return this.auctionsService.sendChatMessage(id, user.sub, message);
  }
}
