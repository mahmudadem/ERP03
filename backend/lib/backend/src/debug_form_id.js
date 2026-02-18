const admin = require('firebase-admin');
// Initialize Firebase Admin (connects to emulator via ENV variables)
if (!admin.apps.length) {
    admin.initializeApp({
        projectId: process.env.GCLOUD_PROJECT || 'erp-03'
    });
}
const db = admin.firestore();
async function inspect(companyId) {
    console.log(`\n--- Inspecting Vouchers for Company: ${companyId} ---`);
    console.log(`Checking modular path: companies/${companyId}/accounting/Data/vouchers`);
    const modularRef = db.collection(`companies/${companyId}/accounting/Data/vouchers`);
    // Get a sample of correct vouchers to see their formIds
    // We want to see what is actually stored
    const snapshot = await modularRef.limit(20).get();
    if (snapshot.empty) {
        console.log("No vouchers found in modular path.");
        return;
    }
    console.log(`Found ${snapshot.size} sample vouchers. checking formId...`);
    snapshot.docs.forEach(doc => {
        var _a;
        const data = doc.data();
        const formId = (_a = data.metadata) === null || _a === void 0 ? void 0 : _a.formId;
        const type = data.type;
        const voucherNo = data.voucherNo;
        const date = data.date;
        console.log(`- ID: ${doc.id} | No: ${voucherNo} | Type: ${type} | Date: ${date} | FormID: ${formId}`);
    });
}
const companyId = process.argv[2] || 'cmp_mkvfwfm5_h1t3vi';
inspect(companyId).catch(console.error);
//# sourceMappingURL=debug_form_id.js.map