import { PosCashMovement } from '../../../domain/pos/entities/PosCashMovement';

export interface PosCashMovementTotals {
  OPENING_FLOAT: number;
  PAYIN: number;
  PAYOUT: number;
  DROP: number;
  SALE_CASH: number;
  REFUND_CASH: number;
  /** Computed expected cash = openingFloat + SALE_CASH - REFUND_CASH + PAYIN - PAYOUT - DROP */
  expectedCash: number;
}

export const EMPTY_CASH_MOVEMENT_TOTALS: PosCashMovementTotals = {
  OPENING_FLOAT: 0,
  PAYIN: 0,
  PAYOUT: 0,
  DROP: 0,
  SALE_CASH: 0,
  REFUND_CASH: 0,
  expectedCash: 0,
};

export interface IPosCashMovementRepository {
  create(movement: PosCashMovement, tx?: unknown): Promise<void>;
  listByShift(companyId: string, shiftId: string): Promise<PosCashMovement[]>;
  sumByShift(companyId: string, shiftId: string): Promise<PosCashMovementTotals>;
}
