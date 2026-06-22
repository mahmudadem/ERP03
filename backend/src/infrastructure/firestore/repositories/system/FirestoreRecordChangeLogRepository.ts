import { Firestore, Query } from 'firebase-admin/firestore';
import { RecordChangeLog } from '../../../../domain/system/entities/RecordChangeLog';
import { IRecordChangeLogRepository, RecordChangeLogListFilters } from '../../../../repository/interfaces/system/IRecordChangeLogRepository';

interface RecordChangeLogDoc {
  id: string;
  companyId: string;
  entityType: string;
  entityId: string;
  entityNumber?: string;
  action: string;
  changes: Array<{ field: string; before: unknown; after: unknown }>;
  userId: string;
  userEmail?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

class RecordChangeLogMapper {
  static toPersistence(entry: RecordChangeLog): RecordChangeLogDoc {
    return {
      id: entry.id,
      companyId: entry.companyId,
      entityType: entry.entityType,
      entityId: entry.entityId,
      entityNumber: entry.entityNumber,
      action: entry.action,
      changes: entry.changes,
      userId: entry.userId,
      userEmail: entry.userEmail,
      timestamp: entry.timestamp.toISOString(),
      metadata: entry.metadata,
    };
  }

  static toDomain(data: any): RecordChangeLog {
    return new RecordChangeLog({
      id: data.id,
      companyId: data.companyId,
      entityType: data.entityType as RecordChangeLog['entityType'],
      entityId: data.entityId,
      entityNumber: data.entityNumber,
      action: data.action as RecordChangeLog['action'],
      changes: data.changes,
      userId: data.userId,
      userEmail: data.userEmail,
      timestamp: new Date(data.timestamp),
      metadata: data.metadata,
    });
  }
}

export class FirestoreRecordChangeLogRepository implements IRecordChangeLogRepository {
  constructor(private readonly db: Firestore) {}

  private collection(companyId: string) {
    return this.db.collection('companies').doc(companyId).collection('record_change_logs');
  }

  async create(entry: RecordChangeLog, _transaction?: unknown): Promise<void> {
    const ref = this.collection(entry.companyId).doc(entry.id);
    const data = RecordChangeLogMapper.toPersistence(entry);
    await ref.set(data);
  }

  async findByEntity(companyId: string, entityType: string, entityId: string): Promise<RecordChangeLog[]> {
    const snap = await this.collection(companyId)
      .where('entityType', '==', entityType)
      .where('entityId', '==', entityId)
      .orderBy('timestamp', 'desc')
      .get();
    return snap.docs.map((doc) => RecordChangeLogMapper.toDomain(doc.data()));
  }

  async list(companyId: string, filters: RecordChangeLogListFilters = {}): Promise<RecordChangeLog[]> {
    let query: Query = this.collection(companyId);
    if (filters.entityType) query = query.where('entityType', '==', filters.entityType);
    if (filters.action) query = query.where('action', '==', filters.action);
    if (filters.dateFrom) query = query.where('timestamp', '>=', filters.dateFrom);
    if (filters.dateTo) query = query.where('timestamp', '<=', filters.dateTo);
    query = query.orderBy('timestamp', 'desc');
    if (filters.limit) query = query.limit(filters.limit);
    const snap = await query.get();
    return snap.docs.map((doc) => RecordChangeLogMapper.toDomain(doc.data()));
  }
}
