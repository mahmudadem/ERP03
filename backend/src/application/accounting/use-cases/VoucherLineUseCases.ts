
import { IVoucherRepository } from '../../../repository/interfaces/accounting';
// import { VoucherLine } from '../../../domain/accounting/entities/VoucherLine';

export class RecalculateVoucherTotalsUseCase {
  constructor(private voucherRepo: IVoucherRepository) {}

  async execute(voucherId: string, lines: any[]): Promise<void> {
    // In a pure Clean Architecture, we would fetch lines from ILineRepo.
    // Here we accept them as arg or assume logic.
    
    const voucher = await this.voucherRepo.getVoucher(voucherId);
    if (!voucher) throw new Error('Voucher not found');

    let totalDebit = 0;
    let totalCredit = 0;

    lines.forEach(line => {
      const baseAmt = line.fxAmount * voucher.exchangeRate;
      if (baseAmt > 0) totalDebit += baseAmt;
      else totalCredit += Math.abs(baseAmt);
    });

    await this.voucherRepo.updateVoucher(voucherId, {
      totalDebit,
      totalCredit
    });
  }
}

export class AddVoucherLineUseCase {
    constructor(private voucherRepo: IVoucherRepository) {}
    async execute() { /* Placeholder for future specific line logic */ }
}

export class RemoveVoucherLineUseCase {
    constructor(private voucherRepo: IVoucherRepository) {}
    async execute() { /* Placeholder */ }
}
