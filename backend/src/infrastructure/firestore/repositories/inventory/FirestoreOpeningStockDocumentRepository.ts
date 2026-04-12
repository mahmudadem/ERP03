import { DocumentReference, FieldValue, Firestore, Query, Transaction } from 'firebase-admin/firestore';
import {
  OpeningStockDocument,
  OpeningStockDocumentStatus,
} from '../../../../domain/inventory/entities/OpeningStockDocument';
import {
  IOpeningStockDocumentRepository,
  OpeningStockDocumentListOptions,
} from '../../../../repository/interfaces/inventory/IOpeningStockDocumentRepository';
import { OpeningStockDocumentMapper } from '../../mappers/InventoryMappers';
import { getInventoryCollection } from './InventoryFirestorePaths';

export class FirestoreOpeningStockDocumentRepository implements IOpeningStockDocumentRepository {
  constructor(private readonly db: Firestore) {}

  private collection(companyId: string) {
    return getInventoryCollection(this.db, companyId, 'opening_stock_documents');
  }

  private async resolveRefById(id: string): Promise<DocumentReference | null> {
    const snap = await this.db
      .collectionGroup('opening_stock_documents')
      .where('id', '==', id)
      .limit(1)
      .get();

    if (snap.empty) return null;
    return snap.docs[0].ref;
  }

  private applyPaging(query: Query, opts?: OpeningStockDocumentListOptions): Query {
    let ref = query;
    if (opts?.offset) ref = ref.offset(opts.offset);
    if (opts?.limit) ref = ref.limit(opts.limit);
    return ref;
  }

  private asTransaction(transaction?: unknown): Transaction | undefined {
    if (!transaction) return undefined;
    return transaction as Transaction;
  }

  async createDocument(document: OpeningStockDocument, transaction?: unknown): Promise<void> {
    const ref = this.collection(document.companyId).doc(document.id);
    const payload = OpeningStockDocumentMapper.toPersistence(document);
    const txn = this.asTransaction(transaction);
    if (txn) {
      txn.set(ref, payload);
      return;
    }
    await ref.set(payload);
  }

  async updateDocument(
    companyId: string,
    id: string,
    data: Partial<OpeningStockDocument>,
    transaction?: unknown
  ): Promise<void> {
    const ref = this.collection(companyId).doc(id);
    const payload = Object.fromEntries(
      Object.entries(data).map(([key, value]) => [key, value === undefined ? FieldValue.delete() : value])
    );
    const txn = this.asTransaction(transaction);
    if (txn) {
      txn.update(ref, payload as any);
      return;
    }
    await ref.update(payload as any);
  }

  async getDocument(id: string): Promise<OpeningStockDocument | null> {
    const ref = await this.resolveRefById(id);
    if (!ref) return null;

    const doc = await ref.get();
    if (!doc.exists) return null;

    return OpeningStockDocumentMapper.toDomain(doc.data());
  }

  async getCompanyDocuments(
    companyId: string,
    opts?: OpeningStockDocumentListOptions
  ): Promise<OpeningStockDocument[]> {
    let query: Query = this.collection(companyId).orderBy('date', 'desc');
    query = this.applyPaging(query, opts);

    const snap = await query.get();
    return snap.docs.map((doc) => OpeningStockDocumentMapper.toDomain(doc.data()));
  }

  async getByStatus(
    companyId: string,
    status: OpeningStockDocumentStatus,
    opts?: OpeningStockDocumentListOptions
  ): Promise<OpeningStockDocument[]> {
    let query: Query = this.collection(companyId)
      .where('status', '==', status)
      .orderBy('date', 'desc');
    query = this.applyPaging(query, opts);

    const snap = await query.get();
    return snap.docs.map((doc) => OpeningStockDocumentMapper.toDomain(doc.data()));
  }

  async deleteDocument(id: string): Promise<void> {
    const ref = await this.resolveRefById(id);
    if (!ref) return;
    await ref.delete();
  }
}
