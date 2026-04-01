"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ItemCategory = void 0;
class ItemCategory {
    constructor(props) {
        var _a, _b, _c;
        if (!((_a = props.id) === null || _a === void 0 ? void 0 : _a.trim()))
            throw new Error('ItemCategory id is required');
        if (!((_b = props.companyId) === null || _b === void 0 ? void 0 : _b.trim()))
            throw new Error('ItemCategory companyId is required');
        if (!((_c = props.name) === null || _c === void 0 ? void 0 : _c.trim()))
            throw new Error('ItemCategory name is required');
        this.id = props.id;
        this.companyId = props.companyId;
        this.name = props.name.trim();
        this.parentId = props.parentId;
        this.sortOrder = props.sortOrder;
        this.active = props.active;
        this.defaultRevenueAccountId = props.defaultRevenueAccountId;
        this.defaultCogsAccountId = props.defaultCogsAccountId;
        this.defaultInventoryAssetAccountId = props.defaultInventoryAssetAccountId;
    }
    toJSON() {
        return {
            id: this.id,
            companyId: this.companyId,
            name: this.name,
            parentId: this.parentId,
            sortOrder: this.sortOrder,
            active: this.active,
            defaultRevenueAccountId: this.defaultRevenueAccountId,
            defaultCogsAccountId: this.defaultCogsAccountId,
            defaultInventoryAssetAccountId: this.defaultInventoryAssetAccountId,
        };
    }
    static fromJSON(data) {
        var _a, _b;
        return new ItemCategory({
            id: data.id,
            companyId: data.companyId,
            name: data.name,
            parentId: data.parentId,
            sortOrder: (_a = data.sortOrder) !== null && _a !== void 0 ? _a : 0,
            active: (_b = data.active) !== null && _b !== void 0 ? _b : true,
            defaultRevenueAccountId: data.defaultRevenueAccountId,
            defaultCogsAccountId: data.defaultCogsAccountId,
            defaultInventoryAssetAccountId: data.defaultInventoryAssetAccountId,
        });
    }
}
exports.ItemCategory = ItemCategory;
//# sourceMappingURL=ItemCategory.js.map