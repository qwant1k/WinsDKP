import { Injectable, NotFoundException, ForbiddenException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PaginationDto, PaginatedResponse } from '../../common/dto/pagination.dto';
import { ClanRole } from '@prisma/client';

@Injectable()
export class ClansService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: PaginationDto) {
    const where = {
      deletedAt: null,
      ...(query.search ? { name: { contains: query.search, mode: 'insensitive' as const } } : {}),
    };
    const [clans, total] = await Promise.all([
      this.prisma.clan.findMany({
        where,
        include: { _count: { select: { memberships: { where: { isActive: true } } } } },
        skip: query.skip,
        take: query.limit,
        orderBy: { createdAt: query.sortOrder || 'desc' },
      }),
      this.prisma.clan.count({ where }),
    ]);
    return new PaginatedResponse(clans, total, query.page, query.limit);
  }

  async findById(id: string) {
    const clan = await this.prisma.clan.findUnique({
      where: { id },
      include: {
        memberships: {
          where: { isActive: true },
          include: { user: { include: { profile: true, dkpWallet: true } } },
          orderBy: { role: 'asc' },
        },
        _count: { select: { memberships: { where: { isActive: true } } } },
      },
    });
    if (!clan) throw new NotFoundException('Clan not found');
    return clan;
  }

  async getMembers(clanId: string, query: PaginationDto) {
    const where = {
      clanId,
      isActive: true,
      ...(query.search
        ? { user: { profile: { nickname: { contains: query.search, mode: 'insensitive' as const } } } }
        : {}),
    };
    const [members, total] = await Promise.all([
      this.prisma.clanMembership.findMany({
        where,
        include: { user: { include: { profile: true, dkpWallet: true } } },
        skip: query.skip,
        take: query.limit,
        orderBy: { role: 'asc' },
      }),
      this.prisma.clanMembership.count({ where }),
    ]);
    return new PaginatedResponse(members, total, query.page, query.limit);
  }

  async requestJoin(clanId: string, userId: string, message?: string) {
    const existing = await this.prisma.clanMembership.findUnique({
      where: { userId_clanId: { userId, clanId } },
    });
    if (existing?.isActive) throw new ConflictException('Already a member of this clan');

    const pendingRequest = await this.prisma.clanJoinRequest.findFirst({
      where: { userId, clanId, status: 'PENDING' },
    });
    if (pendingRequest) throw new ConflictException('Join request already pending');

    return this.prisma.clanJoinRequest.create({
      data: { userId, clanId, message },
    });
  }

  async getJoinRequests(clanId: string, query: PaginationDto) {
    const where = { clanId, status: 'PENDING' as const };
    const [requests, total] = await Promise.all([
      this.prisma.clanJoinRequest.findMany({
        where,
        include: { user: { include: { profile: true } } },
        skip: query.skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.clanJoinRequest.count({ where }),
    ]);
    return new PaginatedResponse(requests, total, query.page, query.limit);
  }

  async reviewJoinRequest(requestId: string, reviewerId: string, approved: boolean) {
    const request = await this.prisma.clanJoinRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundException('Join request not found');
    if (request.status !== 'PENDING') throw new BadRequestException('Request already reviewed');

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.clanJoinRequest.update({
        where: { id: requestId },
        data: {
          status: approved ? 'APPROVED' : 'REJECTED',
          reviewedBy: reviewerId,
          reviewedAt: new Date(),
        },
      });

      if (approved) {
        await tx.clanMembership.upsert({
          where: { userId_clanId: { userId: request.userId, clanId: request.clanId } },
          update: { isActive: true, role: ClanRole.NEWBIE, leftAt: null },
          create: { userId: request.userId, clanId: request.clanId, role: ClanRole.NEWBIE },
        });

        const walletExists = await tx.dkpWallet.findUnique({ where: { userId: request.userId } });
        if (!walletExists) {
          await tx.dkpWallet.create({
            data: { userId: request.userId, balance: 0, onHold: 0, totalEarned: 0 },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          actorId: reviewerId,
          action: approved ? 'clan.join_request.approved' : 'clan.join_request.rejected',
          entityType: 'clan_join_request',
          entityId: requestId,
          after: updated,
        },
      });

      return updated;
    });
  }

  async changeMemberRole(clanId: string, targetUserId: string, newRole: ClanRole, actorId: string) {
    const membership = await this.prisma.clanMembership.findUnique({
      where: { userId_clanId: { userId: targetUserId, clanId } },
    });
    if (!membership || !membership.isActive) throw new NotFoundException('Member not found');

    const actorMembership = await this.prisma.clanMembership.findUnique({
      where: { userId_clanId: { userId: actorId, clanId } },
    });
    if (!actorMembership) throw new ForbiddenException('Not a clan member');

    const roleHierarchy: Record<string, number> = {
      CLAN_LEADER: 0,
      ELDER: 1,
      MEMBER: 2,
      NEWBIE: 3,
    };

    if (roleHierarchy[actorMembership.role]! >= roleHierarchy[membership.role]!) {
      throw new ForbiddenException('Cannot change role of member with equal or higher rank');
    }

    const before = { ...membership };
    const updated = await this.prisma.clanMembership.update({
      where: { id: membership.id },
      data: { role: newRole },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'clan.member.role_changed',
        entityType: 'clan_membership',
        entityId: membership.id,
        before,
        after: updated,
      },
    });

    return updated;
  }

  async getClanReport(clanId: string, from?: string, to?: string) {
    const dateFilter: Record<string, unknown> = {};
    if (from || to) {
      dateFilter['createdAt'] = {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lte: new Date(to) } : {}),
      };
    }

    const members = await this.prisma.clanMembership.findMany({
      where: { clanId, isActive: true },
      include: { user: { include: { profile: true, dkpWallet: true } } },
      orderBy: { role: 'asc' },
    });

    const userIds = members.map((m) => m.userId);

    const [activityParts, transactions, penalties, bids, randomizerWins] = await Promise.all([
      this.prisma.activityParticipant.findMany({
        where: { userId: { in: userIds }, ...(from || to ? { joinedAt: dateFilter['createdAt'] as any } : {}) },
        include: { activity: { select: { id: true, title: true, type: true } } },
      }),
      this.prisma.dkpTransaction.findMany({
        where: { userId: { in: userIds }, ...dateFilter },
      }),
      this.prisma.penalty.findMany({
        where: { userId: { in: userIds }, ...dateFilter },
      }),
      this.prisma.bid.findMany({
        where: { userId: { in: userIds }, ...dateFilter },
        include: { lot: { include: { result: true } } },
      }),
      this.prisma.randomizerResult.findMany({
        where: { winnerId: { in: userIds }, ...dateFilter },
        include: { session: true },
      }),
    ]);

    const report = members.map((m) => {
      const userId = m.userId;
      const userTxs = transactions.filter((t) => t.userId === userId);
      const userPenalties = penalties.filter((p) => p.userId === userId);
      const userActivities = activityParts.filter((a) => a.userId === userId);
      const userBids = bids.filter((b) => b.userId === userId);
      const userWonLots = userBids.filter((b) => b.lot?.result?.winnerId === userId);
      const userRandomizerWins = randomizerWins.filter((r) => r.winnerId === userId);

      const dkpEarned = userTxs
        .filter((t) => Number(t.amount) > 0)
        .reduce((sum, t) => sum + Number(t.amount), 0);
      const dkpSpent = userTxs
        .filter((t) => Number(t.amount) < 0)
        .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);
      const penaltyTotal = userPenalties.reduce((sum, p) => sum + Number(p.amount), 0);

      return {
        userId,
        nickname: m.user.profile?.nickname || '—',
        displayName: m.user.profile?.displayName,
        role: m.role,
        bm: m.user.profile?.bm || 0,
        level: m.user.profile?.level || 1,
        currentBalance: Number(m.user.dkpWallet?.balance || 0),
        activitiesCount: userActivities.length,
        dkpEarned: Math.round(dkpEarned * 100) / 100,
        dkpSpent: Math.round(dkpSpent * 100) / 100,
        penaltiesCount: userPenalties.length,
        penaltyTotal: Math.round(penaltyTotal * 100) / 100,
        auctionBidsCount: userBids.length,
        auctionWinsCount: userWonLots.length,
        itemsReceived: userWonLots.length + userRandomizerWins.length,
      };
    });

    return {
      clanId,
      from: from || null,
      to: to || null,
      generatedAt: new Date().toISOString(),
      membersCount: members.length,
      report,
    };
  }

  async kickMember(clanId: string, targetUserId: string, actorId: string) {
    const membership = await this.prisma.clanMembership.findUnique({
      where: { userId_clanId: { userId: targetUserId, clanId } },
    });
    if (!membership || !membership.isActive) throw new NotFoundException('Member not found');
    if (membership.role === 'CLAN_LEADER') throw new ForbiddenException('Cannot kick the clan leader');

    const updated = await this.prisma.clanMembership.update({
      where: { id: membership.id },
      data: { isActive: false, leftAt: new Date() },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'clan.member.kicked',
        entityType: 'clan_membership',
        entityId: membership.id,
        before: membership,
        after: updated,
      },
    });

    return updated;
  }
}
