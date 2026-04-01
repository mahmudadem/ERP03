"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UomConversion = void 0;
class UomConversion {
    constructor(props) {
        var _a, _b, _c, _d, _e;
        if (!((_a = props.id) === null || _a === void 0 ? void 0 : _a.trim()))
            throw new Error('UomConversion id is required');
        if (!((_b = props.companyId) === null || _b === void 0 ? void 0 : _b.trim()))
            throw new Error('UomConversion companyId is required');
        if (!((_c = props.itemId) === null || _c === void 0 ? void 0 : _c.trim()))
            throw new Error('UomConversion itemId is required');
        if (!((_d = props.fromUom) === null || _d === void 0 ? void 0 : _d.trim()))
            throw new Error('UomConversion fromUom is required');
        if (!((_e = props.toUom) === null || _e === void 0 ? void 0 : _e.trim()))
            throw new Error('UomConversion toUom is required');
        if (props.factor <= 0 || Number.isNaN(props.factor)) {
            throw new Error('UomConversion factor must be greater than 0');
        }
        this.id = props.id;
        this.companyId = props.companyId;
        this.itemId = props.itemId;
        this.fromUom = props.fromUom.trim();
        this.toUom = props.toUom.trim();
        this.factor = props.factor;
        this.active = props.active;
    }
    toJSON() {
        return {
            id: this.id,
            companyId: this.companyId,
            itemId: this.itemId,
            fromUom: this.fromUom,
            toUom: this.toUom,
            factor: this.factor,
            active: this.active,
        };
    }
    static fromJSON(data) {
        var _a;
        return new UomConversion({
            id: data.id,
            companyId: data.companyId,
            itemId: data.itemId,
            fromUom: data.fromUom,
            toUom: data.toUom,
            factor: data.factor,
            active: (_a = data.active) !== null && _a !== void 0 ? _a : true,
        });
    }
}
exports.UomConversion = UomConversion;
//# sourceMappingURL=UomConversion.js.map