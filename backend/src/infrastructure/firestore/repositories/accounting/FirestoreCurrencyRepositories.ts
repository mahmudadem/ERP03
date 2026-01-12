/**
 * Firestore implementation for Accounting Currency Repositories
 * 
 * Reads from system_metadata/currencies/items collection (global data).
 * Manages CompanyCurrency for enable/disable per company.
 */

import { Firestore, Timestamp, DocumentSnapshot } from 'firebase-admin/firestore';
import { Currency } from '../../../../domain/accounting/entities/Currency';
import { ICurrencyRepository } from '../../../../repository/interfaces/accounting/ICurrencyRepository';
import { 
  ICompanyCurrencyRepository, 
  CompanyCurrencyRecord 
} from '../../../../repository/interfaces/accounting/ICompanyCurrencyRepository';

/**
 * Firestore implementation of ICurrencyRepository for Accounting.
 * Reads global currencies from system_metadata/currencies/items collection.
 */
export class FirestoreAccountingCurrencyRepository implements ICurrencyRepository {
  // Reads from the system_metadata pattern used by seedSystemMetadata.ts
  private readonly collectionPath = 'system_metadata/currencies/items';

  constructor(private db: Firestore) {}
  
  private toDomain(data: any): Currency {
    return new Currency({
      code: data.code,
      name: data.name,
      symbol: data.symbol,
      decimalPlaces: data.decimalPlaces ?? 2,
      isActive: data.isActive ?? true,
    });
  }

  async findAll(): Promise<Currency[]> {
    const snapshot = await this.db.collection(this.collectionPath).get();
    return snapshot.docs.map(doc => this.toDomain(doc.data()));
  }

  async findActive(): Promise<Currency[]> {
    // system_metadata currencies are all active by default
    const snapshot = await this.db.collection(this.collectionPath).orderBy('code').get();
    return snapshot.docs
      .map(doc => this.toDomain(doc.data()))
      .filter(c => c.isActive);
  }

  async findByCode(code: string): Promise<Currency | null> {
    const doc = await this.db.collection(this.collectionPath).doc(code.toUpperCase()).get();
    if (!doc.exists) return null;
    return this.toDomain(doc.data());
  }

  async save(currency: Currency): Promise<void> {
    await this.db.collection(this.collectionPath)
      .doc(currency.code)
      .set({
        code: currency.code,
        name: currency.name,
        symbol: currency.symbol,
        decimalPlaces: currency.decimalPlaces,
        isActive: currency.isActive,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
  }

  async seedCurrencies(currencies: Currency[]): Promise<void> {
    const batch = this.db.batch();
    for (const currency of currencies) {
      const ref = this.db.collection(this.collectionPath).doc(currency.code);
      batch.set(ref, {
        code: currency.code,
        name: currency.name,
        symbol: currency.symbol,
        decimalPlaces: currency.decimalPlaces,
        isActive: currency.isActive,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    }
    await batch.commit();
  }
}

/**
 * Firestore implementation of ICompanyCurrencyRepository.
 * Manages enabled currencies per company (no rate fields).
 */
export class FirestoreCompanyCurrencyRepository implements ICompanyCurrencyRepository {
  private collectionName = 'company_currencies';

  constructor(private db: Firestore) {}

  private toRecord(doc: DocumentSnapshot): CompanyCurrencyRecord {
    const data = doc.data()!;
    return {
      id: doc.id,
      companyId: data.companyId,
      currencyCode: data.currencyCode,
      isEnabled: data.isEnabled ?? true,
      enabledAt: data.enabledAt?.toDate?.() || new Date(),
      disabledAt: data.disabledAt?.toDate?.() || null,
    };
  }

  async findEnabledByCompany(companyId: string): Promise<CompanyCurrencyRecord[]> {
    const snapshot = await this.db.collection(this.collectionName)
      .where('companyId', '==', companyId)
      .where('isEnabled', '==', true)
      .get();
    return snapshot.docs.map(doc => this.toRecord(doc));
  }

  async findAllByCompany(companyId: string): Promise<CompanyCurrencyRecord[]> {
    const snapshot = await this.db.collection(this.collectionName)
      .where('companyId', '==', companyId)
      .get();
    return snapshot.docs.map(doc => this.toRecord(doc));
  }

  async isEnabled(companyId: string, currencyCode: string): Promise<boolean> {
    const docId = `${companyId}_${currencyCode.toUpperCase()}`;
    const doc = await this.db.collection(this.collectionName).doc(docId).get();
    if (!doc.exists) return false;
    return doc.data()?.isEnabled ?? false;
  }

  async enable(companyId: string, currencyCode: string): Promise<CompanyCurrencyRecord> {
    const code = currencyCode.toUpperCase();
    const docId = `${companyId}_${code}`;
    const now = new Date();

    await this.db.collection(this.collectionName).doc(docId).set({
      companyId,
      currencyCode: code,
      isEnabled: true,
      enabledAt: Timestamp.fromDate(now),
      disabledAt: null,
    }, { merge: true });

    return {
      id: docId,
      companyId,
      currencyCode: code,
      isEnabled: true,
      enabledAt: now,
      disabledAt: null,
    };
  }

  async disable(companyId: string, currencyCode: string): Promise<void> {
    const docId = `${companyId}_${currencyCode.toUpperCase()}`;
    await this.db.collection(this.collectionName).doc(docId).update({
      isEnabled: false,
      disabledAt: Timestamp.fromDate(new Date()),
    });
  }
}
