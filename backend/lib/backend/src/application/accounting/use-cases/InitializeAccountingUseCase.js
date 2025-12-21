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
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
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
        // 1. Fetch COA Template from DB
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
        // 3. Copy Default Voucher Types to Company
        try {
            await this.copyDefaultVoucherTypes(companyId, config.selectedVoucherTypes || [] // Pass selected voucher type IDs
            );
            console.log(`[InitializeAccountingUseCase] Copied default voucher types to company.`);
        }
        catch (error) {
            console.warn(`[InitializeAccountingUseCase] Failed to copy voucher types:`, error);
            // Don't fail initialization if voucher copy fails
        }
        // 4. Mark Module as Initialized
        await this.companyModuleRepo.update(companyId, 'accounting', {
            initialized: true,
            initializationStatus: 'complete',
            config,
            updatedAt: new Date()
        });
        console.log(`[InitializeAccountingUseCase] Module marked as initialized.`);
    }
    /**
     * Copy default voucher types from system_metadata to company
     * Only copies the voucher types specified in selectedVoucherTypeIds
     */
    async copyDefaultVoucherTypes(companyId, selectedVoucherTypeIds) {
        const db = admin.firestore();
        // If no vouchers selected, skip copying
        if (!selectedVoucherTypeIds || selectedVoucherTypeIds.length === 0) {
            console.log(`[InitializeAccountingUseCase] No voucher types selected, skipping copy`);
            return;
        }
        // Load default voucher types from system_metadata/voucher_types/items
        const defaultVouchersRef = db
            .collection('system_metadata')
            .doc('voucher_types')
            .collection('items');
        const snapshot = await defaultVouchersRef.get();
        if (snapshot.empty) {
            console.warn(`[InitializeAccountingUseCase] No default voucher types found in system_metadata`);
            return;
        }
        const batch = db.batch();
        let count = 0;
        snapshot.forEach(doc => {
            // Only copy if this voucher type was selected
            if (!selectedVoucherTypeIds.includes(doc.id)) {
                return; // Skip this one
            }
            const voucherType = doc.data();
            // Create a copy for this company
            const companyVoucherRef = db
                .collection('companies')
                .doc(companyId)
                .collection('voucherTypes')
                .doc(doc.id);
            // Add company-specific metadata
            const companyVoucher = Object.assign(Object.assign({}, voucherType), { companyId, isSystemDefault: true, isLocked: true, enabled: true, inUse: false, createdAt: firestore_1.FieldValue.serverTimestamp(), updatedAt: firestore_1.FieldValue.serverTimestamp() });
            batch.set(companyVoucherRef, companyVoucher);
            count++;
        });
        await batch.commit();
        console.log(`[InitializeAccountingUseCase] Copied ${count} default voucher types to company ${companyId}`);
    }
}
exports.InitializeAccountingUseCase = InitializeAccountingUseCase;
//# sourceMappingURL=InitializeAccountingUseCase.js.map