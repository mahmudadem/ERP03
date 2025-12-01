
import { IUserRepository } from '../../../repository/interfaces/core/IUserRepository';

export class PromoteUserToSuperAdminUseCase {
  constructor(private userRepo: IUserRepository) {}

  async execute(userId: string, actorId: string): Promise<void> {
    const actor = await this.userRepo.getUserById(actorId);
    if (!actor || !actor.isAdmin()) {
      throw new Error('Only SUPER_ADMIN can promote users');
    }

    const targetUser = await this.userRepo.getUserById(userId);
    if (!targetUser) {
      throw new Error('User not found');
    }

    if (targetUser.globalRole === 'SUPER_ADMIN') {
      throw new Error('User is already a SUPER_ADMIN');
    }

    await this.userRepo.updateGlobalRole(userId, 'SUPER_ADMIN');
  }
}
