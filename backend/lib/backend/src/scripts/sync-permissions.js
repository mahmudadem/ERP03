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
const PermissionCatalog_1 = require("../config/PermissionCatalog");
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
async function syncPermissions() {
    console.log('🔄 Starting Permission Catalog Sync to system_metadata/permissions/items...');
    const batch = db.batch();
    // Reference to: system_metadata/permissions/items/{permissionId}
    const itemsCollection = db.collection('system_metadata').doc('permissions').collection('items');
    let count = 0;
    for (const module of PermissionCatalog_1.PERMISSION_CATALOG) {
        for (const perm of module.permissions) {
            const permissionDoc = {
                id: perm.id,
                category: module.moduleId,
                labelEn: perm.label,
                labelAr: perm.label,
                labelTr: perm.label,
                descriptionEn: perm.description || '',
                descriptionAr: perm.description || '',
                descriptionTr: perm.description || '',
                module: module.moduleId,
                updatedAt: new Date()
            };
            const docRef = itemsCollection.doc(perm.id);
            batch.set(docRef, permissionDoc, { merge: true });
            count++;
        }
    }
    await batch.commit();
    console.log(`✅ Successfully synced ${count} permissions to Firestore.`);
}
syncPermissions().catch(console.error);
//# sourceMappingURL=sync-permissions.js.map