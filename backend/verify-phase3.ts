/**
 * Phase 3 - Logic Verification (Unit-Style)
 * 
 * Tests the business logic without Firebase dependencies
 */

import { CompanyModuleEntity } from './src/domain/company/entities/CompanyModule';

console.log('\n🔍 Phase 3 Logic Verification (Unit Tests)\n');
console.log('='.repeat(60));

let passedTests = 0;
let failedTests = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passedTests++;
  } catch (err) {
    console.log(`❌ ${name}`);
    console.error(`   Error: ${err instanceof Error ? err.message : err}`);
    failedTests++;
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEquals(actual: any, expected: any, message?: string) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
}

// Test Suite
console.log('\n📦 Testing CompanyModule Entity Logic\n');

test('1. CompanyModuleEntity.create() should set initialized to false', () => {
  const module = CompanyModuleEntity.create('cmp123', 'accounting');
  assertEquals(module.initialized, false, 'initialized should be false');
  assertEquals(module.initializationStatus, 'pending', 'status should be pending');
});

test('2. CompanyModuleEntity should store companyId and moduleCode', () => {
  const module = CompanyModuleEntity.create('cmp456', 'inventory');
  assertEquals(module.companyId, 'cmp456');
  assertEquals(module.moduleCode, 'inventory');
});

test('3. CompanyModuleEntity should have empty config by default', () => {
  const module = CompanyModuleEntity.create('cmp789', 'hr');
  assert(typeof module.config === 'object', 'config should be an object');
  assertEquals(Object.keys(module.config).length, 0, 'config should be empty');
});

test('4. markInitialized() should set initialized to true', () => {
  const module = CompanyModuleEntity.create('cmp001', 'accounting');
  module.markInitialized({ coaTemplate: 'standard' });
  
  assertEquals(module.initialized, true);
  assertEquals(module.initializationStatus, 'complete');
  assertEquals(module.config.coaTemplate, 'standard');
});

test('5. markInitialized() should merge config', () => {
  const module = new CompanyModuleEntity(
    'cmp002',
    'accounting',
    new Date(),
    false,
    'pending',
    { existingKey: 'value' }
  );
  
  module.markInitialized({ newKey: 'newValue' });
  
  assertEquals(module.config.existingKey, 'value', 'should keep existing config');
  assertEquals(module.config.newKey, 'newValue', 'should add new config');
});

test('6. startInitialization() should set status to in_progress', () => {
  const module = CompanyModuleEntity.create('cmp003', 'inventory');
  module.startInitialization();
  
  assertEquals(module.initializationStatus, 'in_progress');
  assertEquals(module.initialized, false, 'should still be false');
});

test('7. Mandatory companyAdmin module should be createable', () => {
  const module = CompanyModuleEntity.create('cmp004', 'companyAdmin');
  assertEquals(module.moduleCode, 'companyAdmin');
  assertEquals(module.initialized, false);
});

test('8. installedAt should be set to current time', () => {
  const before = new Date();
  const module = CompanyModuleEntity.create('cmp005', 'pos');
  const after = new Date();
  
  assert(module.installedAt >= before, 'installedAt should be >= start time');
  assert(module.installedAt <= after, 'installedAt should be <= end time');
});

test('9. markInitialized() should update updatedAt timestamp', () => {
  const module = CompanyModuleEntity.create('cmp006', 'crm');
  const beforeUpdate = new Date();
  
  // Small delay to ensure timestamp difference
  setTimeout(() => {}, 10);
  
  module.markInitialized();
  
  assert(module.updatedAt !== undefined, 'updatedAt should be set');
  assert(module.updatedAt! >= beforeUpdate, 'updatedAt should be after initialization');
});

test('10. Multiple modules can be created for same company', () => {
  const accounting = CompanyModuleEntity.create('cmp007', 'accounting');
  const inventory = CompanyModuleEntity.create('cmp007', 'inventory');
  const hr = CompanyModuleEntity.create('cmp007', 'hr');
  
  assertEquals(accounting.companyId, 'cmp007');
  assertEquals(inventory.companyId, 'cmp007');
  assertEquals(hr.companyId, 'cmp007');
  
  assert(accounting.moduleCode !== inventory.moduleCode);
  assert(accounting.moduleCode !== hr.moduleCode);
  assert(inventory.moduleCode !== hr.moduleCode);
});

// Summary
console.log('\n' + '='.repeat(60));
console.log(`\n📊 Test Results:`);
console.log(`   ✅ Passed: ${passedTests}`);
console.log(`   ❌ Failed: ${failedTests}`);
console.log(`   Total:  ${passedTests + failedTests}`);

if (failedTests === 0) {
  console.log('\n🎉 All tests passed! Phase 3 logic verified.\n');
  process.exit(0);
} else {
  console.log(`\n⚠️  ${failedTests} test(s) failed.\n`);
  process.exit(1);
}
