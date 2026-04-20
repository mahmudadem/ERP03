"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Uom = void 0;
const UOM_DIMENSIONS = ['COUNT', 'WEIGHT', 'VOLUME', 'LENGTH', 'AREA', 'TIME', 'OTHER'];
const toDate = (value) => {
    if (value instanceof Date)
        return value;
    if ((value === null || value === void 0 ? void 0 : value.toDate) && typeof value.toDate === 'function')
        return value.toDate();
    return new Date(value);
};
class Uom {
    constructor(props) {
        var _a, _b, _c, _d, _e;
        if (!((_a = props.id) === null || _a === void 0 ? void 0 : _a.trim()))
            throw new Error('Uom id is required');
        if (!((_b = props.companyId) === null || _b === void 0 ? void 0 : _b.trim()))
            throw new Error('Uom companyId is required');
        if (!((_c = props.code) === null || _c === void 0 ? void 0 : _c.trim()))
            throw new Error('Uom code is required');
        if (!((_d = props.name) === null || _d === void 0 ? void 0 : _d.trim()))
            throw new Error('Uom name is required');
        if (!((_e = props.createdBy) === null || _e === void 0 ? void 0 : _e.trim()))
            throw new Error('Uom createdBy is required');
        if (!UOM_DIMENSIONS.includes(props.dimension)) {
            throw new Error(`Invalid Uom dimension: ${props.dimension}`);
        }
        if (!Number.isInteger(props.decimalPlaces) || props.decimalPlaces < 0 || props.decimalPlaces > 6) {
            throw new Error('Uom decimalPlaces must be an integer between 0 and 6');
        }
        this.id = props.id;
        this.companyId = props.companyId;
        this.code = props.code.trim().toUpperCase();
        this.name = props.name.trim();
        this.dimension = props.dimension;
        this.decimalPlaces = props.decimalPlaces;
        this.active = props.active;
        this.isSystem = props.isSystem;
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
            dimension: this.dimension,
            decimalPlaces: this.decimalPlaces,
            active: this.active,
            isSystem: this.isSystem,
            createdBy: this.createdBy,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
        };
    }
    static fromJSON(data) {
        var _a, _b;
        return new Uom({
            id: data.id,
            companyId: data.companyId,
            code: data.code,
            name: data.name,
            dimension: data.dimension || 'OTHER',
            decimalPlaces: Number.isInteger(data.decimalPlaces) ? data.decimalPlaces : 0,
            active: (_a = data.active) !== null && _a !== void 0 ? _a : true,
            isSystem: (_b = data.isSystem) !== null && _b !== void 0 ? _b : false,
            createdBy: data.createdBy || 'SYSTEM',
            createdAt: toDate(data.createdAt || new Date()),
            updatedAt: toDate(data.updatedAt || new Date()),
        });
    }
}
exports.Uom = Uom;
//# sourceMappingURL=Uom.js.map