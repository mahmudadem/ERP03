
import { BaseFirestoreRepository } from '../BaseFirestoreRepository';
import { ICostCenterRepository, IExchangeRateRepository } from '../../../../repository/interfaces/accounting';
import { CostCenter } from '../../../../domain/accounting/entities/CostCenter';
import { ExchangeRate } from '../../../../domain/accounting/entities/ExchangeRate';
import * as admin from 'firebase-admin';

// Simple Inline Mappers for brevity in this consolidated file or import from AccountingMappers
class CostCenterMapper {
    static toDomain(d: any) { return new CostCenter(d.id, d.companyId, d.name, d.code, d.parentId); }
    static toPersistence(e: CostCenter) { return { ...e }; }
}
class ExchangeRateMapper {
    static toDomain(d: any) { return new ExchangeRate(d.id, d.fromCurrency, d.toCurrency, d.rate, d.date?.toDate?.()); }
    static toPersistence(e: ExchangeRate) { return { ...e, date: admin.firestore.Timestamp.fromDate(e.date) }; }
}

export class FirestoreCostCenterRepository extends BaseFirestoreRepository<CostCenter> implements ICostCenterRepository {
  protected collectionName = 'cost_centers';
  protected toDomain = CostCenterMapper.toDomain;
  protected toPersistence = CostCenterMapper.toPersistence;

  async createCostCenter(costCenter: CostCenter): Promise<void> { return this.save(costCenter); }
  async updateCostCenter(id: string, data: Partial<CostCenter>): Promise<void> {
      await this.db.collection(this.collectionName).doc(id).update(data);
  }
  async getCostCenter(id: string): Promise<CostCenter | null> { return this.findById(id); }
  async getCompanyCostCenters(companyId: string): Promise<CostCenter[]> {
      const snap = await this.db.collection(this.collectionName).where('companyId', '==', companyId).get();
      return snap.docs.map(d => this.toDomain(d.data()));
  }
}

export class FirestoreExchangeRateRepository extends BaseFirestoreRepository<ExchangeRate> implements IExchangeRateRepository {
  protected collectionName = 'exchange_rates';
  protected toDomain = ExchangeRateMapper.toDomain;
  protected toPersistence = ExchangeRateMapper.toPersistence;

  async setRate(rate: ExchangeRate): Promise<void> { return this.save(rate); }
  async getRate(from: string, to: string, date: Date): Promise<ExchangeRate | null> {
      // MVP: Simplified query, ignoring date range for exact match or latest
      const snap = await this.db.collection(this.collectionName)
        .where('fromCurrency', '==', from)
        .where('toCurrency', '==', to)
        .orderBy('date', 'desc')
        .limit(1)
        .get();
      if (snap.empty) return null;
      return this.toDomain(snap.docs[0].data());
  }
}
