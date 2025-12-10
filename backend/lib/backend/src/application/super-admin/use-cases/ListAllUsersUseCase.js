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
        return await this.userRepo.listAll();
    }
}
exports.ListAllUsersUseCase = ListAllUsersUseCase;
//# sourceMappingURL=ListAllUsersUseCase.js.map