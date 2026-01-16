"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const SubmitVoucherUseCase_1 = require("../application/accounting/use-cases/SubmitVoucherUseCase");
const ApprovalPolicyService_1 = require("../domain/accounting/policies/ApprovalPolicyService");
const VoucherEntity_1 = require("../domain/accounting/entities/VoucherEntity");
const VoucherTypes_1 = require("../domain/accounting/types/VoucherTypes");
async function runTest() {
    console.log('--- STARTING APPROVAL GATES PROGRAMMATIC TEST ---');
    const companyId = 'test-comp-123';
    const submitterId = 'user-admin-01';
    // 1. Setup Mock Repository
    const mockRepo = {
        findById: async () => createSampleVoucher(),
        save: async (v) => v
    };
    // 2. Setup Mock Config (Mode D: FA=ON, CC=ON)
    const mockConfig = {
        getConfig: async () => ({
            financialApprovalEnabled: true,
            faApplyMode: 'MARKED_ONLY',
            custodyConfirmationEnabled: true
        })
    };
    // 3. Setup Account Metadata Mock (Triggering both gates)
    const mockAccountMetadata = async () => [
        { accountId: 'acc-cash', requiresApproval: true, requiresCustodyConfirmation: true, custodianUserId: 'user-custodian' },
        { accountId: 'acc-exp', requiresApproval: false, requiresCustodyConfirmation: false }
    ];
    const useCase = new SubmitVoucherUseCase_1.SubmitVoucherUseCase(mockRepo, mockConfig, new ApprovalPolicyService_1.ApprovalPolicyService(), mockAccountMetadata);
    console.log('Executing SubmitVoucherUseCase...');
    const result = await useCase.execute(companyId, 'v-001', submitterId);
    console.log('\nTEST RESULTS:');
    console.log('Status:', result.status);
    console.log('Operating Mode:', result.metadata.operatingMode);
    console.log('FA Required:', result.metadata.financialApprovalRequired);
    console.log('CC Required:', result.metadata.custodyConfirmationRequired);
    console.log('Pending FA:', result.metadata.pendingFinancialApproval);
    console.log('Pending Custodians:', result.metadata.pendingCustodyConfirmations);
    // Assertions (Logical)
    if (result.status === VoucherTypes_1.VoucherStatus.PENDING &&
        result.metadata.operatingMode === 'D' &&
        result.metadata.pendingFinancialApproval === true &&
        result.metadata.pendingCustodyConfirmations.includes('user-custodian')) {
        console.log('\n✅ PASS: Dual-Gate logic verified.');
    }
    else {
        console.log('\n❌ FAIL: Unexpected result.');
        process.exit(1);
    }
}
function createSampleVoucher() {
    const baseCurrency = 'USD';
    const data = {
        id: 'v-001',
        companyId: 'test-comp-123',
        voucherNo: 'V-TEST-001',
        type: VoucherTypes_1.VoucherType.JOURNAL_ENTRY,
        date: '2025-01-01',
        description: 'Test submission',
        currency: 'USD',
        baseCurrency: baseCurrency,
        exchangeRate: 1.0,
        totalDebit: 100,
        totalCredit: 100,
        status: VoucherTypes_1.VoucherStatus.DRAFT,
        createdBy: 'user-01',
        createdAt: new Date().toISOString(),
        lines: [
            { id: 1, accountId: 'acc-cash', side: 'Debit', baseAmount: 100, baseCurrency: baseCurrency, amount: 100, currency: 'USD', exchangeRate: 1.0, notes: 'Test debit' },
            { id: 2, accountId: 'acc-exp', side: 'Credit', baseAmount: 100, baseCurrency: baseCurrency, amount: 100, currency: 'USD', exchangeRate: 1.0, notes: 'Test credit' }
        ]
    };
    return VoucherEntity_1.VoucherEntity.fromJSON(data);
}
runTest().catch(err => {
    console.error('Test crashed:', err);
    process.exit(1);
});
//# sourceMappingURL=test-approval-gates.js.map