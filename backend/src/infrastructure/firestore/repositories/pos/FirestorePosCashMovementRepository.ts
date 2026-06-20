import { Firestore, Transaction } from 'firebase-admin/firestore';
import { PosCashMovement } from '../../../../domain/pos/entities/PosCashMovement';
import {
  EMPTY_CASH_MOVEMENT_TOTALS,
  IPosCashMovementRepository,
  PosCashMovementTotals,
} from '../../../../repository/interfaces/pos/IPosCashMovementRepository';

export class FirestorePosCashMovementRepository implements IPosCashMovementRepository {
  constructor(private readonly db: Firestore) {}

  private collection(companyId: string) {
    return this.db.collection('companies').doc(companyId).collection('posCashMovements');
  }

  private asTransaction(transaction?: unknown): Transaction | undefined {
    if (!transaction) return undefined;
    return transaction as Transaction;
  }

  async create(movement: PosCashMovement, transaction?: unknown): Promise<void> {
    const ref = this.collection(movement.companyId).doc(movement.id);
    const payload = movement.toJSON();
    const txn = this.asTransaction(transaction);
    if (txn) {
      txn.set(ref, payload);
      return;
    }
    await ref.set(payload);
  }

  async listByShift(companyId: string, shiftId: string): Promise<PosCashMovement[]> {
    const snap = await this.collection(companyId)
      .where('shiftId', '==', shiftId)
      .orderBy('createdAt', 'asc')
      .get();
    return snap.docs.map((d) => PosCashMovement.fromJSON(d.data()));
  }

  async sumByShift(companyId: string, shiftId: string): Promise<PosCashMovementTotals> {
    const totals: PosCashMovementTotals = { ...EMPTY_CASH_MOVEMENT_TOTALS };
    const snap = await this.collection(companyId).where('shiftId', '==', shiftId).get();
    for (const doc of snap.docs) {
      const m = PosCashMovement.fromJSON(doc.data());
      totals[m.type] = round2(totals[m.type] + m.amount);
    }
    totals.expectedCash = round2(
      totals.OPENING_FLOAT + totals.SALE_CASH - totals.REFUND_CASH + totals.PAYIN - totals.PAYOUT - totals.DROP
    );
    return totals;
  }
}

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;
