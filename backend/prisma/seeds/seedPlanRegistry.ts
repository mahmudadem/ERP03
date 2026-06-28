/**
 * seedPlanRegistry.ts — SQL seeder for plan_registries table [275a]
 *
 * Source data derived from PLANS in seedOnboardingData.ts.
 * Idempotent: upserts by stable `code` key.
 */

import { PrismaClient } from '@prisma/client';

const PLAN_DATA = [
  {
    code: 'free',
    name: 'Free Trial',
    description: 'Free trial plan with basic limits',
    limits: { maxCompanies: 1, maxUsersPerCompany: 1, maxModulesAllowed: 999, maxStorageMB: 100, maxTransactionsPerMonth: 100 },
    pricing: { price: 0, currency: 'USD', interval: 'month' },
  },
  {
    code: 'starter',
    name: 'Starter',
    description: 'Starter plan for small businesses',
    limits: { maxCompanies: 1, maxUsersPerCompany: 1, maxModulesAllowed: 2, maxStorageMB: 500, maxTransactionsPerMonth: 500 },
    pricing: { price: 9, currency: 'USD', interval: 'month' },
  },
  {
    code: 'advanced',
    name: 'Advanced',
    description: 'Advanced plan for growing businesses',
    limits: { maxCompanies: 3, maxUsersPerCompany: 5, maxModulesAllowed: 5, maxStorageMB: 2000, maxTransactionsPerMonth: 2000 },
    pricing: { price: 39, currency: 'USD', interval: 'month' },
  },
  {
    code: 'business',
    name: 'Business',
    description: 'Business plan for established companies',
    limits: { maxCompanies: 10, maxUsersPerCompany: 20, maxModulesAllowed: 999, maxStorageMB: 10000, maxTransactionsPerMonth: 10000 },
    pricing: { price: 99, currency: 'USD', interval: 'month' },
  },
  {
    code: 'enterprise',
    name: 'Enterprise',
    description: 'Enterprise plan for large organizations',
    limits: { maxCompanies: 999, maxUsersPerCompany: 999, maxModulesAllowed: 999, maxStorageMB: 100000, maxTransactionsPerMonth: 100000 },
    pricing: { price: 999, currency: 'USD', interval: 'month' },
  },
];

export async function seedPlanRegistry(prisma: PrismaClient): Promise<void> {
  console.log('  Seeding plan_registries...');
  for (const plan of PLAN_DATA) {
    await prisma.planRegistry.upsert({
      where: { code: plan.code },
      create: {
        code: plan.code,
        name: plan.name,
        description: plan.description,
        limits: plan.limits,
        pricing: plan.pricing,
      },
      update: {
        name: plan.name,
        description: plan.description,
        limits: plan.limits,
        pricing: plan.pricing,
      },
    });
  }
  console.log(`  ✓ ${PLAN_DATA.length} plan registry entries upserted`);
}
