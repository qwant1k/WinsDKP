import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { DkpService } from '../dkp/dkp.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SocketGateway } from '../../common/socket/socket.gateway';
import { PaginationDto, PaginatedResponse } from '../../common/dto/pagination.dto';
import { ActivityStatus, ActivityType, DkpTransactionType, NotificationType } from '@prisma/client';

@Injectable()
export class ActivitiesService {
  private readonly logger = new Logger(ActivitiesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dkpService: DkpService,
    private readonly notifications: NotificationsService,
    private readonly socket: SocketGateway,
  ) {}

  async findAll(clanId: string, query: PaginationDto) {
    const where = {
      clanId,
      deletedAt: null,
      ...(query.search ? { title: { contains: query.search, mode: 'insensitive' as const } } : {}),
    };
    const [activities, total] = await Promise.all([
      this.prisma.activity.findMany({
        where,
        include: { _count: { select: { participants: true } } },
        skip: query.skip,
        take: query.limit,
        orderBy: { createdAt: query.sortOrder || 'desc' },
      }),
      this.prisma.activity.count({ where }),
    ]);
    return new PaginatedResponse(activities, total, query.page, query.limit);
  }

  async findById(id: string) {
    const activity = await this.prisma.activity.findUnique({
      where: { id },
      include: {
        participants: {
          include: { user: { include: { profile: true } } },
        },
        logs: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!activity) throw new NotFoundException('Activity not found');
    return activity;
  }

  async create(data: {
    clanId: string;
    type: ActivityType;
    title: string;
    description?: string;
    baseDkp: number;
    startAt?: Date;
    endAt?: Date;
    createdBy: string;
  }) {
    const activity = await this.prisma.activity.create({
      data: {
        ...data,
        status: ActivityStatus.DRAFT,
      },
    });

    await this.prisma.activityLog.create({
      data: {
        activityId: activity.id,
        action: 'activity.created',
        details: { createdBy: data.createdBy },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: data.createdBy,
        action: 'activity.created',
        entityType: 'activity',
        entityId: activity.id,
        after: activity,
      },
    });

    return activity;
  }

  async updateActivity(id: string, data: { baseDkp?: number; title?: string; description?: string }, actorId: string) {
    const activity = await this.prisma.activity.findUnique({ where: { id } });
    if (!activity) throw new NotFoundException('Activity not found');
    if (activity.status === ActivityStatus.COMPLETED || activity.status === ActivityStatus.CANCELLED) {
      throw new BadRequestException('Cannot edit completed or cancelled activity');
    }

    const updated = await this.prisma.activity.update({
      where: { id },
      data: {
        ...(data.baseDkp !== undefined ? { baseDkp: data.baseDkp } : {}),
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'activity.updated',
        entityType: 'activity',
        entityId: id,
        before: activity,
        after: updated,
      },
    });

    return updated;
  }

  async updateStatus(id: string, status: ActivityStatus, actorId: string) {
    const activity = await this.prisma.activity.findUnique({ where: { id } });
    if (!activity) throw new NotFoundException('Activity not found');

    const validTransitions: Record<string, string[]> = {
      DRAFT: ['OPEN', 'CANCELLED'],
      OPEN: ['IN_PROGRESS', 'CANCELLED'],
      IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
    };

    const allowed = validTransitions[activity.status];
    if (!allowed || !allowed.includes(status)) {
      throw new BadRequestException(`Cannot transition from ${activity.status} to ${status}`);
    }

    const before = { ...activity };
    const updated = await this.prisma.activity.update({
      where: { id },
      data: {
        status,
        ...(status === ActivityStatus.IN_PROGRESS ? { startAt: new Date() } : {}),
        ...(status === ActivityStatus.COMPLETED ? { endAt: new Date() } : {}),
      },
    });

    await this.prisma.activityLog.create({
      data: {
        activityId: id,
        action: `activity.status.${status.toLowerCase()}`,
        details: { actorId, previousStatus: activity.status },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'activity.status_changed',
        entityType: 'activity',
        entityId: id,
        before,
        after: updated,
      },
    });

    return updated;
  }

  async joinActivity(activityId: string, userId: string) {
    const activity = await this.prisma.activity.findUnique({ where: { id: activityId } });
    if (!activity) throw new NotFoundException('Activity not found');
    if (activity.status !== ActivityStatus.OPEN && activity.status !== ActivityStatus.IN_PROGRESS) {
      throw new BadRequestException('Activity is not accepting participants');
    }

    const existing = await this.prisma.activityParticipant.findUnique({
      where: { activityId_userId: { activityId, userId } },
    });
    if (existing) throw new BadRequestException('Already joined this activity');

    const participant = await this.prisma.activityParticipant.create({
      data: { activityId, userId },
      include: { user: { include: { profile: true } } },
    });

    // Real-time: notify clan about new participant
    this.socket.emitToClan(activity.clanId, 'activity.participant_joined', {
      activityId,
      participant: {
        id: participant.id,
        userId,
        nickname: participant.user?.profile?.nickname,
        joinedAt: participant.joinedAt,
      },
    });

    return participant;
  }

  async leaveActivity(activityId: string, userId: string) {
    const participant = await this.prisma.activityParticipant.findUnique({
      where: { activityId_userId: { activityId, userId } },
    });
    if (!participant) throw new NotFoundException('Not a participant');

    return this.prisma.activityParticipant.delete({
      where: { id: participant.id },
    });
  }

  async completeAndReward(activityId: string, actorId: string) {
    const activity = await this.prisma.activity.findUnique({
      where: { id: activityId },
      include: {
        participants: {
          include: { user: { include: { profile: true } } },
        },
      },
    });
    if (!activity) throw new NotFoundException('Activity not found');
    if (activity.status !== ActivityStatus.IN_PROGRESS) {
      throw new BadRequestException('Activity must be in progress to complete');
    }

    const [powerRanges, levelRanges] = await Promise.all([
      this.prisma.coefficientPowerRange.findMany({
        where: { clanId: activity.clanId },
        orderBy: { fromPower: 'asc' },
      }),
      this.prisma.coefficientLevelRange.findMany({
        where: { clanId: activity.clanId },
        orderBy: { fromLevel: 'asc' },
      }),
    ]);

    const baseDkp = Number(activity.baseDkp);

    for (const participant of activity.participants) {
      const profile = participant.user.profile;
      if (!profile) continue;

      const powerCoef = this.findCoefficient(powerRanges, profile.bm, 'power');
      const levelCoef = this.findCoefficient(levelRanges, profile.level, 'level');

      const dkpEarned = Math.round(((levelCoef * powerCoef) + baseDkp) * 100) / 100;

      await this.dkpService.creditDkp({
        userId: participant.userId,
        amount: dkpEarned,
        type: DkpTransactionType.ACTIVITY_REWARD,
        description: `Activity reward: ${activity.title}`,
        referenceType: 'activity',
        referenceId: activity.id,
        idempotencyKey: `activity-reward-${activity.id}-${participant.userId}`,
        actorId,
      });

      await this.prisma.activityParticipant.update({
        where: { id: participant.id },
        data: { dkpEarned },
      });

      // Notify user about DKP reward
      await this.notifications.create({
        userId: participant.userId,
        type: NotificationType.DKP_RECEIVED,
        title: `Начислено ${dkpEarned} DKP`,
        body: `За участие в активности «${activity.title}»`,
        data: { activityId: activity.id, amount: dkpEarned },
      });
    }

    const updated = await this.prisma.activity.update({
      where: { id: activityId },
      data: { status: ActivityStatus.COMPLETED, endAt: new Date() },
    });

    await this.prisma.activityLog.create({
      data: {
        activityId,
        action: 'activity.completed_and_rewarded',
        details: {
          actorId,
          participantCount: activity.participants.length,
          baseDkp,
        },
      },
    });

    this.logger.log(`Activity ${activityId} completed. ${activity.participants.length} participants rewarded.`);
    return updated;
  }

  private findCoefficient(
    ranges: Array<{ fromPower?: number; toPower?: number; fromLevel?: number; toLevel?: number; coefficient: unknown }>,
    value: number,
    type: 'power' | 'level',
  ): number {
    for (const range of ranges) {
      const from = type === 'power' ? (range as any).fromPower : (range as any).fromLevel;
      const to = type === 'power' ? (range as any).toPower : (range as any).toLevel;
      if (value >= from && value <= to) {
        return Number(range.coefficient);
      }
    }
    return 0;
  }
}
