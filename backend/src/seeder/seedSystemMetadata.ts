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
  { code: 'SYP', name: 'Syrian Pound', symbol: 'ل.س', locale: 'ar-SY', decimalPlaces: 2 },
  { code: 'LBP', name: 'Lebanese Pound', symbol: 'ل.ل', locale: 'ar-LB', decimalPlaces: 2 },
  { code: 'IQD', name: 'Iraqi Dinar', symbol: 'ع.د', locale: 'ar-IQ', decimalPlaces: 3 },
  { code: 'ILS', name: 'Israeli New Shekel', symbol: '₪', locale: 'he-IL', decimalPlaces: 2 },
  { code: 'DZD', name: 'Algerian Dinar', symbol: 'د.ج', locale: 'ar-DZ', decimalPlaces: 2 },
  { code: 'MAD', name: 'Moroccan Dirham', symbol: 'د.م.', locale: 'ar-MA', decimalPlaces: 2 },
  { code: 'TND', name: 'Tunisian Dinar', symbol: 'د.ت', locale: 'ar-TN', decimalPlaces: 3 },
  { code: 'LYD', name: 'Libyan Dinar', symbol: 'ل.د', locale: 'ar-LY', decimalPlaces: 3 },
  { code: 'SDG', name: 'Sudanese Pound', symbol: 'ج.س', locale: 'ar-SD', decimalPlaces: 2 },
  { code: 'YER', name: 'Yemeni Rial', symbol: 'ر.ي', locale: 'ar-YE', decimalPlaces: 2 },
  { code: 'SEK', name: 'Swedish Krona', symbol: 'kr', locale: 'sv-SE', decimalPlaces: 2 },
  { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr', locale: 'nb-NO', decimalPlaces: 2 },
  { code: 'DKK', name: 'Danish Krone', symbol: 'kr', locale: 'da-DK', decimalPlaces: 2 },
  { code: 'PLN', name: 'Polish Zloty', symbol: 'zł', locale: 'pl-PL', decimalPlaces: 2 },
  { code: 'KRW', name: 'South Korean Won', symbol: '₩', locale: 'ko-KR', decimalPlaces: 0 },
];

import {
  StandardCOA,
  SimplifiedCOA,
  ComprehensiveCOA,
  PeriodicTradingCOA,
  ArabicStandardCOA,
  ArabicPeriodicTradingCOA,
} from '../application/accounting/templates/COATemplates';
import { ManufacturingCOA, ServicesCOA, RetailCOA } from '../application/accounting/templates/IndustryCOATemplates';

const COA_TEMPLATES = [
  // Empty template — always first
  {
    id: 'empty',
    name: 'Empty – Start from Scratch',
    description: 'Blank canvas — add only the accounts you need',
    recommended: 'Best for: accountants migrating an existing chart from another system',
    accountCount: 0,
    complexity: 'custom',
    accounts: []
  },
  // Ordered by account count (ascending)
  {
    id: 'simplified',
    name: 'Simplified',
    description: 'Flat, minimal accounts — one level deep, no sub-accounts',
    recommended: 'Best for: freelancers, sole traders, and micro-businesses with simple books',
    accountCount: SimplifiedCOA.length,
    complexity: 'low',
    accounts: SimplifiedCOA
  },
  {
    id: 'services',
    name: 'Professional Services',
    description: 'Consulting fees, project revenue, contractor costs, client deposits',
    recommended: 'Best for: agencies, consultants, law firms, IT services, and project-based businesses',
    accountCount: ServicesCOA.length,
    complexity: 'low',
    accounts: ServicesCOA
  },
  {
    id: 'periodic_trading',
    name: 'Trading Company - Periodic',
    description: 'Simple trading books with Purchases and Sales accounts, no live inventory/COGS postings',
    recommended: 'Best for: small trading companies that want simple day-to-day entry with report-time inventory valuation',
    accountCount: PeriodicTradingCOA.length,
    complexity: 'medium',
    accounts: PeriodicTradingCOA
  },
  {
    id: 'periodic_trading_ar',
    name: 'شركة تجارية - نظام دوري',
    description: 'دليل حسابات عربي لشركة تجارية بسيطة مع حسابات مشتريات ومبيعات ومخزون دوري',
    recommended: 'مناسب للشركات التجارية الصغيرة التي تريد إدخالاً يومياً بسيطاً مع تقييم المخزون وقت التقارير',
    accountCount: ArabicPeriodicTradingCOA.length,
    complexity: 'medium',
    accounts: ArabicPeriodicTradingCOA
  },
  {
    id: 'standard',
    name: 'Standard (Recommended)',
    description: 'Multi-level accounts covering wholesale, retail, inventory, and tax',
    recommended: 'Best for: trading companies, distributors, and general SMBs — the most popular choice',
    accountCount: StandardCOA.length,
    complexity: 'medium',
    accounts: StandardCOA
  },
  {
    id: 'standard_ar',
    name: 'قياسي (موصى به)',
    description: 'دليل حسابات عربي متعدد المستويات يغطي المبيعات والمشتريات والمخزون والضرائب',
    recommended: 'مناسب للشركات التجارية والتوزيع والشركات الصغيرة والمتوسطة',
    accountCount: ArabicStandardCOA.length,
    complexity: 'medium',
    accounts: ArabicStandardCOA
  },
  {
    id: 'manufacturing',
    name: 'Manufacturing',
    description: 'Raw materials, WIP, finished goods, factory overhead, direct labor',
    recommended: 'Best for: factories, workshops, food production, and assembly businesses',
    accountCount: ManufacturingCOA.length,
    complexity: 'medium',
    accounts: ManufacturingCOA
  },
  {
    id: 'retail',
    name: 'Retail & E-Commerce',
    description: 'POS registers, online sales, shrinkage tracking, store expenses',
    recommended: 'Best for: shops, supermarkets, e-commerce stores, and multi-location retail',
    accountCount: RetailCOA.length,
    complexity: 'medium',
    accounts: RetailCOA
  },
  {
    id: 'full',
    name: 'Comprehensive',
    description: 'Enterprise-grade — fixed assets, depreciation, reserves, finance costs, and more',
    recommended: 'Best for: established enterprises, multi-department companies, and businesses preparing for audit',
    accountCount: ComprehensiveCOA.length,
    complexity: 'high',
    accounts: ComprehensiveCOA
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
