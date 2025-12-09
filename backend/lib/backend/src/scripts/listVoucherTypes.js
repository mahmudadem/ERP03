"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const firebaseAdmin_1 = require("../firebaseAdmin");
// Connect to emulators
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
async function listVoucherTypes() {
    console.log('Listing voucher types...\n');
    const db = firebaseAdmin_1.admin.firestore();
    // List system templates
    console.log('📋 System Templates (system_voucher_types):');
    const systemSnapshot = await db.collection('system_voucher_types').get();
    if (systemSnapshot.empty) {
        console.log('  No system templates found.');
    }
    else {
        systemSnapshot.forEach(doc => {
            const data = doc.data();
            console.log(`  - ${data.name} (${data.code}) - ID: ${doc.id}`);
        });
    }
    console.log('\n📋 Company-Specific Voucher Types:');
    // List all companies and their voucher types
    const companiesSnapshot = await db.collection('companies').get();
    if (companiesSnapshot.empty) {
        console.log('  No companies found.');
        return;
    }
    for (const companyDoc of companiesSnapshot.docs) {
        const voucherTypesSnapshot = await companyDoc.ref.collection('voucher_types').get();
        if (!voucherTypesSnapshot.empty) {
            console.log(`\n  Company: ${companyDoc.id}`);
            voucherTypesSnapshot.forEach(doc => {
                const data = doc.data();
                console.log(`    - ${data.name || 'unnamed'} (${data.code || 'no code'}) - ID: ${doc.id}`);
            });
        }
    }
}
listVoucherTypes().then(() => process.exit());
//# sourceMappingURL=listVoucherTypes.js.map