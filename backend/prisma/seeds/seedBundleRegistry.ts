/**
 * seedBundleRegistry.ts — SQL seeder for bundle_registries + bundle_items tables [275a]
 *
 * Source data derived from BUNDLES in seedOnboardingData.ts.
 * Idempotent: upserts BundleRegistry by `code`; upserts BundleItem by [bundleId, itemKey].
 */

import { PrismaClient } from '@prisma/client';

const BUNDLE_DATA = [
  { code: 'trading-basic',         name: 'General Trading',                description: 'Suitable for normal trading companies.',                     modules: ['accounting', 'inventory'] },
  { code: 'trading-plus',          name: 'General Trading +',              description: 'Trading company with HR support.',                           modules: ['accounting', 'inventory', 'hr'] },
  { code: 'retail-pos',            name: 'Retail / POS',                   description: 'For retail shops and supermarkets.',                         modules: ['pos', 'inventory', 'accounting'] },
  { code: 'wholesale',             name: 'Wholesale Trading',              description: 'For wholesalers and distribution companies.',                 modules: ['inventory', 'crm', 'accounting', 'purchase'] },
  { code: 'services',              name: 'Services Company',               description: 'For IT, consulting, maintenance, etc.',                      modules: ['crm', 'hr', 'accounting'] },
  { code: 'restaurant',            name: 'Restaurant',                     description: 'POS + Inventory + HR for restaurants.',                      modules: ['pos', 'inventory', 'hr', 'accounting'] },
  { code: 'bakery',                name: 'Bakery / Food Production',       description: 'Suitable for bakeries and food factories.',                  modules: ['pos', 'inventory', 'manufacturing', 'accounting'] },
  { code: 'maintenance',           name: 'Maintenance Workshop',           description: 'Workshops handling repairs and service orders.',             modules: ['crm', 'inventory', 'accounting'] },
  { code: 'manufacturing-basic',   name: 'Manufacturing – Basic',          description: 'For small manufacturers.',                                   modules: ['inventory', 'manufacturing', 'accounting'] },
  { code: 'manufacturing-advanced', name: 'Manufacturing – Advanced',      description: 'For medium and large factories.',                            modules: ['inventory', 'manufacturing', 'accounting', 'hr', 'purchase'] },
  { code: 'construction',          name: 'Construction / Contracting',     description: 'Contractors, builders, and project companies.',              modules: ['projects', 'accounting', 'hr', 'inventory'] },
  { code: 'real-estate',           name: 'Real Estate Agency',             description: 'Real estate brokers and agencies.',                          modules: ['crm', 'accounting'] },
  { code: 'education',             name: 'Education / Training Center',    description: 'Training institutes and educational centers.',               modules: ['crm', 'hr', 'accounting'] },
  { code: 'clinic',                name: 'Clinic / Medical Office',        description: 'Small medical practices.',                                   modules: ['crm', 'inventory', 'hr', 'accounting'] },
  { code: 'logistics',             name: 'Logistics & Transportation',     description: 'Transport, delivery, and logistics services.',               modules: ['accounting', 'hr', 'crm'] },
  { code: 'ecommerce',             name: 'E-Commerce Seller',              description: 'Online sellers and marketplace merchants.',                  modules: ['inventory', 'crm', 'accounting'] },
  { code: 'freelancer',            name: 'Freelancer / Solo Entrepreneur', description: 'For individual freelancers.',                                modules: ['accounting', 'crm'] },
  { code: 'nonprofit',             name: 'Non-Profit Organization',        description: 'For NGOs and non-profit entities.',                          modules: ['accounting', 'crm', 'hr'] },
  { code: 'salon',                 name: 'Beauty Salon & Spa',             description: 'For salons, spas, and beauty centers.',                     modules: ['pos', 'inventory', 'hr'] },
  { code: 'empty-company',         name: 'Empty Company',                  description: 'Start with no modules and configure manually.',              modules: [] },
];

export async function seedBundleRegistry(prisma: PrismaClient): Promise<void> {
  console.log('  Seeding bundle_registries + bundle_items...');
  for (const bundle of BUNDLE_DATA) {
    // Upsert the bundle header
    const record = await prisma.bundleRegistry.upsert({
      where: { code: bundle.code },
      create: {
        code: bundle.code,
        name: bundle.name,
        description: bundle.description,
        lifecycleStatus: 'ready',
        modules: bundle.modules,
      },
      update: {
        name: bundle.name,
        description: bundle.description,
        modules: bundle.modules,
      },
    });

    // Upsert bundle items (module memberships)
    for (const moduleCode of bundle.modules) {
      await prisma.bundleItem.upsert({
        where: { bundleId_itemKey: { bundleId: record.id, itemKey: moduleCode } },
        create: {
          bundleId: record.id,
          itemType: 'module',
          itemKey: moduleCode,
        },
        update: {
          itemType: 'module',
        },
      });
    }
  }
  console.log(`  ✓ ${BUNDLE_DATA.length} bundle registry entries upserted`);
}
