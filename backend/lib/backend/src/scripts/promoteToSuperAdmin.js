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
const FirestoreUserRepository_1 = require("../infrastructure/firestore/repositories/core/FirestoreUserRepository");
// Initialize Firebase Admin if not already
if (!admin.apps.length) {
    admin.initializeApp({
        projectId: process.env.GCLOUD_PROJECT || 'erp-03',
    });
}
const db = admin.firestore();
// Force emulator settings
db.settings({ ignoreUndefinedProperties: true, host: '127.0.0.1:8080', ssl: false });
async function promote() {
    console.log('Promoting admin@demo.com to SUPER_ADMIN...');
    const repo = new FirestoreUserRepository_1.FirestoreUserRepository(db);
    const user = await repo.findByEmail('admin@demo.com');
    if (!user) {
        console.error('User admin@demo.com not found!');
        process.exit(1);
    }
    // Direct update to ensure it works regardless of repo method limitations
    await db.collection('users').doc(user.id).update({
        globalRole: 'SUPER_ADMIN'
    });
    console.log(`User ${user.email} (${user.id}) is now SUPER_ADMIN.`);
}
promote().then(() => process.exit(0)).catch(e => {
    console.error(e);
    process.exit(1);
});
//# sourceMappingURL=promoteToSuperAdmin.js.map