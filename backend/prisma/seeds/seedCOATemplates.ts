/**
 * seedCOATemplates.ts — SQL seeder for chart_of_accounts_templates table [275a]
 *
 * Reuses canonical COA data from the application accounting templates.
 * The company-wizard reads from this table (via ChartOfAccountsTemplateRepository)
 * when the user picks a COA template during company creation.
 *
 * Idempotent: upserts by (name, industry) composite — since there is no unique
 * code field on ChartOfAccountsTemplate, we match on name.
 *
 * TODO(275a-audit): ChartOfAccountsTemplate has no stable `code` column —
 * we upsert by name which is fragile if names change. Add a `code` column in
 * a future schema migration and re-key this seeder. Tracked as tech-debt.
 */

import { PrismaClient } from '@prisma/client';
import {
  StandardCOA,
  SimplifiedCOA,
  ComprehensiveCOA,
  PeriodicTradingCOA,
} from '../../src/application/accounting/templates/COATemplates';
import {
  ManufacturingCOA,
  ServicesCOA,
  RetailCOA,
} from '../../src/application/accounting/templates/IndustryCOATemplates';

const COA_TEMPLATES = [
  {
    name: 'Empty – Start from Scratch',
    industry: null,
    accounts: [],
    isDefault: false,
  },
  {
    name: 'Simplified',
    industry: null,
    accounts: SimplifiedCOA,
    isDefault: false,
  },
  {
    name: 'Professional Services',
    industry: 'services',
    accounts: ServicesCOA,
    isDefault: false,
  },
  {
    name: 'Trading Company - Periodic',
    industry: 'trading',
    accounts: PeriodicTradingCOA,
    isDefault: false,
  },
  {
    name: 'Standard (Recommended)',
    industry: null,
    accounts: StandardCOA,
    isDefault: true,
  },
  {
    name: 'Manufacturing',
    industry: 'manufacturing',
    accounts: ManufacturingCOA,
    isDefault: false,
  },
  {
    name: 'Retail & E-Commerce',
    industry: 'retail',
    accounts: RetailCOA,
    isDefault: false,
  },
  {
    name: 'Comprehensive',
    industry: null,
    accounts: ComprehensiveCOA,
    isDefault: false,
  },
];

export async function seedCOATemplates(prisma: PrismaClient): Promise<void> {
  console.log('  Seeding chart_of_accounts_templates...');
  for (const template of COA_TEMPLATES) {
    // Find by name (no stable code column — see TODO above)
    const existing = await prisma.chartOfAccountsTemplate.findFirst({
      where: { name: template.name },
      select: { id: true },
    });

    if (existing) {
      await prisma.chartOfAccountsTemplate.update({
        where: { id: existing.id },
        data: {
          industry: template.industry,
          accounts: template.accounts,
          isDefault: template.isDefault,
        },
      });
    } else {
      await prisma.chartOfAccountsTemplate.create({
        data: {
          name: template.name,
          industry: template.industry,
          accounts: template.accounts,
          isDefault: template.isDefault,
        },
      });
    }
  }
  console.log(`  ✓ ${COA_TEMPLATES.length} COA templates upserted`);
}
