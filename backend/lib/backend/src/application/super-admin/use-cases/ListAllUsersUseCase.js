"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListAllUsersUseCase = void 0;
class ListAllUsersUseCase {
    constructor(userRepo) {
        this.userRepo = userRepo;
    }
    async execute(actorId) {
        const actor = await this.userRepo.getUserById(actorId);
        if (!actor || !actor.isAdmin()) {
            throw new Error('Only SUPER_ADMIN can list all users');
        }
        // This would require adding a listAll method to IUserRepository
        // For now, we'll throw an error indicating implementation needed
        throw new Error('ListAllUsers requires IUserRepository.listAll() implementation');
    }
}
exports.ListAllUsersUseCase = ListAllUsersUseCase;
//# sourceMappingURL=ListAllUsersUseCase.js.map