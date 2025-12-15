// Quick test to see the actual error
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.GCLOUD_PROJECT = 'erp-03';

import * as admin from 'firebase-admin';

if (!admin.apps.length) {
    admin.initializeApp({ projectId: 'erp-03' });
}

import { diContainer } from '../infrastructure/di/bindRepositories';

async function test() {
    try {
        console.log('Testing module repository...');
        console.log('Repository exists?', !!diContainer.companyModuleRepository);
        
        const testModule = {
            companyId: 'test_company',
            moduleCode: 'accounting',
            initialized: false,
            initializationStatus: 'pending' as const,
            config: {},
            installedAt: new Date()
        };
        
        console.log('Test module:', testModule);
        console.log('Attempting create...');
        
        await diContainer.companyModuleRepository.create(testModule);
        
        console.log('✅ Create successful!');
    } catch (error) {
        console.error('❌ Error:', error);
        if (error instanceof Error) {
            console.error('Message:', error.message);
            console.error('Stack:', error.stack);
        }
    }
}

test().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
});
