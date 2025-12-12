/**
 * Migration Script - Backfill CompanyModules
 * 
 * Creates companyModules records for existing companies
 * that were created before Phase 3
 */

import * as admin from 'firebase-admin';
import { FirestoreCompanyModuleRepository } from './src/infrastructure/firestore/repositories/company/FirestoreCompanyModuleRepository';
import { CompanyModuleEntity } from './src/domain/company/entities/CompanyModule';

// Initialize Firebase Admin
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT || './serviceAccount.json';

try {
  admin.initializeApp({
    credential: admin.credential.cert(require(serviceAccountPath)),
  });
  console.log('✅ Firebase Admin initialized');
} catch (err) {
  console.log('⚠️  Firebase Admin already initialized or using default credentials');
}

async function backfillCompanyModules() {
  console.log('\n🔄 Backfilling CompanyModules for Existing Companies\n');
  console.log('='.repeat(60));

  const db = admin.firestore();
  const repo = new FirestoreCompanyModuleRepository();

  try {
    // Step 1: Get all companies
    console.log('\n📊 Step 1: Fetching all companies...');
    const companiesSnapshot = await db.collection('companies').get();
    console.log(`✅ Found ${companiesSnapshot.size} companies`);

    let processedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // Step 2: Process each company
    for (const companyDoc of companiesSnapshot.docs) {
      const companyId = companyDoc.id;
      const companyData = companyDoc.data();
      const companyName = companyData.name || companyId;
      const installedModules = companyData.modules || [];

      console.log(`\n📦 Processing: ${companyName} (${companyId})`);
      console.log(`   Modules: ${installedModules.join(', ') || 'None'}`);

      // Check if companyModules already exist
      const existingModules = await repo.listByCompany(companyId);
      if (existingModules.length > 0) {
        console.log(`   ⏭️  Skipped (already has ${existingModules.length} module records)`);
        skippedCount++;
        continue;
      }

      // Ensure companyAdmin is included
      const modulesToInstall = Array.from(new Set([...installedModules, 'companyAdmin']));

      if (modulesToInstall.length === 0) {
        console.log('   ⚠️  No modules to install, skipping');
        skippedCount++;
        continue;
      }

      try {
        // Create module records
        const moduleRecords = modulesToInstall.map((moduleCode) =>
          CompanyModuleEntity.create(companyId, moduleCode)
        );

        await repo.batchCreate(moduleRecords);

        console.log(`   ✅ Created ${moduleRecords.length} module records`);
        processedCount++;
      } catch (error) {
        console.error(`   ❌ Error creating modules: ${error}`);
        errorCount++;
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Migration Summary:');
    console.log(`   ✅ Processed:  ${processedCount} companies`);
    console.log(`   ⏭️  Skipped:    ${skippedCount} companies`);
    console.log(`   ❌ Errors:     ${errorCount} companies`);
    console.log(`   Total:      ${companiesSnapshot.size} companies`);

    if (errorCount === 0) {
      console.log('\n🎉 Migration completed successfully!\n');
      process.exit(0);
    } else {
      console.log(`\n⚠️  Migration completed with ${errorCount} errors.\n`);
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Fatal error during migration:', error);
    process.exit(1);
  }
}

// Run migration
backfillCompanyModules().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
