import { Voucher } from '../../../domain/accounting/entities/Voucher';
import { VoucherLine } from '../../../domain/accounting/entities/VoucherLine';
import { IVoucherRepository, IAccountRepository, ILedgerRepository } from '../../../repository/interfaces/accounting';
import { ICompanyModuleSettingsRepository } from '../../../repository/interfaces/system/ICompanyModuleSettingsRepository';
import { PermissionChecker } from '../../rbac/PermissionChecker';

const assertBalanced = (voucher: Voucher) => {
  if (Math.abs((voucher.totalDebitBase || 0) - (voucher.totalCreditBase || 0)) > 0.0001) {
    const err: any = new Error('Voucher not balanced');
    err.statusCode = 400;
    throw err;
  }
};

export class CreateVoucherUseCase {
  constructor(
    private voucherRepo: IVoucherRepository,
    private accountRepo: IAccountRepository,
    private settingsRepo: ICompanyModuleSettingsRepository,
    private _ledgerRepo: ILedgerRepository,
    private permissionChecker: PermissionChecker
  ) {}

  async execute(companyId: string, userId: string, payload: Partial<Voucher>): Promise<Voucher> {
    await this.permissionChecker.assertOrThrow(userId, companyId, 'voucher.create');
    const settings: any = await this.settingsRepo.getSettings(companyId, 'accounting');
    const baseCurrency = settings?.baseCurrency || payload.baseCurrency || payload.currency;
    const autoNumbering = settings?.autoNumbering !== false;

    const voucherId = payload.id || `vch_${Date.now()}`;
    const voucherNo = autoNumbering ? `V-${Date.now()}` : payload.voucherNo || '';
    const lines = (payload.lines || []).map((l, idx) => {
      const line = new VoucherLine(
        l.id || `${voucherId}_l${idx}`,
        voucherId,
        l.accountId!,
        l.description ?? null
      );
      line.debitFx = l.debitFx || 0;
      line.creditFx = l.creditFx || 0;
      line.debitBase = l.debitBase || (l.debitFx || 0) * (payload.exchangeRate || 1);
      line.creditBase = l.creditBase || (l.creditFx || 0) * (payload.exchangeRate || 1);
      line.costCenterId = l.costCenterId;
      line.lineCurrency = l.lineCurrency || payload.currency;
      line.exchangeRate = l.exchangeRate || payload.exchangeRate || 1;
      line.fxAmount = line.debitFx && line.debitFx > 0 ? line.debitFx : -1 * (line.creditFx || 0);
      line.baseAmount = line.debitBase && line.debitBase > 0 ? line.debitBase : -1 * (line.creditBase || 0);
      return line;
    });

    for (const line of lines) {
      const acc = await this.accountRepo.getById(companyId, line.accountId);
      if (!acc || acc.active === false) throw new Error(`Account ${line.accountId} invalid`);
    }

    const totalDebitBase = lines.reduce((s, l) => s + (l.debitBase || 0), 0);
    const totalCreditBase = lines.reduce((s, l) => s + (l.creditBase || 0), 0);

    const voucher = new Voucher(
      voucherId,
      companyId,
      payload.type || 'journal',
      payload.date ? new Date(payload.date) : new Date(),
      payload.currency || baseCurrency,
      payload.exchangeRate || 1,
      settings?.strictApprovalMode === false ? 'approved' : 'draft',
      totalDebitBase,
      totalCreditBase,
      userId,
      payload.reference ?? null,
      lines
    );
    voucher.voucherNo = voucherNo;
    voucher.baseCurrency = baseCurrency;
    voucher.totalDebitBase = totalDebitBase;
    voucher.totalCreditBase = totalCreditBase;
    voucher.createdAt = new Date().toISOString();
    voucher.updatedAt = new Date().toISOString();
    voucher.description = payload.description ?? null;

    assertBalanced(voucher);
    await this.voucherRepo.createVoucher(voucher);

    // Auto-approved path writes ledger
    if (voucher.status === 'approved') {
      await this._ledgerRepo.recordForVoucher(voucher);
    }

    return voucher;
  }
}

export class UpdateVoucherUseCase {
  constructor(
    private voucherRepo: IVoucherRepository,
    private accountRepo: IAccountRepository,
    private permissionChecker: PermissionChecker
  ) {}

  async execute(companyId: string, userId: string, voucherId: string, payload: Partial<Voucher>): Promise<void> {
    const voucher = await this.voucherRepo.getVoucher(voucherId);
    if (!voucher || voucher.companyId !== companyId) throw new Error('Voucher not found');
    await this.permissionChecker.assertOrThrow(userId, companyId, 'voucher.update');
    if (voucher.status !== 'draft') throw new Error('Only draft vouchers can be updated');

    if (payload.lines) {
      for (const l of payload.lines) {
        const acc = await this.accountRepo.getById(companyId, l.accountId!);
        if (!acc || acc.active === false) throw new Error(`Account ${l.accountId} invalid`);
      }
      const totalDebitBase = payload.lines.reduce((s, l) => s + (l.debitBase || 0), 0);
      const totalCreditBase = payload.lines.reduce((s, l) => s + (l.creditBase || 0), 0);
      payload.totalDebitBase = totalDebitBase;
      payload.totalCreditBase = totalCreditBase;
      if (Math.abs(totalDebitBase - totalCreditBase) > 0.0001) {
        const err: any = new Error('Voucher not balanced');
        err.statusCode = 400;
        throw err;
      }
    }

    payload.updatedAt = new Date().toISOString();
    if (typeof payload.date === 'string') {
      payload.date = new Date(payload.date);
    }
    await this.voucherRepo.updateVoucher(voucherId, payload as any);
  }
}

export class ApproveVoucherUseCase {
  constructor(
    private voucherRepo: IVoucherRepository,
    private ledgerRepo: ILedgerRepository,
    private permissionChecker: PermissionChecker
  ) {}

  async execute(companyId: string, userId: string, voucherId: string): Promise<void> {
    const voucher = await this.voucherRepo.getVoucher(voucherId);
    if (!voucher || voucher.companyId !== companyId) throw new Error('Voucher not found');
    await this.permissionChecker.assertOrThrow(userId, companyId, 'voucher.approve');
    if (!['draft', 'pending'].includes(voucher.status)) throw new Error('Cannot approve from this status');
    assertBalanced(voucher);
    await this.ledgerRepo.recordForVoucher(voucher);
    await this.voucherRepo.updateVoucher(voucherId, { status: 'approved', approvedBy: userId, updatedAt: new Date().toISOString() } as any);
  }
}

export class LockVoucherUseCase {
  constructor(
    private voucherRepo: IVoucherRepository,
    private permissionChecker: PermissionChecker
  ) {}

  async execute(companyId: string, userId: string, voucherId: string): Promise<void> {
    const voucher = await this.voucherRepo.getVoucher(voucherId);
    if (!voucher || voucher.companyId !== companyId) throw new Error('Voucher not found');
    await this.permissionChecker.assertOrThrow(userId, companyId, 'voucher.lock');
    if (voucher.status !== 'approved') throw new Error('Only approved vouchers can be locked');
    await this.voucherRepo.updateVoucher(voucherId, { status: 'locked', lockedBy: userId, updatedAt: new Date().toISOString() } as any);
  }
}

export class CancelVoucherUseCase {
  constructor(
    private voucherRepo: IVoucherRepository,
    private ledgerRepo: ILedgerRepository,
    private permissionChecker: PermissionChecker
  ) {}

  async execute(companyId: string, userId: string, voucherId: string): Promise<void> {
    const voucher = await this.voucherRepo.getVoucher(voucherId);
    if (!voucher || voucher.companyId !== companyId) throw new Error('Voucher not found');
    await this.permissionChecker.assertOrThrow(userId, companyId, 'voucher.cancel');
    if (!['draft', 'pending', 'approved'].includes(voucher.status)) throw new Error('Cannot cancel from this status');
    await this.ledgerRepo.deleteForVoucher(companyId, voucherId);
    await this.voucherRepo.updateVoucher(voucherId, { status: 'cancelled', updatedAt: new Date().toISOString() } as any);
  }
}

export class GetVoucherUseCase {
  constructor(
    private voucherRepo: IVoucherRepository,
    private permissionChecker: PermissionChecker
  ) {}

  async execute(companyId: string, userId: string, voucherId: string): Promise<Voucher> {
    const voucher = await this.voucherRepo.getVoucher(voucherId);
    if (!voucher || voucher.companyId !== companyId) throw new Error('Voucher not found');
    await this.permissionChecker.assertOrThrow(userId, companyId, 'voucher.view');
    return voucher;
  }
}

export class ListVouchersUseCase {
  constructor(
    private voucherRepo: IVoucherRepository,
    private permissionChecker: PermissionChecker
  ) {}

  async execute(companyId: string, userId: string, filters?: any): Promise<Voucher[]> {
    await this.permissionChecker.assertOrThrow(userId, companyId, 'voucher.view');
    return this.voucherRepo.getVouchers(companyId, filters);
  }
}
