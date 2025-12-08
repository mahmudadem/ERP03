import { admin } from '../firebaseAdmin';

// Connect to emulators
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

async function listVoucherTypes() {
    console.log('Listing voucher types...');
    const db = admin.firestore();
    const snapshot = await db.collection('voucher_types').get();
    
    if (snapshot.empty) {
        console.log('No voucher types found.');
        return;
    }

    snapshot.forEach(doc => {
        const data = doc.data();
        console.log(`- ID: ${doc.id}, Name: ${data.name}, Company: ${data.companyId}`);
    });
}

listVoucherTypes().then(() => process.exit());
