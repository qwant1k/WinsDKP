import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PaginationDto, PaginatedResponse } from '../../common/dto/pagination.dto';

@Injectable()
export class FeedService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(clanId: string, query: PaginationDto) {
    const where = {
      clanId,
      deletedAt: null,
      ...(query.search ? { content: { contains: query.search, mode: 'insensitive' as const } } : {}),
    };
    const [posts, total] = await Promise.all([
      this.prisma.feedPost.findMany({
        where,
        include: {
          author: { include: { profile: true } },
          _count: { select: { comments: true, reactions: true } },
        },
        skip: query.skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.feedPost.count({ where }),
    ]);
    return new PaginatedResponse(posts, total, query.page, query.limit);
  }

  async findById(id: string) {
    const post = await this.prisma.feedPost.findUnique({
      where: { id },
      include: {
        author: { include: { profile: true } },
        comments: {
          where: { deletedAt: null, isHidden: false },
          include: {
            author: { include: { profile: true } },
            replies: {
              where: { deletedAt: null, isHidden: false },
              include: { author: { include: { profile: true } } },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        reactions: true,
      },
    });
    if (!post) throw new NotFoundException('Feed post not found');
    return post;
  }

  async create(clanId: string, authorId: string, content: string) {
    const post = await this.prisma.feedPost.create({
      data: { clanId, authorId, content },
      include: { author: { include: { profile: true } } },
    });
    await this.prisma.auditLog.create({ data: { actorId: authorId, action: 'feed.created', entityType: 'feed_post', entityId: post.id, after: { content: content.slice(0, 100) } } });
    return post;
  }

  async update(id: string, actorId: string, content: string) {
    const post = await this.prisma.feedPost.findUnique({ where: { id } });
    if (!post) throw new NotFoundException('Feed post not found');
    return this.prisma.feedPost.update({
      where: { id },
      data: { content },
      include: { author: { include: { profile: true } } },
    });
  }

  async delete(id: string, actorId: string) {
    await this.prisma.feedPost.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.prisma.auditLog.create({ data: { actorId, action: 'feed.deleted', entityType: 'feed_post', entityId: id } });
    return { message: 'Post deleted' };
  }

  async report(id: string) {
    await this.prisma.feedPost.update({
      where: { id },
      data: { isReported: true },
    });
    return { message: 'Post reported' };
  }

  async addComment(feedPostId: string, authorId: string, content: string, parentId?: string) {
    return this.prisma.comment.create({
      data: { feedPostId, authorId, content, parentId },
      include: { author: { include: { profile: true } } },
    });
  }

  async hideComment(commentId: string) {
    return this.prisma.comment.update({
      where: { id: commentId },
      data: { isHidden: true },
    });
  }

  async addReaction(feedPostId: string, userId: string, emoji: string) {
    const existing = await this.prisma.reaction.findUnique({
      where: { userId_feedPostId_emoji: { userId, feedPostId, emoji } },
    });
    if (existing) {
      await this.prisma.reaction.delete({ where: { id: existing.id } });
      return { action: 'removed' };
    }
    await this.prisma.reaction.create({
      data: { userId, feedPostId, emoji },
    });
    return { action: 'added' };
  }
}
