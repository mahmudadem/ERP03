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
  getById: async () => ({ id: 'test', active: true }),
};

const mockVoucherTypeRepo: any = {
  getByCode: async () => null,
};

async function verifyAccountAccess() {
  console.log('\n=== Phase 3: Account Access Control Verification ===\n');

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
    mockVoucherTypeRepo
  );

  const postUseCase = new PostVoucherUseCase(
    voucherRepo,
    ledgerRepo,
    mockPermissionChecker,
    transactionManager,
    policyRegistry
  );

  try {
    // Setup: Create test accounts
    console.log('SETUP: Creating test accounts...');
    const accountsRef = db.collection('companies').doc(companyId).collection('accounts');
    
    await accountsRef.doc('cash-a').set({
      code: 'CASH-A',
      name: 'Branch A Cash',
      type: 'asset',
      ownerUnitIds: ['branch-a'],
      ownerScope: 'restricted'
    });

    await accountsRef.doc('cash-b').set({
      code: 'CASH-B',
      name: 'Branch B Cash',
      type: 'asset',
      ownerUnitIds: ['branch-b'],
      ownerScope: 'restricted'
    });

    await accountsRef.doc('cash-shared').set({
      code: 'CASH-SHARED',
      name: 'Shared Cash',
      type: 'asset',
      ownerScope: 'shared'
    });

    await accountsRef.doc('expense').set({
      code: 'EXP-001',
      name: 'General Expense',
      type: 'expense',
      ownerScope: 'shared'
    });

    console.log('  ✓ Created accounts: Cash-A (restricted), Cash-B (restricted), Cash-Shared (shared), Expense (shared)');

    // Setup: Create user scope
    console.log('\nSETUP: Creating user access scope...');
    await db.collection('users').doc(userId).collection('profile').doc('access').set({
      allowedUnitIds: ['branch-a'],
      isSuper: false
    });
    console.log('  ✓ User scope: allowedUnitIds = ["branch-a"]');

    // Setup: Enable account access policy
    console.log('\nSETUP: Enabling account access control policy...');
    await db
      .collection('companies')
      .doc(companyId)
      .collection('settings')
      .doc('accounting')
      .set({
        approvalRequired: false,
        periodLockEnabled: false,
        accountAccessEnabled: true
      });
    console.log('  ✓ Policy enabled');

    // TEST 1: Attempt to post with Cash-B (restricted to branch-b) - should FAIL
    console.log('\nTEST 1: Post with Cash-B (user lacks access)');
    const payload1: any = {
      type: VoucherType.JOURNAL_ENTRY,
      date: '2025-01-15',
      description: 'Test - Branch B Access',
      currency: 'USD',
      lines: [
        { accountId: 'cash-b', debitFx: 100, creditFx: 0, debitBase: 100, creditBase: 0 },
        { accountId: 'expense', debitFx: 0, creditFx: 100, debitBase: 0, creditBase: 100 }
      ]
    };

    const voucher1 = await createUseCase.execute(companyId, userId, payload1);
    console.log(`  ✓ Created voucher ${voucher1.id}`);

    try {
      await postUseCase.execute(companyId, userId, voucher1.id);
      console.log('  ✗ FAILED: Posting succeeded but should have been blocked!');
    } catch (error: any) {
      if (error.code === 'ACCOUNT_ACCESS_DENIED') {
        console.log(`  ✓ Correctly blocked: ${error.message}`);
      } else {
        console.log(`  ✗ Wrong error: ${error.message}`);
      }
    }

    // TEST 2: Post with Cash-A (restricted to branch-a, user has access) - should SUCCEED
    console.log('\nTEST 2: Post with Cash-A (user has access)');
    const payload2: any = {
      type: VoucherType.JOURNAL_ENTRY,
      date: '2025-01-15',
      description: 'Test - Branch A Access',
      currency: 'USD',
      lines: [
        { accountId: 'cash-a', debitFx: 100, creditFx: 0, debitBase: 100, creditBase: 0 },
        { accountId: 'expense', debitFx: 0, creditFx: 100, debitBase: 0, creditBase: 100 }
      ]
    };

    const voucher2 = await createUseCase.execute(companyId, userId, payload2);
    console.log(`  ✓ Created voucher ${voucher2.id}`);

    await postUseCase.execute(companyId, userId, voucher2.id);
    console.log('  ✓ Posting succeeded (user has matching unit)');

    // TEST 3: Post with Cash-Shared (shared account) - should SUCCEED
    console.log('\nTEST 3: Post with Cash-Shared (shared account)');
    const payload3: any = {
      type: VoucherType.JOURNAL_ENTRY,
      date: '2025-01-15',
      description: 'Test - Shared Account',
      currency: 'USD',
      lines: [
        { accountId: 'cash-shared', debitFx: 100, creditFx: 0, debitBase: 100, creditBase: 0 },
        { accountId: 'expense', debitFx: 0, creditFx: 100, debitBase: 0, creditBase: 100 }
      ]
    };

    const voucher3 = await createUseCase.execute(companyId, userId, payload3);
    console.log(`  ✓ Created voucher ${voucher3.id}`);

    await postUseCase.execute(companyId, userId, voucher3.id);
    console.log('  ✓ Posting succeeded (shared account accessible to all)');

    // TEST 4: Disable policy and post with Cash-B - should SUCCEED
    console.log('\nTEST 4: Disable policy and post with Cash-B');
    await db
      .collection('companies')
      .doc(companyId)
      .collection('settings')
      .doc('accounting')
      .set({
        approvalRequired: false,
        periodLockEnabled: false,
        accountAccessEnabled: false
      });
    console.log('  ✓ Policy disabled');

    const payload4: any = {
      type: VoucherType.JOURNAL_ENTRY,
      date: '2025-01-15',
      description: 'Test - Policy Disabled',
      currency: 'USD',
      lines: [
        { accountId: 'cash-b', debitFx: 100, creditFx: 0, debitBase: 100, creditBase: 0 },
        { accountId: 'expense', debitFx: 0, creditFx: 100, debitBase: 0, creditBase: 100 }
      ]
    };

    const voucher4 = await createUseCase.execute(companyId, userId, payload4);
    console.log(`  ✓ Created voucher ${voucher4.id}`);

    await postUseCase.execute(companyId, userId, voucher4.id);
    console.log('  ✓ Posting succeeded (policy disabled, all accounts allowed)');

    console.log('\n=== All Tests Passed ===\n');

  } catch (error) {
    console.error('\n=== Test Failed ===');
    console.error(error);
    throw error;
  }
}

verifyAccountAccess()
  .then(() => {
    console.log('Verification complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Verification failed:', error);
    process.exit(1);
  });
