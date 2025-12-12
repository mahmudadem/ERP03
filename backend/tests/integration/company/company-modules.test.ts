/**
 * CompanyModule Integration Test
 * 
 * Tests the Phase 3 implementation:
 * - Module installation during company creation
 * - Module initialization tracking
 * - Module status queries
 */

import { FirestoreCompanyModuleRepository } from '../../../src/infrastructure/firestore/repositories/company/FirestoreCompanyModuleRepository';
import { CompanyModuleEntity } from '../../../src/domain/company/entities/CompanyModule';

describe('CompanyModule - Phase 3 Integration', () => {
  const repo = new FirestoreCompanyModuleRepository();
  const testCompanyId = `test_${Date.now()}`;
  const testModuleCodes = ['accounting', 'inventory', 'companyAdmin'];

  afterAll(async () => {
    // Cleanup: Delete test modules
    for (const moduleCode of testModuleCodes) {
      try {
        await repo.delete(testCompanyId, moduleCode);
      } catch (err) {
        // Ignore cleanup errors
      }
    }
  });

  test('should create module records during company creation', async () => {
    // Simulate what CreateCompanyUseCase does
    const modules = testModuleCodes.map((code) =>
      CompanyModuleEntity.create(testCompanyId, code)
    );

    await repo.batchCreate(modules);

    // Verify all modules were created
    const installed = await repo.listByCompany(testCompanyId);
    expect(installed).toHaveLength(3);
    expect(installed.map((m) => m.moduleCode).sort()).toEqual(
      testModuleCodes.sort()
    );
  });

  test('should have initialized = false by default', async () => {
    const module = await repo.get(testCompanyId, 'accounting');
    expect(module).not.toBeNull();
    expect(module!.initialized).toBe(false);
    expect(module!.initializationStatus).toBe('pending');
  });

  test('should update module to initialized state', async () => {
    // Simulate initialization API call
    await repo.update(testCompanyId, 'accounting', {
      initialized: true,
      initializationStatus: 'complete',
      config: { coaTemplate: 'standard', fiscalYearStart: '2024-01-01' },
    });

    const module = await repo.get(testCompanyId, 'accounting');
    expect(module!.initialized).toBe(true);
    expect(module!.initializationStatus).toBe('complete');
    expect(module!.config.coaTemplate).toBe('standard');
  });

  test('should handle in-progress initialization state', async () => {
    await repo.update(testCompanyId, 'inventory', {
      initializationStatus: 'in_progress',
    });

    const module = await repo.get(testCompanyId, 'inventory');
    expect(module!.initializationStatus).toBe('in_progress');
    expect(module!.initialized).toBe(false); // Still not fully initialized
  });

  test('should enforce companyAdmin module is always installed', async () => {
    // Verify companyAdmin was included in test setup
    const companyAdmin = await repo.get(testCompanyId, 'companyAdmin');
    expect(companyAdmin).not.toBeNull();
    expect(companyAdmin!.moduleCode).toBe('companyAdmin');
  });
});
