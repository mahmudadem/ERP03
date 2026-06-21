import {
  ApprovalContext,
  ApprovalEngineResult,
  ApprovalSubject,
  ApprovalSubjectType,
} from '../../contracts/IApprovalEngine';
import {
  AccountApprovalMetadata,
  ApprovalGateResult,
  ApprovalPolicyService,
} from '../../../../domain/accounting/policies/ApprovalPolicyService';
import { IAccountingPolicyConfigProvider } from '../../../../infrastructure/accounting/config/IAccountingPolicyConfigProvider';

export class LedgerCustodyApprovalPlugin {
  readonly name = 'ledger_custody_financial_approval';

  constructor(
    private readonly policyConfigProvider: IAccountingPolicyConfigProvider,
    private readonly approvalPolicyService: ApprovalPolicyService,
    private readonly getAccountMetadata: (companyId: string, accountIds: string[]) => Promise<AccountApprovalMetadata[]>
  ) {}

  supports(type: ApprovalSubjectType): boolean {
    return type === 'accounting_voucher';
  }

  async evaluate(subject: ApprovalSubject, context: ApprovalContext): Promise<ApprovalEngineResult> {
    const payload = (subject.payload || {}) as any;
    const voucher = payload.voucher;
    const submitterId = String(context.actorUserId || payload.submitterId || '');
    const policyConfig = await this.policyConfigProvider.getConfig(context.companyId);
    const accountIds = [...new Set((voucher?.lines || []).map((line: any) => line.accountId).filter(Boolean))] as string[];
    const accountMetadata = await this.getAccountMetadata(context.companyId, accountIds);
    const smartCCContext = {
      creatorUserId: submitterId,
      voucherTotal: voucher?.totalDebit || 0,
      lines: (voucher?.lines || []).map((line: any) => ({
        accountId: line.accountId,
        debitAmount: line.debitAmount || 0,
        creditAmount: line.creditAmount || 0,
      })),
      isReversal: !!voucher?.reversalOfVoucherId,
    };
    const gateResult = this.approvalPolicyService.evaluateSmartGates(
      policyConfig,
      accountMetadata,
      smartCCContext
    );
    const autoApprove = this.approvalPolicyService.shouldAutoApprove(gateResult);
    return {
      decision: autoApprove ? 'APPROVED' : 'PENDING',
      requiredApprovers: [
        ...(gateResult.financialApprovalRequired ? ['financial_approver'] : []),
        ...gateResult.requiredCustodians,
      ],
      gates: [
        {
          name: 'ledger_custody_financial_approval',
          required: !autoApprove,
          metadata: { accountingGateResult: gateResult as ApprovalGateResult },
        },
      ],
    };
  }
}
