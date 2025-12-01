
import { IUserRepository } from '../../../repository/interfaces/core/IUserRepository';
import { IImpersonationRepository } from '../../../repository/interfaces/impersonation/IImpersonationRepository';

export class StartImpersonationUseCase {
  constructor(
    private userRepo: IUserRepository,
    private impersonationRepo: IImpersonationRepository
  ) {}

  async execute(superAdminId: string, targetCompanyId: string): Promise<string> {
    const superAdmin = await this.userRepo.getUserById(superAdminId);
    if (!superAdmin || !superAdmin.isAdmin()) {
      throw new Error('Only SUPER_ADMIN can start impersonation');
    }

    // End any existing active session
    const existingSession = await this.impersonationRepo.getActiveSessionBySuperAdmin(superAdminId);
    if (existingSession) {
      await this.impersonationRepo.endSession(existingSession.id);
    }

    const session = await this.impersonationRepo.startSession(superAdminId, targetCompanyId);
    return session.id;
  }
}
