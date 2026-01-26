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
const firestore_1 = require("firebase-admin/firestore");
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.GCLOUD_PROJECT = 'erp-03';
if (!admin.apps.length) {
    admin.initializeApp({ projectId: 'erp-03' });
}
async function createDummyForm() {
    const db = admin.firestore();
    const companyId = 'demo_company_1769389506317'; // From verification step
    console.log(`Creating dummy form for ${companyId}...`);
    const formId = 'dummy_payment_voucher';
    const formRef = db.collection('companies').doc(companyId)
        .collection('accounting').doc('Settings')
        .collection('voucherForms').doc(formId);
    const form = {
        id: formId,
        companyId: companyId,
        typeId: 'PAYMENT',
        name: 'Manual Payment Voucher',
        code: 'PV-001',
        description: 'Manually created via script',
        prefix: 'PV',
        isDefault: true,
        isSystemGenerated: false,
        isLocked: false,
        enabled: true,
        headerFields: [],
        tableColumns: [],
        layout: { theme: 'default' },
        createdAt: firestore_1.FieldValue.serverTimestamp(),
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
        createdBy: 'script'
    };
    await formRef.set(form);
    console.log('✅ Created dummy form at accounting/Settings/voucherForms');
}
createDummyForm().catch(console.error).then(() => process.exit());
//# sourceMappingURL=createDummyForm.js.map