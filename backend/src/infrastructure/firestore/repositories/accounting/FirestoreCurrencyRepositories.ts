/**
 * Firestore implementation for Accounting Currency Repositories
 * 
 * Reads from system_metadata/currencies/items collection (global data).
 * Manages CompanyCurrency for enable/disable per company.
 */

import * as admin from 'firebase-admin';
import { Firestore, Timestamp, DocumentSnapshot, FieldValue } from 'firebase-admin/firestore';
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
  private readonly globalCollectionPath = 'system_metadata/currencies/items';

  constructor(private settingsResolver: SettingsResolver) {}
  
  private getCollection(companyId?: string) {
    if (companyId) {
      return this.settingsResolver.getCurrenciesCollection(companyId);
    }
    return this.settingsResolver.db.collection(this.globalCollectionPath);
  }
  
  private toDomain(data: any): Currency {
    return new Currency({
      code: data.code,
      name: data.name,
      symbol: data.symbol,
      decimalPlaces: data.decimalPlaces ?? 2,
      isActive: data.isActive ?? true,
    });
  }

  async findAll(companyId?: string): Promise<Currency[]> {
    const snapshot = await this.getCollection(companyId).get();
    return snapshot.docs.map(doc => this.toDomain(doc.data()));
  }

  async findActive(companyId?: string): Promise<Currency[]> {
    const snapshot = await this.getCollection(companyId).orderBy('code').get();
    return snapshot.docs
      .map(doc => this.toDomain(doc.data()))
      .filter(c => c.isActive);
  }

  async findByCode(code: string, companyId?: string): Promise<Currency | null> {
    const doc = await this.getCollection(companyId).doc(code.toUpperCase()).get();
    if (!doc.exists) return null;
    return this.toDomain(doc.data());
  }

  async save(currency: Currency): Promise<void> {
    // Always save to global if no companyId (though saving is rare via this repo)
    await this.settingsResolver.db.collection(this.globalCollectionPath)
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
    const batch = this.settingsResolver.db.batch();
    for (const currency of currencies) {
      const ref = this.settingsResolver.db.collection(this.globalCollectionPath).doc(currency.code);
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

import { SettingsResolver } from '../../../../application/common/services/SettingsResolver';

/**
 * Firestore implementation of ICompanyCurrencyRepository.
 * Manages enabled currencies per company (no rate fields).
 */
export class FirestoreCompanyCurrencyRepository implements ICompanyCurrencyRepository {
  constructor(private settingsResolver: SettingsResolver) {}

  private getCollection(companyId: string) {
    return this.settingsResolver.getCurrenciesCollection(companyId);
  }

  private toRecord(doc: DocumentSnapshot): CompanyCurrencyRecord {
    const data = doc.data()!;
    const code = data.currencyCode || data.code || doc.id;
    return {
      id: doc.id,
      companyId: data.companyId,
      currencyCode: code,
      isEnabled: data.isEnabled ?? true,
      isBase: data.isBase ?? false,
      enabledAt: data.enabledAt instanceof Timestamp ? data.enabledAt.toDate() : new Date(),
      disabledAt: data.disabledAt instanceof Timestamp ? data.disabledAt.toDate() : null,
    };
  }

  async findEnabledByCompany(companyId: string): Promise<CompanyCurrencyRecord[]> {
    const coll = this.getCollection(companyId);
    let snapshot = await coll.where('isEnabled', '==', true).get();
    
    if (snapshot.empty) {
      // Trigger self-healing if empty
      const base = await this.getBaseCurrency(companyId);
      if (base) {
        // Re-fetch now that it's repaired
        snapshot = await coll.where('isEnabled', '==', true).get();
      }
    }
    
    return snapshot.docs.map(doc => this.toRecord(doc));
  }

  async findAllByCompany(companyId: string): Promise<CompanyCurrencyRecord[]> {
    const coll = this.getCollection(companyId);
    let snapshot = await coll.get();
    
    // Migration Fallback (identical logic)
    if (snapshot.empty) {
      const legacyPaths = ['company_currencies', 'currencies'];
      let legacyDocs: admin.firestore.QueryDocumentSnapshot[] = [];
      
      for (const path of legacyPaths) {
        const legacyColl = this.settingsResolver.db.collection('companies').doc(companyId).collection(path);
        const legacySnap = await legacyColl.get();
        if (!legacySnap.empty) {
          legacyDocs = legacySnap.docs;
          break;
        }
      }
      
      if (legacyDocs.length > 0) {
        return legacyDocs.map(doc => this.toRecord(doc));
      }
    }

    return snapshot.docs.map(doc => this.toRecord(doc));
  }

  async isEnabled(companyId: string, currencyCode: string): Promise<boolean> {
    const docId = currencyCode.toUpperCase();
    const doc = await this.getCollection(companyId).doc(docId).get();
    if (!doc.exists) return false;
    return doc.data()?.isEnabled ?? false;
  }

  async enable(companyId: string, currencyCode: string): Promise<CompanyCurrencyRecord> {
    const code = currencyCode.toUpperCase();
    const docId = code;
    const now = new Date();

    await this.getCollection(companyId).doc(docId).set({
      companyId,
      currencyCode: code,
      code: code, // Consistency fallback
      isEnabled: true,
      isBase: false, // Default to false when just enabling
      enabledAt: Timestamp.fromDate(now),
      disabledAt: null,
    }, { merge: true });

    return {
      id: docId,
      companyId,
      currencyCode: code,
      isEnabled: true,
      isBase: false,
      enabledAt: now,
      disabledAt: null,
    };
  }

  async setBaseCurrency(companyId: string, currencyCode: string): Promise<void> {
    const code = currencyCode.toUpperCase();
    const coll = this.getCollection(companyId);
    
    // Use a transaction or batch to ensure only one is base
    const db = this.settingsResolver.db;
    const batch = db.batch();
    
    // 1. Unset existing base
    const currentBase = await coll.where('isBase', '==', true).get();
    currentBase.docs.forEach(doc => {
      batch.update(doc.ref, { isBase: false });
    });
    
    // 2. Set new base (and enable it if not already)
    const newBaseRef = coll.doc(code);
    batch.set(newBaseRef, {
      companyId,
      currencyCode: code,
      code: code, // Consistency fallback
      isEnabled: true,
      isBase: true,
      enabledAt: FieldValue.serverTimestamp()
    }, { merge: true });
    
    await batch.commit();
  }

  async disable(companyId: string, currencyCode: string): Promise<void> {
    const docId = currencyCode.toUpperCase();
    await this.getCollection(companyId).doc(docId).update({
      isEnabled: false,
      disabledAt: Timestamp.fromDate(new Date()),
    });
  }

  async getBaseCurrency(companyId: string): Promise<string | null> {
    const coll = this.getCollection(companyId);
    const snapshot = await coll.where('isBase', '==', true).get();
    
    if (!snapshot.empty) {
      const data = snapshot.docs[0].data();
      return data.currencyCode || data.code || snapshot.docs[0].id;
    }

    // FALLBACK & REPAIR: Check company profile
    console.log(`[FirestoreCompanyCurrencyRepository] No currency marked as isBase for ${companyId}. Checking company profile...`);
    const companyDoc = await this.settingsResolver.db.collection('companies').doc(companyId).get();
    const profileBase = companyDoc.data()?.baseCurrency;

    if (profileBase) {
      console.log(`[FirestoreCompanyCurrencyRepository] Found base ${profileBase} in profile. Attempting repair...`);
      // Repair: mark this currency as base if it exists, or create it
      const currRef = coll.doc(profileBase);
      await currRef.set({
        companyId,
        currencyCode: profileBase,
        code: profileBase,
        isEnabled: true,
        isBase: true,
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
      
      return profileBase;
    }
    
    return null;
  }
}
