import { ApprovalEngine } from '../../../application/system-core/approval/ApprovalEngine';
import { ApprovalSubjectRegistry } from '../../../application/system-core/approval/ApprovalSubjectRegistry';
import { LedgerCustodyApprovalPlugin } from '../../../application/system-core/approval/plugins/LedgerCustodyApprovalPlugin';
import { ApprovalPolicyService } from '../../../domain/accounting/policies/ApprovalPolicyService';

describe('ApprovalEngine', () => {
  it('evaluates a non-voucher subject and lets modules block pending actions', async () => {
    const engine = new ApprovalEngine();
    const result = await engine.evaluate(
      {
        type: 'below_cost_sale',
        id: 'override_1',
        payload: { requiresApproval: true, requiredApprovers: ['manager_1'] },
      },
      { companyId: 'cmp_test', actorUserId: 'cashier_1' }
    );

    const actionBlocked = result.decision !== 'APPROVED';
    expect(result.decision).toBe('PENDING');
    expect(result.requiredApprovers).toEqual(['manager_1']);
    expect(actionBlocked).toBe(true);
  });

  it('wraps existing ledger custody approval as an accounting_voucher plugin', async () => {
    const configProvider = {
      getConfig: jest.fn().mockResolvedValue({
        financialApprovalEnabled: true,
        custodyConfirmationEnabled: false,
        faApplyMode: 'ALL',
      }),
    };
    const getAccountMetadata = jest.fn().mockResolvedValue([
      {
        accountId: 'acc_1',
        classification: 'ASSET',
        requiresApproval: true,
        requiresCustodyConfirmation: false,
      },
    ]);
    const engine = new ApprovalEngine(new ApprovalSubjectRegistry([
      new LedgerCustodyApprovalPlugin(
        configProvider as any,
        new ApprovalPolicyService(),
        getAccountMetadata as any
      ),
    ]));

    const result = await engine.evaluate(
      {
        type: 'accounting_voucher',
        id: 'v_1',
        payload: {
          voucher: {
            id: 'v_1',
            totalDebit: 100,
            lines: [{ accountId: 'acc_1', debitAmount: 100, creditAmount: 0 }],
          },
        },
      },
      { companyId: 'cmp_test', actorUserId: 'maker_1', voucherType: 'journal_entry' }
    );

    expect(result.decision).toBe('PENDING');
    expect(result.gates[0]).toMatchObject({
      name: 'ledger_custody_financial_approval',
      required: true,
    });
    expect((result.gates[0].metadata as any).accountingGateResult.financialApprovalRequired).toBe(true);
  });
});
