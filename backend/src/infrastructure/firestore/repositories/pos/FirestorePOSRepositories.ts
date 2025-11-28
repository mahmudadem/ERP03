
import { BaseFirestoreRepository } from '../BaseFirestoreRepository';
import { IPosShiftRepository, IPosOrderRepository } from '../../../../repository/interfaces/pos';
import { POSShift } from '../../../../domain/pos/entities/POSShift';
import { POSOrder } from '../../../../domain/pos/entities/POSOrder';
import { POSShiftMapper, POSOrderMapper } from '../../mappers/POSMappers';
import * as admin from 'firebase-admin';

export class FirestorePosShiftRepository extends BaseFirestoreRepository<POSShift> implements IPosShiftRepository {
  protected collectionName = 'pos_shifts';
  protected toDomain = POSShiftMapper.toDomain;
  protected toPersistence = POSShiftMapper.toPersistence;

  async openShift(shift: POSShift): Promise<void> { return this.save(shift); }
  async closeShift(id: string, closedAt: Date, balance: number): Promise<void> {
      await this.db.collection(this.collectionName).doc(id).update({
          closedAt: admin.firestore.Timestamp.fromDate(closedAt),
          closingBalance: balance
      });
  }
  async getShift(id: string): Promise<POSShift | null> { return this.findById(id); }
  async getCompanyShifts(companyId: string): Promise<POSShift[]> {
      const snap = await this.db.collection(this.collectionName).where('companyId', '==', companyId).get();
      return snap.docs.map(d => this.toDomain(d.data()));
  }
}

export class FirestorePosOrderRepository extends BaseFirestoreRepository<POSOrder> implements IPosOrderRepository {
  protected collectionName = 'pos_orders';
  protected toDomain = POSOrderMapper.toDomain;
  protected toPersistence = POSOrderMapper.toPersistence;

  async createOrder(order: POSOrder): Promise<void> { return this.save(order); }
  async getOrder(id: string): Promise<POSOrder | null> { return this.findById(id); }
  async getCompanyOrders(companyId: string): Promise<POSOrder[]> {
      const snap = await this.db.collection(this.collectionName).where('companyId', '==', companyId).get();
      return snap.docs.map(d => this.toDomain(d.data()));
  }
}
