import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PaginationDto, PaginatedResponse } from '../../common/dto/pagination.dto';

@Injectable()
export class NewsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(clanId: string, query: PaginationDto) {
    const where = {
      clanId,
      deletedAt: null,
      ...(query.search ? { title: { contains: query.search, mode: 'insensitive' as const } } : {}),
    };
    const [posts, total] = await Promise.all([
      this.prisma.newsPost.findMany({
        where,
        include: {
          author: { include: { profile: true } },
          _count: { select: { comments: true, reactions: true } },
        },
        skip: query.skip,
        take: query.limit,
        orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
      }),
      this.prisma.newsPost.count({ where }),
    ]);
    return new PaginatedResponse(posts, total, query.page, query.limit);
  }

  async findById(id: string) {
    const post = await this.prisma.newsPost.findUnique({
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
            _count: { select: { reactions: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        reactions: true,
      },
    });
    if (!post) throw new NotFoundException('News post not found');
    return post;
  }

  async create(clanId: string, authorId: string, data: { title: string; content: string; isPinned?: boolean }) {
    const post = await this.prisma.newsPost.create({
      data: {
        clanId,
        authorId,
        title: data.title,
        content: data.content,
        isPinned: data.isPinned ?? false,
      },
      include: { author: { include: { profile: true } } },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: authorId,
        action: 'news.post.created',
        entityType: 'news_post',
        entityId: post.id,
        after: { title: post.title },
      },
    });

    return post;
  }

  async update(id: string, actorId: string, data: { title?: string; content?: string; isPinned?: boolean }, globalRole?: string) {
    const post = await this.prisma.newsPost.findUnique({ where: { id } });
    if (!post) throw new NotFoundException('News post not found');
    if (post.authorId !== actorId && globalRole !== 'PORTAL_ADMIN') {
      throw new ForbiddenException('Only the author or admin can edit this post');
    }

    return this.prisma.newsPost.update({
      where: { id },
      data,
      include: { author: { include: { profile: true } } },
    });
  }

  async delete(id: string, actorId: string) {
    const post = await this.prisma.newsPost.findUnique({ where: { id } });
    if (!post) throw new NotFoundException('News post not found');

    await this.prisma.newsPost.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'news.post.deleted',
        entityType: 'news_post',
        entityId: id,
        before: { title: post.title },
      },
    });

    return { message: 'Post deleted' };
  }

  async addComment(newsPostId: string, authorId: string, content: string, parentId?: string) {
    return this.prisma.comment.create({
      data: { newsPostId, authorId, content, parentId },
      include: { author: { include: { profile: true } } },
    });
  }

  async hideComment(commentId: string, actorId: string) {
    return this.prisma.comment.update({
      where: { id: commentId },
      data: { isHidden: true },
    });
  }

  async addReaction(newsPostId: string, userId: string, emoji: string) {
    const existing = await this.prisma.reaction.findUnique({
      where: { userId_newsPostId_emoji: { userId, newsPostId, emoji } },
    });
    if (existing) {
      await this.prisma.reaction.delete({ where: { id: existing.id } });
      return { action: 'removed' };
    }
    await this.prisma.reaction.create({
      data: { userId, newsPostId, emoji },
    });
    return { action: 'added' };
  }
}
