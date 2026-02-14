import { PrismaClient, GlobalRole, ClanRole, ActivityStatus, ActivityType, ItemRarity, NotificationType } from '@prisma/client';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

async function hashPassword(password: string): Promise<string> {
  return crypto.createHash('sha256').update(password).digest('hex');
}

async function main() {
  console.log('🌱 Seeding Ymir Clan Hub — Demo Data...');

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
  const passwordHash = await hashPassword('demo123');

  // Superadmin
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
          nickname: 'SuperAdmin',
          displayName: 'Администратор портала',
          bm: 99999,
          level: 100,
        },
      },
      dkpWallet: { create: { balance: 0, onHold: 0, totalEarned: 0 } },
    },
  });

  // Clan Leader — Asma31337
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
          nickname: 'Asma31337',
          displayName: 'Глава Клана',
          bm: 92000,
          level: 97,
        },
      },
      dkpWallet: { create: { balance: 8500, onHold: 0, totalEarned: 12000 } },
    },
  });

  // Elder — Valkyrion
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
          nickname: 'Valkyrion',
          displayName: 'Старейшина',
          bm: 78000,
          level: 91,
        },
      },
      dkpWallet: { create: { balance: 4200, onHold: 0, totalEarned: 7500 } },
    },
  });

  // Member — RuneKeeper
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
          nickname: 'RuneKeeper',
          displayName: 'Участник',
          bm: 51000,
          level: 72,
        },
      },
      dkpWallet: { create: { balance: 1800, onHold: 0, totalEarned: 3200 } },
    },
  });

  // Newbie — FrostBite
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
          nickname: 'FrostBite',
          displayName: 'Новичок',
          bm: 8500,
          level: 22,
        },
      },
      dkpWallet: { create: { balance: 150, onHold: 0, totalEarned: 150 } },
    },
  });

  // ── Clan ───────────────────────────────────────────────────
  const clan = await prisma.clan.upsert({
    where: { name: 'Gods of Ymir' },
    update: {},
    create: {
      name: 'Gods of Ymir',
      tag: 'GoY',
      description: 'Элитный клан мира Legend of Ymir. Сила, честь, братство. Мы покоряем боссов и ведём сервер за собой.',
    },
  });

  // ── Clan Memberships ──────────────────────────────────────
  const membershipData = [
    { userId: leaderUser.id, clanId: clan.id, role: ClanRole.CLAN_LEADER },
    { userId: elderUser.id, clanId: clan.id, role: ClanRole.ELDER },
    { userId: memberUser.id, clanId: clan.id, role: ClanRole.MEMBER },
    { userId: newbieUser.id, clanId: clan.id, role: ClanRole.NEWBIE },
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

  // ── Warehouse Items (10 Legend of Ymir drops) ─────────────
  const items = [
    { name: 'Меч Хаоса',            rarity: ItemRarity.MYTHIC,    dkpPrice: 1200, quantity: 1,  source: 'Босс Хаоса' },
    { name: 'Посох Бездны',         rarity: ItemRarity.LEGENDARY, dkpPrice: 600,  quantity: 1,  source: 'Босс Ущелья' },
    { name: 'Доспех Стража Йимира', rarity: ItemRarity.LEGENDARY, dkpPrice: 550,  quantity: 1,  source: 'Босс Перепутья' },
    { name: 'Кольцо Вечного Огня',  rarity: ItemRarity.EPIC,      dkpPrice: 320,  quantity: 2,  source: 'Босс Хаоса' },
    { name: 'Щит Ледяного Титана',  rarity: ItemRarity.EPIC,      dkpPrice: 280,  quantity: 2,  source: 'Босс Ущелья' },
    { name: 'Амулет Теней',         rarity: ItemRarity.EPIC,      dkpPrice: 250,  quantity: 3,  source: 'Босс Перепутья' },
    { name: 'Шлем Рунного Воина',   rarity: ItemRarity.RARE,      dkpPrice: 180,  quantity: 4,  source: 'Мировой Босс' },
    { name: 'Перчатки Берсерка',    rarity: ItemRarity.RARE,      dkpPrice: 150,  quantity: 5,  source: 'Данж S-ранга' },
    { name: 'Камень Улучшения +10', rarity: ItemRarity.UNCOMMON,  dkpPrice: 90,   quantity: 10, source: 'Ивент' },
    { name: 'Свиток Призыва',       rarity: ItemRarity.COMMON,    dkpPrice: 30,   quantity: 20, source: 'Ежедневное задание' },
  ];

  for (const item of items) {
    await prisma.warehouseItem.create({
      data: { clanId: clan.id, ...item },
    });
  }

  // ── Activities (3 boss runs) ──────────────────────────────
  const now = new Date();

  const act1 = await prisma.activity.create({
    data: {
      clanId: clan.id,
      type: ActivityType.RAID,
      title: 'Босс Хаоса',
      description: 'Клановый рейд на Босса Хаоса. Минимальный БМ для участия — 30 000. Сбор у портала.',
      baseDkp: 120,
      startAt: new Date(now.getTime() - 3600000),
      endAt: new Date(now.getTime() + 3600000),
      status: ActivityStatus.IN_PROGRESS,
      createdBy: leaderUser.id,
    },
  });

  const act2 = await prisma.activity.create({
    data: {
      clanId: clan.id,
      type: ActivityType.RAID,
      title: 'Босс Ущелья',
      description: 'Рейд на Босса Ущелья. Требуется координация танков и хилеров. Респ через 2 дня.',
      baseDkp: 100,
      startAt: new Date(now.getTime() + 172800000),
      status: ActivityStatus.OPEN,
      createdBy: elderUser.id,
    },
  });

  await prisma.activity.create({
    data: {
      clanId: clan.id,
      type: ActivityType.RAID,
      title: 'Босс Перепутья',
      description: 'Мировой босс на Перепутье. Открытый PvPvE, берём полный состав. Награда — легендарный лут.',
      baseDkp: 150,
      startAt: new Date(now.getTime() + 432000000),
      status: ActivityStatus.OPEN,
      createdBy: leaderUser.id,
    },
  });

  // Add participants to activity1 (Boss Khaosa — in progress)
  for (const u of [leaderUser, elderUser, memberUser, newbieUser]) {
    await prisma.activityParticipant.create({
      data: { activityId: act1.id, userId: u.id },
    });
  }

  // Add participants to activity2 (Boss Uschelya — open)
  for (const u of [leaderUser, elderUser]) {
    await prisma.activityParticipant.create({
      data: { activityId: act2.id, userId: u.id },
    });
  }

  // ── News Post ─────────────────────────────────────────────
  await prisma.newsPost.create({
    data: {
      clanId: clan.id,
      authorId: leaderUser.id,
      title: 'Добро пожаловать в Gods of Ymir!',
      content: `# Приветствуем вас в клане Gods of Ymir!\n\nМы — одни из сильнейших на сервере Legend of Ymir.\n\n## Правила клана\n1. Участие в рейдах на боссов — минимум 2 раза в неделю\n2. DKP начисляются за каждую активность\n3. Лут распределяется через аукцион — честно и прозрачно\n4. Уважение к каждому участнику\n\nПо вопросам обращайтесь к старейшинам. Слава Йимиру!`,
      isPinned: true,
    },
  });

  // ── Notifications ─────────────────────────────────────────
  await prisma.notification.createMany({
    data: [
      {
        userId: memberUser.id,
        type: NotificationType.ACTIVITY_CREATED,
        title: 'Босс Хаоса — рейд начался!',
        body: 'Рейд на Босса Хаоса уже в процессе. Присоединяйтесь!',
      },
      {
        userId: newbieUser.id,
        type: NotificationType.ACTIVITY_CREATED,
        title: 'Новые рейды запланированы',
        body: 'Босс Ущелья и Босс Перепутья ждут вас. Готовьтесь!',
      },
    ],
  });

  console.log('✅ Seed complete!');
  console.log('');
  console.log('Demo accounts (password: demo123):');
  console.log('  superadmin   : admin@ymir.local   (Portal Admin)');
  console.log('  clan_leader  : leader@ymir.local   (Asma31337 — Глава)');
  console.log('  elder        : elder@ymir.local    (Valkyrion — Старейшина)');
  console.log('  member       : member@ymir.local   (RuneKeeper — Участник)');
  console.log('  newbie       : newbie@ymir.local   (FrostBite — Новичок)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
