
import * as admin from 'firebase-admin';
import { randomUUID } from 'crypto';
import { CreateVoucherUseCase } from '../application/accounting/use-cases/VoucherUseCases';
import { FirestoreVoucherRepository } from '../infrastructure/firestore/repositories/accounting/FirestoreVoucherRepository';
import { AccountRepositoryFirestore } from '../infrastructure/firestore/accounting/AccountRepositoryFirestore';
import { FirestoreCompanyModuleSettingsRepository } from '../infrastructure/firestore/repositories/system/FirestoreCompanyModuleSettingsRepository';
import { FirestoreTransactionManager } from '../infrastructure/firestore/transaction/FirestoreTransactionManager';
import { PermissionChecker } from '../application/rbac/PermissionChecker';
import { ILedgerRepository } from '../repository/interfaces/accounting';
import { Voucher } from '../domain/accounting/entities/Voucher';

// Initialize Firebase Admin (if not already)
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

// Mock LedgerRepository that throws error
const failingLedgerRepo: ILedgerRepository = {
  recordForVoucher: async (voucher: Voucher, transaction?: any) => {
    console.log('Simulating failure in LedgerRepository...');
    throw new Error('Simulated Ledger Failure');
  },
  deleteForVoucher: async () => Promise.resolve(),
  getAccountLedger: async () => [],
  getTrialBalance: async () => [],
  getGeneralLedger: async () => [],
};

async function verifyTransaction() {
  console.log('Starting Transaction Verification...');

  const companyId = 'test_company_trans_' + Date.now();
  const userId = 'test_user';
  const voucherId = randomUUID();

  // Setup Repositories
  const voucherRepo = new FirestoreVoucherRepository(db);
  const accountRepo = new AccountRepositoryFirestore(db);
  const transactionManager = new FirestoreTransactionManager(db);

  // Create Use Case with Failing Ledger Repo
  // (We will create the actual use case instance inside the try block with mock settings)

  // Prepare Payload
  // We need a valid account ID. Let's create a dummy account first (outside transaction).
  const accountId = 'acc_test_' + Date.now();
  await accountRepo.create(companyId, {
    id: accountId,
    code: '1001',
    name: 'Test Account',
    type: 'asset',
    currency: 'USD',
  });
  console.log(`Created test account: ${accountId}`);

  const payload: any = {
    id: voucherId,
    date: new Date(),
    description: 'Transaction Test Voucher',
    lines: [
      {
        accountId: accountId,
        debitBase: 100,
        creditBase: 0
      },
      {
        accountId: accountId,
        debitBase: 0,
        creditBase: 100
      }
    ]
  };

  // Execute Use Case
  try {
    console.log('Executing CreateVoucherUseCase (expecting failure)...');
    // Force status to 'approved' so it tries to write to ledger
    // Note: The use case sets status based on settings. 
    // We can mock settingsRepo to return strictApprovalMode: false
    // Or just rely on default if settings are missing?
    // Default in use case: settings?.strictApprovalMode === false ? 'approved' : 'draft'
    // If settings is null, it defaults to 'draft'.
    // We need it to be 'approved'.
    
    // Let's mock settingsRepo too to ensure 'approved' status
    const mockSettingsRepo = {
      getSettings: async () => ({ strictApprovalMode: false, baseCurrency: 'USD' }),
    } as unknown as FirestoreCompanyModuleSettingsRepository;

    const useCaseWithMockSettings = new CreateVoucherUseCase(
      voucherRepo,
      accountRepo,
      mockSettingsRepo,
      failingLedgerRepo,
      mockPermissionChecker,
      transactionManager
    );

    await useCaseWithMockSettings.execute(companyId, userId, payload);
    console.error('ERROR: Transaction succeeded but should have failed!');
  } catch (error: any) {
    console.log(`Caught expected error: ${error.message}`);
  }

  // Verify Rollback
  console.log('Verifying rollback...');
  const savedVoucher = await voucherRepo.getVoucher(voucherId);
  
  if (savedVoucher) {
    console.error('FAILURE: Voucher was saved despite transaction failure! Atomicity broken.');
    console.log('Saved Voucher:', savedVoucher);
  } else {
    console.log('SUCCESS: Voucher was NOT saved. Transaction rolled back correctly.');
  }

  // Cleanup
  await accountRepo.deactivate(companyId, accountId);
}

verifyTransaction().catch(console.error);
