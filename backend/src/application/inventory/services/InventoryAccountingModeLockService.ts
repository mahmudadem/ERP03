import { IVoucherRepository } from '../../../domain/accounting/repositories/IVoucherRepository';
import { IStockMovementRepository } from '../../../repository/interfaces/inventory/IStockMovementRepository';

export interface InventoryAccountingModeLockState {
  locked: boolean;
  hasPostedVouchers: boolean;
  hasStockMovements: boolean;
  reason: string | null;
}

const LOCK_REASON =
  'Inventory accounting mode is locked after the first posted stock or accounting transaction.';

export class InventoryAccountingModeLockService {
  constructor(
    private readonly voucherRepository: IVoucherRepository,
    private readonly stockMovementRepository: IStockMovementRepository
  ) {}

  async getLockState(companyId: string): Promise<InventoryAccountingModeLockState> {
    const [hasPostedVouchers, hasStockMovements] = await Promise.all([
      this.voucherRepository.hasPostedVouchers(companyId),
      this.stockMovementRepository.hasAnyMovements(companyId),
    ]);

    const locked = hasPostedVouchers || hasStockMovements;
    return {
      locked,
      hasPostedVouchers,
      hasStockMovements,
      reason: locked ? LOCK_REASON : null,
    };
  }

  async assertModeChangeAllowed(companyId: string): Promise<void> {
    const lockState = await this.getLockState(companyId);
    if (lockState.locked) {
      throw new Error(lockState.reason || LOCK_REASON);
    }
  }
}
