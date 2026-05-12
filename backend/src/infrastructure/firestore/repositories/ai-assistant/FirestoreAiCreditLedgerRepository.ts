import { Firestore } from 'firebase-admin/firestore';
import { IAiCreditLedgerRepository } from '../../../../repository/interfaces/ai-assistant/IAiCreditLedgerRepository';
import { AiCreditLedger } from '../../../../domain/ai-assistant/entities/AiCreditLedger';

/**
 * Strips undefined values recursively so Firestore doesn't reject them.
 * Follows the same pattern as FirestoreAiChatRepository.
 */
const stripUndefinedDeep = (value: any): any => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (Array.isArray(value)) {
    return value
      .map((item) => stripUndefinedDeep(item))
      .filter((item) => item !== undefined);
  }
  if (value instanceof Date) {
    return value;
  }
  if (typeof value !== 'object') {
    return value;
  }

  const output: Record<string, any> = {};
  Object.entries(value).forEach(([key, entry]) => {
    const normalized = stripUndefinedDeep(entry);
    if (normalized !== undefined) {
      output[key] = normalized;
    }
  });

  return output;
};

/**
 * FirestoreAiCreditLedgerRepository
 *
 * Stores the credit ledger as a singleton document under:
 *   companies/{companyId}/ai_credit_ledger/current
 *
 * Each company has exactly one ledger document.
 */
export class FirestoreAiCreditLedgerRepository implements IAiCreditLedgerRepository {
  constructor(private readonly db: Firestore) {}

  private getDocRef(companyId: string) {
    return this.db
      .collection('companies').doc(companyId)
      .collection('ai_credit_ledger').doc('current');
  }

  async getByCompanyId(companyId: string): Promise<AiCreditLedger | null> {
    const doc = await this.getDocRef(companyId).get();
    if (!doc.exists) return null;

    const data = doc.data();
    if (!data) return null;

    return AiCreditLedger.fromJSON({ id: doc.id, ...data });
  }

  async save(ledger: AiCreditLedger): Promise<AiCreditLedger> {
    const ref = this.getDocRef(ledger.companyId);
    await ref.set(stripUndefinedDeep(ledger.toJSON()), { merge: true });
    return ledger;
  }
}