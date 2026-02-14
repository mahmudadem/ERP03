import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { IVoucherSequenceRepository } from '../../../../repository/interfaces/accounting/IVoucherSequenceRepository';
import { VoucherSequence } from '../../../../domain/accounting/entities/VoucherSequence';

const formatNumber = (prefix: string, next: number, year?: number, format?: string) => {
  const counter = String(next).padStart(4, '0');
  const y = year ? String(year) : '';
  if (format) {
    return format
      .replace('{PREFIX}', prefix)
      .replace('{YYYY}', y)
      .replace('{COUNTER:4}', counter)
      .replace('{COUNTER}', counter);
  }
  return year ? `${prefix}-${year}-${counter}` : `${prefix}-${counter}`;
};

export class FirestoreVoucherSequenceRepository implements IVoucherSequenceRepository {
  constructor(private readonly db: admin.firestore.Firestore) {}

  private col(companyId: string) {
    return this.db
      .collection('companies')
      .doc(companyId)
      .collection('accounting')
      .doc('Data')
      .collection('voucherSequences');
  }

  async getNextNumber(companyId: string, prefix: string, year?: number, format?: string): Promise<string> {
    const id = year ? `${prefix}-${year}` : prefix;
    const docRef = this.col(companyId).doc(id);
    return this.db.runTransaction(async (txn) => {
      const snap = await txn.get(docRef);
      const data = snap.exists ? snap.data() as any : null;
      const lastNumber = data?.lastNumber || 0;
      const next = lastNumber + 1;
      const seq: VoucherSequence = {
        id,
        companyId,
        prefix,
        year,
        lastNumber: next,
        format: format || data?.format || '',
        updatedAt: new Date()
      };
      txn.set(docRef, {
        prefix,
        year: year || null,
        lastNumber: next,
        format: seq.format || null,
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
      return formatNumber(prefix, next, year, seq.format);
    });
  }

  async getCurrentSequence(companyId: string, prefix: string, year?: number): Promise<VoucherSequence | null> {
    const id = year ? `${prefix}-${year}` : prefix;
    const snap = await this.col(companyId).doc(id).get();
    if (!snap.exists) return null;
    const d = snap.data() as any;
    return {
      id,
      companyId,
      prefix: d.prefix,
      year: d.year || undefined,
      lastNumber: d.lastNumber || 0,
      format: d.format || '',
      updatedAt: d.updatedAt?.toDate?.() || new Date()
    };
  }

  async setNextNumber(companyId: string, prefix: string, nextNumber: number, year?: number, format?: string): Promise<void> {
    const id = year ? `${prefix}-${year}` : prefix;
    await this.col(companyId).doc(id).set({
      prefix,
      year: year || null,
      lastNumber: Math.max(0, nextNumber - 1),
      format: format || null,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  }

  async listSequences(companyId: string): Promise<VoucherSequence[]> {
    const snap = await this.col(companyId).orderBy('prefix').get();
    return snap.docs.map((d) => {
      const data = d.data() as any;
      return {
        id: d.id,
        companyId,
        prefix: data.prefix,
        year: data.year || undefined,
        lastNumber: data.lastNumber || 0,
        format: data.format || '',
        updatedAt: data.updatedAt?.toDate?.() || new Date()
      };
    });
  }
}
