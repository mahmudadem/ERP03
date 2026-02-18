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
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'erp-03';
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
if (!admin.apps.length) {
    admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT });
}
const db = admin.firestore();
// Copy-paste of the repo logic we want to test
async function testGetAccountStatement() {
    const companyId = 'cmp_mkvfwfm5_h1t3vi';
    // Find account ID for 10201 again to be sure
    const accSnap = await db.collection('companies').doc(companyId)
        .collection('accounting').doc('Data').collection('accounts')
        .where('userCode', '==', '10201').get();
    const accountId = accSnap.docs[0].id;
    const startDate = '2026-01-01';
    const endDate = '2026-02-14'; // Today
    console.log(`Testing getAccountStatement for ${accountId} from ${startDate} to ${endDate}`);
    const startTs = firestore_1.Timestamp.fromDate(new Date(startDate + 'T00:00:00'));
    const endTs = firestore_1.Timestamp.fromDate(new Date(endDate + 'T23:59:59.999'));
    const ledgerCol = db.collection('companies').doc(companyId)
        .collection('accounting').doc('Data').collection('ledger');
    const query = ledgerCol
        .where('isPosted', '==', true)
        .where('accountId', '==', accountId)
        .where('date', '>=', startTs)
        .where('date', '<=', endTs)
        .orderBy('date', 'asc');
    const snap = await query.get();
    console.log(`Query found ${snap.size} records.`);
    if (snap.size > 0 && snap.size < 20) {
        snap.docs.forEach(d => console.log(d.data().date.toDate(), d.data().voucherNo));
    }
}
testGetAccountStatement().catch(console.error);
//# sourceMappingURL=testAccountStatement.js.map