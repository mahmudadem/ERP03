// import { admin } from '../firebaseAdmin';
import { diContainer } from '../infrastructure/di/bindRepositories';
import { seedSystemVoucherTypes } from './seedSystemVoucherTypes';

// Connect to emulators
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

async function runSystemSeeder() {
    console.log('Running System Seeder...');
    try {
        await seedSystemVoucherTypes(diContainer.voucherTypeDefinitionRepository);
        console.log('System Seeder Complete.');
    } catch (error) {
        console.error('Error:', error);
    }
}

runSystemSeeder().then(() => process.exit());
