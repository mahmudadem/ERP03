"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeleteBusinessDomainUseCase = void 0;
class DeleteBusinessDomainUseCase {
    constructor(businessDomainRepo) {
        this.businessDomainRepo = businessDomainRepo;
    }
    async execute(id) {
        await this.businessDomainRepo.delete(id);
    }
}
exports.DeleteBusinessDomainUseCase = DeleteBusinessDomainUseCase;
//# sourceMappingURL=DeleteBusinessDomainUseCase.js.map