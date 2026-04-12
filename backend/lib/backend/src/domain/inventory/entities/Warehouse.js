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
        var _a, _b, _c, _d, _e;
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
        this.parentId = ((_e = props.parentId) === null || _e === void 0 ? void 0 : _e.trim()) || null;
        this.address = props.address;
        this.active = props.active;
        this.isDefault = props.isDefault;
        this.createdAt = props.createdAt;
        this.updatedAt = props.updatedAt;
    }
    toJSON() {
        var _a;
        return {
            id: this.id,
            companyId: this.companyId,
            name: this.name,
            code: this.code,
            parentId: (_a = this.parentId) !== null && _a !== void 0 ? _a : null,
            address: this.address,
            active: this.active,
            isDefault: this.isDefault,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
        };
    }
    static fromJSON(data) {
        var _a, _b, _c;
        return new Warehouse({
            id: data.id,
            companyId: data.companyId,
            name: data.name,
            code: data.code || data.name,
            parentId: (_a = data.parentId) !== null && _a !== void 0 ? _a : null,
            address: data.address || data.location,
            active: (_b = data.active) !== null && _b !== void 0 ? _b : true,
            isDefault: (_c = data.isDefault) !== null && _c !== void 0 ? _c : false,
            createdAt: toDate(data.createdAt || new Date()),
            updatedAt: toDate(data.updatedAt || new Date()),
        });
    }
}
exports.Warehouse = Warehouse;
//# sourceMappingURL=Warehouse.js.map