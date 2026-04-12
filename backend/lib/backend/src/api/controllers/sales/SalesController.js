"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SalesController = void 0;
const RecordStockMovementUseCase_1 = require("../../../application/inventory/use-cases/RecordStockMovementUseCase");
const SalesInventoryService_1 = require("../../../application/inventory/services/SalesInventoryService");
const DeliveryNoteUseCases_1 = require("../../../application/sales/use-cases/DeliveryNoteUseCases");
const SalesInvoiceUseCases_1 = require("../../../application/sales/use-cases/SalesInvoiceUseCases");
const PaymentSyncUseCases_1 = require("../../../application/sales/use-cases/PaymentSyncUseCases");
const SalesOrderUseCases_1 = require("../../../application/sales/use-cases/SalesOrderUseCases");
const SalesSettingsUseCases_1 = require("../../../application/sales/use-cases/SalesSettingsUseCases");
const SalesReturnUseCases_1 = require("../../../application/sales/use-cases/SalesReturnUseCases");
const bindRepositories_1 = require("../../../infrastructure/di/bindRepositories");
const SalesDTOs_1 = require("../../dtos/SalesDTOs");
const VoucherValidationService_1 = require("../../../domain/accounting/services/VoucherValidationService");
const SubledgerVoucherPostingService_1 = require("../../../application/accounting/services/SubledgerVoucherPostingService");
const sales_validators_1 = require("../../validators/sales.validators");
const SO_STATUSES = [
    'DRAFT',
    'CONFIRMED',
    'PARTIALLY_DELIVERED',
    'FULLY_DELIVERED',
    'CLOSED',
    'CANCELLED',
];
const DN_STATUSES = ['DRAFT', 'POSTED', 'CANCELLED'];
const SI_STATUSES = ['DRAFT', 'POSTED', 'CANCELLED'];
const SR_STATUSES = ['DRAFT', 'POSTED', 'CANCELLED'];
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
    return SO_STATUSES.includes(status) ? status : undefined;
};
const toOptionalDNStatus = (value) => {
    if (!value)
        return undefined;
    const status = String(value).toUpperCase();
    return DN_STATUSES.includes(status) ? status : undefined;
};
const toOptionalSIStatus = (value) => {
    if (!value)
        return undefined;
    const status = String(value).toUpperCase();
    return SI_STATUSES.includes(status) ? status : undefined;
};
const toOptionalSRStatus = (value) => {
    if (!value)
        return undefined;
    const status = String(value).toUpperCase();
    return SR_STATUSES.includes(status) ? status : undefined;
};
const toOptionalPaymentStatus = (value) => {
    if (!value)
        return undefined;
    const status = String(value).toUpperCase();
    return PAYMENT_STATUSES.includes(status) ? status : undefined;
};
class SalesController {
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
    static buildSalesInventoryService() {
        return new SalesInventoryService_1.SalesInventoryService(SalesController.buildMovementUseCase());
    }
    static buildAccountingPostingService(validateAccounts = false) {
        if (validateAccounts) {
            return new SubledgerVoucherPostingService_1.SubledgerVoucherPostingService(bindRepositories_1.diContainer.voucherRepository, bindRepositories_1.diContainer.ledgerRepository, bindRepositories_1.diContainer.companyCurrencyRepository, bindRepositories_1.diContainer.accountRepository, new VoucherValidationService_1.VoucherValidationService());
        }
        return new SubledgerVoucherPostingService_1.SubledgerVoucherPostingService(bindRepositories_1.diContainer.voucherRepository, bindRepositories_1.diContainer.ledgerRepository, bindRepositories_1.diContainer.companyCurrencyRepository);
    }
    static async initializeSales(req, res, next) {
        try {
            (0, sales_validators_1.validateInitializeSalesInput)(req.body);
            const companyId = SalesController.getCompanyId(req);
            const userId = SalesController.getUserId(req);
            const useCase = new SalesSettingsUseCases_1.InitializeSalesUseCase(bindRepositories_1.diContainer.salesSettingsRepository, bindRepositories_1.diContainer.accountRepository, bindRepositories_1.diContainer.companyModuleRepository, bindRepositories_1.diContainer.voucherTypeDefinitionRepository, bindRepositories_1.diContainer.voucherFormRepository);
            const settings = await useCase.execute(Object.assign(Object.assign({}, (req.body || {})), { companyId,
                userId }));
            res.status(200).json({
                success: true,
                data: SalesDTOs_1.SalesDTOMapper.toSettingsDTO(settings),
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async getSettings(req, res, next) {
        try {
            const companyId = SalesController.getCompanyId(req);
            const useCase = new SalesSettingsUseCases_1.GetSalesSettingsUseCase(bindRepositories_1.diContainer.salesSettingsRepository, bindRepositories_1.diContainer.voucherTypeDefinitionRepository, bindRepositories_1.diContainer.voucherFormRepository);
            const settings = await useCase.execute(companyId);
            res.json({
                success: true,
                data: settings ? SalesDTOs_1.SalesDTOMapper.toSettingsDTO(settings) : null,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async updateSettings(req, res, next) {
        try {
            (0, sales_validators_1.validateUpdateSalesSettingsInput)(req.body);
            const companyId = SalesController.getCompanyId(req);
            const useCase = new SalesSettingsUseCases_1.UpdateSalesSettingsUseCase(bindRepositories_1.diContainer.salesSettingsRepository, bindRepositories_1.diContainer.accountRepository, bindRepositories_1.diContainer.voucherTypeDefinitionRepository, bindRepositories_1.diContainer.voucherFormRepository);
            const settings = await useCase.execute(Object.assign(Object.assign({}, (req.body || {})), { companyId }));
            res.json({
                success: true,
                data: SalesDTOs_1.SalesDTOMapper.toSettingsDTO(settings),
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async createSO(req, res, next) {
        try {
            (0, sales_validators_1.validateCreateSalesOrderInput)(req.body);
            const companyId = SalesController.getCompanyId(req);
            const userId = SalesController.getUserId(req);
            const useCase = new SalesOrderUseCases_1.CreateSalesOrderUseCase(bindRepositories_1.diContainer.salesSettingsRepository, bindRepositories_1.diContainer.salesOrderRepository, bindRepositories_1.diContainer.partyRepository, bindRepositories_1.diContainer.itemRepository, bindRepositories_1.diContainer.taxCodeRepository, bindRepositories_1.diContainer.companyCurrencyRepository);
            const so = await useCase.execute(Object.assign(Object.assign({}, (req.body || {})), { companyId, createdBy: userId }));
            res.status(201).json({
                success: true,
                data: SalesDTOs_1.SalesDTOMapper.toOrderDTO(so),
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async listSOs(req, res, next) {
        try {
            (0, sales_validators_1.validateListSalesOrdersQuery)(req.query);
            const companyId = SalesController.getCompanyId(req);
            const useCase = new SalesOrderUseCases_1.ListSalesOrdersUseCase(bindRepositories_1.diContainer.salesOrderRepository);
            const orders = await useCase.execute(companyId, {
                status: toOptionalStatus(req.query.status),
                customerId: req.query.customerId ? String(req.query.customerId) : undefined,
                dateFrom: req.query.dateFrom ? String(req.query.dateFrom) : undefined,
                dateTo: req.query.dateTo ? String(req.query.dateTo) : undefined,
                limit: toOptionalNumber(req.query.limit),
                offset: toOptionalNumber(req.query.offset),
            });
            res.json({
                success: true,
                data: orders.map((order) => SalesDTOs_1.SalesDTOMapper.toOrderDTO(order)),
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async getSO(req, res, next) {
        try {
            const companyId = SalesController.getCompanyId(req);
            const id = String(req.params.id);
            const useCase = new SalesOrderUseCases_1.GetSalesOrderUseCase(bindRepositories_1.diContainer.salesOrderRepository);
            const so = await useCase.execute(companyId, id);
            res.json({
                success: true,
                data: SalesDTOs_1.SalesDTOMapper.toOrderDTO(so),
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async updateSO(req, res, next) {
        try {
            (0, sales_validators_1.validateUpdateSalesOrderInput)(req.body);
            const companyId = SalesController.getCompanyId(req);
            const id = String(req.params.id);
            const useCase = new SalesOrderUseCases_1.UpdateSalesOrderUseCase(bindRepositories_1.diContainer.salesOrderRepository, bindRepositories_1.diContainer.partyRepository, bindRepositories_1.diContainer.itemRepository, bindRepositories_1.diContainer.taxCodeRepository);
            const so = await useCase.execute(Object.assign(Object.assign({}, (req.body || {})), { companyId,
                id }));
            res.json({
                success: true,
                data: SalesDTOs_1.SalesDTOMapper.toOrderDTO(so),
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async confirmSO(req, res, next) {
        try {
            const companyId = SalesController.getCompanyId(req);
            const id = String(req.params.id);
            const useCase = new SalesOrderUseCases_1.ConfirmSalesOrderUseCase(bindRepositories_1.diContainer.salesOrderRepository);
            const so = await useCase.execute(companyId, id);
            res.json({
                success: true,
                data: SalesDTOs_1.SalesDTOMapper.toOrderDTO(so),
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async cancelSO(req, res, next) {
        try {
            const companyId = SalesController.getCompanyId(req);
            const id = String(req.params.id);
            const useCase = new SalesOrderUseCases_1.CancelSalesOrderUseCase(bindRepositories_1.diContainer.salesOrderRepository);
            const so = await useCase.execute(companyId, id);
            res.json({
                success: true,
                data: SalesDTOs_1.SalesDTOMapper.toOrderDTO(so),
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async closeSO(req, res, next) {
        try {
            const companyId = SalesController.getCompanyId(req);
            const id = String(req.params.id);
            const useCase = new SalesOrderUseCases_1.CloseSalesOrderUseCase(bindRepositories_1.diContainer.salesOrderRepository);
            const so = await useCase.execute(companyId, id);
            res.json({
                success: true,
                data: SalesDTOs_1.SalesDTOMapper.toOrderDTO(so),
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async createDN(req, res, next) {
        try {
            (0, sales_validators_1.validateCreateDeliveryNoteInput)(req.body);
            const companyId = SalesController.getCompanyId(req);
            const userId = SalesController.getUserId(req);
            const useCase = new DeliveryNoteUseCases_1.CreateDeliveryNoteUseCase(bindRepositories_1.diContainer.salesSettingsRepository, bindRepositories_1.diContainer.deliveryNoteRepository, bindRepositories_1.diContainer.salesOrderRepository, bindRepositories_1.diContainer.partyRepository, bindRepositories_1.diContainer.itemRepository);
            const dn = await useCase.execute(Object.assign(Object.assign({}, (req.body || {})), { companyId, createdBy: userId }));
            res.status(201).json({
                success: true,
                data: SalesDTOs_1.SalesDTOMapper.toDeliveryNoteDTO(dn),
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async listDNs(req, res, next) {
        try {
            (0, sales_validators_1.validateListDeliveryNotesQuery)(req.query);
            const companyId = SalesController.getCompanyId(req);
            const useCase = new DeliveryNoteUseCases_1.ListDeliveryNotesUseCase(bindRepositories_1.diContainer.deliveryNoteRepository);
            const list = await useCase.execute(companyId, {
                salesOrderId: req.query.salesOrderId ? String(req.query.salesOrderId) : undefined,
                status: toOptionalDNStatus(req.query.status),
                limit: toOptionalNumber(req.query.limit),
            });
            res.json({
                success: true,
                data: list.map((dn) => SalesDTOs_1.SalesDTOMapper.toDeliveryNoteDTO(dn)),
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async getDN(req, res, next) {
        try {
            const companyId = SalesController.getCompanyId(req);
            const id = String(req.params.id);
            const useCase = new DeliveryNoteUseCases_1.GetDeliveryNoteUseCase(bindRepositories_1.diContainer.deliveryNoteRepository);
            const dn = await useCase.execute(companyId, id);
            res.json({
                success: true,
                data: SalesDTOs_1.SalesDTOMapper.toDeliveryNoteDTO(dn),
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async postDN(req, res, next) {
        try {
            const companyId = SalesController.getCompanyId(req);
            const id = String(req.params.id);
            const inventoryService = SalesController.buildSalesInventoryService();
            const accountingPostingService = SalesController.buildAccountingPostingService();
            const useCase = new DeliveryNoteUseCases_1.PostDeliveryNoteUseCase(bindRepositories_1.diContainer.salesSettingsRepository, bindRepositories_1.diContainer.deliveryNoteRepository, bindRepositories_1.diContainer.salesOrderRepository, bindRepositories_1.diContainer.itemRepository, bindRepositories_1.diContainer.itemCategoryRepository, bindRepositories_1.diContainer.warehouseRepository, bindRepositories_1.diContainer.uomConversionRepository, bindRepositories_1.diContainer.companyCurrencyRepository, inventoryService, accountingPostingService, bindRepositories_1.diContainer.transactionManager);
            const dn = await useCase.execute(companyId, id);
            res.json({
                success: true,
                data: SalesDTOs_1.SalesDTOMapper.toDeliveryNoteDTO(dn),
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async createSI(req, res, next) {
        try {
            (0, sales_validators_1.validateCreateSalesInvoiceInput)(req.body);
            const companyId = SalesController.getCompanyId(req);
            const userId = SalesController.getUserId(req);
            const useCase = new SalesInvoiceUseCases_1.CreateSalesInvoiceUseCase(bindRepositories_1.diContainer.salesSettingsRepository, bindRepositories_1.diContainer.salesInvoiceRepository, bindRepositories_1.diContainer.salesOrderRepository, bindRepositories_1.diContainer.partyRepository, bindRepositories_1.diContainer.itemRepository, bindRepositories_1.diContainer.itemCategoryRepository, bindRepositories_1.diContainer.taxCodeRepository, bindRepositories_1.diContainer.companyCurrencyRepository);
            const si = await useCase.execute(Object.assign(Object.assign({}, (req.body || {})), { companyId, createdBy: userId }));
            res.status(201).json({
                success: true,
                data: SalesDTOs_1.SalesDTOMapper.toSalesInvoiceDTO(si),
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async listSIs(req, res, next) {
        try {
            (0, sales_validators_1.validateListSalesInvoicesQuery)(req.query);
            const companyId = SalesController.getCompanyId(req);
            const useCase = new SalesInvoiceUseCases_1.ListSalesInvoicesUseCase(bindRepositories_1.diContainer.salesInvoiceRepository);
            const list = await useCase.execute(companyId, {
                customerId: req.query.customerId ? String(req.query.customerId) : undefined,
                salesOrderId: req.query.salesOrderId ? String(req.query.salesOrderId) : undefined,
                status: toOptionalSIStatus(req.query.status),
                paymentStatus: toOptionalPaymentStatus(req.query.paymentStatus),
                limit: toOptionalNumber(req.query.limit),
            });
            res.json({
                success: true,
                data: list.map((si) => SalesDTOs_1.SalesDTOMapper.toSalesInvoiceDTO(si)),
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async getSI(req, res, next) {
        try {
            const companyId = SalesController.getCompanyId(req);
            const id = String(req.params.id);
            const useCase = new SalesInvoiceUseCases_1.GetSalesInvoiceUseCase(bindRepositories_1.diContainer.salesInvoiceRepository);
            const si = await useCase.execute(companyId, id);
            res.json({
                success: true,
                data: SalesDTOs_1.SalesDTOMapper.toSalesInvoiceDTO(si),
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async updateSI(req, res, next) {
        try {
            (0, sales_validators_1.validateUpdateSalesInvoiceInput)(req.body);
            const companyId = SalesController.getCompanyId(req);
            const id = String(req.params.id);
            const useCase = new SalesInvoiceUseCases_1.UpdateSalesInvoiceUseCase(bindRepositories_1.diContainer.salesInvoiceRepository, bindRepositories_1.diContainer.partyRepository);
            const si = await useCase.execute(Object.assign(Object.assign({}, (req.body || {})), { companyId,
                id }));
            res.json({
                success: true,
                data: SalesDTOs_1.SalesDTOMapper.toSalesInvoiceDTO(si),
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async postSI(req, res, next) {
        try {
            const companyId = SalesController.getCompanyId(req);
            const id = String(req.params.id);
            const inventoryService = SalesController.buildSalesInventoryService();
            const accountingPostingService = SalesController.buildAccountingPostingService(true);
            const useCase = new SalesInvoiceUseCases_1.PostSalesInvoiceUseCase(bindRepositories_1.diContainer.salesSettingsRepository, bindRepositories_1.diContainer.inventorySettingsRepository, bindRepositories_1.diContainer.salesInvoiceRepository, bindRepositories_1.diContainer.salesOrderRepository, bindRepositories_1.diContainer.deliveryNoteRepository, bindRepositories_1.diContainer.partyRepository, bindRepositories_1.diContainer.taxCodeRepository, bindRepositories_1.diContainer.itemRepository, bindRepositories_1.diContainer.itemCategoryRepository, bindRepositories_1.diContainer.warehouseRepository, bindRepositories_1.diContainer.uomConversionRepository, bindRepositories_1.diContainer.companyCurrencyRepository, inventoryService, accountingPostingService, bindRepositories_1.diContainer.accountRepository, bindRepositories_1.diContainer.transactionManager);
            const si = await useCase.execute(companyId, id);
            res.json({
                success: true,
                data: SalesDTOs_1.SalesDTOMapper.toSalesInvoiceDTO(si),
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async createReturn(req, res, next) {
        try {
            (0, sales_validators_1.validateCreateSalesReturnInput)(req.body);
            const companyId = SalesController.getCompanyId(req);
            const userId = SalesController.getUserId(req);
            const useCase = new SalesReturnUseCases_1.CreateSalesReturnUseCase(bindRepositories_1.diContainer.salesSettingsRepository, bindRepositories_1.diContainer.salesReturnRepository, bindRepositories_1.diContainer.salesInvoiceRepository, bindRepositories_1.diContainer.deliveryNoteRepository);
            const salesReturn = await useCase.execute(Object.assign(Object.assign({}, (req.body || {})), { companyId, createdBy: userId }));
            res.status(201).json({
                success: true,
                data: SalesDTOs_1.SalesDTOMapper.toSalesReturnDTO(salesReturn),
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async listReturns(req, res, next) {
        try {
            (0, sales_validators_1.validateListSalesReturnsQuery)(req.query);
            const companyId = SalesController.getCompanyId(req);
            const useCase = new SalesReturnUseCases_1.ListSalesReturnsUseCase(bindRepositories_1.diContainer.salesReturnRepository);
            const list = await useCase.execute(companyId, {
                customerId: req.query.customerId ? String(req.query.customerId) : undefined,
                salesInvoiceId: req.query.salesInvoiceId ? String(req.query.salesInvoiceId) : undefined,
                deliveryNoteId: req.query.deliveryNoteId ? String(req.query.deliveryNoteId) : undefined,
                status: toOptionalSRStatus(req.query.status),
            });
            res.json({
                success: true,
                data: list.map((entry) => SalesDTOs_1.SalesDTOMapper.toSalesReturnDTO(entry)),
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async getReturn(req, res, next) {
        try {
            const companyId = SalesController.getCompanyId(req);
            const id = String(req.params.id);
            const useCase = new SalesReturnUseCases_1.GetSalesReturnUseCase(bindRepositories_1.diContainer.salesReturnRepository);
            const salesReturn = await useCase.execute(companyId, id);
            res.json({
                success: true,
                data: SalesDTOs_1.SalesDTOMapper.toSalesReturnDTO(salesReturn),
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async postReturn(req, res, next) {
        try {
            const companyId = SalesController.getCompanyId(req);
            const id = String(req.params.id);
            const inventoryService = SalesController.buildSalesInventoryService();
            const accountingPostingService = SalesController.buildAccountingPostingService();
            const useCase = new SalesReturnUseCases_1.PostSalesReturnUseCase(bindRepositories_1.diContainer.salesSettingsRepository, bindRepositories_1.diContainer.inventorySettingsRepository, bindRepositories_1.diContainer.salesReturnRepository, bindRepositories_1.diContainer.salesInvoiceRepository, bindRepositories_1.diContainer.deliveryNoteRepository, bindRepositories_1.diContainer.salesOrderRepository, bindRepositories_1.diContainer.partyRepository, bindRepositories_1.diContainer.taxCodeRepository, bindRepositories_1.diContainer.itemRepository, bindRepositories_1.diContainer.itemCategoryRepository, bindRepositories_1.diContainer.uomConversionRepository, bindRepositories_1.diContainer.companyCurrencyRepository, inventoryService, accountingPostingService, bindRepositories_1.diContainer.transactionManager);
            const salesReturn = await useCase.execute(companyId, id);
            res.json({
                success: true,
                data: SalesDTOs_1.SalesDTOMapper.toSalesReturnDTO(salesReturn),
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async updatePaymentStatus(req, res, next) {
        try {
            (0, sales_validators_1.validateUpdateSalesInvoicePaymentStatusInput)(req.body || {});
            const companyId = SalesController.getCompanyId(req);
            const id = String(req.params.id);
            const paidAmountBase = Number(req.body.paidAmountBase);
            const useCase = new PaymentSyncUseCases_1.UpdateSalesInvoicePaymentStatusUseCase(bindRepositories_1.diContainer.salesInvoiceRepository);
            const invoice = await useCase.execute(companyId, id, paidAmountBase);
            res.json({
                success: true,
                data: SalesDTOs_1.SalesDTOMapper.toSalesInvoiceDTO(invoice),
            });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.SalesController = SalesController;
//# sourceMappingURL=SalesController.js.map