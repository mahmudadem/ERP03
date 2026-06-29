import * as admin from 'firebase-admin';
import { FirestoreUserRepository } from './infrastructure/firestore/repositories/core/FirestoreUserRepository';

process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';

if (!admin.apps.length) {
    admin.initializeApp({ projectId: 'erp-03' });
    admin.firestore().settings({ ignoreUndefinedProperties: true });
}

async function check() {
    const db = admin.firestore();
    const repo = new FirestoreUserRepository(db);
    
    const email = 'sa@test.com';
    const authUser = await admin.auth().getUserByEmail(email).catch(e => {
        console.error("Auth error:", e);
        return null;
    });
    
    console.log("Auth user found:", authUser?.uid);
    if (authUser) {
        const userDoc = await repo.getUserById(authUser.uid);
        console.log("Firestore User by ID:", userDoc);
        if (userDoc) {
            console.log("Is Admin?", userDoc.isAdmin());
        }
        
        // Let's also check the raw doc
        const rawDoc = await db.collection('users').doc(authUser.uid).get();
        console.log("Raw doc exists?", rawDoc.exists);
        console.log("Raw doc data:", rawDoc.data());
    }
}

check().then(() => process.exit(0)).catch(e => console.error(e));
