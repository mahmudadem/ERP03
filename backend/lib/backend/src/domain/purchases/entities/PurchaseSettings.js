"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PurchaseSettings = void 0;
class PurchaseSettings {
    constructor(props) {
        var _a, _b, _c;
        if (!((_a = props.companyId) === null || _a === void 0 ? void 0 : _a.trim()))
            throw new Error('PurchaseSettings companyId is required');
        this.companyId = props.companyId;
        this.workflowMode = props.workflowMode === 'SIMPLE' ? 'SIMPLE' : 'OPERATIONAL';
        this.allowDirectInvoicing = props.allowDirectInvoicing;
        this.requirePOForStockItems = props.requirePOForStockItems;
        this.defaultAPAccountId = ((_b = props.defaultAPAccountId) === null || _b === void 0 ? void 0 : _b.trim()) || undefined;
        this.defaultPurchaseExpenseAccountId = props.defaultPurchaseExpenseAccountId;
        this.defaultGRNIAccountId = ((_c = props.defaultGRNIAccountId) === null || _c === void 0 ? void 0 : _c.trim()) || undefined;
        this.allowOverDelivery = props.allowOverDelivery;
        this.overDeliveryTolerancePct = props.overDeliveryTolerancePct;
        this.overInvoiceTolerancePct = props.overInvoiceTolerancePct;
        this.defaultPaymentTermsDays = props.defaultPaymentTermsDays;
        this.purchaseVoucherTypeId = props.purchaseVoucherTypeId;
        this.defaultWarehouseId = props.defaultWarehouseId;
        this.poNumberPrefix = props.poNumberPrefix || 'PO';
        this.poNumberNextSeq = props.poNumberNextSeq || 1;
        this.grnNumberPrefix = props.grnNumberPrefix || 'GRN';
        this.grnNumberNextSeq = props.grnNumberNextSeq || 1;
        this.piNumberPrefix = props.piNumberPrefix || 'PI';
        this.piNumberNextSeq = props.piNumberNextSeq || 1;
        this.prNumberPrefix = props.prNumberPrefix || 'PR';
        this.prNumberNextSeq = props.prNumberNextSeq || 1;
        this.exchangeGainLossAccountId = props.exchangeGainLossAccountId;
    }
    static createDefault(companyId, defaultAPAccountId) {
        return new PurchaseSettings({
            companyId,
            workflowMode: 'OPERATIONAL',
            allowDirectInvoicing: true,
            requirePOForStockItems: false,
            defaultAPAccountId,
            allowOverDelivery: false,
            overDeliveryTolerancePct: 0,
            overInvoiceTolerancePct: 0,
            defaultPaymentTermsDays: 30,
            poNumberPrefix: 'PO',
            poNumberNextSeq: 1,
            grnNumberPrefix: 'GRN',
            grnNumberNextSeq: 1,
            piNumberPrefix: 'PI',
            piNumberNextSeq: 1,
            prNumberPrefix: 'PR',
            prNumberNextSeq: 1,
        });
    }
    toJSON() {
        return {
            companyId: this.companyId,
            workflowMode: this.workflowMode,
            allowDirectInvoicing: this.allowDirectInvoicing,
            requirePOForStockItems: this.requirePOForStockItems,
            defaultAPAccountId: this.defaultAPAccountId,
            defaultPurchaseExpenseAccountId: this.defaultPurchaseExpenseAccountId,
            defaultGRNIAccountId: this.defaultGRNIAccountId,
            allowOverDelivery: this.allowOverDelivery,
            overDeliveryTolerancePct: this.overDeliveryTolerancePct,
            overInvoiceTolerancePct: this.overInvoiceTolerancePct,
            defaultPaymentTermsDays: this.defaultPaymentTermsDays,
            purchaseVoucherTypeId: this.purchaseVoucherTypeId,
            defaultWarehouseId: this.defaultWarehouseId,
            poNumberPrefix: this.poNumberPrefix,
            poNumberNextSeq: this.poNumberNextSeq,
            grnNumberPrefix: this.grnNumberPrefix,
            grnNumberNextSeq: this.grnNumberNextSeq,
            piNumberPrefix: this.piNumberPrefix,
            piNumberNextSeq: this.piNumberNextSeq,
            prNumberPrefix: this.prNumberPrefix,
            prNumberNextSeq: this.prNumberNextSeq,
            exchangeGainLossAccountId: this.exchangeGainLossAccountId,
        };
    }
    static fromJSON(data) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
        return new PurchaseSettings({
            companyId: data.companyId,
            workflowMode: data.workflowMode === 'SIMPLE' ? 'SIMPLE' : 'OPERATIONAL',
            allowDirectInvoicing: (_a = data.allowDirectInvoicing) !== null && _a !== void 0 ? _a : true,
            requirePOForStockItems: (_b = data.requirePOForStockItems) !== null && _b !== void 0 ? _b : false,
            defaultAPAccountId: data.defaultAPAccountId,
            defaultPurchaseExpenseAccountId: data.defaultPurchaseExpenseAccountId,
            defaultGRNIAccountId: data.defaultGRNIAccountId,
            allowOverDelivery: (_c = data.allowOverDelivery) !== null && _c !== void 0 ? _c : false,
            overDeliveryTolerancePct: (_d = data.overDeliveryTolerancePct) !== null && _d !== void 0 ? _d : 0,
            overInvoiceTolerancePct: (_e = data.overInvoiceTolerancePct) !== null && _e !== void 0 ? _e : 0,
            defaultPaymentTermsDays: (_f = data.defaultPaymentTermsDays) !== null && _f !== void 0 ? _f : 30,
            purchaseVoucherTypeId: data.purchaseVoucherTypeId,
            defaultWarehouseId: data.defaultWarehouseId,
            poNumberPrefix: data.poNumberPrefix || 'PO',
            poNumberNextSeq: (_g = data.poNumberNextSeq) !== null && _g !== void 0 ? _g : 1,
            grnNumberPrefix: data.grnNumberPrefix || 'GRN',
            grnNumberNextSeq: (_h = data.grnNumberNextSeq) !== null && _h !== void 0 ? _h : 1,
            piNumberPrefix: data.piNumberPrefix || 'PI',
            piNumberNextSeq: (_j = data.piNumberNextSeq) !== null && _j !== void 0 ? _j : 1,
            prNumberPrefix: data.prNumberPrefix || 'PR',
            prNumberNextSeq: (_k = data.prNumberNextSeq) !== null && _k !== void 0 ? _k : 1,
        });
    }
}
exports.PurchaseSettings = PurchaseSettings;
//# sourceMappingURL=PurchaseSettings.js.map