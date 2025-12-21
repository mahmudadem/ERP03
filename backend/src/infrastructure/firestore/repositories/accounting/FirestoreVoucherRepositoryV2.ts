import { Firestore } from 'firebase-admin/firestore';
import { IVoucherRepository } from '../../../domain/accounting/repositories/IVoucherRepository';
import { VoucherEntity } from '../../../domain/accounting/entities/VoucherEntity';
import { VoucherType, VoucherStatus } from '../../../domain/accounting/types/VoucherTypes';

/**
 * Firestore Voucher Repository Implementation (ADR-005 Compliant)
 * 
 * Simple, explicit persistence layer.
 * Storage: companies/{companyId}/vouchers/{voucherId}
 */
export class FirestoreVoucherRepositoryV2 implements IVoucherRepository {
  private readonly COLLECTION_NAME = 'vouchers';

  constructor(private readonly db: Firestore) {}

  private getCollection(companyId: string) {
    return this.db
      .collection('companies')
      .doc(companyId)
      .collection(this.COLLECTION_NAME);
  }

  async save(voucher: VoucherEntity): Promise<VoucherEntity> {
    const collection = this.getCollection(voucher.companyId);
    const docRef = collection.doc(voucher.id);
    
    const data = voucher.toJSON();
    await docRef.set(data, { merge: true });
    
    return voucher;
  }

  async findById(companyId: string, voucherId: string): Promise<VoucherEntity | null> {
    const collection = this.getCollection(companyId);
    const docRef = collection.doc(voucherId);
    const snapshot = await docRef.get();
    
    if (!snapshot.exists) {
      return null;
    }
    
    const data = snapshot.data();
    if (!data) {
      return null;
    }
    
    return VoucherEntity.fromJSON(data);
  }

  async findByType(
    companyId: string,
    type: VoucherType,
    limit: number = 100
  ): Promise<VoucherEntity[]> {
    const collection = this.getCollection(companyId);
    const query = collection
      .where('type', '==', type)
      .orderBy('date', 'desc')
      .limit(limit);
    
    const snapshot = await query.get();
    return snapshot.docs.map(doc => VoucherEntity.fromJSON(doc.data()));
  }

  async findByStatus(
    companyId: string,
    status: VoucherStatus,
    limit: number = 100
  ): Promise<VoucherEntity[]> {
    const collection = this.getCollection(companyId);
    const query = collection
      .where('status', '==', status)
      .orderBy('date', 'desc')
      .limit(limit);
    
    const snapshot = await query.get();
    return snapshot.docs.map(doc => VoucherEntity.fromJSON(doc.data()));
  }

  async findByDateRange(
    companyId: string,
    startDate: string,
    endDate: string,
    limit: number = 100
  ): Promise<VoucherEntity[]> {
    const collection = this.getCollection(companyId);
    const query = collection
      .where('date', '>=', startDate)
      .where('date', '<=', endDate)
      .orderBy('date', 'desc')
      .limit(limit);
    
    const snapshot = await query.get();
    return snapshot.docs.map(doc => VoucherEntity.fromJSON(doc.data()));
  }

  async findByCompany(
    companyId: string,
    limit: number = 100
  ): Promise<VoucherEntity[]> {
    const collection = this.getCollection(companyId);
    const query = collection
      .orderBy('date', 'desc')
      .limit(limit);
    
    const snapshot = await query.get();
    return snapshot.docs.map(doc => VoucherEntity.fromJSON(doc.data()));
  }

  async delete(companyId: string, voucherId: string): Promise<boolean> {
    const collection = this.getCollection(companyId);
    const docRef = collection.doc(voucherId);
    
    const snapshot = await docRef.get();
    if (!snapshot.exists) {
      return false;
    }
    
    await docRef.delete();
    return true;
  }

  async existsByNumber(companyId: string, voucherNo: string): Promise<boolean> {
    const collection = this.getCollection(companyId);
    const query = collection
      .where('voucherNo', '==', voucherNo)
      .limit(1);
    
    const snapshot = await query.get();
    return !snapshot.empty;
  }
}
