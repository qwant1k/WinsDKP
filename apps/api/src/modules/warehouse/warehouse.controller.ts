import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { WarehouseService } from './warehouse.service';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { ItemRarity } from '@prisma/client';

@ApiTags('warehouse')
@ApiBearerAuth()
@Controller('clans/:clanId/warehouse')
export class WarehouseController {
  constructor(private readonly warehouseService: WarehouseService) {}

  @Get()
  @ApiOperation({ summary: 'List warehouse items' })
  async findAll(@Param('clanId') clanId: string, @Query() query: PaginationDto) {
    return this.warehouseService.findAll(clanId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get warehouse item details' })
  async findOne(@Param('id') id: string) {
    return this.warehouseService.findById(id);
  }

  @Post()
  @Roles('ELDER')
  @ApiOperation({ summary: 'Add new item to warehouse' })
  async create(
    @Param('clanId') clanId: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: { name: string; description?: string; quantity: number; rarity: ItemRarity; imageUrl?: string; dkpPrice?: number; source?: string },
  ) {
    return this.warehouseService.create(clanId, body, user.sub);
  }

  @Patch(':id')
  @Roles('ELDER')
  @ApiOperation({ summary: 'Update warehouse item' })
  async update(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: { name?: string; description?: string; rarity?: ItemRarity; imageUrl?: string; dkpPrice?: number; source?: string },
  ) {
    return this.warehouseService.update(id, body, user.sub);
  }

  @Post(':id/stock')
  @Roles('ELDER')
  @ApiOperation({ summary: 'Add stock to item' })
  async addStock(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: { quantity: number; reason: string },
  ) {
    return this.warehouseService.addStock(id, body.quantity, body.reason, user.sub);
  }

  @Post(':id/write-off')
  @Roles('ELDER')
  @ApiOperation({ summary: 'Write off item stock' })
  async writeOff(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: { quantity: number; reason: string },
  ) {
    return this.warehouseService.writeOff(id, body.quantity, body.reason, user.sub);
  }

  @Post(':id/return')
  @Roles('ELDER')
  @ApiOperation({ summary: 'Return item to warehouse' })
  async returnItem(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: { quantity: number; reason: string },
  ) {
    return this.warehouseService.returnItem(id, body.quantity, body.reason, user.sub);
  }

  @Delete(':id')
  @Roles('ELDER')
  @ApiOperation({ summary: 'Delete warehouse item (soft)' })
  async remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.warehouseService.softDelete(id, user.sub);
  }

  @Get(':id/movements')
  @ApiOperation({ summary: 'Get item movement history' })
  async getMovements(@Param('id') id: string, @Query() query: PaginationDto) {
    return this.warehouseService.getMovements(id, query);
  }
}
