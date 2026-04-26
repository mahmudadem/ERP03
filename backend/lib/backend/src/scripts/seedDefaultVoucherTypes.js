"use strict";
/**
 * Reseed canonical system voucher templates.
 *
 * This script intentionally delegates to the same seeder used by the
 * system bootstrap path so `npm run seed:vouchers` cannot drift away from
 * the official template contract.
 */
Object.defineProperty(exports, "__esModule", { value: true });
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'erp-03';
const bindRepositories_1 = require("../infrastructure/di/bindRepositories");
const seedSystemVoucherTypes_1 = require("../seeder/seedSystemVoucherTypes");
async function run() {
    console.log('Seeding canonical system voucher templates...');
    await (0, seedSystemVoucherTypes_1.seedSystemVoucherTypes)(bindRepositories_1.diContainer.voucherTypeDefinitionRepository);
    console.log('Canonical voucher template seeding complete.');
}
run()
    .then(() => process.exit(0))
    .catch((error) => {
    console.error('Failed to seed canonical voucher templates:', error);
    process.exit(1);
});
//# sourceMappingURL=seedDefaultVoucherTypes.js.map