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
if (!admin.apps.length) {
    admin.initializeApp({
        projectId: process.env.GCLOUD_PROJECT || 'erp-03',
    });
}
const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true, host: '127.0.0.1:8080', ssl: false });
async function verify() {
    console.log('Verifying System Templates...');
    console.log('Collection: system_voucher_types (top-level)');
    const snapshot = await db.collection('system_voucher_types').get();
    if (snapshot.empty) {
        console.log('❌ No system templates found!');
        console.log('   Run the seeder to create system templates.');
    }
    else {
        console.log(`✅ Found ${snapshot.size} system templates:`);
        snapshot.docs.forEach(doc => {
            console.log(` - ${doc.data().name} (${doc.data().code})`);
        });
    }
}
verify().then(() => process.exit(0)).catch(e => {
    console.error(e);
    process.exit(1);
});
//# sourceMappingURL=verifySystemTemplates.js.map