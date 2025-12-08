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
const bindRepositories_1 = require("../infrastructure/di/bindRepositories");
const AccountUseCases_1 = require("../application/accounting/use-cases/AccountUseCases");
const VoucherUseCases_1 = require("../application/accounting/use-cases/VoucherUseCases");
// Mock PermissionChecker to bypass RBAC
const mockPermissionChecker = {
    assertOrThrow: async () => Promise.resolve(),
};
// Force Firestore Emulator
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.GCLOUD_PROJECT = 'erp-03';
if (!admin.apps.length) {
    admin.initializeApp({ projectId: 'erp-03' });
}
async function verify() {
    console.log('🧪 Starting ID Verification...');
    const companyId = `test_company_${(0, crypto_1.randomUUID)()}`;
    const userId = `test_user_${(0, crypto_1.randomUUID)()}`;
    // 1. Verify Account ID
    console.log('\n1. Testing Account Creation...');
    const createAccount = new AccountUseCases_1.CreateAccountUseCase(bindRepositories_1.diContainer.accountRepository);
    const account = await createAccount.execute({
        companyId,
        code: '1001',
        name: 'Test Account',
        type: 'ASSET',
        currency: 'USD'
    });
    console.log(`   Created Account ID: ${account.id}`);
    if (account.id.length === 36) {
        console.log('   ✅ Account ID is a UUID');
    }
    else {
        console.error(`   ❌ Account ID is NOT a UUID (len=${account.id.length})`);
    }
    // 2. Verify Voucher ID
    console.log('\n2. Testing Voucher Creation...');
    // We need to mock settings repo to return defaults
    const mockSettingsRepo = {
        getSettings: async () => ({ baseCurrency: 'USD', autoNumbering: true }),
    };
    // We need a real ledger repo or mock, let's use the real one from DI
    const createVoucher = new VoucherUseCases_1.CreateVoucherUseCase(bindRepositories_1.diContainer.voucherRepository, bindRepositories_1.diContainer.accountRepository, mockSettingsRepo, bindRepositories_1.diContainer.ledgerRepository, mockPermissionChecker, bindRepositories_1.diContainer.transactionManager);
    const voucher = await createVoucher.execute(companyId, userId, {
        date: new Date(),
        lines: [
            { accountId: account.id, debitBase: 100, creditBase: 0 },
            { accountId: account.id, debitBase: 0, creditBase: 100 } // Self-balancing for simplicity
        ]
    });
    console.log(`   Created Voucher ID: ${voucher.id}`);
    if (voucher.id.length === 36) {
        console.log('   ✅ Voucher ID is a UUID');
    }
    else {
        console.error(`   ❌ Voucher ID is NOT a UUID (len=${voucher.id.length})`);
    }
}
verify().then(() => process.exit(0)).catch(e => {
    console.error(e);
    process.exit(1);
});
//# sourceMappingURL=verifyIds.js.map