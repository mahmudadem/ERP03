
import { IUserRepository } from '../../../repository/interfaces/core/IUserRepository';

export interface SystemOverview {
  totalUsers: number;
  totalCompanies: number;
  totalVouchers: number;
  totalInventoryItems: number;
  totalEmployees: number;
}

export class GetSystemOverviewUseCase {
  constructor(private userRepo: IUserRepository) {}

  async execute(actorId: string): Promise<SystemOverview> {
    const actor = await this.userRepo.getUserById(actorId);
    if (!actor || !actor.isAdmin()) {
      throw new Error('Only SUPER_ADMIN can view system overview');
    }

    // This would require aggregation across multiple repositories
    // For now, return placeholder data
    return {
      totalUsers: 0,
      totalCompanies: 0,
      totalVouchers: 0,
      totalInventoryItems: 0,
      totalEmployees: 0
    };
  }
}
