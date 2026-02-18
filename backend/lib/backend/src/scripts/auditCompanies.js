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
    console.log('Scanning companies for Account 10201...');
    const companiesSnap = await db.collection('companies').get();
    for (const doc of companiesSnap.docs) {
        const companyName = doc.data().name || 'Unknown';
        const cid = doc.id;
        // Find account 10201
        const accSnap = await db.collection('companies').doc(cid)
            .collection('accounting').doc('Data').collection('accounts')
            .where('userCode', '==', '10201').get();
        if (accSnap.empty) {
            console.log(`[${cid}] ${companyName}: Account 10201 NOT FOUND`);
            continue;
        }
        const acc = accSnap.docs[0];
        const aid = acc.id;
        const accName = acc.data().name;
        // Count ledger entries
        const ledgerSnap = await db.collection('companies').doc(cid)
            .collection('accounting').doc('Data').collection('ledger')
            .where('accountId', '==', aid)
            .count()
            .get();
        console.log(`[${cid}] ${companyName}: Found 10201 (${accName}) - ID: ${aid} - Ledger Entries: ${ledgerSnap.data().count}`);
    }
}
main().catch(console.error);
//# sourceMappingURL=auditCompanies.js.map