"use strict";
/**
 * Seed test vouchers for P&L Report testing
 * Creates sample revenue and expense vouchers with known amounts
 * to verify P&L calculations are correct
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const admin = __importStar(require("firebase-admin"));
// Initialize if not already done
if (admin.apps.length === 0) {
    admin.initializeApp();
}
const db = admin.firestore();
// Configure emulator if needed
if (process.env.USE_EMULATOR === 'true') {
    const host = process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8080';
    const [hostname, port] = host.split(':');
    db.settings({
        host: `${hostname}:${port}`,
        ssl: false
    });
    console.log(`🔧 Using Firestore Emulator at ${host}`);
}
async function seedPLTestData() {
    console.log('🌱 Starting P&L Test Data Seeder...\n');
    // Use the specific company ID
    const companyId = 'demo_company_1764981773080';
    console.log(`📦 Company ID: ${companyId}\n`);
    // Get a user ID for createdBy field
    const usersSnapshot = await db.collection('users').limit(1).get();
    const userId = usersSnapshot.empty ? 'system' : usersSnapshot.docs[0].id;
    const testVouchers = [
        // === REVENUE VOUCHERS ===
        {
            id: 'pl_test_rev_001',
            companyId,
            type: 'RECEIPT',
            voucherNo: 'REC-2025-001',
            date: '2025-01-15T00:00:00.000Z',
            currency: 'USD',
            baseCurrency: 'USD',
            exchangeRate: 1,
            status: 'locked',
            totalDebit: 0,
            totalCredit: 50000,
            totalDebitBase: 0,
            totalCreditBase: 50000,
            createdBy: userId,
            approvedBy: userId,
            lockedBy: userId,
            reference: 'Sales Revenue - January',
            description: 'Product sales for January 2025',
            createdAt: new Date('2025-01-15'),
            updatedAt: new Date('2025-01-15'),
            lines: [
                {
                    id: 'line_rev_001_01',
                    accountId: '4000',
                    description: 'Product Sales',
                    debitFx: 0,
                    creditFx: 50000,
                    debitBase: 0,
                    creditBase: 50000,
                    lineCurrency: 'USD',
                    exchangeRate: 1,
                    costCenterId: null
                }
            ]
        },
        {
            id: 'pl_test_rev_002',
            companyId,
            type: 'RECEIPT',
            voucherNo: 'REC-2025-002',
            date: '2025-02-10T00:00:00.000Z',
            currency: 'USD',
            baseCurrency: 'USD',
            exchangeRate: 1,
            status: 'locked',
            totalDebit: 0,
            totalCredit: 75000,
            totalDebitBase: 0,
            totalCreditBase: 75000,
            createdBy: userId,
            approvedBy: userId,
            lockedBy: userId,
            reference: 'Sales Revenue - February',
            description: 'Service revenue for February 2025',
            createdAt: new Date('2025-02-10'),
            updatedAt: new Date('2025-02-10'),
            lines: [
                {
                    id: 'line_rev_002_01',
                    accountId: '4100',
                    description: 'Service Revenue',
                    debitFx: 0,
                    creditFx: 75000,
                    debitBase: 0,
                    creditBase: 75000,
                    lineCurrency: 'USD',
                    exchangeRate: 1,
                    costCenterId: null
                }
            ]
        },
        {
            id: 'pl_test_rev_003',
            companyId,
            type: 'RECEIPT',
            voucherNo: 'REC-2025-003',
            date: '2025-03-20T00:00:00.000Z',
            currency: 'USD',
            baseCurrency: 'USD',
            exchangeRate: 1,
            status: 'locked',
            totalDebit: 0,
            totalCredit: 25000,
            totalDebitBase: 0,
            totalCreditBase: 25000,
            createdBy: userId,
            approvedBy: userId,
            lockedBy: userId,
            reference: 'Other Income',
            description: 'Interest and other income',
            createdAt: new Date('2025-03-20'),
            updatedAt: new Date('2025-03-20'),
            lines: [
                {
                    id: 'line_rev_003_01',
                    accountId: '4900',
                    description: 'Other Income',
                    debitFx: 0,
                    creditFx: 25000,
                    debitBase: 0,
                    creditBase: 25000,
                    lineCurrency: 'USD',
                    exchangeRate: 1,
                    costCenterId: null
                }
            ]
        },
        // === EXPENSE VOUCHERS ===
        {
            id: 'pl_test_exp_001',
            companyId,
            type: 'PAYMENT',
            voucherNo: 'PAY-2025-001',
            date: '2025-01-20T00:00:00.000Z',
            currency: 'USD',
            baseCurrency: 'USD',
            exchangeRate: 1,
            status: 'locked',
            totalDebit: 30000,
            totalCredit: 0,
            totalDebitBase: 30000,
            totalCreditBase: 0,
            createdBy: userId,
            approvedBy: userId,
            lockedBy: userId,
            reference: 'COGS - January',
            description: 'Cost of goods sold',
            createdAt: new Date('2025-01-20'),
            updatedAt: new Date('2025-01-20'),
            lines: [
                {
                    id: 'line_exp_001_01',
                    accountId: '5000',
                    description: 'Cost of Goods Sold',
                    debitFx: 30000,
                    creditFx: 0,
                    debitBase: 30000,
                    creditBase: 0,
                    lineCurrency: 'USD',
                    exchangeRate: 1,
                    costCenterId: null
                }
            ]
        },
        {
            id: 'pl_test_exp_002',
            companyId,
            type: 'PAYMENT',
            voucherNo: 'PAY-2025-002',
            date: '2025-02-05T00:00:00.000Z',
            currency: 'USD',
            baseCurrency: 'USD',
            exchangeRate: 1,
            status: 'locked',
            totalDebit: 15000,
            totalCredit: 0,
            totalDebitBase: 15000,
            totalCreditBase: 0,
            createdBy: userId,
            approvedBy: userId,
            lockedBy: userId,
            reference: 'Salaries - February',
            description: 'Employee salaries',
            createdAt: new Date('2025-02-05'),
            updatedAt: new Date('2025-02-05'),
            lines: [
                {
                    id: 'line_exp_002_01',
                    accountId: '6000',
                    description: 'Salaries Expense',
                    debitFx: 15000,
                    creditFx: 0,
                    debitBase: 15000,
                    creditBase: 0,
                    lineCurrency: 'USD',
                    exchangeRate: 1,
                    costCenterId: null
                }
            ]
        },
        {
            id: 'pl_test_exp_003',
            companyId,
            type: 'PAYMENT',
            voucherNo: 'PAY-2025-003',
            date: '2025-02-15T00:00:00.000Z',
            currency: 'USD',
            baseCurrency: 'USD',
            exchangeRate: 1,
            status: 'locked',
            totalDebit: 8000,
            totalCredit: 0,
            totalDebitBase: 8000,
            totalCreditBase: 0,
            createdBy: userId,
            approvedBy: userId,
            lockedBy: userId,
            reference: 'Rent Expense',
            description: 'Office rent for February',
            createdAt: new Date('2025-02-15'),
            updatedAt: new Date('2025-02-15'),
            lines: [
                {
                    id: 'line_exp_003_01',
                    accountId: '6100',
                    description: 'Rent Expense',
                    debitFx: 8000,
                    creditFx: 0,
                    debitBase: 8000,
                    creditBase: 0,
                    lineCurrency: 'USD',
                    exchangeRate: 1,
                    costCenterId: null
                }
            ]
        },
        {
            id: 'pl_test_exp_004',
            companyId,
            type: 'PAYMENT',
            voucherNo: 'PAY-2025-004',
            date: '2025-03-10T00:00:00.000Z',
            currency: 'USD',
            baseCurrency: 'USD',
            exchangeRate: 1,
            status: 'locked',
            totalDebit: 12000,
            totalCredit: 0,
            totalDebitBase: 12000,
            totalCreditBase: 0,
            createdBy: userId,
            approvedBy: userId,
            lockedBy: userId,
            reference: 'Marketing Expense',
            description: 'Marketing and advertising',
            createdAt: new Date('2025-03-10'),
            updatedAt: new Date('2025-03-10'),
            lines: [
                {
                    id: 'line_exp_004_01',
                    accountId: '6200',
                    description: 'Marketing Expense',
                    debitFx: 12000,
                    creditFx: 0,
                    debitBase: 12000,
                    creditBase: 0,
                    lineCurrency: 'USD',
                    exchangeRate: 1,
                    costCenterId: null
                }
            ]
        },
        // === DRAFT VOUCHER (Should NOT be included in P&L) ===
        {
            id: 'pl_test_draft_001',
            companyId,
            type: 'RECEIPT',
            voucherNo: 'DRAFT-001',
            date: '2025-01-25T00:00:00.000Z',
            currency: 'USD',
            baseCurrency: 'USD',
            exchangeRate: 1,
            status: 'draft',
            totalDebit: 0,
            totalCredit: 100000,
            totalDebitBase: 0,
            totalCreditBase: 100000,
            createdBy: userId,
            approvedBy: null,
            lockedBy: null,
            reference: 'Draft Revenue - Should NOT count',
            description: 'This is a draft voucher and should not appear in P&L',
            createdAt: new Date('2025-01-25'),
            updatedAt: new Date('2025-01-25'),
            lines: [
                {
                    id: 'line_draft_001_01',
                    accountId: '4000',
                    description: 'Draft Sales',
                    debitFx: 0,
                    creditFx: 100000,
                    debitBase: 0,
                    creditBase: 100000,
                    lineCurrency: 'USD',
                    exchangeRate: 1,
                    costCenterId: null
                }
            ]
        }
    ];
    console.log('💾 Creating test vouchers...\n');
    for (const voucher of testVouchers) {
        // Seed into company subcollection
        await db.collection('companies')
            .doc(companyId)
            .collection('vouchers')
            .doc(voucher.id)
            .set(voucher);
        console.log(`  ✓ ${voucher.status === 'locked' ? '🔒' : '📝'} ${voucher.voucherNo}: ${voucher.description} (${voucher.sourceModule || 'accounting'})`);
    }
    console.log('\n✅ Test data seeded successfully!\n');
    // Print expected P&L results
    console.log('📊 EXPECTED P&L RESULTS:\n');
    console.log('='.repeat(50));
    const totalRevenue = 50000 + 75000 + 25000; // 150,000
    const totalExpenses = 30000 + 15000 + 8000 + 12000; // 65,000
    const netProfit = totalRevenue - totalExpenses; // 85,000
    const profitMargin = (netProfit / totalRevenue) * 100; // 56.67%
    console.log(`Total Revenue:        $${totalRevenue.toLocaleString()}.00`);
    console.log(`  - Product Sales (4000):  $50,000.00`);
    console.log(`  - Service Revenue (4100): $75,000.00`);
    console.log(`  - Other Income (4900):    $25,000.00`);
    console.log('');
    console.log(`Total Expenses:       $${totalExpenses.toLocaleString()}.00`);
    console.log(`  - COGS (5000):          $30,000.00`);
    console.log(`  - Salaries (6000):      $15,000.00`);
    console.log(`  - Rent (6100):          $8,000.00`);
    console.log(`  - Marketing (6200):     $12,000.00`);
    console.log('');
    console.log(`Net Profit:           $${netProfit.toLocaleString()}.00`);
    console.log(`Profit Margin:        ${profitMargin.toFixed(2)}%`);
    console.log('='.repeat(50));
    console.log('\n📝 NOTE: Draft voucher ($100,000) should NOT be included\n');
    console.log('🧪 TEST SCENARIOS:\n');
    console.log('1. Full Year (2025-01-01 to 2025-12-31):');
    console.log('   Revenue: $150,000 | Expenses: $65,000 | Profit: $85,000\n');
    console.log('2. Q1 Only (2025-01-01 to 2025-03-31):');
    console.log('   Revenue: $150,000 | Expenses: $65,000 | Profit: $85,000\n');
    console.log('3. January Only (2025-01-01 to 2025-01-31):');
    console.log('   Revenue: $50,000 | Expenses: $30,000 | Profit: $20,000\n');
    console.log('4. February Only (2025-02-01 to 2025-02-28):');
    console.log('   Revenue: $75,000 | Expenses: $23,000 | Profit: $52,000\n');
    console.log('✅ Ready to test P&L report!\n');
}
// Run the seeder
seedPLTestData()
    .then(() => {
    console.log('🎉 Seeding completed successfully!');
    process.exit(0);
})
    .catch((error) => {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
});
//# sourceMappingURL=seedPLTestData.js.map