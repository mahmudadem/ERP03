import { IRecordChangeLogRepository } from '../../../repository/interfaces/system/IRecordChangeLogRepository';
import { RecordChangeLog, FieldChange, RecordChangeEntityType, RecordChangeAction } from '../../../domain/system/entities/RecordChangeLog';

const MAX_STRING_LENGTH = 500;

function truncate(value: string): string {
  if (value.length <= MAX_STRING_LENGTH) return value;
  return value.substring(0, MAX_STRING_LENGTH) + '... (truncated)';
}

function computeDiff(before: Record<string, any>, after: Record<string, any>): FieldChange[] {
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changes: FieldChange[] = [];

  for (const key of allKeys) {
    const beforeVal = before[key];
    const afterVal = after[key];

    const beforeStr = typeof beforeVal === 'object' && beforeVal !== null ? JSON.stringify(beforeVal) : String(beforeVal ?? '');
    const afterStr = typeof afterVal === 'object' && afterVal !== null ? JSON.stringify(afterVal) : String(afterVal ?? '');

    if (beforeStr !== afterStr) {
      changes.push({
        field: key,
        before: typeof beforeVal === 'object' && beforeVal !== null ? truncate(beforeStr) : (beforeVal ?? null),
        after: typeof afterVal === 'object' && afterVal !== null ? truncate(afterStr) : (afterVal ?? null),
      });
    }
  }

  return changes;
}

export class RecordChangeService {
  constructor(private readonly repo: IRecordChangeLogRepository) {}

  async recordUpdate(params: {
    companyId: string;
    entityType: string;
    entityId: string;
    entityNumber?: string;
    userId: string;
    userEmail?: string;
    before: Record<string, any>;
    after: Record<string, any>;
  }): Promise<void> {
    try {
      const changes = computeDiff(params.before, params.after);
      if (changes.length === 0) return;

      const entry = new RecordChangeLog({
        companyId: params.companyId,
        entityType: params.entityType as RecordChangeEntityType,
        entityId: params.entityId,
        entityNumber: params.entityNumber,
        action: 'UPDATE' as RecordChangeAction,
        changes,
        userId: params.userId,
        userEmail: params.userEmail,
      });

      await this.repo.create(entry);
    } catch (err) {
      console.error('[RecordChangeService] Failed to record change:', err);
    }
  }
}
