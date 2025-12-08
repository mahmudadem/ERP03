import * as admin from 'firebase-admin';
import { FirestoreUserRepository } from '../infrastructure/firestore/repositories/core/FirestoreUserRepository';

// Initialize Firebase Admin if not already
if (!admin.apps.length) {
    admin.initializeApp({
        projectId: process.env.GCLOUD_PROJECT || 'erp-03',
    });
}

const db = admin.firestore();
// Force emulator settings
db.settings({ ignoreUndefinedProperties: true, host: '127.0.0.1:8080', ssl: false });

async function promote() {
    console.log('Promoting admin@demo.com to SUPER_ADMIN...');
    const repo = new FirestoreUserRepository(db);
    const user = await repo.getUserByEmail('admin@demo.com');
    
    if (!user) {
        console.error('User admin@demo.com not found!');
        process.exit(1);
    }

    // Direct update to ensure it works regardless of repo method limitations
    await db.collection('users').doc(user.id).update({
        globalRole: 'SUPER_ADMIN'
    });

    console.log(`User ${user.email} (${user.id}) is now SUPER_ADMIN.`);
}

promote().then(() => process.exit(0)).catch(e => {
    console.error(e);
    process.exit(1);
});
