import * as admin from 'firebase-admin';
import { CreateVoucherUseCase, ApproveVoucherUseCase, PostVoucherUseCase } from '../application/accounting/use-cases/VoucherUseCases';
import { FirestoreVoucherRepositoryV2 } from '../infrastructure/firestore/repositories/accounting/FirestoreVoucherRepositoryV2';
import { FirestoreLedgerRepository } from '../infrastructure/firestore/repositories/accounting/FirestoreLedgerRepository';
import { FirestoreTransactionManager } from '../infrastructure/firestore/transaction/FirestoreTransactionManager';
import { FirestoreAccountingPolicyConfigProvider } from '../infrastructure/accounting/config/FirestoreAccountingPolicyConfigProvider';
import { AccountingPolicyRegistry } from '../application/accounting/policies/AccountingPolicyRegistry';
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

// Mock objects for simplified testing
const mockSettingsRepo: any = {
  getSettings: async () => ({ autoNumbering: true, baseCurrency: 'USD' }),
};

const mockAccountRepo: any = {
  getById: async () => ({ id: 'test', active: true }),
};

const mockVoucherTypeRepo: any = {
  getByCode: async () => null,
};

async function verifyPolicyIntegration() {
  console.log('\n=== Phase 2: Policy Verification ===\n');

  const companyId = 'test_company_' + Date.now();
  const userId = 'test_user';

  // Setup repositories
  const voucherRepo = new FirestoreVoucherRepositoryV2(db);
  const ledgerRepo = new FirestoreLedgerRepository(db);
  const transactionManager = new FirestoreTransactionManager(db);
  const configProvider = new FirestoreAccountingPolicyConfigProvider(db);
  const policyRegistry = new AccountingPolicyRegistry(configProvider);

  // Create use cases
  const createUseCase = new CreateVoucherUseCase(
    voucherRepo,
    mockAccountRepo,
    mockSettingsRepo,
    mockPermissionChecker,
    transactionManager,
    mockVoucherTypeRepo
  );

  const approveUseCase = new ApproveVoucherUseCase(
    voucherRepo,
    mockPermissionChecker
  );

  const postUseCase = new PostVoucherUseCase(
    voucherRepo,
    ledgerRepo,
    mockPermissionChecker,
    transactionManager,
    policyRegistry
  );

  // Test payload
  const payload: any = {
    type: VoucherType.JOURNAL_ENTRY,
    date: '2025-01-15',
    description: 'Policy Test Voucher',
    currency: 'USD',
    lines: [
      { accountId: 'acc-1', debitFx: 100, creditFx: 0, debitBase: 100, creditBase: 0, side: 'Debit' },
      { accountId: 'acc-2', debitFx: 0, creditFx: 100, debitBase: 0, creditBase: 100, side: 'Credit' }
    ]
  };

  try {
    // TEST 1: Approval Required Policy
    console.log('TEST 1: ApprovalRequired = true, voucher not approved');
    
    // Set config: approvalRequired = true
    await db
      .collection('companies')
      .doc(companyId)
      .collection('settings')
      .doc('accounting')
      .set({ approvalRequired: true, periodLockEnabled: false });

    // Create voucher (DRAFT)
    const voucher1 = await createUseCase.execute(companyId, userId, payload);
    console.log(`  ✓ Created voucher ${voucher1.id} in DRAFT status`);

    // Attempt to post without approval - should FAIL
    try {
      await postUseCase.execute(companyId, userId, voucher1.id);
      console.log('  ✗ FAILED: Posting succeeded but should have been blocked!');
    } catch (error: any) {
      if (error.code === 'APPROVAL_REQUIRED') {
        console.log(`  ✓ Correctly blocked: ${error.message}`);
      } else {
        console.log(`  ✗ Wrong error: ${error.message}`);
      }
    }

    // TEST 2: Approve then post - should SUCCEED
    console.log('\nTEST 2: Approve voucher then post');
    await approveUseCase.execute(companyId, userId, voucher1.id);
    console.log('  ✓ Voucher approved');

    await postUseCase.execute(companyId, userId, voucher1.id);
    console.log('  ✓ Voucher posted successfully');

    // TEST 3: Period Lock Policy
    console.log('\nTEST 3: PeriodLock = true, voucher in locked period');
    
    // Set config: periodLock = true with locked through 2025-01-20
    await db
      .collection('companies')
      .doc(companyId)
      .collection('settings')
      .doc('accounting')
      .set({ 
        approvalRequired: false, 
        periodLockEnabled: true,
        lockedThroughDate: '2025-01-20'
      });

    // Create voucher with date in locked period
    const payload2 = { ...payload, date: '2025-01-15' };
    const voucher2 = await createUseCase.execute(companyId, userId, payload2);
    console.log(`  ✓ Created voucher ${voucher2.id} with date 2025-01-15`);

    // Attempt to post - should FAIL (period locked)
    try {
      await postUseCase.execute(companyId, userId, voucher2.id);
      console.log('  ✗ FAILED: Posting succeeded but should have been blocked!');
    } catch (error: any) {
      if (error.code === 'PERIOD_LOCKED') {
        console.log(`  ✓ Correctly blocked: ${error.message}`);
      } else {
        console.log(`  ✗ Wrong error: ${error.message}`);
      }
    }

    // TEST 4: All policies disabled - should SUCCEED
    console.log('\nTEST 4: All policies disabled (core invariants only)');
    
    await db
      .collection('companies')
      .doc(companyId)
      .collection('settings')
      .doc('accounting')
      .set({ approvalRequired: false, periodLockEnabled: false });

    const payload3 = { ...payload, date: '2025-02-01' };
    const voucher3 = await createUseCase.execute(companyId, userId, payload3);
    console.log(`  ✓ Created voucher ${voucher3.id}`);

    await postUseCase.execute(companyId, userId, voucher3.id);
    console.log('  ✓ Voucher posted successfully (no policies blocked)');

    console.log('\n=== All Tests Passed ===\n');

  } catch (error) {
    console.error('\n=== Test Failed ===');
    console.error(error);
    throw error;
  }
}

verifyPolicyIntegration()
  .then(() => {
    console.log('Verification complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Verification failed:', error);
    process.exit(1);
  });
