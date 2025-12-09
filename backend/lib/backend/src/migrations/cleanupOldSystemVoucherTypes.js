"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const firebaseAdmin_1 = require("../firebaseAdmin");
/**
 * Cleanup script to delete old system voucher types from:
 * companies/SYSTEM/voucher_types/{id}
 *
 * ⚠️ WARNING: Only run this AFTER you have verified that the migration
 * to system_voucher_types was successful!
 *
 * Usage:
 *   npx ts-node src/migrations/cleanupOldSystemVoucherTypes.ts
 */
// Configure emulator if needed
if (process.env.USE_EMULATOR === 'true' || process.env.FIRESTORE_EMULATOR_HOST) {
    process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
    process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
    console.log('🔧 Using Firebase Emulators');
}
const SYSTEM_COMPANY_ID = 'SYSTEM';
const OLD_PATH = `companies/${SYSTEM_COMPANY_ID}/voucher_types`;
async function cleanupOldSystemVoucherTypes() {
    console.log('🗑️  Starting cleanup of old system voucher types...');
    console.log(`   Path: ${OLD_PATH}`);
    console.log('');
    const db = firebaseAdmin_1.admin.firestore();
    try {
        // Get all documents from old location
        const oldCollectionRef = db.collection('companies').doc(SYSTEM_COMPANY_ID).collection('voucher_types');
        const snapshot = await oldCollectionRef.get();
        if (snapshot.empty) {
            console.log('✅ No documents found in old location. Already cleaned up!');
            return;
        }
        console.log(`📦 Found ${snapshot.size} document(s) to delete`);
        console.log('');
        console.log('⚠️  WARNING: This will permanently delete these documents!');
        console.log('   Press Ctrl+C within 5 seconds to cancel...');
        console.log('');
        // Wait 5 seconds before proceeding
        await new Promise(resolve => setTimeout(resolve, 5000));
        let deletedCount = 0;
        // Delete each document
        for (const doc of snapshot.docs) {
            const data = doc.data();
            await doc.ref.delete();
            console.log(`🗑️  Deleted: ${data.code || doc.id} (${data.name || 'unnamed'})`);
            deletedCount++;
        }
        console.log('');
        console.log(`✅ Cleanup completed! Deleted ${deletedCount} document(s)`);
    }
    catch (error) {
        console.error('❌ Cleanup failed:', error);
        throw error;
    }
}
// Initialize Firebase Admin and run cleanup
(async () => {
    try {
        await cleanupOldSystemVoucherTypes();
        process.exit(0);
    }
    catch (error) {
        console.error('Fatal error:', error);
        process.exit(1);
    }
})();
//# sourceMappingURL=cleanupOldSystemVoucherTypes.js.map