import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SocketGateway } from '../../common/socket/socket.gateway';
import { PaginationDto, PaginatedResponse } from '../../common/dto/pagination.dto';
import { NotificationType } from '@prisma/client';

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly socket: SocketGateway,
  ) {}

  async getConversations(userId: string) {
    const messages = await this.prisma.directMessage.findMany({
      where: {
        deletedAt: null,
        OR: [{ senderId: userId }, { receiverId: userId }],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        sender: { include: { profile: true } },
        receiver: { include: { profile: true } },
      },
    });

    const convMap = new Map<string, any>();
    for (const msg of messages) {
      const otherId = msg.senderId === userId ? msg.receiverId : msg.senderId;
      if (!convMap.has(otherId)) {
        const other = msg.senderId === userId ? msg.receiver : msg.sender;
        convMap.set(otherId, {
          userId: otherId,
          nickname: other.profile?.nickname,
          displayName: other.profile?.displayName,
          lastMessage: msg.content,
          lastMessageAt: msg.createdAt,
          isRead: msg.senderId === userId ? true : msg.isRead,
          unreadCount: 0,
        });
      }
    }

    const unreadCounts = await this.prisma.directMessage.groupBy({
      by: ['senderId'],
      where: { receiverId: userId, isRead: false, deletedAt: null },
      _count: true,
    });

    for (const uc of unreadCounts) {
      const conv = convMap.get(uc.senderId);
      if (conv) conv.unreadCount = uc._count;
    }

    return Array.from(convMap.values()).sort(
      (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime(),
    );
  }

  async getThread(userId: string, otherUserId: string, query: PaginationDto) {
    const where = {
      deletedAt: null,
      OR: [
        { senderId: userId, receiverId: otherUserId },
        { senderId: otherUserId, receiverId: userId },
      ],
    };

    const [messages, total] = await Promise.all([
      this.prisma.directMessage.findMany({
        where,
        include: {
          sender: { include: { profile: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.directMessage.count({ where }),
    ]);

    await this.prisma.directMessage.updateMany({
      where: { senderId: otherUserId, receiverId: userId, isRead: false },
      data: { isRead: true },
    });

    return new PaginatedResponse(messages.reverse(), total, query.page, query.limit);
  }

  async sendMessage(senderId: string, receiverId: string, content: string) {
    if (content.length > 2000) throw new ForbiddenException('Message too long');

    const receiver = await this.prisma.user.findUnique({ where: { id: receiverId } });
    if (!receiver) throw new NotFoundException('User not found');

    const message = await this.prisma.directMessage.create({
      data: { senderId, receiverId, content },
      include: { sender: { include: { profile: true } } },
    });

    await this.prisma.notification.create({
      data: {
        userId: receiverId,
        type: NotificationType.MESSAGE_RECEIVED,
        title: `Сообщение от ${message.sender.profile?.nickname}`,
        body: content.substring(0, 100),
        data: { link: `/messages/${senderId}` },
      },
    });

    this.socket.emitToUser(receiverId, 'message.received', {
      messageId: message.id,
      senderId,
      senderNickname: message.sender.profile?.nickname,
      content,
    });

    return message;
  }

  async getUnreadCount(userId: string) {
    const count = await this.prisma.directMessage.count({
      where: { receiverId: userId, isRead: false, deletedAt: null },
    });
    return { count };
  }
}
