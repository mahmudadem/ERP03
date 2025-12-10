"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateBusinessDomainUseCase = void 0;
class CreateBusinessDomainUseCase {
    constructor(businessDomainRepo) {
        this.businessDomainRepo = businessDomainRepo;
    }
    async execute(input) {
        const domain = Object.assign(Object.assign({}, input), { createdAt: new Date(), updatedAt: new Date() });
        await this.businessDomainRepo.create(domain);
    }
}
exports.CreateBusinessDomainUseCase = CreateBusinessDomainUseCase;
//# sourceMappingURL=CreateBusinessDomainUseCase.js.map