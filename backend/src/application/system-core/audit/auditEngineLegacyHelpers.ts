import { IAuditEngine } from '../contracts/IAuditEngine';

interface LegacyAuditParams {
  companyId: string;
  entityType: string;
  entityId: string;
  entityNumber?: string;
  userId: string;
  userEmail?: string;
}

interface LegacyCreateParams extends LegacyAuditParams {
  snapshot: Record<string, unknown>;
}

interface LegacyUpdateParams extends LegacyAuditParams {
  before: Record<string, unknown>;
  after: Record<string, unknown>;
}

interface LegacyPeriodLockOverrideParams extends LegacyAuditParams {
  reason: string;
  lockedThroughDate?: string;
}

export async function recordAuditCreate(
  auditEngine: IAuditEngine | undefined,
  params: LegacyCreateParams
): Promise<void> {
  await auditEngine?.record({
    companyId: params.companyId,
    entity: { type: params.entityType, id: params.entityId, number: params.entityNumber },
    action: 'CREATE',
    actor: { userId: params.userId, userEmail: params.userEmail },
    after: params.snapshot,
  });
}

export async function recordAuditUpdate(
  auditEngine: IAuditEngine | undefined,
  params: LegacyUpdateParams
): Promise<void> {
  await auditEngine?.record({
    companyId: params.companyId,
    entity: { type: params.entityType, id: params.entityId, number: params.entityNumber },
    action: 'UPDATE',
    actor: { userId: params.userId, userEmail: params.userEmail },
    before: params.before,
    after: params.after,
  });
}

export async function recordAuditPost(
  auditEngine: IAuditEngine | undefined,
  params: LegacyAuditParams
): Promise<void> {
  await auditEngine?.record({
    companyId: params.companyId,
    entity: { type: params.entityType, id: params.entityId, number: params.entityNumber },
    action: 'POST',
    actor: { userId: params.userId, userEmail: params.userEmail },
  });
}

export async function recordAuditPeriodLockOverride(
  auditEngine: IAuditEngine | undefined,
  params: LegacyPeriodLockOverrideParams
): Promise<void> {
  await auditEngine?.record({
    companyId: params.companyId,
    entity: { type: params.entityType, id: params.entityId, number: params.entityNumber },
    action: 'PERIOD_LOCK_OVERRIDE',
    actor: { userId: params.userId, userEmail: params.userEmail },
    reason: params.reason,
    approval: params.lockedThroughDate ? { lockedThroughDate: params.lockedThroughDate } : undefined,
  });
}
