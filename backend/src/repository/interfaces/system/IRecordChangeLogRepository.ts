import { RecordChangeLog } from '../../../domain/system/entities/RecordChangeLog';

export interface RecordChangeLogListFilters {
  entityType?: string;
  action?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
}

export interface IRecordChangeLogRepository {
  create(entry: RecordChangeLog, transaction?: unknown): Promise<void>;
  findByEntity(companyId: string, entityType: string, entityId: string): Promise<RecordChangeLog[]>;
  list(companyId: string, filters?: RecordChangeLogListFilters): Promise<RecordChangeLog[]>;
}
