"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryController = void 0;
const ApiError_1 = require("../../errors/ApiError");
const ItemUseCases_1 = require("../../../application/inventory/use-cases/ItemUseCases");
const UomUseCases_1 = require("../../../application/inventory/use-cases/UomUseCases");
const WarehouseUseCases_1 = require("../../../application/inventory/use-cases/WarehouseUseCases");
const CategoryUseCases_1 = require("../../../application/inventory/use-cases/CategoryUseCases");
const UomConversionUseCases_1 = require("../../../application/inventory/use-cases/UomConversionUseCases");
const UomConversionGovernanceUseCases_1 = require("../../../application/inventory/use-cases/UomConversionGovernanceUseCases");
const OpeningStockDocumentUseCases_1 = require("../../../application/inventory/use-cases/OpeningStockDocumentUseCases");
const StockAdjustmentUseCases_1 = require("../../../application/inventory/use-cases/StockAdjustmentUseCases");
const StockLevelUseCases_1 = require("../../../application/inventory/use-cases/StockLevelUseCases");
const MovementHistoryUseCases_1 = require("../../../application/inventory/use-cases/MovementHistoryUseCases");
const InitializeInventoryUseCase_1 = require("../../../application/inventory/use-cases/InitializeInventoryUseCase");
const ReconcileStockUseCase_1 = require("../../../application/inventory/use-cases/ReconcileStockUseCase");
const RecordStockMovementUseCase_1 = require("../../../application/inventory/use-cases/RecordStockMovementUseCase");
const StockTransferUseCases_1 = require("../../../application/inventory/use-cases/StockTransferUseCases");
const ReturnUseCases_1 = require("../../../application/inventory/use-cases/ReturnUseCases");
const PeriodSnapshotUseCases_1 = require("../../../application/inventory/use-cases/PeriodSnapshotUseCases");
const DashboardUseCases_1 = require("../../../application/inventory/use-cases/DashboardUseCases");
const StockReservationUseCases_1 = require("../../../application/inventory/use-cases/StockReservationUseCases");
const CostQueryUseCases_1 = require("../../../application/inventory/use-cases/CostQueryUseCases");
const ReferenceQueryUseCases_1 = require("../../../application/inventory/use-cases/ReferenceQueryUseCases");
const SubledgerVoucherPostingService_1 = require("../../../application/accounting/services/SubledgerVoucherPostingService");
const PurchasesInventoryService_1 = require("../../../application/inventory/services/PurchasesInventoryService");
const GoodsReceiptUseCases_1 = require("../../../application/purchases/use-cases/GoodsReceiptUseCases");
const PurchaseInvoiceUseCases_1 = require("../../../application/purchases/use-cases/PurchaseInvoiceUseCases");
const PurchaseReturnUseCases_1 = require("../../../application/purchases/use-cases/PurchaseReturnUseCases");
const bindRepositories_1 = require("../../../infrastructure/di/bindRepositories");
const InventoryDTOs_1 = require("../../dtos/InventoryDTOs");
const VoucherValidationService_1 = require("../../../domain/accounting/services/VoucherValidationService");
const inventory_validators_1 = require("../../validators/inventory.validators");
const InventorySettings_1 = require("../../../domain/inventory/entities/InventorySettings");
const DocumentPolicyResolver_1 = require("../../../application/common/services/DocumentPolicyResolver");
class InventoryController {
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
    static buildAccountingPostingService() {
        return new SubledgerVoucherPostingService_1.SubledgerVoucherPostingService(bindRepositories_1.diContainer.voucherRepository, bindRepositories_1.diContainer.ledgerRepository, bindRepositories_1.diContainer.companyCurrencyRepository, bindRepositories_1.diContainer.accountRepository, new VoucherValidationService_1.VoucherValidationService());
    }
    static buildPurchasesInventoryService() {
        return new PurchasesInventoryService_1.PurchasesInventoryService(InventoryController.buildMovementUseCase());
    }
    static buildUomImpactUseCase() {
        return new UomConversionGovernanceUseCases_1.AnalyzeUomConversionImpactUseCase(bindRepositories_1.diContainer.uomConversionRepository, bindRepositories_1.diContainer.itemRepository, bindRepositories_1.diContainer.stockMovementRepository, bindRepositories_1.diContainer.goodsReceiptRepository, bindRepositories_1.diContainer.purchaseInvoiceRepository, bindRepositories_1.diContainer.purchaseReturnRepository, bindRepositories_1.diContainer.deliveryNoteRepository, bindRepositories_1.diContainer.salesInvoiceRepository, bindRepositories_1.diContainer.salesReturnRepository);
    }
    static async initialize(req, res, next) {
        try {
            (0, inventory_validators_1.validateInitializeInventoryInput)(req.body);
            const companyId = InventoryController.getCompanyId(req);
            const userId = InventoryController.getUserId(req);
            const useCase = new InitializeInventoryUseCase_1.InitializeInventoryUseCase(bindRepositories_1.diContainer.companyRepository, bindRepositories_1.diContainer.inventorySettingsRepository, bindRepositories_1.diContainer.warehouseRepository, bindRepositories_1.diContainer.uomRepository, bindRepositories_1.diContainer.companyModuleRepository);
            const result = await useCase.execute({
                companyId,
                userId,
                defaultWarehouseName: req.body.defaultWarehouseName,
                defaultWarehouseCode: req.body.defaultWarehouseCode,
                defaultCostCurrency: req.body.defaultCostCurrency,
                allowNegativeStock: req.body.allowNegativeStock,
                autoGenerateItemCode: req.body.autoGenerateItemCode,
                itemCodePrefix: req.body.itemCodePrefix,
                itemCodeNextSeq: req.body.itemCodeNextSeq,
                defaultCOGSAccountId: req.body.defaultCOGSAccountId,
                accountingMode: req.body.accountingMode,
                inventoryAccountingMethod: req.body.inventoryAccountingMethod,
                defaultInventoryAssetAccountId: req.body.defaultInventoryAssetAccountId,
            });
            res.status(200).json({
                success: true,
                data: {
                    settings: InventoryDTOs_1.InventoryDTOMapper.toSettingsDTO(result.settings),
                    defaultWarehouse: result.defaultWarehouse ? InventoryDTOs_1.InventoryDTOMapper.toWarehouseDTO(result.defaultWarehouse) : null,
                },
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async getSettings(req, res, next) {
        try {
            const companyId = InventoryController.getCompanyId(req);
            const settings = await bindRepositories_1.diContainer.inventorySettingsRepository.getSettings(companyId);
            res.json({
                success: true,
                data: settings ? InventoryDTOs_1.InventoryDTOMapper.toSettingsDTO(settings) : null,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async updateSettings(req, res, next) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        try {
            (0, inventory_validators_1.validateUpdateSettingsInput)(req.body);
            const companyId = InventoryController.getCompanyId(req);
            const current = await bindRepositories_1.diContainer.inventorySettingsRepository.getSettings(companyId);
            const company = await bindRepositories_1.diContainer.companyRepository.findById(companyId);
            if (!company)
                throw new Error(`Company not found: ${companyId}`);
            const requestedAccountingMode = req.body.accountingMode
                || (req.body.inventoryAccountingMethod
                    ? DocumentPolicyResolver_1.DocumentPolicyResolver.legacyInventoryMethodToAccountingMode(req.body.inventoryAccountingMethod)
                    : undefined);
            if (requestedAccountingMode &&
                current &&
                requestedAccountingMode !== DocumentPolicyResolver_1.DocumentPolicyResolver.resolveAccountingMode(current)) {
                throw ApiError_1.ApiError.badRequest('The inventory accounting mode cannot be changed after initialization.');
            }
            const effectiveAccountingMode = current
                ? DocumentPolicyResolver_1.DocumentPolicyResolver.resolveAccountingMode(current)
                : requestedAccountingMode || 'PERPETUAL';
            const settings = new InventorySettings_1.InventorySettings({
                companyId,
                accountingMode: effectiveAccountingMode,
                inventoryAccountingMethod: DocumentPolicyResolver_1.DocumentPolicyResolver.accountingModeToLegacyInventoryMethod(effectiveAccountingMode),
                defaultCostingMethod: 'MOVING_AVG',
                defaultCostCurrency: req.body.defaultCostCurrency || (current === null || current === void 0 ? void 0 : current.defaultCostCurrency) || company.baseCurrency,
                defaultInventoryAssetAccountId: (_a = req.body.defaultInventoryAssetAccountId) !== null && _a !== void 0 ? _a : current === null || current === void 0 ? void 0 : current.defaultInventoryAssetAccountId,
                allowNegativeStock: (_c = (_b = req.body.allowNegativeStock) !== null && _b !== void 0 ? _b : current === null || current === void 0 ? void 0 : current.allowNegativeStock) !== null && _c !== void 0 ? _c : true,
                defaultWarehouseId: (_d = req.body.defaultWarehouseId) !== null && _d !== void 0 ? _d : current === null || current === void 0 ? void 0 : current.defaultWarehouseId,
                autoGenerateItemCode: (_f = (_e = req.body.autoGenerateItemCode) !== null && _e !== void 0 ? _e : current === null || current === void 0 ? void 0 : current.autoGenerateItemCode) !== null && _f !== void 0 ? _f : false,
                itemCodePrefix: (_g = req.body.itemCodePrefix) !== null && _g !== void 0 ? _g : current === null || current === void 0 ? void 0 : current.itemCodePrefix,
                itemCodeNextSeq: (_j = (_h = req.body.itemCodeNextSeq) !== null && _h !== void 0 ? _h : current === null || current === void 0 ? void 0 : current.itemCodeNextSeq) !== null && _j !== void 0 ? _j : 1,
                defaultCOGSAccountId: req.body.defaultCOGSAccountId !== undefined
                    ? req.body.defaultCOGSAccountId
                    : current === null || current === void 0 ? void 0 : current.defaultCOGSAccountId,
            });
            await bindRepositories_1.diContainer.inventorySettingsRepository.saveSettings(settings);
            res.json({
                success: true,
                data: InventoryDTOs_1.InventoryDTOMapper.toSettingsDTO(settings),
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async createItem(req, res, next) {
        try {
            (0, inventory_validators_1.validateCreateItemInput)(req.body);
            const companyId = InventoryController.getCompanyId(req);
            const userId = InventoryController.getUserId(req);
            const useCase = new ItemUseCases_1.CreateItemUseCase(bindRepositories_1.diContainer.itemRepository, bindRepositories_1.diContainer.itemCategoryRepository, bindRepositories_1.diContainer.uomRepository);
            const item = await useCase.execute(Object.assign(Object.assign({}, req.body), { companyId, createdBy: userId }));
            res.status(201).json({
                success: true,
                data: InventoryDTOs_1.InventoryDTOMapper.toItemDTO(item)
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async listItems(req, res, next) {
        try {
            const companyId = InventoryController.getCompanyId(req);
            const useCase = new ItemUseCases_1.ListItemsUseCase(bindRepositories_1.diContainer.itemRepository);
            const items = await useCase.execute(companyId, {
                type: req.query.type,
                categoryId: req.query.categoryId,
                active: req.query.active === undefined
                    ? undefined
                    : String(req.query.active) === 'true',
                trackInventory: req.query.trackInventory === undefined
                    ? undefined
                    : String(req.query.trackInventory) === 'true',
                limit: req.query.limit ? Number(req.query.limit) : undefined,
                offset: req.query.offset ? Number(req.query.offset) : undefined,
            });
            res.json({
                success: true,
                data: items.map(InventoryDTOs_1.InventoryDTOMapper.toItemDTO)
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async searchItems(req, res, next) {
        try {
            const companyId = InventoryController.getCompanyId(req);
            const query = String(req.query.q || '');
            const items = await bindRepositories_1.diContainer.itemRepository.searchItems(companyId, query, {
                trackInventory: req.query.trackInventory === undefined
                    ? undefined
                    : String(req.query.trackInventory) === 'true',
                limit: req.query.limit ? Number(req.query.limit) : 50,
                offset: req.query.offset ? Number(req.query.offset) : 0,
            });
            res.json({
                success: true,
                data: items.map(InventoryDTOs_1.InventoryDTOMapper.toItemDTO),
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async getItem(req, res, next) {
        try {
            const useCase = new ItemUseCases_1.GetItemUseCase(bindRepositories_1.diContainer.itemRepository);
            const item = await useCase.execute(req.params.id);
            res.json({
                success: true,
                data: item ? InventoryDTOs_1.InventoryDTOMapper.toItemDTO(item) : null,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async updateItem(req, res, next) {
        try {
            (0, inventory_validators_1.validateUpdateItemInput)(req.body);
            const useCase = new ItemUseCases_1.UpdateItemUseCase(bindRepositories_1.diContainer.itemRepository, bindRepositories_1.diContainer.uomRepository);
            const item = await useCase.execute(req.params.id, req.body);
            res.json({
                success: true,
                data: InventoryDTOs_1.InventoryDTOMapper.toItemDTO(item),
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async deleteItem(req, res, next) {
        try {
            const useCase = new ItemUseCases_1.DeleteItemUseCase(bindRepositories_1.diContainer.itemRepository);
            await useCase.execute(req.params.id);
            res.json({ success: true });
        }
        catch (error) {
            next(error);
        }
    }
    static async createCategory(req, res, next) {
        try {
            (0, inventory_validators_1.validateCreateCategoryInput)(req.body);
            const companyId = InventoryController.getCompanyId(req);
            const useCase = new CategoryUseCases_1.ManageCategoriesUseCase(bindRepositories_1.diContainer.itemCategoryRepository);
            const category = await useCase.create(Object.assign({ companyId }, req.body));
            res.status(201).json({
                success: true,
                data: InventoryDTOs_1.InventoryDTOMapper.toCategoryDTO(category),
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async listCategories(req, res, next) {
        try {
            const companyId = InventoryController.getCompanyId(req);
            const useCase = new CategoryUseCases_1.ManageCategoriesUseCase(bindRepositories_1.diContainer.itemCategoryRepository);
            const categories = await useCase.list(companyId, req.query.parentId);
            res.json({
                success: true,
                data: categories.map(InventoryDTOs_1.InventoryDTOMapper.toCategoryDTO),
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async updateCategory(req, res, next) {
        try {
            (0, inventory_validators_1.validateUpdateCategoryInput)(req.body);
            const useCase = new CategoryUseCases_1.ManageCategoriesUseCase(bindRepositories_1.diContainer.itemCategoryRepository);
            const category = await useCase.update(req.params.id, req.body);
            res.json({
                success: true,
                data: InventoryDTOs_1.InventoryDTOMapper.toCategoryDTO(category),
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async deleteCategory(req, res, next) {
        try {
            const useCase = new CategoryUseCases_1.ManageCategoriesUseCase(bindRepositories_1.diContainer.itemCategoryRepository);
            await useCase.delete(req.params.id);
            res.json({ success: true });
        }
        catch (error) {
            next(error);
        }
    }
    static async createWarehouse(req, res, next) {
        try {
            (0, inventory_validators_1.validateCreateWarehouseInput)(req.body);
            const companyId = InventoryController.getCompanyId(req);
            const useCase = new WarehouseUseCases_1.CreateWarehouseUseCase(bindRepositories_1.diContainer.warehouseRepository);
            const body = req.body || {};
            const warehouse = await useCase.execute(Object.assign(Object.assign({ companyId }, body), { parentId: body.parentId ? String(body.parentId) : undefined }));
            res.status(201).json({
                success: true,
                data: InventoryDTOs_1.InventoryDTOMapper.toWarehouseDTO(warehouse),
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async listWarehouses(req, res, next) {
        try {
            const companyId = InventoryController.getCompanyId(req);
            const useCase = new WarehouseUseCases_1.ListWarehousesUseCase(bindRepositories_1.diContainer.warehouseRepository);
            const warehouses = await useCase.execute(companyId, {
                active: req.query.active === undefined
                    ? undefined
                    : String(req.query.active) === 'true',
                limit: req.query.limit ? Number(req.query.limit) : undefined,
                offset: req.query.offset ? Number(req.query.offset) : undefined,
            });
            res.json({
                success: true,
                data: warehouses.map(InventoryDTOs_1.InventoryDTOMapper.toWarehouseDTO),
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async getWarehouse(req, res, next) {
        try {
            const companyId = InventoryController.getCompanyId(req);
            const useCase = new WarehouseUseCases_1.GetWarehouseUseCase(bindRepositories_1.diContainer.warehouseRepository);
            const warehouse = await useCase.execute(companyId, req.params.id);
            res.json({
                success: true,
                data: warehouse ? InventoryDTOs_1.InventoryDTOMapper.toWarehouseDTO(warehouse) : null,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async updateWarehouse(req, res, next) {
        try {
            (0, inventory_validators_1.validateUpdateWarehouseInput)(req.body);
            const useCase = new WarehouseUseCases_1.UpdateWarehouseUseCase(bindRepositories_1.diContainer.warehouseRepository);
            const body = req.body || {};
            const updateInput = Object.assign(Object.assign({}, body), (Object.prototype.hasOwnProperty.call(body, 'parentId')
                ? { parentId: body.parentId ? String(body.parentId) : null }
                : {}));
            const warehouse = await useCase.execute(req.params.id, updateInput);
            res.json({
                success: true,
                data: InventoryDTOs_1.InventoryDTOMapper.toWarehouseDTO(warehouse),
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async createUom(req, res, next) {
        try {
            (0, inventory_validators_1.validateCreateUomInput)(req.body);
            const companyId = InventoryController.getCompanyId(req);
            const userId = InventoryController.getUserId(req);
            const useCase = new UomUseCases_1.CreateUomUseCase(bindRepositories_1.diContainer.uomRepository);
            const uom = await useCase.execute(Object.assign({ companyId, createdBy: userId }, (req.body || {})));
            res.status(201).json({
                success: true,
                data: InventoryDTOs_1.InventoryDTOMapper.toUomDTO(uom),
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async listUoms(req, res, next) {
        try {
            const companyId = InventoryController.getCompanyId(req);
            const useCase = new UomUseCases_1.ListUomsUseCase(bindRepositories_1.diContainer.uomRepository);
            const uoms = await useCase.execute(companyId, {
                active: req.query.active === undefined
                    ? undefined
                    : String(req.query.active) === 'true',
                limit: req.query.limit ? Number(req.query.limit) : undefined,
                offset: req.query.offset ? Number(req.query.offset) : undefined,
            });
            res.json({
                success: true,
                data: uoms.map(InventoryDTOs_1.InventoryDTOMapper.toUomDTO),
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async getUom(req, res, next) {
        try {
            const companyId = InventoryController.getCompanyId(req);
            const useCase = new UomUseCases_1.GetUomUseCase(bindRepositories_1.diContainer.uomRepository);
            const uom = await useCase.execute(req.params.id);
            if (uom && uom.companyId !== companyId) {
                throw ApiError_1.ApiError.notFound('UOM not found');
            }
            res.json({
                success: true,
                data: uom ? InventoryDTOs_1.InventoryDTOMapper.toUomDTO(uom) : null,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async updateUom(req, res, next) {
        try {
            (0, inventory_validators_1.validateUpdateUomInput)(req.body);
            const companyId = InventoryController.getCompanyId(req);
            const getUseCase = new UomUseCases_1.GetUomUseCase(bindRepositories_1.diContainer.uomRepository);
            const current = await getUseCase.execute(req.params.id);
            if (!current || current.companyId !== companyId) {
                throw ApiError_1.ApiError.notFound('UOM not found');
            }
            const useCase = new UomUseCases_1.UpdateUomUseCase(bindRepositories_1.diContainer.uomRepository);
            const uom = await useCase.execute(req.params.id, req.body);
            res.json({
                success: true,
                data: InventoryDTOs_1.InventoryDTOMapper.toUomDTO(uom),
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async createUomConversion(req, res, next) {
        try {
            (0, inventory_validators_1.validateCreateUomConversionInput)(req.body);
            const companyId = InventoryController.getCompanyId(req);
            const useCase = new UomConversionUseCases_1.ManageUomConversionsUseCase(bindRepositories_1.diContainer.uomConversionRepository, bindRepositories_1.diContainer.uomRepository);
            const conversion = await useCase.create(Object.assign({ companyId }, req.body));
            res.status(201).json({
                success: true,
                data: InventoryDTOs_1.InventoryDTOMapper.toUomConversionDTO(conversion),
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async listUomConversions(req, res, next) {
        try {
            const companyId = InventoryController.getCompanyId(req);
            const itemId = req.params.itemId;
            const useCase = new UomConversionUseCases_1.ManageUomConversionsUseCase(bindRepositories_1.diContainer.uomConversionRepository, bindRepositories_1.diContainer.uomRepository);
            const conversions = await useCase.listForItem(companyId, itemId);
            res.json({
                success: true,
                data: conversions.map(InventoryDTOs_1.InventoryDTOMapper.toUomConversionDTO),
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async getUomConversionImpact(req, res, next) {
        try {
            (0, inventory_validators_1.validateUomConversionImpactQuery)(req.query);
            const companyId = InventoryController.getCompanyId(req);
            const conversionId = String(req.params.id);
            const proposedFactorRaw = req.query.proposedFactor;
            const proposedFactor = proposedFactorRaw === undefined ? undefined : Number(proposedFactorRaw);
            const useCase = InventoryController.buildUomImpactUseCase();
            const report = await useCase.execute({
                companyId,
                conversionId,
                proposedFactor,
            });
            res.json({
                success: true,
                data: report,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async updateUomConversion(req, res, next) {
        try {
            (0, inventory_validators_1.validateUpdateUomConversionInput)(req.body);
            const companyId = InventoryController.getCompanyId(req);
            const conversionId = String(req.params.id);
            const useCase = new UomConversionUseCases_1.ManageUomConversionsUseCase(bindRepositories_1.diContainer.uomConversionRepository, bindRepositories_1.diContainer.uomRepository);
            const current = await useCase.get(conversionId);
            if (!current || current.companyId !== companyId) {
                throw ApiError_1.ApiError.notFound('UOM conversion not found');
            }
            const impactUseCase = InventoryController.buildUomImpactUseCase();
            const impact = await impactUseCase.execute({
                companyId,
                conversionId,
            });
            if (impact.used) {
                throw ApiError_1.ApiError.conflict('This conversion is already used in posted stock movements and cannot be edited directly. '
                    + 'Use impact analysis and smart correction, or manually reverse related documents first.');
            }
            const conversion = await useCase.update(conversionId, req.body);
            res.json({
                success: true,
                data: InventoryDTOs_1.InventoryDTOMapper.toUomConversionDTO(conversion),
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async deleteUomConversion(req, res, next) {
        try {
            const companyId = InventoryController.getCompanyId(req);
            const conversionId = String(req.params.id);
            const useCase = new UomConversionUseCases_1.ManageUomConversionsUseCase(bindRepositories_1.diContainer.uomConversionRepository, bindRepositories_1.diContainer.uomRepository);
            const current = await useCase.get(conversionId);
            if (!current || current.companyId !== companyId) {
                throw ApiError_1.ApiError.notFound('UOM conversion not found');
            }
            const impactUseCase = InventoryController.buildUomImpactUseCase();
            const impact = await impactUseCase.execute({
                companyId,
                conversionId,
            });
            if (impact.used) {
                throw ApiError_1.ApiError.conflict('This conversion is already used in posted stock movements and cannot be deleted. '
                    + 'Use impact analysis and smart correction, or manually reverse related documents first.');
            }
            await useCase.delete(conversionId);
            res.json({ success: true });
        }
        catch (error) {
            next(error);
        }
    }
    static async applyUomConversionCorrection(req, res, next) {
        try {
            (0, inventory_validators_1.validateApplyUomConversionCorrectionInput)(req.body);
            const companyId = InventoryController.getCompanyId(req);
            const userId = InventoryController.getUserId(req);
            const conversionId = String(req.params.id);
            const newFactor = Number(req.body.newFactor);
            const manageUseCase = new UomConversionUseCases_1.ManageUomConversionsUseCase(bindRepositories_1.diContainer.uomConversionRepository, bindRepositories_1.diContainer.uomRepository);
            const current = await manageUseCase.get(conversionId);
            if (!current || current.companyId !== companyId) {
                throw ApiError_1.ApiError.notFound('UOM conversion not found');
            }
            const impactUseCase = InventoryController.buildUomImpactUseCase();
            const impact = await impactUseCase.execute({
                companyId,
                conversionId,
                proposedFactor: newFactor,
            });
            if (Math.abs(current.factor - newFactor) < 0.0000001) {
                res.json({
                    success: true,
                    data: {
                        conversion: InventoryDTOs_1.InventoryDTOMapper.toUomConversionDTO(current),
                        impact,
                        noChanges: true,
                    },
                });
                return;
            }
            if (!impact.used) {
                const updated = await manageUseCase.update(conversionId, { factor: newFactor });
                res.json({
                    success: true,
                    data: {
                        conversion: InventoryDTOs_1.InventoryDTOMapper.toUomConversionDTO(updated),
                        impact,
                        autoFix: {
                            mode: 'NONE',
                            unposted: { purchaseReturns: 0, purchaseInvoices: 0, goodsReceipts: 0 },
                            reposted: { goodsReceipts: 0, purchaseInvoices: 0, purchaseReturns: 0 },
                        },
                    },
                });
                return;
            }
            if (impact.hasSalesUsage) {
                throw ApiError_1.ApiError.conflict('This conversion has posted sales usage. Smart auto-fix currently supports purchases only. '
                    + 'Reverse/cleanup sales documents first, then retry.');
            }
            const purchaseBlockers = impact.impactedReferences.filter((entry) => entry.module === 'purchases' && !entry.canAutoFix);
            if (purchaseBlockers.length > 0) {
                const first = purchaseBlockers[0];
                throw ApiError_1.ApiError.conflict(`Auto-fix blocked by ${first.referenceType} ${first.referenceId}: ${first.autoFixReason || 'document is not auto-fix eligible.'}`);
            }
            const uniqueIds = (ids) => Array.from(new Set(ids.filter(Boolean)));
            const purchaseReferences = impact.impactedReferences.filter((entry) => entry.module === 'purchases');
            const purchaseReturnIds = uniqueIds(purchaseReferences.filter((entry) => entry.referenceType === 'PURCHASE_RETURN').map((entry) => entry.referenceId));
            const purchaseInvoiceIds = uniqueIds(purchaseReferences.filter((entry) => entry.referenceType === 'PURCHASE_INVOICE').map((entry) => entry.referenceId));
            const goodsReceiptIds = uniqueIds(purchaseReferences.filter((entry) => entry.referenceType === 'GOODS_RECEIPT').map((entry) => entry.referenceId));
            const purchasesInventoryService = InventoryController.buildPurchasesInventoryService();
            const accountingPostingService = InventoryController.buildAccountingPostingService();
            const unpostGoodsReceiptUseCase = new GoodsReceiptUseCases_1.UnpostGoodsReceiptUseCase(bindRepositories_1.diContainer.goodsReceiptRepository, bindRepositories_1.diContainer.purchaseOrderRepository, purchasesInventoryService, accountingPostingService, bindRepositories_1.diContainer.transactionManager);
            const unpostPurchaseInvoiceUseCase = new PurchaseInvoiceUseCases_1.UnpostPurchaseInvoiceUseCase(bindRepositories_1.diContainer.purchaseInvoiceRepository, bindRepositories_1.diContainer.purchaseOrderRepository, purchasesInventoryService, accountingPostingService, bindRepositories_1.diContainer.transactionManager);
            const unpostPurchaseReturnUseCase = new PurchaseReturnUseCases_1.UnpostPurchaseReturnUseCase(bindRepositories_1.diContainer.purchaseReturnRepository, bindRepositories_1.diContainer.purchaseInvoiceRepository, bindRepositories_1.diContainer.purchaseOrderRepository, bindRepositories_1.diContainer.goodsReceiptRepository, purchasesInventoryService, accountingPostingService, bindRepositories_1.diContainer.transactionManager);
            const postGoodsReceiptUseCase = new GoodsReceiptUseCases_1.PostGoodsReceiptUseCase(bindRepositories_1.diContainer.purchaseSettingsRepository, bindRepositories_1.diContainer.inventorySettingsRepository, bindRepositories_1.diContainer.goodsReceiptRepository, bindRepositories_1.diContainer.purchaseOrderRepository, bindRepositories_1.diContainer.itemRepository, bindRepositories_1.diContainer.warehouseRepository, bindRepositories_1.diContainer.uomConversionRepository, bindRepositories_1.diContainer.companyCurrencyRepository, purchasesInventoryService, accountingPostingService, bindRepositories_1.diContainer.transactionManager);
            const postPurchaseInvoiceUseCase = new PurchaseInvoiceUseCases_1.PostPurchaseInvoiceUseCase(bindRepositories_1.diContainer.purchaseSettingsRepository, bindRepositories_1.diContainer.inventorySettingsRepository, bindRepositories_1.diContainer.purchaseInvoiceRepository, bindRepositories_1.diContainer.purchaseOrderRepository, bindRepositories_1.diContainer.partyRepository, bindRepositories_1.diContainer.taxCodeRepository, bindRepositories_1.diContainer.itemRepository, bindRepositories_1.diContainer.itemCategoryRepository, bindRepositories_1.diContainer.warehouseRepository, bindRepositories_1.diContainer.uomConversionRepository, bindRepositories_1.diContainer.companyCurrencyRepository, bindRepositories_1.diContainer.exchangeRateRepository, purchasesInventoryService, accountingPostingService, bindRepositories_1.diContainer.accountRepository, bindRepositories_1.diContainer.transactionManager);
            const postPurchaseReturnUseCase = new PurchaseReturnUseCases_1.PostPurchaseReturnUseCase(bindRepositories_1.diContainer.purchaseSettingsRepository, bindRepositories_1.diContainer.inventorySettingsRepository, bindRepositories_1.diContainer.purchaseReturnRepository, bindRepositories_1.diContainer.companySettingsRepository, bindRepositories_1.diContainer.purchaseInvoiceRepository, bindRepositories_1.diContainer.goodsReceiptRepository, bindRepositories_1.diContainer.purchaseOrderRepository, bindRepositories_1.diContainer.partyRepository, bindRepositories_1.diContainer.taxCodeRepository, bindRepositories_1.diContainer.itemRepository, bindRepositories_1.diContainer.uomConversionRepository, bindRepositories_1.diContainer.companyCurrencyRepository, purchasesInventoryService, accountingPostingService, bindRepositories_1.diContainer.transactionManager);
            for (const referenceId of purchaseReturnIds) {
                await unpostPurchaseReturnUseCase.execute(companyId, referenceId, userId);
            }
            for (const referenceId of purchaseInvoiceIds) {
                await unpostPurchaseInvoiceUseCase.execute(companyId, referenceId, userId);
            }
            for (const referenceId of goodsReceiptIds) {
                await unpostGoodsReceiptUseCase.execute(companyId, referenceId);
            }
            const updatedConversion = await manageUseCase.update(conversionId, { factor: newFactor });
            for (const referenceId of goodsReceiptIds) {
                await postGoodsReceiptUseCase.execute(companyId, referenceId);
            }
            for (const referenceId of purchaseInvoiceIds) {
                await postPurchaseInvoiceUseCase.execute(companyId, referenceId);
            }
            for (const referenceId of purchaseReturnIds) {
                await postPurchaseReturnUseCase.execute(companyId, referenceId);
            }
            const afterImpact = await impactUseCase.execute({
                companyId,
                conversionId,
            });
            res.json({
                success: true,
                data: {
                    conversion: InventoryDTOs_1.InventoryDTOMapper.toUomConversionDTO(updatedConversion),
                    impactBefore: impact,
                    impactAfter: afterImpact,
                    autoFix: {
                        mode: 'PURCHASES_REVERSE_REPOST',
                        unposted: {
                            purchaseReturns: purchaseReturnIds.length,
                            purchaseInvoices: purchaseInvoiceIds.length,
                            goodsReceipts: goodsReceiptIds.length,
                        },
                        reposted: {
                            goodsReceipts: goodsReceiptIds.length,
                            purchaseInvoices: purchaseInvoiceIds.length,
                            purchaseReturns: purchaseReturnIds.length,
                        },
                    },
                },
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async getStockLevels(req, res, next) {
        try {
            const companyId = InventoryController.getCompanyId(req);
            const useCase = new StockLevelUseCases_1.GetStockLevelsUseCase(bindRepositories_1.diContainer.stockLevelRepository);
            const levels = await useCase.execute(companyId, {
                itemId: req.query.itemId,
                warehouseId: req.query.warehouseId,
                limit: req.query.limit ? Number(req.query.limit) : undefined,
                offset: req.query.offset ? Number(req.query.offset) : undefined,
            });
            res.json({
                success: true,
                data: levels.map(InventoryDTOs_1.InventoryDTOMapper.toStockLevelDTO),
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async getStockLevelsByItem(req, res, next) {
        try {
            const companyId = InventoryController.getCompanyId(req);
            const useCase = new StockLevelUseCases_1.GetStockLevelsUseCase(bindRepositories_1.diContainer.stockLevelRepository);
            const levels = await useCase.execute(companyId, {
                itemId: req.params.itemId,
            });
            res.json({
                success: true,
                data: levels.map(InventoryDTOs_1.InventoryDTOMapper.toStockLevelDTO),
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async reserveStock(req, res, next) {
        try {
            (0, inventory_validators_1.validateCreateStockReservationInput)(req.body);
            const companyId = InventoryController.getCompanyId(req);
            const useCase = new StockReservationUseCases_1.ReserveStockUseCase(bindRepositories_1.diContainer.stockLevelRepository, bindRepositories_1.diContainer.transactionManager);
            const level = await useCase.execute({
                companyId,
                itemId: req.body.itemId,
                warehouseId: req.body.warehouseId,
                qty: req.body.qty,
            });
            res.json({
                success: true,
                data: InventoryDTOs_1.InventoryDTOMapper.toStockLevelDTO(level),
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async releaseStock(req, res, next) {
        try {
            (0, inventory_validators_1.validateCreateStockReservationInput)(req.body);
            const companyId = InventoryController.getCompanyId(req);
            const useCase = new StockReservationUseCases_1.ReleaseReservedStockUseCase(bindRepositories_1.diContainer.stockLevelRepository, bindRepositories_1.diContainer.transactionManager);
            const level = await useCase.execute({
                companyId,
                itemId: req.body.itemId,
                warehouseId: req.body.warehouseId,
                qty: req.body.qty,
            });
            res.json({
                success: true,
                data: InventoryDTOs_1.InventoryDTOMapper.toStockLevelDTO(level),
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async getMovements(req, res, next) {
        try {
            const companyId = InventoryController.getCompanyId(req);
            const useCase = new MovementHistoryUseCases_1.GetMovementHistoryUseCase(bindRepositories_1.diContainer.stockMovementRepository);
            const movements = await useCase.execute(companyId, {
                itemId: req.query.itemId,
                warehouseId: req.query.warehouseId,
                referenceType: req.query.referenceType,
                referenceId: req.query.referenceId,
                from: req.query.from,
                to: req.query.to,
                limit: req.query.limit ? Number(req.query.limit) : undefined,
                offset: req.query.offset ? Number(req.query.offset) : undefined,
            });
            res.json({
                success: true,
                data: movements.map(InventoryDTOs_1.InventoryDTOMapper.toStockMovementDTO),
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async getMovementByReference(req, res, next) {
        try {
            (0, inventory_validators_1.validateMovementByReferenceQuery)(req.query);
            const companyId = InventoryController.getCompanyId(req);
            const useCase = new ReferenceQueryUseCases_1.GetMovementForReferenceUseCase(bindRepositories_1.diContainer.stockMovementRepository);
            const movement = await useCase.execute(companyId, req.query.referenceType, req.query.referenceId, req.query.referenceLineId);
            res.json({
                success: true,
                data: movement ? InventoryDTOs_1.InventoryDTOMapper.toStockMovementDTO(movement) : null,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async getMovementsByItem(req, res, next) {
        try {
            const companyId = InventoryController.getCompanyId(req);
            const useCase = new MovementHistoryUseCases_1.GetMovementHistoryUseCase(bindRepositories_1.diContainer.stockMovementRepository);
            const movements = await useCase.getByItem(companyId, req.params.itemId, req.query.limit ? Number(req.query.limit) : undefined, req.query.offset ? Number(req.query.offset) : undefined);
            res.json({
                success: true,
                data: movements.map(InventoryDTOs_1.InventoryDTOMapper.toStockMovementDTO),
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async recordOpeningStock(req, res, next) {
        try {
            (0, inventory_validators_1.validateOpeningMovementInput)(req.body);
            const companyId = InventoryController.getCompanyId(req);
            const userId = InventoryController.getUserId(req);
            const useCase = InventoryController.buildMovementUseCase();
            const movement = await useCase.processIN({
                companyId,
                itemId: req.body.itemId,
                warehouseId: req.body.warehouseId,
                qty: req.body.qty,
                date: req.body.date,
                movementType: 'OPENING_STOCK',
                refs: {
                    type: 'OPENING',
                    docId: req.body.referenceId,
                    lineId: req.body.referenceLineId,
                },
                currentUser: userId,
                unitCostInMoveCurrency: req.body.unitCostInMoveCurrency,
                moveCurrency: req.body.moveCurrency,
                fxRateMovToBase: req.body.fxRateMovToBase,
                fxRateCCYToBase: req.body.fxRateCCYToBase,
                notes: req.body.notes,
                metadata: req.body.metadata,
            });
            res.status(201).json({
                success: true,
                data: InventoryDTOs_1.InventoryDTOMapper.toStockMovementDTO(movement),
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async createOpeningStockDocument(req, res, next) {
        try {
            (0, inventory_validators_1.validateCreateOpeningStockDocumentInput)(req.body);
            const companyId = InventoryController.getCompanyId(req);
            const userId = InventoryController.getUserId(req);
            const useCase = new OpeningStockDocumentUseCases_1.CreateOpeningStockDocumentUseCase(bindRepositories_1.diContainer.openingStockDocumentRepository, bindRepositories_1.diContainer.itemRepository, bindRepositories_1.diContainer.warehouseRepository, bindRepositories_1.diContainer.companyRepository, bindRepositories_1.diContainer.companyModuleRepository, bindRepositories_1.diContainer.accountRepository);
            const document = await useCase.execute(Object.assign(Object.assign({}, (req.body || {})), { companyId, createdBy: userId }));
            res.status(201).json({
                success: true,
                data: InventoryDTOs_1.InventoryDTOMapper.toOpeningStockDocumentDTO(document),
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async listOpeningStockDocuments(req, res, next) {
        try {
            const companyId = InventoryController.getCompanyId(req);
            const status = req.query.status;
            const useCase = new OpeningStockDocumentUseCases_1.ListOpeningStockDocumentsUseCase(bindRepositories_1.diContainer.openingStockDocumentRepository);
            const documents = await useCase.execute(companyId, status);
            res.json({
                success: true,
                data: documents.map(InventoryDTOs_1.InventoryDTOMapper.toOpeningStockDocumentDTO),
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async updateOpeningStockDocument(req, res, next) {
        try {
            (0, inventory_validators_1.validateUpdateOpeningStockDocumentInput)(req.body);
            const companyId = InventoryController.getCompanyId(req);
            const useCase = new OpeningStockDocumentUseCases_1.UpdateOpeningStockDocumentUseCase(bindRepositories_1.diContainer.openingStockDocumentRepository, bindRepositories_1.diContainer.itemRepository, bindRepositories_1.diContainer.warehouseRepository, bindRepositories_1.diContainer.companyRepository, bindRepositories_1.diContainer.companyModuleRepository, bindRepositories_1.diContainer.accountRepository);
            const document = await useCase.execute({
                companyId,
                documentId: req.params.id,
                warehouseId: req.body.warehouseId,
                date: req.body.date,
                notes: req.body.notes,
                createAccountingEffect: req.body.createAccountingEffect,
                openingBalanceAccountId: req.body.openingBalanceAccountId,
                lines: req.body.lines || [],
            });
            res.json({
                success: true,
                data: InventoryDTOs_1.InventoryDTOMapper.toOpeningStockDocumentDTO(document),
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async deleteOpeningStockDocument(req, res, next) {
        try {
            const companyId = InventoryController.getCompanyId(req);
            const useCase = new OpeningStockDocumentUseCases_1.DeleteOpeningStockDocumentUseCase(bindRepositories_1.diContainer.openingStockDocumentRepository);
            await useCase.execute(companyId, req.params.id);
            res.json({
                success: true,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async postOpeningStockDocument(req, res, next) {
        try {
            const companyId = InventoryController.getCompanyId(req);
            const userId = InventoryController.getUserId(req);
            const movementUseCase = InventoryController.buildMovementUseCase();
            const accountingPostingService = InventoryController.buildAccountingPostingService();
            const useCase = new OpeningStockDocumentUseCases_1.PostOpeningStockDocumentUseCase(bindRepositories_1.diContainer.openingStockDocumentRepository, bindRepositories_1.diContainer.itemRepository, bindRepositories_1.diContainer.itemCategoryRepository, bindRepositories_1.diContainer.warehouseRepository, bindRepositories_1.diContainer.inventorySettingsRepository, bindRepositories_1.diContainer.companyRepository, bindRepositories_1.diContainer.companyModuleRepository, bindRepositories_1.diContainer.accountRepository, movementUseCase, accountingPostingService, bindRepositories_1.diContainer.transactionManager);
            const document = await useCase.execute(companyId, req.params.id, userId);
            res.json({
                success: true,
                data: InventoryDTOs_1.InventoryDTOMapper.toOpeningStockDocumentDTO(document),
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async processReturn(req, res, next) {
        try {
            (0, inventory_validators_1.validateProcessReturnInput)(req.body);
            const companyId = InventoryController.getCompanyId(req);
            const userId = InventoryController.getUserId(req);
            const movementUseCase = InventoryController.buildMovementUseCase();
            const useCase = new ReturnUseCases_1.ProcessReturnUseCase(bindRepositories_1.diContainer.stockMovementRepository, bindRepositories_1.diContainer.itemRepository, bindRepositories_1.diContainer.stockLevelRepository, movementUseCase);
            const movement = await useCase.execute({
                companyId,
                itemId: req.body.itemId,
                warehouseId: req.body.warehouseId,
                qty: req.body.qty,
                date: req.body.date,
                returnType: req.body.returnType,
                originalMovementId: req.body.originalMovementId,
                moveCurrency: req.body.moveCurrency,
                fxRateMovToBase: req.body.fxRateMovToBase,
                fxRateCCYToBase: req.body.fxRateCCYToBase,
                currentUser: userId,
                notes: req.body.notes,
            });
            res.status(201).json({
                success: true,
                data: InventoryDTOs_1.InventoryDTOMapper.toStockMovementDTO(movement),
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async createAdjustment(req, res, next) {
        try {
            (0, inventory_validators_1.validateCreateStockAdjustmentInput)(req.body);
            const companyId = InventoryController.getCompanyId(req);
            const userId = InventoryController.getUserId(req);
            const useCase = new StockAdjustmentUseCases_1.CreateStockAdjustmentUseCase(bindRepositories_1.diContainer.stockAdjustmentRepository);
            const adjustment = await useCase.execute(Object.assign(Object.assign({}, (req.body || {})), { companyId, createdBy: userId }));
            res.status(201).json({
                success: true,
                data: InventoryDTOs_1.InventoryDTOMapper.toStockAdjustmentDTO(adjustment),
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async listAdjustments(req, res, next) {
        try {
            const companyId = InventoryController.getCompanyId(req);
            const status = req.query.status;
            const adjustments = status
                ? await bindRepositories_1.diContainer.stockAdjustmentRepository.getByStatus(companyId, status)
                : await bindRepositories_1.diContainer.stockAdjustmentRepository.getCompanyAdjustments(companyId);
            res.json({
                success: true,
                data: adjustments.map(InventoryDTOs_1.InventoryDTOMapper.toStockAdjustmentDTO),
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async postAdjustment(req, res, next) {
        try {
            const companyId = InventoryController.getCompanyId(req);
            const userId = InventoryController.getUserId(req);
            const movementUseCase = InventoryController.buildMovementUseCase();
            const accountingPostingService = InventoryController.buildAccountingPostingService();
            const useCase = new StockAdjustmentUseCases_1.PostStockAdjustmentUseCase(bindRepositories_1.diContainer.stockAdjustmentRepository, bindRepositories_1.diContainer.itemRepository, movementUseCase, bindRepositories_1.diContainer.transactionManager, accountingPostingService);
            const adjustment = await useCase.execute(companyId, req.params.id, userId);
            res.json({
                success: true,
                data: InventoryDTOs_1.InventoryDTOMapper.toStockAdjustmentDTO(adjustment),
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async createTransfer(req, res, next) {
        try {
            (0, inventory_validators_1.validateCreateStockTransferInput)(req.body);
            const companyId = InventoryController.getCompanyId(req);
            const userId = InventoryController.getUserId(req);
            const useCase = new StockTransferUseCases_1.CreateStockTransferUseCase(bindRepositories_1.diContainer.stockTransferRepository, bindRepositories_1.diContainer.warehouseRepository, bindRepositories_1.diContainer.itemRepository, bindRepositories_1.diContainer.stockLevelRepository);
            const transfer = await useCase.execute({
                companyId,
                sourceWarehouseId: req.body.sourceWarehouseId,
                destinationWarehouseId: req.body.destinationWarehouseId,
                date: req.body.date,
                notes: req.body.notes,
                lines: req.body.lines || [],
                createdBy: userId,
            });
            res.status(201).json({
                success: true,
                data: InventoryDTOs_1.InventoryDTOMapper.toStockTransferDTO(transfer),
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async completeTransfer(req, res, next) {
        try {
            const companyId = InventoryController.getCompanyId(req);
            const userId = InventoryController.getUserId(req);
            const movementUseCase = InventoryController.buildMovementUseCase();
            const useCase = new StockTransferUseCases_1.CompleteStockTransferUseCase(bindRepositories_1.diContainer.stockTransferRepository, movementUseCase, bindRepositories_1.diContainer.transactionManager);
            const transfer = await useCase.execute(companyId, req.params.id, userId);
            res.json({
                success: true,
                data: InventoryDTOs_1.InventoryDTOMapper.toStockTransferDTO(transfer),
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async listTransfers(req, res, next) {
        try {
            const companyId = InventoryController.getCompanyId(req);
            const status = req.query.status;
            const useCase = new StockTransferUseCases_1.ListStockTransfersUseCase(bindRepositories_1.diContainer.stockTransferRepository);
            const transfers = await useCase.execute(companyId, {
                status,
                limit: req.query.limit ? Number(req.query.limit) : undefined,
                offset: req.query.offset ? Number(req.query.offset) : undefined,
            });
            res.json({
                success: true,
                data: transfers.map(InventoryDTOs_1.InventoryDTOMapper.toStockTransferDTO),
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async createSnapshot(req, res, next) {
        try {
            (0, inventory_validators_1.validateCreateSnapshotInput)(req.body);
            const companyId = InventoryController.getCompanyId(req);
            const useCase = new PeriodSnapshotUseCases_1.CreatePeriodSnapshotUseCase(bindRepositories_1.diContainer.stockLevelRepository, bindRepositories_1.diContainer.inventoryPeriodSnapshotRepository);
            const snapshot = await useCase.execute({
                companyId,
                periodKey: req.body.periodKey,
            });
            res.status(201).json({
                success: true,
                data: InventoryDTOs_1.InventoryDTOMapper.toInventoryPeriodSnapshotDTO(snapshot),
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async getAsOfValuation(req, res, next) {
        try {
            const companyId = InventoryController.getCompanyId(req);
            const asOfDate = String(req.query.date || '');
            if (!/^\d{4}-\d{2}-\d{2}$/.test(asOfDate)) {
                throw new Error('date query parameter must be in YYYY-MM-DD format');
            }
            const useCase = new PeriodSnapshotUseCases_1.GetAsOfValuationUseCase(bindRepositories_1.diContainer.inventoryPeriodSnapshotRepository, bindRepositories_1.diContainer.stockMovementRepository);
            const valuation = await useCase.execute({
                companyId,
                asOfDate,
            });
            res.json({
                success: true,
                data: valuation,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async getValuation(req, res, next) {
        try {
            const companyId = InventoryController.getCompanyId(req);
            const useCase = new StockLevelUseCases_1.GetInventoryValuationUseCase(bindRepositories_1.diContainer.stockLevelRepository);
            const valuation = await useCase.execute(companyId);
            res.json({
                success: true,
                data: valuation,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async getCurrentCost(req, res, next) {
        try {
            const companyId = InventoryController.getCompanyId(req);
            const itemId = String(req.query.itemId || '');
            const warehouseId = String(req.query.warehouseId || '');
            if (!itemId || !warehouseId) {
                throw new Error('itemId and warehouseId are required');
            }
            const useCase = new CostQueryUseCases_1.GetCurrentCostUseCase(bindRepositories_1.diContainer.itemRepository, bindRepositories_1.diContainer.stockLevelRepository);
            const result = await useCase.execute(companyId, itemId, warehouseId);
            res.json({
                success: true,
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async getDashboard(req, res, next) {
        try {
            const companyId = InventoryController.getCompanyId(req);
            const useCase = new DashboardUseCases_1.GetInventoryDashboardUseCase(bindRepositories_1.diContainer.stockLevelRepository, bindRepositories_1.diContainer.itemRepository, bindRepositories_1.diContainer.stockMovementRepository);
            const result = await useCase.execute(companyId);
            res.json({
                success: true,
                data: Object.assign(Object.assign({}, result), { recentMovements: result.recentMovements.map(InventoryDTOs_1.InventoryDTOMapper.toStockMovementDTO) }),
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async getLowStockAlerts(req, res, next) {
        try {
            const companyId = InventoryController.getCompanyId(req);
            const useCase = new DashboardUseCases_1.GetLowStockAlertsUseCase(bindRepositories_1.diContainer.stockLevelRepository, bindRepositories_1.diContainer.itemRepository);
            const alerts = await useCase.execute(companyId);
            res.json({
                success: true,
                data: alerts,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async getUnsettledCosts(req, res, next) {
        try {
            const companyId = InventoryController.getCompanyId(req);
            const useCase = new DashboardUseCases_1.GetUnsettledCostReportUseCase(bindRepositories_1.diContainer.stockMovementRepository);
            const report = await useCase.execute(companyId, {
                itemId: req.query.itemId,
                limit: req.query.limit ? Number(req.query.limit) : undefined,
                offset: req.query.offset ? Number(req.query.offset) : undefined,
            });
            res.json({
                success: true,
                data: {
                    total: report.total,
                    rows: report.rows.map((row) => (Object.assign(Object.assign({}, row), { createdAt: row.createdAt.toISOString() }))),
                },
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async reconcile(req, res, next) {
        try {
            const companyId = InventoryController.getCompanyId(req);
            const useCase = new ReconcileStockUseCase_1.ReconcileStockUseCase(bindRepositories_1.diContainer.stockLevelRepository, bindRepositories_1.diContainer.stockMovementRepository);
            const result = await useCase.execute(companyId);
            res.json({
                success: true,
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.InventoryController = InventoryController;
//# sourceMappingURL=InventoryController.js.map