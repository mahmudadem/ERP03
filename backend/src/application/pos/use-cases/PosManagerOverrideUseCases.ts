import { randomUUID } from 'crypto';
import { POSManagerOverrideAction } from '../../../domain/pos/entities/POSPolicy';
import { IAuditEngine } from '../../system-core/contracts/IAuditEngine';
import { IApprovalEngine } from '../../system-core/contracts/IApprovalEngine';
import { subjectTypeForOverrideAction } from '../../system-core/approval/plugins/PosManagerOverrideApprovalPlugin';

export interface CreatePosManagerOverrideInput {
  companyId: string;
  action: POSManagerOverrideAction;
  managerUserId: string;
  managerName?: string;
  reason: string;
  context?: Record<string, unknown>;
  actor: {
    userId: string;
    userEmail?: string;
  };
}

export interface CreatePosManagerOverrideResult {
  managerOverrideId: string;
  approvedAt: string;
  action: POSManagerOverrideAction;
  managerUserId: string;
  managerName?: string;
  reason: string;
}

export class CreatePosManagerOverrideUseCase {
  constructor(
    private readonly auditEngine?: IAuditEngine,
    private readonly approvalEngine?: IApprovalEngine
  ) {}

  async execute(input: CreatePosManagerOverrideInput): Promise<CreatePosManagerOverrideResult> {
    if (!input.managerUserId?.trim()) {
      throw new Error('Manager approver is required.');
    }
    if (!input.reason?.trim()) {
      throw new Error('Manager approval reason is required.');
    }

    const managerUserId = input.managerUserId.trim();
    const cashierUserId = input.actor.userId;

    // The Approval Engine owns *who* may approve and the outcome: a real manager,
    // not the acting cashier, with approval authority. The token below is only
    // minted on an APPROVED decision — it is no longer a trust-the-screen gate.
    if (this.approvalEngine) {
      const decision = await this.approvalEngine.evaluate(
        {
          type: subjectTypeForOverrideAction(input.action),
          id: `${input.action}:${cashierUserId}:${randomUUID()}`,
          payload: {
            requiresApproval: true,
            action: input.action,
            cashierUserId,
            approverUserId: managerUserId,
          },
        },
        { companyId: input.companyId, actorUserId: cashierUserId }
      );
      if (decision.decision !== 'APPROVED') {
        const reason = (decision.gates[0]?.metadata as any)?.reason;
        if (reason === 'self_approval') {
          throw new Error('A cashier cannot approve their own POS override; a different manager must approve.');
        }
        if (reason === 'approver_not_authorized') {
          throw new Error('The selected approver is not authorized to approve POS overrides.');
        }
        // PENDING / any other non-approval: no token is issued.
        throw new Error('POS manager override was not approved.');
      }
    }

    const managerOverrideId = `mgr_override_${randomUUID()}`;
    const approvedAt = new Date().toISOString();
    const result: CreatePosManagerOverrideResult = {
      managerOverrideId,
      approvedAt,
      action: input.action,
      managerUserId,
      managerName: input.managerName?.trim() || undefined,
      reason: input.reason.trim(),
    };

    await this.auditEngine?.record({
      companyId: input.companyId,
      entity: { type: 'POS_MANAGER_OVERRIDE', id: managerOverrideId, number: managerOverrideId },
      action: 'CREATE',
      actor: { userId: input.actor.userId, userEmail: input.actor.userEmail },
      reason: result.reason,
      after: {
        ...result,
        cashierUserId: input.actor.userId,
        cashierUserEmail: input.actor.userEmail,
        context: input.context || {},
      },
      approval: {
        managerOverrideId,
        managerUserId: result.managerUserId,
        action: result.action,
      },
    });

    return result;
  }
}
