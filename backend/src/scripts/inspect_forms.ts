import * as admin from 'firebase-admin';

// Initialize Firebase Admin (connects to emulator via ENV variables)
if (!admin.apps.length) {
    admin.initializeApp({
        projectId: process.env.GCLOUD_PROJECT || 'erp-03'
    });
}

const db = admin.firestore();

async function run() {
    console.log("Querying all collections for voucherForms...");
    const snapshot = await db.collectionGroup('voucherForms').get();
    console.log(`Found ${snapshot.size} forms in total.`);
    
    snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.name.includes('Copy33333') || data.name.includes('Direct') || data.id.includes('Copy')) {
            console.log(`\nForm Name: ${data.name} | ID: ${doc.id} | Path: ${doc.ref.path}`);
            console.log(`isDefault: ${data.isDefault} | isSystem: ${data.isSystemGenerated}`);
            if (data.uiModeOverrides && data.uiModeOverrides.windows) {
                console.log("Windows HEADER Section fields:");
                const headerFields = data.uiModeOverrides.windows.sections?.HEADER?.fields || [];
                headerFields.forEach((f: any) => {
                    console.log(`  - Field: ${f.fieldId} | Row: ${f.row} | Col: ${f.col} | ColSpan: ${f.colSpan}`);
                });
            } else {
                console.log("No Windows uiModeOverrides found.");
            }
        }
    });
}

run().catch(console.error);
