"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SalesSettings = void 0;
class SalesSettings {
    constructor(props) {
        var _a, _b, _c;
        if (!((_a = props.companyId) === null || _a === void 0 ? void 0 : _a.trim()))
            throw new Error('SalesSettings companyId is required');
        if (!((_b = props.defaultRevenueAccountId) === null || _b === void 0 ? void 0 : _b.trim()))
            throw new Error('SalesSettings defaultRevenueAccountId is required');
        this.companyId = props.companyId;
        this.allowDirectInvoicing = props.allowDirectInvoicing;
        this.requireSOForStockItems = props.requireSOForStockItems;
        this.defaultARAccountId = ((_c = props.defaultARAccountId) === null || _c === void 0 ? void 0 : _c.trim()) || undefined;
        this.defaultRevenueAccountId = props.defaultRevenueAccountId.trim();
        this.defaultCOGSAccountId = props.defaultCOGSAccountId;
        this.defaultInventoryAccountId = props.defaultInventoryAccountId;
        this.defaultSalesExpenseAccountId = props.defaultSalesExpenseAccountId;
        this.allowOverDelivery = props.allowOverDelivery;
        this.overDeliveryTolerancePct = props.overDeliveryTolerancePct;
        this.overInvoiceTolerancePct = props.overInvoiceTolerancePct;
        this.defaultPaymentTermsDays = props.defaultPaymentTermsDays;
        this.salesVoucherTypeId = props.salesVoucherTypeId;
        this.defaultWarehouseId = props.defaultWarehouseId;
        this.soNumberPrefix = props.soNumberPrefix || 'SO';
        this.soNumberNextSeq = props.soNumberNextSeq || 1;
        this.dnNumberPrefix = props.dnNumberPrefix || 'DN';
        this.dnNumberNextSeq = props.dnNumberNextSeq || 1;
        this.siNumberPrefix = props.siNumberPrefix || 'SI';
        this.siNumberNextSeq = props.siNumberNextSeq || 1;
        this.srNumberPrefix = props.srNumberPrefix || 'SR';
        this.srNumberNextSeq = props.srNumberNextSeq || 1;
    }
    static createDefault(companyId, defaultARAccountId, defaultRevenueAccountId) {
        return new SalesSettings({
            companyId,
            allowDirectInvoicing: true,
            requireSOForStockItems: false,
            defaultARAccountId,
            defaultRevenueAccountId,
            allowOverDelivery: false,
            overDeliveryTolerancePct: 0,
            overInvoiceTolerancePct: 0,
            defaultPaymentTermsDays: 30,
            soNumberPrefix: 'SO',
            soNumberNextSeq: 1,
            dnNumberPrefix: 'DN',
            dnNumberNextSeq: 1,
            siNumberPrefix: 'SI',
            siNumberNextSeq: 1,
            srNumberPrefix: 'SR',
            srNumberNextSeq: 1,
        });
    }
    toJSON() {
        return {
            companyId: this.companyId,
            allowDirectInvoicing: this.allowDirectInvoicing,
            requireSOForStockItems: this.requireSOForStockItems,
            defaultARAccountId: this.defaultARAccountId,
            defaultRevenueAccountId: this.defaultRevenueAccountId,
            defaultCOGSAccountId: this.defaultCOGSAccountId,
            defaultInventoryAccountId: this.defaultInventoryAccountId,
            defaultSalesExpenseAccountId: this.defaultSalesExpenseAccountId,
            allowOverDelivery: this.allowOverDelivery,
            overDeliveryTolerancePct: this.overDeliveryTolerancePct,
            overInvoiceTolerancePct: this.overInvoiceTolerancePct,
            defaultPaymentTermsDays: this.defaultPaymentTermsDays,
            salesVoucherTypeId: this.salesVoucherTypeId,
            defaultWarehouseId: this.defaultWarehouseId,
            soNumberPrefix: this.soNumberPrefix,
            soNumberNextSeq: this.soNumberNextSeq,
            dnNumberPrefix: this.dnNumberPrefix,
            dnNumberNextSeq: this.dnNumberNextSeq,
            siNumberPrefix: this.siNumberPrefix,
            siNumberNextSeq: this.siNumberNextSeq,
            srNumberPrefix: this.srNumberPrefix,
            srNumberNextSeq: this.srNumberNextSeq,
        };
    }
    static fromJSON(data) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
        return new SalesSettings({
            companyId: data.companyId,
            allowDirectInvoicing: (_a = data.allowDirectInvoicing) !== null && _a !== void 0 ? _a : true,
            requireSOForStockItems: (_b = data.requireSOForStockItems) !== null && _b !== void 0 ? _b : false,
            defaultARAccountId: data.defaultARAccountId,
            defaultRevenueAccountId: data.defaultRevenueAccountId,
            defaultCOGSAccountId: data.defaultCOGSAccountId,
            defaultInventoryAccountId: data.defaultInventoryAccountId,
            defaultSalesExpenseAccountId: data.defaultSalesExpenseAccountId,
            allowOverDelivery: (_c = data.allowOverDelivery) !== null && _c !== void 0 ? _c : false,
            overDeliveryTolerancePct: (_d = data.overDeliveryTolerancePct) !== null && _d !== void 0 ? _d : 0,
            overInvoiceTolerancePct: (_e = data.overInvoiceTolerancePct) !== null && _e !== void 0 ? _e : 0,
            defaultPaymentTermsDays: (_f = data.defaultPaymentTermsDays) !== null && _f !== void 0 ? _f : 30,
            salesVoucherTypeId: data.salesVoucherTypeId,
            defaultWarehouseId: data.defaultWarehouseId,
            soNumberPrefix: data.soNumberPrefix || 'SO',
            soNumberNextSeq: (_g = data.soNumberNextSeq) !== null && _g !== void 0 ? _g : 1,
            dnNumberPrefix: data.dnNumberPrefix || 'DN',
            dnNumberNextSeq: (_h = data.dnNumberNextSeq) !== null && _h !== void 0 ? _h : 1,
            siNumberPrefix: data.siNumberPrefix || 'SI',
            siNumberNextSeq: (_j = data.siNumberNextSeq) !== null && _j !== void 0 ? _j : 1,
            srNumberPrefix: data.srNumberPrefix || 'SR',
            srNumberNextSeq: (_k = data.srNumberNextSeq) !== null && _k !== void 0 ? _k : 1,
        });
    }
}
exports.SalesSettings = SalesSettings;
//# sourceMappingURL=SalesSettings.js.map