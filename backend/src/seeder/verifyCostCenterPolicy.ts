import * as admin from 'firebase-admin';
import { CreateVoucherUseCase, PostVoucherUseCase } from '../application/accounting/use-cases/VoucherUseCases';
import { FirestoreVoucherRepositoryV2 } from '../infrastructure/firestore/repositories/accounting/FirestoreVoucherRepositoryV2';
import { FirestoreLedgerRepository } from '../infrastructure/firestore/repositories/accounting/FirestoreLedgerRepository';
import { FirestoreTransactionManager } from '../infrastructure/firestore/transaction/FirestoreTransactionManager';
import { FirestoreAccountingPolicyConfigProvider } from '../infrastructure/accounting/config/FirestoreAccountingPolicyConfigProvider';
import { AccountingPolicyRegistry } from '../application/accounting/policies/AccountingPolicyRegistry';
import { FirestoreUserAccessScopeProvider } from '../infrastructure/accounting/access/FirestoreUserAccessScopeProvider';
import { FirestoreAccountLookupService } from '../infrastructure/accounting/services/FirestoreAccountLookupService';
import { PermissionChecker } from '../application/rbac/PermissionChecker';
import { VoucherType } from '../domain/accounting/types/VoucherTypes';

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'erp-03',
  });
}

const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });

// Mock PermissionChecker
const mockPermissionChecker = {
  assertOrThrow: async () => Promise.resolve(),
} as unknown as PermissionChecker;

// Mock objects
const mockSettingsRepo: any = {
  getSettings: async () => ({ autoNumbering: true, baseCurrency: 'USD' }),
};

const mockAccountRepo: any = {
  getById: async () => ({ id: 'test', active: true, type: 'expense', code: 'EXP-001', name: 'Travel Expense' }),
};

async function verifyCostCenterPolicy() {
  console.log('\n=== Phase 4.2: Cost Center Required Policy Verification ===\n');

  const companyId = 'test_company_' + Date.now();
  const userId = 'test_user';

  // Setup repositories
  const voucherRepo = new FirestoreVoucherRepositoryV2(db);
  const ledgerRepo = new FirestoreLedgerRepository(db);
  const transactionManager = new FirestoreTransactionManager(db);
  const configProvider = new FirestoreAccountingPolicyConfigProvider(db);
  const userScopeProvider = new FirestoreUserAccessScopeProvider(db);
  const accountLookup = new FirestoreAccountLookupService(db);
  
  const policyRegistry = new AccountingPolicyRegistry(
    configProvider,
    userScopeProvider,
    accountLookup
  );

  // Create use cases
  const createUseCase = new CreateVoucherUseCase(
    voucherRepo,
    mockAccountRepo,
    mockSettingsRepo,
    mockPermissionChecker,
    transactionManager,
    null
  );

  const postUseCase = new PostVoucherUseCase(
    voucherRepo,
    ledgerRepo,
    mockPermissionChecker,
    transactionManager,
    policyRegistry
  );

  try {
    // Setup test accounts with types
    await db.collection('companies').doc(companyId).collection('accounts').doc('acc-expense').set({
      id: 'acc-expense',
      code: 'EXP-001',
      name: 'Travel Expense',
      type: 'expense',
      active: true
    });

    await db.collection('companies').doc(companyId).collection('accounts').doc('acc-cash').set({
      id: 'acc-cash',
      code: 'CASH-001',
      name: 'Cash',
      type: 'asset',
      active: true
    });

    // SCENARIO 1: Policy Disabled → Missing cost center allowed
    console.log('SCENARIO 1: Policy Disabled\n');
    await db
      .collection('companies')
      .doc(companyId)
      .collection('settings')
      .doc('accounting')
      .set({
        approvalRequired: false,
        periodLockEnabled: false,
        accountAccessEnabled: false,
        costCenterPolicy: {
          enabled: false
        }
      });

    const payload1: any = {
      type: VoucherType.JOURNAL_ENTRY,
      date: '2025-01-15',
      description: 'Test - No cost center',
      currency: 'USD',
      lines: [
        { accountId: 'acc-expense', debitFx: 100, creditFx: 0, debitBase: 100, creditBase: 0 }, // No costCenterId
        { accountId: 'acc-cash', debitFx: 0, creditFx: 100, debitBase: 0, creditBase: 100 }
      ]
    };

    const voucher1 = await createUseCase.execute(companyId, userId, payload1);
    await postUseCase.execute(companyId, userId, voucher1.id);
    console.log('  ✓ Policy disabled: Posted voucher without cost center\n');

    // SCENARIO 2: Policy Enabled → Missing cost center DENIED
    console.log('SCENARIO 2: Policy Enabled - Missing Cost Center\n');
    await db
      .collection('companies')
      .doc(companyId)
      .collection('settings')
      .doc('accounting')
      .set({
        approvalRequired: false,
        periodLockEnabled: false,
        accountAccessEnabled: false,
        costCenterPolicy: {
          enabled: true,
          requiredFor: {
            accountTypes: ['expense']
          }
        }
      });

    const payload2: any = {
      type: VoucherType.JOURNAL_ENTRY,
      date: '2025-01-16',
      description: 'Test - No cost center (should fail)',
      currency: 'USD',
      lines: [
        { accountId: 'acc-expense', debitFx: 100, creditFx: 0, debitBase: 100, creditBase: 0 }, // No costCenterId
        { accountId: 'acc-cash', debitFx: 0, creditFx: 100, debitBase: 0, creditBase: 100 }
      ]
    };

    const voucher2 = await createUseCase.execute(companyId, userId, payload2);
    try {
      await postUseCase.execute(companyId, userId, voucher2.id);
      console.log('  ✗ FAILED: Should have been blocked by cost center policy!\n');
    } catch (error: any) {
      if (error.message.includes('COST_CENTER_REQUIRED') || error.message.includes('Cost center is required')) {
        console.log(`  ✓ Correctly blocked: ${error.message.substring(0, 100)}...\n`);
      } else {
        console.log(`  ✗ Wrong error: ${error.message}\n`);
      }
    }

    // SCENARIO 3: Policy Enabled → With cost center ALLOWED
    console.log('SCENARIO 3: Policy Enabled - With Cost Center\n');
    const payload3: any = {
      type: VoucherType.JOURNAL_ENTRY,
      date: '2025-01-17',
      description: 'Test - With cost center',
      currency: 'USD',
      lines: [
        { accountId: 'acc-expense', debitFx: 100, creditFx: 0, debitBase: 100, creditBase: 0, costCenterId: 'cc-001' },
        { accountId: 'acc-cash', debitFx: 0, creditFx: 100, debitBase: 0, creditBase: 100 }
      ]
    };

    const voucher3 = await createUseCase.execute(companyId, userId, payload3);
    await postUseCase.execute(companyId, userId, voucher3.id);
    console.log('  ✓ Posted successfully with cost center\n');

    // SCENARIO 4: Non-expense account without cost center → ALLOWED
    console.log('SCENARIO 4: Non-Expense Account (No Cost Center Required)\n');
    const payload4: any = {
      type: VoucherType.JOURNAL_ENTRY,
      date: '2025-01-18',
      description: 'Test - Asset account no cost center',
      currency: 'USD',
      lines: [
        { accountId: 'acc-cash', debitFx: 100, creditFx: 0, debitBase: 100, creditBase: 0 }, // Asset, no costCenterId
        { accountId: 'acc-cash', debitFx: 0, creditFx: 100, debitBase: 0, creditBase: 100 }
      ]
    };

    const voucher4 = await createUseCase.execute(companyId, userId, payload4);
    await postUseCase.execute(companyId, userId, voucher4.id);
    console.log('  ✓ Non-expense account posted without cost center (not in scope)\n');

    console.log('=== All Tests Passed ===\n');

  } catch (error) {
    console.error('\n=== Test Failed ===');
    console.error(error);
    throw error;
  }
}

verifyCostCenterPolicy()
  .then(() => {
    console.log('Verification complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Verification failed:', error);
    process.exit(1);
  });
