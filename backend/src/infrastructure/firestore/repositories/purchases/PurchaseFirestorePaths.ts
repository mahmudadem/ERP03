import { Firestore } from 'firebase-admin/firestore';

export const getPurchasesModuleRef = (db: Firestore, companyId: string) =>
  db.collection('companies').doc(companyId).collection('purchases');

export const getPurchasesSettingsRef = (db: Firestore, companyId: string) =>
  getPurchasesModuleRef(db, companyId).doc('settings');

export const getPurchasesDataRef = (db: Firestore, companyId: string) =>
  getPurchasesModuleRef(db, companyId).doc('Data');

export const getPurchasesCollection = (
  db: Firestore,
  companyId: string,
  collectionName: string
) => getPurchasesDataRef(db, companyId).collection(collectionName);
