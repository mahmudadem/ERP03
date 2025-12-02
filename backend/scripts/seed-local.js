/**
 * Seeds the Firebase emulators with a minimal dataset for end-to-end local testing:
 * - Auth user with email/password
 * - Firestore user profile (global role USER) + activeCompanyId
 * - Company document with modules enabled
 * - Company role (admin) with wildcard permissions
 * - Company user membership (owner) pointing to the admin role
 * - Default company wizard template with two steps/fields
 *
 * Usage: from backend/ run `node scripts/seed-local.js`
 * Ensure emulators are running (auth @9099, firestore @8080).
 */
const admin = require('firebase-admin');

const PROJECT_ID = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT || 'erp-03';
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
const FIRESTORE_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';

process.env.FIREBASE_AUTH_EMULATOR_HOST = AUTH_HOST;
process.env.FIRESTORE_EMULATOR_HOST = FIRESTORE_HOST;

if (!admin.apps.length) {
  admin.initializeApp({ projectId: PROJECT_ID });
}

const auth = admin.auth();
const db = admin.firestore();
// Reuse compiled RBAC seeder to avoid duplicating permissions
let seedRbacData;
try {
  seedRbacData = require('../lib/backend/src/infrastructure/firestore/seeds/seedRbacData').seedRbacData;
} catch (e) {
  // eslint-disable-next-line no-console
  console.warn('Could not load compiled seedRbacData; run `npm run build` before seeding.');
}

async function seedAuthUser({ uid, email, password, displayName }) {
  try {
    await auth.getUser(uid);
    // eslint-disable-next-line no-console
    console.log(`Auth user ${uid} already exists`);
    return uid;
  } catch {
    const user = await auth.createUser({ uid, email, password, displayName, emailVerified: true });
    // eslint-disable-next-line no-console
    console.log(`Created auth user ${user.uid}`);
    return user.uid;
  }
}

async function seedUserProfile({ uid, email, name, activeCompanyId }) {
  const doc = {
    id: uid,
    email,
    name,
    globalRole: 'USER',
    createdAt: admin.firestore.Timestamp.fromDate(new Date()),
    activeCompanyId,
  };
  await db.collection('users').doc(uid).set(doc, { merge: true });
  // eslint-disable-next-line no-console
  console.log(`Seeded user profile ${uid} with activeCompanyId=${activeCompanyId}`);
}

async function seedCompany({ companyId, ownerId }) {
  const now = admin.firestore.Timestamp.fromDate(new Date());
  const company = {
    id: companyId,
    name: 'TechFlow Solutions',
    ownerId,
    baseCurrency: 'USD',
    fiscalYearStart: now,
    fiscalYearEnd: now,
    modules: ['core', 'inventory', 'accounting'],
    taxId: 'TAX-123',
    address: '123 Main St',
    createdAt: now,
    updatedAt: now,
  };
  await db.collection('companies').doc(companyId).set(company, { merge: true });
  // eslint-disable-next-line no-console
  console.log(`Seeded company ${companyId}`);
}

async function seedCompanyRole({ companyId, roleId, name, permissions }) {
  const role = {
    id: roleId,
    companyId,
    name,
    description: 'Seed admin role',
    permissions,
    resolvedPermissions: permissions,
    explicitPermissions: permissions,
    moduleBundles: ['accounting', 'inventory', 'hr', 'pos', 'sales', 'purchases'],
    isDefaultForNewUsers: true,
  };
  await db.collection('companies').doc(companyId).collection('roles').doc(roleId).set(role, { merge: true });
  // eslint-disable-next-line no-console
  console.log(`Seeded role ${roleId} for company ${companyId}`);
}

async function seedCompanyUser({ companyId, userId, roleId }) {
  const membership = {
    userId,
    companyId,
    roleId,
    isOwner: true,
    createdAt: admin.firestore.Timestamp.fromDate(new Date()),
  };
  await db.collection('companies').doc(companyId).collection('users').doc(userId).set(membership, { merge: true });
  // eslint-disable-next-line no-console
  console.log(`Seeded company user ${userId} in ${companyId} with role ${roleId}`);
}

async function seedWizardTemplate() {
  const docId = 'default-wizard';
  const models = ['financial', 'inventory', 'pos', 'manufacturing', 'hr'];
  const ref = db.collection('system_company_wizard_templates').doc(docId);
  // Clear any old template completely to avoid stale modelKey/model values
  await ref.delete();
  const template = {
    id: docId,
    name: 'Default Wizard',
    models,
    isDefault: true,
    steps: [
      {
        id: 'basic-info',
        titleEn: 'Basic Info',
        titleAr: 'معلومات أساسية',
        titleTr: 'Temel Bilgi',
        order: 1,
        modelKey: null,
        fields: [
          { id: 'companyName', labelEn: 'Company Name', labelAr: 'اسم الشركة', labelTr: 'Şirket Adı', type: 'text', required: true },
          { id: 'industry', labelEn: 'Industry', labelAr: 'الصناعة', labelTr: 'Sektör', type: 'text', required: false },
          { id: 'currency', labelEn: 'Currency', labelAr: 'العملة', labelTr: 'Para Birimi', type: 'text', required: true },
        ],
      },
      {
        id: 'address',
        titleEn: 'Address',
        titleAr: 'العنوان',
        titleTr: 'Adres',
        order: 2,
        modelKey: null,
        fields: [
          { id: 'country', labelEn: 'Country', labelAr: 'الدولة', labelTr: 'Ülke', type: 'text', required: false },
          { id: 'city', labelEn: 'City', labelAr: 'المدينة', labelTr: 'Şehir', type: 'text', required: false },
        ],
      },
    ],
  };
  await db.collection('system_company_wizard_templates').doc(docId).set(template, { merge: true });
  // eslint-disable-next-line no-console
  console.log(`Seeded wizard template ${docId}`);
}

async function seedCurrencies() {
  const currencies = [
    { id: 'USD', name: 'US Dollar' },
    { id: 'EUR', name: 'Euro' },
    { id: 'SAR', name: 'Saudi Riyal' },
    { id: 'AED', name: 'UAE Dirham' },
    { id: 'TRY', name: 'Turkish Lira' },
  ];
  for (const cur of currencies) {
    await db.collection('system_currencies').doc(cur.id).set(cur, { merge: true });
  }
  // eslint-disable-next-line no-console
  console.log(`Seeded ${currencies.length} currencies`);
}

async function seedChartOfAccountsTemplate() {
  const tpl = {
    id: 'basic-coa',
    name: 'Basic Chart of Accounts',
    description: 'Minimal COA for quick start',
  };
  await db.collection('chart_of_accounts_templates').doc(tpl.id).set(tpl, { merge: true });
  // eslint-disable-next-line no-console
  console.log('Seeded chart of accounts template basic-coa');
}

async function run() {
  const uid = 'seed-user';
  const email = 'seed@example.com';
  const password = 'Passw0rd!';
  const companyId = 'seed-company';
  const roleId = 'admin';

  // Super admin user
  const superUid = 'seed-superadmin';
  const superEmail = 'superadmin@example.com';
  const superPassword = 'SuperPass123!';

  await seedAuthUser({ uid, email, password, displayName: 'Seed User' });
  await seedCompany({ companyId, ownerId: uid });
  await seedCompanyRole({ companyId, roleId, name: 'Admin', permissions: ['*'] });
  await seedCompanyUser({ companyId, userId: uid, roleId });
  await seedUserProfile({ uid, email, name: 'Seed User', activeCompanyId: companyId });
  await seedWizardTemplate();
  await seedCurrencies();
  await seedChartOfAccountsTemplate();
  if (seedRbacData) {
    await seedRbacData();
  }

  // Seed super admin auth user + profile with globalRole SUPER_ADMIN
  await seedAuthUser({ uid: superUid, email: superEmail, password: superPassword, displayName: 'Seed Super Admin' });
  await auth.setCustomUserClaims(superUid, { globalRole: 'SUPER_ADMIN' });
  await db.collection('users').doc(superUid).set(
    {
      id: superUid,
      email: superEmail,
      name: 'Seed Super Admin',
      globalRole: 'SUPER_ADMIN',
      activeCompanyId: companyId,
      createdAt: admin.firestore.Timestamp.fromDate(new Date()),
    },
    { merge: true }
  );
  // Add super admin as a company user with admin role (wildcard perms)
  await seedCompanyUser({ companyId, userId: superUid, roleId });

  // eslint-disable-next-line no-console
  console.log('Seeding complete.');
  console.log('- Normal user: seed@example.com / Passw0rd!');
  console.log('- Super admin: superadmin@example.com / SuperPass123!');
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seeding failed', err);
    process.exit(1);
  });
