/**
 * PHASE 3 LIFECYCLE TESTING SCRIPT
 * 
 * Tests:
 * 1. Wizard (Create Company)
 * 2. Company List
 * 3. Company Switching
 * 4. RBAC
 * 5. Bundles
 * 6. Feature Flags
 */

const fs = require('fs');
const path = require('path');
const Module = require('module');

// MOCK EXTERNAL DEPENDENCIES
const originalRequire = Module.prototype.require;
Module.prototype.require = function(request: string) {
  if (request === 'firebase-admin') {
    return {
      apps: [],
      initializeApp: () => {},
      firestore: () => ({ settings: () => {} })
    };
  }
  if (request === '@prisma/client') {
    return { PrismaClient: class {} };
  }
  return originalRequire.apply(this, arguments);
};

// Mock Data Stores
const db = {
  users: new Map(),
  companies: new Map(),
  companyRoles: new Map(),
  companyUsers: new Map(),
  sessions: new Map(),
  templates: new Map()
};

// Initialize Mock Data
db.users.set('U1', { id: 'U1', email: 'u1@test.com', name: 'User One' });
db.templates.set('T1', { id: 'T1', name: 'Standard Template', steps: [] });

// Mock Repositories
const mockCompanyRepo = {
  save: async (c: any) => db.companies.set(c.id, c),
  findById: async (id: string) => db.companies.get(id),
  getUserCompanies: async (uid: string) => {
    const memberships = Array.from(db.companyUsers.values()).filter((m: any) => m.userId === uid);
    return memberships.map((m: any) => db.companies.get(m.companyId)).filter(c => c);
  }
};

const mockUserRepo = {
  getUserById: async (id: string) => db.users.get(id),
  getUserActiveCompany: async (uid: string) => {
    const user = db.users.get(uid);
    return user ? user.activeCompanyId : null;
  }
};

const mockCompanyRoleRepo = {
  create: async (r: any) => db.companyRoles.set(r.id, r),
  getById: async (cid: string, rid: string) => db.companyRoles.get(rid),
  findById: async (rid: string) => db.companyRoles.get(rid)
};

const mockRbacRepo = {
  create: async (m: any) => db.companyUsers.set(m.id, m),
  getByUserAndCompany: async (uid: string, cid: string) => {
    return Array.from(db.companyUsers.values()).find((m: any) => m.userId === uid && m.companyId === cid);
  }
};

const mockSessionRepo = {
  create: async (s: any) => db.sessions.set(s.id, s),
  save: async (s: any) => db.sessions.set(s.id, s),
  getById: async (id: string) => db.sessions.get(id),
  delete: async (id: string) => db.sessions.delete(id)
};

const mockTemplateRepo = {
  getById: async (id: string) => db.templates.get(id),
  getByModel: async (m: string) => db.templates.get('T1'),
  getDefaultTemplateForModel: async (m: string) => {
    const t = db.templates.get('T1');
    addDetail(`Mock getDefaultTemplateForModel called with: ${m}, returning: ${t ? t.id : 'null'}`);
    return t;
  }
};

// LOAD AND MOCK DI CONTAINER
const { diContainer } = require('./src/infrastructure/di/bindRepositories');

// Overwrite properties
Object.defineProperty(diContainer, 'companyRepository', { get: () => mockCompanyRepo });
Object.defineProperty(diContainer, 'userRepository', { get: () => mockUserRepo });
Object.defineProperty(diContainer, 'companyRoleRepository', { get: () => mockCompanyRoleRepo });
Object.defineProperty(diContainer, 'rbacCompanyUserRepository', { get: () => mockRbacRepo });
Object.defineProperty(diContainer, 'companyCreationSessionRepository', { get: () => mockSessionRepo });
Object.defineProperty(diContainer, 'companyWizardTemplateRepository', { get: () => mockTemplateRepo });
Object.defineProperty(diContainer, 'modulePermissionsDefinitionRepository', { get: () => ({}) });

// Test Results
const results = {
  test1: { create: false, bundle: false, owner: false, linked: false },
  test2: { list: false },
  test3: { validSwitch: false, invalidSwitch: false },
  test4: { grant: false, revoke: false },
  test5: { disabledBlock: false, upgrade: false },
  test6: { featureOff: false, featureOn: false }
};

const details: string[] = [];
function addDetail(msg: string) { 
  details.push(msg); 
  console.log(msg); 
  fs.appendFileSync('PHASE3_DEBUG.log', msg + '\n');
}

// Import Controllers and Middlewares (AFTER mocking)
const { CompanyWizardController } = require('./src/api/controllers/core/CompanyWizardController');
const { CompanyController } = require('./src/api/controllers/core/CompanyController');
const { tenantContextMiddleware } = require('./src/api/middlewares/tenantContextMiddleware');
const { permissionGuard } = require('./src/api/middlewares/guards/permissionGuard');
const { companyModuleGuard } = require('./src/api/middlewares/guards/companyModuleGuard');
const { featureFlagGuard } = require('./src/api/middlewares/guards/featureFlagGuard');

// Mock Request/Response
const mockReq = (user: any, body = {}, query = {}, params = {}) => ({
  user,
  body,
  query,
  params,
  tenantContext: null as any
});

const mockRes = () => {
  const res: any = {};
  res.status = (code: number) => { res.statusCode = code; return res; };
  res.json = (data: any) => { res.body = data; return res; };
  return res;
};

const mockNext = (cb: any) => (err: any) => { if (err) cb(err); };

// ============================================================================
// TEST 1 — WIZARD (CREATE COMPANY)
// ============================================================================
async function test1_Wizard() {
  addDetail('\n## TEST 1 — Wizard (Create Company)\n');

  try {
    // 1. Start Wizard
    const reqStart = mockReq({ uid: 'U1' }, { companyName: 'Test Corp', model: 'standard' });
    const resStart = mockRes();
    await CompanyWizardController.start(reqStart, resStart, mockNext((e: any) => { throw e; }));
    
    if (!resStart.body || !resStart.body.success) throw new Error('Wizard start failed');
    const sessionId = resStart.body.data.sessionId;
    
    // 2. Complete Wizard (Simulated)
    const session = db.sessions.get(sessionId);
    session.data = { companyName: 'Test Corp', model: 'standard', bundleId: 'starter' };
    db.sessions.set(sessionId, session);

    // 3. Call Complete
    const reqComplete = mockReq({ uid: 'U1' }, { sessionId });
    const resComplete = mockRes();
    await CompanyWizardController.complete(reqComplete, resComplete, mockNext((e: any) => { throw e; }));

    if (!resComplete.body || !resComplete.body.success) throw new Error('Wizard complete failed');
    
    const companyId = resComplete.body.data.companyId;
    const company = db.companies.get(companyId);
    
    // Verify
    if (company) results.test1.create = true;
    if (company.modules.includes('accounting')) results.test1.bundle = true;
    
    const roles = Array.from(db.companyRoles.values()).filter((r: any) => r.companyId === companyId);
    const ownerRole = roles.find((r: any) => r.name === 'Owner');
    if (ownerRole) results.test1.owner = true;
    
    const membership = Array.from(db.companyUsers.values()).find((m: any) => m.userId === 'U1' && m.companyId === companyId);
    if (membership && membership.roleId === ownerRole.id) results.test1.linked = true;

    addDetail(`✅ Wizard Create: ${results.test1.create}`);
    addDetail(`✅ Bundle Correct: ${results.test1.bundle}`);
    addDetail(`✅ Owner Role: ${results.test1.owner}`);
    addDetail(`✅ User Linked: ${results.test1.linked}`);
    
    return companyId;
  } catch (e: any) {
    addDetail(`❌ Test 1 Failed: ${e.message}`);
    if (e.stack) addDetail(e.stack);
    return null;
  }
}

// ============================================================================
// TEST 2 — COMPANY LIST
// ============================================================================
async function test2_CompanyList() {
  addDetail('\n## TEST 2 — Company List\n');
  
  try {
    const req = mockReq({ uid: 'U1' });
    const res = mockRes();
    await CompanyController.getUserCompanies(req, res, mockNext((e: any) => { throw e; }));
    
    if (res.body && res.body.success && res.body.data.length > 0) {
      results.test2.list = true;
      addDetail('✅ Company List Loaded: PASS');
    } else {
      addDetail('❌ Company List Loaded: FAIL');
    }
  } catch (e: any) {
    addDetail(`❌ Test 2 Failed: ${e.message}`);
  }
}

// ============================================================================
// TEST 3 — COMPANY SWITCHING
// ============================================================================
async function test3_Switching(companyId: string) {
  addDetail('\n## TEST 3 — Company Switching\n');
  
  if (!companyId) return;

  // Valid Switch
  try {
    const req = mockReq({ uid: 'U1', companyId: companyId });
    const res = mockRes();
    let nextCalled = false;
    await tenantContextMiddleware(req, res, (err: any) => {
      if (!err) nextCalled = true;
    });
    
    if (nextCalled && req.tenantContext && req.tenantContext.companyId === companyId) {
      results.test3.validSwitch = true;
      addDetail('✅ Valid Switch: PASS');
    }
  } catch (e: any) {
    addDetail(`❌ Valid Switch Failed: ${e.message}`);
  }

  // Invalid Switch
  try {
    const req = mockReq({ uid: 'U1', companyId: 'C999' }); // Invalid ID
    const res = mockRes();
    let errorCalled = false;
    await tenantContextMiddleware(req, res, (err: any) => {
      if (err) errorCalled = true;
    });
    
    if (errorCalled) {
      results.test3.invalidSwitch = true;
      addDetail('✅ Invalid Switch Blocked: PASS');
    }
  } catch (e: any) {
    addDetail(`❌ Invalid Switch Test Failed: ${e.message}`);
  }
}

// ============================================================================
// TEST 4 — RBAC
// ============================================================================
async function test4_RBAC(companyId: string) {
  addDetail('\n## TEST 4 — RBAC\n');
  if (!companyId) return;

  // Setup Context
  const req = mockReq({ uid: 'U1', companyId });
  req.tenantContext = {
    userId: 'U1',
    companyId,
    permissions: ['accounting.voucher.view', 'accounting.voucher.create'],
    modules: [],
    features: []
  };

  // Grant
  try {
    const guard = permissionGuard('accounting.voucher.create');
    let nextCalled = false;
    guard(req, mockRes(), (err: any) => { if (!err) nextCalled = true; });
    if (nextCalled) results.test4.grant = true;
    addDetail(`✅ Grant Permission: ${results.test4.grant}`);
  } catch (e) {}

  // Revoke
  req.tenantContext.permissions = ['accounting.voucher.view']; // Remove create
  try {
    const guard = permissionGuard('accounting.voucher.create');
    let errorCalled = false;
    guard(req, mockRes(), (err: any) => { if (err) errorCalled = true; });
    if (errorCalled) results.test4.revoke = true;
    addDetail(`✅ Revoke Permission: ${results.test4.revoke}`);
  } catch (e) {}
}

// ============================================================================
// TEST 5 — BUNDLES
// ============================================================================
async function test5_Bundles(companyId: string) {
  addDetail('\n## TEST 5 — Bundles\n');
  if (!companyId) return;

  // Setup Context (Starter Bundle: accounting enabled, inventory disabled)
  const req = mockReq({ uid: 'U1', companyId });
  req.tenantContext = {
    userId: 'U1',
    companyId,
    modules: ['accounting'],
    permissions: [],
    features: []
  };

  // Disabled Block
  try {
    const guard = companyModuleGuard('inventory');
    let errorCalled = false;
    guard(req, mockRes(), (err: any) => { if (err) errorCalled = true; });
    if (errorCalled) results.test5.disabledBlock = true;
    addDetail(`✅ Disabled Module Block: ${results.test5.disabledBlock}`);
  } catch (e) {}

  // Upgrade
  req.tenantContext.modules = ['accounting', 'inventory']; // Upgrade
  try {
    const guard = companyModuleGuard('inventory');
    let nextCalled = false;
    guard(req, mockRes(), (err: any) => { if (!err) nextCalled = true; });
    if (nextCalled) results.test5.upgrade = true;
    addDetail(`✅ Upgrade Enables Module: ${results.test5.upgrade}`);
  } catch (e) {}
}

// ============================================================================
// TEST 6 — FEATURE FLAGS
// ============================================================================
async function test6_Features(companyId: string) {
  addDetail('\n## TEST 6 — Feature Flags\n');
  if (!companyId) return;

  // Setup Context (Starter: multiCurrency false)
  const req = mockReq({ uid: 'U1', companyId });
  req.tenantContext = {
    userId: 'U1',
    companyId,
    features: [], // Starter has no multiCurrency
    modules: [],
    permissions: []
  };

  // Feature Off
  try {
    const guard = featureFlagGuard('feature.multiCurrency');
    let errorCalled = false;
    guard(req, mockRes(), (err: any) => { if (err) errorCalled = true; });
    if (errorCalled) results.test6.featureOff = true;
    addDetail(`✅ Feature Off: ${results.test6.featureOff}`);
  } catch (e) {}

  // Feature On
  req.tenantContext.features = ['feature.multiCurrency']; // Professional
  try {
    const guard = featureFlagGuard('feature.multiCurrency');
    let nextCalled = false;
    guard(req, mockRes(), (err: any) => { if (!err) nextCalled = true; });
    if (nextCalled) results.test6.featureOn = true;
    addDetail(`✅ Feature On: ${results.test6.featureOn}`);
  } catch (e) {}
}

// ============================================================================
// GENERATE REPORT
// ============================================================================
function generateReport() {
  const reportPath = path.join(__dirname, '..', 'PHASE3_TEST_REPORT.md');
  
  let overallStatus = 'PASS';
  const allResults = [
    results.test1.create, results.test1.bundle, results.test1.owner, results.test1.linked,
    results.test2.list,
    results.test3.validSwitch, results.test3.invalidSwitch,
    results.test4.grant, results.test4.revoke,
    results.test5.disabledBlock, results.test5.upgrade,
    results.test6.featureOff, results.test6.featureOn
  ];
  
  const passCount = allResults.filter(r => r === true).length;
  if (passCount < allResults.length) overallStatus = 'FAIL';
  if (passCount > 0 && passCount < allResults.length) overallStatus = 'PARTIAL';
  if (passCount === 0) overallStatus = 'FAIL';

  const report = `
# PHASE 3 TESTING REPORT

## Test 1 — Wizard
Create Company: ${results.test1.create ? 'PASS' : 'FAIL'}
Bundle Correct: ${results.test1.bundle ? 'PASS' : 'FAIL'}
Owner Role: ${results.test1.owner ? 'PASS' : 'FAIL'}
User Linked: ${results.test1.linked ? 'PASS' : 'FAIL'}

## Test 2 — Company List
Company List Loaded: ${results.test2.list ? 'PASS' : 'FAIL'}

## Test 3 — Company Switching
Valid Switch: ${results.test3.validSwitch ? 'PASS' : 'FAIL'}
Invalid Switch Block: ${results.test3.invalidSwitch ? 'PASS' : 'FAIL'}

## Test 4 — RBAC in Company
Grant Permission: ${results.test4.grant ? 'PASS' : 'FAIL'}
Revoke Permission: ${results.test4.revoke ? 'PASS' : 'FAIL'}

## Test 5 — Bundles
Disabled Module Block: ${results.test5.disabledBlock ? 'PASS' : 'FAIL'}
Upgrade Enables Module: ${results.test5.upgrade ? 'PASS' : 'FAIL'}

## Test 6 — Feature Flags
Feature Off: ${results.test6.featureOff ? 'PASS' : 'FAIL'}
Feature On: ${results.test6.featureOn ? 'PASS' : 'FAIL'}

OVERALL STATUS: ${overallStatus}
`;

  fs.writeFileSync(reportPath, report.trim());
  console.log(`\nReport generated at ${reportPath}`);
}

// Run
(async () => {
  console.log('🚀 Starting Phase 3 Lifecycle Tests...\n');
  const companyId = await test1_Wizard();
  if (companyId) {
    await test2_CompanyList();
    await test3_Switching(companyId);
    await test4_RBAC(companyId);
    await test5_Bundles(companyId);
    await test6_Features(companyId);
  }
  generateReport();
})();
