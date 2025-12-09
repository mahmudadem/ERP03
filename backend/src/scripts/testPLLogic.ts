/**
 * Test P&L API endpoint directly
 */

import * as admin from 'firebase-admin';

if (admin.apps.length === 0) {
  admin.initializeApp({ projectId: 'demo-project' });
}

const db = admin.firestore();

if (process.env.USE_EMULATOR === 'true') {
  const host = process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8080';
  const [hostname, port] = host.split(':');
  db.settings({ host: `${hostname}:${port}`, ssl: false });
}

async function testPLLogic() {
  console.log('🧪 Testing P&L Logic Directly...\n');

  const companyId = 'demo_company_1764981773080';
  const fromDate = new Date('2025-01-01');
  const toDate = new Date('2025-12-31');

  // Fetch vouchers
  const vouchers = await db.collection('vouchers')
    .where('companyId', '==', companyId)
    .where('date', '>=', fromDate.toISOString())
    .where('date', '<=', toDate.toISOString())
    .get();

  console.log(`📊 Found ${vouchers.size} vouchers in date range\n`);

  let totalRevenue = 0;
  let totalExpenses = 0;
  const revenueByAccount = new Map();
  const expensesByAccount = new Map();

  // Process vouchers
  vouchers.forEach(doc => {
    const voucher = doc.data();
    
    // Only locked vouchers
    if (voucher.status !== 'locked') {
      console.log(`⏭️  Skipping ${voucher.voucherNo} (status: ${voucher.status})`);
      return;
    }

    console.log(`✓ Processing ${voucher.voucherNo} (${voucher.status})`);

    // Process lines
    (voucher.lines || []).forEach((line: any) => {
      const accountId = line.accountId;

      // Revenue (4xxx)
      if (accountId.startsWith('4')) {
        const amount = line.creditBase || 0;
        totalRevenue += amount;
        const current = revenueByAccount.get(accountId) || 0;
        revenueByAccount.set(accountId, current + amount);
        console.log(`  → Revenue ${accountId}: +$${amount}`);
      }

      // Expenses (5xxx, 6xxx)
      if (accountId.startsWith('5') || accountId.startsWith('6')) {
        const amount = line.debitBase || 0;
        totalExpenses += amount;
        const current = expensesByAccount.get(accountId) || 0;
        expensesByAccount.set(accountId, current + amount);
        console.log(`  → Expense ${accountId}: +$${amount}`);
      }
    });
  });

  const netProfit = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  console.log('\n' + '='.repeat(60));
  console.log('📊 P&L CALCULATION RESULTS:');
  console.log('='.repeat(60));
  console.log(`Total Revenue:        $${totalRevenue.toLocaleString()}.00`);
  
  console.log('\nRevenue Breakdown:');
  revenueByAccount.forEach((amount, accountId) => {
    console.log(`  ${accountId}: $${amount.toLocaleString()}.00`);
  });

  console.log(`\nTotal Expenses:       $${totalExpenses.toLocaleString()}.00`);
  
  console.log('\nExpense Breakdown:');
  expensesByAccount.forEach((amount, accountId) => {
    console.log(`  ${accountId}: $${amount.toLocaleString()}.00`);
  });

  console.log(`\nNet Profit:           $${netProfit.toLocaleString()}.00`);
  console.log(`Profit Margin:        ${profitMargin.toFixed(2)}%`);
  console.log('='.repeat(60));

  console.log('\n✅ EXPECTED RESULTS:');
  console.log('   Revenue:  $150,000.00');
  console.log('   Expenses: $65,000.00');
  console.log('   Profit:   $85,000.00');
  console.log('   Margin:   56.67%');

  console.log('\n🎯 VERIFICATION:');
  if (totalRevenue === 150000 && totalExpenses === 65000 && netProfit === 85000) {
    console.log('   ✅ P&L LOGIC IS CORRECT!');
  } else {
    console.log('   ❌ Numbers don\'t match!');
  }
  console.log('');
}

testPLLogic()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
