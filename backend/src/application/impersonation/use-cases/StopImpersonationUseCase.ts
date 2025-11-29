
import { IUserRepository } from '../../../repository/interfaces/core/IUserRepository';
import { IImpersonationRepository } from '../../../repository/interfaces/impersonation/IImpersonationRepository';

export class StopImpersonationUseCase {
  constructor(
    private userRepo: IUserRepository,
    private impersonationRepo: IImpersonationRepository
  ) {}

  async execute(superAdminId: string): Promise<void> {
    const superAdmin = await this.userRepo.getUserById(superAdminId);
    if (!superAdmin || !superAdmin.isAdmin()) {
      throw new Error('Only SUPER_ADMIN can stop impersonation');
    }

    const activeSession = await this.impersonationRepo.getActiveSessionBySuperAdmin(superAdminId);
    if (!activeSession) {
      throw new Error('No active impersonation session found');
    }

    await this.impersonationRepo.endSession(activeSession.id);
  }
}
