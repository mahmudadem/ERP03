
import * as admin from 'firebase-admin';
import { randomUUID } from 'crypto';
import { diContainer } from '../infrastructure/di/bindRepositories';
import { CreateAccountUseCase } from '../application/accounting/use-cases/AccountUseCases';
import { CreateVoucherUseCase } from '../application/accounting/use-cases/VoucherUseCases';
import { PermissionChecker } from '../application/rbac/PermissionChecker';

// Mock PermissionChecker to bypass RBAC
const mockPermissionChecker = {
  assertOrThrow: async () => Promise.resolve(),
} as unknown as PermissionChecker;

// Force Firestore Emulator
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.GCLOUD_PROJECT = 'erp-03';

if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'erp-03' });
}

async function verify() {
  console.log('🧪 Starting ID Verification...');

  const companyId = `test_company_${randomUUID()}`;
  const userId = `test_user_${randomUUID()}`;

  // 1. Verify Account ID
  console.log('\n1. Testing Account Creation...');
  const createAccount = new CreateAccountUseCase(diContainer.accountRepository);
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
  } else {
    console.error(`   ❌ Account ID is NOT a UUID (len=${account.id.length})`);
  }

  // 2. Verify Voucher ID
  console.log('\n2. Testing Voucher Creation...');
  // We need to mock settings repo to return defaults
  const mockSettingsRepo = {
    getSettings: async () => ({ baseCurrency: 'USD', autoNumbering: true }),
  } as any;

  // We need a real ledger repo or mock, let's use the real one from DI
  const createVoucher = new CreateVoucherUseCase(
    diContainer.voucherRepository,
    diContainer.accountRepository,
    mockSettingsRepo,
    diContainer.ledgerRepository,
    mockPermissionChecker,
    diContainer.transactionManager
  );

  const voucher = await createVoucher.execute(companyId, userId, {
    date: new Date(),
    lines: [
      { accountId: account.id, debitBase: 100, creditBase: 0 },
      { accountId: account.id, debitBase: 0, creditBase: 100 } // Self-balancing for simplicity
    ] as any
  });

  console.log(`   Created Voucher ID: ${voucher.id}`);
  if (voucher.id.length === 36) {
    console.log('   ✅ Voucher ID is a UUID');
  } else {
    console.error(`   ❌ Voucher ID is NOT a UUID (len=${voucher.id.length})`);
  }
}

verify().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
