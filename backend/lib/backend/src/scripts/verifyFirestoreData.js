"use strict";
/**
 * Verify what data exists in Firestore emulator
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const admin = __importStar(require("firebase-admin"));
// Initialize
if (admin.apps.length === 0) {
    admin.initializeApp({ projectId: 'demo-project' });
}
const db = admin.firestore();
// Configure emulator
if (process.env.USE_EMULATOR === 'true') {
    const host = process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8080';
    const [hostname, port] = host.split(':');
    db.settings({
        host: `${hostname}:${port}`,
        ssl: false
    });
    console.log(`🔧 Using Firestore Emulator at ${host}\n`);
}
async function verifyData() {
    try {
        console.log('🔍 Checking Firestore data...\n');
        // Check vouchers collection
        console.log('📋 Checking vouchers collection:');
        const vouchersSnapshot = await db.collection('vouchers').get();
        console.log(`   Found ${vouchersSnapshot.size} documents\n`);
        if (vouchersSnapshot.empty) {
            console.log('   ❌ No vouchers found!\n');
        }
        else {
            console.log('   Vouchers:');
            vouchersSnapshot.forEach(doc => {
                const data = doc.data();
                console.log(`   - ${doc.id}: ${data.voucherNo || 'N/A'} (${data.status})`);
            });
            console.log('');
        }
        // Check companies
        console.log('🏢 Checking companies collection:');
        const companiesSnapshot = await db.collection('companies').get();
        console.log(`   Found ${companiesSnapshot.size} companies`);
        companiesSnapshot.forEach(doc => {
            console.log(`   - ${doc.id}: ${doc.data().name}`);
        });
        console.log('');
        // Check users
        console.log('👥 Checking users collection:');
        const usersSnapshot = await db.collection('users').get();
        console.log(`   Found ${usersSnapshot.size} users`);
        console.log('');
        console.log('✅ Verification complete\n');
    }
    catch (error) {
        console.error('❌ Error:', error);
    }
}
verifyData()
    .then(() => process.exit(0))
    .catch((err) => {
    console.error(err);
    process.exit(1);
});
//# sourceMappingURL=verifyFirestoreData.js.map