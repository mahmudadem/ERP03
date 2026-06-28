/**
 * runSqlSeed.ts — Main entrypoint for `npm run seed:sql` [275a]
 *
 * Runs all SQL system seeders in dependency order against DATABASE_URL.
 * Safe to run multiple times — every seeder is idempotent (upsert-based).
 *
 * Order:
 *   1. currencies          (no deps)
 *   2. system_metadata     (depends on currencies data)
 *   3. business_domains    (no deps)
 *   4. module_registry     (no deps)
 *   5. permission_registry (no deps)
 *   6. bundle_registry     (no deps)
 *   7. plan_registry       (no deps)
 *   8. role_templates      (no deps)
 *   9. coa_templates       (no deps — reads from app source files)
 *  10. voucher_type_defs   (no deps — writes to companyId='SYSTEM')
 *
 * Usage:
 *   DATABASE_URL=postgresql://... npx ts-node --transpile-only prisma/seeds/runSqlSeed.ts
 *   or via: npm run seed:sql
 */

import { PrismaClient } from '@prisma/client';
import { seedCurrencies } from './seedCurrencies';
import { seedSystemMetadata } from './seedSystemMetadata';
import { seedBusinessDomains } from './seedBusinessDomains';
import { seedModuleRegistry } from './seedModuleRegistry';
import { seedPermissionRegistry } from './seedPermissionRegistry';
import { seedBundleRegistry } from './seedBundleRegistry';
import { seedPlanRegistry } from './seedPlanRegistry';
import { seedRoleTemplates } from './seedRoleTemplates';
import { seedCOATemplates } from './seedCOATemplates';
import { seedVoucherTypeDefinitions } from './seedVoucherTypeDefinitions';

async function runSqlSeed(): Promise<void> {
  const prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

  console.log('====================================================');
  console.log('  ERP03 — SQL System Seeder [275a]');
  console.log('  DATABASE_URL:', process.env.DATABASE_URL ? '[set]' : '[NOT SET — will fail]');
  console.log('====================================================\n');

  try {
    // 1. Currencies
    console.log('Step 1/10 — Currencies');
    await seedCurrencies(prisma);

    // 2. System metadata (currencies manifest + COA template manifest)
    console.log('\nStep 2/10 — System Metadata');
    await seedSystemMetadata(prisma);

    // 3. Business domains
    console.log('\nStep 3/10 — Business Domains');
    await seedBusinessDomains(prisma);

    // 4. Module registry
    console.log('\nStep 4/10 — Module Registry');
    await seedModuleRegistry(prisma);

    // 5. Permission registry
    console.log('\nStep 5/10 — Permission Registry');
    await seedPermissionRegistry(prisma);

    // 6. Bundle registry
    console.log('\nStep 6/10 — Bundle Registry');
    await seedBundleRegistry(prisma);

    // 7. Plan registry
    console.log('\nStep 7/10 — Plan Registry');
    await seedPlanRegistry(prisma);

    // 8. Role templates
    console.log('\nStep 8/10 — Role Templates');
    await seedRoleTemplates(prisma);

    // 9. COA templates (reads canonical data from app source)
    console.log('\nStep 9/10 — COA Templates');
    await seedCOATemplates(prisma);

    // 10. Voucher type definitions (SYSTEM company)
    console.log('\nStep 10/10 — Voucher Type Definitions');
    await seedVoucherTypeDefinitions(prisma);

    console.log('\n====================================================');
    console.log('  ALL SYSTEM SEEDING COMPLETE');
    console.log('====================================================');
  } catch (error: any) {
    console.error('\nCRITICAL SEED ERROR:', error.message);
    if (error.stack) console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runSqlSeed();
