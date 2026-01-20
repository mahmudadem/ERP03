"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Force Emulator usage
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.GCLOUD_PROJECT = 'erp-03';
const firebaseAdmin_1 = __importDefault(require("./firebaseAdmin"));
const db = firebaseAdmin_1.default.firestore();
async function main() {
    console.log('--- DB ROLE AUDIT ---');
    try {
        const companies = await db.collection('companies').get();
        console.log(`Found ${companies.size} companies.`);
        for (const company of companies.docs) {
            console.log(`\nCompany: ${company.id}`);
            const roles = await db.collection('companies').doc(company.id).collection('roles').get();
            console.log(`  Roles found: ${roles.size}`);
            for (const role of roles.docs) {
                const d = role.data();
                console.log(`  - [${role.id}] Name: "${d.name}" | isSystem: ${d.isSystem}`);
                // UNLOCK ANY ROLE THAT IS NOT THE MAIN ADMIN
                if (d.isSystem && role.id !== 'admin' && role.id !== 'template_admin') {
                    console.log(`    (!) UNLOCKING THIS ROLE...`);
                    await role.ref.update({ isSystem: false });
                }
            }
        }
        console.log('\n--- AUDIT COMPLETE ---');
    }
    catch (err) {
        console.error('Audit failed:', err);
    }
}
main();
//# sourceMappingURL=debug_roles.js.map