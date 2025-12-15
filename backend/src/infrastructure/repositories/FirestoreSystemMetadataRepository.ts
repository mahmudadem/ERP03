import { Firestore } from 'firebase-admin/firestore';

export interface ISystemMetadataRepository {
  getMetadata(key: string): Promise<any>;
  setMetadata(key: string, value: any): Promise<void>;
}

export class FirestoreSystemMetadataRepository implements ISystemMetadataRepository {
  private readonly collection = 'system_metadata';

  constructor(private readonly db: Firestore) {}

  async getMetadata(key: string): Promise<any> {
    const snapshot = await this.db.collection(this.collection).doc(key).collection('items').get();
    
    if (snapshot.empty) {
      return null;
    }

    return snapshot.docs.map(doc => doc.data());
  }

  async setMetadata(key: string, value: any[]): Promise<void> {
    const batch = this.db.batch();
    const collectionRef = this.db.collection(this.collection).doc(key).collection('items');

    // Delete existing items first (to ensure full replacement like the original set)
    // In a real prod scenario we might want a smarter merge, but for seeding/config this is cleaner.
    const existing = await collectionRef.get();
    existing.docs.forEach(doc => batch.delete(doc.ref));

    // Add new items
    value.forEach((item: any) => {
      // Use 'id' or 'code' as document ID if present, otherwise auto-id
      const docId = item.id || item.code || this.db.collection('_').doc().id;
      const docRef = collectionRef.doc(docId);
       
      batch.set(docRef, {
        ...item,
        updatedAt: new Date().toISOString(),
      });
    });

    await batch.commit();
  }
}
