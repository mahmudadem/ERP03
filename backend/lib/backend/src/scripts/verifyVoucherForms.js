"use strict";
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
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.GCLOUD_PROJECT = 'erp-03';
if (!admin.apps.length) {
    admin.initializeApp({ projectId: 'erp-03' });
}
async function verify() {
    console.log('🔍 Verifying Voucher Forms and Types in Nested Locations...');
    const db = admin.firestore();
    const companies = await db.collection('companies').get();
    if (companies.empty) {
        console.log('❌ No companies found!');
        return;
    }
    for (const company of companies.docs) {
        console.log(`\n🏢 Company: ${company.id}`);
        // Check Voucher Types
        const typesRef = company.ref.collection('accounting').doc('Settings').collection('voucher_types');
        const typesSnap = await typesRef.get();
        console.log(`   📂 Types (accounting/Settings/voucher_types): ${typesSnap.size} docs`);
        typesSnap.forEach(d => console.log(`      - [TYPE] ${d.id} (${d.data().name})`));
        // Check Voucher Forms
        const formsRef = company.ref.collection('accounting').doc('Settings').collection('voucherForms');
        const formsSnap = await formsRef.get();
        console.log(`   📂 Forms (accounting/Settings/voucherForms): ${formsSnap.size} docs`);
        formsSnap.forEach(d => console.log(`      - [FORM] ${d.id} (${d.data().name})`));
    }
}
verify().catch(console.error).then(() => process.exit());
//# sourceMappingURL=verifyVoucherForms.js.map