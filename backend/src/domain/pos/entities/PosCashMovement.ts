/**
 * PosCashMovement — A cash-drawer event that affects expected-cash math.
 *
 * Types:
 *   - OPENING_FLOAT: opening cash counted into the drawer at shift open
 *   - PAYIN:         cash added to the drawer (e.g. from the back office)
 *   - PAYOUT:        cash removed (e.g. paid to a vendor for petty cash)
 *   - DROP:          safe drop — cash removed and locked away
 *   - SALE_CASH:     net cash from a POS sale (added in P2 by CompletePosSale)
 *   - REFUND_CASH:   cash refunded to a customer (added in P3 by CompletePosReturn)
 */
export type PosCashMovementType =
  | 'OPENING_FLOAT'
  | 'PAYIN'
  | 'PAYOUT'
  | 'DROP'
  | 'SALE_CASH'
  | 'REFUND_CASH';

export interface PosCashMovementProps {
  id: string;
  companyId: string;
  shiftId: string;
  registerId: string;
  type: PosCashMovementType;
  amount: number; // always > 0
  reason?: string;
  createdBy: string;
  createdAt: Date;
}

export class PosCashMovement {
  readonly id: string;
  readonly companyId: string;
  readonly shiftId: string;
  readonly registerId: string;
  readonly type: PosCashMovementType;
  readonly amount: number;
  readonly reason?: string;
  readonly createdBy: string;
  readonly createdAt: Date;

  constructor(props: PosCashMovementProps) {
    if (!props.id?.trim()) throw new Error('PosCashMovement id is required');
    if (!props.companyId?.trim()) throw new Error('PosCashMovement companyId is required');
    if (!props.shiftId?.trim()) throw new Error('PosCashMovement shiftId is required');
    if (!props.registerId?.trim()) throw new Error('PosCashMovement registerId is required');
    if (!Number.isFinite(props.amount) || props.amount <= 0) {
      throw new Error('PosCashMovement amount must be > 0');
    }
    const valid: PosCashMovementType[] = ['OPENING_FLOAT', 'PAYIN', 'PAYOUT', 'DROP', 'SALE_CASH', 'REFUND_CASH'];
    if (!valid.includes(props.type)) {
      throw new Error(`PosCashMovement type must be one of: ${valid.join(', ')}`);
    }
    this.id = props.id;
    this.companyId = props.companyId;
    this.shiftId = props.shiftId;
    this.registerId = props.registerId;
    this.type = props.type;
    this.amount = props.amount;
    this.reason = props.reason?.trim() || undefined;
    this.createdBy = props.createdBy;
    this.createdAt = props.createdAt;
  }

  toJSON(): Record<string, any> {
    return {
      id: this.id,
      companyId: this.companyId,
      shiftId: this.shiftId,
      registerId: this.registerId,
      type: this.type,
      amount: this.amount,
      reason: this.reason,
      createdBy: this.createdBy,
      createdAt: this.createdAt.toISOString(),
    };
  }

  static fromJSON(data: any): PosCashMovement {
    return new PosCashMovement({
      id: data.id,
      companyId: data.companyId,
      shiftId: data.shiftId,
      registerId: data.registerId,
      type: data.type,
      amount: Number(data.amount) || 0,
      reason: data.reason,
      createdBy: data.createdBy,
      createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
    });
  }
}
