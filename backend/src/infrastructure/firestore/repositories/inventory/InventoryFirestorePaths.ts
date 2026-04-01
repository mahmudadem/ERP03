import { Firestore } from 'firebase-admin/firestore';

export const getInventoryModuleRef = (db: Firestore, companyId: string) =>
  db.collection('companies').doc(companyId).collection('inventory');

export const getInventorySettingsRef = (db: Firestore, companyId: string) =>
  getInventoryModuleRef(db, companyId).doc('Settings');

export const getInventoryDataRef = (db: Firestore, companyId: string) =>
  getInventoryModuleRef(db, companyId).doc('Data');

export const getInventoryCollection = (
  db: Firestore,
  companyId: string,
  collectionName: string
) => getInventoryDataRef(db, companyId).collection(collectionName);
