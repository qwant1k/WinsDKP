import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { DkpService } from '../dkp/dkp.service';
import { SocketGateway } from '../../common/socket/socket.gateway';
import { PaginationDto, PaginatedResponse } from '../../common/dto/pagination.dto';
import { AuctionStatus, LotStatus, Prisma } from '@prisma/client';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class AuctionsService {
  private readonly logger = new Logger(AuctionsService.name);
  private static readonly DEFAULT_LOT_DURATION_MINUTES = 24 * 60;
  private static readonly DEFAULT_LOT_EXTENSION_MINUTES = 24 * 60;
  private static readonly DEFAULT_LOT_MAX_NO_BID_EXTENSIONS = 2;
  private static readonly DEFAULT_LOT_ANTI_SNIPER_WINDOW_MS = 60 * 60 * 1000;
  private static readonly DEFAULT_LOT_ANTI_SNIPER_EXTEND_MS = 10 * 60 * 1000;

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

  @Cron(CronExpression.EVERY_10_SECONDS)
  async autoFinishExpiredLots() {
    const expiredLots = await this.prisma.lot.findMany({
      where: {
        status: LotStatus.ACTIVE,
        deletedAt: null,
        endsAt: { lte: new Date() },
      },
      include: { auction: { select: { createdBy: true } } },
      take: 50,
      orderBy: { endsAt: 'asc' },
    });

    for (const lot of expiredLots) {
      try {
        await this.finishLot(lot.id, lot.auction.createdBy);
      } catch (error) {
        this.logger.warn(`Failed to auto-finish lot ${lot.id}: ${(error as Error).message}`);
      }
    }
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
          orderBy: { createdAt: 'asc' },
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

  // ─── Add single lot ──────────────────────────────────────────────────────────
  async addLot(auctionId: string, data: {
    warehouseItemId: string;
    quantity: number;
    startPrice: number;
    minStep: number;
    sortOrder?: number;
    lotDurationMinutes?: number | null;
  }) {
    const auction = await this.prisma.auction.findUnique({ where: { id: auctionId } });
    if (!auction) throw new NotFoundException('Auction not found');
    if (auction.status !== AuctionStatus.DRAFT) {
      throw new BadRequestException('Can only add lots to draft auctions');
    }

    const item = await this.prisma.warehouseItem.findUnique({ where: { id: data.warehouseItemId } });
    if (!item) throw new NotFoundException('Warehouse item not found');
    if (item.quantity < data.quantity) throw new BadRequestException('Insufficient item quantity');

    const lot = await this.prisma.lot.create({
      data: {
        auctionId,
        warehouseItemId: data.warehouseItemId,
        itemName: item.name,
        itemRarity: item.rarity,
        quantity: data.quantity,
        startPrice: data.startPrice,
        minStep: data.minStep,
        lotDurationMinutes: this.normalizeLotDurationMinutes(data.lotDurationMinutes),
        noBidExtensions: 0,
        sortOrder: data.sortOrder ?? 0,
        status: LotStatus.PENDING,
      },
      include: { warehouseItem: true },
    });

    this.socket.emitToClan(auction.clanId, 'auction.lot.added', { auctionId, lot });
    return lot;
  }

  // ─── Add ALL warehouse items as lots (bulk) ──────────────────────────────────
  async addAllWarehouseItems(auctionId: string, clanId: string, data: {
    defaultStartPrice: number;
    defaultMinStep: number;
    defaultLotDurationMinutes?: number | null;
  }) {
    const auction = await this.prisma.auction.findUnique({ where: { id: auctionId } });
    if (!auction) throw new NotFoundException('Auction not found');
    if (auction.status !== AuctionStatus.DRAFT) {
      throw new BadRequestException('Can only add lots to draft auctions');
    }
    if (auction.clanId !== clanId) throw new ForbiddenException('Auction does not belong to this clan');

    const items = await this.prisma.warehouseItem.findMany({
      where: { clanId, quantity: { gt: 0 }, deletedAt: null },
    });
    if (items.length === 0) throw new BadRequestException('No items in warehouse');

    // Get existing lots to avoid duplicates
    const existingLots = await this.prisma.lot.findMany({
      where: { auctionId, deletedAt: null },
      select: { warehouseItemId: true },
    });
    const existingItemIds = new Set(existingLots.map((l) => l.warehouseItemId).filter((id): id is string => !!id));
    const newItems = items.filter(i => !existingItemIds.has(i.id));

    if (newItems.length === 0) throw new BadRequestException('All warehouse items already added as lots');

    const lots = await this.prisma.$transaction(
      newItems.map((item, idx) =>
        this.prisma.lot.create({
          data: {
            auctionId,
            warehouseItemId: item.id,
            itemName: item.name,
            itemRarity: item.rarity,
            quantity: item.quantity,
            startPrice: data.defaultStartPrice,
            minStep: data.defaultMinStep,
            lotDurationMinutes: this.normalizeLotDurationMinutes(data.defaultLotDurationMinutes),
            noBidExtensions: 0,
            sortOrder: existingLots.length + idx,
            status: LotStatus.PENDING,
          },
          include: { warehouseItem: true },
        }),
      ),
    );

    this.socket.emitToClan(clanId, 'auction.lots.bulk_added', { auctionId, count: lots.length, lots });
    return { added: lots.length, lots };
  }

  // ─── Delete lot (only before auction starts / PENDING status) ───────────────
  async deleteLot(lotId: string, actorId: string) {
    const lot = await this.prisma.lot.findUnique({
      where: { id: lotId },
      include: { auction: true },
    });
    if (!lot) throw new NotFoundException('Lot not found');
    if (lot.status !== LotStatus.PENDING) {
      throw new BadRequestException('Can only delete pending lots');
    }
    if (lot.auction.status !== AuctionStatus.DRAFT) {
      throw new BadRequestException('Can only delete lots from draft auctions');
    }

    await this.prisma.lot.update({
      where: { id: lotId },
      data: { deletedAt: new Date() },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'auction.lot.deleted',
        entityType: 'lot',
        entityId: lotId,
        after: { deletedBy: actorId },
      },
    });

    this.socket.emitToClan(lot.auction.clanId, 'auction.lot.deleted', {
      auctionId: lot.auctionId,
      lotId,
    });

    return { success: true };
  }

  // ─── Start auction — ALL lots become ACTIVE simultaneously ───────────────────
  async startAuction(auctionId: string, actorId: string) {
    const auction = await this.prisma.auction.findUnique({
      where: { id: auctionId },
      include: { lots: { where: { deletedAt: null } } },
    });
    if (!auction) throw new NotFoundException('Auction not found');
    if (auction.status !== AuctionStatus.DRAFT) throw new BadRequestException('Auction is not in draft status');
    if (auction.lots.length === 0) throw new BadRequestException('Auction must have at least one lot');

    const now = new Date();
    const updates: Prisma.PrismaPromise<unknown>[] = [
      this.prisma.auction.update({
        where: { id: auctionId },
        data: { status: AuctionStatus.ACTIVE, startAt: now },
      }),
    ];

    for (const lot of auction.lots) {
      const durationMinutes = lot.lotDurationMinutes ?? AuctionsService.DEFAULT_LOT_DURATION_MINUTES;
      updates.push(
        this.prisma.lot.update({
          where: { id: lot.id },
          data: {
            status: LotStatus.ACTIVE,
            endsAt: new Date(now.getTime() + durationMinutes * 60_000),
            noBidExtensions: 0,
          },
        }),
      );
    }

    await this.prisma.$transaction(updates);

    await this.prisma.auctionSystemEvent.create({
      data: {
        auctionId,
        event: 'auction.started',
        data: { startedBy: actorId, totalLots: auction.lots.length, mode: 'parallel' },
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
          warehouseItem: true,
        },
      });

      if (!lot) throw new NotFoundException('Lot not found');
      if (lot.status !== LotStatus.ACTIVE) throw new BadRequestException('Lot is not active');
      if (lot.endsAt && lot.endsAt < new Date()) throw new BadRequestException('Lot bidding has ended');
      const lotItemName = lot.warehouseItem?.name || lot.itemName || 'Предмет';

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
          itemName: lotItemName,
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
        data: { currentPrice: amount, winnerId: userId },
      });

      let timerExtended = false;
      if (lot.lotDurationMinutes == null && lot.endsAt) {
        const msLeft = lot.endsAt.getTime() - Date.now();
        if (msLeft <= AuctionsService.DEFAULT_LOT_ANTI_SNIPER_WINDOW_MS) {
          const newEndsAt = new Date(lot.endsAt.getTime() + AuctionsService.DEFAULT_LOT_ANTI_SNIPER_EXTEND_MS);
          await tx.lot.update({
            where: { id: lotId },
            data: { endsAt: newEndsAt },
          });
          timerExtended = true;

          await tx.auctionSystemEvent.create({
            data: {
              auctionId: lot.auctionId,
              event: 'auction.timer.extended',
              data: { lotId, newEndsAt: newEndsAt.toISOString(), reason: 'last-hour-bid' },
            },
          });

          this.socket.emitToAuction(lot.auctionId, 'auction.timer.extended', { lotId, newEndsAt });
        }
      }

      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: 'auction.bid.created',
          entityType: 'lot',
          entityId: lotId,
          after: { amount, lotId, auctionId: lot.auctionId, itemName: lotItemName },
        },
      });

      this.socket.emitToAuction(lot.auctionId, 'auction.bid.created', {
        lotId,
        bidId: bid.id,
        userId,
        nickname: bid.user?.profile?.nickname || null,
        amount,
        timerExtended,
        itemName: lotItemName,
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

  // ─── Finish lot — check if ALL lots done → complete auction ─────────────────
  async finishLot(lotId: string, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const lot = await tx.lot.findUnique({
        where: { id: lotId },
        include: {
          auction: true,
          bids: { orderBy: [{ amount: 'desc' }, { createdAt: 'asc' }], take: 2, include: { user: { include: { profile: true } } } },
          warehouseItem: true,
        },
      });

      if (!lot) throw new NotFoundException('Lot not found');
      if (lot.status !== LotStatus.ACTIVE) throw new BadRequestException('Lot is not active');
      const lotItemName = lot.warehouseItem?.name || lot.itemName || 'Предмет';
      const lotItemRarity = lot.warehouseItem?.rarity || lot.itemRarity || null;

      const winningBid = lot.bids[0];
      let finalPrice = winningBid ? Number(winningBid.amount) : 0;
      let winnerId: string | null = null;
      let winnerNickname: string | null = null;
      let sold = false;

      if (winningBid) {
        winnerId = winningBid.userId;
        winnerNickname = winningBid.user?.profile?.nickname || null;

        if (winningBid.holdId) {
          await this.dkpService.finalizeHold(winningBid.holdId);
        }

        await tx.lot.update({
          where: { id: lotId },
          data: { status: LotStatus.SOLD, winnerId, currentPrice: finalPrice },
        });

        await tx.lotResult.create({
          data: {
            lotId,
            winnerId,
            finalPrice,
            status: 'sold',
          },
        });

        sold = true;
      } else if (
        lot.lotDurationMinutes == null &&
        lot.noBidExtensions < AuctionsService.DEFAULT_LOT_MAX_NO_BID_EXTENSIONS &&
        lot.endsAt &&
        lot.endsAt <= new Date()
      ) {
        const now = new Date();
        const baseEndsAt = lot.endsAt > now ? lot.endsAt : now;
        const newEndsAt = new Date(baseEndsAt.getTime() + AuctionsService.DEFAULT_LOT_EXTENSION_MINUTES * 60_000);
        const newNoBidExtensions = lot.noBidExtensions + 1;

        await tx.lot.update({
          where: { id: lotId },
          data: { endsAt: newEndsAt, noBidExtensions: newNoBidExtensions },
        });

        await tx.auctionSystemEvent.create({
          data: {
            auctionId: lot.auctionId,
            event: 'auction.timer.extended',
            data: {
              lotId,
              newEndsAt: newEndsAt.toISOString(),
              reason: 'no-bids-rollover',
              extensionIndex: newNoBidExtensions,
            },
          },
        });

        this.socket.emitToAuction(lot.auctionId, 'auction.timer.extended', {
          lotId,
          newEndsAt,
          reason: 'no-bids-rollover',
        });

        return { lot: { ...lot, endsAt: newEndsAt }, remainingActiveLots: 1 };
      }

      if (sold) {
        if (lot.warehouseItemId) {
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
        }

        // Emit winner event for frontend celebration overlay
        this.socket.emitToAuction(lot.auctionId, 'auction.lot.sold', {
          lotId,
          itemName: lotItemName,
          itemRarity: lotItemRarity,
          winnerId,
          winnerNickname,
          finalPrice,
        });

        this.socket.emitToAuction(lot.auctionId, 'auction.lot.finished', {
          lotId,
          status: 'sold',
          winnerId,
          winnerNickname,
          finalPrice,
          itemName: lotItemName,
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
          itemName: lotItemName,
        });
      }

      // Release holds for all non-winning bids
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

      // Check if ALL lots are finished (parallel mode — no "next lot" logic)
      const remainingActiveLots = await tx.lot.count({
        where: {
          auctionId: lot.auctionId,
          status: LotStatus.ACTIVE,
          deletedAt: null,
        },
      });

      if (remainingActiveLots === 0) {
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
          after: {
            status: sold ? 'sold' : 'unsold',
            itemName: lotItemName,
            finalPrice: sold ? finalPrice : null,
          },
        },
      });

      return { lot, remainingActiveLots };
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

  async deleteCompletedAuction(auctionId: string, clanId: string, actorId: string) {
    const auction = await this.prisma.auction.findUnique({
      where: { id: auctionId },
    });
    if (!auction || auction.deletedAt) throw new NotFoundException('Auction not found');
    if (auction.clanId !== clanId) throw new ForbiddenException('Auction does not belong to this clan');
    if (auction.status !== AuctionStatus.COMPLETED) {
      throw new BadRequestException('Only completed auctions can be deleted');
    }

    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.auction.update({
        where: { id: auctionId },
        data: { deletedAt: now },
      }),
      this.prisma.lot.updateMany({
        where: { auctionId, deletedAt: null },
        data: { deletedAt: now },
      }),
      this.prisma.auctionChatMessage.updateMany({
        where: { auctionId, deletedAt: null },
        data: { deletedAt: now },
      }),
      this.prisma.auditLog.create({
        data: {
          actorId,
          action: 'auction.deleted',
          entityType: 'auction',
          entityId: auctionId,
          after: { deletedAt: now },
        },
      }),
    ]);

    this.socket.emitToClan(clanId, 'auction.deleted', { auctionId });
    return { success: true, deletedId: auctionId };
  }

  async getChatMessages(auctionId: string, query: PaginationDto) {
    const where = { auctionId, deletedAt: null };
    const [messages, total] = await Promise.all([
      this.prisma.auctionChatMessage.findMany({
        where,
        include: { user: { include: { profile: true } } },
        orderBy: { createdAt: 'asc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.auctionChatMessage.count({ where }),
    ]);
    return new PaginatedResponse(messages, total, query.page, query.limit);
  }

  private normalizeLotDurationMinutes(value?: number | null): number | null {
    if (value === undefined || value === null) return null;
    if (!Number.isFinite(value) || value <= 0) {
      throw new BadRequestException('lotDurationMinutes must be a positive number');
    }
    return Math.round(value);
  }
}
