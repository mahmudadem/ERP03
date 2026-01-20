process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.GCLOUD_PROJECT = 'erp-03';

import admin from './firebaseAdmin';
import { FirestoreAccountRepository } from './infrastructure/firestore/repositories/accounting/FirestoreAccountRepository';
import { FirestoreCompanyRepository } from './infrastructure/firestore/repositories/core/FirestoreCompanyRepository';
import { UpdateAccountUseCase } from './application/accounting/use-cases/accounts/UpdateAccountUseCase';
import { CreateAccountUseCase } from './application/accounting/use-cases/accounts/CreateAccountUseCase';

/**
 * Account Governance Regression Test
 * 
 * Verifies that the backend enforces:
 * 1. Root Level Currency Lock (Base only)
 * 2. Root Level Policy Lock (No OPEN policy)
 * 3. Waterfall Consistency (Child must match foreign parent)
 */

async function runTest() {
  console.log('🚀 Starting Account Governance Backend Test...\n');

  const db = admin.firestore();
  const accountRepo = new FirestoreAccountRepository(db);
  const companyRepo = new FirestoreCompanyRepository(db);
  
  const updateUseCase = new UpdateAccountUseCase(accountRepo, companyRepo);
  const createUseCase = new CreateAccountUseCase(accountRepo, companyRepo);

  const companyId = 'cmp_mjjb0kl9_9pken1'; 
  const userId = 'system-tester';

  // Find any Root account (Level 0)
  const allAccounts = await accountRepo.list(companyId);
  const rootAccount = allAccounts.find(a => !a.parentId);
  
  if (!rootAccount) {
    console.error('❌ Could not find any Root account. Please ensure seeder has run.');
    process.exit(1);
  }

  console.log(`Targeting Root Account: ${rootAccount.name} (${rootAccount.id})\n`);

  // --- SCENARIO 1: Attempt to update Root to Foreign Currency ---
  console.log('Test 1: Updating Root Account to Foreign Currency (EUR)...');
  try {
    await updateUseCase.execute(companyId, rootAccount.id, {
      updatedBy: userId,
      currencyPolicy: 'FIXED',
      fixedCurrencyCode: 'EUR'
    });
    console.error('❌ FAIL: Backend accepted foreign currency at Root level!');
  } catch (err: any) {
    console.log(`✅ PASS: Backend rejected with: "${err.message}"`);
  }

  // --- SCENARIO 2: Attempt to update Root to OPEN policy ---
  console.log('\nTest 2: Updating Root Account to OPEN Policy...');
  try {
    await updateUseCase.execute(companyId, rootAccount.id, {
      updatedBy: userId,
      currencyPolicy: 'OPEN'
    });
    console.error('❌ FAIL: Backend accepted OPEN policy at Root level!');
  } catch (err: any) {
    console.log(`✅ PASS: Backend rejected with: "${err.message}"`);
  }

  // --- SCENARIO 3: Waterfall Rule Violation ---
  // Create a foreign parent first
  console.log('\nTest 3: Waterfall Rule (Child USD under Parent EUR)...');
  try {
    // 1. Create a Child of Assets set to EUR (This is allowed)
    const foreignParent = await createUseCase.execute(companyId, {
      userCode: 'TEST-EUR-PARENT',
      name: 'EUR Branch Office',
      classification: rootAccount.classification,
      parentId: rootAccount.id,
      currencyPolicy: 'FIXED',
      fixedCurrencyCode: 'EUR',
      createdBy: userId
    });

    // 2. Attempt to create a child under this parent set to USD (Mismatch)
    try {
      await createUseCase.execute(companyId, {
        userCode: 'TEST-USD-CHILD',
        name: 'Invalid USD Child',
        classification: rootAccount.classification,
        parentId: foreignParent.id,
        currencyPolicy: 'FIXED',
        fixedCurrencyCode: 'USD',
        createdBy: userId
      });
      console.error('❌ FAIL: Backend accepted USD child under EUR parent!');
    } catch (err: any) {
      console.log(`✅ PASS: Backend rejected with: "${err.message}"`);
    }

    // Cleanup
    await accountRepo.delete(companyId, foreignParent.id);
  } catch (err: any) {
    console.error(`❌ Setup Error: ${err.message}`);
  }

  console.log('\n✨ Governance Test Complete.');
  process.exit(0);
}

runTest().catch(err => {
  console.error(err);
  process.exit(1);
});
