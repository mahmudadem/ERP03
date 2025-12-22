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
        // 2. Create Accounts - Use CODE as ID (industry standard)
        // Parent references use account codes directly
        const promises = templateAccounts.map((tpl) => {
            const input = {
                // No 'id' field - repository will use code as doc ID
                code: tpl.code,
                name: tpl.name,
                type: tpl.type,
                parentId: tpl.parentId || null,
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
        const copiedTypes = [];
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
            copiedTypes.push({ id: doc.id, data: companyVoucher });
            count++;
        });
        await batch.commit();
        console.log(`[InitializeAccountingUseCase] Copied ${count} default voucher types to company ${companyId}`);
        // Now create default forms for each copied type
        await this.createDefaultFormsForTypes(companyId, copiedTypes);
    }
    /**
     * Create default VoucherForms for each VoucherType
     * Each type gets one default form that matches its layout
     * Uses the same ID as the type for simplicity
     */
    async createDefaultFormsForTypes(companyId, types) {
        var _a, _b, _c;
        const db = admin.firestore();
        const batch = db.batch();
        for (const type of types) {
            // Use same ID as type for the default form (simpler)
            const formId = type.id;
            const formRef = db
                .collection('companies')
                .doc(companyId)
                .collection('voucherForms')
                .doc(formId);
            // Extract UI layout from the type definition
            const form = {
                id: formId,
                companyId,
                typeId: type.id,
                name: type.data.name || type.id,
                code: type.data.code || type.id,
                description: `Default form for ${type.data.name || type.id}`,
                prefix: type.data.prefix || ((_a = type.data.code) === null || _a === void 0 ? void 0 : _a.slice(0, 3).toUpperCase()) || 'V',
                isDefault: true,
                isSystemGenerated: true,
                isLocked: true,
                enabled: true,
                // Copy layout from type definition
                headerFields: type.data.headerFields || ((_b = type.data.fields) === null || _b === void 0 ? void 0 : _b.filter((f) => f.section === 'header')) || [],
                tableColumns: type.data.tableColumns || ((_c = type.data.fields) === null || _c === void 0 ? void 0 : _c.filter((f) => f.section === 'table')) || [],
                layout: type.data.layout || {
                    theme: 'default',
                    showTotals: true
                },
                createdAt: firestore_1.FieldValue.serverTimestamp(),
                updatedAt: firestore_1.FieldValue.serverTimestamp(),
                createdBy: 'system'
            };
            batch.set(formRef, form);
        }
        await batch.commit();
        console.log(`[InitializeAccountingUseCase] Created ${types.length} default forms in voucherForms collection`);
    }
}
exports.InitializeAccountingUseCase = InitializeAccountingUseCase;
//# sourceMappingURL=InitializeAccountingUseCase.js.map