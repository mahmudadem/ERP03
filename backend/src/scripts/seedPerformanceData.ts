/**
 * seedPerformanceData.ts
 *
 * Seeds 1000 vouchers for a specific account (10201) to test performance.
 *
 * Usage:
 *   npx ts-node --project tsconfig.json src/scripts/seedPerformanceData.ts <companyId>
 */

process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'erp-03';

import * as admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

if (!admin.apps.length) {
  admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT });
}
const db = admin.firestore();

// ─── Helpers ─────────────────────────────────────────────────────────────────
function accountingCol(companyId: string, sub: string) {
  return db.collection('companies').doc(companyId)
    .collection('accounting').doc('Data').collection(sub);
}

function isoToTimestamp(iso: string) {
  // Use T12:00:00Z to avoid timezone issues shifting the day
  return Timestamp.fromDate(new Date(iso + 'T12:00:00Z'));
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const companyId = process.argv[2];
  if (!companyId) {
    console.error('Usage: npx ts-node ... seedPerformanceData.ts <companyId>');
    process.exit(1);
  }

  console.log(`\n📦 Seeding Performance Data for Company: ${companyId}`);
  console.log('─'.repeat(70));

  // 1. Get Accounts
  const accountSnap = await accountingCol(companyId, 'accounts').get();
  if (accountSnap.empty) {
    console.error('❌ No accounts found!');
    process.exit(1);
  }

  const accounts = accountSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
  
  // 2. Find target account (10201)
  const targetCode = '10201';
  const targetAccount = accounts.find(a => (a.userCode === targetCode || a.code === targetCode));

  if (!targetAccount) {
    console.error(`❌ Target account ${targetCode} not found!`);
    // Fallback: list first 5 accounts
    console.log('Available accounts:', accounts.slice(0, 5).map(a => a.userCode || a.code));
    process.exit(1);
  }

  console.log(`✅ Targeted Account: ${targetAccount.userCode || targetAccount.code} - ${targetAccount.name} (${targetAccount.id})`);

  // 3. Find contra account
  // Prefer Equity or Revenue, or just any other posting account
  const contraAccount = accounts.find(a => 
    a.id !== targetAccount.id && 
    (a.accountRole === 'POSTING' || !a.accountRole) && 
    (a.classification === 'EQUITY' || a.classification === 'REVENUE' || a.classification === 'LIABILITY')
  );

  if (!contraAccount) {
    console.error('❌ Could not find a suitable contra account!');
    process.exit(1);
  }

  console.log(`✅ Contra Account:   ${contraAccount.userCode || contraAccount.code} - ${contraAccount.name} (${contraAccount.id})`);

  // 4. Generate 1000 vouchers
  const vouchers = [];
  const TOTAL_RECORDS = 1000;
  const START_DATE = new Date('2026-01-01');
  
  console.log(`\n🚀 Generating ${TOTAL_RECORDS} vouchers...`);

  // Determine currency (assume base for simplicity, or target account's currency)
  const currency = targetAccount.currency || 'SYP'; // Fallback
  const exchangeRate = 1;

  for (let i = 0; i < TOTAL_RECORDS; i++) {
    // Distributed date: 10 per day
    const dayOffset = Math.floor(i / 10);
    const date = new Date(START_DATE);
    date.setDate(START_DATE.getDate() + dayOffset);
    const dateStr = date.toISOString().split('T')[0];

    // Amount
    const amount = 100 + (i % 500); // Varying amount
    
    // Lines
    const lines = [
      {
        accountId: targetAccount.id,
        side: 'Debit',
        amount: amount,
        currency: currency,
        exchangeRate: 1,
        baseAmount: amount,
        baseCurrency: currency
      },
      {
        accountId: contraAccount.id,
        side: 'Credit',
        amount: amount,
        currency: currency, // Assume contra supports same currency or handle FX (skipping complex FX for simplicity unless needed)
        exchangeRate: 1,
        baseAmount: amount,
        baseCurrency: currency
      }
    ];

    vouchers.push({
      date: dateStr,
      narration: `PERF_TEST_${i + 1}: Performance test entry`,
      lines
    });
  }

  // 5. Write to Firestore
  const voucherCol = accountingCol(companyId, 'vouchers');
  const ledgerCol  = accountingCol(companyId, 'ledger');

  console.log('Writing to Firestore (batched)...');

  // We write in chunks of 250 vouchers (500 ops: voucher + ledger entries? No, voucher + X ledger entries)
  // Firestore batch limit is 500.
  // Each voucher: 1 write (voucher doc).
  // Each ledger entry: 2 writes (ledger docs).
  // Total per voucher: 3 writes.
  // Safe batch size: 150 vouchers (450 writes).

  const BATCH_SIZE = 150;
  let processed = 0;

  for (let i = 0; i < vouchers.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = vouchers.slice(i, i + BATCH_SIZE);

    for (const v of chunk) {
      const idx = i + chunk.indexOf(v);
      const vId = `perf_v${(idx + 1).toString().padStart(4, '0')}`;
      const voucherNo = `PERF-${(idx + 1).toString().padStart(4, '0')}`;
      
      const totalDebit = v.lines.reduce((s, l) => s + (l.side === 'Debit' ? l.baseAmount : 0), 0);
      const totalCredit = v.lines.reduce((s, l) => s + (l.side === 'Credit' ? l.baseAmount : 0), 0);
      
      // Voucher Doc
      const voucherRef = voucherCol.doc(vId);
      batch.set(voucherRef, {
        id: vId,
        companyId,
        type: 'journal_entry',
        voucherNo,
        date: v.date,
        status: 'posted',
        narration: v.narration,
        currency: currency,
        baseCurrency: currency,
        exchangeRate: 1,
        totalDebit,
        totalCredit,
        lines: v.lines.map((l, lid) => ({
          id: lid + 1,
          accountId: l.accountId,
          side: l.side,
          amount: l.amount,
          baseAmount: l.baseAmount,
          currency: l.currency,
          baseCurrency: l.baseCurrency,
          exchangeRate: l.exchangeRate,
          notes: '',
          costCenterId: null,
          metadata: {}
        })),
        postedAt: new Date(v.date + 'T12:00:00Z').toISOString(),
        postedBy: 'perf-script',
        createdAt: new Date().toISOString(),
        createdBy: 'perf-script',
        updatedAt: new Date().toISOString(),
        metadata: { isPerformanceTest: true }
      });

      // Ledger Docs
      v.lines.forEach((l, lid) => {
        const ledgerId = `${vId}_${lid + 1}`;
        const ledgerRef = ledgerCol.doc(ledgerId);
        
        batch.set(ledgerRef, {
          id: ledgerId,
          companyId,
          accountId: l.accountId,
          voucherId: vId,
          voucherLineId: lid + 1,
          date: isoToTimestamp(v.date),
          debit: l.side === 'Debit' ? l.baseAmount : 0,
          credit: l.side === 'Credit' ? l.baseAmount : 0,
          currency: l.currency,
          amount: l.amount,
          baseCurrency: l.baseCurrency,
          baseAmount: l.baseAmount,
          exchangeRate: l.exchangeRate,
          side: l.side,
          notes: '',
          costCenterId: null,
          metadata: { isPerformanceTest: true },
          isPosted: true,
          createdAt: new Date().toISOString()
        });
      });
    }

    await batch.commit();
    processed += chunk.length;
    process.stdout.write(`\r✅ Committed ${processed}/${TOTAL_RECORDS} vouchers...`);
  }

  console.log('\n\nDone! 1000 records seeded.');
}

main().catch(console.error);
