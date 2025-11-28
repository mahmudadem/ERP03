
import { Voucher, VoucherType, VoucherStatus } from '../../../domain/accounting/entities/Voucher';
import { VoucherLine } from '../../../domain/accounting/entities/VoucherLine';
import { IVoucherRepository } from '../../../repository/interfaces/accounting';
import { ICompanySettingsRepository } from '../../../repository/interfaces/core/ICompanySettingsRepository';

// --- SHARED HELPER ---
const validateTransition = (voucher: Voucher, targetStatus: VoucherStatus) => {
  if (!voucher.canTransitionTo(targetStatus)) {
    throw new Error(`Invalid status transition from '${voucher.status}' to '${targetStatus}'`);
  }
};

export class CreateVoucherUseCase {
  constructor(
    private voucherRepo: IVoucherRepository,
    private settingsRepo: ICompanySettingsRepository
  ) {}

  async execute(data: { 
    companyId: string; 
    type: VoucherType; 
    date: Date; 
    currency: string; 
    exchangeRate: number; 
    createdBy: string;
    reference?: string;
    lines: Array<{ accountId: string; description: string; fxAmount: number; costCenterId?: string }>;
  }): Promise<Voucher> {
    
    // 1. Load Settings
    const settings = await this.settingsRepo.getSettings(data.companyId);
    
    // 2. Determine Initial Status
    const initialStatus: VoucherStatus = settings.strictApprovalMode ? 'draft' : 'approved';

    const voucherId = `vch_${Date.now()}`;
    
    // 3. Build Lines & Totals
    let totalDebit = 0;
    let totalCredit = 0;
    const voucherLines: VoucherLine[] = [];

    data.lines.forEach((lineData, idx) => {
      const baseAmount = lineData.fxAmount * data.exchangeRate;
      if (baseAmount > 0) totalDebit += baseAmount;
      else totalCredit += Math.abs(baseAmount);

      voucherLines.push(new VoucherLine(
        `${voucherId}_l${idx}`,
        voucherId,
        lineData.accountId,
        lineData.description,
        lineData.fxAmount,
        baseAmount,
        data.exchangeRate,
        lineData.costCenterId
      ));
    });

    // 4. Create Entity
    const voucher = new Voucher(
      voucherId,
      data.companyId,
      data.type,
      data.date,
      data.currency,
      data.exchangeRate,
      initialStatus,
      totalDebit, 
      totalCredit,
      data.createdBy,
      data.reference,
      voucherLines
    );

    await this.voucherRepo.createVoucher(voucher);
    return voucher;
  }
}

export class UpdateVoucherDraftUseCase {
  constructor(private voucherRepo: IVoucherRepository) {}

  async execute(id: string, data: Partial<Voucher>): Promise<void> {
    const voucher = await this.voucherRepo.getVoucher(id);
    if (!voucher) throw new Error('Voucher not found');
    
    if (voucher.status !== 'draft') {
      throw new Error('Only Draft vouchers can be updated');
    }
    
    await this.voucherRepo.updateVoucher(id, data);
  }
}

export class SendVoucherToApprovalUseCase {
  constructor(
    private voucherRepo: IVoucherRepository,
    private settingsRepo: ICompanySettingsRepository
  ) {}

  async execute(id: string): Promise<Voucher> {
    const voucher = await this.voucherRepo.getVoucher(id);
    if (!voucher) throw new Error('Voucher not found');

    const settings = await this.settingsRepo.getSettings(voucher.companyId);
    if (!settings.strictApprovalMode) {
      throw new Error("Approval workflow is disabled for this company.");
    }

    validateTransition(voucher, 'pending');

    if (!voucher.isBalanced()) {
      throw new Error(`Voucher is not balanced. Debit: ${voucher.totalDebit}, Credit: ${voucher.totalCredit}`);
    }

    voucher.status = 'pending';
    await this.voucherRepo.updateVoucher(id, { status: 'pending' });
    
    return voucher;
  }
}

export class ApproveVoucherUseCase {
  constructor(
    private voucherRepo: IVoucherRepository,
    private settingsRepo: ICompanySettingsRepository
  ) {}

  async execute(id: string): Promise<Voucher> {
    const voucher = await this.voucherRepo.getVoucher(id);
    if (!voucher) throw new Error('Voucher not found');
    
    const settings = await this.settingsRepo.getSettings(voucher.companyId);
    if (!settings.strictApprovalMode) {
      throw new Error("Approval workflow is disabled for this company.");
    }

    validateTransition(voucher, 'approved');

    voucher.status = 'approved';
    await this.voucherRepo.updateVoucher(id, { status: 'approved' });
    
    return voucher;
  }
}

export class LockVoucherUseCase {
  constructor(private voucherRepo: IVoucherRepository) {}

  async execute(id: string): Promise<Voucher> {
    const voucher = await this.voucherRepo.getVoucher(id);
    if (!voucher) throw new Error('Voucher not found');
    
    validateTransition(voucher, 'locked');
    
    voucher.status = 'locked';
    await this.voucherRepo.updateVoucher(id, { status: 'locked' });
    
    return voucher;
  }
}

export class CancelVoucherUseCase {
  constructor(private voucherRepo: IVoucherRepository) {}

  async execute(id: string): Promise<Voucher> {
    const voucher = await this.voucherRepo.getVoucher(id);
    if (!voucher) throw new Error('Voucher not found');
    
    validateTransition(voucher, 'cancelled');
    
    voucher.status = 'cancelled';
    await this.voucherRepo.updateVoucher(id, { status: 'cancelled' });
    
    return voucher;
  }
}

export class GetVoucherUseCase {
  constructor(private voucherRepo: IVoucherRepository) {}
  
  async execute(id: string): Promise<Voucher> {
    const voucher = await this.voucherRepo.getVoucher(id);
    if (!voucher) throw new Error('Voucher not found');
    return voucher;
  }
}

export class ListVouchersUseCase {
  constructor(private voucherRepo: IVoucherRepository) {}

  async execute(companyId: string, filters?: any): Promise<Voucher[]> {
    return this.voucherRepo.getVouchers(companyId, filters);
  }
}
