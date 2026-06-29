/**
 * seedCOATemplates.ts — SQL seeder for chart_of_accounts_templates table [275a]
 *
 * Reuses canonical COA data from the application accounting templates.
 * The company-wizard reads from this table (via ChartOfAccountsTemplateRepository)
 * when the user picks a COA template during company creation.
 *
 * Idempotent: upserts by stable `code`. Existing pre-code rows are claimed by
 * name once before the code-based update/create, so a rename does not create a
 * duplicate template.
 */

import { PrismaClient } from '@prisma/client';
import {
  StandardCOA,
  SimplifiedCOA,
  ComprehensiveCOA,
  PeriodicTradingCOA,
  ArabicStandardCOA,
  ArabicPeriodicTradingCOA,
} from '../../src/application/accounting/templates/COATemplates';
import {
  ManufacturingCOA,
  ServicesCOA,
  RetailCOA,
} from '../../src/application/accounting/templates/IndustryCOATemplates';

const COA_TEMPLATES = [
  {
    code: 'empty',
    name: 'Empty – Start from Scratch',
    industry: null,
    accounts: [],
    isDefault: false,
  },
  {
    code: 'simplified',
    name: 'Simplified',
    industry: null,
    accounts: SimplifiedCOA,
    isDefault: false,
  },
  {
    code: 'services',
    name: 'Professional Services',
    industry: 'services',
    accounts: ServicesCOA,
    isDefault: false,
  },
  {
    code: 'periodic_trading',
    name: 'Trading Company - Periodic',
    industry: 'trading',
    accounts: PeriodicTradingCOA,
    isDefault: false,
  },
  {
    code: 'periodic_trading_ar',
    name: 'شركة تجارية - دوري',
    industry: 'trading',
    accounts: ArabicPeriodicTradingCOA,
    isDefault: false,
  },
  {
    code: 'standard',
    name: 'Standard (Recommended)',
    industry: null,
    accounts: StandardCOA,
    isDefault: true,
  },
  {
    code: 'standard_ar',
    name: 'قياسي (موصى به)',
    industry: null,
    accounts: ArabicStandardCOA,
    isDefault: false,
  },
  {
    code: 'manufacturing',
    name: 'Manufacturing',
    industry: 'manufacturing',
    accounts: ManufacturingCOA,
    isDefault: false,
  },
  {
    code: 'retail',
    name: 'Retail & E-Commerce',
    industry: 'retail',
    accounts: RetailCOA,
    isDefault: false,
  },
  {
    code: 'full',
    name: 'Comprehensive',
    industry: null,
    accounts: ComprehensiveCOA,
    isDefault: false,
  },
];

export async function seedCOATemplates(prisma: PrismaClient): Promise<void> {
  console.log('  Seeding chart_of_accounts_templates...');
  for (const template of COA_TEMPLATES) {
    const existing = await prisma.chartOfAccountsTemplate.findFirst({
      where: { code: template.code },
      select: { id: true },
    });

    const target = existing ?? await prisma.chartOfAccountsTemplate.findFirst({
      where: { code: null, name: template.name },
      select: { id: true },
    });

    if (target) {
      await prisma.chartOfAccountsTemplate.update({
        where: { id: target.id },
        data: {
          code: template.code,
          name: template.name,
          industry: template.industry,
          accounts: template.accounts,
          isDefault: template.isDefault,
        },
      });
      continue;
    }

    await prisma.chartOfAccountsTemplate.create({
      data: {
        code: template.code,
        name: template.name,
        industry: template.industry,
        accounts: template.accounts,
        isDefault: template.isDefault,
      },
    });
  }
  console.log(`  ✓ ${COA_TEMPLATES.length} COA templates upserted`);
}
