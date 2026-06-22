import { IPolicyEngine } from '../../system-core/contracts/IPolicyEngine';
import { IAuditEngine } from '../../system-core/contracts/IAuditEngine';
import { PosReceipt } from '../../../domain/pos/entities/PosReceipt';
import { IPosPaymentRepository } from '../../../repository/interfaces/pos/IPosPaymentRepository';
import { IPosReceiptRepository } from '../../../repository/interfaces/pos/IPosReceiptRepository';

export interface ReprintPosReceiptInput {
  companyId: string;
  receiptId: string;
  managerOverrideId?: string;
  reason?: string;
  actor: {
    userId: string;
    userEmail?: string;
    roleId?: string;
  };
}

export interface ReprintPosReceiptResult {
  receipt: PosReceipt;
  payments: unknown[];
}

export class ReprintPosReceiptUseCase {
  constructor(
    private readonly receiptRepo: IPosReceiptRepository,
    private readonly paymentRepo: IPosPaymentRepository,
    private readonly policyEngine?: IPolicyEngine,
    private readonly auditEngine?: IAuditEngine
  ) {}

  async execute(input: ReprintPosReceiptInput): Promise<ReprintPosReceiptResult> {
    const receipt = await this.receiptRepo.getById(input.companyId, input.receiptId);
    if (!receipt) throw new Error('Receipt not found');

    if (this.policyEngine) {
      const policy = await this.policyEngine.resolve({
        scope: 'pos',
        action: 'managerOverride',
        companyId: input.companyId,
        context: {
          overrideAction: 'REPRINT',
          cashierRoleId: input.actor.roleId,
          approvedOverrideId: input.managerOverrideId,
        },
      });
      if (!policy.allowed) {
        throw new Error(`Manager approval is required for POS receipt reprint: ${policy.resolvedBy.join(', ')}`);
      }
    }

    const payments = await this.paymentRepo.listByReceipt(input.companyId, input.receiptId);
    await this.auditEngine?.record({
      companyId: input.companyId,
      entity: { type: 'POS_RECEIPT', id: receipt.id, number: receipt.receiptNumber },
      action: 'UPDATE',
      before: { reprintRequested: false },
      after: {
        reprintRequested: true,
        reprintedAt: new Date().toISOString(),
        managerOverrideId: input.managerOverrideId,
      },
      actor: { userId: input.actor.userId, userEmail: input.actor.userEmail },
      reason: input.reason || 'POS receipt reprint',
      approval: input.managerOverrideId ? { managerOverrideId: input.managerOverrideId } : undefined,
    });

    return { receipt, payments };
  }
}
