"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventorySettings = void 0;
class InventorySettings {
    constructor(props) {
        var _a, _b, _c, _d;
        if (!((_a = props.companyId) === null || _a === void 0 ? void 0 : _a.trim()))
            throw new Error('InventorySettings companyId is required');
        if (!((_b = props.defaultCostCurrency) === null || _b === void 0 ? void 0 : _b.trim()))
            throw new Error('InventorySettings defaultCostCurrency is required');
        if (props.inventoryAccountingMethod !== 'PERIODIC' && props.inventoryAccountingMethod !== 'PERPETUAL') {
            throw new Error(`Invalid inventoryAccountingMethod: ${props.inventoryAccountingMethod}`);
        }
        // Note: Requiredness for defaultInventoryAssetAccountId in PERPETUAL mode 
        // is enforced at the Use Case and Validator level to allow hydration of partial legacy data.
        if (props.defaultCostingMethod !== 'MOVING_AVG') {
            throw new Error(`Invalid defaultCostingMethod: ${props.defaultCostingMethod}`);
        }
        if (props.itemCodeNextSeq <= 0 || Number.isNaN(props.itemCodeNextSeq)) {
            throw new Error('InventorySettings itemCodeNextSeq must be greater than 0');
        }
        this.companyId = props.companyId;
        this.inventoryAccountingMethod = props.inventoryAccountingMethod;
        this.defaultCostingMethod = props.defaultCostingMethod;
        this.defaultCostCurrency = props.defaultCostCurrency.toUpperCase().trim();
        this.defaultInventoryAssetAccountId = ((_c = props.defaultInventoryAssetAccountId) === null || _c === void 0 ? void 0 : _c.trim()) || undefined;
        this.allowNegativeStock = props.allowNegativeStock;
        this.defaultWarehouseId = props.defaultWarehouseId;
        this.autoGenerateItemCode = props.autoGenerateItemCode;
        this.itemCodePrefix = props.itemCodePrefix;
        this.itemCodeNextSeq = props.itemCodeNextSeq;
        this.defaultCOGSAccountId = ((_d = props.defaultCOGSAccountId) === null || _d === void 0 ? void 0 : _d.trim()) || undefined;
    }
    static createDefault(companyId, baseCurrency, inventoryAccountingMethod = 'PERPETUAL', defaultInventoryAssetAccountId) {
        return new InventorySettings({
            companyId,
            inventoryAccountingMethod,
            defaultCostingMethod: 'MOVING_AVG',
            defaultCostCurrency: baseCurrency.toUpperCase(),
            defaultInventoryAssetAccountId,
            allowNegativeStock: true,
            autoGenerateItemCode: false,
            itemCodeNextSeq: 1,
        });
    }
    toJSON() {
        return {
            companyId: this.companyId,
            inventoryAccountingMethod: this.inventoryAccountingMethod,
            defaultCostingMethod: this.defaultCostingMethod,
            defaultCostCurrency: this.defaultCostCurrency,
            defaultInventoryAssetAccountId: this.defaultInventoryAssetAccountId,
            allowNegativeStock: this.allowNegativeStock,
            defaultWarehouseId: this.defaultWarehouseId,
            autoGenerateItemCode: this.autoGenerateItemCode,
            itemCodePrefix: this.itemCodePrefix,
            itemCodeNextSeq: this.itemCodeNextSeq,
            defaultCOGSAccountId: this.defaultCOGSAccountId,
        };
    }
    static fromJSON(data) {
        var _a, _b, _c;
        return new InventorySettings({
            companyId: data.companyId,
            inventoryAccountingMethod: data.inventoryAccountingMethod || 'PERPETUAL',
            defaultCostingMethod: data.defaultCostingMethod || 'MOVING_AVG',
            defaultCostCurrency: data.defaultCostCurrency,
            defaultInventoryAssetAccountId: data.defaultInventoryAssetAccountId,
            allowNegativeStock: (_a = data.allowNegativeStock) !== null && _a !== void 0 ? _a : true,
            defaultWarehouseId: data.defaultWarehouseId,
            autoGenerateItemCode: (_b = data.autoGenerateItemCode) !== null && _b !== void 0 ? _b : false,
            itemCodePrefix: data.itemCodePrefix,
            itemCodeNextSeq: (_c = data.itemCodeNextSeq) !== null && _c !== void 0 ? _c : 1,
            defaultCOGSAccountId: data.defaultCOGSAccountId,
        });
    }
}
exports.InventorySettings = InventorySettings;
//# sourceMappingURL=InventorySettings.js.map