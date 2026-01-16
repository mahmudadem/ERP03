import { describe, it, expect, jest } from '@jest/globals';
import { SubmitVoucherUseCase } from '../../../../../src/application/accounting/use-cases/SubmitVoucherUseCase';
import { ApprovalPolicyService } from '../../../../../src/domain/accounting/policies/ApprovalPolicyService';
import { VoucherEntity } from '../../../../../src/domain/accounting/entities/VoucherEntity';
import { VoucherStatus, VoucherType } from '../../../../../src/domain/accounting/types/VoucherTypes';
import { VoucherLineEntity } from '../../../../../src/domain/accounting/entities/VoucherLineEntity';

describe('ApprovalGateWorkflow (Programmatic Test)', () => {
  const companyId = 'comp-001';
  const submitterId = 'user-001';

  // Mock Repository
  const mockVoucherRepository = {
    findById: jest.fn(),
    save: jest.fn((v) => Promise.resolve(v))
  } as any;

  // Mock Config Provider
  const mockConfigProvider = {
    getConfig: jest.fn()
  } as any;

  // Mock Account Metadata Service
  const mockGetAccountMetadata = jest.fn();

  const useCase = new SubmitVoucherUseCase(
    mockVoucherRepository,
    mockConfigProvider,
    new ApprovalPolicyService(),
    mockGetAccountMetadata
  );

  const createSampleVoucher = () => {
    const lines = [
      new VoucherLineEntity('line-1', 'acc-1', 'DEBIT', 100, 0, 'USD', 100, 1.0),
      new VoucherLineEntity('line-2', 'acc-2', 'CREDIT', 0, 100, 'USD', 100, 1.0)
    ];
    return new VoucherEntity(
      'v-001', companyId, 'V-001', VoucherType.JOURNAL, '2025-01-01',
      'Test', 'USD', 'USD', 1.0, lines, 100, 100, VoucherStatus.DRAFT
    );
  };

  it('should AUTO-APPROVE (Mode A) when no gates are enabled', async () => {
    // 1. Config: All gates DISABLED
    mockConfigProvider.getConfig.mockResolvedValue({
      financialApprovalEnabled: false,
      custodyConfirmationEnabled: false
    });

    // 2. Voucher
    const voucher = createSampleVoucher();
    mockVoucherRepository.findById.mockResolvedValue(voucher);

    // 3. Accounts: Nothing special
    mockGetAccountMetadata.mockResolvedValue([
      { accountId: 'acc-1', requiresApproval: false, requiresCustodyConfirmation: false },
      { accountId: 'acc-2', requiresApproval: false, requiresCustodyConfirmation: false }
    ]);

    // EXECUTE
    const result = await useCase.execute(companyId, 'v-001', submitterId);

    // ASSERT
    expect(result.status).toBe(VoucherStatus.APPROVED);
    expect(result.metadata.operatingMode).toBe('A');
    expect(result.metadata.financialApprovalRequired).toBe(false);
    expect(result.metadata.custodyConfirmationRequired).toBe(false);
    expect(result.approvedBy).toBe(submitterId);
    expect(result.approvedAt).toBeDefined();
  });

  it('should require DUAL-GATE (Mode D) when both gates are triggered', async () => {
    // 1. Config: All gates ENABLED
    mockConfigProvider.getConfig.mockResolvedValue({
      financialApprovalEnabled: true,
      faApplyMode: 'MARKED_ONLY',
      custodyConfirmationEnabled: true
    });

    // 2. Voucher
    const voucher = createSampleVoucher();
    mockVoucherRepository.findById.mockResolvedValue(voucher);

    // 3. Accounts: acc-1 needs FA, acc-2 needs CC
    mockGetAccountMetadata.mockResolvedValue([
      { accountId: 'acc-1', requiresApproval: true, requiresCustodyConfirmation: false },
      { accountId: 'acc-2', requiresApproval: false, requiresCustodyConfirmation: true, custodianUserId: 'custodian-bob' }
    ]);

    // EXECUTE
    const result = await useCase.execute(companyId, 'v-001', submitterId);

    // ASSERT
    expect(result.status).toBe(VoucherStatus.PENDING);
    expect(result.metadata.operatingMode).toBe('D');
    expect(result.metadata.financialApprovalRequired).toBe(true);
    expect(result.metadata.custodyConfirmationRequired).toBe(true);
    
    // Check frozen gate state
    expect(result.metadata.pendingFinancialApproval).toBe(true);
    expect(result.metadata.pendingCustodyConfirmations).toContain('custodian-bob');
    
    expect(result.approvedBy).toBeUndefined();
    expect(result.approvedAt).toBeUndefined();
  });

  it('should trigger FA for ALL vouchers if faApplyMode is ALL', async () => {
     // 1. Config: FA ENABLED, FA Mode ALL
     mockConfigProvider.getConfig.mockResolvedValue({
      financialApprovalEnabled: true,
      faApplyMode: 'ALL',
      custodyConfirmationEnabled: false
    });

    // 2. Voucher
    const voucher = createSampleVoucher();
    mockVoucherRepository.findById.mockResolvedValue(voucher);

    // 3. Accounts: NONE require approval explicitly
    mockGetAccountMetadata.mockResolvedValue([
      { accountId: 'acc-1', requiresApproval: false, requiresCustodyConfirmation: false },
      { accountId: 'acc-2', requiresApproval: false, requiresCustodyConfirmation: false }
    ]);

    // EXECUTE
    const result = await useCase.execute(companyId, 'v-001', submitterId);

    // ASSERT
    expect(result.status).toBe(VoucherStatus.PENDING);
    expect(result.metadata.financialApprovalRequired).toBe(true);
    expect(result.metadata.operatingMode).toBe('C');
  });
});
