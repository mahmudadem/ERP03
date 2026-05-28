/**
 * Wipes all transactional data from a test tenant, preserving master data.
 *
 * Deletes:
 *   - All ledger entries
 *   - All vouchers
 *   - All stock movements
 *   - All stock levels
 *   - All opening_stock_documents (DRAFT + POSTED)
 *   - All sales_invoices, sales_orders, delivery_notes, sales_returns
 *   - All purchase_invoices, purchase_orders, goods_receipts, purchase_returns
 *   - All payment_history
 *
 * Keeps:
 *   - Company doc
 *   - COA accounts
 *   - Items, parties, warehouses, tax codes, settings
 *   - Module activations, roles, users
 *
 * Use only on disposable test tenants.
 */

process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';

import admin from '../src/firebaseAdmin';

const COMPANY_ID = process.argv[2];
if (!COMPANY_ID) {
  console.error('Usage: ts-node scripts/_reset_transactional_data.ts <companyId>');
  process.exit(1);
}

const PATHS_TO_WIPE: Array<{ label: string; path: string[] }> = [
  // Accounting transactional
  { label: 'ledger', path: ['companies', COMPANY_ID, 'accounting', 'Data', 'ledger'] },
  { label: 'vouchers (accounting/Data)', path: ['companies', COMPANY_ID, 'accounting', 'Data', 'vouchers'] },
  { label: 'vouchers (legacy)', path: ['companies', COMPANY_ID, 'vouchers'] },
  { label: 'voucherSequences', path: ['companies', COMPANY_ID, 'accounting', 'Data', 'voucherSequences'] },
  { label: 'posting_logs', path: ['companies', COMPANY_ID, 'posting_logs'] },

  // Inventory transactional
  { label: 'stock_movements', path: ['companies', COMPANY_ID, 'inventory', 'Data', 'stock_movements'] },
  { label: 'stock_levels', path: ['companies', COMPANY_ID, 'inventory', 'Data', 'stock_levels'] },
  { label: 'opening_stock_documents', path: ['companies', COMPANY_ID, 'inventory', 'Data', 'opening_stock_documents'] },
  { label: 'stock_adjustments', path: ['companies', COMPANY_ID, 'inventory', 'Data', 'stock_adjustments'] },
  { label: 'stock_transfers', path: ['companies', COMPANY_ID, 'inventory', 'Data', 'stock_transfers'] },

  // Sales transactional
  { label: 'sales_invoices', path: ['companies', COMPANY_ID, 'sales', 'Data', 'sales_invoices'] },
  { label: 'sales_orders', path: ['companies', COMPANY_ID, 'sales', 'Data', 'sales_orders'] },
  { label: 'delivery_notes', path: ['companies', COMPANY_ID, 'sales', 'Data', 'delivery_notes'] },
  { label: 'sales_returns', path: ['companies', COMPANY_ID, 'sales', 'Data', 'sales_returns'] },
  { label: 'quotes', path: ['companies', COMPANY_ID, 'sales', 'Data', 'quotes'] },

  // Purchases transactional
  { label: 'purchase_invoices', path: ['companies', COMPANY_ID, 'purchases', 'Data', 'purchase_invoices'] },
  { label: 'purchase_orders', path: ['companies', COMPANY_ID, 'purchases', 'Data', 'purchase_orders'] },
  { label: 'goods_receipts', path: ['companies', COMPANY_ID, 'purchases', 'Data', 'goods_receipts'] },
  { label: 'purchase_returns', path: ['companies', COMPANY_ID, 'purchases', 'Data', 'purchase_returns'] },

  // Shared transactional
  { label: 'payment_history', path: ['companies', COMPANY_ID, 'shared', 'Data', 'payment_history'] },
  { label: 'record_change_logs', path: ['companies', COMPANY_ID, 'record_change_logs'] },
];

function resolveCollection(db: FirebaseFirestore.Firestore, parts: string[]): FirebaseFirestore.CollectionReference {
  // path is [coll, doc, coll, doc, ..., coll]
  let ref: any = db.collection(parts[0]);
  for (let i = 1; i < parts.length; i++) {
    ref = i % 2 === 1 ? ref.doc(parts[i]) : ref.collection(parts[i]);
  }
  return ref as FirebaseFirestore.CollectionReference;
}

async function wipeCollection(col: FirebaseFirestore.CollectionReference): Promise<number> {
  const snap = await col.get();
  if (snap.empty) return 0;
  const batchSize = 400;
  let deleted = 0;
  for (let i = 0; i < snap.docs.length; i += batchSize) {
    const batch = col.firestore.batch();
    const slice = snap.docs.slice(i, i + batchSize);
    slice.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    deleted += slice.length;
  }
  return deleted;
}

async function main() {
  const db = admin.firestore();
  console.log(`Wiping transactional data for ${COMPANY_ID}...\n`);

  let total = 0;
  for (const { label, path } of PATHS_TO_WIPE) {
    const col = resolveCollection(db, path);
    const count = await wipeCollection(col);
    total += count;
    if (count > 0) console.log(`  ${label.padEnd(28)} : ${count} deleted`);
  }

  console.log(`\nTotal deleted: ${total} docs\n✅ Master data + COA + module settings preserved.`);
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
