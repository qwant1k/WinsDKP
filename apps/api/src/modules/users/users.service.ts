import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PaginationDto, PaginatedResponse } from '../../common/dto/pagination.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: PaginationDto) {
    const where = {
      deletedAt: null,
      ...(query.search
        ? {
            OR: [
              { email: { contains: query.search, mode: 'insensitive' as const } },
              { profile: { nickname: { contains: query.search, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: { profile: true, dkpWallet: true, clanMemberships: { where: { isActive: true }, include: { clan: true } } },
        skip: query.skip,
        take: query.limit,
        orderBy: { createdAt: query.sortOrder || 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return new PaginatedResponse(users, total, query.page, query.limit);
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        profile: true,
        dkpWallet: true,
        clanMemberships: { where: { isActive: true }, include: { clan: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateProfile(userId: string, data: { nickname?: string; displayName?: string; bm?: number; level?: number; contacts?: object; locale?: string; notifyPrefs?: object }) {
    return this.prisma.profile.update({
      where: { userId },
      data,
    });
  }

  async getTimeline(userId: string, query: PaginationDto) {
    const [transactions, activities, bids, penalties] = await Promise.all([
      this.prisma.dkpTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: query.limit,
        skip: query.skip,
      }),
      this.prisma.activityParticipant.findMany({
        where: { userId },
        include: { activity: true },
        orderBy: { joinedAt: 'desc' },
        take: query.limit,
      }),
      this.prisma.bid.findMany({
        where: { userId },
        include: { lot: { include: { warehouseItem: true, result: true } } },
        orderBy: { createdAt: 'desc' },
        take: query.limit,
      }),
      this.prisma.penalty.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: query.limit,
      }),
    ]);

    // Enrich DKP transaction descriptions — replace UUIDs with human-readable names
    const enrichedTransactions = await this.enrichTransactionDescriptions(transactions);

    const timeline = [
      ...enrichedTransactions.map((t) => ({ type: 'dkp_transaction' as const, data: t, date: t.createdAt })),
      ...activities.map((a) => ({ type: 'activity' as const, data: a, date: a.joinedAt })),
      ...bids.map((b) => ({ type: 'bid' as const, data: b, date: b.createdAt })),
      ...penalties.map((p) => ({ type: 'penalty' as const, data: p, date: p.createdAt })),
    ].sort((a, b) => b.date.getTime() - a.date.getTime());

    return timeline.slice(0, query.limit);
  }

  private async enrichTransactionDescriptions(transactions: any[]) {
    const lotIds = new Set<string>();
    const activityIds = new Set<string>();

    for (const t of transactions) {
      if (t.referenceType === 'lot' && t.referenceId) lotIds.add(t.referenceId);
      if (t.referenceType === 'activity' && t.referenceId) activityIds.add(t.referenceId);
    }

    const [lots, activitiesMap] = await Promise.all([
      lotIds.size > 0
        ? this.prisma.lot.findMany({
            where: { id: { in: [...lotIds] } },
            include: { warehouseItem: true },
          })
        : [],
      activityIds.size > 0
        ? this.prisma.activity.findMany({
            where: { id: { in: [...activityIds] } },
          })
        : [],
    ]);

    const lotNameMap = new Map(lots.map((l) => [l.id, l.warehouseItem?.name || 'Предмет']));
    const activityNameMap = new Map(activitiesMap.map((a) => [a.id, a.title]));

    return transactions.map((t) => {
      let description = t.description || '';
      if (t.referenceType === 'lot' && t.referenceId && lotNameMap.has(t.referenceId)) {
        const itemName = lotNameMap.get(t.referenceId)!;
        description = description
          .replace(/Auction bid on lot [a-f0-9-]+/gi, `Ставка на «${itemName}»`)
          .replace(/Hold released:?\s*/gi, 'Возврат: ')
          .replace(/Hold for:?\s*/gi, 'Удержание: ');
      }
      if (t.referenceType === 'activity' && t.referenceId && activityNameMap.has(t.referenceId)) {
        const actName = activityNameMap.get(t.referenceId)!;
        description = description.replace(/Activity reward:?\s*/gi, `Награда за «${actName}»`);
      }
      return { ...t, description };
    });
  }
}
