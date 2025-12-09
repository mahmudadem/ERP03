"use strict";
/**
 * List ALL collections in Firestore to see what's actually there
 */
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
if (admin.apps.length === 0) {
    admin.initializeApp({ projectId: 'demo-project' });
}
const db = admin.firestore();
if (process.env.USE_EMULATOR === 'true') {
    const host = process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8080';
    const [hostname, port] = host.split(':');
    db.settings({ host: `${hostname}:${port}`, ssl: false });
    console.log(`🔧 Using Firestore Emulator at ${host}\n`);
}
async function listAllCollections() {
    try {
        console.log('📚 Listing ALL top-level collections:\n');
        const collections = await db.listCollections();
        if (collections.length === 0) {
            console.log('❌ No collections found!\n');
            return;
        }
        for (const collection of collections) {
            const snapshot = await collection.limit(5).get();
            console.log(`\n📁 ${collection.id} (${snapshot.size} docs shown, may have more):`);
            snapshot.forEach(doc => {
                const data = doc.data();
                console.log(`   - ${doc.id}`);
                // Show first few fields
                const keys = Object.keys(data).slice(0, 3);
                keys.forEach(key => {
                    const value = data[key];
                    const display = typeof value === 'string' ? value.substring(0, 30) : JSON.stringify(value).substring(0, 30);
                    console.log(`      ${key}: ${display}`);
                });
            });
        }
        console.log('\n✅ Done\n');
    }
    catch (error) {
        console.error('❌ Error:', error);
    }
}
listAllCollections()
    .then(() => process.exit(0))
    .catch(err => {
    console.error(err);
    process.exit(1);
});
//# sourceMappingURL=listAllCollections.js.map