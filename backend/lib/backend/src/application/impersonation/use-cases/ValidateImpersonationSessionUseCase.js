"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidateImpersonationSessionUseCase = void 0;
class ValidateImpersonationSessionUseCase {
    constructor(impersonationRepo) {
        this.impersonationRepo = impersonationRepo;
    }
    async execute(sessionId) {
        const session = await this.impersonationRepo.getSession(sessionId);
        if (!session || !session.active) {
            return null;
        }
        return session;
    }
}
exports.ValidateImpersonationSessionUseCase = ValidateImpersonationSessionUseCase;
//# sourceMappingURL=ValidateImpersonationSessionUseCase.js.map