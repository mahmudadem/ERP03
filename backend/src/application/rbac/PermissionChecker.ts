
import { GetCurrentUserPermissionsForCompanyUseCase } from './use-cases/GetCurrentUserPermissionsForCompanyUseCase';
import { ApiError } from '../../api/errors/ApiError';

export class PermissionChecker {
  constructor(private getPermissionsUC: GetCurrentUserPermissionsForCompanyUseCase) {}

  async assertOrThrow(userId: string, companyId: string, required: string) {
    if (await this.hasPermission(userId, companyId, required)) return;
    throw ApiError.forbidden(`Missing permission '${required}'`);
  }

  async hasPermission(userId: string, companyId: string, required: string): Promise<boolean> {
    const perms = await this.getPermissionsUC.execute({ userId, companyId });
    if (perms.includes("*")) return true;

    return perms.some(p => {
      // Direct match
      if (p === required) return true;
      // Parent permission: if user has 'accounting.vouchers', they have 'accounting.vouchers.approve'
      const isParent = required.startsWith(p + '.');
      return isParent;
    });
  }
}
