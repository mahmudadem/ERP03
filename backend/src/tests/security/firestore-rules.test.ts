/**
 * firestore-rules.test.ts
 *
 * Tests the production Firestore security rules at `firestore.rules`.
 *
 * Prerequisites (one-time setup):
 *   1. `npm install --save-dev @firebase/rules-unit-testing` in the backend.
 *   2. Firebase emulator running on default port 8080:
 *        `firebase emulators:start --only firestore`
 *   3. PROJECT_ID env var set (defaults to 'demo-erp03').
 *
 * Run:
 *   FIRESTORE_EMULATOR_HOST=localhost:8080 npx jest --testPathPatterns="firestore-rules"
 *
 * What this suite covers:
 *   - Anonymous read/write denied for every collection
 *   - Tenant isolation: user in company A cannot read or write company B's data
 *   - Members can read company data
 *   - Members can write to companies/{cid}/{module}/Settings/** (voucher wizard path)
 *   - Members cannot write directly to companies/{cid}/{module}/Data/** (backend-only)
 *   - system_metadata read allowed for any auth user, write denied
 *   - Super-admin bypass
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';

// The import below resolves at runtime once @firebase/rules-unit-testing is installed.
// Keep this file in tree so the suite can run after `npm install`.
let testing: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  testing = require('@firebase/rules-unit-testing');
} catch {
  testing = null;
}

const PROJECT_ID = process.env.PROJECT_ID || 'demo-erp03';

const RULES = `
${require('fs').readFileSync(require('path').join(__dirname, '../../../../firestore.rules'), 'utf8')}
`;

const COMPANY_A = 'company-a';
const COMPANY_B = 'company-b';
const USER_IN_A = 'user-in-a';
const USER_IN_B = 'user-in-b';
const SUPER_ADMIN = 'super-admin';

const onlyIfHarness = testing ? describe : describe.skip;

onlyIfHarness('Firestore Security Rules', () => {
  let env: any;

  beforeAll(async () => {
    if (!testing) return;
    env = await testing.initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules: RULES,
        host: 'localhost',
        port: 8080,
      },
    });
  });

  afterAll(async () => {
    if (env) await env.cleanup();
  });

  beforeEach(async () => {
    if (!env) return;
    await env.clearFirestore();

    // Seed membership + super-admin user via admin context (bypasses rules)
    await env.withSecurityRulesDisabled(async (context: any) => {
      const db = context.firestore();
      await db.doc(`company_users/${COMPANY_A}_${USER_IN_A}`).set({ userId: USER_IN_A, companyId: COMPANY_A });
      await db.doc(`company_users/${COMPANY_B}_${USER_IN_B}`).set({ userId: USER_IN_B, companyId: COMPANY_B });
      await db.doc(`users/${SUPER_ADMIN}`).set({ globalRole: 'SUPER_ADMIN' });
      await db.doc(`users/${USER_IN_A}`).set({ globalRole: 'USER' });
      await db.doc(`users/${USER_IN_B}`).set({ globalRole: 'USER' });
      await db.doc(`companies/${COMPANY_A}/accounting/Settings/voucherForms/form-1`).set({ name: 'Sales Invoice' });
      await db.doc(`companies/${COMPANY_A}/accounting/Data/vouchers/v-1`).set({ amount: 100 });
      await db.doc('system_metadata/voucher_types').set({});
      await db.doc('system_metadata/voucher_types/items/journal_entry').set({ name: 'Journal Entry' });
    });
  });

  function dbFor(userId: string | null) {
    if (!userId) return env.unauthenticatedContext().firestore();
    return env.authenticatedContext(userId).firestore();
  }

  describe('Anonymous access', () => {
    it('denies anonymous read of any companies/* path', async () => {
      const db = dbFor(null);
      await testing.assertFails(db.doc(`companies/${COMPANY_A}`).get());
    });

    it('denies anonymous read of system_metadata', async () => {
      const db = dbFor(null);
      await testing.assertFails(db.doc('system_metadata/voucher_types').get());
    });

    it('denies anonymous writes everywhere', async () => {
      const db = dbFor(null);
      await testing.assertFails(db.doc(`companies/${COMPANY_A}/anything`).set({ x: 1 }));
    });
  });

  describe('Cross-tenant isolation', () => {
    it('denies user-in-A reading company B data', async () => {
      const db = dbFor(USER_IN_B);
      await testing.assertFails(db.doc(`companies/${COMPANY_A}/accounting/Settings/voucherForms/form-1`).get());
    });

    it('denies user-in-A writing to company B settings', async () => {
      const db = dbFor(USER_IN_B);
      await testing.assertFails(
        db.doc(`companies/${COMPANY_A}/accounting/Settings/voucherForms/form-x`).set({ name: 'attack' })
      );
    });
  });

  describe('Member access within own company', () => {
    it('allows member to read company settings', async () => {
      const db = dbFor(USER_IN_A);
      await testing.assertSucceeds(db.doc(`companies/${COMPANY_A}/accounting/Settings/voucherForms/form-1`).get());
    });

    it('allows member to write company settings', async () => {
      const db = dbFor(USER_IN_A);
      await testing.assertSucceeds(
        db.doc(`companies/${COMPANY_A}/accounting/Settings/voucherForms/form-2`).set({ name: 'New Form' })
      );
    });

    it('denies member writing directly to Data paths (backend-only)', async () => {
      const db = dbFor(USER_IN_A);
      await testing.assertFails(
        db.doc(`companies/${COMPANY_A}/accounting/Data/vouchers/v-attack`).set({ amount: 9999 })
      );
    });

    it('allows member to read Data paths', async () => {
      const db = dbFor(USER_IN_A);
      await testing.assertSucceeds(db.doc(`companies/${COMPANY_A}/accounting/Data/vouchers/v-1`).get());
    });
  });

  describe('system_metadata', () => {
    it('allows any auth user to read', async () => {
      const db = dbFor(USER_IN_A);
      await testing.assertSucceeds(db.doc('system_metadata/voucher_types/items/journal_entry').get());
    });

    it('denies auth user writing', async () => {
      const db = dbFor(USER_IN_A);
      await testing.assertFails(
        db.doc('system_metadata/voucher_types/items/journal_entry').set({ name: 'tampered' })
      );
    });
  });

  describe('Super admin bypass', () => {
    it('allows super admin to read across companies', async () => {
      const db = dbFor(SUPER_ADMIN);
      await testing.assertSucceeds(db.doc(`companies/${COMPANY_A}/accounting/Settings/voucherForms/form-1`).get());
      await testing.assertSucceeds(db.doc(`companies/${COMPANY_B}`).get());
    });

    it('allows super admin to write to Data paths', async () => {
      const db = dbFor(SUPER_ADMIN);
      await testing.assertSucceeds(
        db.doc(`companies/${COMPANY_A}/accounting/Data/vouchers/v-2`).set({ amount: 200 })
      );
    });
  });

  describe('Idempotency keys (private)', () => {
    it('denies regular member from reading idempotency_keys', async () => {
      const db = dbFor(USER_IN_A);
      await testing.assertFails(db.doc(`companies/${COMPANY_A}/idempotency_keys/some-key`).get());
    });
  });
});
