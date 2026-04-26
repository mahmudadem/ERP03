"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SuperAdminVoucherTypeController = void 0;
const bindRepositories_1 = require("../../../infrastructure/di/bindRepositories");
const ApiError_1 = require("../../errors/ApiError");
const VoucherTypeDefinition_1 = require("../../../domain/designer/entities/VoucherTypeDefinition");
const crypto_1 = require("crypto");
const SYSTEM_COMPANY_ID = 'SYSTEM';
const inferFieldClass = (field) => {
    if (field.fieldClass)
        return field.fieldClass;
    if (field.bindingTarget === 'metadata.customFields')
        return 'custom_metadata';
    if (field.computed || field.calculated || field.autoManaged || field.readOnly)
        return 'computed';
    if (field.required || field.mandatory || field.isPosting)
        return 'system_core';
    return 'system_optional';
};
const normalizeFields = (fields = []) => fields.map((field) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    return (Object.assign(Object.assign({}, field), { id: field.id || field.name, name: field.name || field.id, type: field.type || 'TEXT', required: (_a = field.required) !== null && _a !== void 0 ? _a : false, readOnly: (_b = field.readOnly) !== null && _b !== void 0 ? _b : false, isPosting: (_c = field.isPosting) !== null && _c !== void 0 ? _c : false, postingRole: field.isPosting ? ((_d = field.postingRole) !== null && _d !== void 0 ? _d : null) : null, schemaVersion: (_e = field.schemaVersion) !== null && _e !== void 0 ? _e : 2, fieldClass: inferFieldClass(field), bindingTarget: field.bindingTarget || (inferFieldClass(field) === 'custom_metadata' ? 'metadata.customFields' : 'payload'), nameLocked: (_f = field.nameLocked) !== null && _f !== void 0 ? _f : false, computed: (_j = (_h = (_g = field.computed) !== null && _g !== void 0 ? _g : field.calculated) !== null && _h !== void 0 ? _h : field.autoManaged) !== null && _j !== void 0 ? _j : false }));
});
const inferLineFieldsFromTableColumns = (tableColumns = []) => tableColumns.map((column) => {
    var _a, _b, _c, _d, _e;
    return ({
        id: column.fieldId || column.id,
        name: column.fieldId || column.id,
        label: column.label || column.labelOverride || column.fieldId || column.id || '',
        type: column.type || 'TEXT',
        required: (_b = (_a = column.required) !== null && _a !== void 0 ? _a : column.mandatory) !== null && _b !== void 0 ? _b : false,
        readOnly: (_c = column.readOnly) !== null && _c !== void 0 ? _c : false,
        isPosting: false,
        postingRole: null,
        schemaVersion: 2,
        fieldClass: inferFieldClass(column),
        bindingTarget: 'payload',
        nameLocked: (_d = column.nameLocked) !== null && _d !== void 0 ? _d : false,
        computed: (_e = column.readOnly) !== null && _e !== void 0 ? _e : false,
    });
});
const normalizeLayout = (layout = {}, tableColumns = []) => (Object.assign(Object.assign({}, layout), { lineFields: Array.isArray(layout.lineFields) && layout.lineFields.length > 0
        ? normalizeFields(layout.lineFields)
        : inferLineFieldsFromTableColumns(tableColumns) }));
const normalizeTemplateForResponse = (template) => (Object.assign(Object.assign({}, template), { headerFields: normalizeFields(template.headerFields || []), layout: normalizeLayout(template.layout || {}, template.tableColumns || []) }));
const findSystemTemplate = async (id, payload) => {
    const byId = await bindRepositories_1.diContainer.voucherTypeDefinitionRepository.getVoucherType(SYSTEM_COMPANY_ID, id);
    if (byId)
        return byId;
    const byCode = await bindRepositories_1.diContainer.voucherTypeDefinitionRepository.getByCode(SYSTEM_COMPANY_ID, id);
    if (byCode)
        return byCode;
    if (payload === null || payload === void 0 ? void 0 : payload.code) {
        const byPayloadCode = await bindRepositories_1.diContainer.voucherTypeDefinitionRepository.getByCode(SYSTEM_COMPANY_ID, payload.code);
        if (byPayloadCode)
            return byPayloadCode;
    }
    const templates = await bindRepositories_1.diContainer.voucherTypeDefinitionRepository.getSystemTemplates();
    return templates.find((template) => template.id === id ||
        template.code === id ||
        ((payload === null || payload === void 0 ? void 0 : payload.code) && template.code === payload.code)) || null;
};
const buildSystemTemplate = (payload) => {
    var _a;
    return new VoucherTypeDefinition_1.VoucherTypeDefinition((0, crypto_1.randomUUID)(), SYSTEM_COMPANY_ID, payload.name, payload.code, payload.module, normalizeFields(payload.headerFields || []), payload.tableColumns || [], normalizeLayout(payload.layout || {}, payload.tableColumns || []), Math.max(Number(payload.schemaVersion) || 2, 2), payload.requiredPostingRoles || [], payload.workflow, payload.uiModeOverrides, (_a = payload.isMultiLine) !== null && _a !== void 0 ? _a : true, payload.rules || [], payload.actions || [], payload.defaultCurrency);
};
const buildSystemTemplateUpdates = (payload) => {
    const updates = {};
    const copyKeys = [
        'name',
        'code',
        'module',
        'tableColumns',
        'requiredPostingRoles',
        'workflow',
        'uiModeOverrides',
        'isMultiLine',
        'rules',
        'actions',
        'defaultCurrency',
    ];
    copyKeys.forEach((key) => {
        if (payload[key] !== undefined)
            updates[key] = payload[key];
    });
    if (payload.headerFields !== undefined) {
        updates.headerFields = normalizeFields(payload.headerFields || []);
    }
    if (payload.layout !== undefined || payload.tableColumns !== undefined) {
        const nextTableColumns = payload.tableColumns !== undefined ? (payload.tableColumns || []) : undefined;
        updates.layout = normalizeLayout(payload.layout || {}, nextTableColumns || []);
    }
    updates.schemaVersion = Math.max(Number(payload.schemaVersion) || 2, 2);
    return updates;
};
class SuperAdminVoucherTypeController {
    static async listSystemTemplates(req, res, next) {
        try {
            const templates = await bindRepositories_1.diContainer.voucherTypeDefinitionRepository.getSystemTemplates();
            res.status(200).json({
                success: true,
                data: templates.map(normalizeTemplateForResponse)
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async createSystemTemplate(req, res, next) {
        try {
            const payload = req.body;
            const template = buildSystemTemplate(payload);
            await bindRepositories_1.diContainer.voucherTypeDefinitionRepository.createVoucherType(template);
            res.status(201).json({
                success: true,
                data: template
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async updateSystemTemplate(req, res, next) {
        try {
            const id = req.params.id;
            const payload = req.body;
            // Ensure we are updating a SYSTEM template
            const existing = await findSystemTemplate(id, payload);
            if (!existing)
                throw ApiError_1.ApiError.notFound('System template not found');
            const targetId = existing.id || id;
            await bindRepositories_1.diContainer.voucherTypeDefinitionRepository.updateVoucherType(SYSTEM_COMPANY_ID, targetId, buildSystemTemplateUpdates(payload));
            res.status(200).json({
                success: true,
                message: 'Template updated'
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async deleteSystemTemplate(req, res, next) {
        try {
            const id = req.params.id;
            // Ensure we are deleting a SYSTEM template
            const existing = await findSystemTemplate(id);
            if (!existing)
                throw ApiError_1.ApiError.notFound('System template not found');
            const targetId = existing.id || id;
            await bindRepositories_1.diContainer.voucherTypeDefinitionRepository.deleteVoucherType(SYSTEM_COMPANY_ID, targetId);
            res.status(200).json({
                success: true,
                message: 'Template deleted successfully'
            });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.SuperAdminVoucherTypeController = SuperAdminVoucherTypeController;
//# sourceMappingURL=SuperAdminVoucherTypeController.js.map