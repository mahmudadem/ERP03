import { ICurrencyRepository } from '../../../../repository/interfaces/company-wizard/ICurrencyRepository';
import { InfrastructureError } from '../../../errors/InfrastructureError';
import { SettingsResolver } from '../../../../application/common/services/SettingsResolver';

export class FirestoreCurrencyRepository implements ICurrencyRepository {
  constructor(private settingsResolver: SettingsResolver) {}

  async listCurrencies(companyId?: string): Promise<Array<{ id: string; name: string }>> {
    try {
      let collection;
      if (companyId) {
        collection = this.settingsResolver.getCurrenciesCollection(companyId);
      } else {
        // Fallback to global system metadata if no company context (e.g. Wizard)
        collection = this.settingsResolver.db.collection('system_metadata/currencies/items');
      }

      const snapshot = await collection.get();
      
      return snapshot.docs.map((doc) => {
        const data = doc.data();
        const label = data.name || data.code || doc.id;
        return { id: data.id || doc.id, name: label };
      });
    } catch (error) {
      throw new InfrastructureError('Failed to list currencies', error);
    }
  }

  async seedCurrencies(companyId: string, currencies: any[], baseCurrency?: string): Promise<void> {
    try {
      const batch = this.settingsResolver.db.batch();
      const collection = this.settingsResolver.getCurrenciesCollection(companyId);
      
      for (const currency of currencies) {
        const docId = currency.code || currency.id;
        const docRef = collection.doc(docId);
        
        const data = {
          ...currency,
          updatedAt: new Date().toISOString()
        };

        // If this is the base currency, force enable it
        if (baseCurrency && docId === baseCurrency) {
          data.isEnabled = true;
          data.isBase = true;
          console.log(`[FirestoreCurrencyRepository] Marking base currency ${baseCurrency} as enabled and as BASE during seed`);
        } else {
          data.isBase = false;
        }

        batch.set(docRef, data, { merge: true });
      }
      
      // If baseCurrency was NOT in the provided currencies list, add it anyway
      if (baseCurrency && !currencies.some(c => (c.code || c.id) === baseCurrency)) {
        console.log(`[FirestoreCurrencyRepository] Base currency ${baseCurrency} missing from seed list. Adding manually.`);
        const docRef = collection.doc(baseCurrency);
        batch.set(docRef, {
          id: baseCurrency,
          code: baseCurrency,
          name: baseCurrency, // Fallback name
          isEnabled: true,
          isBase: true,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      }
      
      await batch.commit();
    } catch (error) {
      throw new InfrastructureError('Failed to seed currencies', error);
    }
  }
}
