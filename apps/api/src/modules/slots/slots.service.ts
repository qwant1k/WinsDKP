import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DkpTransactionType } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';

const TIERS = [
  { id: 'bronze', weight: 500, multiplier: 0.5, label: 'Bronze', symbol: 'skull' },
  { id: 'silver', weight: 250, multiplier: 1, label: 'Silver', symbol: 'sword' },
  { id: 'gold', weight: 150, multiplier: 1.5, label: 'Gold', symbol: 'moon' },
  { id: 'emerald', weight: 75, multiplier: 2, label: 'Emerald', symbol: 'star' },
  { id: 'diamond', weight: 25, multiplier: 4, label: 'Diamond', symbol: 'diamond' },
  { id: 'arcane', weight: 5, multiplier: 10, label: 'Arcane', symbol: 'crystal' },
] as const;

const BET = 5;
const TOTAL_WEIGHT = TIERS.reduce((sum, tier) => sum + tier.weight, 0);

type Tier = (typeof TIERS)[number];

function rollTier(): Tier {
  let roll = Math.random() * TOTAL_WEIGHT;
  for (const tier of TIERS) {
    roll -= tier.weight;
    if (roll <= 0) return tier;
  }
  return TIERS[0];
}

@Injectable()
export class SlotsService {
  constructor(private readonly prisma: PrismaService) {}

  getInfo() {
    return {
      bet: BET,
      tiers: TIERS.map((tier) => ({
        id: tier.id,
        label: tier.label,
        symbol: tier.symbol,
        multiplier: tier.multiplier,
        payout: BET * tier.multiplier,
        chance: ((tier.weight / TOTAL_WEIGHT) * 100).toFixed(1),
      })),
    };
  }

  async getLogs(clanId: string, limit = 40) {
    const rows = await this.prisma.slotSpin.findMany({
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
      },
    });

    return rows.map((row) => ({
      id: row.id,
      tier: row.tier,
      multiplier: row.multiplier,
      payout: row.payout,
      createdAt: row.createdAt,
      user: {
        id: row.user.id,
        username: row.user.profile?.displayName || row.user.profile?.nickname || row.user.email.split('@')[0] || 'Player',
        avatarUrl: row.user.profile?.avatarUrl || undefined,
      },
    }));
  }

  async getBalance(userId: string) {
    const wallet = await this.prisma.dkpWallet.findUnique({
      where: { userId },
      select: { balance: true, onHold: true },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    return {
      balance: Math.max(0, Number(wallet.balance) - Number(wallet.onHold)),
    };
  }

  async spin(userId: string, clanId: string) {
    const membership = await this.prisma.clanMembership.findUnique({
      where: { userId_clanId: { userId, clanId } },
      select: { isActive: true },
    });

    if (!membership || !membership.isActive) {
      throw new ForbiddenException('You are not an active clan member');
    }

    const wallet = await this.prisma.dkpWallet.findUnique({
      where: { userId },
      select: { balance: true, onHold: true },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    const balanceBefore = Number(wallet.balance);
    const available = balanceBefore - Number(wallet.onHold);
    if (available < BET) {
      throw new BadRequestException(`Insufficient DKP. Available: ${available}, required: ${BET}`);
    }

    const tier = rollTier();
    const payout = BET * tier.multiplier;
    const net = payout - BET;

    const seed = randomBytes(16).toString('hex');
    const spinHash = createHash('sha256')
      .update(`${seed}:${userId}:${clanId}:${BET}:${tier.id}:${payout}`)
      .digest('hex');

    const afterBet = balanceBefore - BET;
    const afterWin = afterBet + payout;

    await this.prisma.$transaction(async (tx) => {
      await tx.dkpWallet.update({
        where: { userId },
        data: { balance: { decrement: BET } },
      });

      await tx.dkpTransaction.create({
        data: {
          userId,
          type: DkpTransactionType.SLOT_BET,
          amount: -BET,
          balanceBefore,
          balanceAfter: afterBet,
          description: `Slots spin bet (${BET} DKP)`,
          referenceType: 'slots_spin',
        },
      });

      await tx.dkpWallet.update({
        where: { userId },
        data: { balance: { increment: payout } },
      });

      await tx.dkpTransaction.create({
        data: {
          userId,
          type: DkpTransactionType.SLOT_WIN,
          amount: payout,
          balanceBefore: afterBet,
          balanceAfter: afterWin,
          description: `Slots payout x${tier.multiplier} (${tier.label})`,
          referenceType: 'slots_spin',
        },
      });

      await tx.slotSpin.create({
        data: {
          userId,
          clanId,
          tier: tier.id,
          multiplier: tier.multiplier,
          payout,
          seed,
          spinHash,
        },
      });
    });

    return {
      tier: tier.id,
      tierId: tier.id,
      label: tier.label,
      symbol: tier.symbol,
      multiplier: tier.multiplier,
      payout,
      net,
      spinHash,
      seed,
      remainingBalance: afterWin,
    };
  }
}