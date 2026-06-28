/**
 * seedModuleRegistry.ts — SQL seeder for module_registries table [275a]
 *
 * Source data derived from seedOnboardingData.ts (Firestore seeder).
 * Idempotent: upserts by stable `code` key.
 *
 * TODO(275a-audit): lifecycleStatus "ready" vs "draft" is inferred from the
 * IMPLEMENTED_CODE_MODULES set in the Firestore seeder.  If new modules are
 * implemented between 275a and audit, add them to IMPLEMENTED_MODULES below.
 */

import { PrismaClient } from '@prisma/client';

const IMPLEMENTED_MODULES = new Set([
  'accounting',
  'inventory',
  'purchase',
  'sales',
  // ai-assistant is deliberately excluded for v1 per Epic 275 locked decisions
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
  // TODO(275a-audit): ai-assistant excluded per v1 scope; add when AI module is ported
];

export async function seedModuleRegistry(prisma: PrismaClient): Promise<void> {
  console.log('  Seeding module_registries...');
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
