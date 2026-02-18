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
if (!admin.apps.length) {
    admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT });
}
const db = admin.firestore();
async function main() {
    const companyId = 'cmp_mkvfwfm5_h1t3vi';
    const accountId = '40102'; // Export Sales (Contra) - or check the main one
    // Check the main account 10201
    // First find its ID
    const accountsSnap = await db.collection('companies').doc(companyId)
        .collection('accounting').doc('Data').collection('accounts')
        .where('userCode', '==', '10201').get();
    if (accountsSnap.empty) {
        console.log('Account 10201 not found');
        return;
    }
    const accId = accountsSnap.docs[0].id;
    console.log('Account 10201 ID:', accId);
    const ledgerCol = db.collection('companies').doc(companyId)
        .collection('accounting').doc('Data').collection('ledger');
    const snap = await ledgerCol
        .where('accountId', '==', accId)
        .get();
    console.log(`Total ledger entries for 10201: ${snap.size}`);
    // Check dates
    if (snap.size > 0) {
        const dates = snap.docs.map(d => d.data().date.toDate().toISOString().split('T')[0]).sort();
        console.log('First date:', dates[0]);
        console.log('Last date:', dates[dates.length - 1]);
    }
}
main().catch(console.error);
//# sourceMappingURL=listLedger.js.map