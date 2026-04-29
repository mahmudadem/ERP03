"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncCompanyVoucherTemplatesFromSystem = void 0;
const crypto_1 = require("crypto");
const VoucherTypeDefinition_1 = require("../../../domain/designer/entities/VoucherTypeDefinition");
const VoucherFormDeduper_1 = require("../../../domain/designer/services/VoucherFormDeduper");
const cloneValue = (value) => (value ? JSON.parse(JSON.stringify(value)) : value);
const normalizeModule = (value) => String(value || '').trim().toUpperCase();
const normalizeCode = (value) => (0, VoucherFormDeduper_1.canonicalizeVoucherCode)(value);
const toFormFieldType = (type) => {
    const normalized = String(type || '').trim().toUpperCase();
    if (normalized.includes('DATE'))
        return 'date';
    if (normalized.includes('NUMBER'))
        return 'number';
    if (normalized.includes('CHECKBOX') || normalized.includes('BOOLEAN'))
        return 'checkbox';
    if (normalized.includes('SELECT') || normalized.includes('REFERENCE') || normalized.includes('RELATION'))
        return 'select';
    if (normalized.includes('CURRENCY'))
        return 'currency';
    if (normalized.includes('TEXTAREA'))
        return 'textarea';
    return 'text';
};
const toFormColumnType = (type) => {
    const normalized = String(type || '').trim().toUpperCase();
    if (normalized.includes('ACCOUNT'))
        return 'account';
    if (normalized.includes('NUMBER'))
        return 'number';
    if (normalized.includes('CURRENCY'))
        return 'currency';
    if (normalized.includes('SELECT') || normalized.includes('REFERENCE') || normalized.includes('RELATION'))
        return 'select';
    return 'text';
};
const cloneVoucherTypeForCompany = (companyId, template) => {
    var _a;
    return new VoucherTypeDefinition_1.VoucherTypeDefinition((0, crypto_1.randomUUID)(), companyId, template.name, template.code, template.module, cloneValue(template.headerFields) || [], cloneValue(template.tableColumns) || [], cloneValue(template.layout) || {}, template.schemaVersion || 2, template.requiredPostingRoles ? [...template.requiredPostingRoles] : undefined, cloneValue(template.workflow), cloneValue(template.uiModeOverrides), (_a = template.isMultiLine) !== null && _a !== void 0 ? _a : true, cloneValue(template.rules) || [], cloneValue(template.actions) || [], template.defaultCurrency);
};
const cloneVoucherFormForCompany = (companyId, typeId, createdBy, template) => {
    var _a, _b;
    const now = new Date();
    const headerFields = (template.headerFields || []).map((field, index) => {
        const mapped = {
            id: field.id || field.name || `f_${index + 1}`,
            label: field.label || field.name || `Field ${index + 1}`,
            type: toFormFieldType(field.type),
            required: !!field.required,
            order: index,
        };
        if (field.defaultValue !== undefined) {
            mapped.defaultValue = cloneValue(field.defaultValue);
        }
        if (Array.isArray(field.options)) {
            mapped.options = cloneValue(field.options);
        }
        if (field.width !== undefined && field.width !== null && String(field.width).trim() !== '') {
            mapped.width = String(field.width);
        }
        return mapped;
    });
    const tableColumns = (template.tableColumns || []).map((column, index) => {
        const mapped = {
            id: column.fieldId || column.id || `c_${index + 1}`,
            label: column.labelOverride || column.label || column.fieldId || `Column ${index + 1}`,
            type: toFormColumnType(column.type),
            required: !!(column.required || column.mandatory),
            order: index,
        };
        if (column.width !== undefined && column.width !== null && String(column.width).trim() !== '') {
            mapped.width = String(column.width);
        }
        return mapped;
    });
    return {
        id: (0, crypto_1.randomUUID)(),
        companyId,
        module: normalizeModule(template.module),
        typeId,
        name: template.name,
        code: template.code,
        description: `Default form for ${template.name}`,
        prefix: (_a = template.code) === null || _a === void 0 ? void 0 : _a.slice(0, 3).toUpperCase(),
        isDefault: true,
        isSystemGenerated: true,
        isLocked: true,
        enabled: true,
        headerFields,
        tableColumns,
        layout: cloneValue(template.layout) || { sections: [] },
        uiModeOverrides: cloneValue(template.uiModeOverrides),
        rules: cloneValue(template.rules) || [],
        actions: cloneValue(template.actions) || [],
        isMultiLine: (_b = template.isMultiLine) !== null && _b !== void 0 ? _b : true,
        tableStyle: 'web',
        defaultCurrency: template.defaultCurrency,
        baseType: template.code,
        createdAt: now,
        updatedAt: now,
        createdBy,
    };
};
/**
 * Ensures company voucher types/forms are sourced from current system templates
 * for the requested module list. Idempotent and safe to run repeatedly.
 */
const syncCompanyVoucherTemplatesFromSystem = async (input) => {
    var _a;
    const moduleSet = new Set((input.modules || []).map(normalizeModule).filter(Boolean));
    if (moduleSet.size === 0) {
        return { templatesUpserted: 0, formsCreated: 0 };
    }
    const systemTemplates = await input.voucherTypeRepo.getSystemTemplates();
    const scopedTemplates = systemTemplates.filter((template) => moduleSet.has(normalizeModule(template.module)));
    // Keep one template per module+code key to avoid accidental duplicate-code drift.
    const templateMap = new Map();
    for (const template of scopedTemplates) {
        templateMap.set(`${normalizeModule(template.module)}::${normalizeCode(template.code)}`, template);
    }
    let templatesUpserted = 0;
    let formsCreated = 0;
    const companyTypes = await input.voucherTypeRepo.getByCompanyId(input.companyId);
    const companyForms = await input.voucherFormRepo.getAllByCompany(input.companyId);
    const existingByKey = new Map();
    const existingDefaultFormKeys = new Set(companyForms
        .filter(VoucherFormDeduper_1.isSystemDefaultVoucherForm)
        .map(VoucherFormDeduper_1.getVoucherFormLogicalKey));
    for (const existingType of companyTypes) {
        if (existingType.companyId !== input.companyId)
            continue;
        const key = `${normalizeModule(existingType.module)}::${normalizeCode(existingType.code)}`;
        if (!existingByKey.has(key)) {
            existingByKey.set(key, existingType);
        }
    }
    for (const template of templateMap.values()) {
        const templateKey = `${normalizeModule(template.module)}::${normalizeCode(template.code)}`;
        const existing = existingByKey.get(templateKey);
        let companyTypeId;
        if (existing && existing.companyId === input.companyId) {
            await input.voucherTypeRepo.updateVoucherType(input.companyId, existing.id, {
                name: template.name,
                code: template.code,
                module: template.module,
                headerFields: cloneValue(template.headerFields) || [],
                tableColumns: cloneValue(template.tableColumns) || [],
                layout: cloneValue(template.layout) || {},
                schemaVersion: template.schemaVersion || 2,
                requiredPostingRoles: template.requiredPostingRoles ? [...template.requiredPostingRoles] : undefined,
                workflow: cloneValue(template.workflow),
                uiModeOverrides: cloneValue(template.uiModeOverrides),
                isMultiLine: (_a = template.isMultiLine) !== null && _a !== void 0 ? _a : true,
                rules: cloneValue(template.rules) || [],
                actions: cloneValue(template.actions) || [],
                defaultCurrency: template.defaultCurrency,
            });
            companyTypeId = existing.id;
        }
        else {
            const companyType = cloneVoucherTypeForCompany(input.companyId, template);
            await input.voucherTypeRepo.createVoucherType(companyType);
            companyTypeId = companyType.id;
            existingByKey.set(templateKey, companyType);
        }
        templatesUpserted++;
        const formKey = `${normalizeModule(template.module)}::${normalizeCode(template.code)}`;
        const existingForms = await input.voucherFormRepo.getByTypeId(input.companyId, companyTypeId);
        if (existingForms.length === 0 && !existingDefaultFormKeys.has(formKey)) {
            const defaultForm = cloneVoucherFormForCompany(input.companyId, companyTypeId, input.createdBy || 'SYSTEM', template);
            await input.voucherFormRepo.create(defaultForm);
            existingDefaultFormKeys.add(formKey);
            formsCreated++;
        }
    }
    return { templatesUpserted, formsCreated };
};
exports.syncCompanyVoucherTemplatesFromSystem = syncCompanyVoucherTemplatesFromSystem;
//# sourceMappingURL=CompanyVoucherTemplateSyncService.js.map