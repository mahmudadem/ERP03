import { Firestore } from 'firebase-admin/firestore';

export interface ISystemMetadataRepository {
  getMetadata(key: string): Promise<any>;
  setMetadata(key: string, value: any): Promise<void>;
}

export class FirestoreSystemMetadataRepository implements ISystemMetadataRepository {
  private readonly collection = 'system_metadata';

  constructor(private readonly db: Firestore) {}

  async getMetadata(key: string): Promise<any> {
    const doc = await this.db.collection(this.collection).doc(key).get();
    
    if (!doc.exists) {
      return null;
    }

    return doc.data();
  }

  async setMetadata(key: string, value: any): Promise<void> {
    await this.db.collection(this.collection).doc(key).set({
      data: value,
      updatedAt: new Date().toISOString(),
    });
  }
}
