import * as admin from 'firebase-admin';
import { randomUUID } from 'crypto';
import { CreateVoucherUseCase, PostVoucherUseCase } from '../application/accounting/use-cases/VoucherUseCases';
import { FirestoreVoucherRepositoryV2 } from '../infrastructure/firestore/repositories/accounting/FirestoreVoucherRepositoryV2';
import { AccountRepositoryFirestore } from '../infrastructure/firestore/accounting/AccountRepositoryFirestore';
import { FirestoreCompanyModuleSettingsRepository } from '../infrastructure/firestore/repositories/system/FirestoreCompanyModuleSettingsRepository';
import { FirestoreTransactionManager } from '../infrastructure/firestore/transaction/FirestoreTransactionManager';
import { PermissionChecker } from '../application/rbac/PermissionChecker';
import { ILedgerRepository } from '../repository/interfaces/accounting';
import { VoucherEntity } from '../domain/accounting/entities/VoucherEntity';

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
  recordForVoucher: async (voucher: VoucherEntity, transaction?: any) => {
    console.log('Simulating failure in LedgerRepository...');
    throw new Error('Simulated Ledger Failure');
  },
  deleteForVoucher: async () => Promise.resolve(),
  getAccountLedger: async () => [],
  getTrialBalance: async () => [],
  getGeneralLedger: async () => [],
  getJournal: async () => [],
};

async function verifyTransaction() {
  console.log('Starting Transaction Verification (Accounting Core Phase 1)...');

  const companyId = 'test_company_trans_' + Date.now();
  const userId = 'test_user';
  const voucherId = randomUUID();

  // Setup Repositories
  const voucherRepo = new FirestoreVoucherRepositoryV2(db);
  const accountRepo = new AccountRepositoryFirestore(db);
  const transactionManager = new FirestoreTransactionManager(db);
  const voucherTypeRepo: any = { getByCode: async () => null }; // Skip type definition for test

  // Prepare Payload
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
    date: new Date().toISOString().split('T')[0],
    description: 'Transaction Test Voucher',
    currency: 'USD',
    exchangeRate: 1,
    lines: [
      {
        accountId: accountId,
        debitFx: 100,
        creditFx: 0,
        debitBase: 100,
        creditBase: 0
      },
      {
        accountId: accountId,
        debitFx: 0,
        creditFx: 100,
        debitBase: 0,
        creditBase: 100
      }
    ]
  };

  try {
    const mockSettingsRepo = {
      getSettings: async () => ({ autoNumbering: true, baseCurrency: 'USD' }),
    } as unknown as FirestoreCompanyModuleSettingsRepository;

    const createUseCase = new CreateVoucherUseCase(
      voucherRepo,
      accountRepo,
      mockSettingsRepo,
      mockPermissionChecker,
      transactionManager,
      voucherTypeRepo
    );

    const postUseCase = new PostVoucherUseCase(
      voucherRepo,
      failingLedgerRepo,
      mockPermissionChecker,
      transactionManager
    );

    console.log('Step 1: Creating Voucher (DRAFT)...');
    await createUseCase.execute(companyId, userId, payload);
    
    console.log('Step 2: Posting Voucher (expecting failure in ledger)...');
    await postUseCase.execute(companyId, userId, voucherId);
    
    console.error('ERROR: Posting succeeded but should have failed!');
  } catch (error: any) {
    console.log(`Caught expected error: ${error.message}`);
  }

  // Verify Rollback of the POST status
  console.log('Verifying transaction isolation...');
  const finalVoucher = await voucherRepo.findById(companyId, voucherId);
  
  if (finalVoucher && finalVoucher.status === 'posted') {
    console.error('FAILURE: Voucher status is POSTED despite ledger failure!');
  } else if (finalVoucher && finalVoucher.status === 'draft') {
    console.log('SUCCESS: Voucher remains in DRAFT. Ledger write failure prevented status transition.');
  } else {
    console.log('Note: Voucher state is:', finalVoucher?.status);
  }

  // Cleanup
  await accountRepo.deactivate(companyId, accountId);
}

verifyTransaction().catch(console.error);
