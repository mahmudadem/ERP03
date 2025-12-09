"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const admin = __importStar(require("firebase-admin"));
const crypto_1 = require("crypto");
const VoucherUseCases_1 = require("../application/accounting/use-cases/VoucherUseCases");
const FirestoreVoucherRepository_1 = require("../infrastructure/firestore/repositories/accounting/FirestoreVoucherRepository");
const AccountRepositoryFirestore_1 = require("../infrastructure/firestore/accounting/AccountRepositoryFirestore");
const FirestoreTransactionManager_1 = require("../infrastructure/firestore/transaction/FirestoreTransactionManager");
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
};
// Mock LedgerRepository that throws error
const failingLedgerRepo = {
    recordForVoucher: async (voucher, transaction) => {
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
    const voucherId = (0, crypto_1.randomUUID)();
    // Setup Repositories
    const voucherRepo = new FirestoreVoucherRepository_1.FirestoreVoucherRepository(db);
    const accountRepo = new AccountRepositoryFirestore_1.AccountRepositoryFirestore(db);
    const transactionManager = new FirestoreTransactionManager_1.FirestoreTransactionManager(db);
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
    const payload = {
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
        };
        const useCaseWithMockSettings = new VoucherUseCases_1.CreateVoucherUseCase(voucherRepo, accountRepo, mockSettingsRepo, failingLedgerRepo, mockPermissionChecker, transactionManager);
        await useCaseWithMockSettings.execute(companyId, userId, payload);
        console.error('ERROR: Transaction succeeded but should have failed!');
    }
    catch (error) {
        console.log(`Caught expected error: ${error.message}`);
    }
    // Verify Rollback
    console.log('Verifying rollback...');
    const savedVoucher = await voucherRepo.getVoucher(companyId, voucherId);
    if (savedVoucher) {
        console.error('FAILURE: Voucher was saved despite transaction failure! Atomicity broken.');
        console.log('Saved Voucher:', savedVoucher);
    }
    else {
        console.log('SUCCESS: Voucher was NOT saved. Transaction rolled back correctly.');
    }
    // Cleanup
    await accountRepo.deactivate(companyId, accountId);
}
verifyTransaction().catch(console.error);
//# sourceMappingURL=verifyTransactions.js.map