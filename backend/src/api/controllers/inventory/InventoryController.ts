
/**
 * InventoryController.ts
 */
import { Request, Response, NextFunction } from 'express';
import {
  CreateItemUseCase,
  DeleteItemUseCase,
  GetItemUseCase,
  ListItemsUseCase,
  UpdateItemUseCase,
} from '../../../application/inventory/use-cases/ItemUseCases';
import {
  CreateWarehouseUseCase,
  ListWarehousesUseCase,
  UpdateWarehouseUseCase,
} from '../../../application/inventory/use-cases/WarehouseUseCases';
import { ManageCategoriesUseCase } from '../../../application/inventory/use-cases/CategoryUseCases';
import { ManageUomConversionsUseCase } from '../../../application/inventory/use-cases/UomConversionUseCases';
import {
  CreateStockAdjustmentUseCase,
  PostStockAdjustmentUseCase,
} from '../../../application/inventory/use-cases/StockAdjustmentUseCases';
import { GetInventoryValuationUseCase, GetStockLevelsUseCase } from '../../../application/inventory/use-cases/StockLevelUseCases';
import { GetMovementHistoryUseCase } from '../../../application/inventory/use-cases/MovementHistoryUseCases';
import { InitializeInventoryUseCase } from '../../../application/inventory/use-cases/InitializeInventoryUseCase';
import { ReconcileStockUseCase } from '../../../application/inventory/use-cases/ReconcileStockUseCase';
import { RecordStockMovementUseCase } from '../../../application/inventory/use-cases/RecordStockMovementUseCase';
import {
  CompleteStockTransferUseCase,
  CreateStockTransferUseCase,
  ListStockTransfersUseCase,
} from '../../../application/inventory/use-cases/StockTransferUseCases';
import { ProcessReturnUseCase } from '../../../application/inventory/use-cases/ReturnUseCases';
import {
  CreatePeriodSnapshotUseCase,
  GetAsOfValuationUseCase,
} from '../../../application/inventory/use-cases/PeriodSnapshotUseCases';
import {
  GetInventoryDashboardUseCase,
  GetLowStockAlertsUseCase,
  GetUnsettledCostReportUseCase,
} from '../../../application/inventory/use-cases/DashboardUseCases';
import {
  ReleaseReservedStockUseCase,
  ReserveStockUseCase,
} from '../../../application/inventory/use-cases/StockReservationUseCases';
import { GetCurrentCostUseCase } from '../../../application/inventory/use-cases/CostQueryUseCases';
import { GetMovementForReferenceUseCase } from '../../../application/inventory/use-cases/ReferenceQueryUseCases';
import { diContainer } from '../../../infrastructure/di/bindRepositories';
import { InventoryDTOMapper } from '../../dtos/InventoryDTOs';
import { PermissionChecker } from '../../../application/rbac/PermissionChecker';
import { GetCurrentUserPermissionsForCompanyUseCase } from '../../../application/rbac/use-cases/GetCurrentUserPermissionsForCompanyUseCase';
import {
  validateCreateCategoryInput,
  validateCreateItemInput,
  validateCreateSnapshotInput,
  validateCreateStockAdjustmentInput,
  validateCreateStockReservationInput,
  validateCreateStockTransferInput,
  validateCreateUomConversionInput,
  validateCreateWarehouseInput,
  validateInitializeInventoryInput,
  validateMovementByReferenceQuery,
  validateOpeningMovementInput,
  validateProcessReturnInput,
  validateUpdateCategoryInput,
  validateUpdateItemInput,
  validateUpdateSettingsInput,
  validateUpdateWarehouseInput,
} from '../../validators/inventory.validators';
import { InventorySettings } from '../../../domain/inventory/entities/InventorySettings';

const accountingPermissionChecker = new PermissionChecker(
  new GetCurrentUserPermissionsForCompanyUseCase(
    diContainer.userRepository,
    diContainer.rbacCompanyUserRepository,
    diContainer.companyRoleRepository
  )
);

export class InventoryController {
  private static getCompanyId(req: Request): string {
    const companyId = (req as any).user?.companyId;
    if (!companyId) {
      throw new Error('Company context not found');
    }

    return companyId;
  }

  private static getUserId(req: Request): string {
    return (req as any).user?.uid || 'SYSTEM';
  }

  private static buildMovementUseCase(): RecordStockMovementUseCase {
    return new RecordStockMovementUseCase({
      itemRepository: diContainer.itemRepository,
      warehouseRepository: diContainer.warehouseRepository,
      stockMovementRepository: diContainer.stockMovementRepository,
      stockLevelRepository: diContainer.stockLevelRepository,
      companyRepository: diContainer.companyRepository,
      transactionManager: diContainer.transactionManager,
    });
  }

  static async initialize(req: Request, res: Response, next: NextFunction) {
    try {
      validateInitializeInventoryInput((req as any).body);
      const companyId = InventoryController.getCompanyId(req);
      const userId = InventoryController.getUserId(req);

      const useCase = new InitializeInventoryUseCase(
        diContainer.companyRepository,
        diContainer.inventorySettingsRepository,
        diContainer.warehouseRepository,
        diContainer.companyModuleRepository
      );

      const result = await useCase.execute({
        companyId,
        userId,
        defaultWarehouseName: (req as any).body.defaultWarehouseName,
        defaultWarehouseCode: (req as any).body.defaultWarehouseCode,
        defaultCostCurrency: (req as any).body.defaultCostCurrency,
        allowNegativeStock: (req as any).body.allowNegativeStock,
        autoGenerateItemCode: (req as any).body.autoGenerateItemCode,
        itemCodePrefix: (req as any).body.itemCodePrefix,
        itemCodeNextSeq: (req as any).body.itemCodeNextSeq,
      });

      (res as any).status(200).json({
        success: true,
        data: {
          settings: InventoryDTOMapper.toSettingsDTO(result.settings),
          defaultWarehouse: result.defaultWarehouse ? InventoryDTOMapper.toWarehouseDTO(result.defaultWarehouse) : null,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async getSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = InventoryController.getCompanyId(req);
      const settings = await diContainer.inventorySettingsRepository.getSettings(companyId);
      (res as any).json({
        success: true,
        data: settings ? InventoryDTOMapper.toSettingsDTO(settings) : null,
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateSettings(req: Request, res: Response, next: NextFunction) {
    try {
      validateUpdateSettingsInput((req as any).body);
      const companyId = InventoryController.getCompanyId(req);

      const current = await diContainer.inventorySettingsRepository.getSettings(companyId);
      const company = await diContainer.companyRepository.findById(companyId);
      if (!company) throw new Error(`Company not found: ${companyId}`);

      const settings = new InventorySettings({
        companyId,
        defaultCostingMethod: 'MOVING_AVG',
        defaultCostCurrency: (req as any).body.defaultCostCurrency || current?.defaultCostCurrency || company.baseCurrency,
        allowNegativeStock: (req as any).body.allowNegativeStock ?? current?.allowNegativeStock ?? true,
        defaultWarehouseId: (req as any).body.defaultWarehouseId ?? current?.defaultWarehouseId,
        autoGenerateItemCode: (req as any).body.autoGenerateItemCode ?? current?.autoGenerateItemCode ?? false,
        itemCodePrefix: (req as any).body.itemCodePrefix ?? current?.itemCodePrefix,
        itemCodeNextSeq: (req as any).body.itemCodeNextSeq ?? current?.itemCodeNextSeq ?? 1,
      });

      await diContainer.inventorySettingsRepository.saveSettings(settings);

      (res as any).json({
        success: true,
        data: InventoryDTOMapper.toSettingsDTO(settings),
      });
    } catch (error) {
      next(error);
    }
  }

  static async createItem(req: Request, res: Response, next: NextFunction) {
    try {
      validateCreateItemInput((req as any).body);
      const companyId = InventoryController.getCompanyId(req);
      const userId = InventoryController.getUserId(req);

      const useCase = new CreateItemUseCase(diContainer.itemRepository, diContainer.itemCategoryRepository);
      const item = await useCase.execute({
        ...(req as any).body,
        companyId,
        createdBy: userId,
      });

      (res as any).status(201).json({
        success: true,
        data: InventoryDTOMapper.toItemDTO(item)
      });
    } catch (error) {
      next(error);
    }
  }

  static async listItems(req: Request, res: Response, next: NextFunction) {
      try {
          const companyId = InventoryController.getCompanyId(req);
          const useCase = new ListItemsUseCase(diContainer.itemRepository);
          const items = await useCase.execute(companyId, {
            type: (req as any).query.type,
            categoryId: (req as any).query.categoryId,
            active: (req as any).query.active === undefined
              ? undefined
              : String((req as any).query.active) === 'true',
            limit: (req as any).query.limit ? Number((req as any).query.limit) : undefined,
            offset: (req as any).query.offset ? Number((req as any).query.offset) : undefined,
          });
          
          (res as any).json({
            success: true,
            data: items.map(InventoryDTOMapper.toItemDTO)
          });
      } catch (error) {
          next(error);
      }
  }

  static async searchItems(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = InventoryController.getCompanyId(req);
      const query = String((req as any).query.q || '');
      const items = await diContainer.itemRepository.searchItems(companyId, query, {
        limit: (req as any).query.limit ? Number((req as any).query.limit) : 50,
        offset: (req as any).query.offset ? Number((req as any).query.offset) : 0,
      });

      (res as any).json({
        success: true,
        data: items.map(InventoryDTOMapper.toItemDTO),
      });
    } catch (error) {
      next(error);
    }
  }

  static async getItem(req: Request, res: Response, next: NextFunction) {
    try {
      const useCase = new GetItemUseCase(diContainer.itemRepository);
      const item = await useCase.execute((req as any).params.id);
      (res as any).json({
        success: true,
        data: item ? InventoryDTOMapper.toItemDTO(item) : null,
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateItem(req: Request, res: Response, next: NextFunction) {
    try {
      validateUpdateItemInput((req as any).body);
      const useCase = new UpdateItemUseCase(diContainer.itemRepository);
      const item = await useCase.execute((req as any).params.id, (req as any).body);
      (res as any).json({
        success: true,
        data: InventoryDTOMapper.toItemDTO(item),
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteItem(req: Request, res: Response, next: NextFunction) {
    try {
      const useCase = new DeleteItemUseCase(diContainer.itemRepository);
      await useCase.execute((req as any).params.id);
      (res as any).json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  static async createCategory(req: Request, res: Response, next: NextFunction) {
    try {
      validateCreateCategoryInput((req as any).body);
      const companyId = InventoryController.getCompanyId(req);
      const useCase = new ManageCategoriesUseCase(diContainer.itemCategoryRepository);
      const category = await useCase.create({
        companyId,
        ...(req as any).body,
      });

      (res as any).status(201).json({
        success: true,
        data: InventoryDTOMapper.toCategoryDTO(category),
      });
    } catch (error) {
      next(error);
    }
  }

  static async listCategories(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = InventoryController.getCompanyId(req);
      const useCase = new ManageCategoriesUseCase(diContainer.itemCategoryRepository);
      const categories = await useCase.list(companyId, (req as any).query.parentId);

      (res as any).json({
        success: true,
        data: categories.map(InventoryDTOMapper.toCategoryDTO),
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateCategory(req: Request, res: Response, next: NextFunction) {
    try {
      validateUpdateCategoryInput((req as any).body);
      const useCase = new ManageCategoriesUseCase(diContainer.itemCategoryRepository);
      const category = await useCase.update((req as any).params.id, (req as any).body);

      (res as any).json({
        success: true,
        data: InventoryDTOMapper.toCategoryDTO(category),
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const useCase = new ManageCategoriesUseCase(diContainer.itemCategoryRepository);
      await useCase.delete((req as any).params.id);
      (res as any).json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  static async createWarehouse(req: Request, res: Response, next: NextFunction) {
    try {
      validateCreateWarehouseInput((req as any).body);
      const companyId = InventoryController.getCompanyId(req);
      const useCase = new CreateWarehouseUseCase(diContainer.warehouseRepository);
      const warehouse = await useCase.execute({
        companyId,
        ...(req as any).body,
      });
      (res as any).status(201).json({
        success: true,
        data: InventoryDTOMapper.toWarehouseDTO(warehouse),
      });
    } catch (error) {
      next(error);
    }
  }

  static async listWarehouses(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = InventoryController.getCompanyId(req);
      const useCase = new ListWarehousesUseCase(diContainer.warehouseRepository);
      const warehouses = await useCase.execute(companyId, {
        active: (req as any).query.active === undefined
          ? undefined
          : String((req as any).query.active) === 'true',
        limit: (req as any).query.limit ? Number((req as any).query.limit) : undefined,
        offset: (req as any).query.offset ? Number((req as any).query.offset) : undefined,
      });

      (res as any).json({
        success: true,
        data: warehouses.map(InventoryDTOMapper.toWarehouseDTO),
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateWarehouse(req: Request, res: Response, next: NextFunction) {
    try {
      validateUpdateWarehouseInput((req as any).body);
      const useCase = new UpdateWarehouseUseCase(diContainer.warehouseRepository);
      const warehouse = await useCase.execute((req as any).params.id, (req as any).body);
      (res as any).json({
        success: true,
        data: InventoryDTOMapper.toWarehouseDTO(warehouse),
      });
    } catch (error) {
      next(error);
    }
  }

  static async createUomConversion(req: Request, res: Response, next: NextFunction) {
    try {
      validateCreateUomConversionInput((req as any).body);
      const companyId = InventoryController.getCompanyId(req);
      const useCase = new ManageUomConversionsUseCase(diContainer.uomConversionRepository);
      const conversion = await useCase.create({
        companyId,
        ...(req as any).body,
      });

      (res as any).status(201).json({
        success: true,
        data: InventoryDTOMapper.toUomConversionDTO(conversion),
      });
    } catch (error) {
      next(error);
    }
  }

  static async listUomConversions(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = InventoryController.getCompanyId(req);
      const itemId = (req as any).params.itemId;
      const useCase = new ManageUomConversionsUseCase(diContainer.uomConversionRepository);
      const conversions = await useCase.listForItem(companyId, itemId);

      (res as any).json({
        success: true,
        data: conversions.map(InventoryDTOMapper.toUomConversionDTO),
      });
    } catch (error) {
      next(error);
    }
  }

  static async getStockLevels(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = InventoryController.getCompanyId(req);
      const useCase = new GetStockLevelsUseCase(diContainer.stockLevelRepository);
      const levels = await useCase.execute(companyId, {
        itemId: (req as any).query.itemId,
        warehouseId: (req as any).query.warehouseId,
        limit: (req as any).query.limit ? Number((req as any).query.limit) : undefined,
        offset: (req as any).query.offset ? Number((req as any).query.offset) : undefined,
      });

      (res as any).json({
        success: true,
        data: levels.map(InventoryDTOMapper.toStockLevelDTO),
      });
    } catch (error) {
      next(error);
    }
  }

  static async getStockLevelsByItem(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = InventoryController.getCompanyId(req);
      const useCase = new GetStockLevelsUseCase(diContainer.stockLevelRepository);
      const levels = await useCase.execute(companyId, {
        itemId: (req as any).params.itemId,
      });

      (res as any).json({
        success: true,
        data: levels.map(InventoryDTOMapper.toStockLevelDTO),
      });
    } catch (error) {
      next(error);
    }
  }

  static async reserveStock(req: Request, res: Response, next: NextFunction) {
    try {
      validateCreateStockReservationInput((req as any).body);
      const companyId = InventoryController.getCompanyId(req);

      const useCase = new ReserveStockUseCase(
        diContainer.stockLevelRepository,
        diContainer.transactionManager
      );

      const level = await useCase.execute({
        companyId,
        itemId: (req as any).body.itemId,
        warehouseId: (req as any).body.warehouseId,
        qty: (req as any).body.qty,
      });

      (res as any).json({
        success: true,
        data: InventoryDTOMapper.toStockLevelDTO(level),
      });
    } catch (error) {
      next(error);
    }
  }

  static async releaseStock(req: Request, res: Response, next: NextFunction) {
    try {
      validateCreateStockReservationInput((req as any).body);
      const companyId = InventoryController.getCompanyId(req);

      const useCase = new ReleaseReservedStockUseCase(
        diContainer.stockLevelRepository,
        diContainer.transactionManager
      );

      const level = await useCase.execute({
        companyId,
        itemId: (req as any).body.itemId,
        warehouseId: (req as any).body.warehouseId,
        qty: (req as any).body.qty,
      });

      (res as any).json({
        success: true,
        data: InventoryDTOMapper.toStockLevelDTO(level),
      });
    } catch (error) {
      next(error);
    }
  }

  static async getMovements(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = InventoryController.getCompanyId(req);
      const useCase = new GetMovementHistoryUseCase(diContainer.stockMovementRepository);
      const movements = await useCase.execute(companyId, {
        itemId: (req as any).query.itemId,
        warehouseId: (req as any).query.warehouseId,
        referenceType: (req as any).query.referenceType,
        referenceId: (req as any).query.referenceId,
        from: (req as any).query.from,
        to: (req as any).query.to,
        limit: (req as any).query.limit ? Number((req as any).query.limit) : undefined,
        offset: (req as any).query.offset ? Number((req as any).query.offset) : undefined,
      });

      (res as any).json({
        success: true,
        data: movements.map(InventoryDTOMapper.toStockMovementDTO),
      });
    } catch (error) {
      next(error);
    }
  }

  static async getMovementByReference(req: Request, res: Response, next: NextFunction) {
    try {
      validateMovementByReferenceQuery((req as any).query);
      const companyId = InventoryController.getCompanyId(req);

      const useCase = new GetMovementForReferenceUseCase(diContainer.stockMovementRepository);
      const movement = await useCase.execute(
        companyId,
        (req as any).query.referenceType,
        (req as any).query.referenceId,
        (req as any).query.referenceLineId
      );

      (res as any).json({
        success: true,
        data: movement ? InventoryDTOMapper.toStockMovementDTO(movement) : null,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getMovementsByItem(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = InventoryController.getCompanyId(req);
      const useCase = new GetMovementHistoryUseCase(diContainer.stockMovementRepository);
      const movements = await useCase.getByItem(
        companyId,
        (req as any).params.itemId,
        (req as any).query.limit ? Number((req as any).query.limit) : undefined,
        (req as any).query.offset ? Number((req as any).query.offset) : undefined,
      );

      (res as any).json({
        success: true,
        data: movements.map(InventoryDTOMapper.toStockMovementDTO),
      });
    } catch (error) {
      next(error);
    }
  }

  static async recordOpeningStock(req: Request, res: Response, next: NextFunction) {
    try {
      validateOpeningMovementInput((req as any).body);
      const companyId = InventoryController.getCompanyId(req);
      const userId = InventoryController.getUserId(req);
      const useCase = InventoryController.buildMovementUseCase();

      const movement = await useCase.processIN({
        companyId,
        itemId: (req as any).body.itemId,
        warehouseId: (req as any).body.warehouseId,
        qty: (req as any).body.qty,
        date: (req as any).body.date,
        movementType: 'OPENING_STOCK',
        refs: {
          type: 'OPENING',
          docId: (req as any).body.referenceId,
          lineId: (req as any).body.referenceLineId,
        },
        currentUser: userId,
        unitCostInMoveCurrency: (req as any).body.unitCostInMoveCurrency,
        moveCurrency: (req as any).body.moveCurrency,
        fxRateMovToBase: (req as any).body.fxRateMovToBase,
        fxRateCCYToBase: (req as any).body.fxRateCCYToBase,
        notes: (req as any).body.notes,
        metadata: (req as any).body.metadata,
      });

      (res as any).status(201).json({
        success: true,
        data: InventoryDTOMapper.toStockMovementDTO(movement),
      });
    } catch (error) {
      next(error);
    }
  }

  static async processReturn(req: Request, res: Response, next: NextFunction) {
    try {
      validateProcessReturnInput((req as any).body);
      const companyId = InventoryController.getCompanyId(req);
      const userId = InventoryController.getUserId(req);
      const movementUseCase = InventoryController.buildMovementUseCase();

      const useCase = new ProcessReturnUseCase(
        diContainer.stockMovementRepository,
        diContainer.itemRepository,
        diContainer.stockLevelRepository,
        movementUseCase
      );

      const movement = await useCase.execute({
        companyId,
        itemId: (req as any).body.itemId,
        warehouseId: (req as any).body.warehouseId,
        qty: (req as any).body.qty,
        date: (req as any).body.date,
        returnType: (req as any).body.returnType,
        originalMovementId: (req as any).body.originalMovementId,
        moveCurrency: (req as any).body.moveCurrency,
        fxRateMovToBase: (req as any).body.fxRateMovToBase,
        fxRateCCYToBase: (req as any).body.fxRateCCYToBase,
        currentUser: userId,
        notes: (req as any).body.notes,
      });

      (res as any).status(201).json({
        success: true,
        data: InventoryDTOMapper.toStockMovementDTO(movement),
      });
    } catch (error) {
      next(error);
    }
  }

  static async createAdjustment(req: Request, res: Response, next: NextFunction) {
    try {
      validateCreateStockAdjustmentInput((req as any).body);
      const companyId = InventoryController.getCompanyId(req);
      const userId = InventoryController.getUserId(req);

      const useCase = new CreateStockAdjustmentUseCase(diContainer.stockAdjustmentRepository);
      const adjustment = await useCase.execute({
        ...((req as any).body || {}),
        companyId,
        createdBy: userId,
      });

      (res as any).status(201).json({
        success: true,
        data: InventoryDTOMapper.toStockAdjustmentDTO(adjustment),
      });
    } catch (error) {
      next(error);
    }
  }

  static async listAdjustments(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = InventoryController.getCompanyId(req);
      const status = (req as any).query.status as 'DRAFT' | 'POSTED' | undefined;

      const adjustments = status
        ? await diContainer.stockAdjustmentRepository.getByStatus(companyId, status)
        : await diContainer.stockAdjustmentRepository.getCompanyAdjustments(companyId);

      (res as any).json({
        success: true,
        data: adjustments.map(InventoryDTOMapper.toStockAdjustmentDTO),
      });
    } catch (error) {
      next(error);
    }
  }

  static async postAdjustment(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = InventoryController.getCompanyId(req);
      const userId = InventoryController.getUserId(req);
      const movementUseCase = InventoryController.buildMovementUseCase();

      const useCase = new PostStockAdjustmentUseCase(
        diContainer.stockAdjustmentRepository,
        diContainer.itemRepository,
        movementUseCase,
        {
          voucherRepository: diContainer.voucherRepository as any,
          accountRepository: diContainer.accountRepository as any,
          companyModuleSettingsRepository: diContainer.companyModuleSettingsRepository as any,
          permissionChecker: accountingPermissionChecker,
          transactionManager: diContainer.transactionManager as any,
          voucherTypeDefinitionRepository: diContainer.voucherTypeDefinitionRepository as any,
          accountingPolicyConfigProvider: diContainer.accountingPolicyConfigProvider as any,
          ledgerRepository: diContainer.ledgerRepository as any,
          policyRegistry: diContainer.policyRegistry as any,
          companyCurrencyRepository: diContainer.companyCurrencyRepository as any,
          voucherSequenceRepository: diContainer.voucherSequenceRepository as any,
        }
      );

      const adjustment = await useCase.execute(companyId, (req as any).params.id, userId);

      (res as any).json({
        success: true,
        data: InventoryDTOMapper.toStockAdjustmentDTO(adjustment),
      });
    } catch (error) {
      next(error);
    }
  }

  static async createTransfer(req: Request, res: Response, next: NextFunction) {
    try {
      validateCreateStockTransferInput((req as any).body);
      const companyId = InventoryController.getCompanyId(req);
      const userId = InventoryController.getUserId(req);

      const useCase = new CreateStockTransferUseCase(
        diContainer.stockTransferRepository,
        diContainer.warehouseRepository,
        diContainer.itemRepository,
        diContainer.stockLevelRepository
      );

      const transfer = await useCase.execute({
        companyId,
        sourceWarehouseId: (req as any).body.sourceWarehouseId,
        destinationWarehouseId: (req as any).body.destinationWarehouseId,
        date: (req as any).body.date,
        notes: (req as any).body.notes,
        lines: (req as any).body.lines || [],
        createdBy: userId,
      });

      (res as any).status(201).json({
        success: true,
        data: InventoryDTOMapper.toStockTransferDTO(transfer),
      });
    } catch (error) {
      next(error);
    }
  }

  static async completeTransfer(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = InventoryController.getCompanyId(req);
      const userId = InventoryController.getUserId(req);
      const movementUseCase = InventoryController.buildMovementUseCase();

      const useCase = new CompleteStockTransferUseCase(
        diContainer.stockTransferRepository,
        movementUseCase,
        diContainer.transactionManager
      );

      const transfer = await useCase.execute(companyId, (req as any).params.id, userId);

      (res as any).json({
        success: true,
        data: InventoryDTOMapper.toStockTransferDTO(transfer),
      });
    } catch (error) {
      next(error);
    }
  }

  static async listTransfers(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = InventoryController.getCompanyId(req);
      const status = (req as any).query.status as 'DRAFT' | 'IN_TRANSIT' | 'COMPLETED' | undefined;

      const useCase = new ListStockTransfersUseCase(diContainer.stockTransferRepository);
      const transfers = await useCase.execute(companyId, {
        status,
        limit: (req as any).query.limit ? Number((req as any).query.limit) : undefined,
        offset: (req as any).query.offset ? Number((req as any).query.offset) : undefined,
      });

      (res as any).json({
        success: true,
        data: transfers.map(InventoryDTOMapper.toStockTransferDTO),
      });
    } catch (error) {
      next(error);
    }
  }

  static async createSnapshot(req: Request, res: Response, next: NextFunction) {
    try {
      validateCreateSnapshotInput((req as any).body);
      const companyId = InventoryController.getCompanyId(req);

      const useCase = new CreatePeriodSnapshotUseCase(
        diContainer.stockLevelRepository,
        diContainer.inventoryPeriodSnapshotRepository
      );

      const snapshot = await useCase.execute({
        companyId,
        periodKey: (req as any).body.periodKey,
      });

      (res as any).status(201).json({
        success: true,
        data: InventoryDTOMapper.toInventoryPeriodSnapshotDTO(snapshot),
      });
    } catch (error) {
      next(error);
    }
  }

  static async getAsOfValuation(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = InventoryController.getCompanyId(req);
      const asOfDate = String((req as any).query.date || '');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(asOfDate)) {
        throw new Error('date query parameter must be in YYYY-MM-DD format');
      }

      const useCase = new GetAsOfValuationUseCase(
        diContainer.inventoryPeriodSnapshotRepository,
        diContainer.stockMovementRepository
      );

      const valuation = await useCase.execute({
        companyId,
        asOfDate,
      });

      (res as any).json({
        success: true,
        data: valuation,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getValuation(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = InventoryController.getCompanyId(req);
      const useCase = new GetInventoryValuationUseCase(diContainer.stockLevelRepository);
      const valuation = await useCase.execute(companyId);

      (res as any).json({
        success: true,
        data: valuation,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getCurrentCost(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = InventoryController.getCompanyId(req);
      const itemId = String((req as any).query.itemId || '');
      const warehouseId = String((req as any).query.warehouseId || '');

      if (!itemId || !warehouseId) {
        throw new Error('itemId and warehouseId are required');
      }

      const useCase = new GetCurrentCostUseCase(
        diContainer.itemRepository,
        diContainer.stockLevelRepository
      );

      const result = await useCase.execute(companyId, itemId, warehouseId);

      (res as any).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = InventoryController.getCompanyId(req);
      const useCase = new GetInventoryDashboardUseCase(
        diContainer.stockLevelRepository,
        diContainer.itemRepository,
        diContainer.stockMovementRepository
      );

      const result = await useCase.execute(companyId);

      (res as any).json({
        success: true,
        data: {
          ...result,
          recentMovements: result.recentMovements.map(InventoryDTOMapper.toStockMovementDTO),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async getLowStockAlerts(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = InventoryController.getCompanyId(req);
      const useCase = new GetLowStockAlertsUseCase(
        diContainer.stockLevelRepository,
        diContainer.itemRepository
      );

      const alerts = await useCase.execute(companyId);

      (res as any).json({
        success: true,
        data: alerts,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getUnsettledCosts(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = InventoryController.getCompanyId(req);
      const useCase = new GetUnsettledCostReportUseCase(diContainer.stockMovementRepository);

      const report = await useCase.execute(companyId, {
        itemId: (req as any).query.itemId,
        limit: (req as any).query.limit ? Number((req as any).query.limit) : undefined,
        offset: (req as any).query.offset ? Number((req as any).query.offset) : undefined,
      });

      (res as any).json({
        success: true,
        data: {
          total: report.total,
          rows: report.rows.map((row) => ({
            ...row,
            createdAt: row.createdAt.toISOString(),
          })),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async reconcile(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = InventoryController.getCompanyId(req);
      const useCase = new ReconcileStockUseCase(
        diContainer.stockLevelRepository,
        diContainer.stockMovementRepository
      );
      const result = await useCase.execute(companyId);

      (res as any).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

