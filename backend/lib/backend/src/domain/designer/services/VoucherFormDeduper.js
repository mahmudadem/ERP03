"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dedupeVoucherForms = exports.getVoucherFormLogicalKey = exports.isSystemDefaultVoucherForm = exports.canonicalizeVoucherCode = void 0;
const normalizeModule = (value) => String(value || '').trim().toUpperCase();
const canonicalizeVoucherCode = (value) => {
    const normalized = String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, '_');
    if (normalized === 'journal' || normalized === 'jv')
        return 'journal_entry';
    if (normalized === 'payment' || normalized === 'pv')
        return 'payment';
    if (normalized === 'receipt' || normalized === 'rv')
        return 'receipt';
    if (normalized === 'opening' || normalized === 'ob')
        return 'opening_balance';
    if (normalized === 'fx' || normalized === 'fxr' || normalized === 'revaluation')
        return 'fx_revaluation';
    return normalized;
};
exports.canonicalizeVoucherCode = canonicalizeVoucherCode;
const isSystemDefaultVoucherForm = (form) => form.isDefault === true || form.isSystemGenerated === true || form.isLocked === true;
exports.isSystemDefaultVoucherForm = isSystemDefaultVoucherForm;
const getVoucherFormLogicalKey = (form) => {
    const module = normalizeModule(form.module) || 'ACCOUNTING';
    const code = (0, exports.canonicalizeVoucherCode)(form.formType || form.baseType || form.code || form.typeId || form.id || form.name);
    return `${module}::${code}`;
};
exports.getVoucherFormLogicalKey = getVoucherFormLogicalKey;
const rankDefaultForm = (form) => {
    const module = normalizeModule(form.module) || 'ACCOUNTING';
    const typeId = (0, exports.canonicalizeVoucherCode)(form.typeId);
    const code = (0, exports.canonicalizeVoucherCode)(form.code);
    const baseType = (0, exports.canonicalizeVoucherCode)(form.formType || form.baseType);
    const id = (0, exports.canonicalizeVoucherCode)(form.id);
    let score = 0;
    if (baseType)
        score += 8;
    if (typeId && typeId !== module.toLowerCase())
        score += 6;
    if (code && code !== module.toLowerCase())
        score += 4;
    if (id && id !== module.toLowerCase())
        score += 2;
    return score;
};
function dedupeVoucherForms(forms) {
    const result = [];
    const defaultByKey = new Map();
    forms.forEach((form) => {
        if (!(0, exports.isSystemDefaultVoucherForm)(form)) {
            result.push(form);
            return;
        }
        const key = (0, exports.getVoucherFormLogicalKey)(form);
        const existingIndex = defaultByKey.get(key);
        if (existingIndex === undefined) {
            defaultByKey.set(key, result.length);
            result.push(form);
            return;
        }
        if (rankDefaultForm(form) > rankDefaultForm(result[existingIndex])) {
            result[existingIndex] = form;
        }
    });
    return result;
}
exports.dedupeVoucherForms = dedupeVoucherForms;
//# sourceMappingURL=VoucherFormDeduper.js.map