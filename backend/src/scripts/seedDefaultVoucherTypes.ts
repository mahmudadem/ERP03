/**
 * Reseed canonical system voucher templates.
 *
 * This script intentionally delegates to the same seeder used by the
 * system bootstrap path so `npm run seed:vouchers` cannot drift away from
 * the official template contract.
 */

process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'erp-03';

import { diContainer } from '../infrastructure/di/bindRepositories';
import { seedSystemVoucherTypes } from '../seeder/seedSystemVoucherTypes';

async function run() {
  console.log('Seeding canonical system voucher templates...');
  await seedSystemVoucherTypes(diContainer.voucherTypeDefinitionRepository);
  console.log('Canonical voucher template seeding complete.');
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Failed to seed canonical voucher templates:', error);
    process.exit(1);
  });
