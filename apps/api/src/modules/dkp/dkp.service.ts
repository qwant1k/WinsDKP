import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PaginationDto, PaginatedResponse } from '../../common/dto/pagination.dto';
import { DkpTransactionType, DkpHoldStatus, Prisma } from '@prisma/client';

@Injectable()
export class DkpService {
  private readonly logger = new Logger(DkpService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getWallet(userId: string) {
    const wallet = await this.prisma.dkpWallet.findUnique({ where: { userId } });
    if (!wallet) throw new NotFoundException('Wallet not found');
    const available = Number(wallet.balance) - Number(wallet.onHold);
    return { ...wallet, available };
  }

  async getTransactions(userId: string, query: PaginationDto) {
    const where = { userId };
    const [transactions, total] = await Promise.all([
      this.prisma.dkpTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.dkpTransaction.count({ where }),
    ]);
    return new PaginatedResponse(transactions, total, query.page, query.limit);
  }

  async creditDkp(params: {
    userId: string;
    amount: number;
    type: DkpTransactionType;
    description?: string;
    referenceType?: string;
    referenceId?: string;
    idempotencyKey?: string;
    actorId?: string;
  }) {
    if (params.amount <= 0) throw new BadRequestException('Amount must be positive');

    if (params.idempotencyKey) {
      const existing = await this.prisma.dkpTransaction.findUnique({
        where: { idempotencyKey: params.idempotencyKey },
      });
      if (existing) return existing;
    }

    return this.prisma.$transaction(async (tx) => {
      const wallet = await tx.dkpWallet.findUnique({ where: { userId: params.userId } });
      if (!wallet) throw new NotFoundException('Wallet not found');

      const balanceBefore = Number(wallet.balance);
      const balanceAfter = balanceBefore + params.amount;

      await tx.dkpWallet.update({
        where: { userId: params.userId },
        data: {
          balance: { increment: params.amount },
          totalEarned: { increment: params.amount },
        },
      });

      const transaction = await tx.dkpTransaction.create({
        data: {
          userId: params.userId,
          type: params.type,
          amount: params.amount,
          balanceBefore,
          balanceAfter,
          description: params.description,
          referenceType: params.referenceType,
          referenceId: params.referenceId,
          idempotencyKey: params.idempotencyKey,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: params.actorId || params.userId,
          action: 'dkp.credit',
          entityType: 'dkp_wallet',
          entityId: wallet.id,
          before: { balance: balanceBefore },
          after: { balance: balanceAfter },
          metadata: { amount: params.amount, type: params.type },
        },
      });

      this.logger.log(`DKP credited: ${params.amount} to user ${params.userId}`);
      return transaction;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async debitDkp(params: {
    userId: string;
    amount: number;
    type: DkpTransactionType;
    description?: string;
    referenceType?: string;
    referenceId?: string;
    idempotencyKey?: string;
    actorId?: string;
    allowNegative?: boolean;
  }) {
    if (params.amount <= 0) throw new BadRequestException('Amount must be positive');

    if (params.idempotencyKey) {
      const existing = await this.prisma.dkpTransaction.findUnique({
        where: { idempotencyKey: params.idempotencyKey },
      });
      if (existing) return existing;
    }

    return this.prisma.$transaction(async (tx) => {
      const wallet = await tx.dkpWallet.findUnique({ where: { userId: params.userId } });
      if (!wallet) throw new NotFoundException('Wallet not found');

      const balanceBefore = Number(wallet.balance);
      const available = balanceBefore - Number(wallet.onHold);

      if (!params.allowNegative && available < params.amount) {
        throw new BadRequestException('Insufficient DKP balance');
      }

      const balanceAfter = balanceBefore - params.amount;

      await tx.dkpWallet.update({
        where: { userId: params.userId },
        data: { balance: { decrement: params.amount } },
      });

      const transaction = await tx.dkpTransaction.create({
        data: {
          userId: params.userId,
          type: params.type,
          amount: -params.amount,
          balanceBefore,
          balanceAfter,
          description: params.description,
          referenceType: params.referenceType,
          referenceId: params.referenceId,
          idempotencyKey: params.idempotencyKey,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: params.actorId || params.userId,
          action: 'dkp.debit',
          entityType: 'dkp_wallet',
          entityId: wallet.id,
          before: { balance: balanceBefore },
          after: { balance: balanceAfter },
          metadata: { amount: params.amount, type: params.type },
        },
      });

      return transaction;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async placeHold(params: {
    userId: string;
    amount: number;
    reason?: string;
    referenceType?: string;
    referenceId?: string;
  }) {
    if (params.amount <= 0) throw new BadRequestException('Hold amount must be positive');

    return this.prisma.$transaction(async (tx) => {
      const wallet = await tx.dkpWallet.findUnique({ where: { userId: params.userId } });
      if (!wallet) throw new NotFoundException('Wallet not found');

      const available = Number(wallet.balance) - Number(wallet.onHold);
      if (available < params.amount) {
        throw new BadRequestException('Insufficient available DKP for hold');
      }

      await tx.dkpWallet.update({
        where: { userId: params.userId },
        data: { onHold: { increment: params.amount } },
      });

      const hold = await tx.dkpHold.create({
        data: {
          userId: params.userId,
          amount: params.amount,
          reason: params.reason,
          referenceType: params.referenceType,
          referenceId: params.referenceId,
          status: DkpHoldStatus.ACTIVE,
        },
      });

      await tx.dkpTransaction.create({
        data: {
          userId: params.userId,
          type: DkpTransactionType.HOLD_PLACE,
          amount: -params.amount,
          balanceBefore: Number(wallet.balance),
          balanceAfter: Number(wallet.balance),
          description: `Hold placed: ${params.reason || 'auction bid'}`,
          referenceType: 'dkp_hold',
          referenceId: hold.id,
        },
      });

      return hold;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async finalizeHold(holdId: string) {
    return this.prisma.$transaction(async (tx) => {
      const hold = await tx.dkpHold.findUnique({ where: { id: holdId } });
      if (!hold) throw new NotFoundException('Hold not found');
      if (hold.status !== DkpHoldStatus.ACTIVE) throw new BadRequestException('Hold is not active');

      await tx.dkpHold.update({
        where: { id: holdId },
        data: { status: DkpHoldStatus.FINALIZED, finalizedAt: new Date() },
      });

      const wallet = await tx.dkpWallet.findUnique({ where: { userId: hold.userId } });
      if (!wallet) throw new NotFoundException('Wallet not found');

      const holdAmount = Number(hold.amount);

      await tx.dkpWallet.update({
        where: { userId: hold.userId },
        data: {
          balance: { decrement: holdAmount },
          onHold: { decrement: holdAmount },
        },
      });

      await tx.dkpTransaction.create({
        data: {
          userId: hold.userId,
          type: DkpTransactionType.HOLD_FINALIZE,
          amount: -holdAmount,
          balanceBefore: Number(wallet.balance),
          balanceAfter: Number(wallet.balance) - holdAmount,
          description: `Hold finalized: ${hold.reason || ''}`,
          referenceType: 'dkp_hold',
          referenceId: hold.id,
        },
      });

      return hold;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async releaseHold(holdId: string) {
    return this.prisma.$transaction(async (tx) => {
      const hold = await tx.dkpHold.findUnique({ where: { id: holdId } });
      if (!hold) throw new NotFoundException('Hold not found');
      if (hold.status !== DkpHoldStatus.ACTIVE) throw new BadRequestException('Hold is not active');

      await tx.dkpHold.update({
        where: { id: holdId },
        data: { status: DkpHoldStatus.RELEASED, releasedAt: new Date() },
      });

      await tx.dkpWallet.update({
        where: { userId: hold.userId },
        data: { onHold: { decrement: Number(hold.amount) } },
      });

      const wallet = await tx.dkpWallet.findUnique({ where: { userId: hold.userId } });

      await tx.dkpTransaction.create({
        data: {
          userId: hold.userId,
          type: DkpTransactionType.HOLD_RELEASE,
          amount: Number(hold.amount),
          balanceBefore: wallet ? Number(wallet.balance) : 0,
          balanceAfter: wallet ? Number(wallet.balance) : 0,
          description: `Hold released: ${hold.reason || ''}`,
          referenceType: 'dkp_hold',
          referenceId: hold.id,
        },
      });

      return hold;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async issuePenalty(params: {
    userId: string;
    amount: number;
    reason: string;
    issuedBy: string;
    clanId: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      await this.debitDkp({
        userId: params.userId,
        amount: params.amount,
        type: DkpTransactionType.PENALTY,
        description: `Penalty: ${params.reason}`,
        actorId: params.issuedBy,
        allowNegative: true,
      });

      const penalty = await tx.penalty.create({
        data: {
          userId: params.userId,
          amount: params.amount,
          reason: params.reason,
          issuedBy: params.issuedBy,
          clanId: params.clanId,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: params.issuedBy,
          action: 'dkp.penalty.issued',
          entityType: 'penalty',
          entityId: penalty.id,
          after: penalty,
        },
      });

      return penalty;
    });
  }

  async adminAdjust(params: {
    userId: string;
    amount: number;
    description: string;
    actorId: string;
    idempotencyKey?: string;
  }) {
    if (params.amount > 0) {
      return this.creditDkp({
        userId: params.userId,
        amount: params.amount,
        type: DkpTransactionType.ADMIN_ADJUST,
        description: params.description,
        actorId: params.actorId,
        idempotencyKey: params.idempotencyKey,
      });
    } else {
      return this.debitDkp({
        userId: params.userId,
        amount: Math.abs(params.amount),
        type: DkpTransactionType.ADMIN_ADJUST,
        description: params.description,
        actorId: params.actorId,
        allowNegative: true,
        idempotencyKey: params.idempotencyKey,
      });
    }
  }
}
