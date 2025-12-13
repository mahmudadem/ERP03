"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// import { admin } from '../firebaseAdmin';
const bindRepositories_1 = require("../infrastructure/di/bindRepositories");
const seedSystemVoucherTypes_1 = require("./seedSystemVoucherTypes");
const seedSystemMetadata_1 = require("./seedSystemMetadata");
// Connect to emulators
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
async function runSystemSeeder() {
    console.log('Running System Seeder...');
    try {
        // Seed voucher types
        await (0, seedSystemVoucherTypes_1.seedSystemVoucherTypes)(bindRepositories_1.diContainer.voucherTypeDefinitionRepository);
        // Seed system metadata (currencies, COA templates)
        await (0, seedSystemMetadata_1.seedSystemMetadata)(bindRepositories_1.diContainer.systemMetadataRepository);
        console.log('System Seeder Complete.');
    }
    catch (error) {
        console.error('Error:', error);
    }
}
runSystemSeeder().then(() => process.exit());
//# sourceMappingURL=runSystemSeeder.js.map