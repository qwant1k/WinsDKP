import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DkpTransactionType, ItemRarity, LotStatus, WarehouseMovementType } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SpinDto } from './dto/spin.dto';

type FortuneRarity = Exclude<ItemRarity, 'MYTHIC'>;

type FortuneItem = {
  id: string;
  name: string;
  rarity: ItemRarity;
  imageUrl: string | null;
  description: string | null;
  quantity: number;
};

const VALID_BETS = [5, 10, 15, 20] as const;

const BASE_WEIGHTS: Record<FortuneRarity, number> = {
  COMMON: 100,
  UNCOMMON: 40,
  RARE: 15,
  EPIC: 4,
  LEGENDARY: 1,
};

const BET_MULTIPLIER: Record<(typeof VALID_BETS)[number], number> = {
  5: 1.0,
  10: 1.8,
  15: 3.0,
  20: 6.0,
};

const RARITY_ORDER: FortuneRarity[] = ['LEGENDARY', 'EPIC', 'RARE', 'UNCOMMON', 'COMMON'];

@Injectable()
export class FortuneService {
  constructor(private readonly prisma: PrismaService) {}

  async getFortuneItems(clanId: string) {
    return this.getEligibleFortuneItems(clanId);
  }

  private async getAuctionBlockedItemIds(clanId: string) {
    const blocked = await this.prisma.lot.findMany({
      where: {
        warehouseItemId: { not: null },
        deletedAt: null,
        status: { in: [LotStatus.PENDING, LotStatus.ACTIVE] },
        auction: {
          clanId,
          deletedAt: null,
        },
      },
      select: { warehouseItemId: true },
      distinct: ['warehouseItemId'],
    });

    return blocked.map((lot) => lot.warehouseItemId).filter((id): id is string => Boolean(id));
  }

  private async getEligibleFortuneItems(clanId: string) {
    const blockedItemIds = await this.getAuctionBlockedItemIds(clanId);

    return this.prisma.warehouseItem.findMany({
      where: {
        clanId,
        deletedAt: null,
        availableInFortune: true,
        quantity: { gt: 0 },
        rarity: { in: RARITY_ORDER },
        ...(blockedItemIds.length > 0 ? { id: { notIn: blockedItemIds } } : {}),
      },
      select: {
        id: true,
        name: true,
        rarity: true,
        imageUrl: true,
        description: true,
        quantity: true,
      },
      orderBy: [{ rarity: 'desc' }, { name: 'asc' }],
    });
  }

  async getSpinLogs(clanId: string, limit = 30) {
    const logs = await this.prisma.fortuneSpin.findMany({
      where: { clanId },
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            profile: {
              select: {
                nickname: true,
                displayName: true,
                avatarUrl: true,
              },
            },
          },
        },
        wonItem: {
          select: {
            id: true,
            name: true,
            rarity: true,
            imageUrl: true,
          },
        },
      },
    });

    return logs.map((log) => ({
      id: log.id,
      bet: log.bet,
      wonRarity: log.wonRarity,
      createdAt: log.createdAt,
      user: {
        id: log.user.id,
        username: log.user.profile?.displayName || log.user.profile?.nickname || log.user.email.split('@')[0] || 'Player',
        avatarUrl: log.user.profile?.avatarUrl || undefined,
      },
      wonItem: log.wonItem,
    }));
  }

  async getBalance(userId: string) {
    const wallet = await this.prisma.dkpWallet.findUnique({
      where: { userId },
      select: {
        balance: true,
        onHold: true,
      },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    const balance = Number(wallet.balance) - Number(wallet.onHold);
    return { balance: Math.max(0, balance) };
  }

  async spin(userId: string, clanId: string, dto: SpinDto) {
    const { bet } = dto;
    if (!VALID_BETS.includes(bet)) {
      throw new BadRequestException(`Bet must be one of: ${VALID_BETS.join(', ')}`);
    }

    const membership = await this.prisma.clanMembership.findUnique({
      where: { userId_clanId: { userId, clanId } },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            profile: { select: { nickname: true, displayName: true } },
          },
        },
      },
    });

    if (!membership || !membership.isActive) {
      throw new ForbiddenException('You are not an active clan member');
    }

    const wallet = await this.prisma.dkpWallet.findUnique({
      where: { userId },
      select: {
        balance: true,
        onHold: true,
      },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    const balanceBefore = Number(wallet.balance);
    const available = balanceBefore - Number(wallet.onHold);
    if (available < bet) {
      throw new BadRequestException(`Insufficient DKP. Available: ${available}, required: ${bet}`);
    }

    const items = await this.getEligibleFortuneItems(clanId);

    if (items.length === 0) {
      throw new BadRequestException('No Fortune Wheel items in warehouse');
    }

    const wonRarity = this.rollRarity(this.buildWeights(BET_MULTIPLIER[bet]));
    const wonItem = this.pickItem(items, wonRarity);

    const seed = randomBytes(16).toString('hex');
    const spinHash = createHash('sha256')
      .update(`${seed}:${userId}:${clanId}:${bet}:${wonRarity}:${wonItem?.id ?? 'none'}`)
      .digest('hex');

    const balanceAfter = balanceBefore - bet;

    const spin = await this.prisma.$transaction(async (tx) => {
      await tx.dkpWallet.update({
        where: { userId },
        data: { balance: { decrement: bet } },
      });

      await tx.dkpTransaction.create({
        data: {
          userId,
          type: DkpTransactionType.FORTUNE_SPIN,
          amount: -bet,
          balanceBefore,
          balanceAfter,
          description: `Fortune Wheel spin (${bet} DKP)`,
          referenceType: 'fortune_spin',
        },
      });

      if (wonItem) {
        const updatedItem = await tx.warehouseItem.update({
          where: { id: wonItem.id },
          data: { quantity: { decrement: 1 } },
        });

        await tx.warehouseItemMovement.create({
          data: {
            itemId: wonItem.id,
            type: WarehouseMovementType.FORTUNE_WIN,
            quantity: 1,
            reason: `Won in Fortune Wheel by ${membership.user.profile?.displayName || membership.user.profile?.nickname || membership.user.email}`,
            performedBy: userId,
            referenceType: 'fortune_spin',
          },
        });

        if (updatedItem.quantity <= 0) {
          await tx.warehouseItem.delete({ where: { id: wonItem.id } });
        }
      }

      return tx.fortuneSpin.create({
        data: {
          userId,
          clanId,
          bet,
          wonItemId: wonItem?.id ?? null,
          wonRarity,
          dkpSpent: bet,
          seed,
          spinHash,
        },
        include: {
          wonItem: {
            select: {
              id: true,
              name: true,
              rarity: true,
              imageUrl: true,
              description: true,
              quantity: true,
            },
          },
        },
      });
    });

    return {
      spin,
      wonItem: spin.wonItem,
      wonRarity,
      spinHash,
      seed,
      remainingBalance: balanceAfter,
    };
  }

  getChances() {
    const result: Record<number, Record<FortuneRarity, number>> = {};

    for (const bet of VALID_BETS) {
      const weights = this.buildWeights(BET_MULTIPLIER[bet]);
      const total = Object.values(weights).reduce((acc, value) => acc + value, 0);

      result[bet] = {
        COMMON: this.roundTo2((weights.COMMON / total) * 100),
        UNCOMMON: this.roundTo2((weights.UNCOMMON / total) * 100),
        RARE: this.roundTo2((weights.RARE / total) * 100),
        EPIC: this.roundTo2((weights.EPIC / total) * 100),
        LEGENDARY: this.roundTo2((weights.LEGENDARY / total) * 100),
      };
    }

    return result;
  }

  private buildWeights(multiplier: number): Record<FortuneRarity, number> {
    return {
      COMMON: BASE_WEIGHTS.COMMON,
      UNCOMMON: Math.round(BASE_WEIGHTS.UNCOMMON * multiplier),
      RARE: Math.round(BASE_WEIGHTS.RARE * multiplier),
      EPIC: Math.round(BASE_WEIGHTS.EPIC * multiplier),
      LEGENDARY: Math.round(BASE_WEIGHTS.LEGENDARY * multiplier),
    };
  }

  private rollRarity(weights: Record<FortuneRarity, number>): FortuneRarity {
    const total = Object.values(weights).reduce((acc, value) => acc + value, 0);
    let roll = Math.random() * total;

    for (const rarity of ['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY'] as FortuneRarity[]) {
      roll -= weights[rarity];
      if (roll <= 0) return rarity;
    }

    return 'COMMON';
  }

  private pickItem(items: FortuneItem[], targetRarity: FortuneRarity): FortuneItem | null {
    const startIndex = RARITY_ORDER.indexOf(targetRarity);

    for (let i = startIndex; i < RARITY_ORDER.length; i++) {
      const candidates = items.filter((item) => item.rarity === RARITY_ORDER[i]);
      if (candidates.length > 0) {
        return candidates[Math.floor(Math.random() * candidates.length)] || null;
      }
    }

    for (let i = startIndex - 1; i >= 0; i--) {
      const candidates = items.filter((item) => item.rarity === RARITY_ORDER[i]);
      if (candidates.length > 0) {
        return candidates[Math.floor(Math.random() * candidates.length)] || null;
      }
    }

    return items[Math.floor(Math.random() * items.length)] || null;
  }

  private roundTo2(value: number) {
    return Math.round(value * 100) / 100;
  }
}
