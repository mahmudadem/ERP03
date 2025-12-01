
import { GetCurrentUserPermissionsForCompanyUseCase } from './use-cases/GetCurrentUserPermissionsForCompanyUseCase';
import { ApiError } from '../../api/errors/ApiError';

export class PermissionChecker {
  constructor(private getPermissionsUC: GetCurrentUserPermissionsForCompanyUseCase) {}

  async assertOrThrow(userId: string, companyId: string, required: string) {
    const perms = await this.getPermissionsUC.execute({ userId, companyId });
    if (perms.includes("*") || perms.includes(required)) return;
    throw ApiError.forbidden(`Missing permission '${required}'`);
  }

  async hasPermission(userId: string, companyId: string, required: string): Promise<boolean> {
    const perms = await this.getPermissionsUC.execute({ userId, companyId });
    return perms.includes("*") || perms.includes(required);
  }
}
