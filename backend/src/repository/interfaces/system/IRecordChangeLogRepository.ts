import { RecordChangeLog } from '../../../domain/system/entities/RecordChangeLog';

export interface IRecordChangeLogRepository {
  create(entry: RecordChangeLog, transaction?: unknown): Promise<void>;
  findByEntity(companyId: string, entityType: string, entityId: string): Promise<RecordChangeLog[]>;
}
