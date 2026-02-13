import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PaginationDto, PaginatedResponse } from '../../common/dto/pagination.dto';
import { ItemRarity, WarehouseMovementType } from '@prisma/client';

@Injectable()
export class WarehouseService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(clanId: string, query: PaginationDto) {
    const where = {
      clanId,
      deletedAt: null,
      ...(query.search ? { name: { contains: query.search, mode: 'insensitive' as const } } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.warehouseItem.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: query.sortBy
          ? { [query.sortBy]: query.sortOrder || 'desc' }
          : { createdAt: 'desc' },
      }),
      this.prisma.warehouseItem.count({ where }),
    ]);
    return new PaginatedResponse(items, total, query.page, query.limit);
  }

  async findById(id: string) {
    const item = await this.prisma.warehouseItem.findUnique({
      where: { id },
      include: {
        movements: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    });
    if (!item) throw new NotFoundException('Item not found');
    return item;
  }

  async create(clanId: string, data: {
    name: string;
    description?: string;
    quantity: number;
    rarity: ItemRarity;
    imageUrl?: string;
    dkpPrice?: number;
    source?: string;
  }, actorId: string) {
    const item = await this.prisma.warehouseItem.create({
      data: { clanId, ...data },
    });

    if (data.quantity > 0) {
      await this.prisma.warehouseItemMovement.create({
        data: {
          itemId: item.id,
          type: WarehouseMovementType.INCOMING,
          quantity: data.quantity,
          reason: 'Initial stock',
          performedBy: actorId,
        },
      });
    }

    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'warehouse.item.created',
        entityType: 'warehouse_item',
        entityId: item.id,
        after: item,
      },
    });

    return item;
  }

  async update(id: string, data: {
    name?: string;
    description?: string;
    quantity?: number;
    rarity?: ItemRarity;
    imageUrl?: string;
    dkpPrice?: number;
    source?: string;
  }, actorId: string) {
    const before = await this.prisma.warehouseItem.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Item not found');

    const updated = await this.prisma.warehouseItem.update({
      where: { id },
      data,
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'warehouse.item.updated',
        entityType: 'warehouse_item',
        entityId: id,
        before,
        after: updated,
      },
    });

    return updated;
  }

  async addStock(id: string, quantity: number, reason: string, actorId: string) {
    if (quantity <= 0) throw new BadRequestException('Quantity must be positive');

    const item = await this.prisma.warehouseItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Item not found');

    await this.prisma.$transaction([
      this.prisma.warehouseItem.update({
        where: { id },
        data: { quantity: { increment: quantity } },
      }),
      this.prisma.warehouseItemMovement.create({
        data: {
          itemId: id,
          type: WarehouseMovementType.INCOMING,
          quantity,
          reason,
          performedBy: actorId,
        },
      }),
    ]);

    return this.findById(id);
  }

  async writeOff(id: string, quantity: number, reason: string, actorId: string) {
    if (quantity <= 0) throw new BadRequestException('Quantity must be positive');

    const item = await this.prisma.warehouseItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Item not found');
    if (item.quantity < quantity) throw new BadRequestException('Insufficient quantity');

    await this.prisma.$transaction([
      this.prisma.warehouseItem.update({
        where: { id },
        data: { quantity: { decrement: quantity } },
      }),
      this.prisma.warehouseItemMovement.create({
        data: {
          itemId: id,
          type: WarehouseMovementType.WRITE_OFF,
          quantity,
          reason,
          performedBy: actorId,
        },
      }),
    ]);

    return this.findById(id);
  }

  async returnItem(id: string, quantity: number, reason: string, actorId: string) {
    if (quantity <= 0) throw new BadRequestException('Quantity must be positive');

    await this.prisma.$transaction([
      this.prisma.warehouseItem.update({
        where: { id },
        data: { quantity: { increment: quantity } },
      }),
      this.prisma.warehouseItemMovement.create({
        data: {
          itemId: id,
          type: WarehouseMovementType.RETURN,
          quantity,
          reason,
          performedBy: actorId,
        },
      }),
    ]);

    return this.findById(id);
  }

  async softDelete(id: string, actorId: string) {
    const item = await this.prisma.warehouseItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Item not found');

    await this.prisma.warehouseItem.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'warehouse.item.deleted',
        entityType: 'warehouse_item',
        entityId: id,
        before: item,
      },
    });

    return { message: 'Item deleted' };
  }

  async getMovements(itemId: string, query: PaginationDto) {
    const where = { itemId };
    const [movements, total] = await Promise.all([
      this.prisma.warehouseItemMovement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.warehouseItemMovement.count({ where }),
    ]);
    return new PaginatedResponse(movements, total, query.page, query.limit);
  }
}
