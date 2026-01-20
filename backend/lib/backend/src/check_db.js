"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
const firebaseAdmin_1 = __importDefault(require("./firebaseAdmin"));
const db = firebaseAdmin_1.default.firestore();
async function check() {
    const s = await db.collectionGroup('accounts').limit(5).get();
    if (s.empty) {
        console.log('No accounts found anywhere!');
    }
    else {
        s.forEach(d => console.log('Path:', d.ref.path, 'CompanyId:', d.data().companyId));
    }
    process.exit(0);
}
check();
//# sourceMappingURL=check_db.js.map