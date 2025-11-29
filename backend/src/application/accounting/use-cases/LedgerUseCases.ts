import { ILedgerRepository, TrialBalanceRow, GLFilters } from '../../../repository/interfaces/accounting/ILedgerRepository';
import { PermissionChecker } from '../../rbac/PermissionChecker';
import { Voucher } from '../../../domain/accounting/models/Voucher';

export class RecordVoucherLedgerUseCase {
  constructor(
    private ledgerRepo: ILedgerRepository,
    private permissionChecker: PermissionChecker
  ) {}

  async execute(companyId: string, userId: string, voucher: Voucher) {
    await this.permissionChecker.assertOrThrow(userId, companyId, 'voucher.approve');
    await this.ledgerRepo.recordForVoucher(voucher);
  }
}

export class DeleteVoucherLedgerUseCase {
  constructor(
    private ledgerRepo: ILedgerRepository,
    private permissionChecker: PermissionChecker
  ) {}

  async execute(companyId: string, userId: string, voucherId: string) {
    await this.permissionChecker.assertOrThrow(userId, companyId, 'voucher.cancel');
    await this.ledgerRepo.deleteForVoucher(companyId, voucherId);
  }
}

export class GetTrialBalanceUseCase {
  constructor(
    private ledgerRepo: ILedgerRepository,
    private permissionChecker: PermissionChecker
  ) {}

  async execute(companyId: string, userId: string, asOfDate: string): Promise<TrialBalanceRow[]> {
    await this.permissionChecker.assertOrThrow(userId, companyId, 'report.trialBalance');
    return this.ledgerRepo.getTrialBalance(companyId, asOfDate);
  }
}

export class GetGeneralLedgerUseCase {
  constructor(
    private ledgerRepo: ILedgerRepository,
    private permissionChecker: PermissionChecker
  ) {}

  async execute(companyId: string, userId: string, filters: GLFilters) {
    await this.permissionChecker.assertOrThrow(userId, companyId, 'report.generalLedger');
    return this.ledgerRepo.getGeneralLedger(companyId, filters);
  }
}

export class GetJournalUseCase {
  constructor(
    private ledgerRepo: ILedgerRepository,
    private permissionChecker: PermissionChecker
  ) {}

  async execute(companyId: string, userId: string, filters: GLFilters) {
    await this.permissionChecker.assertOrThrow(userId, companyId, 'report.journal');
    return this.ledgerRepo.getGeneralLedger(companyId, filters);
  }
}
