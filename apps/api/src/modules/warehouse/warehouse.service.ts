import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PaginationDto, PaginatedResponse } from '../../common/dto/pagination.dto';
import { ItemRarity, LotStatus, WarehouseMovementType } from '@prisma/client';

@Injectable()
export class WarehouseService {
  constructor(private readonly prisma: PrismaService) {}

  async importFromExcel(
    clanId: string,
    rows: Array<{ name?: string; quantity?: number | string; source?: string }>,
    actorId: string,
  ) {
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new BadRequestException('Import rows are required');
    }

    const normalizedRows: Array<{ name: string; source?: string; quantity: number; rarity: ItemRarity }> = [];

    for (const row of rows) {
      const name = (row.name || '').trim();
      if (!name) continue;

      const quantity = this.parsePositiveQuantity(row.quantity);
      if (!quantity) continue;

      const source = (row.source || '').trim() || undefined;
      normalizedRows.push({
        name,
        source,
        quantity,
        rarity: this.detectRarityFromName(name),
      });
    }

    if (normalizedRows.length === 0) {
      throw new BadRequestException('No valid rows to import');
    }

    let created = 0;
    let updated = 0;

    await this.prisma.$transaction(async (tx) => {
      for (const item of normalizedRows) {
        const createdItem = await tx.warehouseItem.create({
          data: {
            clanId,
            name: item.name,
            quantity: item.quantity,
            rarity: item.rarity,
            source: item.source,
          },
        });

        await tx.warehouseItemMovement.create({
          data: {
            itemId: createdItem.id,
            type: WarehouseMovementType.INCOMING,
            quantity: item.quantity,
            reason: 'Excel import',
            performedBy: actorId,
          },
        });

        created += 1;
      }
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'warehouse.import.excel',
        entityType: 'warehouse',
        metadata: {
          clanId,
          sourceRows: rows.length,
          processedRows: normalizedRows.length,
          created,
          updated,
        },
      },
    });

    return {
      sourceRows: rows.length,
      processedRows: normalizedRows.length,
      created,
      updated,
    };
  }

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
    availableInFortune?: boolean;
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
    availableInFortune?: boolean;
  }, actorId: string) {
    if (data.quantity !== undefined && data.quantity <= 0) {
      const deleted = await this.softDelete(id, actorId);
      return { ...deleted, deleted: true, id };
    }

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

  async toggleFortune(id: string, enabled: boolean, actorId: string) {
    const before = await this.prisma.warehouseItem.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Item not found');

    const updated = await this.prisma.warehouseItem.update({
      where: { id },
      data: { availableInFortune: enabled },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'warehouse.item.fortune_toggled',
        entityType: 'warehouse_item',
        entityId: id,
        before: { availableInFortune: before.availableInFortune },
        after: { availableInFortune: updated.availableInFortune },
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

    let deleted = false;
    await this.prisma.$transaction(async (tx) => {
      const updatedItem = await tx.warehouseItem.update({
        where: { id },
        data: { quantity: { decrement: quantity } },
      });

      await tx.warehouseItemMovement.create({
        data: {
          itemId: id,
          type: WarehouseMovementType.WRITE_OFF,
          quantity,
          reason,
          performedBy: actorId,
        },
      });

      if (updatedItem.quantity <= 0) {
        await tx.warehouseItem.delete({ where: { id } });
        deleted = true;
      }
    });

    if (deleted) {
      return { message: 'Item deleted', deleted: true, id };
    }

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

    const linkedActiveOrPendingLot = await this.prisma.lot.findFirst({
      where: {
        warehouseItemId: id,
        status: { in: [LotStatus.PENDING, LotStatus.ACTIVE] },
        deletedAt: null,
      },
      select: { id: true },
    });
    if (linkedActiveOrPendingLot) {
      throw new BadRequestException('Cannot delete item: it is used in active or pending auction lots');
    }

    await this.prisma.warehouseItem.delete({ where: { id } });

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

  async softDeleteAll(clanId: string, actorId: string) {
    const items = await this.prisma.warehouseItem.findMany({
      where: { clanId },
      select: { id: true },
    });

    if (items.length === 0) {
      return { message: 'Warehouse already empty', deleted: 0 };
    }

    const ids = items.map((i) => i.id);
    const linkedActiveOrPendingLots = await this.prisma.lot.findMany({
      where: {
        warehouseItemId: { in: ids },
        status: { in: [LotStatus.PENDING, LotStatus.ACTIVE] },
        deletedAt: null,
      },
      select: { warehouseItemId: true },
      distinct: ['warehouseItemId'],
    });
    const blockedIds = new Set(linkedActiveOrPendingLots.map((l) => l.warehouseItemId).filter((id): id is string => !!id));
    const deletableIds = ids.filter((id) => !blockedIds.has(id));

    if (deletableIds.length > 0) {
      await this.prisma.warehouseItem.deleteMany({
        where: { id: { in: deletableIds } },
      });
    }

    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'warehouse.items.deleted_all',
        entityType: 'warehouse',
        metadata: {
          clanId,
          deletedCount: deletableIds.length,
          skippedCount: blockedIds.size,
        },
      },
    });

    return {
      message: blockedIds.size > 0
        ? 'Warehouse cleared partially: some items are used in auction lots and were skipped'
        : 'Warehouse cleared',
      deleted: deletableIds.length,
      skipped: blockedIds.size,
    };
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

  private parsePositiveQuantity(quantity: number | string | undefined) {
    if (typeof quantity === 'number') {
      if (!Number.isFinite(quantity) || quantity <= 0) return 0;
      return Math.floor(quantity);
    }

    const normalized = String(quantity || '')
      .replace(',', '.')
      .replace(/[^\d.]/g, '');
    if (!normalized) return 0;

    const parsed = Number(normalized);
    if (!Number.isFinite(parsed) || parsed <= 0) return 0;
    return Math.floor(parsed);
  }

  private detectRarityFromName(name: string): ItemRarity {
    const normalized = name.toLowerCase();

    if (normalized.includes('высш')) return ItemRarity.LEGENDARY;
    if (normalized.includes('редк')) return ItemRarity.EPIC;
    if (normalized.includes('необ')) return ItemRarity.RARE;
    if (normalized.includes('ср.')) return ItemRarity.UNCOMMON;
    if (normalized.includes('ср ')) return ItemRarity.UNCOMMON;
    if (normalized.includes('сред')) return ItemRarity.UNCOMMON;
    if (normalized.includes('низк')) return ItemRarity.COMMON;

    return ItemRarity.COMMON;
  }
}
