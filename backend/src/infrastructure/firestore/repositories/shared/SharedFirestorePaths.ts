import { Firestore } from 'firebase-admin/firestore';

export const getSharedModuleRef = (db: Firestore, companyId: string) =>
  db.collection('companies').doc(companyId).collection('shared');

export const getSharedDataRef = (db: Firestore, companyId: string) =>
  getSharedModuleRef(db, companyId).doc('Data');

export const getSharedCollection = (
  db: Firestore,
  companyId: string,
  collectionName: string
) => getSharedDataRef(db, companyId).collection(collectionName);
