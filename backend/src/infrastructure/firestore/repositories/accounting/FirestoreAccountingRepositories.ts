import { ICostCenterRepository, IExchangeRateRepository } from '../../../../repository/interfaces/accounting';
import { CostCenter } from '../../../../domain/accounting/entities/CostCenter';
import { ExchangeRate } from '../../../../domain/accounting/entities/ExchangeRate';
import * as admin from 'firebase-admin';
import { Firestore, Timestamp } from 'firebase-admin/firestore';
import { SettingsResolver } from '../../../../application/common/services/SettingsResolver';

// Simple Inline Mappers for brevity in this consolidated file or import from AccountingMappers
class CostCenterMapper {
    static toDomain(id: string, d: any) { 
      return new CostCenter(id, d.companyId, d.name, d.code, d.parentId); 
    }
    static toPersistence(e: CostCenter) { 
      return { 
        companyId: e.companyId,
        name: e.name,
        code: e.code,
        parentId: e.parentId || null
      }; 
    }
}
class ExchangeRateMapper {
    static toDomain(id: string, d: any) { 
      return new ExchangeRate({
        id: id,
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

export class FirestoreCostCenterRepository implements ICostCenterRepository {
  private readonly collectionName = 'cost_centers';

  constructor(private readonly settingsResolver: SettingsResolver) {}

  private getCollection(companyId: string) {
    return this.settingsResolver.getCostCentersCollection(companyId);
  }

  async createCostCenter(costCenter: CostCenter): Promise<void> { 
    const col = this.getCollection(costCenter.companyId);
    await col.doc(costCenter.id).set(CostCenterMapper.toPersistence(costCenter));
  }

  async updateCostCenter(id: string, data: Partial<CostCenter>): Promise<void> {
    if (!data.companyId) throw new Error("companyId required for updateCostCenter");
    const col = this.getCollection(data.companyId);
    await col.doc(id).update(data);
  }

  async getCostCenter(companyId: string, id: string): Promise<CostCenter | null> { 
    const doc = await this.getCollection(companyId).doc(id).get();
    if (!doc.exists) return null;
    return CostCenterMapper.toDomain(doc.id, doc.data());
  }

  async getCompanyCostCenters(companyId: string): Promise<CostCenter[]> {
      const snap = await this.getCollection(companyId).get();
      return snap.docs.map(d => CostCenterMapper.toDomain(d.id, d.data()));
  }
}

export class FirestoreExchangeRateRepository implements IExchangeRateRepository {
  private readonly collectionName = 'exchange_rates';

  constructor(private readonly settingsResolver: SettingsResolver) {}

  private getCollection(companyId: string) {
    return this.settingsResolver.getExchangeRatesCollection(companyId);
  }

  async save(rate: ExchangeRate): Promise<void> { 
    const col = this.getCollection(rate.companyId);
    await col.doc(rate.id).set(ExchangeRateMapper.toPersistence(rate));
  }

  /** @deprecated Use save() instead */
  async setRate(rate: ExchangeRate): Promise<void> { 
    return this.save(rate); 
  }

  /** @deprecated Use getLatestRate() instead */
  async getRate(from: string, to: string, date: Date): Promise<ExchangeRate | null> {
    // This deprecated method lacks companyId. In a multi-tenant system, this is a bug.
    // Transitioning to scoped lookup.
    throw new Error("getRate() without companyId is deprecated and unsupported. Use getLatestRate().");
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

    const snap = await this.getCollection(companyId)
      .where('fromCurrency', '==', fromCurrency.toUpperCase())
      .where('toCurrency', '==', toCurrency.toUpperCase())
      .where('date', '>=', Timestamp.fromDate(dateStart))
      .where('date', '<=', Timestamp.fromDate(dateEnd))
      .orderBy('date', 'desc')
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    if (snap.empty) return null;
    return ExchangeRateMapper.toDomain(snap.docs[0].id, snap.docs[0].data());
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

    const snap = await this.getCollection(companyId)
      .where('fromCurrency', '==', fromCurrency.toUpperCase())
      .where('toCurrency', '==', toCurrency.toUpperCase())
      .where('date', '>=', Timestamp.fromDate(dateStart))
      .where('date', '<=', Timestamp.fromDate(dateEnd))
      .orderBy('date', 'desc')
      .orderBy('createdAt', 'desc')
      .get();

    return snap.docs.map(d => ExchangeRateMapper.toDomain(d.id, d.data()));
  }

  async getRecentRates(
    companyId: string,
    fromCurrency?: string,
    toCurrency?: string,
    limit: number = 10
  ): Promise<ExchangeRate[]> {
    let query: admin.firestore.Query = this.getCollection(companyId);
    
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

    return snap.docs.map(d => ExchangeRateMapper.toDomain(d.id, d.data()));
  }

  async getMostRecentRate(
    companyId: string,
    fromCurrency: string,
    toCurrency: string
  ): Promise<ExchangeRate | null> {
    const snap = await this.getCollection(companyId)
      .where('fromCurrency', '==', fromCurrency.toUpperCase())
      .where('toCurrency', '==', toCurrency.toUpperCase())
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    if (snap.empty) return null;
    return ExchangeRateMapper.toDomain(snap.docs[0].id, snap.docs[0].data());
  }
}
