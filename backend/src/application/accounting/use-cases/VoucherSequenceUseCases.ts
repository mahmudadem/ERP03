import { PermissionChecker } from '../../rbac/PermissionChecker';
import { IVoucherSequenceRepository } from '../../../repository/interfaces/accounting/IVoucherSequenceRepository';

export class ListVoucherSequencesUseCase {
  constructor(private repo: IVoucherSequenceRepository, private permission: PermissionChecker) {}
  async execute(companyId: string, userId: string) {
    await this.permission.assertOrThrow(userId, companyId, 'accounting.settings.write');
    return this.repo.listSequences(companyId);
  }
}

export class SetNextVoucherNumberUseCase {
  constructor(private repo: IVoucherSequenceRepository, private permission: PermissionChecker) {}
  async execute(companyId: string, userId: string, prefix: string, nextNumber: number, year?: number) {
    await this.permission.assertOrThrow(userId, companyId, 'accounting.settings.write');
    await this.repo.setNextNumber(companyId, prefix, nextNumber, year);
  }
}
