import * as admin from 'firebase-admin';
import { SettingsResolver } from '../../../src/application/common/services/SettingsResolver';
import { ModuleActivationService } from '../../../src/application/system/services/ModuleActivationService';
import { FirestoreCompanyModuleRepository } from '../../../src/infrastructure/firestore/repositories/company/FirestoreCompanyModuleRepository';
import { FirestoreCurrencyRepository } from '../../../src/infrastructure/firestore/repositories/company-wizard/FirestoreCurrencyRepository';

// Connect to Emulator
if (!admin.apps.length) {
  process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
  admin.initializeApp({ projectId: 'erp03-next' });
}

describe('3-Tier Settings Architecture - Integration', () => {
  const db = admin.firestore();
  const resolver = new SettingsResolver(db);
  const moduleRepo = new FirestoreCompanyModuleRepository(db);
  const activationService = new ModuleActivationService(moduleRepo);
  const currencyRepo = new FirestoreCurrencyRepository(resolver);
  
  const companyId = `integration_test_${Date.now()}`;
  const userId = 'test-admin';

  test('Module Activation Flow: HR should trigger implicit Accounting', async () => {
    // 1. Activate HR
    await activationService.activateModule(companyId, 'hr', userId);

    // 2. Verify HR record
    const hr = await moduleRepo.get(companyId, 'hr');
    expect(hr).not.toBeNull();
    expect(hr!.config?.isImplicit).toBe(false);

    // 3. Verify Accounting record (Implicit)
    const acc = await moduleRepo.get(companyId, 'accounting');
    expect(acc).not.toBeNull();
    expect(acc!.config?.isImplicit).toBe(true);
    expect(acc!.initializationStatus).toBe('complete');
  });

  test('Shared Settings Tier: Currencies should be tenant-scoped', async () => {
    const mockCurrencies = [
      { code: 'EUR', name: 'Euro', symbol: '€' }
    ];

    // 1. Seed currencies
    await currencyRepo.seedCurrencies(companyId, mockCurrencies);

    // 2. Verify path via direct DB check
    const doc = await db.doc(`companies/${companyId}/Settings/shared/currencies/EUR`).get();
    expect(doc.exists).toBe(true);
    expect(doc.data()?.name).toBe('Euro');

    // 3. Verify Isolation
    const otherCompany = 'OTHER_ISO_TEST';
    const list = await currencyRepo.listCurrencies(otherCompany);
    expect(list.find(c => c.id === 'EUR')).toBeUndefined();
  });

  test('Promotion Flow: Activating a module explicitly after it was implicit', async () => {
    // accounting is currently implicit from HR test
    await activationService.activateModule(companyId, 'accounting', userId);

    const acc = await moduleRepo.get(companyId, 'accounting');
    expect(acc!.config?.isImplicit).toBe(false); // promoted!
  });
});
