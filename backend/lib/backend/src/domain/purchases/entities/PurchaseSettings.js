"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PurchaseSettings = void 0;
const CONTROL_MODES = ['SIMPLE', 'CONTROLLED'];
class PurchaseSettings {
    constructor(props) {
        var _a, _b;
        if (!((_a = props.companyId) === null || _a === void 0 ? void 0 : _a.trim()))
            throw new Error('PurchaseSettings companyId is required');
        if (!((_b = props.defaultAPAccountId) === null || _b === void 0 ? void 0 : _b.trim()))
            throw new Error('PurchaseSettings defaultAPAccountId is required');
        if (!CONTROL_MODES.includes(props.procurementControlMode)) {
            throw new Error(`Invalid procurementControlMode: ${props.procurementControlMode}`);
        }
        this.companyId = props.companyId;
        this.procurementControlMode = props.procurementControlMode;
        this.requirePOForStockItems = props.procurementControlMode === 'CONTROLLED'
            ? true
            : props.requirePOForStockItems;
        this.defaultAPAccountId = props.defaultAPAccountId;
        this.defaultPurchaseExpenseAccountId = props.defaultPurchaseExpenseAccountId;
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
    }
    static createDefault(companyId, defaultAPAccountId) {
        return new PurchaseSettings({
            companyId,
            procurementControlMode: 'SIMPLE',
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
            procurementControlMode: this.procurementControlMode,
            requirePOForStockItems: this.requirePOForStockItems,
            defaultAPAccountId: this.defaultAPAccountId,
            defaultPurchaseExpenseAccountId: this.defaultPurchaseExpenseAccountId,
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
        };
    }
    static fromJSON(data) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        return new PurchaseSettings({
            companyId: data.companyId,
            procurementControlMode: data.procurementControlMode || 'SIMPLE',
            requirePOForStockItems: (_a = data.requirePOForStockItems) !== null && _a !== void 0 ? _a : false,
            defaultAPAccountId: data.defaultAPAccountId,
            defaultPurchaseExpenseAccountId: data.defaultPurchaseExpenseAccountId,
            allowOverDelivery: (_b = data.allowOverDelivery) !== null && _b !== void 0 ? _b : false,
            overDeliveryTolerancePct: (_c = data.overDeliveryTolerancePct) !== null && _c !== void 0 ? _c : 0,
            overInvoiceTolerancePct: (_d = data.overInvoiceTolerancePct) !== null && _d !== void 0 ? _d : 0,
            defaultPaymentTermsDays: (_e = data.defaultPaymentTermsDays) !== null && _e !== void 0 ? _e : 30,
            purchaseVoucherTypeId: data.purchaseVoucherTypeId,
            defaultWarehouseId: data.defaultWarehouseId,
            poNumberPrefix: data.poNumberPrefix || 'PO',
            poNumberNextSeq: (_f = data.poNumberNextSeq) !== null && _f !== void 0 ? _f : 1,
            grnNumberPrefix: data.grnNumberPrefix || 'GRN',
            grnNumberNextSeq: (_g = data.grnNumberNextSeq) !== null && _g !== void 0 ? _g : 1,
            piNumberPrefix: data.piNumberPrefix || 'PI',
            piNumberNextSeq: (_h = data.piNumberNextSeq) !== null && _h !== void 0 ? _h : 1,
            prNumberPrefix: data.prNumberPrefix || 'PR',
            prNumberNextSeq: (_j = data.prNumberNextSeq) !== null && _j !== void 0 ? _j : 1,
        });
    }
}
exports.PurchaseSettings = PurchaseSettings;
//# sourceMappingURL=PurchaseSettings.js.map