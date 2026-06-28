import * as admin from 'firebase-admin';
import { FirestoreUserRepository } from '../infrastructure/firestore/repositories/core/FirestoreUserRepository';

// Force emulator environment
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';

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
    console.log('Promoting sa@test.com to SUPER_ADMIN...');
    const authUser = await admin.auth().getUserByEmail('sa@test.com').catch(() => null);
    
    if (!authUser) {
        console.error('User sa@test.com not found in Firebase Auth!');
        process.exit(1);
    }

    const userId = authUser.uid;
    const repo = new FirestoreUserRepository(db);
    const user = await repo.findByEmail('sa@test.com');
    
    if (!user) {
        console.log('User not found in Firestore. Creating...');
        await db.collection('users').doc(userId).set({
            id: userId,
            email: 'sa@test.com',
            name: 'Super Admin',
            globalRole: 'SUPER_ADMIN',
            createdAt: new Date()
        });
    } else {
        await db.collection('users').doc(user.id).update({
            globalRole: 'SUPER_ADMIN'
        });
    }

    console.log(`User sa@test.com (${userId}) is now SUPER_ADMIN.`);
}

promote().then(() => process.exit(0)).catch(e => {
    console.error(e);
    process.exit(1);
});
