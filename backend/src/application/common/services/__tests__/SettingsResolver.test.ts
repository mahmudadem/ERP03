import { SettingsResolver } from '../SettingsResolver';

describe('SettingsResolver', () => {
  let mockDb: any;
  let resolver: SettingsResolver;
  const companyId = 'test-company-123';

  beforeEach(() => {
    mockDb = {
      collection: jest.fn().mockReturnThis(),
      doc: jest.fn().mockReturnThis(),
    };
    resolver = new SettingsResolver(mockDb);
  });

  describe('Global Tier (Company Identity)', () => {
    test('getCompanySettingsRef should point to companies/{id}/Settings/company', () => {
      resolver.getCompanySettingsRef(companyId);
      expect(mockDb.collection).toHaveBeenCalledWith('companies');
      expect(mockDb.doc).toHaveBeenCalledWith(companyId);
      expect(mockDb.collection).toHaveBeenCalledWith('Settings');
      expect(mockDb.doc).toHaveBeenCalledWith('company');
    });
  });

  describe('Shared Tier (Inter-Module)', () => {
    test('getCurrenciesCollection should point to companies/{id}/Settings/shared/currencies', () => {
      resolver.getCurrenciesCollection(companyId);
      expect(mockDb.collection).toHaveBeenCalledWith('companies');
      expect(mockDb.doc).toHaveBeenCalledWith(companyId);
      expect(mockDb.collection).toHaveBeenCalledWith('Settings');
      expect(mockDb.doc).toHaveBeenCalledWith('shared');
      expect(mockDb.collection).toHaveBeenCalledWith('currencies');
    });

    test('getSharedCollectionRef should point to custom shared collection', () => {
      resolver.getSharedCollectionRef(companyId, 'tax_categories');
      expect(mockDb.collection).toHaveBeenCalledWith('tax_categories');
    });
  });

  describe('Module-Specific Tier', () => {
    test('getModuleSettingsRef should point to companies/{id}/{moduleId}/Settings', () => {
      resolver.getModuleSettingsRef(companyId, 'accounting');
      expect(mockDb.collection).toHaveBeenCalledWith('companies');
      expect(mockDb.doc).toHaveBeenCalledWith(companyId);
      expect(mockDb.collection).toHaveBeenCalledWith('accounting');
      expect(mockDb.doc).toHaveBeenCalledWith('Settings');
    });

    test('getModuleSubCollectionRef should point to subcollection within module', () => {
      resolver.getModuleSubCollectionRef(companyId, 'accounting', 'voucher_types');
      expect(mockDb.collection).toHaveBeenCalledWith('companies');
      expect(mockDb.doc).toHaveBeenCalledWith(companyId);
      expect(mockDb.collection).toHaveBeenCalledWith('accounting');
      expect(mockDb.doc).toHaveBeenCalledWith('Settings');
      expect(mockDb.collection).toHaveBeenCalledWith('voucher_types');
    });
  });
});
