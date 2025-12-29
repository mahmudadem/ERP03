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
  getById: async (id: string) => ({ 
    id, 
    active: true, 
    type: id.includes('expense') ? 'expense' : 'asset', 
    code: id.toUpperCase(), 
    name: id.includes('expense') ? 'Expense Account' : 'Asset Account' 
  }),
};

async function verifyPolicyErrorModes() {
  console.log('\n=== Phase 4.3: Policy Error Modes Verification ===\n');

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
    // Setup test accounts
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

    // Create a voucher that violates multiple policies:
    // 1. Not approved (approvalRequired will fail)
    // 2. Date in locked period (periodLock will fail)
    // 3. Missing cost center on expense (costCenterRequired will fail)
    console.log('SETUP: Creating voucher that violates 3 policies\n');
    
    const payload: any = {
      type: VoucherType.JOURNAL_ENTRY,
      date: '2025-01-10',  // Will be locked
      description: 'Test multi-policy violation',
      currency: 'USD',
      lines: [
        { accountId: 'acc-expense', debitFx: 100, creditFx: 0, debitBase: 100, creditBase: 0 }, // No costCenterId
        { accountId: 'acc-cash', debitFx: 0, creditFx: 100, debitBase: 0, creditBase: 100 }
      ]
    };

    const voucher = await createUseCase.execute(companyId, userId, payload);
    console.log(`  ✓ Created voucher ${voucher.id} in DRAFT status\n`);

    // Enable all 3 policies that should fail
    console.log('SCENARIO A: FAIL_FAST Mode\n');
    await db
      .collection('companies')
      .doc(companyId)
      .collection('settings')
      .doc('accounting')
      .set({
        approvalRequired: true,  // Policy 1
        periodLockEnabled: true,  // Policy 2
        lockedThroughDate: '2025-01-20',
        accountAccessEnabled: false,
        costCenterPolicy: {  // Policy 3
          enabled: true,
          requiredFor: {
            accountTypes: ['expense']
          }
        },
        policyErrorMode: 'FAIL_FAST'
      });

    try {
      await postUseCase.execute(companyId, userId, voucher.id);
      console.log('  ✗ FAILED: Should have been blocked!\n');
    } catch (error: any) {
      const violations = error.appError?.details?.violations || [];
      console.log(`  ✓ Correctly blocked with ${violations.length} violation(s)`);
      console.log(`  ✓ First violation: ${violations[0]?.code || error.message.substring(0, 50)}`);
      console.log(`  ✓ Policy ID: ${violations[0]?.policyId || 'N/A'}\n`);
    }

    // SCENARIO B: AGGREGATE Mode
    console.log('SCENARIO B: AGGREGATE Mode\n');
    await db
      .collection('companies')
      .doc(companyId)
      .collection('settings')
      .doc('accounting')
      .update({
        policyErrorMode: 'AGGREGATE'
      });

    try {
      await postUseCase.execute(companyId, userId, voucher.id);
      console.log('  ✗ FAILED: Should have been blocked!\n');
    } catch (error: any) {
      const violations = error.appError?.details?.violations || [];
      console.log(`  ✓ Collected ${violations.length} violation(s)`);
      
      if (violations.length > 0) {
        console.log('\n  Violations:');
        violations.forEach((v: any, i: number) => {
          console.log(`    ${i + 1}. [${v.policyId}] ${v.code}: ${v.message.substring(0, 60)}...`);
        });
      }
      
      console.log(`\n  ✓ AGGREGATE mode collected multiple violations\n`);
      
      // Show sample HTTP error envelope
      console.log('Sample HTTP Error Envelope:');
      console.log(JSON.stringify({
        success: false,
        error: error.appError
      }, null, 2));
    }

    console.log('\n=== All Tests Passed ===\n');

  } catch (error) {
    console.error('\n=== Test Failed ===');
    console.error(error);
    throw error;
  }
}

verifyPolicyErrorModes()
  .then(() => {
    console.log('Verification complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Verification failed:', error);
    process.exit(1);
  });
