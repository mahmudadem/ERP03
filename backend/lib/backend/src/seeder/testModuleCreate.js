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
// Quick test to see the actual error
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.GCLOUD_PROJECT = 'erp-03';
const admin = __importStar(require("firebase-admin"));
if (!admin.apps.length) {
    admin.initializeApp({ projectId: 'erp-03' });
}
const bindRepositories_1 = require("../infrastructure/di/bindRepositories");
async function test() {
    try {
        console.log('Testing module repository...');
        console.log('Repository exists?', !!bindRepositories_1.diContainer.companyModuleRepository);
        const testModule = {
            companyId: 'test_company',
            moduleCode: 'accounting',
            initialized: false,
            initializationStatus: 'pending',
            config: {},
            installedAt: new Date()
        };
        console.log('Test module:', testModule);
        console.log('Attempting create...');
        await bindRepositories_1.diContainer.companyModuleRepository.create(testModule);
        console.log('✅ Create successful!');
    }
    catch (error) {
        console.error('❌ Error:', error);
        if (error instanceof Error) {
            console.error('Message:', error.message);
            console.error('Stack:', error.stack);
        }
    }
}
test().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
});
//# sourceMappingURL=testModuleCreate.js.map