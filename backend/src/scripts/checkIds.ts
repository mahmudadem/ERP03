import * as admin from 'firebase-admin';

process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';

if (!admin.apps.length) {
    admin.initializeApp({ projectId: 'erp-03' });
}

const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true, host: '127.0.0.1:8080', ssl: false });

async function checkIds() {
    const authUser = await admin.auth().getUserByEmail('sa@test.com').catch(() => null);
    console.log('Auth UID:', authUser?.uid);

    const snapshot = await db.collection('users').where('email', '==', 'sa@test.com').get();
    if (snapshot.empty) {
        console.log('No user found in Firestore for sa@test.com');
    } else {
        snapshot.forEach(doc => {
            console.log('Firestore Doc ID:', doc.id);
            console.log('Firestore Doc Data:', doc.data());
        });
    }
}

checkIds().then(() => process.exit(0)).catch(e => console.error(e));
