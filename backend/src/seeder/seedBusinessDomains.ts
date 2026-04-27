/**
 * seedBusinessDomains.ts
 * Seeds business domains to Firestore
 */

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.GCLOUD_PROJECT = 'erp-03';

import admin from '../firebaseAdmin';

const db = admin.firestore();

const BUSINESS_DOMAINS = [
  { id: 'trading', name: 'Trading', description: 'General trading and wholesale' },
  { id: 'retail', name: 'Retail', description: 'Retail shops and POS' },
  { id: 'services', name: 'Services', description: 'IT, consulting, maintenance services' },
  { id: 'hospitality', name: 'Hospitality', description: 'Restaurants, hotels, cafes' },
  { id: 'manufacturing', name: 'Manufacturing', description: 'Factories and production' },
  { id: 'construction', name: 'Construction', description: 'Contractors and builders' },
  { id: 'real-estate', name: 'Real Estate', description: 'Property brokers and agencies' },
  { id: 'education', name: 'Education', description: 'Training centers and schools' },
  { id: 'healthcare', name: 'Healthcare', description: 'Clinics and medical practices' },
  { id: 'logistics', name: 'Logistics', description: 'Transportation and delivery' },
  { id: 'ecommerce', name: 'E-Commerce', description: 'Online sellers' },
  { id: 'nonprofit', name: 'Non-Profit', description: 'NGOs and charities' },
  { id: 'distribution', name: 'Distribution', description: 'Wholesale distribution' },
];

async function seed() {
  console.log('📦 Seeding Business Domains...');
  const collection = db.collection('system_metadata').doc('business_domains').collection('items');
  
  for (const domain of BUSINESS_DOMAINS) {
    await collection.doc(domain.id).set({
      ...domain,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    console.log(`  ✓ ${domain.name}`);
  }
  
  console.log('✅ Business Domains seeding complete!');
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Error:', err);
    process.exit(1);
  });