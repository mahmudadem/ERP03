"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeactivateCostCenterUseCase = exports.UpdateCostCenterUseCase = exports.CreateCostCenterUseCase = exports.ListCostCentersUseCase = void 0;
const crypto_1 = require("crypto");
const CostCenter_1 = require("../../../domain/accounting/entities/CostCenter");
class ListCostCentersUseCase {
    constructor(repo, permissionChecker) {
        this.repo = repo;
        this.permissionChecker = permissionChecker;
    }
    async execute(companyId, userId) {
        await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.accounts.view');
        return this.repo.findAll(companyId);
    }
}
exports.ListCostCentersUseCase = ListCostCentersUseCase;
class CreateCostCenterUseCase {
    constructor(repo, permissionChecker) {
        this.repo = repo;
        this.permissionChecker = permissionChecker;
    }
    async execute(companyId, userId, payload) {
        await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.settings.write');
        const existing = await this.repo.findByCode(companyId, payload.code);
        if (existing)
            throw new Error('Cost center code already exists');
        const cc = new CostCenter_1.CostCenter((0, crypto_1.randomUUID)(), companyId, payload.name, payload.code, payload.description || null, payload.parentId || null, CostCenter_1.CostCenterStatus.ACTIVE, new Date(), userId, new Date(), userId);
        const errors = cc.validate();
        if (errors.length)
            throw new Error(errors.join(', '));
        return this.repo.create(cc);
    }
}
exports.CreateCostCenterUseCase = CreateCostCenterUseCase;
class UpdateCostCenterUseCase {
    constructor(repo, permissionChecker) {
        this.repo = repo;
        this.permissionChecker = permissionChecker;
    }
    async execute(companyId, userId, id, payload) {
        var _a, _b, _c, _d;
        await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.settings.write');
        const existing = await this.repo.findById(companyId, id);
        if (!existing)
            throw new Error('Cost center not found');
        const updated = new CostCenter_1.CostCenter(existing.id, companyId, (_a = payload.name) !== null && _a !== void 0 ? _a : existing.name, (_b = payload.code) !== null && _b !== void 0 ? _b : existing.code, (_c = payload.description) !== null && _c !== void 0 ? _c : existing.description, payload.parentId === undefined ? existing.parentId : payload.parentId, (_d = payload.status) !== null && _d !== void 0 ? _d : existing.status, existing.createdAt, existing.createdBy, new Date(), userId);
        const errors = updated.validate();
        if (errors.length)
            throw new Error(errors.join(', '));
        return this.repo.update(updated);
    }
}
exports.UpdateCostCenterUseCase = UpdateCostCenterUseCase;
class DeactivateCostCenterUseCase {
    constructor(repo, permissionChecker) {
        this.repo = repo;
        this.permissionChecker = permissionChecker;
    }
    async execute(companyId, userId, id) {
        await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.settings.write');
        const existing = await this.repo.findById(companyId, id);
        if (!existing)
            throw new Error('Cost center not found');
        existing.deactivate(userId);
        return this.repo.update(existing);
    }
}
exports.DeactivateCostCenterUseCase = DeactivateCostCenterUseCase;
//# sourceMappingURL=CostCenterUseCases.js.map