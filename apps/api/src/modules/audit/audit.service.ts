import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PaginationDto, PaginatedResponse } from '../../common/dto/pagination.dto';

const ACTION_DESCRIPTIONS: Record<string, string> = {
  'admin.user.created': 'создал нового пользователя',
  'admin.user.updated': 'обновил данные пользователя',
  'admin.user.deleted': 'удалил пользователя',
  'admin.clan.created': 'создал новый клан',
  'admin.setting.updated': 'изменил системную настройку',
  'admin.impersonate': 'вошёл от имени пользователя',
  'admin.coefficients.power.updated': 'обновил коэффициенты БМ',
  'admin.coefficients.level.updated': 'обновил коэффициенты уровня',
  'clan.join_request.approved': 'одобрил заявку на вступление в клан',
  'clan.join_request.rejected': 'отклонил заявку на вступление в клан',
  'clan.member.role_changed': 'изменил роль участника клана',
  'clan.member.kicked': 'исключил участника из клана',
  'dkp.credit': 'начислил DKP',
  'dkp.debit': 'списал DKP',
  'dkp.penalty.issued': 'выдал штраф DKP',
  'auction.created': 'создал аукцион',
  'auction.started': 'запустил аукцион',
  'auction.lot.finished': 'завершил лот аукциона',
  'randomizer.session.created': 'создал сессию рандомайзера',
  'randomizer.draw.completed': 'провёл розыгрыш рандомайзера',
  'warehouse.item.created': 'добавил предмет в хранилище',
  'warehouse.item.updated': 'обновил предмет в хранилище',
  'warehouse.item.deleted': 'удалил предмет из хранилища',
  'auth.login': 'вошёл в систему',
  'auth.register': 'зарегистрировался в системе',
  'auth.logout': 'вышел из системы',
  'auth.password_reset': 'сбросил пароль',
  'news.created': 'опубликовал новость',
  'news.updated': 'обновил новость',
  'news.deleted': 'удалил новость',
  'feed.created': 'опубликовал запись в ленте',
  'feed.deleted': 'удалил запись из ленты',
  'activity.created': 'создал активность',
  'activity.started': 'запустил активность',
  'activity.completed': 'завершил активность',
  'message.sent': 'отправил личное сообщение',
};

const CATEGORY_MAP: Record<string, string> = {
  admin: 'Администрирование',
  clan: 'Клан',
  dkp: 'DKP Экономика',
  auction: 'Аукционы',
  randomizer: 'Рандомайзер',
  warehouse: 'Хранилище',
  auth: 'Авторизация',
  news: 'Новости',
  feed: 'Лента',
  activity: 'Активности',
  message: 'Сообщения',
};

const ENTITY_TYPE_LABELS: Record<string, string> = {
  user: 'Пользователь',
  clan: 'Клан',
  clan_membership: 'Членство в клане',
  clan_join_request: 'Заявка в клан',
  dkp_wallet: 'DKP Кошелёк',
  penalty: 'Штраф',
  activity: 'Активность',
  auction: 'Аукцион',
  lot: 'Лот аукциона',
  randomizer_session: 'Рандомайзер',
  warehouse_item: 'Предмет хранилища',
  news_post: 'Новость',
  feed_post: 'Запись в ленте',
  system_setting: 'Системная настройка',
  coefficient_power_range: 'Коэффициент БМ',
  coefficient_level_range: 'Коэффициент уровня',
  direct_message: 'Личное сообщение',
};

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: PaginationDto & { actorId?: string; entityType?: string; action?: string; from?: string; to?: string; category?: string }) {
    const where: Record<string, unknown> = {};

    if (query.actorId) where['actorId'] = query.actorId;
    if (query.entityType) where['entityType'] = query.entityType;
    if (query.action) where['action'] = { contains: query.action, mode: 'insensitive' };
    if (query.category) where['action'] = { startsWith: query.category + '.', mode: 'insensitive' };
    if (query.from || query.to) {
      where['createdAt'] = {
        ...(query.from ? { gte: new Date(query.from) } : {}),
        ...(query.to ? { lte: new Date(query.to) } : {}),
      };
    }
    if (query.search) {
      where['OR'] = [
        { action: { contains: query.search, mode: 'insensitive' } },
        { entityType: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 30;
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: { actor: { include: { profile: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    const enrichedLogs = logs.map((log) => ({
      ...log,
      actionLabel: ACTION_DESCRIPTIONS[log.action] || log.action,
      entityTypeLabel: ENTITY_TYPE_LABELS[log.entityType] || log.entityType,
      category: log.action.split('.')[0] || 'system',
      categoryLabel: CATEGORY_MAP[log.action.split('.')[0] || ''] || 'Система',
    }));

    return new PaginatedResponse(enrichedLogs, total, page, limit);
  }

  async getEventLogs(query: PaginationDto & { category?: string; entityType?: string; from?: string; to?: string }) {
    const where: Record<string, unknown> = {};
    if (query.category) where['category'] = query.category;
    if (query.entityType) where['entityType'] = query.entityType;
    if (query.from || query.to) {
      where['createdAt'] = {
        ...(query.from ? { gte: new Date(query.from) } : {}),
        ...(query.to ? { lte: new Date(query.to) } : {}),
      };
    }
    if (query.search) {
      where['OR'] = [
        { description: { contains: query.search, mode: 'insensitive' } },
        { actorName: { contains: query.search, mode: 'insensitive' } },
        { entityName: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      this.prisma.auditEventLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.auditEventLog.count({ where }),
    ]);

    return new PaginatedResponse(logs, total, page, limit);
  }

  async findById(id: string) {
    return this.prisma.auditLog.findUnique({
      where: { id },
      include: { actor: { include: { profile: true } } },
    });
  }

  async log(params: {
    actorId?: string;
    action: string;
    entityType: string;
    entityId?: string;
    before?: unknown;
    after?: unknown;
    ip?: string;
    userAgent?: string;
    metadata?: unknown;
  }) {
    const auditLog = await this.prisma.auditLog.create({
      data: {
        actorId: params.actorId,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        before: params.before as any,
        after: params.after as any,
        ip: params.ip,
        userAgent: params.userAgent,
        metadata: params.metadata as any,
      },
    });

    let actorName: string | undefined;
    if (params.actorId) {
      const profile = await this.prisma.profile.findUnique({ where: { userId: params.actorId } });
      actorName = profile?.nickname || undefined;
    }

    const category = params.action.split('.')[0] || 'system';
    const description = this.buildDescription(actorName, params.action, params.entityType, params.metadata);

    await this.prisma.auditEventLog.create({
      data: {
        actorId: params.actorId,
        actorName: actorName || 'Система',
        category,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        entityName: this.extractEntityName(params.after, params.before),
        description,
        details: {
          before: params.before || null,
          after: params.after || null,
          metadata: params.metadata || null,
        } as any,
        ip: params.ip,
        userAgent: params.userAgent,
      },
    });

    return auditLog;
  }

  private buildDescription(actorName: string | undefined, action: string, entityType: string, metadata?: unknown): string {
    const actor = actorName || 'Система';
    const actionLabel = ACTION_DESCRIPTIONS[action] || action;
    const entityLabel = ENTITY_TYPE_LABELS[entityType] || entityType;
    let desc = `${actor} ${actionLabel}`;

    if (metadata && typeof metadata === 'object') {
      const meta = metadata as Record<string, unknown>;
      if (meta.amount) desc += ` (${meta.amount} DKP)`;
      if (meta.impersonatedUser) desc += ` (${meta.impersonatedUser})`;
    }

    return desc;
  }

  private extractEntityName(after?: unknown, before?: unknown): string | undefined {
    const data = (after || before) as Record<string, unknown> | undefined;
    if (!data || typeof data !== 'object') return undefined;
    return (data.name || data.nickname || data.title || data.email || data.key) as string | undefined;
  }

  getCategories() {
    return CATEGORY_MAP;
  }

  getEntityTypeLabels() {
    return ENTITY_TYPE_LABELS;
  }
}
