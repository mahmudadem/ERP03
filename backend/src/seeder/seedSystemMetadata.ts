import { ISystemMetadataRepository } from '../infrastructure/repositories/FirestoreSystemMetadataRepository';

const CURRENCIES = [
  { code: 'USD', name: 'US Dollar', symbol: '$', locale: 'en-US' },
  { code: 'EUR', name: 'Euro', symbol: '€', locale: 'de-DE' },
  { code: 'GBP', name: 'British Pound', symbol: '£', locale: 'en-GB' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', locale: 'ja-JP' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', locale: 'en-CA' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', locale: 'en-AU' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'Fr', locale: 'de-CH' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', locale: 'zh-CN' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹', locale: 'en-IN' },
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', locale: 'ar-AE' },
  { code: 'SAR', name: 'Saudi Riyal', symbol: 'ر.س', locale: 'ar-SA' },
  { code: 'EGP', name: 'Egyptian Pound', symbol: 'E£', locale: 'ar-EG' },
];

import { StandardCOA, SimplifiedCOA } from '../application/accounting/templates/COATemplates';
import { ManufacturingCOA, ServicesCOA, RetailCOA } from '../application/accounting/templates/IndustryCOATemplates';

const COA_TEMPLATES = [
  // Empty template - always first
  {
    id: 'empty',
    name: 'Empty - Start from Scratch',
    description: 'Build your own chart of accounts from the ground up',
    recommended: 'For businesses with unique accounting needs',
    accountCount: 0,
    complexity: 'custom',
    accounts: []
  },
  // Ordered by account count (ascending)
  {
    id: 'simplified',
    name: 'Simplified',
    description: 'Basic accounts for small businesses (20-30 accounts)',
    recommended: 'Ideal for startups and freelancers',
    accountCount: 25,
    complexity: 'low',
    accounts: SimplifiedCOA
  },
  {
    id: 'services',
    name: 'Professional Services',
    description: 'For consulting, agencies & service providers',
    recommended: 'Optimized for billable hours & projects',
    accountCount: 42,
    complexity: 'low',
    accounts: ServicesCOA
  },
  {
    id: 'manufacturing',
    name: 'Manufacturing',
    description: 'For production & manufacturing businesses',
    recommended: 'Includes WIP, Raw Materials, Factory Overhead',
    accountCount: 48,
    complexity: 'medium',
    accounts: ManufacturingCOA
  },
  {
    id: 'retail',
    name: 'Retail & E-Commerce',
    description: 'For retail stores and online businesses',
    recommended: 'Includes POS, inventory shrinkage tracking',
    accountCount: 52,
    complexity: 'medium',
    accounts: RetailCOA
  },
  {
    id: 'standard',
    name: 'Standard',
    description: 'Common business accounts (50-70 accounts)',
    recommended: 'Most popular for SMBs',
    accountCount: 60,
    complexity: 'medium',
    accounts: StandardCOA
  },
  {
    id: 'full',
    name: 'Comprehensive',
    description: 'Detailed accounts for complex operations (100+ accounts)',
    recommended: 'For established enterprises',
    accountCount: 120,
    complexity: 'high',
    accounts: StandardCOA // Placeholder: Using Standard for now until Full definition exists
  },
];

export async function seedSystemMetadata(repository: ISystemMetadataRepository) {
  console.log('📦 Seeding system metadata...');

  try {
    // Seed Currencies
    console.log('  💱 Seeding currencies...');
    await repository.setMetadata('currencies', CURRENCIES);
    console.log(`  ✅ Seeded ${CURRENCIES.length} currencies`);

    // Seed COA Templates
    console.log('  📊 Seeding COA templates...');
    await repository.setMetadata('coa_templates', COA_TEMPLATES);
    console.log(`  ✅ Seeded ${COA_TEMPLATES.length} COA templates`);

    console.log('✅ System metadata seeding complete!');
  } catch (error) {
    console.error('❌ Error seeding system metadata:', error);
    throw error;
  }
}
