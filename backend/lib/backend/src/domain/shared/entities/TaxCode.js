"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaxCode = void 0;
const TAX_TYPES = ['VAT', 'GST', 'EXEMPT', 'ZERO_RATED'];
const TAX_SCOPES = ['PURCHASE', 'SALES', 'BOTH'];
const toDate = (value) => {
    if (value instanceof Date)
        return value;
    if ((value === null || value === void 0 ? void 0 : value.toDate) && typeof value.toDate === 'function')
        return value.toDate();
    return new Date(value);
};
class TaxCode {
    constructor(props) {
        var _a, _b, _c, _d, _e;
        if (!((_a = props.id) === null || _a === void 0 ? void 0 : _a.trim()))
            throw new Error('TaxCode id is required');
        if (!((_b = props.companyId) === null || _b === void 0 ? void 0 : _b.trim()))
            throw new Error('TaxCode companyId is required');
        if (!((_c = props.code) === null || _c === void 0 ? void 0 : _c.trim()))
            throw new Error('TaxCode code is required');
        if (!((_d = props.name) === null || _d === void 0 ? void 0 : _d.trim()))
            throw new Error('TaxCode name is required');
        if (!((_e = props.createdBy) === null || _e === void 0 ? void 0 : _e.trim()))
            throw new Error('TaxCode createdBy is required');
        if (!TAX_TYPES.includes(props.taxType))
            throw new Error(`Invalid taxType: ${props.taxType}`);
        if (!TAX_SCOPES.includes(props.scope))
            throw new Error(`Invalid scope: ${props.scope}`);
        if (Number.isNaN(props.rate) || props.rate < 0) {
            throw new Error('TaxCode rate must be greater than or equal to 0');
        }
        if ((props.taxType === 'EXEMPT' || props.taxType === 'ZERO_RATED') && props.rate !== 0) {
            throw new Error(`TaxCode rate must be 0 when taxType is ${props.taxType}`);
        }
        this.id = props.id;
        this.companyId = props.companyId;
        this.code = props.code.trim();
        this.name = props.name.trim();
        this.rate = props.rate;
        this.taxType = props.taxType;
        this.scope = props.scope;
        this.purchaseTaxAccountId = props.purchaseTaxAccountId;
        this.salesTaxAccountId = props.salesTaxAccountId;
        this.active = props.active;
        this.createdBy = props.createdBy;
        this.createdAt = props.createdAt;
        this.updatedAt = props.updatedAt;
    }
    toJSON() {
        return {
            id: this.id,
            companyId: this.companyId,
            code: this.code,
            name: this.name,
            rate: this.rate,
            taxType: this.taxType,
            scope: this.scope,
            purchaseTaxAccountId: this.purchaseTaxAccountId,
            salesTaxAccountId: this.salesTaxAccountId,
            active: this.active,
            createdBy: this.createdBy,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
        };
    }
    static fromJSON(data) {
        var _a, _b;
        return new TaxCode({
            id: data.id,
            companyId: data.companyId,
            code: data.code,
            name: data.name,
            rate: (_a = data.rate) !== null && _a !== void 0 ? _a : 0,
            taxType: data.taxType,
            scope: data.scope,
            purchaseTaxAccountId: data.purchaseTaxAccountId,
            salesTaxAccountId: data.salesTaxAccountId,
            active: (_b = data.active) !== null && _b !== void 0 ? _b : true,
            createdBy: data.createdBy || 'SYSTEM',
            createdAt: toDate(data.createdAt || new Date()),
            updatedAt: toDate(data.updatedAt || new Date()),
        });
    }
}
exports.TaxCode = TaxCode;
//# sourceMappingURL=TaxCode.js.map