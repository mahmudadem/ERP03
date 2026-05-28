/**
 * verify-gl-tie.ts
 *
 * After seeding (seed-test-tenant.ts), posting the Opening Stock draft, and
 * creating a few Sales Invoices through the UI, run this to verify that the
 * Sales-side numbers tie to the GL ledger. If they tie, QA Findings #2 / #4
 * are SYCO data drift and not a code bug.
 *
 * Usage (from backend/):
 *   npx ts-node scripts/verify-gl-tie.ts --companyId <id>
 *
 * Checks:
 *   1. Σ POSTED SI grandTotalBase     == Σ ledger Debits to AR + Σ Cash receipts to AR
 *      (rough — total invoiced should equal cumulative AR DRs from SI posting)
 *   2. Σ POSTED SI outstandingAmountBase  == AR ledger balance (debits − credits)
 *   3. Σ POSTED SI subtotalBase       == Revenue ledger balance (credits − debits)
 *   4. Sales-tax credit on Tax account == Σ SI taxTotalBase
 *
 * Detection: same auto-detect logic as seed-test-tenant.ts.
 */

process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';

import admin from '../src/firebaseAdmin';

function parseArgs(): { companyId: string } {
  const argv = process.argv.slice(2);
  const idx = argv.indexOf('--companyId');
  const companyId = idx >= 0 ? argv[idx + 1] : undefined;
  if (!companyId) {
    console.error('ERROR: --companyId <id> is required');
    process.exit(1);
  }
  return { companyId };
}

type AccountRow = {
  id: string;
  code: string;
  name: string;
  classification: string;
  role?: string;
  active?: boolean;
};

async function loadAccounts(db: FirebaseFirestore.Firestore, companyId: string): Promise<AccountRow[]> {
  const snap = await db
    .collection('companies').doc(companyId)
    .collection('accounting').doc('Data')
    .collection('accounts').get();
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: data.id || d.id,
      code: data.code || '',
      name: data.name || '',
      classification: (data.classification || data.type || '').toString().toUpperCase(),
      role: data.role,
      active: data.active !== false,
    };
  });
}

function pickAccount(rows: AccountRow[], classification: string, patterns: RegExp[]): AccountRow | null {
  const candidates = rows.filter(
    (r) => r.active && (r.role || 'POSTING') === 'POSTING' && r.classification === classification,
  );
  for (const re of patterns) {
    const hit = candidates.find((r) => re.test(r.name) || re.test(r.code));
    if (hit) return hit;
  }
  return null;
}

function r2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function fmt(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function checkRow(label: string, lhs: number, rhs: number, lhsLabel: string, rhsLabel: string): void {
  const diff = r2(lhs - rhs);
  const ok = Math.abs(diff) < 0.01;
  const status = ok ? '✓' : '✗';
  console.log(`  ${status} ${label}`);
  console.log(`      ${lhsLabel.padEnd(30)} = ${fmt(lhs)}`);
  console.log(`      ${rhsLabel.padEnd(30)} = ${fmt(rhs)}`);
  if (!ok) {
    console.log(`      ${'DIFF'.padEnd(30)} = ${fmt(diff)} ⚠`);
  }
}

async function main() {
  const { companyId } = parseArgs();
  const db = admin.firestore();

  console.log(`\nverify-gl-tie — companyId=${companyId}\n`);

  // --- Accounts ---
  const rows = await loadAccounts(db, companyId);
  const ar       = pickAccount(rows, 'ASSET',     [/accounts?.receivable/i, /\breceivable\b/i]);
  const revenue  = pickAccount(rows, 'REVENUE',   [/sales\s*revenue/i, /\brevenue\b/i, /\bsales\b/i]);
  const tax      = pickAccount(rows, 'LIABILITY', [/sales\s*tax\s*payable/i, /\bvat\s*payable\b/i, /\btax\s*payable\b/i, /\bvat\b/i, /\btax\b/i]);
  if (!ar || !revenue || !tax) {
    console.error('ERROR: could not resolve AR, Revenue, or Tax account. Aborting.');
    process.exit(1);
  }
  console.log(`AR      = ${ar.code} ${ar.name}`);
  console.log(`Revenue = ${revenue.code} ${revenue.name}`);
  console.log(`Tax     = ${tax.code} ${tax.name}`);
  console.log('');

  // --- POSTED sales invoices ---
  const siSnap = await db
    .collection('companies').doc(companyId)
    .collection('sales').doc('Data').collection('sales_invoices')
    .where('status', '==', 'POSTED').get();

  let siGrand = 0;
  let siSubtotal = 0;
  let siTax = 0;
  let siOutstanding = 0;
  let siCount = 0;
  for (const d of siSnap.docs) {
    const data = d.data() as any;
    siCount++;
    siGrand       += Number(data.grandTotalBase || 0);
    siSubtotal    += Number(data.subtotalBase || 0);
    siTax         += Number(data.taxTotalBase || 0);
    siOutstanding += Number(data.outstandingAmountBase || 0);
  }
  console.log(`POSTED sales invoices: ${siCount}`);
  console.log(`  Σ grandTotalBase       = ${fmt(r2(siGrand))}`);
  console.log(`  Σ subtotalBase         = ${fmt(r2(siSubtotal))}`);
  console.log(`  Σ taxTotalBase         = ${fmt(r2(siTax))}`);
  console.log(`  Σ outstandingAmountBase = ${fmt(r2(siOutstanding))}`);
  console.log('');

  // --- Ledger balances per account ---
  const ledgerSnap = await db
    .collection('companies').doc(companyId)
    .collection('accounting').doc('Data').collection('ledger').get();

  const balance = new Map<string, { debit: number; credit: number }>();
  for (const d of ledgerSnap.docs) {
    const data = d.data() as any;
    const accId = data.accountId;
    if (!accId) continue;
    const cur = balance.get(accId) || { debit: 0, credit: 0 };
    cur.debit  += Number(data.debit || 0);
    cur.credit += Number(data.credit || 0);
    balance.set(accId, cur);
  }

  const arBal       = balance.get(ar.id) || { debit: 0, credit: 0 };
  const revenueBal  = balance.get(revenue.id) || { debit: 0, credit: 0 };
  const taxBal      = balance.get(tax.id) || { debit: 0, credit: 0 };

  const arNet      = r2(arBal.debit - arBal.credit);
  const revenueNet = r2(revenueBal.credit - revenueBal.debit);
  const taxNet     = r2(taxBal.credit - taxBal.debit);
  const arDebitsOnly = r2(arBal.debit);

  console.log(`Ledger entries: ${ledgerSnap.size}`);
  console.log(`  AR    debits=${fmt(arBal.debit)} credits=${fmt(arBal.credit)} net=${fmt(arNet)}`);
  console.log(`  Revenue debits=${fmt(revenueBal.debit)} credits=${fmt(revenueBal.credit)} net=${fmt(revenueNet)}`);
  console.log(`  Tax   debits=${fmt(taxBal.debit)} credits=${fmt(taxBal.credit)} net=${fmt(taxNet)}`);
  console.log('');

  // --- Tie checks ---
  console.log('Tie checks:');
  checkRow(
    'Σ SI grandTotalBase  ↔  Σ AR debits (invoice DRs)',
    r2(siGrand), arDebitsOnly,
    'Σ POSTED SI.grandTotalBase', 'AR ledger debits total',
  );
  checkRow(
    'Σ SI outstandingAmountBase  ↔  AR net balance',
    r2(siOutstanding), arNet,
    'Σ POSTED SI.outstandingAmountBase', 'AR ledger net (DR − CR)',
  );
  checkRow(
    'Σ SI subtotalBase  ↔  Revenue net balance',
    r2(siSubtotal), revenueNet,
    'Σ POSTED SI.subtotalBase', 'Revenue ledger net (CR − DR)',
  );
  checkRow(
    'Σ SI taxTotalBase  ↔  Tax net balance',
    r2(siTax), taxNet,
    'Σ POSTED SI.taxTotalBase', 'Tax ledger net (CR − DR)',
  );

  console.log('\n→ If all four ties pass: SYCO Findings #2 / #4 are SYCO data drift, not code bugs.');
  console.log('→ If any tie fails on this clean tenant: real bug — investigate before Sales QA sign-off.\n');
}

main().catch((err) => {
  console.error('\nFATAL:', err);
  process.exit(1);
});
