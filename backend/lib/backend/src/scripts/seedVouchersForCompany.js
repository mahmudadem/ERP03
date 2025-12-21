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
// Force Firestore Emulator usage for local seeding
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'erp-03';
const admin = __importStar(require("firebase-admin"));
// Initialize Firebase Admin
if (!admin.apps.length) {
    admin.initializeApp({
        projectId: process.env.GCLOUD_PROJECT,
    });
}
const db = admin.firestore();
const COMPANY_ID = 'cmp_mjc0ctvo_6v71ci'; // User provided ID
const TOTAL_VOUCHERS = 100;
// Voucher Types to cycle through
const VOUCHER_TYPES = [
    'payment_voucher',
    'receipt_voucher',
    'journal_entry',
    'sales_invoice',
    'purchase_invoice'
];
const CURRENCIES = ['USD', 'EUR', 'GBP', 'SAR', 'AED'];
function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
function getRandomElement(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}
function generateRandomDate(start, end) {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}
async function seed() {
    console.log(`🌱 Seeding ${TOTAL_VOUCHERS} vouchers for company: ${COMPANY_ID}`);
    const batchSize = 500; // Firestore batch limit
    let batch = db.batch();
    let count = 0;
    const startDate = new Date('2024-01-01');
    const endDate = new Date('2024-12-31');
    for (let i = 0; i < TOTAL_VOUCHERS; i++) {
        const id = `vch_${Date.now()}_${i.toString().padStart(3, '0')}`;
        const type = getRandomElement(VOUCHER_TYPES);
        const date = generateRandomDate(startDate, endDate);
        const currency = getRandomElement(CURRENCIES);
        const totalAmount = getRandomInt(100, 50000);
        // Random Status
        const status = Math.random() > 0.8 ? 'draft' : (Math.random() > 0.5 ? 'approved' : 'pending');
        const voucherRef = db.collection('companies').doc(COMPANY_ID).collection('vouchers').doc(id);
        const voucherData = {
            id: id,
            companyId: COMPANY_ID,
            type: type,
            date: admin.firestore.Timestamp.fromDate(date),
            status: status,
            reference: `REF-${getRandomInt(1000, 9999)}`,
            currency: currency,
            exchangeRate: 1.0,
            narration: `Auto-generated ${type} #${i + 1}`,
            totalDebit: totalAmount,
            totalCredit: totalAmount,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            lines: [
                {
                    id: 1,
                    accountId: 'acc_demo_cash',
                    description: 'Debit Line',
                    debit: totalAmount,
                    credit: 0
                },
                {
                    id: 2,
                    accountId: 'acc_demo_sales',
                    description: 'Credit Line',
                    debit: 0,
                    credit: totalAmount
                }
            ],
            history: []
        };
        batch.set(voucherRef, voucherData);
        count++;
        if (count % batchSize === 0) {
            await batch.commit();
            console.log(`committed batch of ${batchSize}`);
            batch = db.batch();
        }
    }
    if (count % batchSize !== 0) {
        await batch.commit();
        console.log(`committed final batch`);
    }
    console.log('✅ Seeding complete!');
    console.log(`Created ${count} vouchers in ${COMPANY_ID}`);
}
seed().catch(console.error);
//# sourceMappingURL=seedVouchersForCompany.js.map