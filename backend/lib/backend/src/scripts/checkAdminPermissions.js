"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const firebaseAdmin_1 = require("../firebaseAdmin");
// Connect to emulators
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
async function checkAdminPermissions() {
    var _a, _b, _c, _d;
    const email = 'admin@demo.com';
    console.log(`Checking permissions for user: ${email}`);
    try {
        const db = firebaseAdmin_1.admin.firestore();
        const userRecord = await firebaseAdmin_1.admin.auth().getUserByEmail(email);
        const uid = userRecord.uid;
        const userDoc = await db.collection('users').doc(uid).get();
        const companyId = (_a = userDoc.data()) === null || _a === void 0 ? void 0 : _a.activeCompanyId;
        console.log(`Active Company: ${companyId}`);
        console.log(`Is System Admin (User Doc): ${(_b = userDoc.data()) === null || _b === void 0 ? void 0 : _b.isAdmin}`);
        // Check company role
        const membershipSnap = await db.collection('company_users')
            .where('userId', '==', uid)
            .where('companyId', '==', companyId)
            .get();
        if (!membershipSnap.empty) {
            const mem = membershipSnap.docs[0].data();
            console.log(`Role ID: ${mem.roleId}`);
            const roleDoc = await db.collection('companies').doc(companyId).collection('roles').doc(mem.roleId).get();
            console.log(`Role Name: ${(_c = roleDoc.data()) === null || _c === void 0 ? void 0 : _c.name}`);
            console.log(`Permissions: ${JSON.stringify((_d = roleDoc.data()) === null || _d === void 0 ? void 0 : _d.permissions)}`);
        }
    }
    catch (error) {
        console.error('Error:', error);
    }
}
checkAdminPermissions().then(() => process.exit());
//# sourceMappingURL=checkAdminPermissions.js.map