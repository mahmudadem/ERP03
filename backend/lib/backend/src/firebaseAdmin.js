"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a, _b;
Object.defineProperty(exports, "__esModule", { value: true });
exports.admin = void 0;
const firebase_admin_1 = __importDefault(require("firebase-admin"));
exports.admin = firebase_admin_1.default;
const projectId = process.env.GCLOUD_PROJECT ||
    (process.env.FIREBASE_CONFIG && JSON.parse(process.env.FIREBASE_CONFIG).projectId) ||
    'erp-03';
// DEBUG: Log environment
console.log('🔍 Firebase Init:', {
    projectId,
    FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST,
    FIREBASE_AUTH_EMULATOR_HOST: process.env.FIREBASE_AUTH_EMULATOR_HOST,
    FUNCTIONS_EMULATOR: process.env.FUNCTIONS_EMULATOR
});
// Configure emulators
if (process.env.FUNCTIONS_EMULATOR || process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    // Auth Emulator
    (_a = process.env).FIREBASE_AUTH_EMULATOR_HOST || (_a.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099');
    // Firestore Emulator  
    (_b = process.env).FIRESTORE_EMULATOR_HOST || (_b.FIRESTORE_EMULATOR_HOST = 'localhost:8080');
    console.log('✅ Emulator vars set:', {
        FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST,
        FIREBASE_AUTH_EMULATOR_HOST: process.env.FIREBASE_AUTH_EMULATOR_HOST
    });
}
if (!firebase_admin_1.default.apps.length) {
    firebase_admin_1.default.initializeApp({ projectId });
}
exports.default = firebase_admin_1.default;
//# sourceMappingURL=firebaseAdmin.js.map