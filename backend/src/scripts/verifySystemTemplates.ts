import * as admin from 'firebase-admin';

if (!admin.apps.length) {
    admin.initializeApp({
        projectId: process.env.GCLOUD_PROJECT || 'erp-03',
    });
}

const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true, host: '127.0.0.1:8080', ssl: false });

async function verify() {
    console.log('Verifying System Templates...');
    const snapshot = await db.collection('companies').doc('SYSTEM').collection('voucher_types').get();
    
    if (snapshot.empty) {
        console.log('❌ No system templates found!');
    } else {
        console.log(`✅ Found ${snapshot.size} system templates:`);
        snapshot.docs.forEach(doc => {
            console.log(` - ${doc.data().name} (${doc.data().code})`);
        });
    }
}

verify().then(() => process.exit(0)).catch(e => {
    console.error(e);
    process.exit(1);
});
