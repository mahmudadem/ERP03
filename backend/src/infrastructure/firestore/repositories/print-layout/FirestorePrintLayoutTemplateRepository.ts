import { Firestore } from 'firebase-admin/firestore';
import { PrintDocumentType } from '../../../../application/system-core/contracts/IPrintLayoutCore';
import { PrintLayoutTemplate } from '../../../../domain/print-layout/PrintLayoutTemplate';
import { IPrintLayoutTemplateRepository } from '../../../../repository/interfaces/print-layout/IPrintLayoutTemplateRepository';

export class FirestorePrintLayoutTemplateRepository implements IPrintLayoutTemplateRepository {
  constructor(private readonly db: Firestore) {}

  private collection(companyId: string) {
    return this.db
      .collection('companies')
      .doc(companyId)
      .collection('core')
      .doc('Settings')
      .collection('print_layouts');
  }

  async create(template: PrintLayoutTemplate): Promise<void> {
    await this.collection(template.companyId).doc(template.id).set(template.toJSON());
  }

  async update(template: PrintLayoutTemplate): Promise<void> {
    await this.collection(template.companyId).doc(template.id).set(template.toJSON(), { merge: true });
  }

  async getById(companyId: string, id: string): Promise<PrintLayoutTemplate | null> {
    const doc = await this.collection(companyId).doc(id).get();
    if (!doc.exists) return null;
    return PrintLayoutTemplate.fromJSON({ ...doc.data(), id: doc.id, companyId });
  }

  async list(companyId: string, documentType?: PrintDocumentType): Promise<PrintLayoutTemplate[]> {
    let query: FirebaseFirestore.Query = this.collection(companyId);
    if (documentType) query = query.where('documentType', '==', documentType);
    const snap = await query.get();
    return snap.docs
      .map((doc) => PrintLayoutTemplate.fromJSON({ ...doc.data(), id: doc.id, companyId }))
      .sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.name.localeCompare(b.name));
  }

  async getDefault(companyId: string, documentType: PrintDocumentType): Promise<PrintLayoutTemplate | null> {
    const snap = await this.collection(companyId)
      .where('documentType', '==', documentType)
      .where('isDefault', '==', true)
      .limit(1)
      .get();
    if (snap.empty) return null;
    const doc = snap.docs[0];
    return PrintLayoutTemplate.fromJSON({ ...doc.data(), id: doc.id, companyId });
  }

  async clearDefault(companyId: string, documentType: PrintDocumentType, exceptId?: string): Promise<void> {
    const snap = await this.collection(companyId)
      .where('documentType', '==', documentType)
      .where('isDefault', '==', true)
      .get();
    const batch = this.db.batch();
    snap.docs.forEach((doc) => {
      if (doc.id !== exceptId) batch.update(doc.ref, { isDefault: false, updatedAt: new Date() });
    });
    await batch.commit();
  }

  async delete(companyId: string, id: string): Promise<void> {
    await this.collection(companyId).doc(id).delete();
  }
}
