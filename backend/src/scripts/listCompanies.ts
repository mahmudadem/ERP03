import * as admin from 'firebase-admin';

if (admin.apps.length === 0) {
    admin.initializeApp({
        projectId: 'erp-03',
    });
}

// Connect to emulators
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

async function listCompanies() {
    console.log('Listing companies...');
    const db = admin.firestore();
    const snapshot = await db.collection('companies').get();
    
    if (snapshot.empty) {
        console.log('No companies found.');
        return;
    }

    snapshot.forEach(doc => {
        console.log(`- ID: ${doc.id}, Name: ${doc.data().name}`);
    });
}

listCompanies().then(() => process.exit());
