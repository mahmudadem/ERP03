/**
 * seedBusinessDomains.ts — SQL seeder for business_domains table [275a]
 *
 * Source data derived from BUSINESS_DOMAINS in seedOnboardingData.ts /
 * seedBusinessDomains.ts (Firestore seeders).
 * Idempotent: upserts by stable `code` key.
 *
 * BusinessDomain.modules is SQL-only starter metadata used for future module
 * suggestions. The wizard does not consume it for v1 company creation, but the
 * SQL seed provides conservative suggestions so the column is not empty.
 */

import { PrismaClient } from '@prisma/client';

const BUSINESS_DOMAIN_DATA = [
  { code: 'trading',       name: 'Trading',       description: 'General trading and wholesale',        modules: ['accounting', 'inventory', 'purchase', 'sales'] },
  { code: 'retail',        name: 'Retail',        description: 'Retail shops and POS',                 modules: ['pos', 'inventory', 'accounting'] },
  { code: 'services',      name: 'Services',      description: 'IT, consulting, maintenance services', modules: ['crm', 'hr', 'accounting'] },
  { code: 'hospitality',   name: 'Hospitality',   description: 'Restaurants, hotels, cafes',           modules: ['pos', 'inventory', 'hr', 'accounting'] },
  { code: 'manufacturing', name: 'Manufacturing', description: 'Factories and production',             modules: ['inventory', 'manufacturing', 'accounting', 'hr'] },
  { code: 'construction',  name: 'Construction',  description: 'Contractors and builders',             modules: ['projects', 'accounting', 'hr', 'inventory'] },
  { code: 'real-estate',   name: 'Real Estate',   description: 'Property brokers and agencies',        modules: ['crm', 'accounting'] },
  { code: 'education',     name: 'Education',     description: 'Training centers and schools',         modules: ['crm', 'hr', 'accounting'] },
  { code: 'healthcare',    name: 'Healthcare',    description: 'Clinics and medical practices',        modules: ['crm', 'inventory', 'hr', 'accounting'] },
  { code: 'logistics',     name: 'Logistics',     description: 'Transportation and delivery',          modules: ['accounting', 'hr', 'crm'] },
  { code: 'ecommerce',     name: 'E-Commerce',    description: 'Online sellers',                       modules: ['inventory', 'crm', 'accounting'] },
  { code: 'nonprofit',     name: 'Non-Profit',    description: 'NGOs and charities',                   modules: ['accounting', 'crm', 'hr'] },
  { code: 'distribution',  name: 'Distribution',  description: 'Wholesale distribution',               modules: ['inventory', 'crm', 'accounting', 'purchase'] },
];

export async function seedBusinessDomains(prisma: PrismaClient): Promise<void> {
  console.log('  Seeding business_domains...');
  for (const domain of BUSINESS_DOMAIN_DATA) {
    await prisma.businessDomain.upsert({
      where: { code: domain.code },
      create: {
        code: domain.code,
        name: domain.name,
        description: domain.description,
        modules: domain.modules,
      },
      update: {
        name: domain.name,
        description: domain.description,
        modules: domain.modules,
      },
    });
  }
  console.log(`  ✓ ${BUSINESS_DOMAIN_DATA.length} business domains upserted`);
}
