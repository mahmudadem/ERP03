/**
 * Seed test vouchers for P&L Report testing
 * Creates sample revenue and expense vouchers with known amounts
 * to verify P&L calculations are correct
 */

import * as admin from 'firebase-admin';

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

interface TestVoucher {
  id: string;
  companyId: string;
  type: string;
  voucherNo: string;
  date: string;
  currency: string;
  baseCurrency: string;
  exchangeRate: number;
  status: string;
  totalDebit: number;
  totalCredit: number;
  totalDebitBase: number;
  totalCreditBase: number;
  createdBy: string;
  approvedBy: string | null;
  lockedBy: string | null;
  reference: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
  sourceModule?: string; // Track which module created this voucher
  lines: Array<{
    id: string;
    accountId: string;
    description: string;
    debitFx: number;
    creditFx: number;
    debitBase: number;
    creditBase: number;
    lineCurrency: string;
    exchangeRate: number;
    costCenterId: string | null;
  }>;
}

async function seedPLTestData() {
  console.log('🌱 Starting P&L Test Data Seeder...\n');

  // Use the specific company ID
  const companyId = 'demo_company_1764981773080';
  console.log(`📦 Company ID: ${companyId}\n`);

  // Get a user ID for createdBy field
  const usersSnapshot = await db.collection('users').limit(1).get();
  const userId = usersSnapshot.empty ? 'system' : usersSnapshot.docs[0].id;

  const testVouchers: TestVoucher[] = [
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
      totalCredit: 99999,
      totalDebitBase: 0,
      totalCreditBase: 99999,
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
          creditFx: 99999,
          debitBase: 0,
          creditBase: 99999,
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
      totalCredit: 88888,
      totalDebitBase: 0,
      totalCreditBase: 88888,
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
          creditFx: 88888,
          debitBase: 0,
          creditBase: 88888,
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
      totalCredit: 77777,
      totalDebitBase: 0,
      totalCreditBase: 77777,
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
          creditFx: 77777,
          debitBase: 0,
          creditBase: 77777,
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
      totalDebit: 11111,
      totalCredit: 0,
      totalDebitBase: 11111,
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
          debitFx: 11111,
          creditFx: 0,
          debitBase: 11111,
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
      totalDebit: 22222,
      totalCredit: 0,
      totalDebitBase: 22222,
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
          debitFx: 22222,
          creditFx: 0,
          debitBase: 22222,
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
      totalDebit: 33333,
      totalCredit: 0,
      totalDebitBase: 33333,
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
          debitFx: 33333,
          creditFx: 0,
          debitBase: 33333,
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
      totalDebit: 44444,
      totalCredit: 0,
      totalDebitBase: 44444,
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
          debitFx: 44444,
          creditFx: 0,
          debitBase: 44444,
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
      status: 'draft', // NOT locked - should be excluded
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
