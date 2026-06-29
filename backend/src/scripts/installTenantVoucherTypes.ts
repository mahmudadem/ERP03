/**
 * installTenantVoucherTypes.ts — install the canonical SYSTEM voucher templates
 * into a specific tenant (the per-company step the Forms Management "Install"
 * button performs), run against REAL Firestore.
 *
 * Phase 1 (no TARGET_COMPANY_ID): lists all companies (id + name) — read-only.
 * Phase 2 (TARGET_COMPANY_ID set): installs every ACCOUNTING/SALES/PURCHASE
 *         system template into that company. Idempotent (already-installed
 *         templates are left untouched).
 *
 * Requires GOOGLE_APPLICATION_CREDENTIALS (erp-03 key) and CONFIRM_PROD_SEED=yes.
 *
 * Run (list):
 *   GOOGLE_APPLICATION_CREDENTIALS=/abs/key.json CONFIRM_PROD_SEED=yes \
 *   npx ts-node --transpile-only src/scripts/installTenantVoucherTypes.ts
 * Run (install):
 *   GOOGLE_APPLICATION_CREDENTIALS=/abs/key.json CONFIRM_PROD_SEED=yes \
 *   TARGET_COMPANY_ID=<id> npx ts-node --transpile-only src/scripts/installTenantVoucherTypes.ts
 */

process.env.DB_TYPE = 'FIRESTORE';
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'erp-03';
delete process.env.FIRESTORE_EMULATOR_HOST;
delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
delete process.env.FIREBASE_DATABASE_EMULATOR_HOST;
delete process.env.FUNCTIONS_EMULATOR;

import { diContainer } from '../infrastructure/di/bindRepositories';
import { syncCompanyVoucherTemplatesFromSystem } from '../application/system/services/CompanyVoucherTemplateSyncService';
import { admin } from '../firebaseAdmin';

const MODULES = ['ACCOUNTING', 'SALES', 'PURCHASE'];

async function run() {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error('Refusing to run: GOOGLE_APPLICATION_CREDENTIALS is not set.');
    process.exit(1);
  }
  if (process.env.CONFIRM_PROD_SEED !== 'yes') {
    console.error('Refusing to run: set CONFIRM_PROD_SEED=yes.');
    process.exit(1);
  }
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    console.error(`Refusing to run: FIRESTORE_EMULATOR_HOST is set (${process.env.FIRESTORE_EMULATOR_HOST}).`);
    process.exit(1);
  }

  const db = admin.firestore();
  const snap = await db.collection('companies').get();
  const companies = snap.docs.map((d) => ({
    id: d.id,
    name: d.data().name || d.data().displayName || d.data().legalName || '(no name)',
  }));

  console.log(`\nFound ${companies.length} compan${companies.length === 1 ? 'y' : 'ies'}:`);
  companies.forEach((c) => console.log(`  ${c.id}   ${c.name}`));

  const target = process.env.TARGET_COMPANY_ID;
  if (!target) {
    console.log('\nNo TARGET_COMPANY_ID set — list only, nothing installed.');
    console.log('Re-run with TARGET_COMPANY_ID=<id> to install canonical voucher types.\n');
    return;
  }

  const company = companies.find((c) => c.id === target);
  if (!company) {
    console.error(`\nTarget company "${target}" not found in the list above.`);
    process.exit(1);
  }

  console.log(`\nInstalling all ${MODULES.join('/')} templates into "${company.name}" (${company.id})...`);
  const result = await syncCompanyVoucherTemplatesFromSystem({
    companyId: target,
    modules: MODULES,
    selectedTemplateIds: undefined, // undefined => copy every template in these modules
    createdBy: 'SYSTEM',
    voucherTypeRepo: diContainer.voucherTypeDefinitionRepository,
    voucherFormRepo: diContainer.voucherFormRepository,
  });
  console.log('Install result:', result);
  console.log('Done.\n');
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Install failed:', error);
    process.exit(1);
  });
