"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidateDynamicFieldRulesUseCase = exports.UpdateVoucherTypeDefinitionUseCase = exports.CreateVoucherTypeDefinitionUseCase = exports.UpdateFormDefinitionUseCase = exports.CreateFormDefinitionUseCase = void 0;
class CreateFormDefinitionUseCase {
    constructor(repo) {
        this.repo = repo;
    }
    async execute(def) {
        await this.repo.createFormDefinition(def);
    }
}
exports.CreateFormDefinitionUseCase = CreateFormDefinitionUseCase;
class UpdateFormDefinitionUseCase {
    constructor(repo) {
        this.repo = repo;
    }
    async execute(id, data) {
        await this.repo.updateFormDefinition(id, data);
    }
}
exports.UpdateFormDefinitionUseCase = UpdateFormDefinitionUseCase;
class CreateVoucherTypeDefinitionUseCase {
    constructor(repo) {
        this.repo = repo;
    }
    async execute(def) {
        await this.repo.createVoucherType(def);
    }
}
exports.CreateVoucherTypeDefinitionUseCase = CreateVoucherTypeDefinitionUseCase;
class UpdateVoucherTypeDefinitionUseCase {
    constructor(repo) {
        this.repo = repo;
    }
    async execute(id, data) {
        await this.repo.updateVoucherType(id, data);
    }
}
exports.UpdateVoucherTypeDefinitionUseCase = UpdateVoucherTypeDefinitionUseCase;
class ValidateDynamicFieldRulesUseCase {
    // Logic to validate rules structure itself (e.g. infinite loops in visibility)
    async execute(rules) {
        return true; // Placeholder for logic
    }
}
exports.ValidateDynamicFieldRulesUseCase = ValidateDynamicFieldRulesUseCase;
//# sourceMappingURL=DesignerUseCases.js.map