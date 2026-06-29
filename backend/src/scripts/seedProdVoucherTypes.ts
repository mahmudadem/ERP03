/**
 * seedProdVoucherTypes.ts — seed the canonical SYSTEM voucher templates into
 * the REAL (production) Firestore, NOT the emulator.
 *
 * Why this exists: the standard runners (runSystemSeeder.ts / seed:vouchers)
 * hard-pin FIRESTORE_EMULATOR_HOST, so they can only ever seed the local
 * emulator. Production's `system_metadata/voucher_types/items` was therefore
 * never populated, leaving every tenant on hardcoded "Native" fallbacks.
 *
 * This runner:
 *   - forces DB_TYPE=FIRESTORE and project erp-03
 *   - explicitly UNSETS every emulator host so admin SDK hits real Firestore
 *   - refuses to run unless GOOGLE_APPLICATION_CREDENTIALS points at a key
 *   - delegates to the SAME seedSystemVoucherTypes() the bootstrap path uses,
 *     so it cannot drift from the official template contract.
 *
 * It is idempotent (upsert by canonical code) and only touches SYSTEM
 * (companyId='SYSTEM') docs under system_metadata. Tenant data is untouched.
 *
 * Run:
 *   GOOGLE_APPLICATION_CREDENTIALS=/abs/path/erp-03-key.json \
 *   CONFIRM_PROD_SEED=yes \
 *   npx ts-node --transpile-only src/scripts/seedProdVoucherTypes.ts
 */

// 1. Environment MUST be set before any import that touches firebaseAdmin.
process.env.DB_TYPE = 'FIRESTORE';
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'erp-03';
delete process.env.FIRESTORE_EMULATOR_HOST;
delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
delete process.env.FIREBASE_DATABASE_EMULATOR_HOST;
delete process.env.FUNCTIONS_EMULATOR;

// 2. Now import dependencies (these initialize the admin SDK on load).
import { diContainer } from '../infrastructure/di/bindRepositories';
import { seedSystemVoucherTypes } from '../seeder/seedSystemVoucherTypes';

async function run() {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error('Refusing to run: GOOGLE_APPLICATION_CREDENTIALS is not set.');
    console.error('Point it at an erp-03 service-account JSON key, e.g.:');
    console.error('  GOOGLE_APPLICATION_CREDENTIALS=/abs/path/erp-03-key.json CONFIRM_PROD_SEED=yes npx ts-node --transpile-only src/scripts/seedProdVoucherTypes.ts');
    process.exit(1);
  }
  if (process.env.CONFIRM_PROD_SEED !== 'yes') {
    console.error('Refusing to run: set CONFIRM_PROD_SEED=yes to confirm you are writing to PRODUCTION Firestore.');
    process.exit(1);
  }
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    console.error(`Refusing to run: FIRESTORE_EMULATOR_HOST is set (${process.env.FIRESTORE_EMULATOR_HOST}). This runner targets real Firestore only.`);
    process.exit(1);
  }

  console.log(`Seeding canonical SYSTEM voucher templates into PRODUCTION project "${process.env.GCLOUD_PROJECT}"...`);
  await seedSystemVoucherTypes(diContainer.voucherTypeDefinitionRepository);
  console.log('PROD voucher template seeding complete.');
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Failed to seed PROD voucher templates:', error);
    process.exit(1);
  });
