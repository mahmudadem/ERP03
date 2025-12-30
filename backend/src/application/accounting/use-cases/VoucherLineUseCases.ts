
import { IVoucherRepository } from '../../../domain/accounting/repositories/IVoucherRepository';
import { VoucherEntity } from '../../../domain/accounting/entities/VoucherEntity';
import { VoucherLineEntity } from '../../../domain/accounting/entities/VoucherLineEntity';

/**
 * RecalculateVoucherTotalsUseCase
 * 
 * Note: With VoucherEntity (V2), totals are calculated in the constructor
 * and the entity is immutable. This use case may need to be redesigned
 * or removed as totals are always consistent with lines.
 */
export class RecalculateVoucherTotalsUseCase {
  constructor(private voucherRepo: IVoucherRepository) {}

  async execute(companyId: string, voucherId: string, _lines: any[]): Promise<void> {
    const voucher = await this.voucherRepo.findById(companyId, voucherId);
    if (!voucher) throw new Error('Voucher not found');

    // V2 VoucherEntity already has correct totals computed from lines
    // This use case is now a no-op since V2 entities are self-validating
    // If you need to update, you create a new entity with updated lines
    console.log('[RecalculateVoucherTotalsUseCase] V2 entities auto-calculate totals. No action needed.');
  }
}

export class AddVoucherLineUseCase {
  constructor(private _voucherRepo: IVoucherRepository) {
    void this._voucherRepo;
  }
  async execute() { 
    // Placeholder - V2 entities are immutable, add line by creating new entity
  }
}

export class RemoveVoucherLineUseCase {
  constructor(private _voucherRepo: IVoucherRepository) {
    void this._voucherRepo;
  }
  async execute() { 
    // Placeholder - V2 entities are immutable, remove line by creating new entity
  }
}
