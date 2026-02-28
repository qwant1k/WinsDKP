import { Controller, Get, Post, Delete, Body, Param, Query, Headers } from '@nestjs/common';
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

  // ─── Add single lot ──────────────────────────────────────────────────────────
  @Post(':id/lots')
  @Roles('ELDER')
  @ApiOperation({ summary: 'Add single lot to auction' })
  async addLot(
    @Param('id') id: string,
    @Body() body: { warehouseItemId: string; quantity: number; startPrice: number; minStep: number; sortOrder?: number; lotDurationMinutes?: number | null },
  ) {
    return this.auctionsService.addLot(id, body);
  }

  // ─── Bulk add all warehouse items as lots ────────────────────────────────────
  @Post(':id/lots/bulk')
  @Roles('ELDER')
  @ApiOperation({ summary: 'Add all warehouse items as lots with default price/step' })
  async addAllLots(
    @Param('id') id: string,
    @Param('clanId') clanId: string,
    @Body() body: { defaultStartPrice: number; defaultMinStep: number; defaultLotDurationMinutes?: number | null },
  ) {
    return this.auctionsService.addAllWarehouseItems(id, clanId, body);
  }

  // ─── Delete lot (only PENDING, before auction starts) ───────────────────────
  @Delete('lots/:lotId')
  @Roles('ELDER')
  @ApiOperation({ summary: 'Delete a pending lot before auction starts' })
  async deleteLot(
    @Param('lotId') lotId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.auctionsService.deleteLot(lotId, user.sub);
  }

  @Post(':id/start')
  @Roles('ELDER')
  @ApiOperation({ summary: 'Start the auction — all lots go ACTIVE simultaneously' })
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
  @ApiOperation({ summary: 'Finish a lot and determine winner' })
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

  @Delete(':id')
  @Roles('ELDER')
  @ApiOperation({ summary: 'Delete completed auction (soft delete from UI)' })
  async deleteCompletedAuction(
    @Param('id') id: string,
    @Param('clanId') clanId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.auctionsService.deleteCompletedAuction(id, clanId, user.sub);
  }
}
