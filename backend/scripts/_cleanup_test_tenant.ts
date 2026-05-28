/**
 * One-shot cleanup of duplicates created by earlier (non-idempotent) seed runs.
 *
 * Deletes:
 *   - Items whose code is one of WIDGET-A/B/SERVICE-A, keeping the FIRST one of each code
 *   - Parties whose code is ACME/GLOBEX/SUPPLIER-X, keeping the FIRST of each code
 *   - Tax codes with code TAX10, keeping the FIRST
 *   - Opening Stock documents that are DRAFT and reference the seed (keeps any POSTED — they're immutable)
 *
 * Does NOT touch ledger entries or vouchers — the bad wash-DR/CR entries from
 * the first OV post stay on the books and we'll account for them in expected
 * totals. Cleanest path is to recreate the company later if needed.
 */

process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';

import admin from '../src/firebaseAdmin';

const COMPANY_ID = process.argv[2];
if (!COMPANY_ID) {
  console.error('Usage: ts-node scripts/_cleanup_test_tenant.ts <companyId>');
  process.exit(1);
}

async function dedupeCollection(
  db: FirebaseFirestore.Firestore,
  collectionPath: string[],
  codes: string[],
): Promise<number> {
  let ref: FirebaseFirestore.CollectionReference = db.collection(collectionPath[0]);
  for (let i = 1; i < collectionPath.length; i++) {
    ref = ref.parent
      ? (collectionPath[i] === 'doc' ? ref.doc(collectionPath[i + 1]) as any : ref.doc(collectionPath[i]) as any)
      : ref;
  }
  // Simpler: just build path manually
  return 0;
}

async function main() {
  const db = admin.firestore();

  // Items
  const itemsCol = db.collection('companies').doc(COMPANY_ID)
    .collection('inventory').doc('Data').collection('items');
  const itemSnap = await itemsCol.where('code', 'in', ['WIDGET-A', 'WIDGET-B', 'SERVICE-A']).get();
  const itemsByCode = new Map<string, FirebaseFirestore.QueryDocumentSnapshot[]>();
  itemSnap.docs.forEach((d) => {
    const code = d.data().code;
    if (!itemsByCode.has(code)) itemsByCode.set(code, []);
    itemsByCode.get(code)!.push(d);
  });
  let deleted = 0;
  for (const [code, docs] of itemsByCode) {
    if (docs.length <= 1) continue;
    // Sort by createdAt ascending, keep oldest
    docs.sort((a, b) => {
      const aT = a.data().createdAt?.toDate?.()?.getTime() || 0;
      const bT = b.data().createdAt?.toDate?.()?.getTime() || 0;
      return aT - bT;
    });
    for (let i = 1; i < docs.length; i++) {
      await docs[i].ref.delete();
      deleted++;
    }
    console.log(`  items ${code}: kept ${docs[0].id.slice(0, 8)}..., deleted ${docs.length - 1} dup(s)`);
  }
  console.log(`Items deleted: ${deleted}\n`);

  // Parties
  const partiesCol = db.collection('companies').doc(COMPANY_ID)
    .collection('shared').doc('Data').collection('parties');
  const partySnap = await partiesCol.where('code', 'in', ['ACME', 'GLOBEX', 'SUPPLIER-X']).get();
  const partiesByCode = new Map<string, FirebaseFirestore.QueryDocumentSnapshot[]>();
  partySnap.docs.forEach((d) => {
    const code = d.data().code;
    if (!partiesByCode.has(code)) partiesByCode.set(code, []);
    partiesByCode.get(code)!.push(d);
  });
  let partyDeleted = 0;
  for (const [code, docs] of partiesByCode) {
    if (docs.length <= 1) continue;
    docs.sort((a, b) => {
      const aT = a.data().createdAt?.toDate?.()?.getTime() || 0;
      const bT = b.data().createdAt?.toDate?.()?.getTime() || 0;
      return aT - bT;
    });
    for (let i = 1; i < docs.length; i++) {
      await docs[i].ref.delete();
      partyDeleted++;
    }
    console.log(`  parties ${code}: kept ${docs[0].id.slice(0, 8)}..., deleted ${docs.length - 1} dup(s)`);
  }
  console.log(`Parties deleted: ${partyDeleted}\n`);

  // Tax codes
  const taxCol = db.collection('companies').doc(COMPANY_ID)
    .collection('shared').doc('Data').collection('tax_codes');
  const taxSnap = await taxCol.where('code', '==', 'TAX10').get();
  let taxDeleted = 0;
  if (taxSnap.size > 1) {
    const docs = [...taxSnap.docs].sort((a, b) => {
      const aT = a.data().createdAt?.toDate?.()?.getTime() || 0;
      const bT = b.data().createdAt?.toDate?.()?.getTime() || 0;
      return aT - bT;
    });
    for (let i = 1; i < docs.length; i++) {
      await docs[i].ref.delete();
      taxDeleted++;
    }
    console.log(`  tax_codes TAX10: kept ${docs[0].id.slice(0, 8)}..., deleted ${docs.length - 1} dup(s)`);
  }
  console.log(`Tax codes deleted: ${taxDeleted}\n`);

  // Opening Stock DRAFT docs (delete all DRAFTs that look like seeds — leave POSTED alone)
  const ovCol = db.collection('companies').doc(COMPANY_ID)
    .collection('inventory').doc('Data').collection('opening_stock_documents');
  const ovSnap = await ovCol.get();
  let ovDeleted = 0;
  for (const d of ovSnap.docs) {
    const data = d.data();
    if (data.status === 'DRAFT' && (data.notes?.startsWith('Seeded OV') || data.seedTag === 'seed-test-tenant')) {
      await d.ref.delete();
      ovDeleted++;
    }
  }
  console.log(`OV drafts deleted: ${ovDeleted} (POSTED OVs preserved)\n`);

  console.log('✅ Cleanup complete. Now re-run seed-test-tenant.ts.');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
