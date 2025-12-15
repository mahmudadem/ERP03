// Force Firestore Emulator usage for local seeding
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'erp-03';

import * as admin from 'firebase-admin';

// Initialize Firebase Admin for standalone execution
if (!admin.apps.length) {
    admin.initializeApp({
        projectId: process.env.GCLOUD_PROJECT,
    });
}

console.log(`🔧 Using Firestore Emulator at ${process.env.FIRESTORE_EMULATOR_HOST}`);
console.log(`🔧 Project ID: ${process.env.GCLOUD_PROJECT}`);

import { seedDemoCompany } from './demoCompanySeeder';
import { seedSystemVoucherTypes } from './seedSystemVoucherTypes';
import { diContainer } from '../infrastructure/di/bindRepositories';

async function run() {
    try {
        console.log('═══════════════════════════════════════════════════════');
        console.log('        DEMO COMPANY SEEDER - ERP Enhanced');
        console.log('═══════════════════════════════════════════════════════\n');

        // await seedSystemVoucherTypes(diContainer.voucherTypeDefinitionRepository);

        console.log('Calling seedDemoCompany...');
        let result;
        try {
            result = await seedDemoCompany({
                companyRepository: diContainer.companyRepository,
                companyRoleRepository: diContainer.companyRoleRepository,
                companyUserRepository: diContainer.rbacCompanyUserRepository,
                userRepository: diContainer.userRepository,
                voucherTypeDefinitionRepository: diContainer.voucherTypeDefinitionRepository,
                companyModuleRepository: diContainer.companyModuleRepository
            });
            console.log('seedDemoCompany completed successfully');
        } catch (err) {
            console.error('\n\n❌❌❌ ERROR IN SEED DEMO COMPANY ❌❌❌');
            console.error('Error:', err);
            if (err instanceof Error) {
                console.error('Message:', err.message);
                console.error('Stack:', err.stack);
            }
            throw err;
        }

        console.log('═══════════════════════════════════════════════════════');
        console.log('                   SEEDING COMPLETE');
        console.log('═══════════════════════════════════════════════════════\n');
        console.log('📊 SUMMARY:');
        console.log('─────────────────────────────────────────────────────────');
        console.log(`Company ID:       ${result.companyId}`);
        console.log(`Company Name:     ${result.companyName}`);
        console.log(`Bundle Applied:   ${result.bundleApplied}`);
        console.log('');
        console.log(`Roles Created:    ${result.rolesCreated.length}`);
        result.rolesCreated.forEach(role => {
            console.log(`  • ${role.name} (${role.id})`);
        });
        console.log('');
        console.log(`Users Created:    ${result.usersCreated.length}`);
        result.usersCreated.forEach(user => {
            console.log(`  • ${user.email} - ${user.role}`);
        });
        console.log('');
        console.log(`Active Modules:   ${result.activeModules.length}`);
        result.activeModules.forEach(module => {
            console.log(`  • ${module}`);
        });
        console.log('');
        console.log(`Active Features:  ${result.activeFeatures.length}`);
        result.activeFeatures.forEach(feature => {
            console.log(`  • ${feature}`);
        });
        console.log('');
        console.log('═══════════════════════════════════════════════════════');
        console.log('✅ You can now test the Company Admin endpoints!');
        console.log('═══════════════════════════════════════════════════════\n');

        console.log('📝 MANUAL VERIFICATION CHECKLIST:');
        console.log('─────────────────────────────────────────────────────────');
        console.log('1. GET /company-admin/roles');
        console.log('   Expected: 3 roles (Admin, Finance Manager, Inventory Manager)');
        console.log('');
        console.log('2. GET /company-admin/features/active');
        console.log(`   Expected: ${result.activeFeatures.join(', ')}`);
        console.log('');
        console.log('3. GET /company-admin/modules/active');
        console.log(`   Expected: ${result.activeModules.join(', ')}`);
        console.log('');
        console.log('4. POST /company-admin/features/toggle');
        console.log('   Body: { "featureName": "apiAccess", "enabled": true }');
        console.log('   Expected: Feature added to active list');
        console.log('');
        console.log('5. POST /company-admin/bundle/upgrade');
        console.log('   Body: { "bundleId": "professional" }');
        console.log('   Expected: Modules and features updated');
        console.log('═══════════════════════════════════════════════════════\n');

    } catch (error) {
        console.error('\n❌ SEEDER FAILED:');
        console.error('═══════════════════════════════════════════════════════');
        console.error('Error details:');
        if (error instanceof Error) {
            console.error('Message:', error.message);
            console.error('Stack:', error.stack);
        } else {
            console.error(error);
        }
        console.error('═══════════════════════════════════════════════════════\n');
        process.exit(1);
    }
}

// Execute seeder
run().then(() => {
    console.log('Seeder completed successfully. Exiting...\n');
    process.exit(0);
});
