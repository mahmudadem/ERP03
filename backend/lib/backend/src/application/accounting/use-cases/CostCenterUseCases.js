"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateCostCenterUseCase = exports.CreateCostCenterUseCase = void 0;
const CostCenter_1 = require("../../../domain/accounting/entities/CostCenter");
class CreateCostCenterUseCase {
    constructor(repo) {
        this.repo = repo;
    }
    async execute(data) {
        const cc = new CostCenter_1.CostCenter(`cc_${Date.now()}`, data.companyId, data.name, data.code);
        await this.repo.createCostCenter(cc);
    }
}
exports.CreateCostCenterUseCase = CreateCostCenterUseCase;
class UpdateCostCenterUseCase {
    constructor(repo) {
        this.repo = repo;
    }
    async execute(id, data) {
        await this.repo.updateCostCenter(id, data);
    }
}
exports.UpdateCostCenterUseCase = UpdateCostCenterUseCase;
//# sourceMappingURL=CostCenterUseCases.js.map