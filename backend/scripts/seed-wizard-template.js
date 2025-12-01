/**
 * Seeds a minimal company wizard template into the Firestore emulator.
 * Usage: cd backend && node scripts/seed-wizard-template.js
 */
const admin = require('firebase-admin');

const PROJECT_ID = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT || 'erp-03';
const FIRESTORE_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';

process.env.FIRESTORE_EMULATOR_HOST = FIRESTORE_HOST;

if (!admin.apps.length) {
  admin.initializeApp({ projectId: PROJECT_ID });
}

const db = admin.firestore();

async function seed() {
  const collection = db.collection('system_company_wizard_templates');
  const docId = 'default-wizard';

  const template = {
    id: docId,
    name: 'Default Wizard',
    models: ['default-model'],
    isDefault: true,
    steps: [
      {
        id: 'basic-info',
        titleEn: 'Basic Info',
        titleAr: 'معلومات أساسية',
        titleTr: 'Temel Bilgi',
        order: 1,
        modelKey: 'default-model',
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
        modelKey: 'default-model',
        fields: [
          { id: 'country', labelEn: 'Country', labelAr: 'الدولة', labelTr: 'Ülke', type: 'text', required: true },
          { id: 'city', labelEn: 'City', labelAr: 'المدينة', labelTr: 'Şehir', type: 'text', required: true },
        ],
      },
    ],
  };

  await collection.doc(docId).set(template, { merge: true });
  // eslint-disable-next-line no-console
  console.log(`Seeded template '${docId}' into system_company_wizard_templates (project: ${PROJECT_ID}, host: ${FIRESTORE_HOST}).`);
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Failed to seed wizard template', err);
    process.exit(1);
  });
