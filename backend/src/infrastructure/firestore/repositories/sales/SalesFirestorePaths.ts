import { Firestore } from 'firebase-admin/firestore';

export const getSalesModuleRef = (db: Firestore, companyId: string) =>
  db.collection('companies').doc(companyId).collection('sales');

export const getSalesSettingsRef = (db: Firestore, companyId: string) =>
  getSalesModuleRef(db, companyId).doc('settings');

export const getSalesDataRef = (db: Firestore, companyId: string) =>
  getSalesModuleRef(db, companyId).doc('Data');

export const getSalesCollection = (
  db: Firestore,
  companyId: string,
  collectionName: string
) => getSalesDataRef(db, companyId).collection(collectionName);
