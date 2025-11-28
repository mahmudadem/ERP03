
import { AuditLog } from '../../../domain/system/entities/AuditLog';

/**
 * Interface for Audit Logging.
 */
export interface IAuditLogRepository {
  log(entry: AuditLog): Promise<void>;
  getLogs(companyId: string, filters?: any): Promise<AuditLog[]>;
}
