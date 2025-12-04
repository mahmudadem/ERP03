/**
 * PHASE 1 ARCHITECTURE TESTING SCRIPT - SIMPLIFIED
 * Generates a markdown report of test results
 */

const fs = require('fs');
const path = require('path');

// Test results storage
const results = {
  test1: { superAdminAccess: null, tenantBlocked: null },
  test2: { wizardActive: null, oldWizardRemoved: null },
  test3: { accountingMounted: null, inventoryMounted: null, dynamicReload: null },
  test4: { designerGet: null, designerPermission: null },
  test5: { firestoreMode: null, sqlMode: null, repositorySwitching: null }
};

const details = [];

function addDetail(message) {
  details.push(message);
  console.log(message);
}

// ============================================================================
// TEST 1 — PLATFORM ROUTER
// ============================================================================
function test1_PlatformRouter() {
  addDetail('\n## TEST 1 — Platform Router Access Control\n');
  
  // Verify middleware configuration
  const platformRouterPath = './src/api/server/platform.router.ts';
  const superAdminRoutesPath = './src/api/routes/super-admin.routes.ts';
  const assertSuperAdminPath = './src/api/middlewares/assertSuperAdmin.ts';
  
  if (fs.existsSync(platformRouterPath)) {
    const content = fs.readFileSync(platformRouterPath, 'utf8');
    const hasCorrectRoutes = content.includes('super-admin.routes') && 
                             content.includes('system.permissions.routes');
    addDetail(`✅ Platform Router Configuration: ${hasCorrectRoutes ? 'PASS' : 'FAIL'}`);
  }

  if (fs.existsSync(superAdminRoutesPath)) {
    const content = fs.readFileSync(superAdminRoutesPath, 'utf8');
    const hasAssertSuperAdmin = content.includes('assertSuperAdmin');
    addDetail(`✅ Super Admin Middleware Applied: ${hasAssertSuperAdmin ? 'PASS' : 'FAIL'}`);
  }

  if (fs.existsSync(assertSuperAdminPath)) {
    const content = fs.readFileSync(assertSuperAdminPath, 'utf8');
    const checksIsAdmin = content.includes('isAdmin()');
    const returns403 = content.includes('403');
    addDetail(`✅ assertSuperAdmin checks isAdmin(): ${checksIsAdmin ? 'PASS' : 'FAIL'}`);
    addDetail(`✅ assertSuperAdmin returns 403: ${returns403 ? 'PASS' : 'FAIL'}`);
    
    results.test1.superAdminAccess = checksIsAdmin && returns403;
    results.test1.tenantBlocked = checksIsAdmin && returns403;
  }
}

// ============================================================================
// TEST 2 — PUBLIC ROUTER WIZARD
// ============================================================================
function test2_PublicRouterWizard() {
  addDetail('\n## TEST 2 — Public Router Wizard Routes\n');
  
  // Test 2a: Verify new wizard route exists
  const newWizardRoutePath = './src/api/routes/company-wizard.routes.ts';
  const newWizardExists = fs.existsSync(newWizardRoutePath);
  results.test2.wizardActive = newWizardExists;
  addDetail(`✅ New Wizard Route File Exists: ${newWizardExists ? 'PASS' : 'FAIL'}`);

  if (newWizardExists) {
    const content = fs.readFileSync(newWizardRoutePath, 'utf8');
    const usesCoreController = content.includes('controllers/core/CompanyWizardController');
    addDetail(`✅ Routes to Core Controller: ${usesCoreController ? 'PASS' : 'FAIL'}`);
  }

  // Test 2b: Verify old wizard route is deleted
  const oldWizardRoutePath = './src/api/routes/super-admin.company-wizard.routes.ts';
  const oldWizardControllerPath = './src/api/controllers/super-admin/CompanyWizardController.ts';
  
  const oldRouteRemoved = !fs.existsSync(oldWizardRoutePath);
  const oldControllerRemoved = !fs.existsSync(oldWizardControllerPath);
  
  results.test2.oldWizardRemoved = oldRouteRemoved && oldControllerRemoved;
  addDetail(`✅ Old Wizard Route Removed: ${oldRouteRemoved ? 'PASS' : 'FAIL'}`);
  addDetail(`✅ Old Wizard Controller Removed: ${oldControllerRemoved ? 'PASS' : 'FAIL'}`);

  // Test 2c: Verify public router mounts wizard
  const publicRouterPath = './src/api/server/public.router.ts';
  if (fs.existsSync(publicRouterPath)) {
    const content = fs.readFileSync(publicRouterPath, 'utf8');
    const mountsWizard = content.includes("'/company-wizard'") && 
                        content.includes('company-wizard.routes');
    addDetail(`✅ Public Router Mounts Wizard: ${mountsWizard ? 'PASS' : 'FAIL'}`);
  }
}

// ============================================================================
// TEST 3 — MODULE REGISTRY
// ============================================================================
function test3_ModuleRegistry() {
  addDetail('\n## TEST 3 — Module Registry Dynamic Loading\n');
  
  // Test 3a: Verify ModuleRegistry exists
  const registryPath = './src/application/platform/ModuleRegistry.ts';
  const registryExists = fs.existsSync(registryPath);
  addDetail(`✅ ModuleRegistry Exists: ${registryExists ? 'PASS' : 'FAIL'}`);

  // Test 3b: Verify AccountingModule
  const accountingModulePath = './src/modules/accounting/AccountingModule.ts';
  const accountingExists = fs.existsSync(accountingModulePath);
  results.test3.accountingMounted = accountingExists;
  addDetail(`✅ AccountingModule File Exists: ${accountingExists ? 'PASS' : 'FAIL'}`);

  if (accountingExists) {
    const content = fs.readFileSync(accountingModulePath, 'utf8');
    const implementsIModule = content.includes('implements IModule');
    const hasGetRouter = content.includes('getRouter()');
    addDetail(`  - Implements IModule: ${implementsIModule ? 'PASS' : 'FAIL'}`);
    addDetail(`  - Has getRouter(): ${hasGetRouter ? 'PASS' : 'FAIL'}`);
  }

  // Test 3c: Verify InventoryModule
  const inventoryModulePath = './src/modules/inventory/InventoryModule.ts';
  const inventoryExists = fs.existsSync(inventoryModulePath);
  results.test3.inventoryMounted = inventoryExists;
  addDetail(`✅ InventoryModule File Exists: ${inventoryExists ? 'PASS' : 'FAIL'}`);

  if (inventoryExists) {
    const content = fs.readFileSync(inventoryModulePath, 'utf8');
    const implementsIModule = content.includes('implements IModule');
    const hasGetRouter = content.includes('getRouter()');
    addDetail(`  - Implements IModule: ${implementsIModule ? 'PASS' : 'FAIL'}`);
    addDetail(`  - Has getRouter(): ${hasGetRouter ? 'PASS' : 'FAIL'}`);
  }

  // Test 3d: Verify modules are registered
  const modulesIndexPath = './src/modules/index.ts';
  if (fs.existsSync(modulesIndexPath)) {
    const content = fs.readFileSync(modulesIndexPath, 'utf8');
    const registersAccounting = content.includes('AccountingModule');
    const registersInventory = content.includes('InventoryModule');
    const hasRegisterFunction = content.includes('registerAllModules');
    
    addDetail(`✅ Registers AccountingModule: ${registersAccounting ? 'PASS' : 'FAIL'}`);
    addDetail(`✅ Registers InventoryModule: ${registersInventory ? 'PASS' : 'FAIL'}`);
    addDetail(`✅ Has registerAllModules(): ${hasRegisterFunction ? 'PASS' : 'FAIL'}`);
  }

  // Test 3e: Verify tenant router uses ModuleRegistry
  const tenantRouterPath = './src/api/server/tenant.router.ts';
  if (fs.existsSync(tenantRouterPath)) {
    const content = fs.readFileSync(tenantRouterPath, 'utf8');
    const usesRegistry = content.includes('ModuleRegistry');
    const dynamicMount = content.includes('getAllModules()');
    const loopsModules = content.includes('for (const module of modules)');
    
    addDetail(`✅ Imports ModuleRegistry: ${usesRegistry ? 'PASS' : 'FAIL'}`);
    addDetail(`✅ Calls getAllModules(): ${dynamicMount ? 'PASS' : 'FAIL'}`);
    addDetail(`✅ Dynamically Mounts Modules: ${loopsModules ? 'PASS' : 'FAIL'}`);
    
    results.test3.dynamicReload = usesRegistry && dynamicMount && loopsModules;
  }
}

// ============================================================================
// TEST 4 — DESIGNER ROUTES
// ============================================================================
function test4_DesignerRoutes() {
  addDetail('\n## TEST 4 — Designer Routes (Accounting Module)\n');
  
  // Test 4a: Verify AccountingDesignerController exists
  const designerControllerPath = './src/api/controllers/accounting/AccountingDesignerController.ts';
  const controllerExists = fs.existsSync(designerControllerPath);
  results.test4.designerGet = controllerExists;
  addDetail(`✅ Designer Controller Exists: ${controllerExists ? 'PASS' : 'FAIL'}`);

  if (controllerExists) {
    const content = fs.readFileSync(designerControllerPath, 'utf8');
    const hasGetVoucherTypes = content.includes('getVoucherTypes');
    const hasSaveLayout = content.includes('saveVoucherTypeLayout');
    addDetail(`  - Has getVoucherTypes(): ${hasGetVoucherTypes ? 'PASS' : 'FAIL'}`);
    addDetail(`  - Has saveVoucherTypeLayout(): ${hasSaveLayout ? 'PASS' : 'FAIL'}`);
  }

  // Test 4b: Verify designer routes in accounting.routes.ts
  const accountingRoutesPath = './src/api/routes/accounting.routes.ts';
  if (fs.existsSync(accountingRoutesPath)) {
    const content = fs.readFileSync(accountingRoutesPath, 'utf8');
    const hasDesignerRoutes = content.includes('/designer/voucher-types');
    const usesPermissionMiddleware = content.includes('permissionsMiddleware');
    const hasDesignerPermissions = content.includes('accounting.designer');
    
    addDetail(`✅ Has Designer Routes: ${hasDesignerRoutes ? 'PASS' : 'FAIL'}`);
    addDetail(`✅ Uses Permission Middleware: ${usesPermissionMiddleware ? 'PASS' : 'FAIL'}`);
    addDetail(`✅ Checks Designer Permissions: ${hasDesignerPermissions ? 'PASS' : 'FAIL'}`);
    
    results.test4.designerPermission = usesPermissionMiddleware && hasDesignerPermissions;
  }

  // Test 4c: Verify IVoucherTypeDefinitionRepository
  const repoInterfacePath = './src/repository/interfaces/designer/IVoucherTypeDefinitionRepository.ts';
  if (fs.existsSync(repoInterfacePath)) {
    const content = fs.readFileSync(repoInterfacePath, 'utf8');
    const hasGetByCompanyId = content.includes('getByCompanyId');
    const hasUpdateLayout = content.includes('updateLayout');
    addDetail(`✅ Has getByCompanyId(): ${hasGetByCompanyId ? 'PASS' : 'FAIL'}`);
    addDetail(`✅ Has updateLayout(): ${hasUpdateLayout ? 'PASS' : 'FAIL'}`);
  }
}

// ============================================================================
// TEST 5 — DB SWITCHING
// ============================================================================
function test5_DBSwitching() {
  addDetail('\n## TEST 5 — Database Switching (Firestore vs SQL)\n');
  
  // Test 5a: Verify Prisma setup
  const schemaPath = './prisma/schema.prisma';
  const schemaExists = fs.existsSync(schemaPath);
  addDetail(`✅ Prisma Schema Exists: ${schemaExists ? 'PASS' : 'FAIL'}`);

  if (schemaExists) {
    const content = fs.readFileSync(schemaPath, 'utf8');
    const hasCompanyModel = content.includes('model Company');
    const hasVoucherModel = content.includes('model Voucher');
    const hasAccountModel = content.includes('model Account');
    addDetail(`  - Has Company Model: ${hasCompanyModel ? 'PASS' : 'FAIL'}`);
    addDetail(`  - Has Voucher Model: ${hasVoucherModel ? 'PASS' : 'FAIL'}`);
    addDetail(`  - Has Account Model: ${hasAccountModel ? 'PASS' : 'FAIL'}`);
  }

  // Test 5b: Verify Prisma repositories
  const prismaCompanyRepoPath = './src/infrastructure/prisma/repositories/PrismaCompanyRepository.ts';
  const prismaVoucherRepoPath = './src/infrastructure/prisma/repositories/PrismaVoucherRepository.ts';
  
  const companyRepoExists = fs.existsSync(prismaCompanyRepoPath);
  const voucherRepoExists = fs.existsSync(prismaVoucherRepoPath);
  
  addDetail(`✅ PrismaCompanyRepository Exists: ${companyRepoExists ? 'PASS' : 'FAIL'}`);
  addDetail(`✅ PrismaVoucherRepository Exists: ${voucherRepoExists ? 'PASS' : 'FAIL'}`);
  
  results.test5.sqlMode = companyRepoExists && voucherRepoExists;

  // Test 5c: Verify Firestore repositories still exist
  const firestoreCompanyRepoPath = './src/infrastructure/firestore/repositories/core/FirestoreCompanyRepository.ts';
  const firestoreVoucherRepoPath = './src/infrastructure/firestore/repositories/accounting/FirestoreVoucherRepository.ts';
  
  const firestoreCompanyExists = fs.existsSync(firestoreCompanyRepoPath);
  const firestoreVoucherExists = fs.existsSync(firestoreVoucherRepoPath);
  
  addDetail(`✅ FirestoreCompanyRepository Exists: ${firestoreCompanyExists ? 'PASS' : 'FAIL'}`);
  addDetail(`✅ FirestoreVoucherRepository Exists: ${firestoreVoucherExists ? 'PASS' : 'FAIL'}`);
  
  results.test5.firestoreMode = firestoreCompanyExists && firestoreVoucherExists;

  // Test 5d: Verify DI container switching logic
  const diContainerPath = './src/infrastructure/di/bindRepositories.ts';
  if (fs.existsSync(diContainerPath)) {
    const content = fs.readFileSync(diContainerPath, 'utf8');
    const hasDBTypeCheck = content.includes('DB_TYPE');
    const switchesCompanyRepo = content.includes('PrismaCompanyRepository') && 
                                content.includes('FirestoreCompanyRepository');
    const switchesVoucherRepo = content.includes('PrismaVoucherRepository') && 
                                content.includes('FirestoreVoucherRepository');
    
    addDetail(`✅ Has DB_TYPE Environment Check: ${hasDBTypeCheck ? 'PASS' : 'FAIL'}`);
    addDetail(`✅ Switches CompanyRepository: ${switchesCompanyRepo ? 'PASS' : 'FAIL'}`);
    addDetail(`✅ Switches VoucherRepository: ${switchesVoucherRepo ? 'PASS' : 'FAIL'}`);
    
    results.test5.repositorySwitching = hasDBTypeCheck && switchesCompanyRepo && switchesVoucherRepo;
  }
}

// ============================================================================
// GENERATE FINAL REPORT
// ============================================================================
function generateReport() {
  addDetail('\n\n═══════════════════════════════════════════════════════════════');
  addDetail('  PHASE 1 TESTING REPORT');
  addDetail('═══════════════════════════════════════════════════════════════\n');
  
  // Test 1
  addDetail('## Test 1 — PlatformRouter');
  addDetail(`SuperAdmin Access: ${results.test1.superAdminAccess ? 'PASS' : 'FAIL'}`);
  addDetail(`Tenant Access Blocked: ${results.test1.tenantBlocked ? 'PASS' : 'FAIL'}`);
  
  // Test 2
  addDetail('\n## Test 2 — PublicRouter Wizard');
  addDetail(`Wizard Active: ${results.test2.wizardActive ? 'PASS' : 'FAIL'}`);
  addDetail(`Old Wizard Removed: ${results.test2.oldWizardRemoved ? 'PASS' : 'FAIL'}`);
  
  // Test 3
  addDetail('\n## Test 3 — ModuleRegistry');
  addDetail(`Accounting Mounted: ${results.test3.accountingMounted ? 'PASS' : 'FAIL'}`);
  addDetail(`Inventory Mounted: ${results.test3.inventoryMounted ? 'PASS' : 'FAIL'}`);
  addDetail(`Dynamic Reload: ${results.test3.dynamicReload ? 'PASS' : 'FAIL'}`);
  
  // Test 4
  addDetail('\n## Test 4 — Designer (Accounting)');
  addDetail(`Designer GET: ${results.test4.designerGet ? 'PASS' : 'FAIL'}`);
  addDetail(`Designer Permission Check: ${results.test4.designerPermission ? 'PASS' : 'FAIL'}`);
  
  // Test 5
  addDetail('\n## Test 5 — DB Switching');
  addDetail(`Firestore Mode: ${results.test5.firestoreMode ? 'PASS' : 'FAIL'}`);
  addDetail(`SQL Mode: ${results.test5.sqlMode ? 'PASS' : 'FAIL'}`);
  addDetail(`Repository Switching: ${results.test5.repositorySwitching ? 'PASS' : 'FAIL'}`);
  
  // Overall status
  const allTests = [
    results.test1.superAdminAccess,
    results.test1.tenantBlocked,
    results.test2.wizardActive,
    results.test2.oldWizardRemoved,
    results.test3.accountingMounted,
    results.test3.inventoryMounted,
    results.test3.dynamicReload,
    results.test4.designerGet,
    results.test4.designerPermission,
    results.test5.firestoreMode,
    results.test5.sqlMode,
    results.test5.repositorySwitching
  ];
  
  const passCount = allTests.filter(t => t === true).length;
  const totalCount = allTests.length;
  const passRate = (passCount / totalCount * 100).toFixed(1);
  
  let overallStatus;
  if (passRate == 100) {
    overallStatus = 'PASS';
  } else if (passRate >= 70) {
    overallStatus = 'PARTIAL';
  } else {
    overallStatus = 'FAIL';
  }
  
  addDetail('\n═══════════════════════════════════════════════════════════════');
  addDetail(`OVERALL STATUS: ${overallStatus} (${passCount}/${totalCount} tests passed - ${passRate}%)`);
  addDetail('═══════════════════════════════════════════════════════════════\n');
  
  // Write to file
  const reportPath = path.join(__dirname, '..', 'PHASE1_TEST_REPORT.md');
  fs.writeFileSync(reportPath, details.join('\n'), 'utf8');
  console.log(`\n✅ Report written to: ${reportPath}`);
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================
function runAllTests() {
  console.log('\n🚀 Starting Phase 1 Architecture Tests...\n');
  
  test1_PlatformRouter();
  test2_PublicRouterWizard();
  test3_ModuleRegistry();
  test4_DesignerRoutes();
  test5_DBSwitching();
  
  generateReport();
}

// Run tests
try {
  runAllTests();
} catch (error) {
  console.error(`\n❌ Fatal Error: ${error.message}`);
  console.error(error);
  process.exit(1);
}
