"use strict";
/**
 * VoucherFormController.ts
 *
 * API Controller for VoucherForms CRUD operations
 *
 * Endpoints:
 * GET    /tenant/accounting/voucher-forms         - List all forms for company
 * GET    /tenant/accounting/voucher-forms/:id     - Get form by ID
 * POST   /tenant/accounting/voucher-forms         - Create new form
 * PUT    /tenant/accounting/voucher-forms/:id     - Update form
 * DELETE /tenant/accounting/voucher-forms/:id     - Delete form
 * GET    /tenant/accounting/voucher-forms/by-type/:typeId - Get forms by type
 */
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
exports.VoucherFormController = void 0;
const bindRepositories_1 = require("../../../infrastructure/di/bindRepositories");
class VoucherFormController {
    /**
     * List all voucher forms for the current company
     */
    static async list(req, res, next) {
        try {
            const companyId = req.user.companyId;
            const forms = await bindRepositories_1.diContainer.voucherFormRepository.getAllByCompany(companyId);
            res.json({ success: true, data: forms });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Get a specific form by ID
     */
    static async getById(req, res, next) {
        try {
            const companyId = req.user.companyId;
            const { id } = req.params;
            const form = await bindRepositories_1.diContainer.voucherFormRepository.getById(companyId, id);
            if (!form) {
                const { BusinessError } = await Promise.resolve().then(() => __importStar(require('../../../errors/AppError')));
                const { ErrorCode } = await Promise.resolve().then(() => __importStar(require('../../../errors/ErrorCodes')));
                throw new BusinessError(ErrorCode.VOUCH_NOT_FOUND, `Form not found: ${id}`, { formId: id });
            }
            res.json({ success: true, data: form });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Get forms by type ID
     */
    static async getByType(req, res, next) {
        try {
            const companyId = req.user.companyId;
            const { typeId } = req.params;
            const forms = await bindRepositories_1.diContainer.voucherFormRepository.getByTypeId(companyId, typeId);
            res.json({ success: true, data: forms });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Create a new form
     */
    static async create(req, res, next) {
        var _a, _b;
        try {
            const companyId = req.user.companyId;
            const userId = req.user.uid;
            const formData = req.body;
            // Validate required fields
            if (!formData.name || !formData.code || !formData.typeId) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: name, code, typeId'
                });
            }
            // Generate ID if not provided
            const formId = formData.id || `form_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            const form = {
                id: formId,
                companyId,
                typeId: formData.typeId,
                name: formData.name,
                code: formData.code,
                description: formData.description || null,
                prefix: formData.prefix || null,
                isDefault: (_a = formData.isDefault) !== null && _a !== void 0 ? _a : false,
                isSystemGenerated: false,
                isLocked: false,
                enabled: (_b = formData.enabled) !== null && _b !== void 0 ? _b : true,
                headerFields: formData.headerFields || [],
                tableColumns: formData.tableColumns || [],
                layout: formData.layout || {},
                createdAt: new Date(),
                updatedAt: new Date(),
                createdBy: userId
            };
            const created = await bindRepositories_1.diContainer.voucherFormRepository.create(form);
            res.status(201).json({ success: true, data: created });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Update a form
     */
    static async update(req, res, next) {
        try {
            const companyId = req.user.companyId;
            const { id } = req.params;
            // Check if form exists
            const existing = await bindRepositories_1.diContainer.voucherFormRepository.getById(companyId, id);
            if (!existing) {
                return res.status(404).json({ success: false, error: 'Form not found' });
            }
            // Prevent editing locked forms
            if (existing.isLocked) {
                return res.status(403).json({
                    success: false,
                    error: 'Cannot edit locked form. Clone it instead.'
                });
            }
            const updates = req.body;
            // Prevent changing certain fields
            delete updates.id;
            delete updates.companyId;
            delete updates.createdAt;
            delete updates.createdBy;
            delete updates.isSystemGenerated;
            await bindRepositories_1.diContainer.voucherFormRepository.update(companyId, id, updates);
            const updated = await bindRepositories_1.diContainer.voucherFormRepository.getById(companyId, id);
            res.json({ success: true, data: updated });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Delete a form
     */
    static async delete(req, res, next) {
        try {
            const companyId = req.user.companyId;
            const { id } = req.params;
            // Check if form exists
            const existing = await bindRepositories_1.diContainer.voucherFormRepository.getById(companyId, id);
            if (!existing) {
                return res.status(404).json({ success: false, error: 'Form not found' });
            }
            // Prevent deleting locked or system-generated forms
            if (existing.isLocked || existing.isSystemGenerated) {
                return res.status(403).json({
                    success: false,
                    error: 'Cannot delete system or locked forms'
                });
            }
            await bindRepositories_1.diContainer.voucherFormRepository.delete(companyId, id);
            res.json({ success: true, message: 'Form deleted' });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Clone a form
     */
    static async clone(req, res, next) {
        try {
            const companyId = req.user.companyId;
            const userId = req.user.uid;
            const { id } = req.params;
            const { newName, newCode } = req.body;
            // Get source form
            const source = await bindRepositories_1.diContainer.voucherFormRepository.getById(companyId, id);
            if (!source) {
                return res.status(404).json({ success: false, error: 'Source form not found' });
            }
            // Create clone
            const cloneId = `form_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            const cloned = Object.assign(Object.assign({}, source), { id: cloneId, name: newName || `${source.name} (Copy)`, code: newCode || `${source.code}_COPY`, isDefault: false, isSystemGenerated: false, isLocked: false, createdAt: new Date(), updatedAt: new Date(), createdBy: userId });
            const created = await bindRepositories_1.diContainer.voucherFormRepository.create(cloned);
            res.status(201).json({ success: true, data: created });
        }
        catch (err) {
            next(err);
        }
    }
}
exports.VoucherFormController = VoucherFormController;
//# sourceMappingURL=VoucherFormController.js.map