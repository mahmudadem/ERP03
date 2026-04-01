"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetMovementForReferenceUseCase = void 0;
class GetMovementForReferenceUseCase {
    constructor(movementRepo) {
        this.movementRepo = movementRepo;
    }
    async execute(companyId, referenceType, referenceId, referenceLineId) {
        if (!(referenceId === null || referenceId === void 0 ? void 0 : referenceId.trim()))
            throw new Error('referenceId is required');
        return this.movementRepo.getMovementByReference(companyId, referenceType, referenceId, referenceLineId);
    }
}
exports.GetMovementForReferenceUseCase = GetMovementForReferenceUseCase;
//# sourceMappingURL=ReferenceQueryUseCases.js.map