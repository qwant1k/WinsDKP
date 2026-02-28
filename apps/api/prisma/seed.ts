import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding base data...');

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

  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
