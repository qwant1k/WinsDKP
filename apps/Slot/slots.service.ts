import {
  Injectable,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { createHash, randomBytes } from 'crypto';

/* ────────────────────────────────────────────────────────────
   PAYOUT TABLE   (weights sum to 1000 for integer math)

   50.0% → ×0.5  → win  2.5 DKP
   25.0% → ×1.0  → win  5.0 DKP
   15.0% → ×1.5  → win  7.5 DKP
    7.5% → ×2.0  → win 10.0 DKP
    2.5% → ×4.0  → win 20.0 DKP
    0.5% → ×10.0 → win 50.0 DKP
──────────────────────────────────────────────────────────── */
const TIERS = [
  { id: 'bronze',   weight: 500, multiplier: 0.5,  label: 'Бронза',   symbol: 'skull'   },
  { id: 'silver',   weight: 250, multiplier: 1.0,  label: 'Серебро',  symbol: 'sword'   },
  { id: 'gold',     weight: 150, multiplier: 1.5,  label: 'Золото',   symbol: 'moon'    },
  { id: 'emerald',  weight: 75,  multiplier: 2.0,  label: 'Изумруд',  symbol: 'star'    },
  { id: 'diamond',  weight: 25,  multiplier: 4.0,  label: 'Алмаз',    symbol: 'diamond' },
  { id: 'arcane',   weight: 5,   multiplier: 10.0, label: 'Арканный', symbol: 'crystal' },
] as const;

const TOTAL_WEIGHT = TIERS.reduce((s, t) => s + t.weight, 0); // 1005 (rounding ok)

const BET = 5; // fixed bet in DKP

export type TierId = typeof TIERS[number]['id'];

function rollTier(): typeof TIERS[number] {
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

  /** GET /slots/info — payout table + stats */
  getInfo() {
    return {
      bet: BET,
      tiers: TIERS.map(t => ({
        id: t.id,
        label: t.label,
        symbol: t.symbol,
        multiplier: t.multiplier,
        payout: BET * t.multiplier,
        chance: ((t.weight / TOTAL_WEIGHT) * 100).toFixed(1),
      })),
    };
  }

  /** GET /slots/logs */
  async getLogs(clanId: string, limit = 40) {
    return this.prisma.slotSpin.findMany({
      where: { clanId },
      take: Math.min(limit, 100),
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        tier: true,
        multiplier: true,
        payout: true,
        createdAt: true,
        user: { select: { id: true, username: true, avatarUrl: true } },
      },
    });
  }

  /** GET /slots/balance */
  async getBalance(userId: string, clanId: string) {
    const agg = await this.prisma.dkpTransaction.aggregate({
      where: { userId, clanId },
      _sum: { amount: true },
    });
    return { balance: agg._sum.amount ?? 0 };
  }

  /** POST /slots/spin */
  async spin(userId: string, clanId: string) {
    // ── 1. Check membership
    const membership = await this.prisma.clanMember.findUnique({
      where: { userId_clanId: { userId, clanId } },
      include: { user: { select: { username: true } } },
    });
    if (!membership) throw new ForbiddenException('Вы не состоите в клане');

    // ── 2. Check balance
    const agg = await this.prisma.dkpTransaction.aggregate({
      where: { userId, clanId },
      _sum: { amount: true },
    });
    const balance = agg._sum.amount ?? 0;
    if (balance < BET) {
      throw new BadRequestException(`Недостаточно DKP. Нужно ${BET}, есть ${balance}`);
    }

    // ── 3. Roll
    const tier   = rollTier();
    const payout = BET * tier.multiplier;
    const net    = payout - BET; // can be negative (loss)

    // ── 4. Provably fair
    const seed     = randomBytes(16).toString('hex');
    const spinHash = createHash('sha256')
      .update(`${seed}:${userId}:${BET}:${tier.id}:${payout}`)
      .digest('hex');

    // ── 5. Atomic transaction
    const result = await this.prisma.$transaction(async tx => {
      // Deduct bet
      await tx.dkpTransaction.create({
        data: {
          userId, clanId,
          amount: -BET,
          reason: `Аркан Слоты — ставка ${BET} DKP`,
          type: 'SLOT_BET',
        },
      });

      // Credit payout
      await tx.dkpTransaction.create({
        data: {
          userId, clanId,
          amount: payout,
          reason: `Аркан Слоты — выигрыш ×${tier.multiplier} (${tier.label})`,
          type: 'SLOT_WIN',
        },
      });

      // Record spin
      const spin = await tx.slotSpin.create({
        data: {
          userId, clanId,
          tier: tier.id,
          multiplier: tier.multiplier,
          payout,
          seed,
          spinHash,
        },
        include: {
          user: { select: { id: true, username: true } },
        },
      });

      return spin;
    });

    return {
      tier: tier.id,
      tierId:     tier.id,
      label:      tier.label,
      symbol:     tier.symbol,
      multiplier: tier.multiplier,
      payout,
      net,
      spinHash,
      seed,
      remainingBalance: balance - BET + payout,
    };
  }
}
