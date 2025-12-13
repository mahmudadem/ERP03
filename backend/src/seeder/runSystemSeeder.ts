// import { admin } from '../firebaseAdmin';
import { diContainer } from '../infrastructure/di/bindRepositories';
import { seedSystemVoucherTypes } from './seedSystemVoucherTypes';
import { seedSystemMetadata } from './seedSystemMetadata';

// Connect to emulators
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

async function runSystemSeeder() {
    console.log('Running System Seeder...');
    try {
        // Seed voucher types
        await seedSystemVoucherTypes(diContainer.voucherTypeDefinitionRepository);
        
        // Seed system metadata (currencies, COA templates)
        await seedSystemMetadata(diContainer.systemMetadataRepository);
        
        console.log('System Seeder Complete.');
    } catch (error) {
        console.error('Error:', error);
    }
}

runSystemSeeder().then(() => process.exit());
