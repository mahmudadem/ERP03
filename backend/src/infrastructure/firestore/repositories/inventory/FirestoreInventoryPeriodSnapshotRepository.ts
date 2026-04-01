import { Firestore, Query } from 'firebase-admin/firestore';
import { InventoryPeriodSnapshot } from '../../../../domain/inventory/entities/InventoryPeriodSnapshot';
import {
  IInventoryPeriodSnapshotRepository,
  InventoryPeriodSnapshotListOptions,
} from '../../../../repository/interfaces/inventory/IInventoryPeriodSnapshotRepository';
import { InventoryPeriodSnapshotMapper } from '../../mappers/InventoryMappers';
import { getInventoryCollection } from './InventoryFirestorePaths';

export class FirestoreInventoryPeriodSnapshotRepository implements IInventoryPeriodSnapshotRepository {
  constructor(private readonly db: Firestore) {}

  private collection(companyId: string) {
    return getInventoryCollection(this.db, companyId, 'period_snapshots');
  }

  private applyPaging(query: Query, opts?: InventoryPeriodSnapshotListOptions): Query {
    let ref = query;
    if (opts?.offset) ref = ref.offset(opts.offset);
    if (opts?.limit) ref = ref.limit(opts.limit);
    return ref;
  }

  async saveSnapshot(snapshot: InventoryPeriodSnapshot): Promise<void> {
    await this.collection(snapshot.companyId)
      .doc(snapshot.id)
      .set(InventoryPeriodSnapshotMapper.toPersistence(snapshot));
  }

  async getSnapshot(companyId: string, id: string): Promise<InventoryPeriodSnapshot | null> {
    const doc = await this.collection(companyId).doc(id).get();
    if (!doc.exists) return null;
    return InventoryPeriodSnapshotMapper.toDomain(doc.data());
  }

  async getSnapshotByPeriodKey(companyId: string, periodKey: string): Promise<InventoryPeriodSnapshot | null> {
    const snap = await this.collection(companyId)
      .where('periodKey', '==', periodKey)
      .limit(1)
      .get();

    if (snap.empty) return null;
    return InventoryPeriodSnapshotMapper.toDomain(snap.docs[0].data());
  }

  async findNearestSnapshotForDate(companyId: string, asOfDate: string): Promise<InventoryPeriodSnapshot | null> {
    const snap = await this.collection(companyId)
      .where('periodEndDate', '<=', asOfDate)
      .orderBy('periodEndDate', 'desc')
      .limit(1)
      .get();

    if (snap.empty) return null;
    return InventoryPeriodSnapshotMapper.toDomain(snap.docs[0].data());
  }

  async listSnapshots(companyId: string, opts?: InventoryPeriodSnapshotListOptions): Promise<InventoryPeriodSnapshot[]> {
    let query: Query = this.collection(companyId).orderBy('periodEndDate', 'desc');
    query = this.applyPaging(query, opts);

    const snap = await query.get();
    return snap.docs.map((doc) => InventoryPeriodSnapshotMapper.toDomain(doc.data()));
  }
}
