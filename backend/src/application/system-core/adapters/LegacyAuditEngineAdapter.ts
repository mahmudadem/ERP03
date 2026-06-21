import { RecordChangeService } from '../../system/services/RecordChangeService';
import { AuditRecordInput, IAuditEngine } from '../contracts/IAuditEngine';

export class LegacyAuditEngineAdapter implements IAuditEngine {
  constructor(private readonly recordChangeService: RecordChangeService) {}

  async record(input: AuditRecordInput): Promise<void> {
    const common = {
      companyId: input.companyId,
      entityType: input.entity.type,
      entityId: input.entity.id,
      entityNumber: input.entity.number,
      userId: input.actor.userId,
      userEmail: input.actor.userEmail,
    };

    if (input.action === 'CREATE') {
      await this.recordChangeService.recordCreate({
        ...common,
        snapshot: input.after || {},
      });
      return;
    }

    if (input.action === 'POST') {
      await this.recordChangeService.recordPost({
        ...common,
        metadata: { reason: input.reason, approval: input.approval },
      });
      return;
    }

    if (input.action === 'PERIOD_LOCK_OVERRIDE') {
      await this.recordChangeService.recordPeriodLockOverride({
        ...common,
        reason: input.reason || '',
      });
      return;
    }

    await this.recordChangeService.recordUpdate({
      ...common,
      before: input.before || {},
      after: input.after || {},
    });
  }
}

