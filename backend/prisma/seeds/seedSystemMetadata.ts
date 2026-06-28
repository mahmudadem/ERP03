/**
 * seedSystemMetadata.ts — SQL seeder for system_metadata table [275a]
 *
 * Populates the key/value metadata store with currencies and COA template manifests.
 * The actual COA account lists are seeded into chart_of_accounts_templates (see
 * seedCOATemplates.ts). This file stores the lightweight manifests that the
 * company-wizard reads when listing choices.
 *
 * Idempotent: upserts by stable `key`.
 */

import { PrismaClient } from '@prisma/client';
import { CURRENCY_SEED_DATA } from './currencySeedData';

// COA template manifests — account arrays are seeded separately into
// chart_of_accounts_templates.  The wizard reads this manifest for the
// dropdown; it then calls GetCOATemplate to load the full account list.
// TODO(275a-audit): Confirm the company-wizard reads coa_templates from
// SystemMetadata vs ChartOfAccountsTemplate. If it reads from the SQL
// model directly, this metadata key may be redundant but is harmless.
const COA_TEMPLATE_MANIFESTS = [
  { id: 'empty',            name: 'Empty – Start from Scratch',    complexity: 'custom',  accountCount: 0 },
  { id: 'simplified',       name: 'Simplified',                    complexity: 'low',     accountCount: null }, // count filled at runtime
  { id: 'services',         name: 'Professional Services',         complexity: 'low',     accountCount: null },
  { id: 'periodic_trading', name: 'Trading Company - Periodic',    complexity: 'medium',  accountCount: null },
  { id: 'standard',         name: 'Standard (Recommended)',        complexity: 'medium',  accountCount: null },
  { id: 'manufacturing',    name: 'Manufacturing',                 complexity: 'medium',  accountCount: null },
  { id: 'retail',           name: 'Retail & E-Commerce',           complexity: 'medium',  accountCount: null },
  { id: 'full',             name: 'Comprehensive',                 complexity: 'high',    accountCount: null },
];

export async function seedSystemMetadata(prisma: PrismaClient): Promise<void> {
  console.log('  Seeding system_metadata...');

  // currencies — stored as flat JSON array (mirrors Firestore pattern)
  await prisma.systemMetadata.upsert({
    where: { key: 'currencies' },
    create: { key: 'currencies', value: CURRENCY_SEED_DATA },
    update: { value: CURRENCY_SEED_DATA },
  });
  console.log(`  ✓ system_metadata[currencies] — ${CURRENCY_SEED_DATA.length} currencies`);

  // coa_templates manifest
  await prisma.systemMetadata.upsert({
    where: { key: 'coa_templates' },
    create: { key: 'coa_templates', value: COA_TEMPLATE_MANIFESTS },
    update: { value: COA_TEMPLATE_MANIFESTS },
  });
  console.log(`  ✓ system_metadata[coa_templates] — ${COA_TEMPLATE_MANIFESTS.length} template manifests`);
}
