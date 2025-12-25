/**
 * FirestoreVoucherRepository.ts
 * 
 * Layer: Infrastructure
 * Purpose: Implementation of IVoucherRepository using company-scoped subcollections
 * 
 * Structure: companies/{companyId}/vouchers/{voucherId}
 * This ensures data isolation between companies
 */
import * as admin from 'firebase-admin';
import { BaseFirestoreRepository } from '../BaseFirestoreRepository';
import { IVoucherRepository } from '../../../../repository/interfaces/accounting';
import { Voucher } from '../../../../domain/accounting/entities/Voucher';
import { VoucherMapper } from '../../mappers/AccountingMappers';
import { InfrastructureError } from '../../../errors/InfrastructureError';

export class FirestoreVoucherRepository extends BaseFirestoreRepository<Voucher> implements IVoucherRepository {
  protected collectionName = 'vouchers'; // Used within company subcollection

  /**
   * Get the vouchers subcollection for a specific company
   */
  private getVouchersCollection(companyId: string) {
    return this.db.collection('companies').doc(companyId).collection('vouchers');
  }

  protected toDomain(data: any): Voucher {
    return VoucherMapper.toDomain(data);
  }

  protected toPersistence(entity: Voucher): any {
    return VoucherMapper.toPersistence(entity);
  }

  async createVoucher(voucher: Voucher, transaction?: admin.firestore.Transaction): Promise<void> {
    try {
      const data = this.toPersistence(voucher);
      const voucherRef = this.getVouchersCollection(voucher.companyId).doc(voucher.id);
      
      if (transaction) {
        transaction.set(voucherRef, data);
      } else {
        await voucherRef.set(data);
      }
    } catch (error) {
      throw new InfrastructureError('Error creating voucher', error);
    }
  }

  async updateVoucher(companyId: string, id: string, data: Partial<Voucher>, transaction?: admin.firestore.Transaction): Promise<void> {
    try {
      const voucherRef = this.getVouchersCollection(companyId).doc(id);
      
      if (transaction) {
        transaction.update(voucherRef, data);
      } else {
        await voucherRef.update(data);
      }
    } catch (error) {
      throw new InfrastructureError('Error updating voucher', error);
    }
  }

  async deleteVoucher(companyId: string, id: string, transaction?: admin.firestore.Transaction): Promise<void> {
    try {
      const voucherRef = this.getVouchersCollection(companyId).doc(id);
      
      if (transaction) {
        transaction.delete(voucherRef);
      } else {
        await voucherRef.delete();
      }
    } catch (error) {
      throw new InfrastructureError('Error deleting voucher', error);
    }
  }

  async getVoucher(companyId: string, id: string): Promise<Voucher | null> {
    try {
      const doc = await this.getVouchersCollection(companyId).doc(id).get();
      if (!doc.exists) return null;
      return this.toDomain(doc.data());
    } catch (error) {
      throw new InfrastructureError('Error fetching voucher', error);
    }
  }

  async getVouchers(companyId: string, filters?: any): Promise<Voucher[]> {
    try {
      console.log('\n\n========== VOUCHER QUERY DEBUG START ==========');
      console.log('FILTERS:', JSON.stringify(filters, null, 2));
      
      // First, check total vouchers without filters for debugging
      const allVouchersSnapshot = await this.getVouchersCollection(companyId).get();
      console.log('TOTAL VOUCHERS IN DB:', allVouchersSnapshot.size);
      
      // Log first voucher's date for comparison if any exist
      if (allVouchersSnapshot.size > 0) {
        const firstDoc = allVouchersSnapshot.docs[0].data();
        console.log('FIRST VOUCHER DATE:', firstDoc.date);
        console.log('FIRST VOUCHER TYPE:', firstDoc.type);
        console.log('FIRST VOUCHER FORMID:', firstDoc.formId);
      }
      
      let query: admin.firestore.Query = this.getVouchersCollection(companyId);

      // Apply filters
      if (filters?.type) {
        console.log('FILTERING BY TYPE:', filters.type);
        query = query.where('type', '==', filters.type);
      }
      
      if (filters?.formId) {
        console.log('FILTERING BY FORMID:', filters.formId);
        query = query.where('formId', '==', filters.formId);
      }
      
      if (filters?.status) {
        console.log('FILTERING BY STATUS:', filters.status);
        query = query.where('status', '==', filters.status);
      }
      
      // Date range filtering using ISO strings (same format as existing vouchers)
      if (filters?.from) {
        const fromDate = new Date(filters.from);
        console.log('FILTERING FROM DATE:', fromDate.toISOString());
        query = query.where('date', '>=', fromDate.toISOString());
      }
      if (filters?.to && !filters?.from) {
        // Only apply 'to' if 'from' is not set (Firestore range limitation)
        const toDate = new Date(filters.to);
        console.log('FILTERING TO DATE:', toDate.toISOString());
        query = query.where('date', '<=', toDate.toISOString());
      }
      
      const snapshot = await query.get();
      console.log('QUERY RETURNED:', snapshot.size, 'vouchers');
      console.log('========== VOUCHER QUERY DEBUG END ==========\n\n');
      
      let vouchers = snapshot.docs.map(doc => this.toDomain(doc.data()));
      
      // Apply client-side filters that Firestore can't handle
      if (filters?.to && filters?.from) {
        // If both from and to are set, filter 'to' client-side
        const toDate = new Date(filters.to);
        vouchers = vouchers.filter(v => new Date(v.date) <= toDate);
      }
      
      if (filters?.search) {
        const searchLower = filters.search.toLowerCase();
        vouchers = vouchers.filter(v => 
          v.voucherNo?.toLowerCase().includes(searchLower) ||
          v.reference?.toLowerCase().includes(searchLower)
        );
      }
      
      return vouchers;
    } catch (error) {
      throw new InfrastructureError('Error fetching vouchers', error);
    }
  }

  async getVouchersByDateRange(companyId: string, fromDate: Date, toDate: Date): Promise<Voucher[]> {
    try {
      // Query the company-scoped subcollection
      const query = this.getVouchersCollection(companyId)
        .where('date', '>=', fromDate.toISOString())
        .where('date', '<=', toDate.toISOString())
        .orderBy('date', 'asc');

      const snapshot = await query.get();
      
      console.log(`📊 [Firestore] Fetched ${snapshot.size} vouchers for company ${companyId.substring(0, 20)}... (${fromDate.toISOString().split('T')[0]} to ${toDate.toISOString().split('T')[0]})`);
      
      return snapshot.docs.map(doc => this.toDomain(doc.data()));
    } catch (error) {
      throw new InfrastructureError('Error fetching vouchers by date range', error);
    }
  }
}
