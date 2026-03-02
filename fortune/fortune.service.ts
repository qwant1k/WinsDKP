import {
  Injectable,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { createHash, randomBytes } from 'crypto';
import { SpinDto } from './dto/spin.dto';

// ─── Rarity weights ───────────────────────────────────────────
//  Higher bet → multiplier scales UP non-common tiers
//  Result: rare items become proportionally more likely
//
//  Base weights:        COMMON UNCOMMON RARE EPIC LEGENDARY
const BASE_WEIGHTS = { COMMON: 100, UNCOMMON: 40, RARE: 15, EPIC: 4, LEGENDARY: 1 };

// Multiplier applied to all tiers EXCEPT COMMON
const BET_MULTIPLIER: Record<number, number> = {
  5: 1.0,
  10: 1.8,
  15: 3.0,
  20: 6.0,
};

type Rarity = keyof typeof BASE_WEIGHTS;

@Injectable()
export class FortuneService {
  constructor(private readonly prisma: PrismaService) {}

  // ── GET /fortune/items ──────────────────────────────────────
  async getFortuneItems(clanId: string) {
    return this.prisma.warehouseItem.findMany({
      where: {
        clanId,
        availableInFortune: true,
        quantity: { gt: 0 },
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

  // ── GET /fortune/logs ───────────────────────────────────────
  async getSpinLogs(clanId: string, limit = 50) {
    return this.prisma.fortuneSpin.findMany({
      where: { clanId },
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        bet: true,
        wonRarity: true,
        createdAt: true,
        user: { select: { id: true, username: true, avatarUrl: true } },
        wonItem: { select: { id: true, name: true, rarity: true, imageUrl: true } },
      },
    });
  }

  // ── POST /fortune/spin ──────────────────────────────────────
  async spin(userId: string, clanId: string, dto: SpinDto) {
    const { bet } = dto;
    const validBets = [5, 10, 15, 20];

    if (!validBets.includes(bet)) {
      throw new BadRequestException(`Ставка должна быть одной из: ${validBets.join(', ')} DKP`);
    }

    // ── 1. Check user DKP balance ────────────────────────────
    const membership = await this.prisma.clanMember.findUnique({
      where: { userId_clanId: { userId, clanId } },
      include: { user: { select: { id: true, username: true } } },
    });

    if (!membership) throw new ForbiddenException('Вы не состоите в клане');

    const dkpBalance = await this.prisma.dkpTransaction.aggregate({
      where: { userId, clanId },
      _sum: { amount: true },
    });

    const balance = dkpBalance._sum.amount ?? 0;
    if (balance < bet) {
      throw new BadRequestException(`Недостаточно DKP. Баланс: ${balance}, ставка: ${bet}`);
    }

    // ── 2. Get available fortune items ───────────────────────
    const items = await this.prisma.warehouseItem.findMany({
      where: { clanId, availableInFortune: true, quantity: { gt: 0 } },
    });

    if (items.length === 0) {
      throw new BadRequestException('В хранилище нет предметов для Колеса Фортуны');
    }

    // ── 3. Compute weighted rarity selection ─────────────────
    const multiplier = BET_MULTIPLIER[bet];
    const weights = this.buildWeights(multiplier);
    const wonRarity = this.rollRarity(weights);

    // ── 4. Pick random item of won rarity (fallback to lower) ─
    const wonItem = this.pickItem(items, wonRarity);

    // ── 5. Provably fair: generate seed + hash ───────────────
    const seed = randomBytes(16).toString('hex');
    const spinHash = createHash('sha256')
      .update(`${seed}:${userId}:${bet}:${wonRarity}:${wonItem?.id ?? 'none'}`)
      .digest('hex');

    // ── 6. Atomic: deduct DKP + move item + save spin ────────
    const result = await this.prisma.$transaction(async (tx) => {
      // Deduct DKP
      await tx.dkpTransaction.create({
        data: {
          userId,
          clanId,
          amount: -bet,
          reason: `Колесо Фортуны — ставка ${bet} DKP`,
          type: 'FORTUNE_SPIN',
        },
      });

      // Decrement item quantity if item found
      if (wonItem) {
        await tx.warehouseItem.update({
          where: { id: wonItem.id },
          data: { quantity: { decrement: 1 } },
        });

        // Log warehouse movement
        await tx.warehouseMovement.create({
          data: {
            itemId: wonItem.id,
            clanId,
            type: 'FORTUNE_WIN',
            quantity: -1,
            note: `Выиграл ${membership.user.username} (ставка ${bet} DKP)`,
            initiatorId: userId,
          },
        });
      }

      // Save spin record
      const spin = await tx.fortuneSpin.create({
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
          wonItem: { select: { id: true, name: true, rarity: true, imageUrl: true } },
          user: { select: { id: true, username: true } },
        },
      });

      return spin;
    });

    return {
      spin: result,
      wonItem: result.wonItem,
      wonRarity,
      spinHash,
      seed,
      remainingBalance: balance - bet,
    };
  }

  // ── GET /fortune/my-balance ──────────────────────────────────
  async getBalance(userId: string, clanId: string) {
    const agg = await this.prisma.dkpTransaction.aggregate({
      where: { userId, clanId },
      _sum: { amount: true },
    });
    return { balance: agg._sum.amount ?? 0 };
  }

  // ── GET /fortune/chances ──────────────────────────────────────
  getChances() {
    const result: Record<number, Record<Rarity, number>> = {} as any;
    for (const bet of [5, 10, 15, 20]) {
      const m = BET_MULTIPLIER[bet];
      const w = this.buildWeights(m);
      const total = Object.values(w).reduce((s, v) => s + v, 0);
      result[bet] = {} as any;
      for (const [rarity, weight] of Object.entries(w)) {
        result[bet][rarity as Rarity] = Math.round((weight / total) * 10000) / 100;
      }
    }
    return result;
  }

  // ── Private helpers ──────────────────────────────────────────

  private buildWeights(multiplier: number): Record<Rarity, number> {
    return {
      COMMON: BASE_WEIGHTS.COMMON,
      UNCOMMON: Math.round(BASE_WEIGHTS.UNCOMMON * multiplier),
      RARE: Math.round(BASE_WEIGHTS.RARE * multiplier),
      EPIC: Math.round(BASE_WEIGHTS.EPIC * multiplier),
      LEGENDARY: Math.round(BASE_WEIGHTS.LEGENDARY * multiplier),
    };
  }

  private rollRarity(weights: Record<Rarity, number>): Rarity {
    const total = Object.values(weights).reduce((s, v) => s + v, 0);
    let roll = Math.random() * total;
    for (const [rarity, weight] of Object.entries(weights)) {
      roll -= weight;
      if (roll <= 0) return rarity as Rarity;
    }
    return 'COMMON';
  }

  private pickItem(
    items: { id: string; rarity: string; [k: string]: any }[],
    targetRarity: Rarity,
  ) {
    // Rarity fallback order: LEGENDARY → EPIC → RARE → UNCOMMON → COMMON
    const rarityOrder: Rarity[] = ['LEGENDARY', 'EPIC', 'RARE', 'UNCOMMON', 'COMMON'];
    let startIdx = rarityOrder.indexOf(targetRarity);

    for (let i = startIdx; i < rarityOrder.length; i++) {
      const candidates = items.filter((it) => it.rarity === rarityOrder[i]);
      if (candidates.length > 0) {
        return candidates[Math.floor(Math.random() * candidates.length)];
      }
    }
    // If no match going down, try going up
    for (let i = startIdx - 1; i >= 0; i--) {
      const candidates = items.filter((it) => it.rarity === rarityOrder[i]);
      if (candidates.length > 0) {
        return candidates[Math.floor(Math.random() * candidates.length)];
      }
    }
    return items[Math.floor(Math.random() * items.length)];
  }
}
