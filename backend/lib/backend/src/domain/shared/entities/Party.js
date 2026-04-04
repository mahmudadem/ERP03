"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Party = void 0;
const PARTY_ROLES = ['VENDOR', 'CUSTOMER'];
const toDate = (value) => {
    if (value instanceof Date)
        return value;
    if ((value === null || value === void 0 ? void 0 : value.toDate) && typeof value.toDate === 'function')
        return value.toDate();
    return new Date(value);
};
class Party {
    constructor(props) {
        var _a, _b, _c, _d, _e, _f;
        if (!((_a = props.id) === null || _a === void 0 ? void 0 : _a.trim()))
            throw new Error('Party id is required');
        if (!((_b = props.companyId) === null || _b === void 0 ? void 0 : _b.trim()))
            throw new Error('Party companyId is required');
        if (!((_c = props.code) === null || _c === void 0 ? void 0 : _c.trim()))
            throw new Error('Party code is required');
        if (!((_d = props.legalName) === null || _d === void 0 ? void 0 : _d.trim()))
            throw new Error('Party legalName is required');
        if (!((_e = props.displayName) === null || _e === void 0 ? void 0 : _e.trim()))
            throw new Error('Party displayName is required');
        if (!((_f = props.createdBy) === null || _f === void 0 ? void 0 : _f.trim()))
            throw new Error('Party createdBy is required');
        if (!Array.isArray(props.roles) || props.roles.length === 0) {
            throw new Error('Party roles must contain at least one role');
        }
        const normalizedRoles = props.roles.map((role) => String(role).trim().toUpperCase());
        const invalidRoles = normalizedRoles.filter((role) => !PARTY_ROLES.includes(role));
        if (invalidRoles.length > 0) {
            throw new Error(`Invalid party roles: ${invalidRoles.join(', ')}`);
        }
        this.id = props.id;
        this.companyId = props.companyId;
        this.code = props.code.trim();
        this.legalName = props.legalName.trim();
        this.displayName = props.displayName.trim();
        this.roles = Array.from(new Set(normalizedRoles));
        this.contactPerson = props.contactPerson;
        this.phone = props.phone;
        this.email = props.email;
        this.address = props.address;
        this.taxId = props.taxId;
        this.paymentTermsDays = props.paymentTermsDays;
        this.defaultCurrency = props.defaultCurrency;
        this.defaultAPAccountId = props.defaultAPAccountId;
        this.defaultARAccountId = props.defaultARAccountId;
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
            legalName: this.legalName,
            displayName: this.displayName,
            roles: [...this.roles],
            contactPerson: this.contactPerson,
            phone: this.phone,
            email: this.email,
            address: this.address,
            taxId: this.taxId,
            paymentTermsDays: this.paymentTermsDays,
            defaultCurrency: this.defaultCurrency,
            defaultAPAccountId: this.defaultAPAccountId,
            defaultARAccountId: this.defaultARAccountId,
            active: this.active,
            createdBy: this.createdBy,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
        };
    }
    static fromJSON(data) {
        var _a;
        return new Party({
            id: data.id,
            companyId: data.companyId,
            code: data.code,
            legalName: data.legalName,
            displayName: data.displayName,
            roles: data.roles || [],
            contactPerson: data.contactPerson,
            phone: data.phone,
            email: data.email,
            address: data.address,
            taxId: data.taxId,
            paymentTermsDays: data.paymentTermsDays,
            defaultCurrency: data.defaultCurrency,
            defaultAPAccountId: data.defaultAPAccountId,
            defaultARAccountId: data.defaultARAccountId,
            active: (_a = data.active) !== null && _a !== void 0 ? _a : true,
            createdBy: data.createdBy || 'SYSTEM',
            createdAt: toDate(data.createdAt || new Date()),
            updatedAt: toDate(data.updatedAt || new Date()),
        });
    }
}
exports.Party = Party;
//# sourceMappingURL=Party.js.map