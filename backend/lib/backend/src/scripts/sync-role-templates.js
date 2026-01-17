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
const path = __importStar(require("path"));
// --- Initialization Logic ---
const admin = require('firebase-admin');
if (admin.apps.length === 0) {
    try {
        const serviceAccountPath = path.resolve(__dirname, '../../service-account.json');
        if (require('fs').existsSync(serviceAccountPath)) {
            admin.initializeApp({ credential: admin.credential.cert(serviceAccountPath) });
        }
        else {
            admin.initializeApp({ projectId: 'erp-03' });
        }
    }
    catch (e) {
        admin.initializeApp({ projectId: 'erp-03' });
    }
}
const db = admin.firestore();
if (process.env.USE_EMULATOR === 'true') {
    const host = process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8080';
    const [hostname, port] = host.split(':');
    db.settings({
        host: `${hostname}:${port}`,
        ssl: false
    });
    console.log(`🔧 Using Firestore Emulator at ${host}\n`);
}
// ----------------------------------------------------------------
// --- Role Templates Definition ---
const ROLE_TEMPLATES = [
    {
        id: 'finance_manager',
        name: 'Finance Manager',
        description: 'Review and approve financial transactions.',
        permissions: [
            'accounting.view',
            'accounting.vouchers.view',
            'accounting.approve.finance',
            'accounting.reports.view',
            'accounting.accounts.view'
        ],
        isCore: true
    },
    {
        id: 'cashier_custodian',
        name: 'Cashier / Custodian',
        description: 'Manage cash and confirm custody of funds.',
        permissions: [
            'accounting.view',
            'accounting.vouchers.view',
            'accounting.custodian.view',
            'accounting.custodian.verify'
        ],
        isCore: true
    },
    {
        id: 'senior_accountant',
        name: 'Senior Accountant',
        description: 'Full access to create, edit, and post journals.',
        permissions: [
            'accounting.view',
            'accounting.accounts.view',
            'accounting.vouchers.view',
            'accounting.vouchers.create',
            'accounting.vouchers.edit',
            'accounting.vouchers.post',
            'accounting.reports.view',
            'accounting.designer.view',
            'accounting.designer.create',
            'accounting.designer.modify'
        ],
        isCore: true
    },
    {
        id: 'external_auditor',
        name: 'External Auditor',
        description: 'Read-only access to all financial data.',
        permissions: [
            'accounting.view',
            'accounting.accounts.view',
            'accounting.vouchers.view',
            'accounting.reports.view',
            'accounting.custodian.view',
            'accounting.designer.view'
        ],
        isCore: true
    }
];
async function syncRoleTemplates() {
    console.log('🔄 Starting Role Template Sync to system_metadata/role_templates/items...');
    const batch = db.batch();
    // Reference to: system_metadata/role_templates/items/{templateId}
    const itemsCollection = db.collection('system_metadata').doc('role_templates').collection('items');
    for (const template of ROLE_TEMPLATES) {
        const docRef = itemsCollection.doc(template.id);
        batch.set(docRef, Object.assign(Object.assign({}, template), { updatedAt: new Date() }), { merge: true });
    }
    await batch.commit();
    console.log(`✅ Successfully synced ${ROLE_TEMPLATES.length} role templates to Firestore.`);
}
syncRoleTemplates().catch(console.error);
//# sourceMappingURL=sync-role-templates.js.map