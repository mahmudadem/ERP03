
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
process.env.GCLOUD_PROJECT = 'erp-03';

const admin = require('firebase-admin');
if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'erp-03' });
}
const db = admin.firestore();

async function checkFirestoreNotifications() {
  const companyId = 'cmp_mkvfwfm5_h1t3vi';
  const userId = 'moqSwfitRen4WnOjOHEIPvNzKe6J';
  
  console.log(`Checking Firestore for Company: ${companyId}, User: ${userId}`);
  
  const snapshot = await db.collection('notifications')
    .where('companyId', '==', companyId)
    .where('recipientUserIds', 'array-contains', userId)
    .get();
    
  console.log(`Found ${snapshot.size} notifications matching both.`);

  const snapshotCo = await db.collection('notifications')
    .where('companyId', '==', companyId)
    .get();
  console.log(`Found ${snapshotCo.size} notifications matching company only.`);

  const snapshotUser = await db.collection('notifications')
    .where('recipientUserIds', 'array-contains', userId)
    .get();
  console.log(`Found ${snapshotUser.size} notifications matching user only.`);
  
  if (snapshotUser.size > 0) {
    console.log('First user notification companyId:', snapshotUser.docs[0].data().companyId);
  }

  try {
    const orderedSnapshot = await db.collection('notifications')
      .where('companyId', '==', companyId)
      .where('recipientUserIds', 'array-contains', userId)
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();
    console.log(`Found ${orderedSnapshot.size} notifications with ordered query.`);
  } catch (error) {
    console.error('Ordered query failed:', error.message || error);
  }
}

checkFirestoreNotifications().catch(console.error);
