import { PrismaClient, GlobalRole, ClanRole, ActivityStatus, ActivityType, AuctionStatus, LotStatus, ItemRarity, NotificationType } from '@prisma/client';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

async function hashPassword(password: string): Promise<string> {
  // Using SHA-256 for seed simplicity; production uses argon2id
  return crypto.createHash('sha256').update(password).digest('hex');
}

async function main() {
  console.log('🌱 Seeding Ymir Clan Hub...');

  // ── System Settings ────────────────────────────────────────
  await prisma.systemSetting.createMany({
    data: [
      { key: 'auction.anti_sniper_seconds', value: 20, group: 'auction' },
      { key: 'auction.anti_sniper_extend_seconds', value: 30, group: 'auction' },
      { key: 'auction.default_min_step', value: 1, group: 'auction' },
      { key: 'randomizer.bonus_min', value: 0.03, group: 'randomizer' },
      { key: 'randomizer.bonus_max', value: 0.05, group: 'randomizer' },
      { key: 'app.maintenance_mode', value: false, group: 'general' },
      { key: 'app.default_locale', value: '"ru"', group: 'general' },
    ],
    skipDuplicates: true,
  });

  // ── Users ──────────────────────────────────────────────────
  const passwordHash = await hashPassword('Password123!');

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@ymir.local' },
    update: {},
    create: {
      email: 'admin@ymir.local',
      passwordHash,
      globalRole: GlobalRole.PORTAL_ADMIN,
      emailVerified: true,
      profile: {
        create: {
          nickname: 'PortalAdmin',
          displayName: 'Portal Administrator',
          bm: 99999,
          level: 100,
        },
      },
      dkpWallet: { create: { balance: 0, onHold: 0, totalEarned: 0 } },
    },
  });

  const leaderUser = await prisma.user.upsert({
    where: { email: 'leader@ymir.local' },
    update: {},
    create: {
      email: 'leader@ymir.local',
      passwordHash,
      globalRole: GlobalRole.USER,
      emailVerified: true,
      profile: {
        create: {
          nickname: 'DragonSlayer',
          displayName: 'Ведущий Клана',
          bm: 85000,
          level: 95,
        },
      },
      dkpWallet: { create: { balance: 5000, onHold: 0, totalEarned: 5000 } },
    },
  });

  const elderUser = await prisma.user.upsert({
    where: { email: 'elder@ymir.local' },
    update: {},
    create: {
      email: 'elder@ymir.local',
      passwordHash,
      globalRole: GlobalRole.USER,
      emailVerified: true,
      profile: {
        create: {
          nickname: 'ShadowMage',
          displayName: 'Старейшина',
          bm: 72000,
          level: 88,
        },
      },
      dkpWallet: { create: { balance: 3500, onHold: 0, totalEarned: 3500 } },
    },
  });

  const memberUser = await prisma.user.upsert({
    where: { email: 'member@ymir.local' },
    update: {},
    create: {
      email: 'member@ymir.local',
      passwordHash,
      globalRole: GlobalRole.USER,
      emailVerified: true,
      profile: {
        create: {
          nickname: 'IronFist',
          displayName: 'Участник',
          bm: 45000,
          level: 70,
        },
      },
      dkpWallet: { create: { balance: 1200, onHold: 0, totalEarned: 1200 } },
    },
  });

  const newbieUser = await prisma.user.upsert({
    where: { email: 'newbie@ymir.local' },
    update: {},
    create: {
      email: 'newbie@ymir.local',
      passwordHash,
      globalRole: GlobalRole.USER,
      emailVerified: true,
      profile: {
        create: {
          nickname: 'FreshBlood',
          displayName: 'Новичок',
          bm: 5000,
          level: 15,
        },
      },
      dkpWallet: { create: { balance: 100, onHold: 0, totalEarned: 100 } },
    },
  });

  // Additional 10 members
  const memberNames = [
    { email: 'player1@ymir.local', nickname: 'StormBringer', display: 'Штормовой', bm: 62000, level: 82, dkp: 2800 },
    { email: 'player2@ymir.local', nickname: 'NightHunter', display: 'Ночной Охотник', bm: 58000, level: 78, dkp: 2200 },
    { email: 'player3@ymir.local', nickname: 'FrostQueen', display: 'Ледяная Королева', bm: 55000, level: 75, dkp: 1900 },
    { email: 'player4@ymir.local', nickname: 'BladeDancer', display: 'Танцор Клинков', bm: 48000, level: 68, dkp: 1500 },
    { email: 'player5@ymir.local', nickname: 'DarkPriest', display: 'Тёмный Жрец', bm: 42000, level: 63, dkp: 1100 },
    { email: 'player6@ymir.local', nickname: 'SteelGuard', display: 'Стальной Страж', bm: 38000, level: 58, dkp: 800 },
    { email: 'player7@ymir.local', nickname: 'FireArcher', display: 'Огненный Лучник', bm: 30000, level: 50, dkp: 600 },
    { email: 'player8@ymir.local', nickname: 'WindWalker', display: 'Ветроход', bm: 22000, level: 40, dkp: 400 },
    { email: 'player9@ymir.local', nickname: 'EarthShaker', display: 'Землетряс', bm: 15000, level: 30, dkp: 250 },
    { email: 'player10@ymir.local', nickname: 'SkyWatcher', display: 'Небесный Страж', bm: 8000, level: 20, dkp: 150 },
  ];

  const additionalUsers = [];
  for (const m of memberNames) {
    const user = await prisma.user.upsert({
      where: { email: m.email },
      update: {},
      create: {
        email: m.email,
        passwordHash,
        globalRole: GlobalRole.USER,
        emailVerified: true,
        profile: {
          create: {
            nickname: m.nickname,
            displayName: m.display,
            bm: m.bm,
            level: m.level,
          },
        },
        dkpWallet: { create: { balance: m.dkp, onHold: 0, totalEarned: m.dkp } },
      },
    });
    additionalUsers.push(user);
  }

  // ── Clan ───────────────────────────────────────────────────
  const clan = await prisma.clan.upsert({
    where: { name: 'Ymir Vanguard' },
    update: {},
    create: {
      name: 'Ymir Vanguard',
      tag: 'YMIR',
      description: 'Элитный клан мира Legend of Ymir. Сила, честь, братство.',
    },
  });

  // ── Clan Memberships ──────────────────────────────────────
  const membershipData = [
    { userId: leaderUser.id, clanId: clan.id, role: ClanRole.CLAN_LEADER },
    { userId: elderUser.id, clanId: clan.id, role: ClanRole.ELDER },
    { userId: memberUser.id, clanId: clan.id, role: ClanRole.MEMBER },
    { userId: newbieUser.id, clanId: clan.id, role: ClanRole.NEWBIE },
    ...additionalUsers.map((u, i) => ({
      userId: u.id,
      clanId: clan.id,
      role: i < 3 ? ClanRole.MEMBER : ClanRole.NEWBIE,
    })),
  ];

  for (const md of membershipData) {
    await prisma.clanMembership.upsert({
      where: { userId_clanId: { userId: md.userId, clanId: md.clanId } },
      update: {},
      create: md,
    });
  }

  // ── Coefficient Ranges ────────────────────────────────────
  const powerRanges = [
    { clanId: clan.id, fromPower: 0, toPower: 10000, coefficient: 0.5 },
    { clanId: clan.id, fromPower: 10001, toPower: 30000, coefficient: 0.8 },
    { clanId: clan.id, fromPower: 30001, toPower: 60000, coefficient: 1.0 },
    { clanId: clan.id, fromPower: 60001, toPower: 100000, coefficient: 1.2 },
  ];
  for (const pr of powerRanges) {
    await prisma.coefficientPowerRange.create({ data: pr });
  }

  const levelRanges = [
    { clanId: clan.id, fromLevel: 1, toLevel: 30, coefficient: 0.6 },
    { clanId: clan.id, fromLevel: 31, toLevel: 60, coefficient: 0.9 },
    { clanId: clan.id, fromLevel: 61, toLevel: 80, coefficient: 1.0 },
    { clanId: clan.id, fromLevel: 81, toLevel: 100, coefficient: 1.3 },
  ];
  for (const lr of levelRanges) {
    await prisma.coefficientLevelRange.create({ data: lr });
  }

  // ── Warehouse Items (30) ──────────────────────────────────
  const items = [
    { name: 'Меч Разрушителя', rarity: ItemRarity.LEGENDARY, dkpPrice: 500, quantity: 2, source: 'Мировой Босс' },
    { name: 'Посох Архимага', rarity: ItemRarity.LEGENDARY, dkpPrice: 480, quantity: 1, source: 'Рейд: Башня' },
    { name: 'Доспех Драконоборца', rarity: ItemRarity.EPIC, dkpPrice: 350, quantity: 3, source: 'Рейд: Логово' },
    { name: 'Щит Вечности', rarity: ItemRarity.EPIC, dkpPrice: 320, quantity: 2, source: 'Данж S-ранга' },
    { name: 'Кольцо Теней', rarity: ItemRarity.EPIC, dkpPrice: 280, quantity: 4, source: 'Экспедиция' },
    { name: 'Амулет Бури', rarity: ItemRarity.EPIC, dkpPrice: 260, quantity: 3, source: 'PvP Турнир' },
    { name: 'Шлем Титана', rarity: ItemRarity.RARE, dkpPrice: 200, quantity: 5, source: 'Рейд: Руины' },
    { name: 'Перчатки Ловкости', rarity: ItemRarity.RARE, dkpPrice: 180, quantity: 4, source: 'Данж А-ранга' },
    { name: 'Сапоги Ветра', rarity: ItemRarity.RARE, dkpPrice: 170, quantity: 6, source: 'Экспедиция' },
    { name: 'Плащ Невидимости', rarity: ItemRarity.RARE, dkpPrice: 190, quantity: 3, source: 'Мировой Босс' },
    { name: 'Лук Охотника', rarity: ItemRarity.RARE, dkpPrice: 160, quantity: 4, source: 'Данж B-ранга' },
    { name: 'Кинжал Убийцы', rarity: ItemRarity.RARE, dkpPrice: 150, quantity: 5, source: 'PvP Турнир' },
    { name: 'Жезл Целителя', rarity: ItemRarity.UNCOMMON, dkpPrice: 120, quantity: 7, source: 'Данж А-ранга' },
    { name: 'Топор Берсерка', rarity: ItemRarity.UNCOMMON, dkpPrice: 110, quantity: 6, source: 'Рейд: Пустошь' },
    { name: 'Копьё Стража', rarity: ItemRarity.UNCOMMON, dkpPrice: 100, quantity: 8, source: 'Данж B-ранга' },
    { name: 'Пояс Силы', rarity: ItemRarity.UNCOMMON, dkpPrice: 90, quantity: 10, source: 'Экспедиция' },
    { name: 'Наручи Защитника', rarity: ItemRarity.UNCOMMON, dkpPrice: 85, quantity: 8, source: 'Данж С-ранга' },
    { name: 'Свиток Мудрости', rarity: ItemRarity.COMMON, dkpPrice: 50, quantity: 15, source: 'Ежедневное задание' },
    { name: 'Зелье Силы (Большое)', rarity: ItemRarity.COMMON, dkpPrice: 30, quantity: 20, source: 'Крафт' },
    { name: 'Зелье Маны (Большое)', rarity: ItemRarity.COMMON, dkpPrice: 30, quantity: 20, source: 'Крафт' },
    { name: 'Камень Улучшения +5', rarity: ItemRarity.RARE, dkpPrice: 200, quantity: 10, source: 'Ивент' },
    { name: 'Камень Улучшения +10', rarity: ItemRarity.EPIC, dkpPrice: 400, quantity: 5, source: 'Ивент' },
    { name: 'Свиток Телепортации', rarity: ItemRarity.COMMON, dkpPrice: 20, quantity: 30, source: 'Магазин' },
    { name: 'Руна Огня', rarity: ItemRarity.UNCOMMON, dkpPrice: 80, quantity: 12, source: 'Данж B-ранга' },
    { name: 'Руна Льда', rarity: ItemRarity.UNCOMMON, dkpPrice: 80, quantity: 12, source: 'Данж B-ранга' },
    { name: 'Руна Молнии', rarity: ItemRarity.RARE, dkpPrice: 130, quantity: 8, source: 'Данж А-ранга' },
    { name: 'Кристалл Душ', rarity: ItemRarity.MYTHIC, dkpPrice: 800, quantity: 1, source: 'Мировой Босс (Легендарный)' },
    { name: 'Корона Йимира', rarity: ItemRarity.MYTHIC, dkpPrice: 1000, quantity: 1, source: 'Рейд: Трон Йимира' },
    { name: 'Маунт: Ледяной Дракон', rarity: ItemRarity.LEGENDARY, dkpPrice: 600, quantity: 1, source: 'Ивент: Зима' },
    { name: 'Петомец: Огненный Феникс', rarity: ItemRarity.LEGENDARY, dkpPrice: 550, quantity: 1, source: 'Ивент: Лето' },
  ];

  const warehouseItems = [];
  for (const item of items) {
    const wi = await prisma.warehouseItem.create({
      data: { clanId: clan.id, ...item },
    });
    warehouseItems.push(wi);
  }

  // ── Activities (2) ────────────────────────────────────────
  const now = new Date();
  const activity1 = await prisma.activity.create({
    data: {
      clanId: clan.id,
      type: ActivityType.RAID,
      title: 'Рейд: Логово Дракона',
      description: 'Еженедельный рейд на Логово Красного Дракона. Требуется минимум 10 участников.',
      baseDkp: 100,
      startAt: new Date(now.getTime() - 3600000),
      endAt: new Date(now.getTime() + 3600000),
      status: ActivityStatus.IN_PROGRESS,
      createdBy: leaderUser.id,
    },
  });

  const activity2 = await prisma.activity.create({
    data: {
      clanId: clan.id,
      type: ActivityType.EXPEDITION,
      title: 'Экспедиция: Забытые Руины',
      description: 'Исследование древних руин. Шанс на редкие артефакты.',
      baseDkp: 60,
      startAt: new Date(now.getTime() + 86400000),
      status: ActivityStatus.OPEN,
      createdBy: elderUser.id,
    },
  });

  // Add participants to activity1
  const activityParticipants = [leaderUser, elderUser, memberUser, ...additionalUsers.slice(0, 5)];
  for (const u of activityParticipants) {
    await prisma.activityParticipant.create({
      data: { activityId: activity1.id, userId: u.id },
    });
  }

  // ── Test Auction ──────────────────────────────────────────
  const auction = await prisma.auction.create({
    data: {
      clanId: clan.id,
      title: 'Еженедельный Аукцион #42',
      description: 'Распределение лута с рейдов за неделю.',
      status: AuctionStatus.ACTIVE,
      startAt: new Date(now.getTime() - 1800000),
      endAt: new Date(now.getTime() + 7200000),
      createdBy: leaderUser.id,
    },
  });

  // Auction participants
  const auctionParticipants = [leaderUser, elderUser, memberUser, ...additionalUsers.slice(0, 7)];
  for (const u of auctionParticipants) {
    await prisma.auctionParticipant.create({
      data: { auctionId: auction.id, userId: u.id },
    });
  }

  // Auction lots
  const lotItems = warehouseItems.slice(0, 5);
  for (let i = 0; i < lotItems.length; i++) {
    const item = lotItems[i]!;
    await prisma.lot.create({
      data: {
        auctionId: auction.id,
        warehouseItemId: item.id,
        quantity: 1,
        startPrice: item.dkpPrice ? Number(item.dkpPrice) * 0.5 : 50,
        minStep: 10,
        status: i === 0 ? LotStatus.ACTIVE : LotStatus.PENDING,
        endsAt: i === 0 ? new Date(now.getTime() + 3600000) : null,
        sortOrder: i,
      },
    });
  }

  // ── News Post ─────────────────────────────────────────────
  await prisma.newsPost.create({
    data: {
      clanId: clan.id,
      authorId: leaderUser.id,
      title: 'Добро пожаловать в Ymir Vanguard!',
      content: `# Приветствуем вас в клане Ymir Vanguard!\n\nМы рады приветствовать новых участников. Наш клан — один из сильнейших на сервере Legend of Ymir.\n\n## Правила клана\n1. Участие в рейдах обязательно минимум 2 раза в неделю\n2. DKP начисляются за активность и участие\n3. Распределение лута через аукцион — честно и прозрачно\n4. Уважение к каждому участнику\n\nПо всем вопросам обращайтесь к старейшинам.`,
      isPinned: true,
    },
  });

  // ── Notifications ─────────────────────────────────────────
  await prisma.notification.createMany({
    data: [
      {
        userId: memberUser.id,
        type: NotificationType.AUCTION_STARTED,
        title: 'Аукцион начался!',
        body: 'Еженедельный Аукцион #42 уже идёт. Не пропустите!',
      },
      {
        userId: newbieUser.id,
        type: NotificationType.ACTIVITY_CREATED,
        title: 'Новая активность',
        body: 'Создана новая экспедиция: Забытые Руины',
      },
    ],
  });

  console.log('✅ Seed complete!');
  console.log('');
  console.log('Demo accounts (password: Password123!):');
  console.log('  portal_admin : admin@ymir.local');
  console.log('  clan_leader  : leader@ymir.local');
  console.log('  elder        : elder@ymir.local');
  console.log('  member       : member@ymir.local');
  console.log('  newbie       : newbie@ymir.local');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
