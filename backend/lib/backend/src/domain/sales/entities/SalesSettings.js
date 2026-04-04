"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SalesSettings = void 0;
const CONTROL_MODES = ['SIMPLE', 'CONTROLLED'];
class SalesSettings {
    constructor(props) {
        var _a, _b, _c;
        if (!((_a = props.companyId) === null || _a === void 0 ? void 0 : _a.trim()))
            throw new Error('SalesSettings companyId is required');
        if (!((_b = props.defaultARAccountId) === null || _b === void 0 ? void 0 : _b.trim()))
            throw new Error('SalesSettings defaultARAccountId is required');
        if (!((_c = props.defaultRevenueAccountId) === null || _c === void 0 ? void 0 : _c.trim()))
            throw new Error('SalesSettings defaultRevenueAccountId is required');
        if (!CONTROL_MODES.includes(props.salesControlMode)) {
            throw new Error(`Invalid salesControlMode: ${props.salesControlMode}`);
        }
        this.companyId = props.companyId;
        this.salesControlMode = props.salesControlMode;
        this.requireSOForStockItems = props.salesControlMode === 'CONTROLLED'
            ? true
            : props.requireSOForStockItems;
        this.defaultARAccountId = props.defaultARAccountId;
        this.defaultRevenueAccountId = props.defaultRevenueAccountId;
        this.defaultCOGSAccountId = props.defaultCOGSAccountId;
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
            salesControlMode: 'SIMPLE',
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
            salesControlMode: this.salesControlMode,
            requireSOForStockItems: this.requireSOForStockItems,
            defaultARAccountId: this.defaultARAccountId,
            defaultRevenueAccountId: this.defaultRevenueAccountId,
            defaultCOGSAccountId: this.defaultCOGSAccountId,
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
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        return new SalesSettings({
            companyId: data.companyId,
            salesControlMode: data.salesControlMode || 'SIMPLE',
            requireSOForStockItems: (_a = data.requireSOForStockItems) !== null && _a !== void 0 ? _a : false,
            defaultARAccountId: data.defaultARAccountId,
            defaultRevenueAccountId: data.defaultRevenueAccountId,
            defaultCOGSAccountId: data.defaultCOGSAccountId,
            defaultSalesExpenseAccountId: data.defaultSalesExpenseAccountId,
            allowOverDelivery: (_b = data.allowOverDelivery) !== null && _b !== void 0 ? _b : false,
            overDeliveryTolerancePct: (_c = data.overDeliveryTolerancePct) !== null && _c !== void 0 ? _c : 0,
            overInvoiceTolerancePct: (_d = data.overInvoiceTolerancePct) !== null && _d !== void 0 ? _d : 0,
            defaultPaymentTermsDays: (_e = data.defaultPaymentTermsDays) !== null && _e !== void 0 ? _e : 30,
            salesVoucherTypeId: data.salesVoucherTypeId,
            defaultWarehouseId: data.defaultWarehouseId,
            soNumberPrefix: data.soNumberPrefix || 'SO',
            soNumberNextSeq: (_f = data.soNumberNextSeq) !== null && _f !== void 0 ? _f : 1,
            dnNumberPrefix: data.dnNumberPrefix || 'DN',
            dnNumberNextSeq: (_g = data.dnNumberNextSeq) !== null && _g !== void 0 ? _g : 1,
            siNumberPrefix: data.siNumberPrefix || 'SI',
            siNumberNextSeq: (_h = data.siNumberNextSeq) !== null && _h !== void 0 ? _h : 1,
            srNumberPrefix: data.srNumberPrefix || 'SR',
            srNumberNextSeq: (_j = data.srNumberNextSeq) !== null && _j !== void 0 ? _j : 1,
        });
    }
}
exports.SalesSettings = SalesSettings;
//# sourceMappingURL=SalesSettings.js.map