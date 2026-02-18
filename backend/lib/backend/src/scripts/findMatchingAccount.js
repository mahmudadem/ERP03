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
    console.log(`Scanning all accounts in company ${companyId}...`);
    const accountsSnap = await db.collection('companies').doc(companyId)
        .collection('accounting').doc('Data').collection('accounts').get();
    for (const doc of accountsSnap.docs) {
        const acc = doc.data();
        const aid = doc.id;
        // Get ledger stats
        const ledgerSnap = await db.collection('companies').doc(companyId)
            .collection('accounting').doc('Data').collection('ledger')
            .where('accountId', '==', aid)
            .where('isPosted', '==', true)
            .get(); // Need to get docs to sum amounts
        if (ledgerSnap.empty)
            continue;
        let totalDebit = 0;
        let count = ledgerSnap.size;
        ledgerSnap.docs.forEach(d => {
            const e = d.data();
            // logic from repo
            let amt = e.amount || e.fxAmount || 0;
            if (e.side === 'Debit')
                totalDebit += Math.abs(amt);
        });
        console.log(`Account: ${acc.userCode} - ${acc.name} (ID: ${aid}) has ${count} records. Total Debit: ${totalDebit.toFixed(2)}`);
        if (count >= 10 && count <= 20) {
            console.log(`>>> MATCH CANDIDATE: Account ${acc.userCode} has ${count} records which is close to 16.`);
        }
    }
}
main().catch(console.error);
//# sourceMappingURL=findMatchingAccount.js.map