/**
 * Seed script for currencies
 * 
 * Run with: npx ts-node prisma/seeds/seedCurrencies.ts
 */

import { PrismaClient } from '@prisma/client';
import { CURRENCY_SEED_DATA } from './currencySeedData';

const prisma = new PrismaClient();

async function seedCurrencies() {
  console.log('🌱 Seeding currencies...');

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
    console.log(`  ✓ ${currency.code} (${currency.name})`);
  }

  console.log(`\n✅ Seeded ${CURRENCY_SEED_DATA.length} currencies`);
}

seedCurrencies()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
