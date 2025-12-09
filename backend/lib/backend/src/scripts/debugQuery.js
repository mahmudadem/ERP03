"use strict";
/**
 * Debug the exact query being used
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
if (admin.apps.length === 0) {
    admin.initializeApp({ projectId: 'demo-project' });
}
const db = admin.firestore();
if (process.env.USE_EMULATOR === 'true') {
    const host = process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8080';
    const [hostname, port] = host.split(':');
    db.settings({ host: `${hostname}:${port}`, ssl: false });
}
async function debugQuery() {
    const companyId = 'demo_company_1764981773080';
    const fromDate = new Date('2025-01-01');
    const toDate = new Date('2025-12-31');
    console.log('🔍 Testing Firestore Query...\n');
    console.log('Company:', companyId);
    console.log('From:', fromDate.toISOString());
    console.log('To:', toDate.toISOString());
    console.log('');
    try {
        // Try the problematic query
        console.log('📊 Attempting compound query (with date range)...');
        const query = db.collection('vouchers')
            .where('companyId', '==', companyId)
            .where('date', '>=', fromDate.toISOString())
            .where('date', '<=', toDate.toISOString())
            .orderBy('date', 'asc');
        const snapshot = await query.get();
        console.log(`✅ Found ${snapshot.size} vouchers\n`);
        snapshot.forEach(doc => {
            const data = doc.data();
            console.log(`  - ${data.voucherNo}: ${data.date} (${data.status})`);
        });
    }
    catch (error) {
        console.error('❌ Query failed:', error.message);
        console.log('\n📝 This likely means we need a composite index!\n');
        // Try simpler query
        console.log('🔄 Trying simpler query (company only)...');
        const simpleSnapshot = await db.collection('vouchers')
            .where('companyId', '==', companyId)
            .get();
        console.log(`✅ Found ${simpleSnapshot.size} vouchers with simple query\n`);
        simpleSnapshot.forEach(doc => {
            const data = doc.data();
            console.log(`  - ${data.voucherNo}: ${data.date} (${data.status})`);
        });
        console.log('\n💡 We can filter by date in memory instead of Firestore!\n');
    }
}
debugQuery()
    .then(() => process.exit(0))
    .catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
//# sourceMappingURL=debugQuery.js.map