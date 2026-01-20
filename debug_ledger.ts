
import admin from './backend/src/firebaseAdmin';
const db = admin.firestore();

async function checkData() {
  console.log('--- DIAGNOSTIC START ---');
  const companiesSnap = await db.collection('companies').limit(1).get();
  if (companiesSnap.empty) {
    console.log('No companies found');
    return;
  }
  const actualCompanyId = companiesSnap.docs[0].id;
  console.log('Found Company:', actualCompanyId);

  const ledgerSnap = await db.collection('companies').doc(actualCompanyId).collection('ledger').limit(5).get();
  console.log('Ledger Entries found in "ledger":', ledgerSnap.size);
  
  let targetSnap = ledgerSnap;
  if (ledgerSnap.empty) {
    const ledgerSnap2 = await db.collection('companies').doc(actualCompanyId).collection('general_ledger').limit(5).get();
    console.log('Ledger Entries found in "general_ledger":', ledgerSnap2.size);
    targetSnap = ledgerSnap2;
  }

  for (const doc of targetSnap.docs) {
    const data = doc.data();
    console.log(`\nChecking entry ${doc.id}:`);
    console.log('AccountId:', data.accountId);
    console.log('VoucherId:', data.voucherId);
    
    const accDoc = await db.collection('companies').doc(actualCompanyId).collection('accounts').doc(data.accountId).get();
    if (accDoc.exists) {
        console.log('✅ Account found by ID:', accDoc.data()?.name);
    } else {
        const query = await db.collection('companies').doc(actualCompanyId).collection('accounts').where('userCode', '==', data.accountId).get();
        if (!query.empty) {
            console.log('⚠️ Account found by userCode (NOT ID):', query.docs[0].data()?.name);
        } else {
            console.log('❌ Account NOT found by ID or userCode');
        }
    }
    
    const vDoc = await db.collection('companies').doc(actualCompanyId).collection('vouchers').doc(data.voucherId).get();
    if (vDoc.exists) {
        console.log('✅ Voucher found by ID:', vDoc.data()?.voucherNo);
    } else {
        console.log('❌ Voucher NOT found by ID');
    }
  }
  console.log('--- DIAGNOSTIC END ---');
}

checkData().catch(err => {
    console.error('DIAGNOSTIC FAILED:', err);
    process.exit(1);
});
