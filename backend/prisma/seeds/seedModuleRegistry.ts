/**
 * seedModuleRegistry.ts — SQL seeder for module_registries table [275a]
 *
 * Source data derived from seedOnboardingData.ts (Firestore seeder).
 * Idempotent: upserts by stable `code` key.
 *
 * lifecycleStatus "ready" vs "draft" follows the v1 launch scope: modules with
 * tested runtime code are marked ready; future placeholders remain draft.
 * AI is deliberately omitted from the registry for v1 per Epic 275.
 */

import { PrismaClient } from '@prisma/client';

const IMPLEMENTED_MODULES = new Set([
  'accounting',
  'inventory',
  'purchase',
  'sales',
]);

const MODULE_REGISTRY_DATA = [
  { code: 'accounting',    name: 'Accounting',    description: 'Core Accounting module' },
  { code: 'inventory',     name: 'Inventory',     description: 'Core Inventory module' },
  { code: 'hr',            name: 'Hr',            description: 'Core Hr module' },
  { code: 'crm',           name: 'Crm',           description: 'Core Crm module' },
  { code: 'pos',           name: 'Pos',           description: 'Core Pos module' },
  { code: 'manufacturing', name: 'Manufacturing', description: 'Core Manufacturing module' },
  { code: 'projects',      name: 'Projects',      description: 'Core Projects module' },
  { code: 'purchase',      name: 'Purchase',      description: 'Core Purchase module' },
  { code: 'companyAdmin',  name: 'CompanyAdmin',  description: 'Core CompanyAdmin module' },
  { code: 'system',        name: 'System',        description: 'Core System module' },
];

export async function seedModuleRegistry(prisma: PrismaClient): Promise<void> {
  console.log('  Seeding module_registries...');
  await prisma.moduleRegistry.deleteMany({ where: { code: 'ai-assistant' } });
  for (const mod of MODULE_REGISTRY_DATA) {
    const isImplemented = IMPLEMENTED_MODULES.has(mod.code);
    await prisma.moduleRegistry.upsert({
      where: { code: mod.code },
      create: {
        code: mod.code,
        name: mod.name,
        description: mod.description,
        version: '1.0.0',
        lifecycleStatus: isImplemented ? 'ready' : 'draft',
        runtimeStatus: 'available',
        implementationStatus: isImplemented ? 'passed' : 'unchecked',
        dependencies: [],
      },
      update: {
        name: mod.name,
        description: mod.description,
        lifecycleStatus: isImplemented ? 'ready' : 'draft',
        implementationStatus: isImplemented ? 'passed' : 'unchecked',
      },
    });
  }
  console.log(`  ✓ ${MODULE_REGISTRY_DATA.length} module registry entries upserted`);
}
