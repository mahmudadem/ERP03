
import { SubmitVoucherUseCase } from '../application/accounting/use-cases/SubmitVoucherUseCase';
import { ApprovalPolicyService } from '../domain/accounting/policies/ApprovalPolicyService';
import { VoucherEntity } from '../domain/accounting/entities/VoucherEntity';
import { VoucherStatus, VoucherType } from '../domain/accounting/types/VoucherTypes';
import { VoucherLineEntity } from '../domain/accounting/entities/VoucherLineEntity';

async function runTest() {
  console.log('--- STARTING APPROVAL GATES PROGRAMMATIC TEST ---');
  
  const companyId = 'test-comp-123';
  const submitterId = 'user-admin-01';

  // 1. Setup Mock Repository
  const mockRepo = {
    findById: async () => createSampleVoucher(),
    save: async (v: any) => v
  } as any;

  // 2. Setup Mock Config (Mode D: FA=ON, CC=ON)
  const mockConfig = {
    getConfig: async () => ({
      financialApprovalEnabled: true,
      faApplyMode: 'MARKED_ONLY',
      custodyConfirmationEnabled: true
    })
  } as any;

  // 3. Setup Account Metadata Mock (Triggering both gates)
  const mockAccountMetadata = async () => [
    { accountId: 'acc-cash', requiresApproval: true, requiresCustodyConfirmation: true, custodianUserId: 'user-custodian' },
    { accountId: 'acc-exp', requiresApproval: false, requiresCustodyConfirmation: false }
  ];

  const useCase = new SubmitVoucherUseCase(
    mockRepo,
    mockConfig,
    new ApprovalPolicyService(),
    mockAccountMetadata
  );

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
  if (result.status === VoucherStatus.PENDING && 
      result.metadata.operatingMode === 'D' &&
      result.metadata.pendingFinancialApproval === true &&
      result.metadata.pendingCustodyConfirmations.includes('user-custodian')) {
    console.log('\n✅ PASS: Dual-Gate logic verified.');
  } else {
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
    type: VoucherType.JOURNAL_ENTRY,
    date: '2025-01-01',
    description: 'Test submission',
    currency: 'USD',
    baseCurrency: baseCurrency,
    exchangeRate: 1.0,
    totalDebit: 100,
    totalCredit: 100,
    status: VoucherStatus.DRAFT,
    createdBy: 'user-01',
    createdAt: new Date().toISOString(),
    lines: [
      { id: 1, accountId: 'acc-cash', side: 'Debit', baseAmount: 100, baseCurrency: baseCurrency, amount: 100, currency: 'USD', exchangeRate: 1.0, notes: 'Test debit' },
      { id: 2, accountId: 'acc-exp', side: 'Credit', baseAmount: 100, baseCurrency: baseCurrency, amount: 100, currency: 'USD', exchangeRate: 1.0, notes: 'Test credit' }
    ]
  };
  
  return VoucherEntity.fromJSON(data);
}

runTest().catch(err => {
  console.error('Test crashed:', err);
  process.exit(1);
});
