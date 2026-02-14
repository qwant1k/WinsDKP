import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { DkpService } from '../dkp/dkp.service';
import { SocketGateway } from '../../common/socket/socket.gateway';
import { PaginationDto, PaginatedResponse } from '../../common/dto/pagination.dto';
import { AuctionStatus, LotStatus, DkpTransactionType, Prisma } from '@prisma/client';

@Injectable()
export class AuctionsService {
  private readonly logger = new Logger(AuctionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dkpService: DkpService,
    private readonly socket: SocketGateway,
  ) {}

  async findAll(clanId: string, query: PaginationDto) {
    const where = {
      clanId,
      deletedAt: null,
      ...(query.search ? { title: { contains: query.search, mode: 'insensitive' as const } } : {}),
    };
    const [auctions, total] = await Promise.all([
      this.prisma.auction.findMany({
        where,
        include: {
          _count: { select: { lots: true, participants: true } },
        },
        skip: query.skip,
        take: query.limit,
        orderBy: { createdAt: query.sortOrder || 'desc' },
      }),
      this.prisma.auction.count({ where }),
    ]);
    return new PaginatedResponse(auctions, total, query.page, query.limit);
  }

  async findById(id: string) {
    const auction = await this.prisma.auction.findUnique({
      where: { id },
      include: {
        lots: {
          where: { deletedAt: null },
          include: {
            warehouseItem: true,
            bids: {
              orderBy: { createdAt: 'desc' },
              take: 50,
              include: { user: { include: { profile: true } } },
            },
            result: { include: { winner: { include: { profile: true } } } },
          },
          orderBy: { sortOrder: 'asc' },
        },
        participants: {
          include: { user: { include: { profile: true } } },
        },
        chatMessages: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 100,
          include: { user: { include: { profile: true } } },
        },
        systemEvents: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    });
    if (!auction) throw new NotFoundException('Auction not found');
    return auction;
  }

  async create(data: {
    clanId: string;
    title: string;
    description?: string;
    startAt?: Date;
    endAt?: Date;
    antiSniperEnabled?: boolean;
    antiSniperSeconds?: number;
    antiSniperExtendSec?: number;
    createdBy: string;
  }) {
    const auction = await this.prisma.auction.create({
      data: {
        clanId: data.clanId,
        title: data.title,
        description: data.description,
        startAt: data.startAt,
        endAt: data.endAt,
        antiSniperEnabled: data.antiSniperEnabled ?? true,
        antiSniperSeconds: data.antiSniperSeconds ?? 20,
        antiSniperExtendSec: data.antiSniperExtendSec ?? 30,
        createdBy: data.createdBy,
        status: AuctionStatus.DRAFT,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: data.createdBy,
        action: 'auction.created',
        entityType: 'auction',
        entityId: auction.id,
        after: auction,
      },
    });

    return auction;
  }

  async addLot(auctionId: string, data: {
    warehouseItemId: string;
    quantity: number;
    startPrice: number;
    minStep: number;
    sortOrder?: number;
  }) {
    const auction = await this.prisma.auction.findUnique({ where: { id: auctionId } });
    if (!auction) throw new NotFoundException('Auction not found');
    if (auction.status !== AuctionStatus.DRAFT) {
      throw new BadRequestException('Can only add lots to draft auctions');
    }

    const item = await this.prisma.warehouseItem.findUnique({ where: { id: data.warehouseItemId } });
    if (!item) throw new NotFoundException('Warehouse item not found');
    if (item.quantity < data.quantity) throw new BadRequestException('Insufficient item quantity');

    return this.prisma.lot.create({
      data: {
        auctionId,
        warehouseItemId: data.warehouseItemId,
        quantity: data.quantity,
        startPrice: data.startPrice,
        minStep: data.minStep,
        sortOrder: data.sortOrder ?? 0,
        status: LotStatus.PENDING,
      },
    });
  }

  async startAuction(auctionId: string, actorId: string) {
    const auction = await this.prisma.auction.findUnique({
      where: { id: auctionId },
      include: { lots: true },
    });
    if (!auction) throw new NotFoundException('Auction not found');
    if (auction.status !== AuctionStatus.DRAFT) throw new BadRequestException('Auction is not in draft status');
    if (auction.lots.length === 0) throw new BadRequestException('Auction must have at least one lot');

    const firstLot = auction.lots.sort((a, b) => a.sortOrder - b.sortOrder)[0]!;
    const lotEndTime = new Date(Date.now() + 3600000);

    await this.prisma.$transaction([
      this.prisma.auction.update({
        where: { id: auctionId },
        data: { status: AuctionStatus.ACTIVE, startAt: new Date() },
      }),
      this.prisma.lot.update({
        where: { id: firstLot.id },
        data: { status: LotStatus.ACTIVE, endsAt: lotEndTime },
      }),
    ]);

    await this.prisma.auctionSystemEvent.create({
      data: {
        auctionId,
        event: 'auction.started',
        data: { startedBy: actorId, firstLotId: firstLot.id },
      },
    });

    this.socket.emitToClan(auction.clanId, 'auction.updated', {
      auctionId,
      status: AuctionStatus.ACTIVE,
    });

    return this.findById(auctionId);
  }

  async joinAuction(auctionId: string, userId: string) {
    const auction = await this.prisma.auction.findUnique({ where: { id: auctionId } });
    if (!auction) throw new NotFoundException('Auction not found');
    if (auction.status !== AuctionStatus.ACTIVE) throw new BadRequestException('Auction is not active');

    const membership = await this.prisma.clanMembership.findUnique({
      where: { userId_clanId: { userId, clanId: auction.clanId } },
    });
    if (!membership || !membership.isActive) throw new ForbiddenException('Not a clan member');

    const existing = await this.prisma.auctionParticipant.findUnique({
      where: { auctionId_userId: { auctionId, userId } },
    });
    if (existing) return existing;

    return this.prisma.auctionParticipant.create({
      data: { auctionId, userId },
    });
  }

  async placeBid(lotId: string, userId: string, amount: number, idempotencyKey?: string, maxAutoBid?: number) {
    if (idempotencyKey) {
      const existing = await this.prisma.bid.findUnique({ where: { idempotencyKey } });
      if (existing) return existing;
    }

    return this.prisma.$transaction(async (tx) => {
      const lot = await tx.lot.findUnique({
        where: { id: lotId },
        include: {
          auction: true,
          bids: { orderBy: { amount: 'desc' }, take: 1 },
        },
      });

      if (!lot) throw new NotFoundException('Lot not found');
      if (lot.status !== LotStatus.ACTIVE) throw new BadRequestException('Lot is not active');
      if (lot.endsAt && lot.endsAt < new Date()) throw new BadRequestException('Lot bidding has ended');

      const participant = await tx.auctionParticipant.findUnique({
        where: { auctionId_userId: { auctionId: lot.auctionId, userId } },
      });
      if (!participant) throw new ForbiddenException('Not an auction participant');

      const currentPrice = lot.currentPrice ? Number(lot.currentPrice) : Number(lot.startPrice);
      const minBid = lot.bids.length > 0 ? currentPrice + Number(lot.minStep) : Number(lot.startPrice);

      if (amount < minBid) {
        throw new BadRequestException(`Minimum bid is ${minBid} DKP`);
      }

      const wallet = await tx.dkpWallet.findUnique({ where: { userId } });
      if (!wallet) throw new NotFoundException('Wallet not found');

      const available = Number(wallet.balance) - Number(wallet.onHold);
      if (available < amount) {
        throw new BadRequestException('Insufficient available DKP');
      }

      const hold = await this.dkpService.placeHold({
        userId,
        amount,
        reason: `Auction bid on lot ${lotId}`,
        referenceType: 'lot',
        referenceId: lotId,
      });

      const previousHighBid = lot.bids[0];
      if (previousHighBid && previousHighBid.holdId && previousHighBid.userId !== userId) {
        await this.dkpService.releaseHold(previousHighBid.holdId);

        this.socket.emitToUser(previousHighBid.userId, 'auction.bid.outbid', {
          lotId,
          auctionId: lot.auctionId,
          outbidBy: userId,
          newAmount: amount,
        });
      }

      const bid = await tx.bid.create({
        data: {
          lotId,
          userId,
          amount,
          holdId: hold.id,
          isAutoBid: false,
          maxAutoBid: maxAutoBid || null,
          idempotencyKey,
        },
        include: { user: { include: { profile: true } } },
      });

      await tx.lot.update({
        where: { id: lotId },
        data: {
          currentPrice: amount,
          winnerId: userId,
        },
      });

      let timerExtended = false;
      if (lot.auction.antiSniperEnabled && lot.endsAt) {
        const secondsLeft = (lot.endsAt.getTime() - Date.now()) / 1000;
        if (secondsLeft <= lot.auction.antiSniperSeconds) {
          const newEndsAt = new Date(Date.now() + lot.auction.antiSniperExtendSec * 1000);
          await tx.lot.update({
            where: { id: lotId },
            data: { endsAt: newEndsAt },
          });
          timerExtended = true;

          await tx.auctionSystemEvent.create({
            data: {
              auctionId: lot.auctionId,
              event: 'auction.timer.extended',
              data: { lotId, newEndsAt: newEndsAt.toISOString(), reason: 'anti-sniper' },
            },
          });

          this.socket.emitToAuction(lot.auctionId, 'auction.timer.extended', {
            lotId,
            newEndsAt,
          });
        }
      }

      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: 'auction.bid.created',
          entityType: 'lot',
          entityId: lotId,
          after: { amount, lotId, auctionId: lot.auctionId, itemName: lot.warehouseItem?.name },
        },
      });

      this.socket.emitToAuction(lot.auctionId, 'auction.bid.created', {
        lotId,
        bidId: bid.id,
        userId,
        nickname: bid.user?.profile?.nickname || null,
        amount,
        timerExtended,
      });

      if (maxAutoBid && maxAutoBid > amount) {
        await this.processAutoBids(lotId, tx);
      }

      return bid;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private async processAutoBids(lotId: string, tx: Prisma.TransactionClient) {
    const lot = await tx.lot.findUnique({
      where: { id: lotId },
      include: {
        bids: {
          where: { maxAutoBid: { not: null } },
          orderBy: { maxAutoBid: 'desc' },
        },
      },
    });
    if (!lot || lot.bids.length < 2) return;

    const topBidders = lot.bids.slice(0, 2);
    const highest = topBidders[0]!;
    const secondHighest = topBidders[1]!;

    if (highest.maxAutoBid && secondHighest.maxAutoBid) {
      const autoBidAmount = Math.min(
        Number(secondHighest.maxAutoBid) + Number(lot.minStep),
        Number(highest.maxAutoBid),
      );

      if (autoBidAmount > Number(lot.currentPrice)) {
        await tx.bid.create({
          data: {
            lotId,
            userId: highest.userId,
            amount: autoBidAmount,
            isAutoBid: true,
            maxAutoBid: highest.maxAutoBid,
          },
        });

        await tx.lot.update({
          where: { id: lotId },
          data: { currentPrice: autoBidAmount, winnerId: highest.userId },
        });
      }
    }
  }

  async finishLot(lotId: string, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const lot = await tx.lot.findUnique({
        where: { id: lotId },
        include: {
          auction: true,
          bids: { orderBy: [{ amount: 'desc' }, { createdAt: 'asc' }], take: 1 },
          warehouseItem: true,
        },
      });

      if (!lot) throw new NotFoundException('Lot not found');
      if (lot.status !== LotStatus.ACTIVE) throw new BadRequestException('Lot is not active');

      const winningBid = lot.bids[0];

      if (winningBid) {
        if (winningBid.holdId) {
          await this.dkpService.finalizeHold(winningBid.holdId);
        }

        await tx.lot.update({
          where: { id: lotId },
          data: {
            status: LotStatus.SOLD,
            winnerId: winningBid.userId,
            currentPrice: winningBid.amount,
          },
        });

        await tx.lotResult.create({
          data: {
            lotId,
            winnerId: winningBid.userId,
            finalPrice: winningBid.amount,
            status: 'sold',
          },
        });

        await tx.warehouseItemMovement.create({
          data: {
            itemId: lot.warehouseItemId,
            type: 'OUTGOING_AUCTION',
            quantity: lot.quantity,
            reason: `Sold at auction to winner`,
            performedBy: actorId,
            referenceType: 'lot',
            referenceId: lotId,
          },
        });

        await tx.warehouseItem.update({
          where: { id: lot.warehouseItemId },
          data: { quantity: { decrement: lot.quantity } },
        });

        this.socket.emitToAuction(lot.auctionId, 'auction.lot.finished', {
          lotId,
          status: 'sold',
          winnerId: winningBid.userId,
          finalPrice: Number(winningBid.amount),
        });
      } else {
        await tx.lot.update({
          where: { id: lotId },
          data: { status: LotStatus.UNSOLD },
        });

        await tx.lotResult.create({
          data: { lotId, status: 'unsold' },
        });

        this.socket.emitToAuction(lot.auctionId, 'auction.lot.finished', {
          lotId,
          status: 'unsold',
        });
      }

      const allBidsForLot = await tx.bid.findMany({
        where: { lotId, holdId: { not: null } },
      });

      for (const bid of allBidsForLot) {
        if (bid.holdId && (!winningBid || bid.id !== winningBid.id)) {
          try {
            await this.dkpService.releaseHold(bid.holdId);
          } catch {
            this.logger.warn(`Failed to release hold ${bid.holdId} for bid ${bid.id}`);
          }
        }
      }

      const nextLot = await tx.lot.findFirst({
        where: { auctionId: lot.auctionId, status: LotStatus.PENDING },
        orderBy: { sortOrder: 'asc' },
      });

      if (nextLot) {
        await tx.lot.update({
          where: { id: nextLot.id },
          data: { status: LotStatus.ACTIVE, endsAt: new Date(Date.now() + 3600000) },
        });
      } else {
        await tx.auction.update({
          where: { id: lot.auctionId },
          data: { status: AuctionStatus.COMPLETED, endAt: new Date() },
        });

        this.socket.emitToClan(lot.auction.clanId, 'auction.updated', {
          auctionId: lot.auctionId,
          status: AuctionStatus.COMPLETED,
        });
      }

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'auction.lot.finished',
          entityType: 'lot',
          entityId: lotId,
          after: { status: winningBid ? 'sold' : 'unsold', itemName: lot.warehouseItem?.name, finalPrice: winningBid ? Number(winningBid.amount) : null },
        },
      });

      return { lot, nextLotId: nextLot?.id || null };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async sendChatMessage(auctionId: string, userId: string, message: string) {
    if (message.length > 500) throw new BadRequestException('Message too long');

    const participant = await this.prisma.auctionParticipant.findUnique({
      where: { auctionId_userId: { auctionId, userId } },
    });
    if (!participant) throw new ForbiddenException('Not an auction participant');

    const chatMessage = await this.prisma.auctionChatMessage.create({
      data: { auctionId, userId, message },
      include: { user: { include: { profile: true } } },
    });

    this.socket.emitToAuction(auctionId, 'auction.chat.message', chatMessage);
    return chatMessage;
  }

  async getChatMessages(auctionId: string, query: PaginationDto) {
    const where = { auctionId, deletedAt: null };
    const [messages, total] = await Promise.all([
      this.prisma.auctionChatMessage.findMany({
        where,
        include: { user: { include: { profile: true } } },
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.auctionChatMessage.count({ where }),
    ]);
    return new PaginatedResponse(messages, total, query.page, query.limit);
  }
}
