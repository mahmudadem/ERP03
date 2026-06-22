import { randomUUID } from 'crypto';
import { POSManagerOverrideAction } from '../../../domain/pos/entities/POSPolicy';
import { IAuditEngine } from '../../system-core/contracts/IAuditEngine';

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
  constructor(private readonly auditEngine?: IAuditEngine) {}

  async execute(input: CreatePosManagerOverrideInput): Promise<CreatePosManagerOverrideResult> {
    if (!input.managerUserId?.trim()) {
      throw new Error('Manager approver is required.');
    }
    if (!input.reason?.trim()) {
      throw new Error('Manager approval reason is required.');
    }

    const managerOverrideId = `mgr_override_${randomUUID()}`;
    const approvedAt = new Date().toISOString();
    const result: CreatePosManagerOverrideResult = {
      managerOverrideId,
      approvedAt,
      action: input.action,
      managerUserId: input.managerUserId.trim(),
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
