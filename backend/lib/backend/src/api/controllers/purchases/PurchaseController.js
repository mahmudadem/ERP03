"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PurchaseController = void 0;
const GoodsReceiptUseCases_1 = require("../../../application/purchases/use-cases/GoodsReceiptUseCases");
const PurchaseOrderUseCases_1 = require("../../../application/purchases/use-cases/PurchaseOrderUseCases");
const PurchaseInvoiceUseCases_1 = require("../../../application/purchases/use-cases/PurchaseInvoiceUseCases");
const PurchaseReturnUseCases_1 = require("../../../application/purchases/use-cases/PurchaseReturnUseCases");
const PurchaseSettingsUseCases_1 = require("../../../application/purchases/use-cases/PurchaseSettingsUseCases");
const PaymentSyncUseCases_1 = require("../../../application/purchases/use-cases/PaymentSyncUseCases");
const PurchasesInventoryService_1 = require("../../../application/inventory/services/PurchasesInventoryService");
const RecordStockMovementUseCase_1 = require("../../../application/inventory/use-cases/RecordStockMovementUseCase");
const bindRepositories_1 = require("../../../infrastructure/di/bindRepositories");
const PurchaseDTOs_1 = require("../../dtos/PurchaseDTOs");
const VoucherValidationService_1 = require("../../../domain/accounting/services/VoucherValidationService");
const SubledgerVoucherPostingService_1 = require("../../../application/accounting/services/SubledgerVoucherPostingService");
const purchases_validators_1 = require("../../validators/purchases.validators");
const PO_STATUSES = [
    'DRAFT',
    'CONFIRMED',
    'PARTIALLY_RECEIVED',
    'FULLY_RECEIVED',
    'CLOSED',
    'CANCELLED',
];
const GRN_STATUSES = ['DRAFT', 'POSTED', 'CANCELLED'];
const PI_STATUSES = ['DRAFT', 'POSTED', 'CANCELLED'];
const PR_STATUSES = ['DRAFT', 'POSTED', 'CANCELLED'];
const PAYMENT_STATUSES = ['UNPAID', 'PARTIALLY_PAID', 'PAID'];
const toOptionalNumber = (value) => {
    if (value === undefined)
        return undefined;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
};
const toOptionalStatus = (value) => {
    if (!value)
        return undefined;
    const status = String(value).toUpperCase();
    return PO_STATUSES.includes(status) ? status : undefined;
};
const toOptionalGRNStatus = (value) => {
    if (!value)
        return undefined;
    const status = String(value).toUpperCase();
    return GRN_STATUSES.includes(status) ? status : undefined;
};
const toOptionalPIStatus = (value) => {
    if (!value)
        return undefined;
    const status = String(value).toUpperCase();
    return PI_STATUSES.includes(status) ? status : undefined;
};
const toOptionalPaymentStatus = (value) => {
    if (!value)
        return undefined;
    const status = String(value).toUpperCase();
    return PAYMENT_STATUSES.includes(status) ? status : undefined;
};
const toOptionalPRStatus = (value) => {
    if (!value)
        return undefined;
    const status = String(value).toUpperCase();
    return PR_STATUSES.includes(status) ? status : undefined;
};
class PurchaseController {
    static getCompanyId(req) {
        var _a;
        const companyId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.companyId;
        if (!companyId) {
            throw new Error('Company context not found');
        }
        return companyId;
    }
    static getUserId(req) {
        var _a;
        return ((_a = req.user) === null || _a === void 0 ? void 0 : _a.uid) || 'SYSTEM';
    }
    static buildMovementUseCase() {
        return new RecordStockMovementUseCase_1.RecordStockMovementUseCase({
            itemRepository: bindRepositories_1.diContainer.itemRepository,
            warehouseRepository: bindRepositories_1.diContainer.warehouseRepository,
            stockMovementRepository: bindRepositories_1.diContainer.stockMovementRepository,
            stockLevelRepository: bindRepositories_1.diContainer.stockLevelRepository,
            companyRepository: bindRepositories_1.diContainer.companyRepository,
            transactionManager: bindRepositories_1.diContainer.transactionManager,
        });
    }
    static buildPurchasesInventoryService() {
        return new PurchasesInventoryService_1.PurchasesInventoryService(PurchaseController.buildMovementUseCase());
    }
    static buildAccountingPostingService(validateAccounts = false) {
        if (validateAccounts) {
            return new SubledgerVoucherPostingService_1.SubledgerVoucherPostingService(bindRepositories_1.diContainer.voucherRepository, bindRepositories_1.diContainer.ledgerRepository, bindRepositories_1.diContainer.companyCurrencyRepository, bindRepositories_1.diContainer.accountRepository, new VoucherValidationService_1.VoucherValidationService());
        }
        return new SubledgerVoucherPostingService_1.SubledgerVoucherPostingService(bindRepositories_1.diContainer.voucherRepository, bindRepositories_1.diContainer.ledgerRepository, bindRepositories_1.diContainer.companyCurrencyRepository);
    }
    static async initializePurchases(req, res, next) {
        try {
            (0, purchases_validators_1.validateInitializePurchasesInput)(req.body);
            const companyId = PurchaseController.getCompanyId(req);
            const userId = PurchaseController.getUserId(req);
            const useCase = new PurchaseSettingsUseCases_1.InitializePurchasesUseCase(bindRepositories_1.diContainer.purchaseSettingsRepository, bindRepositories_1.diContainer.accountRepository, bindRepositories_1.diContainer.companyModuleRepository, bindRepositories_1.diContainer.voucherTypeDefinitionRepository, bindRepositories_1.diContainer.voucherFormRepository);
            const settings = await useCase.execute(Object.assign(Object.assign({}, (req.body || {})), { companyId,
                userId }));
            res.status(200).json({
                success: true,
                data: PurchaseDTOs_1.PurchaseDTOMapper.toSettingsDTO(settings),
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async getSettings(req, res, next) {
        try {
            const companyId = PurchaseController.getCompanyId(req);
            const useCase = new PurchaseSettingsUseCases_1.GetPurchaseSettingsUseCase(bindRepositories_1.diContainer.purchaseSettingsRepository, bindRepositories_1.diContainer.voucherTypeDefinitionRepository, bindRepositories_1.diContainer.voucherFormRepository);
            const settings = await useCase.execute(companyId);
            res.json({
                success: true,
                data: settings ? PurchaseDTOs_1.PurchaseDTOMapper.toSettingsDTO(settings) : null,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async updateSettings(req, res, next) {
        try {
            (0, purchases_validators_1.validateUpdatePurchaseSettingsInput)(req.body);
            const companyId = PurchaseController.getCompanyId(req);
            const useCase = new PurchaseSettingsUseCases_1.UpdatePurchaseSettingsUseCase(bindRepositories_1.diContainer.purchaseSettingsRepository, bindRepositories_1.diContainer.accountRepository, bindRepositories_1.diContainer.voucherTypeDefinitionRepository, bindRepositories_1.diContainer.voucherFormRepository);
            const settings = await useCase.execute(Object.assign(Object.assign({}, (req.body || {})), { companyId }));
            res.json({
                success: true,
                data: PurchaseDTOs_1.PurchaseDTOMapper.toSettingsDTO(settings),
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async createPO(req, res, next) {
        try {
            (0, purchases_validators_1.validateCreatePurchaseOrderInput)(req.body);
            const companyId = PurchaseController.getCompanyId(req);
            const userId = PurchaseController.getUserId(req);
            const useCase = new PurchaseOrderUseCases_1.CreatePurchaseOrderUseCase(bindRepositories_1.diContainer.purchaseSettingsRepository, bindRepositories_1.diContainer.purchaseOrderRepository, bindRepositories_1.diContainer.partyRepository, bindRepositories_1.diContainer.itemRepository, bindRepositories_1.diContainer.taxCodeRepository, bindRepositories_1.diContainer.companyCurrencyRepository);
            const po = await useCase.execute(Object.assign(Object.assign({}, (req.body || {})), { companyId, createdBy: userId }));
            res.status(201).json({
                success: true,
                data: PurchaseDTOs_1.PurchaseDTOMapper.toOrderDTO(po),
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async listPOs(req, res, next) {
        try {
            (0, purchases_validators_1.validateListPurchaseOrdersQuery)(req.query);
            const companyId = PurchaseController.getCompanyId(req);
            const useCase = new PurchaseOrderUseCases_1.ListPurchaseOrdersUseCase(bindRepositories_1.diContainer.purchaseOrderRepository);
            const orders = await useCase.execute(companyId, {
                status: toOptionalStatus(req.query.status),
                vendorId: req.query.vendorId ? String(req.query.vendorId) : undefined,
                dateFrom: req.query.dateFrom ? String(req.query.dateFrom) : undefined,
                dateTo: req.query.dateTo ? String(req.query.dateTo) : undefined,
                limit: toOptionalNumber(req.query.limit),
                offset: toOptionalNumber(req.query.offset),
            });
            res.json({
                success: true,
                data: orders.map((po) => PurchaseDTOs_1.PurchaseDTOMapper.toOrderDTO(po)),
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async getPO(req, res, next) {
        try {
            const companyId = PurchaseController.getCompanyId(req);
            const id = String(req.params.id);
            const useCase = new PurchaseOrderUseCases_1.GetPurchaseOrderUseCase(bindRepositories_1.diContainer.purchaseOrderRepository);
            const po = await useCase.execute(companyId, id);
            res.json({
                success: true,
                data: PurchaseDTOs_1.PurchaseDTOMapper.toOrderDTO(po),
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async updatePO(req, res, next) {
        try {
            (0, purchases_validators_1.validateUpdatePurchaseOrderInput)(req.body);
            const companyId = PurchaseController.getCompanyId(req);
            const id = String(req.params.id);
            const useCase = new PurchaseOrderUseCases_1.UpdatePurchaseOrderUseCase(bindRepositories_1.diContainer.purchaseOrderRepository, bindRepositories_1.diContainer.partyRepository, bindRepositories_1.diContainer.itemRepository, bindRepositories_1.diContainer.taxCodeRepository);
            const po = await useCase.execute(Object.assign(Object.assign({}, (req.body || {})), { companyId,
                id }));
            res.json({
                success: true,
                data: PurchaseDTOs_1.PurchaseDTOMapper.toOrderDTO(po),
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async confirmPO(req, res, next) {
        try {
            const companyId = PurchaseController.getCompanyId(req);
            const id = String(req.params.id);
            const useCase = new PurchaseOrderUseCases_1.ConfirmPurchaseOrderUseCase(bindRepositories_1.diContainer.purchaseOrderRepository);
            const po = await useCase.execute(companyId, id);
            res.json({
                success: true,
                data: PurchaseDTOs_1.PurchaseDTOMapper.toOrderDTO(po),
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async cancelPO(req, res, next) {
        try {
            const companyId = PurchaseController.getCompanyId(req);
            const id = String(req.params.id);
            const useCase = new PurchaseOrderUseCases_1.CancelPurchaseOrderUseCase(bindRepositories_1.diContainer.purchaseOrderRepository);
            const po = await useCase.execute(companyId, id);
            res.json({
                success: true,
                data: PurchaseDTOs_1.PurchaseDTOMapper.toOrderDTO(po),
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async closePO(req, res, next) {
        try {
            const companyId = PurchaseController.getCompanyId(req);
            const id = String(req.params.id);
            const useCase = new PurchaseOrderUseCases_1.ClosePurchaseOrderUseCase(bindRepositories_1.diContainer.purchaseOrderRepository);
            const po = await useCase.execute(companyId, id);
            res.json({
                success: true,
                data: PurchaseDTOs_1.PurchaseDTOMapper.toOrderDTO(po),
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async createGRN(req, res, next) {
        try {
            (0, purchases_validators_1.validateCreateGoodsReceiptInput)(req.body);
            const companyId = PurchaseController.getCompanyId(req);
            const userId = PurchaseController.getUserId(req);
            const useCase = new GoodsReceiptUseCases_1.CreateGoodsReceiptUseCase(bindRepositories_1.diContainer.purchaseSettingsRepository, bindRepositories_1.diContainer.goodsReceiptRepository, bindRepositories_1.diContainer.purchaseOrderRepository, bindRepositories_1.diContainer.partyRepository, bindRepositories_1.diContainer.itemRepository);
            const grn = await useCase.execute(Object.assign(Object.assign({}, (req.body || {})), { companyId, createdBy: userId }));
            res.status(201).json({
                success: true,
                data: PurchaseDTOs_1.PurchaseDTOMapper.toGoodsReceiptDTO(grn),
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async listGRNs(req, res, next) {
        try {
            (0, purchases_validators_1.validateListGoodsReceiptsQuery)(req.query);
            const companyId = PurchaseController.getCompanyId(req);
            const useCase = new GoodsReceiptUseCases_1.ListGoodsReceiptsUseCase(bindRepositories_1.diContainer.goodsReceiptRepository);
            const list = await useCase.execute(companyId, {
                purchaseOrderId: req.query.purchaseOrderId ? String(req.query.purchaseOrderId) : undefined,
                status: toOptionalGRNStatus(req.query.status),
                limit: toOptionalNumber(req.query.limit),
            });
            res.json({
                success: true,
                data: list.map((grn) => PurchaseDTOs_1.PurchaseDTOMapper.toGoodsReceiptDTO(grn)),
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async getGRN(req, res, next) {
        try {
            const companyId = PurchaseController.getCompanyId(req);
            const id = String(req.params.id);
            const useCase = new GoodsReceiptUseCases_1.GetGoodsReceiptUseCase(bindRepositories_1.diContainer.goodsReceiptRepository);
            const grn = await useCase.execute(companyId, id);
            res.json({
                success: true,
                data: PurchaseDTOs_1.PurchaseDTOMapper.toGoodsReceiptDTO(grn),
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async updateGRN(req, res, next) {
        try {
            const companyId = PurchaseController.getCompanyId(req);
            const id = String(req.params.id);
            const useCase = new GoodsReceiptUseCases_1.UpdateGoodsReceiptUseCase(bindRepositories_1.diContainer.goodsReceiptRepository, bindRepositories_1.diContainer.partyRepository);
            const grn = await useCase.execute(Object.assign(Object.assign({}, (req.body || {})), { companyId,
                id }));
            res.json({
                success: true,
                data: PurchaseDTOs_1.PurchaseDTOMapper.toGoodsReceiptDTO(grn),
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async postGRN(req, res, next) {
        try {
            const companyId = PurchaseController.getCompanyId(req);
            const id = String(req.params.id);
            const inventoryService = PurchaseController.buildPurchasesInventoryService();
            const useCase = new GoodsReceiptUseCases_1.PostGoodsReceiptUseCase(bindRepositories_1.diContainer.purchaseSettingsRepository, bindRepositories_1.diContainer.goodsReceiptRepository, bindRepositories_1.diContainer.purchaseOrderRepository, bindRepositories_1.diContainer.itemRepository, bindRepositories_1.diContainer.warehouseRepository, bindRepositories_1.diContainer.uomConversionRepository, inventoryService, bindRepositories_1.diContainer.transactionManager);
            const grn = await useCase.execute(companyId, id);
            res.json({
                success: true,
                data: PurchaseDTOs_1.PurchaseDTOMapper.toGoodsReceiptDTO(grn),
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async unpostGRN(req, res, next) {
        try {
            const companyId = PurchaseController.getCompanyId(req);
            const id = String(req.params.id);
            const inventoryService = PurchaseController.buildPurchasesInventoryService();
            const useCase = new GoodsReceiptUseCases_1.UnpostGoodsReceiptUseCase(bindRepositories_1.diContainer.goodsReceiptRepository, bindRepositories_1.diContainer.purchaseOrderRepository, inventoryService, bindRepositories_1.diContainer.transactionManager);
            const grn = await useCase.execute(companyId, id);
            res.json({
                success: true,
                data: PurchaseDTOs_1.PurchaseDTOMapper.toGoodsReceiptDTO(grn),
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async createPI(req, res, next) {
        try {
            (0, purchases_validators_1.validateCreatePurchaseInvoiceInput)(req.body);
            const companyId = PurchaseController.getCompanyId(req);
            const userId = PurchaseController.getUserId(req);
            const useCase = new PurchaseInvoiceUseCases_1.CreatePurchaseInvoiceUseCase(bindRepositories_1.diContainer.purchaseSettingsRepository, bindRepositories_1.diContainer.purchaseInvoiceRepository, bindRepositories_1.diContainer.purchaseOrderRepository, bindRepositories_1.diContainer.partyRepository, bindRepositories_1.diContainer.itemRepository, bindRepositories_1.diContainer.taxCodeRepository, bindRepositories_1.diContainer.companyCurrencyRepository);
            const pi = await useCase.execute(Object.assign(Object.assign({}, (req.body || {})), { companyId, createdBy: userId }));
            res.status(201).json({
                success: true,
                data: PurchaseDTOs_1.PurchaseDTOMapper.toPurchaseInvoiceDTO(pi),
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async updatePI(req, res, next) {
        try {
            (0, purchases_validators_1.validateUpdatePurchaseInvoiceInput)(req.body);
            const companyId = PurchaseController.getCompanyId(req);
            const id = String(req.params.id);
            const useCase = new PurchaseInvoiceUseCases_1.UpdatePurchaseInvoiceUseCase(bindRepositories_1.diContainer.purchaseInvoiceRepository, bindRepositories_1.diContainer.partyRepository);
            const pi = await useCase.execute(Object.assign(Object.assign({}, (req.body || {})), { companyId,
                id }));
            res.json({
                success: true,
                data: PurchaseDTOs_1.PurchaseDTOMapper.toPurchaseInvoiceDTO(pi),
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async listPIs(req, res, next) {
        try {
            (0, purchases_validators_1.validateListPurchaseInvoicesQuery)(req.query);
            const companyId = PurchaseController.getCompanyId(req);
            const useCase = new PurchaseInvoiceUseCases_1.ListPurchaseInvoicesUseCase(bindRepositories_1.diContainer.purchaseInvoiceRepository);
            const list = await useCase.execute(companyId, {
                vendorId: req.query.vendorId ? String(req.query.vendorId) : undefined,
                purchaseOrderId: req.query.purchaseOrderId ? String(req.query.purchaseOrderId) : undefined,
                status: toOptionalPIStatus(req.query.status),
                paymentStatus: toOptionalPaymentStatus(req.query.paymentStatus),
                limit: toOptionalNumber(req.query.limit),
            });
            res.json({
                success: true,
                data: list.map((pi) => PurchaseDTOs_1.PurchaseDTOMapper.toPurchaseInvoiceDTO(pi)),
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async getPI(req, res, next) {
        try {
            const companyId = PurchaseController.getCompanyId(req);
            const id = String(req.params.id);
            const useCase = new PurchaseInvoiceUseCases_1.GetPurchaseInvoiceUseCase(bindRepositories_1.diContainer.purchaseInvoiceRepository);
            const pi = await useCase.execute(companyId, id);
            res.json({
                success: true,
                data: PurchaseDTOs_1.PurchaseDTOMapper.toPurchaseInvoiceDTO(pi),
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async postPI(req, res, next) {
        try {
            const companyId = PurchaseController.getCompanyId(req);
            const id = String(req.params.id);
            const inventoryService = PurchaseController.buildPurchasesInventoryService();
            const accountingPostingService = PurchaseController.buildAccountingPostingService(true);
            const useCase = new PurchaseInvoiceUseCases_1.PostPurchaseInvoiceUseCase(bindRepositories_1.diContainer.purchaseSettingsRepository, bindRepositories_1.diContainer.inventorySettingsRepository, bindRepositories_1.diContainer.purchaseInvoiceRepository, bindRepositories_1.diContainer.purchaseOrderRepository, bindRepositories_1.diContainer.partyRepository, bindRepositories_1.diContainer.taxCodeRepository, bindRepositories_1.diContainer.itemRepository, bindRepositories_1.diContainer.itemCategoryRepository, bindRepositories_1.diContainer.warehouseRepository, bindRepositories_1.diContainer.uomConversionRepository, bindRepositories_1.diContainer.companyCurrencyRepository, bindRepositories_1.diContainer.exchangeRateRepository, inventoryService, accountingPostingService, bindRepositories_1.diContainer.accountRepository, bindRepositories_1.diContainer.transactionManager);
            const pi = await useCase.execute(companyId, id);
            res.json({
                success: true,
                data: PurchaseDTOs_1.PurchaseDTOMapper.toPurchaseInvoiceDTO(pi),
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async unpostPI(req, res, next) {
        try {
            const companyId = PurchaseController.getCompanyId(req);
            const id = String(req.params.id);
            const userId = PurchaseController.getUserId(req);
            const inventoryService = PurchaseController.buildPurchasesInventoryService();
            const accountingPostingService = PurchaseController.buildAccountingPostingService();
            const useCase = new PurchaseInvoiceUseCases_1.UnpostPurchaseInvoiceUseCase(bindRepositories_1.diContainer.purchaseInvoiceRepository, bindRepositories_1.diContainer.purchaseOrderRepository, inventoryService, accountingPostingService, bindRepositories_1.diContainer.transactionManager);
            const pi = await useCase.execute(companyId, id, userId);
            res.json({
                success: true,
                data: PurchaseDTOs_1.PurchaseDTOMapper.toPurchaseInvoiceDTO(pi),
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async updatePaymentStatus(req, res, next) {
        try {
            (0, purchases_validators_1.validateUpdateInvoicePaymentStatusInput)(req.body);
            const companyId = PurchaseController.getCompanyId(req);
            const id = String(req.params.id);
            const paymentAmountBase = Number(req.body.paymentAmountBase);
            const useCase = new PaymentSyncUseCases_1.UpdateInvoicePaymentStatusUseCase(bindRepositories_1.diContainer.purchaseInvoiceRepository);
            const invoice = await useCase.execute(companyId, id, paymentAmountBase);
            res.json({
                success: true,
                data: PurchaseDTOs_1.PurchaseDTOMapper.toPurchaseInvoiceDTO(invoice),
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async createReturn(req, res, next) {
        try {
            (0, purchases_validators_1.validateCreatePurchaseReturnInput)(req.body);
            const companyId = PurchaseController.getCompanyId(req);
            const userId = PurchaseController.getUserId(req);
            const useCase = new PurchaseReturnUseCases_1.CreatePurchaseReturnUseCase(bindRepositories_1.diContainer.purchaseSettingsRepository, bindRepositories_1.diContainer.purchaseReturnRepository, bindRepositories_1.diContainer.purchaseInvoiceRepository, bindRepositories_1.diContainer.goodsReceiptRepository, bindRepositories_1.diContainer.partyRepository, bindRepositories_1.diContainer.itemRepository);
            const purchaseReturn = await useCase.execute(Object.assign(Object.assign({}, (req.body || {})), { companyId, createdBy: userId }));
            res.status(201).json({
                success: true,
                data: PurchaseDTOs_1.PurchaseDTOMapper.toPurchaseReturnDTO(purchaseReturn),
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async listReturns(req, res, next) {
        try {
            (0, purchases_validators_1.validateListPurchaseReturnsQuery)(req.query);
            const companyId = PurchaseController.getCompanyId(req);
            const useCase = new PurchaseReturnUseCases_1.ListPurchaseReturnsUseCase(bindRepositories_1.diContainer.purchaseReturnRepository);
            const list = await useCase.execute(companyId, {
                vendorId: req.query.vendorId ? String(req.query.vendorId) : undefined,
                purchaseInvoiceId: req.query.purchaseInvoiceId
                    ? String(req.query.purchaseInvoiceId)
                    : undefined,
                goodsReceiptId: req.query.goodsReceiptId
                    ? String(req.query.goodsReceiptId)
                    : undefined,
                status: toOptionalPRStatus(req.query.status),
            });
            res.json({
                success: true,
                data: list.map((entry) => PurchaseDTOs_1.PurchaseDTOMapper.toPurchaseReturnDTO(entry)),
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async getReturn(req, res, next) {
        try {
            const companyId = PurchaseController.getCompanyId(req);
            const id = String(req.params.id);
            const useCase = new PurchaseReturnUseCases_1.GetPurchaseReturnUseCase(bindRepositories_1.diContainer.purchaseReturnRepository);
            const pr = await useCase.execute(companyId, id);
            res.json({
                success: true,
                data: PurchaseDTOs_1.PurchaseDTOMapper.toPurchaseReturnDTO(pr),
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async updateReturn(req, res, next) {
        try {
            const companyId = PurchaseController.getCompanyId(req);
            const id = String(req.params.id);
            const userId = PurchaseController.getUserId(req);
            const useCase = new PurchaseReturnUseCases_1.UpdatePurchaseReturnUseCase(bindRepositories_1.diContainer.purchaseReturnRepository, bindRepositories_1.diContainer.partyRepository, bindRepositories_1.diContainer.itemRepository);
            const pr = await useCase.execute(Object.assign(Object.assign({}, (req.body || {})), { companyId,
                id, updatedBy: userId }));
            res.json({
                success: true,
                data: PurchaseDTOs_1.PurchaseDTOMapper.toPurchaseReturnDTO(pr),
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async postReturn(req, res, next) {
        try {
            const companyId = PurchaseController.getCompanyId(req);
            const id = String(req.params.id);
            const userId = PurchaseController.getUserId(req);
            const inventoryService = PurchaseController.buildPurchasesInventoryService();
            const accountingPostingService = PurchaseController.buildAccountingPostingService();
            const useCase = new PurchaseReturnUseCases_1.PostPurchaseReturnUseCase(bindRepositories_1.diContainer.purchaseSettingsRepository, bindRepositories_1.diContainer.purchaseReturnRepository, bindRepositories_1.diContainer.companySettingsRepository, bindRepositories_1.diContainer.purchaseInvoiceRepository, bindRepositories_1.diContainer.goodsReceiptRepository, bindRepositories_1.diContainer.purchaseOrderRepository, bindRepositories_1.diContainer.partyRepository, bindRepositories_1.diContainer.taxCodeRepository, bindRepositories_1.diContainer.itemRepository, bindRepositories_1.diContainer.uomConversionRepository, bindRepositories_1.diContainer.companyCurrencyRepository, inventoryService, accountingPostingService, bindRepositories_1.diContainer.transactionManager);
            const pr = await useCase.execute(companyId, id);
            res.json({
                success: true,
                data: PurchaseDTOs_1.PurchaseDTOMapper.toPurchaseReturnDTO(pr),
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async unpostReturn(req, res, next) {
        try {
            const companyId = PurchaseController.getCompanyId(req);
            const id = String(req.params.id);
            const userId = PurchaseController.getUserId(req);
            const inventoryService = PurchaseController.buildPurchasesInventoryService();
            const accountingPostingService = PurchaseController.buildAccountingPostingService();
            const useCase = new PurchaseReturnUseCases_1.UnpostPurchaseReturnUseCase(bindRepositories_1.diContainer.purchaseReturnRepository, bindRepositories_1.diContainer.purchaseInvoiceRepository, bindRepositories_1.diContainer.purchaseOrderRepository, bindRepositories_1.diContainer.goodsReceiptRepository, inventoryService, accountingPostingService, bindRepositories_1.diContainer.transactionManager);
            const pr = await useCase.execute(companyId, id, userId);
            res.json({
                success: true,
                data: PurchaseDTOs_1.PurchaseDTOMapper.toPurchaseReturnDTO(pr),
            });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.PurchaseController = PurchaseController;
//# sourceMappingURL=PurchaseController.js.map