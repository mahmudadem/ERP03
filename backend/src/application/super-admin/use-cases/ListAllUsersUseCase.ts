
import { IUserRepository } from '../../../repository/interfaces/core/IUserRepository';
import { User } from '../../../domain/core/entities/User';

export class ListAllUsersUseCase {
  constructor(private userRepo: IUserRepository) {}

  async execute(actorId: string): Promise<User[]> {
    const actor = await this.userRepo.getUserById(actorId);
    if (!actor || !actor.isAdmin()) {
      throw new Error('Only SUPER_ADMIN can list all users');
    }

    return await this.userRepo.listAll();
  }
}
