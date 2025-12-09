"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const firebaseAdmin_1 = require("../firebaseAdmin");
/**
 * Migration script to move system voucher types from:
 * OLD: companies/SYSTEM/voucher_types/{id}
 * NEW: system_voucher_types/{id}
 *
 * This script should be run once after deploying the updated repository code.
 *
 * Usage:
 *   npx ts-node src/migrations/migrateSystemVoucherTypes.ts
 */
// Configure emulator if needed
if (process.env.USE_EMULATOR === 'true' || process.env.FIRESTORE_EMULATOR_HOST) {
    process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
    process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
    console.log('🔧 Using Firebase Emulators');
}
const SYSTEM_COMPANY_ID = 'SYSTEM';
const OLD_PATH = `companies/${SYSTEM_COMPANY_ID}/voucher_types`;
const NEW_COLLECTION = 'system_voucher_types';
async function migrateSystemVoucherTypes() {
    console.log('🔄 Starting migration of system voucher types...');
    console.log(`   FROM: ${OLD_PATH}`);
    console.log(`   TO:   ${NEW_COLLECTION}`);
    console.log('');
    const db = firebaseAdmin_1.admin.firestore();
    try {
        // Get all documents from old location
        const oldCollectionRef = db.collection('companies').doc(SYSTEM_COMPANY_ID).collection('voucher_types');
        const snapshot = await oldCollectionRef.get();
        if (snapshot.empty) {
            console.log('✅ No system voucher types found in old location. Migration may have already been completed or system templates not yet seeded.');
            return;
        }
        console.log(`📦 Found ${snapshot.size} system voucher type(s) to migrate`);
        console.log('');
        const newCollectionRef = db.collection(NEW_COLLECTION);
        let migratedCount = 0;
        let skippedCount = 0;
        // Migrate each document
        for (const doc of snapshot.docs) {
            const data = doc.data();
            const docId = doc.id;
            // Check if it already exists in new location
            const existingDoc = await newCollectionRef.doc(docId).get();
            if (existingDoc.exists) {
                console.log(`⏭️  Skipping ${data.code || docId} - already exists in new location`);
                skippedCount++;
                continue;
            }
            // Copy to new location
            await newCollectionRef.doc(docId).set(data);
            console.log(`✅ Migrated: ${data.code || docId} (${data.name || 'unnamed'})`);
            migratedCount++;
        }
        console.log('');
        console.log('📊 Migration Summary:');
        console.log(`   Total found:    ${snapshot.size}`);
        console.log(`   Migrated:       ${migratedCount}`);
        console.log(`   Skipped:        ${skippedCount}`);
        console.log('');
        if (migratedCount > 0) {
            console.log('⚠️  IMPORTANT: The old documents still exist at the old location.');
            console.log('   Once you verify the migration worked correctly, you can manually delete them:');
            console.log(`   Path: ${OLD_PATH}`);
            console.log('');
            console.log('   To delete old documents, run:');
            console.log('   ts-node src/migrations/cleanupOldSystemVoucherTypes.ts');
        }
        console.log('✅ Migration completed successfully!');
    }
    catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    }
}
// Initialize Firebase Admin and run migration
(async () => {
    try {
        await migrateSystemVoucherTypes();
        process.exit(0);
    }
    catch (error) {
        console.error('Fatal error:', error);
        process.exit(1);
    }
})();
//# sourceMappingURL=migrateSystemVoucherTypes.js.map