"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdoptTemplateUseCase = exports.ValidateDynamicFieldRulesUseCase = exports.UpdateVoucherTypeDefinitionUseCase = exports.CreateVoucherTypeDefinitionUseCase = exports.UpdateFormDefinitionUseCase = exports.CreateFormDefinitionUseCase = void 0;
const VoucherTypeDefinition_1 = require("../../../domain/designer/entities/VoucherTypeDefinition");
const VoucherTypeDefinitionValidator_1 = require("../../../domain/designer/validators/VoucherTypeDefinitionValidator");
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
        // STEP 3 ENFORCEMENT: Validate before save
        VoucherTypeDefinitionValidator_1.VoucherTypeDefinitionValidator.validate(def);
        await this.repo.createVoucherType(def);
    }
}
exports.CreateVoucherTypeDefinitionUseCase = CreateVoucherTypeDefinitionUseCase;
class UpdateVoucherTypeDefinitionUseCase {
    constructor(repo) {
        this.repo = repo;
    }
    async execute(companyId, id, data) {
        await this.repo.updateVoucherType(companyId, id, data);
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
class AdoptTemplateUseCase {
    constructor(voucherTypeRepo, voucherFormRepo) {
        this.voucherTypeRepo = voucherTypeRepo;
        this.voucherFormRepo = voucherFormRepo;
    }
    async execute(input) {
        var _a;
        const { companyId, userId, templateId, module } = input;
        // 1. Get system template
        const systemTemplates = await this.voucherTypeRepo.getSystemTemplates();
        const template = systemTemplates.find(t => t.id === templateId || t.code === templateId);
        if (!template) {
            throw new Error(`Template not found: ${templateId}`);
        }
        // 2. Check if company already has this voucher type
        const existingType = await this.voucherTypeRepo.getByCode(companyId, template.code);
        let voucherTypeId;
        if (existingType) {
            voucherTypeId = existingType.id;
        }
        else {
            // 3. Clone voucher type to company
            const { randomUUID } = await Promise.resolve().then(() => __importStar(require('crypto')));
            const newType = new VoucherTypeDefinition_1.VoucherTypeDefinition(randomUUID(), companyId, template.name, template.code, module, template.headerFields, template.tableColumns, template.layout, template.schemaVersion || 2, template.requiredPostingRoles, template.workflow, template.uiModeOverrides, (_a = template.isMultiLine) !== null && _a !== void 0 ? _a : true, template.rules, template.actions, template.defaultCurrency, template.voucherType, template.persona);
            await this.voucherTypeRepo.createVoucherType(newType);
            voucherTypeId = newType.id;
        }
        // 4. Return the formId (same as voucherTypeId for default forms)
        return { formId: voucherTypeId, voucherTypeId };
    }
}
exports.AdoptTemplateUseCase = AdoptTemplateUseCase;
//# sourceMappingURL=DesignerUseCases.js.map