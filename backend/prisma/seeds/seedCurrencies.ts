/**
 * Seed script for currencies
 *
 * Run standalone: npx ts-node prisma/seeds/seedCurrencies.ts
 * Or imported by runSqlSeed.ts [275a]
 */

import { PrismaClient } from '@prisma/client';
import { CURRENCY_SEED_DATA } from './currencySeedData';

/**
 * Seed currencies into an existing PrismaClient.
 * Exported for use by runSqlSeed.ts [275a].
 */
export async function seedCurrencies(prisma: PrismaClient): Promise<void> {
  console.log('  Seeding currencies...');

  for (const currency of CURRENCY_SEED_DATA) {
    await prisma.currency.upsert({
      where: { code: currency.code },
      create: {
        code: currency.code,
        name: currency.name,
        symbol: currency.symbol,
        decimalPlaces: currency.decimalPlaces,
        isActive: true,
      },
      update: {
        name: currency.name,
        symbol: currency.symbol,
        decimalPlaces: currency.decimalPlaces,
        // Don't overwrite isActive on existing records
      },
    });
  }

  console.log(`  ✓ ${CURRENCY_SEED_DATA.length} currencies upserted`);
}

// Allow standalone execution (original behaviour preserved)
if (require.main === module) {
  const prisma = new PrismaClient();
  seedCurrencies(prisma)
    .catch((e) => {
      console.error('Seed failed:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
