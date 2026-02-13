import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { DkpService } from '../dkp/dkp.service';
import { PaginationDto, PaginatedResponse } from '../../common/dto/pagination.dto';
import * as crypto from 'crypto';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dkpService: DkpService,
  ) {}

  async getUsers(query: PaginationDto) {
    const where = {
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
        include: {
          profile: true,
          dkpWallet: true,
          clanMemberships: { where: { isActive: true }, include: { clan: true } },
        },
        skip: query.skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);
    return new PaginatedResponse(users, total, query.page, query.limit);
  }

  async createUser(data: { email: string; nickname: string; displayName?: string; globalRole?: string; password?: string }, actorId: string) {
    const existing = await this.prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new ConflictException('User with this email already exists');

    const existingNickname = await this.prisma.profile.findUnique({ where: { nickname: data.nickname } });
    if (existingNickname) throw new ConflictException('Nickname already taken');

    const tempPassword = data.password || crypto.randomBytes(8).toString('hex');
    const { createHash } = await import('crypto');
    const passwordHash = createHash('sha256').update(tempPassword).digest('hex');

    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        globalRole: (data.globalRole as any) || 'USER',
        emailVerified: true,
        profile: {
          create: {
            nickname: data.nickname,
            displayName: data.displayName || data.nickname,
          },
        },
      },
      include: { profile: true },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'admin.user.created',
        entityType: 'user',
        entityId: user.id,
        after: { email: user.email, nickname: data.nickname, globalRole: user.globalRole },
      },
    });

    return { ...user, generatedPassword: data.password ? undefined : tempPassword };
  }

  async updateUser(userId: string, data: { globalRole?: string; isActive?: boolean; email?: string; displayName?: string; bm?: number; level?: number }, actorId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const before = { ...user };

    const userData: Record<string, unknown> = {};
    if (data.globalRole !== undefined) userData.globalRole = data.globalRole;
    if (data.isActive !== undefined) userData.isActive = data.isActive;
    if (data.email !== undefined) userData.email = data.email;

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: userData as any,
    });

    if (data.displayName !== undefined || data.bm !== undefined || data.level !== undefined) {
      const profileData: Record<string, unknown> = {};
      if (data.displayName !== undefined) profileData.displayName = data.displayName;
      if (data.bm !== undefined) profileData.bm = data.bm;
      if (data.level !== undefined) profileData.level = data.level;
      await this.prisma.profile.update({ where: { userId }, data: profileData as any });
    }

    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'admin.user.updated',
        entityType: 'user',
        entityId: userId,
        before,
        after: { ...updated, profileChanges: { displayName: data.displayName, bm: data.bm, level: data.level } },
      },
    });

    return this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true, dkpWallet: true, clanMemberships: { where: { isActive: true }, include: { clan: true } } },
    });
  }

  async deleteUser(userId: string, actorId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { profile: true } });
    if (!user) throw new NotFoundException('User not found');
    if (user.globalRole === 'PORTAL_ADMIN') throw new ForbiddenException('Cannot delete portal admin');

    const auditData = { email: user.email, nickname: user.profile?.nickname };

    // Hard delete — Prisma cascades will remove all related records
    // (profile, sessions, memberships, bids, transactions, notifications, etc.)
    await this.prisma.user.delete({ where: { id: userId } });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'admin.user.deleted',
        entityType: 'user',
        entityId: userId,
        before: auditData,
      },
    });

    return { message: 'User permanently deleted' };
  }

  async getClans(query: PaginationDto) {
    const where = {
      ...(query.search ? { name: { contains: query.search, mode: 'insensitive' as const } } : {}),
    };
    const [clans, total] = await Promise.all([
      this.prisma.clan.findMany({
        where,
        include: { _count: { select: { memberships: { where: { isActive: true } } } } },
        skip: query.skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.clan.count({ where }),
    ]);
    return new PaginatedResponse(clans, total, query.page, query.limit);
  }

  async createClan(data: { name: string; tag: string; description?: string }, actorId: string) {
    const clan = await this.prisma.clan.create({ data });
    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'admin.clan.created',
        entityType: 'clan',
        entityId: clan.id,
        after: clan,
      },
    });
    return clan;
  }

  async getDkpWallets(query: PaginationDto) {
    const where = query.search
      ? { user: { profile: { nickname: { contains: query.search, mode: 'insensitive' as const } } } }
      : {};
    const [wallets, total] = await Promise.all([
      this.prisma.dkpWallet.findMany({
        where,
        include: { user: { include: { profile: true } } },
        skip: query.skip,
        take: query.limit,
        orderBy: { balance: 'desc' },
      }),
      this.prisma.dkpWallet.count({ where }),
    ]);
    return new PaginatedResponse(wallets, total, query.page, query.limit);
  }

  async getAllTransactions(query: PaginationDto & { userId?: string; type?: string }) {
    const where: Record<string, unknown> = {};
    if (query.userId) where['userId'] = query.userId;
    if (query.type) where['type'] = query.type;
    const [txs, total] = await Promise.all([
      this.prisma.dkpTransaction.findMany({
        where,
        include: { user: { include: { profile: true } } },
        skip: query.skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.dkpTransaction.count({ where }),
    ]);
    return new PaginatedResponse(txs, total, query.page, query.limit);
  }

  async getAllAuctions(query: PaginationDto) {
    const where = query.search ? { title: { contains: query.search, mode: 'insensitive' as const } } : {};
    const [auctions, total] = await Promise.all([
      this.prisma.auction.findMany({
        where,
        include: {
          clan: true,
          _count: { select: { lots: true, participants: true } },
        },
        skip: query.skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auction.count({ where }),
    ]);
    return new PaginatedResponse(auctions, total, query.page, query.limit);
  }

  async getAllActivities(query: PaginationDto) {
    const where = query.search ? { title: { contains: query.search, mode: 'insensitive' as const } } : {};
    const [activities, total] = await Promise.all([
      this.prisma.activity.findMany({
        where,
        include: {
          clan: true,
          _count: { select: { participants: true } },
        },
        skip: query.skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.activity.count({ where }),
    ]);
    return new PaginatedResponse(activities, total, query.page, query.limit);
  }

  async getAllRandomizerSessions(query: PaginationDto) {
    const [sessions, total] = await Promise.all([
      this.prisma.randomizerSession.findMany({
        include: {
          clan: true,
          result: true,
          _count: { select: { entries: true } },
        },
        skip: query.skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.randomizerSession.count(),
    ]);
    return new PaginatedResponse(sessions, total, query.page, query.limit);
  }

  async getAllWarehouseItems(query: PaginationDto) {
    const where = {
      deletedAt: null,
      ...(query.search ? { name: { contains: query.search, mode: 'insensitive' as const } } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.warehouseItem.findMany({
        where,
        include: { clan: true },
        skip: query.skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.warehouseItem.count({ where }),
    ]);
    return new PaginatedResponse(items, total, query.page, query.limit);
  }

  async getNewsPosts(query: PaginationDto) {
    const where = { deletedAt: null };
    const [posts, total] = await Promise.all([
      this.prisma.newsPost.findMany({
        where,
        include: { clan: true, author: { include: { profile: true } } },
        skip: query.skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.newsPost.count({ where }),
    ]);
    return new PaginatedResponse(posts, total, query.page, query.limit);
  }

  async getFeedPosts(query: PaginationDto & { reported?: boolean }) {
    const where: Record<string, unknown> = { deletedAt: null };
    if (query.reported) where['isReported'] = true;
    const [posts, total] = await Promise.all([
      this.prisma.feedPost.findMany({
        where,
        include: { clan: true, author: { include: { profile: true } } },
        skip: query.skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.feedPost.count({ where }),
    ]);
    return new PaginatedResponse(posts, total, query.page, query.limit);
  }

  async getNotifications(query: PaginationDto) {
    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        include: { user: { include: { profile: true } } },
        skip: query.skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count(),
    ]);
    return new PaginatedResponse(notifications, total, query.page, query.limit);
  }

  async getSystemSettings() {
    return this.prisma.systemSetting.findMany({ orderBy: { group: 'asc' } });
  }

  async updateSystemSetting(key: string, value: unknown, actorId: string) {
    const setting = await this.prisma.systemSetting.findUnique({ where: { key } });
    if (!setting) throw new NotFoundException('Setting not found');

    const before = { ...setting };
    const updated = await this.prisma.systemSetting.update({
      where: { key },
      data: { value: value as any },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'admin.setting.updated',
        entityType: 'system_setting',
        entityId: setting.id,
        before,
        after: updated,
      },
    });

    return updated;
  }

  async impersonate(targetUserId: string, actorId: string) {
    const target = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      include: { profile: true, clanMemberships: { where: { isActive: true } } },
    });
    if (!target) throw new NotFoundException('User not found');

    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'admin.impersonate',
        entityType: 'user',
        entityId: targetUserId,
        metadata: { impersonatedUser: target.email },
      },
    });

    return {
      id: target.id,
      email: target.email,
      globalRole: target.globalRole,
      profile: target.profile,
      clanMembership: target.clanMemberships[0] || null,
      impersonatedBy: actorId,
    };
  }

  async getCoefficients(clanId: string) {
    const [power, level] = await Promise.all([
      this.prisma.coefficientPowerRange.findMany({
        where: { clanId },
        orderBy: { fromPower: 'asc' },
      }),
      this.prisma.coefficientLevelRange.findMany({
        where: { clanId },
        orderBy: { fromLevel: 'asc' },
      }),
    ]);
    return { powerRanges: power, levelRanges: level };
  }

  async updatePowerCoefficients(clanId: string, ranges: Array<{ fromPower: number; toPower: number; coefficient: number }>, actorId: string) {
    this.validateRanges(ranges.map((r) => ({ from: r.fromPower, to: r.toPower })));

    await this.prisma.$transaction([
      this.prisma.coefficientPowerRange.deleteMany({ where: { clanId } }),
      this.prisma.coefficientPowerRange.createMany({
        data: ranges.map((r) => ({ clanId, ...r })),
      }),
    ]);

    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'admin.coefficients.power.updated',
        entityType: 'coefficient_power_range',
        after: ranges,
      },
    });

    return this.getCoefficients(clanId);
  }

  async updateLevelCoefficients(clanId: string, ranges: Array<{ fromLevel: number; toLevel: number; coefficient: number }>, actorId: string) {
    this.validateRanges(ranges.map((r) => ({ from: r.fromLevel, to: r.toLevel })));

    await this.prisma.$transaction([
      this.prisma.coefficientLevelRange.deleteMany({ where: { clanId } }),
      this.prisma.coefficientLevelRange.createMany({
        data: ranges.map((r) => ({ clanId, ...r })),
      }),
    ]);

    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'admin.coefficients.level.updated',
        entityType: 'coefficient_level_range',
        after: ranges,
      },
    });

    return this.getCoefficients(clanId);
  }

  private validateRanges(ranges: Array<{ from: number; to: number }>) {
    for (const range of ranges) {
      if (range.from > range.to) {
        throw new ForbiddenException(`Invalid range: from (${range.from}) cannot be greater than to (${range.to})`);
      }
    }

    const sorted = [...ranges].sort((a, b) => a.from - b.from);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i]!.from <= sorted[i - 1]!.to) {
        throw new ForbiddenException(
          `Overlapping ranges detected: [${sorted[i - 1]!.from}-${sorted[i - 1]!.to}] overlaps with [${sorted[i]!.from}-${sorted[i]!.to}]`,
        );
      }
    }
  }

  async getDashboardStats() {
    const [userCount, clanCount, auctionCount, activityCount, totalDkp] = await Promise.all([
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.clan.count({ where: { isActive: true } }),
      this.prisma.auction.count(),
      this.prisma.activity.count(),
      this.prisma.dkpWallet.aggregate({ _sum: { balance: true } }),
    ]);

    return {
      users: userCount,
      clans: clanCount,
      auctions: auctionCount,
      activities: activityCount,
      totalDkpInCirculation: totalDkp._sum.balance || 0,
    };
  }
}
