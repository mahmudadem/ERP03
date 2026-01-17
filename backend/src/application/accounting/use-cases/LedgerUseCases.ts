import { ILedgerRepository, TrialBalanceRow, GLFilters } from '../../../repository/interfaces/accounting/ILedgerRepository';
import { PermissionChecker } from '../../rbac/PermissionChecker';

/**
 * DeleteVoucherLedgerUseCase
 * 
 * Removes ledger entries for a voucher.
 * CAUTION: Should only be used for corrections/unposting where allowed by policy.
 * Standard accounting practice prefers reversal entries.
 */
export class DeleteVoucherLedgerUseCase {
  constructor(
    private ledgerRepo: ILedgerRepository,
    private permissionChecker: PermissionChecker
  ) {}

  async execute(companyId: string, userId: string, voucherId: string) {
    await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.vouchers.cancel');
    await this.ledgerRepo.deleteForVoucher(companyId, voucherId);
  }
}

export class GetTrialBalanceUseCase {
  constructor(
    private ledgerRepo: ILedgerRepository,
    private permissionChecker: PermissionChecker
  ) {}

  async execute(companyId: string, userId: string, asOfDate: string): Promise<TrialBalanceRow[]> {
    await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.reports.trialBalance.view');
    return this.ledgerRepo.getTrialBalance(companyId, asOfDate);
  }
}

export class GetGeneralLedgerUseCase {
  constructor(
    private ledgerRepo: ILedgerRepository,
    private permissionChecker: PermissionChecker
  ) {}

  async execute(companyId: string, userId: string, filters: GLFilters) {
    await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.reports.generalLedger.view');
    return this.ledgerRepo.getGeneralLedger(companyId, filters);
  }
}

export class GetJournalUseCase {
  constructor(
    private ledgerRepo: ILedgerRepository,
    private permissionChecker: PermissionChecker
  ) {}

  async execute(companyId: string, userId: string, filters: GLFilters) {
    await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.vouchers.view');
    return this.ledgerRepo.getGeneralLedger(companyId, filters);
  }
}
