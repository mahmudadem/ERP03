// 1. Set environment variables BEFORE any imports
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.GCLOUD_PROJECT = 'erp-03';

// 2. Now import dependencies
import { diContainer } from '../infrastructure/di/bindRepositories';
import { seedSystemVoucherTypes } from './seedSystemVoucherTypes';
import { seedSystemMetadata } from './seedSystemMetadata';
import { seedOnboardingData } from './seedOnboardingData';

async function runSystemSeeder() {
    console.log('Running System Seeder...');
    try {
        // Step 1: Voucher Types
        console.log('--- Step 1: Seeding Voucher Types ---');
        await seedSystemVoucherTypes(diContainer.voucherTypeDefinitionRepository);
        console.log('✅ Voucher Types Step Finished.\n');
        
        // Step 2: Metadata
        console.log('--- Step 2: Seeding Metadata (Currencies, COA) ---');
        await seedSystemMetadata(diContainer.systemMetadataRepository);
        console.log('✅ Metadata Step Finished.\n');

        // Step 3: Onboarding Data
        console.log('--- Step 3: Seeding Onboarding Data (Plans, Bundles, Permissions) ---');
        await seedOnboardingData();
        console.log('✅ Onboarding Data Step Finished.\n');
        
        console.log('🚀 ALL SYSTEM SEEDING COMPLETE.');
    } catch (error: any) {
        console.error('\n❌ CRITICAL SEEDER ERROR:');
        console.error(error.message);
        if (error.stack) console.error(error.stack);
    }
}

runSystemSeeder().then(() => process.exit());
