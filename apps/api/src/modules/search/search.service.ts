import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface SearchResult {
  type: string;
  id: string;
  title: string;
  subtitle?: string;
  url: string;
  meta?: Record<string, unknown>;
}

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(query: string, clanId?: string, limit = 20): Promise<{ results: SearchResult[]; total: number }> {
    if (!query || query.trim().length < 2) return { results: [], total: 0 };

    const q = query.trim();
    const results: SearchResult[] = [];

    const [users, news, feedPosts, activities, auctions, warehouseItems] = await Promise.all([
      this.prisma.profile.findMany({
        where: {
          OR: [
            { nickname: { contains: q, mode: 'insensitive' } },
            { displayName: { contains: q, mode: 'insensitive' } },
          ],
        },
        include: { user: { select: { id: true, email: true } } },
        take: limit,
      }),

      this.prisma.newsPost.findMany({
        where: {
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { content: { contains: q, mode: 'insensitive' } },
          ],
        },
        take: limit,
      }),

      this.prisma.feedPost.findMany({
        where: {
          content: { contains: q, mode: 'insensitive' },
        },
        include: { author: { include: { profile: true } } },
        take: limit,
      }),

      this.prisma.activity.findMany({
        where: {
          ...(clanId ? { clanId } : {}),
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
          ],
        },
        take: limit,
      }),

      this.prisma.auction.findMany({
        where: {
          ...(clanId ? { clanId } : {}),
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
          ],
        },
        take: limit,
      }),

      clanId
        ? this.prisma.warehouseItem.findMany({
            where: {
              clanId,
              deletedAt: null,
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { description: { contains: q, mode: 'insensitive' } },
              ],
            },
            take: limit,
          })
        : Promise.resolve([]),
    ]);

    for (const u of users) {
      results.push({
        type: 'user',
        id: u.user.id,
        title: u.nickname,
        subtitle: u.displayName || u.user.email,
        url: `/users/${u.user.id}`,
      });
    }

    for (const n of news) {
      results.push({
        type: 'news',
        id: n.id,
        title: n.title,
        subtitle: n.content?.slice(0, 80),
        url: '/news',
      });
    }

    for (const f of feedPosts) {
      results.push({
        type: 'feed',
        id: f.id,
        title: f.content?.slice(0, 60) || 'Запись в ленте',
        subtitle: f.author?.profile?.nickname,
        url: '/feed',
      });
    }

    for (const a of activities) {
      results.push({
        type: 'activity',
        id: a.id,
        title: a.title,
        subtitle: a.description?.slice(0, 80),
        url: '/activities',
      });
    }

    for (const a of auctions) {
      results.push({
        type: 'auction',
        id: a.id,
        title: a.title,
        subtitle: a.description?.slice(0, 80),
        url: `/auctions/${a.id}`,
      });
    }

    for (const w of warehouseItems) {
      results.push({
        type: 'warehouse',
        id: w.id,
        title: w.name,
        subtitle: `${w.rarity} — x${w.quantity}`,
        url: '/warehouse',
        meta: { rarity: w.rarity, quantity: w.quantity },
      });
    }

    return { results: results.slice(0, limit), total: results.length };
  }
}
