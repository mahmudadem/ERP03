import { AccountingPolicyRegistry } from '../../accounting/policies/AccountingPolicyRegistry';
import { ApprovalPolicyService } from '../../../domain/accounting/policies/ApprovalPolicyService';
import {
  ApprovalContext,
  ApprovalEngineResult,
  ApprovalSubject,
  IApprovalEngine,
} from '../contracts/IApprovalEngine';

export class LegacyApprovalEngineAdapter implements IApprovalEngine {
  constructor(
    private readonly policyRegistry?: AccountingPolicyRegistry,
    private readonly approvalPolicyService = new ApprovalPolicyService()
  ) {}

  async evaluate(subject: ApprovalSubject, context: ApprovalContext): Promise<ApprovalEngineResult> {
    if (subject.type === 'accounting_voucher' && this.policyRegistry) {
      const voucherType = context.voucherType || (subject.payload as any)?.voucherType || '';
      const required = await this.policyRegistry.isApprovalRequiredForVoucherType(context.companyId, voucherType);
      return {
        decision: required ? 'PENDING' : 'APPROVED',
        requiredApprovers: [],
        gates: [{ name: 'accounting_policy', required }],
      };
    }

    return {
      decision: 'APPROVED',
      requiredApprovers: [],
      gates: [{ name: 'phase0_default', required: false }],
    };
  }
}

