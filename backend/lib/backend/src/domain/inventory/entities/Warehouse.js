"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Warehouse = void 0;
const toDate = (value) => {
    if (value instanceof Date)
        return value;
    if ((value === null || value === void 0 ? void 0 : value.toDate) && typeof value.toDate === 'function')
        return value.toDate();
    return new Date(value);
};
class Warehouse {
    constructor(props) {
        var _a, _b, _c, _d;
        if (!((_a = props.id) === null || _a === void 0 ? void 0 : _a.trim()))
            throw new Error('Warehouse id is required');
        if (!((_b = props.companyId) === null || _b === void 0 ? void 0 : _b.trim()))
            throw new Error('Warehouse companyId is required');
        if (!((_c = props.name) === null || _c === void 0 ? void 0 : _c.trim()))
            throw new Error('Warehouse name is required');
        if (!((_d = props.code) === null || _d === void 0 ? void 0 : _d.trim()))
            throw new Error('Warehouse code is required');
        this.id = props.id;
        this.companyId = props.companyId;
        this.name = props.name.trim();
        this.code = props.code.trim();
        this.address = props.address;
        this.active = props.active;
        this.isDefault = props.isDefault;
        this.createdAt = props.createdAt;
        this.updatedAt = props.updatedAt;
    }
    toJSON() {
        return {
            id: this.id,
            companyId: this.companyId,
            name: this.name,
            code: this.code,
            address: this.address,
            active: this.active,
            isDefault: this.isDefault,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
        };
    }
    static fromJSON(data) {
        var _a, _b;
        return new Warehouse({
            id: data.id,
            companyId: data.companyId,
            name: data.name,
            code: data.code || data.name,
            address: data.address || data.location,
            active: (_a = data.active) !== null && _a !== void 0 ? _a : true,
            isDefault: (_b = data.isDefault) !== null && _b !== void 0 ? _b : false,
            createdAt: toDate(data.createdAt || new Date()),
            updatedAt: toDate(data.updatedAt || new Date()),
        });
    }
}
exports.Warehouse = Warehouse;
//# sourceMappingURL=Warehouse.js.map