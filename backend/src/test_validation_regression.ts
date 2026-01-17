import { diContainer } from './infrastructure/di/bindRepositories';
import { CreateVoucherUseCase } from './application/accounting/use-cases/VoucherUseCases';
import { PermissionChecker } from './application/rbac/PermissionChecker';
import { GetCurrentUserPermissionsForCompanyUseCase } from './application/rbac/use-cases/GetCurrentUserPermissionsForCompanyUseCase';

async function testRegression() {
  console.log('--- STARTING REGRESSION TEST: MULTI-CURRENCY VALIDATION ---');
  
  const companyId = 'test-company-123'; // Assuming a test company exists or using emulator
  const userId = 'system-admin'; // Using a privileged user for testing
  
  const permissionChecker = {
    assertOrThrow: async () => {},
    hasPermission: async () => true
  } as any;

  const useCase = new CreateVoucherUseCase(
    diContainer.voucherRepository as any,
    diContainer.accountRepository as any,
    diContainer.companyModuleSettingsRepository as any,
    permissionChecker,
    diContainer.transactionManager as any,
    diContainer.voucherTypeDefinitionRepository as any,
    diContainer.accountingPolicyConfigProvider as any,
    diContainer.ledgerRepository as any,
    diContainer.policyRegistry as any
  );

  const brokenPayload = {
    type: 'journal_entry',
    date: '2026-01-18',
    description: 'Broken Voucher Regression Test',
    currency: 'USD',
    exchangeRate: 1,
    lines: [
      {
        accountId: 'acc-usd',
        side: 'Debit',
        amount: 100,
        currency: 'USD',
        exchangeRate: 1
      },
      {
        accountId: 'acc-eur',
        side: 'Credit',
        amount: 100,
        currency: 'EUR',
        exchangeRate: 1 // <--- THIS SHOULD BE REJECTED IN V2
      }
    ]
  };

  try {
    console.log('Attempting to create "broken" multi-currency voucher...');
    await useCase.execute(companyId, userId, brokenPayload);
    console.error('❌ FAILURE: Voucher was incorrectly accepted!');
    process.exit(1);
  } catch (error: any) {
    if (error.appError?.code === 'SUSPICIOUS_EXCHANGE_RATE') {
      console.log('✅ SUCCESS: Voucher was correctly rejected with SUSPICIOUS_EXCHANGE_RATE');
    } else {
      console.error('❌ FAILURE: Voucher was rejected but with WRONG error:', error.message);
      process.exit(1);
    }
  }

  console.log('--- REGRESSION TEST COMPLETED SUCCESSFULLY ---');
}

testRegression().catch(err => {
  console.error('Unexpected error during test:', err);
  process.exit(1);
});
