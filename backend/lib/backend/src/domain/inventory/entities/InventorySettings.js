"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventorySettings = void 0;
class InventorySettings {
    constructor(props) {
        var _a, _b;
        if (!((_a = props.companyId) === null || _a === void 0 ? void 0 : _a.trim()))
            throw new Error('InventorySettings companyId is required');
        if (!((_b = props.defaultCostCurrency) === null || _b === void 0 ? void 0 : _b.trim()))
            throw new Error('InventorySettings defaultCostCurrency is required');
        if (props.defaultCostingMethod !== 'MOVING_AVG') {
            throw new Error(`Invalid defaultCostingMethod: ${props.defaultCostingMethod}`);
        }
        if (props.itemCodeNextSeq <= 0 || Number.isNaN(props.itemCodeNextSeq)) {
            throw new Error('InventorySettings itemCodeNextSeq must be greater than 0');
        }
        this.companyId = props.companyId;
        this.defaultCostingMethod = props.defaultCostingMethod;
        this.defaultCostCurrency = props.defaultCostCurrency.toUpperCase().trim();
        this.allowNegativeStock = props.allowNegativeStock;
        this.defaultWarehouseId = props.defaultWarehouseId;
        this.autoGenerateItemCode = props.autoGenerateItemCode;
        this.itemCodePrefix = props.itemCodePrefix;
        this.itemCodeNextSeq = props.itemCodeNextSeq;
    }
    static createDefault(companyId, baseCurrency) {
        return new InventorySettings({
            companyId,
            defaultCostingMethod: 'MOVING_AVG',
            defaultCostCurrency: baseCurrency.toUpperCase(),
            allowNegativeStock: true,
            autoGenerateItemCode: false,
            itemCodeNextSeq: 1,
        });
    }
    toJSON() {
        return {
            companyId: this.companyId,
            defaultCostingMethod: this.defaultCostingMethod,
            defaultCostCurrency: this.defaultCostCurrency,
            allowNegativeStock: this.allowNegativeStock,
            defaultWarehouseId: this.defaultWarehouseId,
            autoGenerateItemCode: this.autoGenerateItemCode,
            itemCodePrefix: this.itemCodePrefix,
            itemCodeNextSeq: this.itemCodeNextSeq,
        };
    }
    static fromJSON(data) {
        var _a, _b, _c;
        return new InventorySettings({
            companyId: data.companyId,
            defaultCostingMethod: data.defaultCostingMethod || 'MOVING_AVG',
            defaultCostCurrency: data.defaultCostCurrency,
            allowNegativeStock: (_a = data.allowNegativeStock) !== null && _a !== void 0 ? _a : true,
            defaultWarehouseId: data.defaultWarehouseId,
            autoGenerateItemCode: (_b = data.autoGenerateItemCode) !== null && _b !== void 0 ? _b : false,
            itemCodePrefix: data.itemCodePrefix,
            itemCodeNextSeq: (_c = data.itemCodeNextSeq) !== null && _c !== void 0 ? _c : 1,
        });
    }
}
exports.InventorySettings = InventorySettings;
//# sourceMappingURL=InventorySettings.js.map