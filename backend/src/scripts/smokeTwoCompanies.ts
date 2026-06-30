/**
 * smokeTwoCompanies.ts — End-to-end "create two companies" smoke test (SQL mode)
 *
 * WHY THIS EXISTS
 * ---------------
 * Company creation was ported from Firestore to SQL/Postgres. Postgres enforces
 * three invariants Firestore did not, and each surfaced as a production crash that
 * ONLY appears on the *second* company (or on a mid-flow failure):
 *   1. UNIQUE on empty string  — blank taxId '' collided (now nullable).
 *   2. Stable string ids as global PKs — role id 'OWNER' collided (now composite PK).
 *   3. No cross-doc transaction — a mid-flow failure orphaned a company row (now rolled back).
 *
 * A single company creating successfully proves none of these. This test creates
 * TWO companies back-to-back with the SAME owner and SAME bundle — the exact shape
 * that triggers all three — and fully initializes every module on both, so any
 * remaining instance of the same bug class fails here instead of in the user's app.
 *
 * It drives the real use cases (CreateCompanyUseCase + SimpleTradingCompanyInitializer)
 * through the production DI container — identical to OnboardingController.createCompany.
 *
 * USAGE:  npm run smoke:companies         (requires DB_TYPE=SQL + `npm run seed:sql` first)
 * Exits 0 if both companies fully provision, 1 otherwise. Cleans up everything it creates.
 */

import { diContainer } from '../infrastructure/di/bindRepositories';
import { CreateCompanyUseCase } from '../application/onboarding/use-cases/CreateCompanyUseCase';
import { SimpleTradingCompanyInitializer } from '../application/onboarding/use-cases/SimpleTradingCompanyInitializer';
import { CompanyRolePermissionResolver } from '../application/rbac/CompanyRolePermissionResolver';
import { CreateVoucherUseCase } from '../application/accounting/use-cases/VoucherUseCases';
import { PermissionChecker } from '../application/rbac/PermissionChecker';
import { GetCurrentUserPermissionsForCompanyUseCase } from '../application/rbac/use-cases/GetCurrentUserPermissionsForCompanyUseCase';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({ log: ['error'] });
const RUN_TAG = `SMOKE-${Date.now().toString(36)}`;

type StepResult = { name: string; ok: boolean; detail?: string };

function line(ok: boolean, label: string, detail = '') {
  console.log(`  ${ok ? '✓' : '✗'} ${label}${detail ? ' — ' + detail : ''}`);
}

async function pickActorUserId(): Promise<string> {
  const user = await prisma.user.findFirst({ where: { globalRole: 'USER' }, select: { id: true, email: true } });
  if (!user) throw new Error('No non-admin USER found to act as company owner. Seed a user first.');
  console.log(`Actor (owner): ${user.id} (${user.email})`);
  return user.id;
}

async function pickReadyBundleId(): Promise<string> {
  // Prefer a module-rich bundle so initialization exercises the most seeders.
  const preferred = await prisma.bundleRegistry.findFirst({
    where: { lifecycleStatus: 'ready', name: { in: ['Retail / POS', 'General Trading +', 'General Trading'] } },
    select: { id: true, name: true },
  });
  const bundle = preferred ?? await prisma.bundleRegistry.findFirst({ where: { lifecycleStatus: 'ready' }, select: { id: true, name: true } });
  if (!bundle) throw new Error('No ready bundle found. Run `npm run seed:sql`.');
  console.log(`Bundle: ${bundle.id} (${bundle.name})`);
  return bundle.id;
}

async function createCompany(userId: string, bundleId: string, label: string): Promise<string> {
  const resolver = new CompanyRolePermissionResolver(
    diContainer.modulePermissionsDefinitionRepository,
    diContainer.companyRoleRepository
  );
  const useCase = new CreateCompanyUseCase(
    diContainer.companyRepository,
    diContainer.userRepository,
    diContainer.rbacCompanyUserRepository,
    diContainer.companyRoleRepository,
    resolver,
    diContainer.bundleRegistryRepository,
    diContainer.bundleRegistryRepository as any,
    diContainer.companyModuleRepository,
    diContainer.companySettingsRepository,
    diContainer.companyEntitlementRepository
  );

  const { companyId } = await useCase.execute({
    userId,
    companyName: `${RUN_TAG} ${label}`,
    description: 'smoke test',
    country: 'US',
    email: 'smoke@test.local',
    bundleId,
    currency: 'USD',
    language: 'en',
    timezone: 'UTC',
    dateFormat: 'MM/DD/YYYY',
    autoInitializeModules: true,
    starterTemplateId: 'simple-trading-company',
    accountingMode: 'PERPETUAL',
  } as any);

  const initializer = new SimpleTradingCompanyInitializer({
    companyRepo: diContainer.companyRepository,
    companyModuleRepo: diContainer.companyModuleRepository,
    accountRepo: diContainer.accountRepository,
    systemMetadataRepo: diContainer.systemMetadataRepository,
    companyModuleSettingsRepo: diContainer.companyModuleSettingsRepository,
    companySettingsRepo: diContainer.companySettingsRepository,
    currencyRepo: diContainer.currencyRepository,
    fiscalYearRepo: diContainer.fiscalYearRepository,
    voucherTypeRepo: diContainer.voucherTypeDefinitionRepository,
    voucherFormRepo: diContainer.voucherFormRepository,
    inventorySettingsRepo: diContainer.inventorySettingsRepository,
    warehouseRepo: diContainer.warehouseRepository,
    uomRepo: diContainer.uomRepository,
    salesSettingsRepo: diContainer.salesSettingsRepository,
    purchaseSettingsRepo: diContainer.purchaseSettingsRepository,
    posSettingsRepo: diContainer.posSettingsRepository,
    posRegisterRepo: diContainer.posRegisterRepository,
    partyRepo: diContainer.partyRepository,
  });

  await initializer.execute({
    companyId,
    userId,
    baseCurrency: 'USD',
    accountingMode: 'PERPETUAL',
    coaTemplate: 'standard',
    costingBasis: 'GLOBAL',
    defaultWarehouseCode: 'MAIN',
    defaultWarehouseName: 'Main Warehouse',
    salesWorkflowMode: 'SIMPLE',
    purchaseWorkflowMode: 'SIMPLE',
  } as any);

  return companyId;
}

// Post a balanced journal voucher through the real CreateVoucherUseCase (auto-posts
// to the ledger). This exercises the posting engine, voucher sequences, fiscal-year
// resolution and account lookups per company — the layer most likely to hide the next
// per-company id/scoping bug.
async function postBalancedJournal(companyId: string, userId: string): Promise<void> {
  const accounts = await prisma.account.findMany({
    where: { companyId, accountRole: 'POSTING', status: 'ACTIVE' },
    select: { id: true, fixedCurrencyCode: true },
    take: 2,
  });
  if (accounts.length < 2) throw new Error(`need >= 2 POSTING accounts to post a journal, found ${accounts.length}`);

  // Use a plain journal voucher — other accounting types (fx_revaluation, payment,
  // receipt, opening_balance) drive special posting strategies with extra requirements.
  const vtypes = await prisma.voucherTypeDefinition.findMany({
    where: { companyId, module: { equals: 'ACCOUNTING', mode: 'insensitive' } },
    select: { code: true },
  });
  const vtype = vtypes.find((t) => /journal/i.test(t.code)) ?? vtypes[0];
  if (!vtype) throw new Error('no ACCOUNTING voucher type found for company');

  const permissionChecker = new PermissionChecker(
    new GetCurrentUserPermissionsForCompanyUseCase(
      diContainer.userRepository,
      diContainer.rbacCompanyUserRepository,
      diContainer.companyRoleRepository
    )
  );
  const useCase = new CreateVoucherUseCase(
    diContainer.voucherRepository as any,
    diContainer.accountRepository as any,
    diContainer.companyModuleSettingsRepository as any,
    permissionChecker,
    diContainer.transactionManager as any,
    diContainer.voucherTypeDefinitionRepository as any,
    diContainer.accountingPolicyConfigProvider as any,
    diContainer.ledgerRepository as any,
    diContainer.policyRegistry as any,
    diContainer.companyCurrencyRepository as any,
    diContainer.voucherSequenceRepository as any,
    diContainer.numberingEngine as any
  );

  await useCase.execute(companyId, userId, {
    type: vtype.code,
    date: new Date().toISOString(),
    currency: 'USD',
    narration: 'smoke balanced journal',
    lines: [
      { accountId: accounts[0].id, side: 'Debit', amount: 100, currency: 'USD' },
      { accountId: accounts[1].id, side: 'Credit', amount: 100, currency: 'USD' },
    ],
  });
}

async function verify(companyId: string, label: string): Promise<StepResult[]> {
  console.log(`\nVerifying ${label} (${companyId}):`);
  const checks: StepResult[] = [];
  const add = async (name: string, fn: () => Promise<number>) => {
    try {
      const n = await fn();
      const ok = n > 0;
      checks.push({ name, ok, detail: `${n}` });
      line(ok, name, `${n} row(s)`);
    } catch (e: any) {
      checks.push({ name, ok: false, detail: e.message });
      line(false, name, e.message);
    }
  };
  await add('company row', async () => prisma.company.count({ where: { id: companyId } }));
  await add('roles (OWNER/ADMIN/MEMBER)', async () => prisma.companyRole.count({ where: { companyId } }));
  await add('owner membership', async () => prisma.companyUser.count({ where: { companyId, isOwner: true } }));
  await add('settings', async () => prisma.companySettings.count({ where: { companyId } }));
  await add('company modules', async () => prisma.companyModule.count({ where: { companyId } }));
  await add('entitlement', async () => prisma.companyEntitlement.count({ where: { companyId } }));
  await add('chart of accounts', async () => prisma.account.count({ where: { companyId } }));
  await add('fiscal year', async () => prisma.fiscalYear.count({ where: { companyId } }));
  await add('currencies seeded', async () => prisma.companyCurrency.count({ where: { companyId } }));
  await add('voucher types copied', async () => prisma.voucherTypeDefinition.count({ where: { companyId } }));
  await add('voucher forms created', async () => prisma.voucherForm.count({ where: { companyId } }));
  // Classification must be canonical UPPERCASE (case-sensitive comparisons depend on it).
  await add('no lowercase account classifications', async () => {
    const bad = await prisma.account.count({ where: { companyId, classification: { in: ['asset', 'liability', 'equity', 'revenue', 'expense', 'income'] } } });
    if (bad > 0) throw new Error(`${bad} account(s) have non-canonical classification`);
    return 1;
  });
  // "POSTED" is a financial-effect indicator, not a status string (see VoucherEntity) —
  // the proof of posting is balanced ledger entries below, not the voucher's status.
  await add('voucher recorded', async () => prisma.voucher.count({ where: { companyId } }));
  await add('ledger entries created', async () => prisma.ledgerEntry.count({ where: { companyId } }));
  await add('ledger balanced (debit == credit)', async () => {
    const agg = await prisma.ledgerEntry.aggregate({ where: { companyId }, _sum: { debit: true, credit: true } });
    const d = Number(agg._sum.debit || 0);
    const c = Number(agg._sum.credit || 0);
    if (Math.abs(d - c) > 0.001) throw new Error(`unbalanced: debit ${d} != credit ${c}`);
    return 1;
  });
  return checks;
}

async function cleanup() {
  const companies = await prisma.company.findMany({ where: { name: { startsWith: RUN_TAG } }, select: { id: true } });
  for (const c of companies) {
    // Ledger entries and voucher lines RESTRICT account deletion, so remove transaction
    // data first; the rest (roles/settings/accounts/...) cascades from the company.
    await prisma.ledgerEntry.deleteMany({ where: { companyId: c.id } }).catch(() => {});
    await prisma.voucher.deleteMany({ where: { companyId: c.id } }).catch(() => {}); // cascades voucher_lines
    await prisma.company.delete({ where: { id: c.id } }).catch((e) => console.warn(`cleanup ${c.id}: ${e.message}`));
  }
  console.log(`\nCleanup: removed ${companies.length} test company(ies).`);
}

async function main() {
  console.log(`=== Two-company smoke test [${RUN_TAG}] ===\n`);
  let failures = 0;
  let allChecks: StepResult[] = [];
  try {
    const userId = await pickActorUserId();
    const bundleId = await pickReadyBundleId();

    console.log('\n--- Creating company #1 ---');
    const c1 = await createCompany(userId, bundleId, 'Alpha');
    line(true, 'company #1 created + initialized', c1);

    // The second creation with the SAME owner + bundle is what historically crashed.
    console.log('\n--- Creating company #2 (same owner, same bundle) ---');
    const c2 = await createCompany(userId, bundleId, 'Beta');
    line(true, 'company #2 created + initialized', c2);

    // Post a balanced journal on BOTH — proves the accounting engine works per company.
    console.log('\n--- Posting a balanced journal on each company ---');
    for (const [cid, lbl] of [[c1, 'company #1'], [c2, 'company #2']] as const) {
      await postBalancedJournal(cid, userId);
      line(true, `journal posted on ${lbl}`, cid);
    }

    allChecks = [...await verify(c1, 'company #1'), ...await verify(c2, 'company #2')];
    failures = allChecks.filter((c) => !c.ok).length;
  } catch (e: any) {
    console.error(`\n✗ FATAL: ${e.message}`);
    if (e.stack) console.error(e.stack.split('\n').slice(0, 6).join('\n'));
    failures = Math.max(failures, 1);
  } finally {
    await cleanup().catch(() => {});
    await prisma.$disconnect();
  }

  console.log(`\n=== Result: ${failures === 0 ? 'PASS ✅' : `FAIL ❌ (${failures} check(s))`} ===`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
