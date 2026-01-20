"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bindRepositories_1 = require("./infrastructure/di/bindRepositories");
const VoucherUseCases_1 = require("./application/accounting/use-cases/VoucherUseCases");
async function testRegression() {
    var _a;
    console.log('--- STARTING REGRESSION TEST: MULTI-CURRENCY VALIDATION ---');
    const companyId = 'test-company-123'; // Assuming a test company exists or using emulator
    const userId = 'system-admin'; // Using a privileged user for testing
    const permissionChecker = {
        assertOrThrow: async () => { },
        hasPermission: async () => true
    };
    const useCase = new VoucherUseCases_1.CreateVoucherUseCase(bindRepositories_1.diContainer.voucherRepository, bindRepositories_1.diContainer.accountRepository, bindRepositories_1.diContainer.companyModuleSettingsRepository, permissionChecker, bindRepositories_1.diContainer.transactionManager, bindRepositories_1.diContainer.voucherTypeDefinitionRepository, bindRepositories_1.diContainer.accountingPolicyConfigProvider, bindRepositories_1.diContainer.ledgerRepository, bindRepositories_1.diContainer.policyRegistry);
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
    }
    catch (error) {
        if (((_a = error.appError) === null || _a === void 0 ? void 0 : _a.code) === 'SUSPICIOUS_EXCHANGE_RATE') {
            console.log('✅ SUCCESS: Voucher was correctly rejected with SUSPICIOUS_EXCHANGE_RATE');
        }
        else {
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
//# sourceMappingURL=test_validation_regression.js.map