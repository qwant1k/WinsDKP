import { Controller, Get, Post, Body, Param, Headers } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RandomizerService } from './randomizer.service';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('randomizer')
@ApiBearerAuth()
@Controller('clans/:clanId/randomizer')
export class RandomizerController {
  constructor(private readonly randomizerService: RandomizerService) {}

  @Get()
  @ApiOperation({ summary: 'List randomizer sessions' })
  async findAll(@Param('clanId') clanId: string) {
    return this.randomizerService.findAll(clanId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get randomizer session details' })
  async findOne(@Param('id') id: string) {
    return this.randomizerService.findById(id);
  }

  @Post()
  @Roles('ELDER')
  @ApiOperation({ summary: 'Create a randomizer session' })
  async create(
    @Param('clanId') clanId: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: { warehouseItemId: string; quantity?: number },
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ) {
    return this.randomizerService.createSession({
      clanId,
      warehouseItemId: body.warehouseItemId,
      quantity: body.quantity,
      createdBy: user.sub,
      idempotencyKey,
    });
  }

  @Post(':id/draw')
  @Roles('ELDER')
  @ApiOperation({ summary: 'Run the randomizer draw' })
  async draw(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.randomizerService.runDraw(id, user.sub);
  }
}
