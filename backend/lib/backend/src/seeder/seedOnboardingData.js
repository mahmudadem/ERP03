"use strict";
/**
 * seedOnboardingData.ts
 *
 * Purpose: Seeds plans and bundles to the database for onboarding.
 * Run this script to populate initial data.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const firebaseAdmin_1 = __importDefault(require("../firebaseAdmin"));
const db = firebaseAdmin_1.default.firestore();
// Plans from UI design
const PLANS = [
    {
        id: 'free',
        name: 'Free Trial',
        description: 'Full access to all features for 14 days.',
        price: 0,
        status: 'active',
        limits: {
            maxCompanies: 1,
            maxUsersPerCompany: 1,
            maxModulesAllowed: 999,
            maxStorageMB: 100,
            maxTransactionsPerMonth: 100,
        },
    },
    {
        id: 'starter',
        name: 'Starter',
        description: 'Great for individuals and small teams.',
        price: 9,
        status: 'active',
        limits: {
            maxCompanies: 1,
            maxUsersPerCompany: 1,
            maxModulesAllowed: 2,
            maxStorageMB: 500,
            maxTransactionsPerMonth: 500,
        },
    },
    {
        id: 'advanced',
        name: 'Advanced',
        description: 'For growing businesses needing more flexibility.',
        price: 39,
        status: 'active',
        limits: {
            maxCompanies: 3,
            maxUsersPerCompany: 5,
            maxModulesAllowed: 5,
            maxStorageMB: 2000,
            maxTransactionsPerMonth: 2000,
        },
    },
    {
        id: 'business',
        name: 'Business',
        description: 'For established companies with larger teams.',
        price: 99,
        status: 'active',
        limits: {
            maxCompanies: 10,
            maxUsersPerCompany: 20,
            maxModulesAllowed: 999,
            maxStorageMB: 10000,
            maxTransactionsPerMonth: 10000,
        },
    },
    {
        id: 'enterprise',
        name: 'Enterprise',
        description: 'Custom SLA, dedicated infra, and full-scale deployment.',
        price: 999,
        status: 'active',
        limits: {
            maxCompanies: 999,
            maxUsersPerCompany: 999,
            maxModulesAllowed: 999,
            maxStorageMB: 100000,
            maxTransactionsPerMonth: 100000,
        },
    },
];
// Bundles from UI design (company wizard types.ts)
const BUNDLES = [
    {
        id: 'trading-basic',
        name: 'General Trading',
        description: 'Suitable for normal trading companies.',
        businessDomains: ['trading'],
        modulesIncluded: ['accounting', 'inventory'],
    },
    {
        id: 'trading-plus',
        name: 'General Trading +',
        description: 'Trading company with HR support.',
        businessDomains: ['trading'],
        modulesIncluded: ['accounting', 'inventory', 'hr'],
    },
    {
        id: 'retail-pos',
        name: 'Retail / POS',
        description: 'For retail shops and supermarkets.',
        businessDomains: ['retail'],
        modulesIncluded: ['pos', 'inventory', 'accounting'],
    },
    {
        id: 'wholesale',
        name: 'Wholesale Trading',
        description: 'For wholesalers and distribution companies.',
        businessDomains: ['trading', 'distribution'],
        modulesIncluded: ['inventory', 'crm', 'accounting', 'purchase'],
    },
    {
        id: 'services',
        name: 'Services Company',
        description: 'For IT, consulting, maintenance, etc.',
        businessDomains: ['services'],
        modulesIncluded: ['crm', 'hr', 'accounting'],
    },
    {
        id: 'restaurant',
        name: 'Restaurant',
        description: 'POS + Inventory + HR for restaurants.',
        businessDomains: ['hospitality'],
        modulesIncluded: ['pos', 'inventory', 'hr', 'accounting'],
    },
    {
        id: 'bakery',
        name: 'Bakery / Food Production',
        description: 'Suitable for bakeries and food factories.',
        businessDomains: ['manufacturing', 'hospitality'],
        modulesIncluded: ['pos', 'inventory', 'manufacturing', 'accounting'],
    },
    {
        id: 'maintenance',
        name: 'Maintenance Workshop',
        description: 'Workshops handling repairs and service orders.',
        businessDomains: ['services'],
        modulesIncluded: ['crm', 'inventory', 'accounting'],
    },
    {
        id: 'manufacturing-basic',
        name: 'Manufacturing – Basic',
        description: 'For small manufacturers.',
        businessDomains: ['manufacturing'],
        modulesIncluded: ['inventory', 'manufacturing', 'accounting'],
    },
    {
        id: 'manufacturing-advanced',
        name: 'Manufacturing – Advanced',
        description: 'For medium and large factories.',
        businessDomains: ['manufacturing'],
        modulesIncluded: ['inventory', 'manufacturing', 'accounting', 'hr', 'purchase'],
    },
    {
        id: 'construction',
        name: 'Construction / Contracting',
        description: 'Contractors, builders, and project companies.',
        businessDomains: ['construction'],
        modulesIncluded: ['projects', 'accounting', 'hr', 'inventory'],
    },
    {
        id: 'real-estate',
        name: 'Real Estate Agency',
        description: 'Real estate brokers and agencies.',
        businessDomains: ['real-estate'],
        modulesIncluded: ['crm', 'accounting'],
    },
    {
        id: 'education',
        name: 'Education / Training Center',
        description: 'Training institutes and educational centers.',
        businessDomains: ['education'],
        modulesIncluded: ['crm', 'hr', 'accounting'],
    },
    {
        id: 'clinic',
        name: 'Clinic / Medical Office',
        description: 'Small medical practices.',
        businessDomains: ['healthcare'],
        modulesIncluded: ['crm', 'inventory', 'hr', 'accounting'],
    },
    {
        id: 'logistics',
        name: 'Logistics & Transportation',
        description: 'Transport, delivery, and logistics services.',
        businessDomains: ['logistics'],
        modulesIncluded: ['accounting', 'hr', 'crm'],
    },
    {
        id: 'ecommerce',
        name: 'E-Commerce Seller',
        description: 'Online sellers and marketplace merchants.',
        businessDomains: ['retail', 'ecommerce'],
        modulesIncluded: ['inventory', 'crm', 'accounting'],
    },
    {
        id: 'freelancer',
        name: 'Freelancer / Solo Entrepreneur',
        description: 'For individual freelancers.',
        businessDomains: ['services'],
        modulesIncluded: ['accounting', 'crm'],
    },
    {
        id: 'nonprofit',
        name: 'Non-Profit Organization',
        description: 'For NGOs and non-profit entities.',
        businessDomains: ['nonprofit'],
        modulesIncluded: ['accounting', 'crm', 'hr'],
    },
    {
        id: 'salon',
        name: 'Beauty Salon & Spa',
        description: 'For salons, spas, and beauty centers.',
        businessDomains: ['services', 'retail'],
        modulesIncluded: ['pos', 'inventory', 'hr'],
    },
    {
        id: 'empty-company',
        name: 'Empty Company',
        description: 'Start with no modules and configure manually.',
        businessDomains: [],
        modulesIncluded: [],
    },
];
async function seedPlans() {
    console.log('📦 Seeding Plans...');
    const plansCollection = db.collection('system_metadata').doc('plans').collection('items');
    for (const plan of PLANS) {
        await plansCollection.doc(plan.id).set(Object.assign(Object.assign({}, plan), { createdAt: firebaseAdmin_1.default.firestore.FieldValue.serverTimestamp(), updatedAt: firebaseAdmin_1.default.firestore.FieldValue.serverTimestamp() }));
        console.log(`  ✓ Plan: ${plan.name}`);
    }
    console.log(`\n✅ ${PLANS.length} plans seeded.\n`);
}
async function seedBundles() {
    console.log('📦 Seeding Bundles...');
    const bundlesCollection = db.collection('system_metadata').doc('bundles').collection('items');
    for (const bundle of BUNDLES) {
        await bundlesCollection.doc(bundle.id).set(Object.assign(Object.assign({}, bundle), { createdAt: firebaseAdmin_1.default.firestore.FieldValue.serverTimestamp(), updatedAt: firebaseAdmin_1.default.firestore.FieldValue.serverTimestamp() }));
        console.log(`  ✓ Bundle: ${bundle.name}`);
    }
    console.log(`\n✅ ${BUNDLES.length} bundles seeded.\n`);
}
async function main() {
    console.log('\n🌱 Seeding Onboarding Data...\n');
    try {
        await seedPlans();
        await seedBundles();
        console.log('🎉 All onboarding data seeded successfully!\n');
    }
    catch (error) {
        console.error('❌ Error seeding data:', error);
        process.exit(1);
    }
}
// Run if called directly
main();
//# sourceMappingURL=seedOnboardingData.js.map