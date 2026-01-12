
import { BaseFirestoreRepository } from '../BaseFirestoreRepository';
import { ICostCenterRepository, IExchangeRateRepository } from '../../../../repository/interfaces/accounting';
import { CostCenter } from '../../../../domain/accounting/entities/CostCenter';
import { ExchangeRate } from '../../../../domain/accounting/entities/ExchangeRate';
import { Timestamp } from 'firebase-admin/firestore';

// Simple Inline Mappers for brevity in this consolidated file or import from AccountingMappers
class CostCenterMapper {
    static toDomain(d: any) { return new CostCenter(d.id, d.companyId, d.name, d.code, d.parentId); }
    static toPersistence(e: CostCenter) { return { ...e }; }
}
class ExchangeRateMapper {
    static toDomain(d: any) { 
      return new ExchangeRate({
        id: d.id,
        companyId: d.companyId || '',
        fromCurrency: d.fromCurrency,
        toCurrency: d.toCurrency,
        rate: d.rate,
        date: d.date?.toDate?.() || new Date(d.date),
        source: d.source || 'MANUAL',
        createdAt: d.createdAt?.toDate?.() || new Date(),
        createdBy: d.createdBy,
      }); 
    }
    static toPersistence(e: ExchangeRate) { 
      return { 
        id: e.id,
        companyId: e.companyId,
        fromCurrency: e.fromCurrency,
        toCurrency: e.toCurrency,
        rate: e.rate,
        date: Timestamp.fromDate(e.date),
        source: e.source,
        createdAt: Timestamp.fromDate(e.createdAt),
        createdBy: e.createdBy || null,
      }; 
    }
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

  async save(rate: ExchangeRate): Promise<void> { 
    return super.save(rate); 
  }

  /** @deprecated Use save() instead */
  async setRate(rate: ExchangeRate): Promise<void> { 
    return this.save(rate); 
  }

  /** @deprecated Use getLatestRate() instead */
  async getRate(from: string, to: string, date: Date): Promise<ExchangeRate | null> {
    const snap = await this.db.collection(this.collectionName)
      .where('fromCurrency', '==', from)
      .where('toCurrency', '==', to)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();
    if (snap.empty) return null;
    return this.toDomain(snap.docs[0].data());
  }

  async getLatestRate(
    companyId: string,
    fromCurrency: string,
    toCurrency: string,
    date: Date
  ): Promise<ExchangeRate | null> {
    const dateStart = new Date(date);
    dateStart.setHours(0, 0, 0, 0);
    const dateEnd = new Date(date);
    dateEnd.setHours(23, 59, 59, 999);

    const snap = await this.db.collection(this.collectionName)
      .where('companyId', '==', companyId)
      .where('fromCurrency', '==', fromCurrency.toUpperCase())
      .where('toCurrency', '==', toCurrency.toUpperCase())
      .where('date', '>=', Timestamp.fromDate(dateStart))
      .where('date', '<=', Timestamp.fromDate(dateEnd))
      .orderBy('date', 'desc')
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    if (snap.empty) return null;
    return this.toDomain(snap.docs[0].data());
  }

  async getRatesForDate(
    companyId: string,
    fromCurrency: string,
    toCurrency: string,
    date: Date
  ): Promise<ExchangeRate[]> {
    const dateStart = new Date(date);
    dateStart.setHours(0, 0, 0, 0);
    const dateEnd = new Date(date);
    dateEnd.setHours(23, 59, 59, 999);

    const snap = await this.db.collection(this.collectionName)
      .where('companyId', '==', companyId)
      .where('fromCurrency', '==', fromCurrency.toUpperCase())
      .where('toCurrency', '==', toCurrency.toUpperCase())
      .where('date', '>=', Timestamp.fromDate(dateStart))
      .where('date', '<=', Timestamp.fromDate(dateEnd))
      .orderBy('date', 'desc')
      .orderBy('createdAt', 'desc')
      .get();

    return snap.docs.map(d => this.toDomain(d.data()));
  }

  async getRecentRates(
    companyId: string,
    fromCurrency?: string,
    toCurrency?: string,
    limit: number = 10
  ): Promise<ExchangeRate[]> {
    let query = this.db.collection(this.collectionName).where('companyId', '==', companyId);
    
    if (fromCurrency) {
      query = query.where('fromCurrency', '==', fromCurrency.toUpperCase());
    }
    if (toCurrency) {
      query = query.where('toCurrency', '==', toCurrency.toUpperCase());
    }

    const snap = await query
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    return snap.docs.map(d => this.toDomain(d.data()));
  }

  async getMostRecentRate(
    companyId: string,
    fromCurrency: string,
    toCurrency: string
  ): Promise<ExchangeRate | null> {
    const snap = await this.db.collection(this.collectionName)
      .where('companyId', '==', companyId)
      .where('fromCurrency', '==', fromCurrency.toUpperCase())
      .where('toCurrency', '==', toCurrency.toUpperCase())
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    if (snap.empty) return null;
    return this.toDomain(snap.docs[0].data());
  }
}
