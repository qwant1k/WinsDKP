import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SocketGateway } from '../../common/socket/socket.gateway';
import { RandomizerStatus } from '@prisma/client';
import * as crypto from 'crypto';

@Injectable()
export class RandomizerService {
  private readonly logger = new Logger(RandomizerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly socket: SocketGateway,
  ) {}

  async findAll(clanId: string) {
    return this.prisma.randomizerSession.findMany({
      where: { clanId },
      include: {
        result: true,
        entries: { include: { user: { include: { profile: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    }).then(async (sessions) => {
      const itemIds = [...new Set(sessions.map((s) => s.warehouseItemId))];
      const items = await this.prisma.warehouseItem.findMany({ where: { id: { in: itemIds } } });
      const itemMap = new Map(items.map((i) => [i.id, i]));
      return sessions.map((s) => {
        const warehouseItem = itemMap.get(s.warehouseItemId) || null;
        const input = s.inputData as any;
        return {
          ...s,
          warehouseItem: warehouseItem || (input?.itemName ? { id: s.warehouseItemId, name: input.itemName, rarity: input.itemRarity } : null),
        };
      });
    });
  }

  async findById(id: string) {
    const session = await this.prisma.randomizerSession.findUnique({
      where: { id },
      include: {
        entries: { include: { user: { include: { profile: true } } } },
        result: true,
      },
    });
    if (!session) throw new NotFoundException('Randomizer session not found');
    const warehouseItem = await this.prisma.warehouseItem.findUnique({ where: { id: session.warehouseItemId } });
    const input = session.inputData as any;
    return {
      ...session,
      warehouseItem: warehouseItem || (input?.itemName ? { id: session.warehouseItemId, name: input.itemName, rarity: input.itemRarity } : null),
    };
  }

  async createSession(params: {
    clanId: string;
    warehouseItemId: string;
    quantity?: number;
    createdBy: string;
    idempotencyKey?: string;
    participantIds?: string[];
  }) {
    if (params.idempotencyKey) {
      const existing = await this.prisma.randomizerSession.findUnique({
        where: { idempotencyKey: params.idempotencyKey },
      });
      if (existing) return existing;
    }

    const item = await this.prisma.warehouseItem.findUnique({
      where: { id: params.warehouseItemId },
    });
    if (!item) throw new NotFoundException('Warehouse item not found');
    const drawQuantity = params.quantity || 1;
    if (item.quantity < drawQuantity) throw new BadRequestException('Insufficient item quantity in warehouse');

    const members = await this.prisma.clanMembership.findMany({
      where: { clanId: params.clanId, isActive: true },
      include: { user: { include: { profile: true } } },
    });

    const requestedParticipantIds = Array.isArray(params.participantIds) ? [...new Set(params.participantIds.filter(Boolean))] : [];
    const memberByUserId = new Map(members.map((m) => [m.userId, m]));
    if (requestedParticipantIds.length > 0) {
      const invalidParticipantId = requestedParticipantIds.find((id) => !memberByUserId.has(id));
      if (invalidParticipantId) {
        throw new BadRequestException('Some selected participants are not active clan members');
      }
    }

    const selectedMembers = requestedParticipantIds.length > 0
      ? requestedParticipantIds.map((id) => memberByUserId.get(id)!).filter(Boolean)
      : members;

    if (selectedMembers.length < 1) throw new BadRequestException('Need at least 1 member');

    const seed = crypto.randomBytes(32).toString('hex');
    const seedHash = crypto.createHash('sha256').update(seed).digest('hex');

    const allBm = selectedMembers.map((m) => m.user.profile?.bm ?? 0);
    const allLevels = selectedMembers.map((m) => m.user.profile?.level ?? 1);
    const maxBm = Math.max(...allBm, 1);
    const maxLevel = Math.max(...allLevels, 1);
    const minBm = Math.min(...allBm);
    const minLevel = Math.min(...allLevels);

    const entriesData = selectedMembers.map((m) => {
      const bm = m.user.profile?.bm ?? 0;
      const level = m.user.profile?.level ?? 1;

      const bmNorm = maxBm > minBm ? (maxBm - bm) / (maxBm - minBm) : 0.5;
      const levelNorm = maxLevel > minLevel ? (maxLevel - level) / (maxLevel - minLevel) : 0.5;

      const bonus = 0.03 + ((bmNorm + levelNorm) / 2) * (0.05 - 0.03);
      const weight = 1 + bonus;

      return {
        userId: m.userId,
        weight,
        bonus,
      };
    });

    const inputData = {
      members: entriesData.map((e) => ({ userId: e.userId, weight: e.weight, bonus: e.bonus })),
      itemId: params.warehouseItemId,
      itemName: item.name,
      itemRarity: item.rarity,
      drawQuantity,
      selectedUserIds: selectedMembers.map((m) => m.userId),
      maxBm,
      maxLevel,
      minBm,
      minLevel,
      timestamp: new Date().toISOString(),
    };

    const session = await this.prisma.randomizerSession.create({
      data: {
        clanId: params.clanId,
        warehouseItemId: params.warehouseItemId,
        status: RandomizerStatus.PENDING,
        seed,
        seedHash,
        inputData,
        createdBy: params.createdBy,
        idempotencyKey: params.idempotencyKey,
        entries: {
          create: entriesData,
        },
      },
      include: {
        entries: { include: { user: { include: { profile: true } } } },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: params.createdBy,
        action: 'randomizer.session.created',
        entityType: 'randomizer_session',
        entityId: session.id,
        after: { sessionId: session.id, seedHash, participantCount: selectedMembers.length },
      },
    });

    return session;
  }

  async runDraw(sessionId: string, actorId: string) {
    const session = await this.prisma.randomizerSession.findUnique({
      where: { id: sessionId },
      include: { entries: { include: { user: { include: { profile: true } } } } },
    });

    if (!session) throw new NotFoundException('Session not found');
    if (session.status !== RandomizerStatus.PENDING) {
      throw new BadRequestException('Session has already been executed');
    }

    await this.prisma.randomizerSession.update({
      where: { id: sessionId },
      data: { status: RandomizerStatus.IN_PROGRESS },
    });

    this.socket.emitToClan(session.clanId, 'randomizer.started', {
      sessionId,
      participants: session.entries.map((e) => ({
        userId: e.userId,
        nickname: e.user.profile?.nickname,
        weight: Number(e.weight),
      })),
    });

    const totalWeight = session.entries.reduce((sum, e) => sum + Number(e.weight), 0);

    const seedBuffer = Buffer.from(session.seed, 'hex');
    const hash = crypto.createHash('sha256').update(seedBuffer).digest();
    const rollValue = hash.readUInt32BE(0) / 0xFFFFFFFF;

    let cumulative = 0;
    let winner = session.entries[0]!;

    for (const entry of session.entries) {
      cumulative += Number(entry.weight) / totalWeight;
      if (rollValue <= cumulative) {
        winner = entry;
        break;
      }
    }

    const proof = {
      seed: session.seed,
      seedHash: session.seedHash,
      rollValue,
      totalWeight,
      entries: session.entries.map((e) => ({
        userId: e.userId,
        weight: Number(e.weight),
        normalizedWeight: Number(e.weight) / totalWeight,
      })),
      winnerId: winner.userId,
      algorithmVersion: session.algorithmVersion,
      timestamp: new Date().toISOString(),
    };

    await this.prisma.$transaction(async (tx) => {
      await tx.randomizerResult.create({
        data: {
          sessionId,
          winnerId: winner.userId,
          rollValue,
          proof,
        },
      });

      await tx.randomizerSession.update({
        where: { id: sessionId },
        data: { status: RandomizerStatus.COMPLETED },
      });

      await tx.warehouseItemMovement.create({
        data: {
          itemId: session.warehouseItemId,
          type: 'OUTGOING_RANDOMIZER',
          quantity: (session.inputData as any)?.drawQuantity || 1,
          reason: `Won by randomizer draw`,
          performedBy: actorId,
          referenceType: 'randomizer_session',
          referenceId: sessionId,
        },
      });

      const updatedItem = await tx.warehouseItem.update({
        where: { id: session.warehouseItemId },
        data: { quantity: { decrement: (session.inputData as any)?.drawQuantity || 1 } },
      });

      if (updatedItem.quantity <= 0) {
        await tx.warehouseItem.delete({ where: { id: session.warehouseItemId } });
      }
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'randomizer.draw.completed',
        entityType: 'randomizer_session',
        entityId: sessionId,
        after: proof,
      },
    });

    this.socket.emitToClan(session.clanId, 'randomizer.finished', {
      sessionId,
      winnerId: winner.userId,
      winnerNickname: winner.user.profile?.nickname,
      rollValue,
    });

    this.logger.log(`Randomizer ${sessionId}: winner is ${winner.userId}`);
    return { session, result: proof };
  }
}

