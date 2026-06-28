/**
 * SettingsResolverSQL.test.ts — focused unit tests for [275b]
 *
 * Acceptance criteria verified here:
 *  1. No method returns null for a valid companyId.
 *  2. Returned descriptors carry the expected _type, table, and companyId.
 *  3. Behavioral intent mirrors the Firestore SettingsResolver (correct SQL table names).
 */

import { SettingsResolverSQL, SqlCollectionDescriptor, SqlDocumentDescriptor } from '../SettingsResolverSQL';

const COMPANY_ID = 'test-company-abc';

describe('SettingsResolverSQL', () => {
  let resolver: SettingsResolverSQL;

  beforeEach(() => {
    resolver = new SettingsResolverSQL();
  });

  // ─── helpers ────────────────────────────────────────────────────────────────

  function assertNonNull(value: unknown, methodName: string) {
    expect(value).not.toBeNull();
    expect(value).not.toBeUndefined();
    // Must be an object descriptor, not a primitive
    expect(typeof value).toBe('object');
  }

  function asDoc(value: unknown): SqlDocumentDescriptor {
    return value as SqlDocumentDescriptor;
  }

  function asCol(value: unknown): SqlCollectionDescriptor {
    return value as SqlCollectionDescriptor;
  }

  // ─── no method returns null ──────────────────────────────────────────────────

  describe('no method returns null for valid inputs', () => {
    it('getCompanySettingsRef', () => assertNonNull(resolver.getCompanySettingsRef(COMPANY_ID), 'getCompanySettingsRef'));
    it('getSharedModuleRef', () => assertNonNull(resolver.getSharedModuleRef(COMPANY_ID), 'getSharedModuleRef'));
    it('getSharedSettingsRef', () => assertNonNull(resolver.getSharedSettingsRef(COMPANY_ID), 'getSharedSettingsRef'));
    it('getSharedDataRef', () => assertNonNull(resolver.getSharedDataRef(COMPANY_ID), 'getSharedDataRef'));
    it('getSharedSettingsCollection', () => assertNonNull(resolver.getSharedSettingsCollection(COMPANY_ID, 'currencies'), 'getSharedSettingsCollection'));
    it('getSharedDataCollection', () => assertNonNull(resolver.getSharedDataCollection(COMPANY_ID, 'exchange_rates'), 'getSharedDataCollection'));
    it('getModuleSettingsRef', () => assertNonNull(resolver.getModuleSettingsRef(COMPANY_ID, 'accounting'), 'getModuleSettingsRef'));
    it('getModuleSubCollectionRef', () => assertNonNull(resolver.getModuleSubCollectionRef(COMPANY_ID, 'accounting', 'taxCategories'), 'getModuleSubCollectionRef'));
    it('getModuleDataRef', () => assertNonNull(resolver.getModuleDataRef(COMPANY_ID, 'accounting'), 'getModuleDataRef'));
    it('getModuleDataCollection', () => assertNonNull(resolver.getModuleDataCollection(COMPANY_ID, 'accounting', 'vouchers'), 'getModuleDataCollection'));
    it('getCurrenciesCollection', () => assertNonNull(resolver.getCurrenciesCollection(COMPANY_ID), 'getCurrenciesCollection'));
    it('getExchangeRatesCollection', () => assertNonNull(resolver.getExchangeRatesCollection(COMPANY_ID), 'getExchangeRatesCollection'));
    it('getVouchersCollection', () => assertNonNull(resolver.getVouchersCollection(COMPANY_ID), 'getVouchersCollection'));
    it('getAccountingSettingsRef', () => assertNonNull(resolver.getAccountingSettingsRef(COMPANY_ID), 'getAccountingSettingsRef'));
    it('getTaxCategoriesCollection', () => assertNonNull(resolver.getTaxCategoriesCollection(COMPANY_ID), 'getTaxCategoriesCollection'));
    it('getCostCentersCollection', () => assertNonNull(resolver.getCostCentersCollection(COMPANY_ID), 'getCostCentersCollection'));
  });

  // ─── descriptor types ───────────────────────────────────────────────────────

  describe('descriptor _type field', () => {
    it('document-like methods return SqlDocument descriptors', () => {
      expect(resolver.getCompanySettingsRef(COMPANY_ID)._type).toBe('SqlDocument');
      expect(resolver.getSharedSettingsRef(COMPANY_ID)._type).toBe('SqlDocument');
      expect(resolver.getSharedDataRef(COMPANY_ID)._type).toBe('SqlDocument');
      expect(resolver.getModuleSettingsRef(COMPANY_ID, 'accounting')._type).toBe('SqlDocument');
      expect(resolver.getModuleDataRef(COMPANY_ID, 'accounting')._type).toBe('SqlDocument');
      expect(resolver.getAccountingSettingsRef(COMPANY_ID)._type).toBe('SqlDocument');
    });

    it('collection-like methods return SqlCollection descriptors', () => {
      expect(resolver.getSharedModuleRef(COMPANY_ID)._type).toBe('SqlCollection');
      expect(resolver.getSharedSettingsCollection(COMPANY_ID, 'currencies')._type).toBe('SqlCollection');
      expect(resolver.getSharedDataCollection(COMPANY_ID, 'exchange_rates')._type).toBe('SqlCollection');
      expect(resolver.getModuleSubCollectionRef(COMPANY_ID, 'accounting', 'taxCategories')._type).toBe('SqlCollection');
      expect(resolver.getModuleDataCollection(COMPANY_ID, 'accounting', 'vouchers')._type).toBe('SqlCollection');
      expect(resolver.getCurrenciesCollection(COMPANY_ID)._type).toBe('SqlCollection');
      expect(resolver.getExchangeRatesCollection(COMPANY_ID)._type).toBe('SqlCollection');
      expect(resolver.getVouchersCollection(COMPANY_ID)._type).toBe('SqlCollection');
      expect(resolver.getTaxCategoriesCollection(COMPANY_ID)._type).toBe('SqlCollection');
      expect(resolver.getCostCentersCollection(COMPANY_ID)._type).toBe('SqlCollection');
    });
  });

  // ─── companyId propagation ───────────────────────────────────────────────────

  describe('companyId is always propagated', () => {
    const methods: Array<[string, () => SqlDocumentDescriptor | SqlCollectionDescriptor]> = [
      ['getCompanySettingsRef', () => resolver.getCompanySettingsRef(COMPANY_ID)],
      ['getSharedModuleRef', () => resolver.getSharedModuleRef(COMPANY_ID)],
      ['getSharedSettingsRef', () => resolver.getSharedSettingsRef(COMPANY_ID)],
      ['getSharedDataRef', () => resolver.getSharedDataRef(COMPANY_ID)],
      ['getSharedSettingsCollection', () => resolver.getSharedSettingsCollection(COMPANY_ID, 'currencies')],
      ['getSharedDataCollection', () => resolver.getSharedDataCollection(COMPANY_ID, 'exchange_rates')],
      ['getModuleSettingsRef', () => resolver.getModuleSettingsRef(COMPANY_ID, 'accounting')],
      ['getModuleSubCollectionRef', () => resolver.getModuleSubCollectionRef(COMPANY_ID, 'accounting', 'taxCategories')],
      ['getModuleDataRef', () => resolver.getModuleDataRef(COMPANY_ID, 'accounting')],
      ['getModuleDataCollection', () => resolver.getModuleDataCollection(COMPANY_ID, 'accounting', 'vouchers')],
      ['getCurrenciesCollection', () => resolver.getCurrenciesCollection(COMPANY_ID)],
      ['getExchangeRatesCollection', () => resolver.getExchangeRatesCollection(COMPANY_ID)],
      ['getVouchersCollection', () => resolver.getVouchersCollection(COMPANY_ID)],
      ['getAccountingSettingsRef', () => resolver.getAccountingSettingsRef(COMPANY_ID)],
      ['getTaxCategoriesCollection', () => resolver.getTaxCategoriesCollection(COMPANY_ID)],
      ['getCostCentersCollection', () => resolver.getCostCentersCollection(COMPANY_ID)],
    ];

    methods.forEach(([name, fn]) => {
      it(`${name} carries the correct companyId`, () => {
        expect(fn().companyId).toBe(COMPANY_ID);
      });
    });
  });

  // ─── SQL table mapping (behavioural intent mirrors Firestore resolver) ────────

  describe('SQL table names match the Firestore resolver intent', () => {
    it('getCompanySettingsRef → companySettings', () => {
      expect(asDoc(resolver.getCompanySettingsRef(COMPANY_ID)).table).toBe('companySettings');
    });

    it('getCurrenciesCollection → companyCurrency (mirrors shared/Settings/currencies)', () => {
      // Firestore: companies/{id}/shared/Settings/currencies
      expect(asCol(resolver.getCurrenciesCollection(COMPANY_ID)).table).toBe('companyCurrency');
    });

    it('getExchangeRatesCollection → exchangeRate (mirrors accounting/Data/exchange_rates)', () => {
      // Firestore: companies/{id}/accounting/Data/exchange_rates
      expect(asCol(resolver.getExchangeRatesCollection(COMPANY_ID)).table).toBe('exchangeRate');
    });

    it('getVouchersCollection → voucher (mirrors accounting/Data/vouchers)', () => {
      // Firestore: companies/{id}/accounting/Data/vouchers
      expect(asCol(resolver.getVouchersCollection(COMPANY_ID)).table).toBe('voucher');
    });

    it('getAccountingSettingsRef → companyModuleSettings with moduleId=accounting', () => {
      // Firestore: companies/{id}/accounting/Settings
      const desc = asDoc(resolver.getAccountingSettingsRef(COMPANY_ID));
      expect(desc.table).toBe('companyModuleSettings');
      expect(desc.scope?.moduleId).toBe('accounting');
    });

    it('getCostCentersCollection → costCenter (mirrors accounting/Settings/cost_centers)', () => {
      // Firestore: companies/{id}/accounting/Settings/cost_centers
      expect(asCol(resolver.getCostCentersCollection(COMPANY_ID)).table).toBe('costCenter');
    });

    it('getTaxCategoriesCollection → taxCode (mirrors accounting/Settings/taxCategories)', () => {
      // Firestore: companies/{id}/accounting/Settings/taxCategories
      expect(asCol(resolver.getTaxCategoriesCollection(COMPANY_ID)).table).toBe('taxCode');
    });

    it('getModuleSettingsRef carries the moduleId in scope', () => {
      const desc = asDoc(resolver.getModuleSettingsRef(COMPANY_ID, 'inventory'));
      expect(desc.table).toBe('companyModuleSettings');
      expect(desc.scope?.moduleId).toBe('inventory');
    });

    it('getSharedSettingsRef scopes to shared module', () => {
      const desc = asDoc(resolver.getSharedSettingsRef(COMPANY_ID));
      expect(desc.table).toBe('companyModuleSettings');
      expect(desc.scope?.moduleId).toBe('shared');
    });
  });

  // ─── determinism ────────────────────────────────────────────────────────────

  describe('determinism — same inputs produce equal descriptors', () => {
    it('getCurrenciesCollection is deterministic', () => {
      const a = resolver.getCurrenciesCollection(COMPANY_ID);
      const b = resolver.getCurrenciesCollection(COMPANY_ID);
      expect(a).toEqual(b);
    });

    it('getModuleSettingsRef is deterministic for the same moduleId', () => {
      const a = resolver.getModuleSettingsRef(COMPANY_ID, 'sales');
      const b = resolver.getModuleSettingsRef(COMPANY_ID, 'sales');
      expect(a).toEqual(b);
    });

    it('different companyIds produce different descriptors', () => {
      const a = resolver.getCurrenciesCollection('company-A');
      const b = resolver.getCurrenciesCollection('company-B');
      expect(a).not.toEqual(b);
    });
  });
});
