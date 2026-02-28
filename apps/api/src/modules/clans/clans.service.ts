import { Injectable, NotFoundException, ForbiddenException, ConflictException, BadRequestException, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SocketGateway } from '../../common/socket/socket.gateway';
import { RedisService } from '../../common/redis/redis.service';
import { PaginationDto, PaginatedResponse } from '../../common/dto/pagination.dto';
import { ClanRole, NotificationType } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';

type BossTrackerBoss = {
  id: number;
  name: string;
  location: string;
  respawnSeconds: number;
  killedAt: number | null;
  emoji: string;
};

type BossTrackerState = {
  bosses: BossTrackerBoss[];
  nextId: number;
  updatedAt: number;
  respawnNotifiedCycles?: Record<string, number>;
};

@Injectable()
export class ClansService {
  private readonly logger = new Logger(ClansService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly socket: SocketGateway,
    private readonly redis: RedisService,
    private readonly notifications: NotificationsService,
  ) {}

  private async ensureActiveMember(clanId: string, userId: string) {
    const membership = await this.prisma.clanMembership.findUnique({
      where: { userId_clanId: { userId, clanId } },
      select: { isActive: true },
    });

    if (!membership?.isActive) {
      throw new ForbiddenException('Only active clan members can access boss tracker');
    }
  }

  private getBossTrackerRedisKey(clanId: string) {
    return `boss-tracker:clan:${clanId}`;
  }

  private async readBossTrackerState(clanId: string): Promise<BossTrackerState | null> {
    const raw = await this.redis.get(this.getBossTrackerRedisKey(clanId));
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw) as BossTrackerState;
      if (!Array.isArray(parsed.bosses) || typeof parsed.nextId !== 'number') return null;
      return {
        bosses: parsed.bosses,
        nextId: parsed.nextId,
        updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : Date.now(),
        respawnNotifiedCycles:
          parsed.respawnNotifiedCycles && typeof parsed.respawnNotifiedCycles === 'object'
            ? parsed.respawnNotifiedCycles
            : {},
      };
    } catch {
      return null;
    }
  }

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

    const joinRequest = await this.prisma.clanJoinRequest.create({
      data: { userId, clanId, message },
      include: { user: { include: { profile: true } } },
    });

    // Real-time: notify clan leaders/elders about new join request
    this.socket.emitToClan(clanId, 'clan.join_request_created', {
      id: joinRequest.id,
      userId,
      nickname: joinRequest.user?.profile?.nickname,
      message,
      createdAt: joinRequest.createdAt,
    });

    return joinRequest;
  }

  async getMyJoinRequests(userId: string) {
    return this.prisma.clanJoinRequest.findMany({
      where: { userId },
      include: {
        clan: {
          select: { id: true, name: true, tag: true },
        },
      },
      orderBy: { createdAt: 'desc' },
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

  async transferLeadership(clanId: string, targetUserId: string, actorId: string) {
    if (!targetUserId) throw new BadRequestException('targetUserId is required');
    if (targetUserId === actorId) {
      throw new BadRequestException('Cannot transfer leadership to yourself');
    }

    const [actorMembership, targetMembership] = await Promise.all([
      this.prisma.clanMembership.findUnique({
        where: { userId_clanId: { userId: actorId, clanId } },
      }),
      this.prisma.clanMembership.findUnique({
        where: { userId_clanId: { userId: targetUserId, clanId } },
      }),
    ]);

    if (!actorMembership?.isActive || actorMembership.role !== 'CLAN_LEADER') {
      throw new ForbiddenException('Only current clan leader can transfer leadership');
    }

    if (!targetMembership?.isActive) {
      throw new NotFoundException('Target member not found');
    }

    if (targetMembership.role === 'CLAN_LEADER') {
      throw new BadRequestException('Target member is already clan leader');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const beforeActor = { ...actorMembership };
      const beforeTarget = { ...targetMembership };

      const [newLeader, formerLeader] = await Promise.all([
        tx.clanMembership.update({
          where: { id: targetMembership.id },
          data: { role: ClanRole.CLAN_LEADER },
        }),
        tx.clanMembership.update({
          where: { id: actorMembership.id },
          data: { role: ClanRole.MEMBER },
        }),
      ]);

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'clan.leadership.transferred',
          entityType: 'clan',
          entityId: clanId,
          before: { formerLeader: beforeActor, targetLeader: beforeTarget },
          after: { formerLeader, newLeader },
        },
      });

      return { newLeader, formerLeader };
    });

    return {
      message: 'Leadership transferred',
      ...result,
    };
  }

  async setServerChampion(
    clanId: string,
    targetUserId: string,
    actorId: string,
    actorGlobalRole: string | undefined,
    isChampion: boolean,
  ) {
    const targetMembership = await this.prisma.clanMembership.findUnique({
      where: { userId_clanId: { userId: targetUserId, clanId } },
      select: { userId: true, isActive: true },
    });
    if (!targetMembership?.isActive) {
      throw new NotFoundException('Member not found');
    }

    const isPortalAdmin = actorGlobalRole === 'PORTAL_ADMIN';
    if (!isPortalAdmin) {
      const actorMembership = await this.prisma.clanMembership.findUnique({
        where: { userId_clanId: { userId: actorId, clanId } },
        select: { role: true, isActive: true },
      });
      if (!actorMembership?.isActive || actorMembership.role !== ClanRole.CLAN_LEADER) {
        throw new ForbiddenException('Only clan leader can change champion status');
      }
    }

    const before = await this.prisma.profile.findUnique({
      where: { userId: targetUserId },
      select: { userId: true, isServerChampion: true },
    });
    if (!before) {
      throw new NotFoundException('Profile not found');
    }

    const updated = await this.prisma.profile.update({
      where: { userId: targetUserId },
      data: { isServerChampion: isChampion },
      select: { userId: true, isServerChampion: true },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'clan.member.server_champion.set',
        entityType: 'user',
        entityId: targetUserId,
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

  async notifyBossRespawn(clanId: string, actorId: string, bossName: string, location?: string) {
    const normalizedBossName = bossName?.trim();
    if (!normalizedBossName) {
      throw new BadRequestException('Boss name is required');
    }

    const actorMembership = await this.prisma.clanMembership.findUnique({
      where: { userId_clanId: { userId: actorId, clanId } },
      select: { isActive: true },
    });

    if (!actorMembership?.isActive) {
      throw new ForbiddenException('Only active clan members can send boss notifications');
    }

    const dedupeKey = `boss-respawn:${clanId}:${normalizedBossName.toLowerCase()}`;
    const alreadySent = await this.redis.get(dedupeKey);
    if (alreadySent) {
      return { sent: false, reason: 'duplicate' as const };
    }

    await this.redis.set(dedupeKey, '1', 30);

    const members = await this.prisma.clanMembership.findMany({
      where: { clanId, isActive: true },
      select: { userId: true },
    });

    if (members.length === 0) {
      return { sent: false, reason: 'no_members' as const };
    }

    const title = `Респаун босса: ${normalizedBossName}`;
    const body = location?.trim()
      ? `Босс снова доступен. Локация: ${location.trim()}`
      : 'Босс снова доступен для убийства.';

    await Promise.all(
      members.map((member) =>
        this.notifications.create({
          userId: member.userId,
          type: NotificationType.SYSTEM,
          title,
          body,
          data: { link: '/boss-tracker', clanId, bossName: normalizedBossName, location: location?.trim() || null },
        }),
      ),
    );

    this.socket.emitToClan(clanId, 'boss.respawn', {
      clanId,
      bossName: normalizedBossName,
      location: location?.trim() || null,
    });

    return { sent: true, recipients: members.length };
  }

  private async notifyClanAboutBossRespawn(clanId: string, bossName: string, location?: string) {
    const members = await this.prisma.clanMembership.findMany({
      where: { clanId, isActive: true },
      select: { userId: true },
    });

    if (members.length === 0) return 0;

    const title = `Респаун босса: ${bossName}`;
    const body = location?.trim()
      ? `Босс снова доступен. Локация: ${location.trim()}`
      : 'Босс снова доступен для убийства.';

    await Promise.all(
      members.map((member) =>
        this.notifications.create({
          userId: member.userId,
          type: NotificationType.SYSTEM,
          title,
          body,
          data: { link: '/boss-tracker', clanId, bossName, location: location?.trim() || null },
        }),
      ),
    );

    this.socket.emitToClan(clanId, 'boss.respawn', {
      clanId,
      bossName,
      location: location?.trim() || null,
    });

    return members.length;
  }

  @Cron(CronExpression.EVERY_30_SECONDS)
  private async processBossRespawns() {
    const keys = await this.redis.client.keys('boss-tracker:clan:*');
    if (!keys.length) return;

    const now = Date.now();

    for (const key of keys) {
      const clanId = key.replace('boss-tracker:clan:', '');
      const state = await this.readBossTrackerState(clanId);
      if (!state || !state.bosses.length) continue;

      let changed = false;
      const notifiedCycles = { ...(state.respawnNotifiedCycles || {}) };

      for (const boss of state.bosses) {
        if (!boss.killedAt) continue;

        const respawnAt = Number(boss.killedAt) + Number(boss.respawnSeconds) * 1000;
        if (now < respawnAt) continue;

        const cycleId = `${boss.id}:${boss.killedAt}`;
        const lockKey = `boss-respawn-cycle:${clanId}:${cycleId}`;
        const lock = await this.redis.client.set(lockKey, '1', 'EX', 86400, 'NX');
        if (lock !== 'OK') continue;

        await this.notifyClanAboutBossRespawn(clanId, boss.name, boss.location);
        notifiedCycles[cycleId] = now;
        boss.killedAt = null;
        changed = true;
      }

      if (!changed) continue;

      const pruned = Object.fromEntries(
        Object.entries(notifiedCycles).filter(([, ts]) => now - Number(ts) < 7 * 24 * 60 * 60 * 1000),
      );

      const nextState: BossTrackerState = {
        ...state,
        updatedAt: now,
        respawnNotifiedCycles: pruned,
      };

      await this.redis.set(this.getBossTrackerRedisKey(clanId), JSON.stringify(nextState));
      this.socket.emitToClan(clanId, 'boss-tracker.state_updated', {
        updatedAt: nextState.updatedAt,
        count: nextState.bosses.length,
      });
      this.logger.debug(`Processed boss respawns for clan ${clanId}`);
    }
  }

  async getBossTrackerState(clanId: string, userId: string) {
    await this.ensureActiveMember(clanId, userId);
    const state = await this.readBossTrackerState(clanId);

    if (!state) {
      return { bosses: [], nextId: 1, updatedAt: null };
    }

    return state;
  }

  async saveBossTrackerState(clanId: string, userId: string, bosses: BossTrackerBoss[], nextId: number) {
    await this.ensureActiveMember(clanId, userId);

    if (!Array.isArray(bosses)) {
      throw new BadRequestException('Bosses must be an array');
    }

    const sanitizedBosses = bosses.map((boss) => ({
      id: Number(boss.id),
      name: String(boss.name || '').trim(),
      location: String(boss.location || '').trim(),
      respawnSeconds: Math.max(0, Number(boss.respawnSeconds || 0)),
      killedAt: boss.killedAt === null ? null : Number(boss.killedAt),
      emoji: String(boss.emoji || '🐉'),
    }));

    const invalid = sanitizedBosses.some(
      (boss) =>
        !Number.isFinite(boss.id) ||
        !boss.name ||
        !Number.isFinite(boss.respawnSeconds) ||
        !Number.isInteger(boss.respawnSeconds) ||
        boss.respawnSeconds <= 0 ||
        (boss.killedAt !== null && !Number.isFinite(boss.killedAt)),
    );

    if (invalid) {
      throw new BadRequestException('Invalid boss tracker payload');
    }

    const currentMaxId = sanitizedBosses.reduce((max, boss) => Math.max(max, boss.id), 0);
    const normalizedNextId = Number.isFinite(nextId) && nextId > currentMaxId ? Math.floor(nextId) : currentMaxId + 1;

    const existingState = await this.readBossTrackerState(clanId);

    const state: BossTrackerState = {
      bosses: sanitizedBosses,
      nextId: normalizedNextId,
      updatedAt: Date.now(),
      respawnNotifiedCycles: existingState?.respawnNotifiedCycles || {},
    };

    await this.redis.set(this.getBossTrackerRedisKey(clanId), JSON.stringify(state));

    this.socket.emitToClan(clanId, 'boss-tracker.state_updated', {
      updatedAt: state.updatedAt,
      count: state.bosses.length,
    });

    return state;
  }
}
