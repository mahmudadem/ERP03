
import { IUserRepository } from '../../../repository/interfaces/core/IUserRepository';
import { User } from '../../../domain/core/entities/User';

export class ListAllUsersUseCase {
  constructor(private userRepo: IUserRepository) {}

  async execute(actorId: string): Promise<User[]> {
    const actor = await this.userRepo.getUserById(actorId);
    if (!actor || !actor.isAdmin()) {
      throw new Error('Only SUPER_ADMIN can list all users');
    }

    // This would require adding a listAll method to IUserRepository
    // For now, we'll throw an error indicating implementation needed
    throw new Error('ListAllUsers requires IUserRepository.listAll() implementation');
  }
}
