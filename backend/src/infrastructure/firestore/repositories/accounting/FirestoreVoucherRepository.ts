/**
 * FirestoreVoucherRepository.ts
 * 
 * Layer: Infrastructure
 * Purpose: Implementation of IVoucherRepository.
 */
import * as admin from 'firebase-admin';
import { BaseFirestoreRepository } from '../BaseFirestoreRepository';
import { IVoucherRepository } from '../../../../repository/interfaces/accounting';
import { Voucher } from '../../../../domain/accounting/models/Voucher';
import { VoucherMapper } from '../../mappers/AccountingMappers';
import { InfrastructureError } from '../../../errors/InfrastructureError';

export class FirestoreVoucherRepository extends BaseFirestoreRepository<Voucher> implements IVoucherRepository {
  protected collectionName = 'vouchers';

  protected toDomain(data: any): Voucher {
    return VoucherMapper.toDomain(data);
  }

  protected toPersistence(entity: Voucher): any {
    return VoucherMapper.toPersistence(entity);
  }

  async createVoucher(voucher: Voucher): Promise<void> {
    return this.save(voucher);
  }

  async updateVoucher(id: string, data: Partial<Voucher>): Promise<void> {
    try {
      await this.db.collection(this.collectionName).doc(id).update(data);
    } catch (error) {
      throw new InfrastructureError('Error updating voucher', error);
    }
  }

  async deleteVoucher(id: string): Promise<void> {
    return this.delete(id);
  }

  async getVoucher(id: string): Promise<Voucher | null> {
    return this.findById(id);
  }

  async getVouchers(companyId: string, filters?: any): Promise<Voucher[]> {
    try {
      let query: admin.firestore.Query = this.db.collection(this.collectionName)
        .where('companyId', '==', companyId);

      // Apply basic filters if needed (omitted for MVP brevity)
      
      const snapshot = await query.get();
      return snapshot.docs.map(doc => this.toDomain(doc.data()));
    } catch (error) {
      throw new InfrastructureError('Error fetching vouchers', error);
    }
  }
}
