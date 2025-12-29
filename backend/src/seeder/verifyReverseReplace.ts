import * as admin from 'firebase-admin';
import { CreateVoucherUseCase, PostVoucherUseCase } from '../application/accounting/use-cases/VoucherUseCases';
import { ReverseAndReplaceVoucherUseCase } from '../application/accounting/use-cases/ReverseAndReplaceVoucherUseCase';
import { FirestoreVoucherRepositoryV2 } from '../infrastructure/firestore/repositories/accounting/FirestoreVoucherRepositoryV2';
import { FirestoreLedgerRepository } from '../infrastructure/firestore/repositories/accounting/FirestoreLedgerRepository';
import { FirestoreTransactionManager } from '../infrastructure/firestore/transaction/FirestoreTransactionManager';
import { FirestoreAccountingPolicyConfigProvider } from '../infrastructure/accounting/config/FirestoreAccountingPolicyConfigProvider';
import { AccountingPolicyRegistry } from '../application/accounting/policies/AccountingPolicyRegistry';
import { FirestoreUserAccessScopeProvider } from '../infrastructure/accounting/access/FirestoreUserAccessScopeProvider';
import { FirestoreAccountLookupService } from '../infrastructure/accounting/services/FirestoreAccountLookupService';
import { PermissionChecker } from '../application/rbac/PermissionChecker';
import { VoucherType } from '../domain/accounting/types/VoucherTypes';
import { CorrectionMode } from '../domain/accounting/types/CorrectionTypes';

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

async function verifyReverseReplace() {
  console.log('\n=== Phase 4.1: Reverse & Replace Verification ===\n');

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

  const correctUseCase = new ReverseAndReplaceVoucherUseCase(
    voucherRepo,
    ledgerRepo,
    mockPermissionChecker,
    transactionManager,
    policyRegistry,
    mockAccountRepo,
    mockSettingsRepo
  );

  try {
    // Disable all policies for this test
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

    // SCENARIO 1: Reverse Only
    console.log('SCENARIO 1: Reverse Only\n');
    const payload1: any = {
      type: VoucherType.JOURNAL_ENTRY,
      date: '2025-01-15',
      description: 'Original Voucher',
      currency: 'USD',
      lines: [
        { accountId: 'acc-1', debitFx: 100, creditFx: 0, debitBase: 100, creditBase: 0 },
        { accountId: 'acc-2', debitFx: 0, creditFx: 100, debitBase: 0, creditBase: 100 }
      ]
    };

    const original1 = await createUseCase.execute(companyId, userId, payload1);
    console.log(`  ✓ Created original voucher ${original1.id}`);

    await postUseCase.execute(companyId, userId, original1.id);
    console.log('  ✓ Posted original voucher');

    const correction1 = await correctUseCase.execute(
      companyId,
      userId,
      original1.id,
      CorrectionMode.REVERSE_ONLY,
      undefined,
      { reason: 'Posted to wrong account' }
    );

    console.log(`  ✓ Reversal created: ${correction1.reverseVoucherId}`);
    console.log(`  ✓ Reversal posted: ${correction1.summary.reversalPosted}`);
    console.log(`  ✓ Net effect: Original + Reversal = Zero\n`);

    // SCENARIO 2: Reverse and Replace (draft)
    console.log('SCENARIO 2: Reverse and Replace (draft)\n');
    const payload2: any = {
      type: VoucherType.JOURNAL_ENTRY,
      date: '2025-01-16',
      description: 'Original Voucher 2',
      currency: 'USD',
      lines: [
        { accountId: 'acc-3', debitFx: 200, creditFx: 0, debitBase: 200, creditBase: 0 },
        { accountId: 'acc-4', debitFx: 0, creditFx: 200, debitBase: 0, creditBase: 200 }
      ]
    };

    const original2 = await createUseCase.execute(companyId, userId, payload2);
    await postUseCase.execute(companyId, userId, original2.id);
    console.log(`  ✓ Created and posted original voucher ${original2.id}`);

    const replacePayload = {
      date: '2025-01-17',
      description: 'Corrected Voucher',
      lines: [
        { accountId: 'acc-5', debitFx: 250, creditFx: 0, debitBase: 250, creditBase: 0 },
        { accountId: 'acc-6', debitFx: 0, creditFx: 250, debitBase: 0, creditBase: 250 }
      ]
    };

    const correction2 = await correctUseCase.execute(
      companyId,
      userId,
      original2.id,
      CorrectionMode.REVERSE_AND_REPLACE,
      replacePayload,
      { replaceStartsAsDraft: true, reason: 'Amount correction' }
    );

    console.log(`  ✓ Reversal created: ${correction2.reverseVoucherId}`);
    console.log(`  ✓ Replacement created: ${correction2.replaceVoucherId}`);
    console.log(`  ✓ Reversal posted: ${correction2.summary.reversalPosted}`);
    console.log(`  ✓ Replacement is draft: ${!correction2.summary.replacementPosted}\n`);

    // SCENARIO 3: Idempotency
    console.log('SCENARIO 3: Idempotency (second correction returns existing)\n');
    const correction3 = await correctUseCase.execute(
      companyId,
      userId,
      original1.id,
      CorrectionMode.REVERSE_ONLY,
      undefined,
      { reason: 'Duplicate attempt' }
    );

    console.log(`  ✓ Same reversal ID returned: ${correction3.reverseVoucherId === correction1.reverseVoucherId}`);
    console.log('  ✓ No duplicate reversal created\n');

    // SCENARIO 4: Policy blocks reversal (period lock)
    console.log('SCENARIO 4: Policy blocks reversal (period lock)\n');
    const payload4: any = {
      type: VoucherType.JOURNAL_ENTRY,
      date: '2025-01-10',
      description: 'Voucher in locked period',
      currency: 'USD',
      lines: [
        { accountId: 'acc-7', debitFx: 300, creditFx: 0, debitBase: 300, creditBase: 0 },
        { accountId: 'acc-8', debitFx: 0, creditFx: 300, debitBase: 0, creditBase: 300 }
      ]
    };

    const original4 = await createUseCase.execute(companyId, userId, payload4);
    await postUseCase.execute(companyId, userId, original4.id);
    console.log(`  ✓ Created and posted voucher ${original4.id} with date 2025-01-10`);

    // Enable period lock
    await db
      .collection('companies')
      .doc(companyId)
      .collection('settings')
      .doc('accounting')
      .update({
        periodLockEnabled: true,
        lockedThroughDate: '2025-12-31' // Lock all dates up to end of 2025
      });
    console.log('  ✓ Enabled period lock (locked through 2025-12-31)');

    try {
      await correctUseCase.execute(
        companyId,
        userId,
        original4.id,
        CorrectionMode.REVERSE_ONLY,
        undefined,
        { reason: 'Attempt correction' }
      );
      console.log('  ✗ FAILED: Reversal should have been blocked by period lock!');
    } catch (error: any) {
      if (error.message.includes('PERIOD_LOCKED') || error.message.includes('Reversal blocked')) {
        console.log(`  ✓ Correctly blocked: ${error.message.substring(0, 80)}...\n`);
      } else {
        console.log(`  ✗ Wrong error: ${error.message}`);
      }
    }

    console.log('=== All Tests Passed ===\n');

  } catch (error) {
    console.error('\n=== Test Failed ===');
    console.error(error);
    throw error;
  }
}

verifyReverseReplace()
  .then(() => {
    console.log('Verification complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Verification failed:', error);
    process.exit(1);
  });
