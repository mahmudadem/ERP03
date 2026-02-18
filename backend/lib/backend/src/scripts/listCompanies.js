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
    console.log('Listing companies...');
    const snap = await db.collection('companies').get();
    if (snap.empty) {
        console.log('No companies found.');
        return;
    }
    for (const doc of snap.docs) {
        const data = doc.data();
        console.log(`\nCompany ID: ${doc.id}`);
        console.log(`Name: ${data.name || 'Unnamed'}`);
        // Check accounts
        const accSnap = await db.collection('companies').doc(doc.id)
            .collection('accounting').doc('Data').collection('accounts').limit(5).get();
        console.log(`Accounts found: ${accSnap.size > 0 ? 'YES' : 'NO'}`);
        if (accSnap.size > 0) {
            console.log('Sample accounts:', accSnap.docs.map(d => d.data().name).join(', '));
        }
    }
}
main().catch(console.error);
//# sourceMappingURL=listCompanies.js.map