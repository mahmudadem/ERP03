"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
// Force Firestore Emulator usage for local seeding
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'erp-03';
const admin = __importStar(require("firebase-admin"));
// Initialize Firebase Admin for standalone execution
if (!admin.apps.length) {
    admin.initializeApp({
        projectId: process.env.GCLOUD_PROJECT,
    });
}
console.log(`🔧 Using Firestore Emulator at ${process.env.FIRESTORE_EMULATOR_HOST}`);
console.log(`🔧 Project ID: ${process.env.GCLOUD_PROJECT}`);
const demoCompanySeeder_1 = require("./demoCompanySeeder");
const seedSystemVoucherTypes_1 = require("./seedSystemVoucherTypes");
const bindRepositories_1 = require("../infrastructure/di/bindRepositories");
async function run() {
    try {
        console.log('═══════════════════════════════════════════════════════');
        console.log('        DEMO COMPANY SEEDER - ERP Enhanced');
        console.log('═══════════════════════════════════════════════════════\n');
        // Seed System Templates first
        await (0, seedSystemVoucherTypes_1.seedSystemVoucherTypes)(bindRepositories_1.diContainer.voucherTypeDefinitionRepository);
        const result = await (0, demoCompanySeeder_1.seedDemoCompany)({
            companyRepository: bindRepositories_1.diContainer.companyRepository,
            companyRoleRepository: bindRepositories_1.diContainer.companyRoleRepository,
            companyUserRepository: bindRepositories_1.diContainer.rbacCompanyUserRepository,
            userRepository: bindRepositories_1.diContainer.userRepository,
            voucherTypeDefinitionRepository: bindRepositories_1.diContainer.voucherTypeDefinitionRepository
        });
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
    }
    catch (error) {
        console.error('\n❌ SEEDER FAILED:');
        console.error('═══════════════════════════════════════════════════════');
        console.error('Error details:');
        if (error instanceof Error) {
            console.error('Message:', error.message);
            console.error('Stack:', error.stack);
        }
        else {
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
//# sourceMappingURL=runDemoSeeder.js.map