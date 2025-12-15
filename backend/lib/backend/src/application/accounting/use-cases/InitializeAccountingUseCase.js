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
exports.InitializeAccountingUseCase = void 0;
const crypto = __importStar(require("crypto"));
class InitializeAccountingUseCase {
    constructor(companyModuleRepo, accountRepo, systemMetadataRepo) {
        this.companyModuleRepo = companyModuleRepo;
        this.accountRepo = accountRepo;
        this.systemMetadataRepo = systemMetadataRepo;
    }
    async execute(request) {
        const { companyId, config } = request;
        console.log(`[InitializeAccountingUseCase] Initializing for ${companyId} with template ${config.coaTemplate}`);
        // 1. Fetch Template from DB
        const templates = await this.systemMetadataRepo.getMetadata('coa_templates');
        const selectedTemplate = templates.find((t) => t.id === config.coaTemplate);
        if (!selectedTemplate || !selectedTemplate.accounts) {
            throw new Error(`COA Template '${config.coaTemplate}' not found in system metadata.`);
        }
        const templateAccounts = selectedTemplate.accounts;
        // 2. Create Accounts
        const codeToIdMap = new Map();
        // First pass: Generate IDs map
        for (const tpl of templateAccounts) {
            const id = crypto.randomUUID();
            codeToIdMap.set(tpl.code, id);
        }
        // Second pass: Create accounts
        const promises = templateAccounts.map((tpl) => {
            const id = codeToIdMap.get(tpl.code);
            let parentId = null;
            if (tpl.parentId && codeToIdMap.has(tpl.parentId)) {
                parentId = codeToIdMap.get(tpl.parentId);
            }
            const input = {
                id,
                code: tpl.code,
                name: tpl.name,
                type: tpl.type,
                parentId,
                currency: config.baseCurrency
            };
            return this.accountRepo.create(companyId, input);
        });
        await Promise.all(promises);
        console.log(`[InitializeAccountingUseCase] Created ${promises.length} accounts.`);
        // 3. Mark Module as Initialized
        await this.companyModuleRepo.update(companyId, 'accounting', {
            initialized: true,
            initializationStatus: 'complete',
            config,
            updatedAt: new Date()
        });
        console.log(`[InitializeAccountingUseCase] Module marked as initialized.`);
    }
}
exports.InitializeAccountingUseCase = InitializeAccountingUseCase;
//# sourceMappingURL=InitializeAccountingUseCase.js.map