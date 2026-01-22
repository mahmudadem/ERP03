import { ISystemMetadataRepository } from '../infrastructure/repositories/FirestoreSystemMetadataRepository';

// ISO 4217 Currencies with correct decimal precision
const CURRENCIES = [
  { code: 'USD', name: 'US Dollar', symbol: '$', locale: 'en-US', decimalPlaces: 2 },
  { code: 'EUR', name: 'Euro', symbol: '€', locale: 'de-DE', decimalPlaces: 2 },
  { code: 'GBP', name: 'British Pound', symbol: '£', locale: 'en-GB', decimalPlaces: 2 },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', locale: 'ja-JP', decimalPlaces: 0 },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', locale: 'en-CA', decimalPlaces: 2 },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', locale: 'en-AU', decimalPlaces: 2 },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'Fr', locale: 'de-CH', decimalPlaces: 2 },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', locale: 'zh-CN', decimalPlaces: 2 },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹', locale: 'en-IN', decimalPlaces: 2 },
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', locale: 'ar-AE', decimalPlaces: 2 },
  { code: 'SAR', name: 'Saudi Riyal', symbol: 'ر.س', locale: 'ar-SA', decimalPlaces: 2 },
  { code: 'EGP', name: 'Egyptian Pound', symbol: 'E£', locale: 'ar-EG', decimalPlaces: 2 },
  { code: 'TRY', name: 'Turkish Lira', symbol: '₺', locale: 'tr-TR', decimalPlaces: 2 },
  { code: 'KWD', name: 'Kuwaiti Dinar', symbol: 'د.ك', locale: 'ar-KW', decimalPlaces: 3 },
  { code: 'BHD', name: 'Bahraini Dinar', symbol: '.د.ب', locale: 'ar-BH', decimalPlaces: 3 },
  { code: 'OMR', name: 'Omani Rial', symbol: 'ر.ع.', locale: 'ar-OM', decimalPlaces: 3 },
  { code: 'JOD', name: 'Jordanian Dinar', symbol: 'د.ا', locale: 'ar-JO', decimalPlaces: 3 },
  { code: 'QAR', name: 'Qatari Riyal', symbol: 'ر.ق', locale: 'ar-QA', decimalPlaces: 2 },
  { code: 'KRW', name: 'South Korean Won', symbol: '₩', locale: 'ko-KR', decimalPlaces: 0 },
  { code: 'SYP', name: 'Syrian Pound', symbol: 'ل.س', locale: 'ar-SY', decimalPlaces: 2 },
  { code: 'LBP', name: 'Lebanese Pound', symbol: 'ل.ل', locale: 'ar-LB', decimalPlaces: 2 },
  { code: 'IQD', name: 'Iraqi Dinar', symbol: 'ع.د', locale: 'ar-IQ', decimalPlaces: 3 },
  { code: 'BHD', name: 'Bahraini Dinar', symbol: 'د.ب', locale: 'ar-BH', decimalPlaces: 3 },
  { code: 'OMR', name: 'Omani Rial', symbol: 'ر.ع.', locale: 'ar-OM', decimalPlaces: 3 },
  { code: 'JOD', name: 'Jordanian Dinar', symbol: 'د.ا', locale: 'ar-JO', decimalPlaces: 3 },
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
