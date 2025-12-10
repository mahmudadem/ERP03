"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListBusinessDomainsUseCase = void 0;
class ListBusinessDomainsUseCase {
    constructor(businessDomainRepo) {
        this.businessDomainRepo = businessDomainRepo;
    }
    async execute() {
        return await this.businessDomainRepo.getAll();
    }
}
exports.ListBusinessDomainsUseCase = ListBusinessDomainsUseCase;
//# sourceMappingURL=ListBusinessDomainsUseCase.js.map