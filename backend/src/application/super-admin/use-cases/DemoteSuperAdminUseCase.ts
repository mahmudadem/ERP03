
import { IUserRepository } from '../../../repository/interfaces/core/IUserRepository';

export class DemoteSuperAdminUseCase {
  constructor(private userRepo: IUserRepository) {}

  async execute(userId: string, actorId: string): Promise<void> {
    const actor = await this.userRepo.getUserById(actorId);
    if (!actor || !actor.isAdmin()) {
      throw new Error('Only SUPER_ADMIN can demote users');
    }

    if (userId === actorId) {
      throw new Error('Cannot demote yourself');
    }

    const targetUser = await this.userRepo.getUserById(userId);
    if (!targetUser) {
      throw new Error('User not found');
    }

    if (targetUser.globalRole === 'USER') {
      throw new Error('User is already a regular USER');
    }

    await this.userRepo.updateGlobalRole(userId, 'USER');
  }
}
