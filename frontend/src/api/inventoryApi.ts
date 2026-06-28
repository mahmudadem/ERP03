import client from './client';

export type InventoryAccountingMode = 'PERIODIC' | 'INVOICE_DRIVEN' | 'PERPETUAL';
export type InventoryPricingPolicy = 'AVERAGE' | 'LAST_PURCHASE';

export interface InventoryCostPointDTO {
  base: number;
  ccy: number;
  currency: string;
  fxRateToBase: number;
  asOf: string;
  source?: {
    movementId?: string;
    refType?: string;
    refId?: string;
  };
}

export interface InventoryItemCostingStatsDTO {
  avgCost: InventoryCostPointDTO;
  lastPurchaseCost?: InventoryCostPointDTO;
  lastSalePrice?: InventoryCostPointDTO;
  extra?: Record<string, InventoryCostPointDTO>;
}

export interface InventoryItemDTO {
  id: string;
  companyId: string;
  code: string;
  name: string;
  description?: string;
  barcode?: string;
  barcodes?: string[];
  uomBarcodes?: Array<{ uomId?: string; uom: string; barcodes: string[] }>;
  type: 'PRODUCT' | 'SERVICE' | 'RAW_MATERIAL';
  categoryId?: string;
  brand?: string;
  tags?: string[];
  baseUomId?: string;
  baseUom: string;
  purchaseUomId?: string;
  purchaseUom?: string;
  salesUomId?: string;
  salesUom?: string;
  costCurrency: string;
  costingMethod: 'MOVING_AVG';
  trackInventory: boolean;
  revenueAccountId?: string;
  cogsAccountId?: string;
  inventoryAssetAccountId?: string;
  defaultPurchaseTaxCodeId?: string;
  defaultSalesTaxCodeId?: string;
  minStockLevel?: number;
  maxStockLevel?: number;
  reorderPoint?: number;
  salePrice?: number;
  purchasePrice?: number;
  costingStats?: InventoryItemCostingStatsDTO;
  imageUrl?: string;
  metadata?: Record<string, any>;
  active: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryCategoryDTO {
  id: string;
  companyId: string;
  name: string;
  parentId?: string;
  sortOrder: number;
  active: boolean;
  defaultRevenueAccountId?: string;
  defaultCogsAccountId?: string;
  defaultInventoryAssetAccountId?: string;
}

export interface InventoryWarehouseDTO {
  id: string;
  companyId: string;
  name: string;
  code: string;
  parentId?: string | null;
  address?: string;
  isDefault: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UomConversionDTO {
  id: string;
  companyId: string;
  itemId: string;
  fromUomId?: string;
  fromUom: string;
  toUomId?: string;
  toUom: string;
  factor: number;
  active: boolean;
}

export type UomConversionReferenceType =
  | 'GOODS_RECEIPT'
  | 'PURCHASE_INVOICE'
  | 'PURCHASE_RETURN'
  | 'DELIVERY_NOTE'
  | 'SALES_INVOICE'
  | 'SALES_RETURN';

export type UomConversionSourceModule = 'purchases' | 'sales';

export interface UomConversionImpactMovementDTO {
  movementId: string;
  date: string;
  direction: 'IN' | 'OUT';
  referenceType: UomConversionReferenceType;
  referenceId: string;
  referenceLineId?: string;
  module: UomConversionSourceModule;
  sourceQty?: number;
  sourceUomId?: string;
  sourceUom?: string;
  currentBaseQty: number;
  projectedBaseQty?: number;
  deltaBaseQty?: number;
  conversionMode: 'IDENTITY' | 'DIRECT' | 'REVERSE';
  appliedFactor: number;
}

export interface UomConversionImpactReferenceDTO {
  referenceType: UomConversionReferenceType;
  referenceId: string;
  module: UomConversionSourceModule;
  status: string;
  movementCount: number;
  lineCount: number;
  currentNetBaseQty: number;
  projectedNetBaseQty?: number;
  deltaNetBaseQty?: number;
  canAutoFix: boolean;
  autoFixReason?: string;
}

export interface UomConversionImpactReportDTO {
  conversion: {
    id: string;
    itemId: string;
    fromUomId?: string;
    fromUom: string;
    toUomId?: string;
    toUom: string;
    factor: number;
    active: boolean;
  };
  item: {
    id: string;
    code: string;
    name: string;
    baseUomId?: string;
    baseUom: string;
  };
  usageCount: number;
  purchaseUsageCount: number;
  salesUsageCount: number;
  used: boolean;
  editable: boolean;
  hasAutoFixBlockers: boolean;
  hasSalesUsage: boolean;
  impactedReferences: UomConversionImpactReferenceDTO[];
  impactedMovements: UomConversionImpactMovementDTO[];
}

export interface UomConversionCorrectionResultDTO {
  conversion: UomConversionDTO;
  impact?: UomConversionImpactReportDTO;
  impactBefore?: UomConversionImpactReportDTO;
  impactAfter?: UomConversionImpactReportDTO;
  noChanges?: boolean;
  autoFix?: {
    mode: 'NONE' | 'PURCHASES_REVERSE_REPOST' | 'STOCK_ONLY_DELTA';
    correctionRunId?: string;
    unposted?: {
      purchaseReturns: number;
      purchaseInvoices: number;
      goodsReceipts: number;
    };
    reposted?: {
      goodsReceipts: number;
      purchaseInvoices: number;
      purchaseReturns: number;
    };
    generatedAdjustments?: {
      in: number;
      out: number;
      netDeltaBaseQty: number;
    };
    notes?: string;
  };
}

export type UomDimension = 'COUNT' | 'WEIGHT' | 'VOLUME' | 'LENGTH' | 'AREA' | 'TIME' | 'OTHER';

export interface InventoryUomDTO {
  id: string;
  companyId: string;
  code: string;
  name: string;
  translations: Record<string, string>;
  dimension: UomDimension;
  decimalPlaces: number;
  active: boolean;
  isSystem: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface InventorySettingsDTO {
  companyId: string;
  accountingMode: InventoryAccountingMode;
  accountingModeLocked?: boolean;
  accountingModeLockReason?: string | null;
  inventoryAccountingMethod: 'PERIODIC' | 'PERPETUAL';
  defaultCostingMethod: string;
  costingBasis?: 'WAREHOUSE' | 'GLOBAL';
  defaultCostCurrency: string;
  defaultInventoryAssetAccountId?: string;
  defaultCOGSAccountId?: string;
  defaultInventoryGainAccountId?: string;
  defaultInventoryLossAccountId?: string;
  defaultInventoryTransferClearingAccountId?: string;
  defaultInventoryRevaluationAccountId?: string;
  defaultOpeningBalanceAccountId?: string;
  allowNegativeInventoryValue?: boolean;
  allowNegativeStock: boolean;
  allowDeferredCost: boolean;
  defaultWarehouseId?: string;
  autoGenerateItemCode: boolean;
  itemCodePrefix?: string;
  itemCodeNextSeq: number;
}

export interface OpeningStockDocumentDTO {
  id: string;
  companyId: string;
  warehouseId: string;
  date: string;
  notes?: string;
  status: 'DRAFT' | 'POSTED';
  createAccountingEffect: boolean;
  openingBalanceAccountId?: string;
  voucherId?: string;
  totalValueBase: number;
  createdBy: string;
  createdAt: string;
  postedAt?: string;
  lines: Array<{
    lineId: string;
    itemId: string;
    quantity: number;
    unitCostInMoveCurrency: number;
    moveCurrency: string;
    fxRateMovToBase: number;
    fxRateCCYToBase: number;
    unitCostBase: number;
    totalValueBase: number;
  }>;
}

export interface OpeningStockDocumentUpsertPayload {
  warehouseId: string;
  date: string;
  notes?: string;
  createAccountingEffect?: boolean;
  openingBalanceAccountId?: string;
  lines: Array<{
    itemId: string;
    quantity: number;
    unitCostInMoveCurrency: number;
    moveCurrency: string;
    fxRateMovToBase: number;
    fxRateCCYToBase: number;
  }>;
}

export interface StockLevelDTO {
  id: string;
  companyId: string;
  itemId: string;
  warehouseId: string;
  qtyOnHand: number;
  reservedQty: number;
  avgCostBase: number;
  avgCostCCY: number;
  lastCostBase: number;
  lastCostCCY: number;
  postingSeq: number;
  maxBusinessDate: string;
  totalMovements: number;
  lastMovementId: string;
  reportUnitCostBase?: number | null;
  reportUnitCostCCY?: number | null;
  reportValueBase?: number | null;
  reportValueCCY?: number | null;
  costBasis?: 'AVG' | 'LAST_KNOWN' | 'MISSING';
  unvaluedNegativeStock?: boolean;
  version: number;
  updatedAt: string;
}

export interface StockMovementDTO {
  id: string;
  companyId: string;
  date: string;
  postingSeq: number;
  createdAt: string;
  createdBy: string;
  postedAt: string;
  itemId: string;
  warehouseId: string;
  direction: 'IN' | 'OUT';
  movementType: string;
  qty: number;
  uom: string;
  referenceType: string;
  referenceId?: string;
  referenceLineId?: string;
  transferPairId?: string;
  reversesMovementId?: string;
  unitCostBase: number;
  totalCostBase: number;
  unitCostCCY: number;
  totalCostCCY: number;
  avgCostBaseAfter: number;
  avgCostCCYAfter: number;
  qtyBefore: number;
  qtyAfter: number;
  settledQty?: number;
  unsettledQty?: number;
  unsettledCostBasis?: 'AVG' | 'LAST_KNOWN' | 'MISSING';
  settlesNegativeQty?: number;
  newPositiveQty?: number;
  negativeQtyAtPosting: boolean;
  costSettled: boolean;
  isBackdated: boolean;
  costSource: string;
  notes?: string;
  metadata?: Record<string, any>;
}

export interface StockAdjustmentDTO {
  id: string;
  companyId: string;
  warehouseId: string;
  date: string;
  reason: string;
  notes?: string;
  status: 'DRAFT' | 'POSTED';
  voucherId?: string;
  adjustmentValueBase: number;
  createdBy: string;
  createdAt: string;
  postedAt?: string;
  lines: Array<{
    itemId: string;
    currentQty: number;
    newQty: number;
    adjustmentQty: number;
    unitCostBase: number;
    unitCostCCY: number;
  }>;
}

export interface InventoryRevaluationLineDTO {
  itemId: string;
  warehouseId?: string;
  qtyOnHand: number;
  currentAvgCostBase: number;
  currentAvgCostCCY: number;
  newAvgCostBase: number;
  newAvgCostCCY: number;
  valueDeltaBase: number;
  valueDeltaCCY: number;
  reason?: string;
}

export type InventoryRevaluationReason =
  | 'COST_CORRECTION'
  | 'BASIS_CHANGE'
  | 'MIGRATION_FIX'
  | 'WRITE_OFF'
  | 'OTHER';

export interface InventoryRevaluationDTO {
  id: string;
  companyId: string;
  date: string;
  reason: InventoryRevaluationReason;
  notes?: string;
  status: 'DRAFT' | 'POSTED';
  voucherId?: string;
  totalValueDeltaBase: number;
  totalValueDeltaCCY: number;
  createdBy: string;
  createdAt: string;
  postedAt?: string;
  lines: InventoryRevaluationLineDTO[];
}

export interface StockTransferDTO {
  id: string;
  companyId: string;
  sourceWarehouseId: string;
  destinationWarehouseId: string;
  date: string;
  notes?: string;
  mode: 'FLAT' | 'VALUED';
  status: 'DRAFT' | 'IN_TRANSIT' | 'COMPLETED';
  voucherId?: string;
  transferPairId: string;
  reversesTransferId?: string;
  reversedByTransferId?: string;
  createdBy: string;
  createdAt: string;
  completedAt?: string;
  lines: Array<{
    itemId: string;
    qty: number;
    unitCostBaseAtTransfer: number;
    unitCostCCYAtTransfer: number;
    addedCostBaseAtTransfer?: number;
    addedCostCCYAtTransfer?: number;
    revaluationUnitCostBaseAtTransfer?: number;
    revaluationUnitCostCCYAtTransfer?: number;
    notes?: string;
  }>;
}

export interface InventoryValuationDTO {
  asOfDate: string;
  pricingPolicy: InventoryPricingPolicy;
  totalValueBase: number;
  totalItems: number;
  items: Array<{
    itemId: string;
    warehouseId: string;
    qtyOnHand: number;
    avgCostBase: number;
    avgCostCCY: number;
    lastPurchaseCostBase: number;
    lastPurchaseCostCCY: number;
    pricingUnitCostBase: number;
    pricingUnitCostCCY: number;
    valueBase: number;
  }>;
}

export interface InventoryGLReconciliationLineDTO {
  accountId: string;
  accountCode: string;
  accountName: string;
  stockValueBase: number;
  glBalanceBase: number;
  differenceBase: number;
  matched: boolean;
}

export interface InventoryGLReconciliationDTO {
  asOfDate: string;
  isReconciled: boolean;
  totalStockValueBase: number;
  totalGLBalanceBase: number;
  totalDifferenceBase: number;
  unmappedStockValueBase: number;
  lines: InventoryGLReconciliationLineDTO[];
}

export interface InventoryPeriodSnapshotDTO {
  id: string;
  companyId: string;
  periodKey: string;
  periodEndDate: string;
  totalValueBase: number;
  totalItems: number;
  createdAt: string;
  snapshotData: Array<{
    itemId: string;
    warehouseId: string;
    qtyOnHand: number;
    avgCostBase: number;
    avgCostCCY: number;
    lastCostBase: number;
    lastCostCCY: number;
    valueBase: number;
  }>;
}

export interface AsOfValuationDTO {
  asOfDate: string;
  pricingPolicy: InventoryPricingPolicy;
  snapshotPeriodKey?: string;
  totalValueBase: number;
  totalItems: number;
  items: Array<{
    itemId: string;
    warehouseId: string;
    qtyOnHand: number;
    avgCostBase: number;
    avgCostCCY: number;
    lastPurchaseCostBase: number;
    lastPurchaseCostCCY: number;
    pricingUnitCostBase: number;
    pricingUnitCostCCY: number;
    valueBase: number;
  }>;
}

export interface InventoryDashboardDTO {
  totalInventoryValueBase: number;
  totalTrackedItems: number;
  totalStockLevels: number;
  lowStockAlerts: number;
  negativeStockCount: number;
  unsettledMovementsCount: number;
  recentMovements: StockMovementDTO[];
}

export interface LowStockAlertDTO {
  itemId: string;
  itemName: string;
  warehouseId: string;
  qtyOnHand: number;
  minStockLevel: number;
  deficit: number;
}

export interface UnsettledCostReportDTO {
  total: number;
  totals: {
    unsettledQty: number;
    costBase: number;
  };
  rows: Array<{
    id: string;
    date: string;
    itemId: string;
    warehouseId: string;
    movementType: string;
    qty: number;
    unsettledQty: number;
    unsettledCostBasis?: 'AVG' | 'LAST_KNOWN' | 'MISSING';
    unitCostBase: number;
    totalCostBase: number;
    referenceType: string;
    referenceId?: string;
    createdAt: string;
  }>;
}

export interface ReconcileResultDTO {
  matches: boolean;
  checkedLevels: number;
  mismatchCount: number;
  mismatches: Array<{
    key: string;
    itemId: string;
    warehouseId: string;
    levelQty: number;
    movementQty: number;
    difference: number;
  }>;
}

export const inventoryApi = {
  initialize: (payload: {
    accountingMode?: InventoryAccountingMode;
    inventoryAccountingMethod: 'PERIODIC' | 'PERPETUAL';
    defaultWarehouseName?: string;
    defaultWarehouseCode?: string;
    defaultInventoryAssetAccountId?: string;
    defaultCOGSAccountId?: string;
    defaultCostCurrency?: string;
    allowNegativeStock?: boolean;
    autoGenerateItemCode?: boolean;
    itemCodePrefix?: string;
    itemCodeNextSeq?: number;
    selectedVoucherTypes?: string[];
  }) =>
    client.post('/tenant/inventory/initialize', payload),

  getSettings: (): Promise<InventorySettingsDTO | null> =>
    client.get('/tenant/inventory/settings'),

  updateSettings: (payload: Partial<InventorySettingsDTO>): Promise<InventorySettingsDTO> =>
    client.put('/tenant/inventory/settings', payload),

  createItem: (payload: Partial<InventoryItemDTO>): Promise<InventoryItemDTO> =>
    client.post('/tenant/inventory/items', payload),

  listItems: (filters?: { type?: string; categoryId?: string; active?: boolean; trackInventory?: boolean; limit?: number; offset?: number }): Promise<InventoryItemDTO[]> =>
    client.get('/tenant/inventory/items', { params: filters }),

  getItem: (id: string): Promise<InventoryItemDTO | null> =>
    client.get(`/tenant/inventory/items/${id}`),

  updateItem: (id: string, payload: Partial<InventoryItemDTO>): Promise<InventoryItemDTO> =>
    client.put(`/tenant/inventory/items/${id}`, payload),

  deleteItem: (id: string): Promise<{ success: boolean }> =>
    client.delete(`/tenant/inventory/items/${id}`),

  searchItems: (
    q: string,
    limit?: number,
    offset?: number,
    filters?: { trackInventory?: boolean }
  ): Promise<InventoryItemDTO[]> =>
    client.get('/tenant/inventory/items/search', {
      params: { q, limit, offset, ...(filters || {}) },
    }),

  createCategory: (payload: Partial<InventoryCategoryDTO>): Promise<InventoryCategoryDTO> =>
    client.post('/tenant/inventory/categories', payload),

  listCategories: (parentId?: string): Promise<InventoryCategoryDTO[]> =>
    client.get('/tenant/inventory/categories', { params: { parentId } }),

  updateCategory: (id: string, payload: Partial<InventoryCategoryDTO>): Promise<InventoryCategoryDTO> =>
    client.put(`/tenant/inventory/categories/${id}`, payload),

  deleteCategory: (id: string): Promise<{ success: boolean }> =>
    client.delete(`/tenant/inventory/categories/${id}`),

  createWarehouse: (payload: Partial<InventoryWarehouseDTO>): Promise<InventoryWarehouseDTO> =>
    client.post('/tenant/inventory/warehouses', payload),

  listWarehouses: (filters?: { active?: boolean; limit?: number; offset?: number }): Promise<InventoryWarehouseDTO[]> =>
    client.get('/tenant/inventory/warehouses', { params: filters }),

  getWarehouse: (id: string): Promise<InventoryWarehouseDTO> =>
    client.get(`/tenant/inventory/warehouses/${id}`),

  updateWarehouse: (id: string, payload: Partial<InventoryWarehouseDTO>): Promise<InventoryWarehouseDTO> =>
    client.put(`/tenant/inventory/warehouses/${id}`, payload),

  createUomConversion: (payload: Partial<UomConversionDTO>): Promise<UomConversionDTO> =>
    client.post('/tenant/inventory/uom-conversions', payload),

  listUomConversions: (itemId: string): Promise<UomConversionDTO[]> =>
    client.get(`/tenant/inventory/uom-conversions/${itemId}`),

  updateUomConversion: (id: string, payload: Partial<UomConversionDTO>): Promise<UomConversionDTO> =>
    client.put(`/tenant/inventory/uom-conversions/${id}`, payload),

  deleteUomConversion: (id: string): Promise<{ success: boolean }> =>
    client.delete(`/tenant/inventory/uom-conversions/${id}`),

  getUomConversionImpact: (id: string, proposedFactor?: number): Promise<UomConversionImpactReportDTO> =>
    client.get(`/tenant/inventory/uom-conversions/${id}/impact`, {
      params: proposedFactor && proposedFactor > 0 ? { proposedFactor } : undefined,
    }),

  applyUomConversionCorrection: (id: string, newFactor: number, effectiveDate?: string): Promise<UomConversionCorrectionResultDTO> =>
    client.post(`/tenant/inventory/uom-conversions/${id}/apply-correction`, {
      newFactor,
      ...(effectiveDate ? { effectiveDate } : {}),
    }),

  createUom: (payload: Partial<InventoryUomDTO>): Promise<InventoryUomDTO> =>
    client.post('/tenant/inventory/uoms', payload),

  listUoms: (filters?: { active?: boolean; limit?: number; offset?: number }): Promise<InventoryUomDTO[]> =>
    client.get('/tenant/inventory/uoms', { params: filters }),

  getUom: (id: string): Promise<InventoryUomDTO | null> =>
    client.get(`/tenant/inventory/uoms/${id}`),

  updateUom: (id: string, payload: Partial<InventoryUomDTO>): Promise<InventoryUomDTO> =>
    client.put(`/tenant/inventory/uoms/${id}`, payload),

  getStockLevels: (filters?: { itemId?: string; warehouseId?: string; includeZero?: boolean; includeNegative?: boolean; limit?: number; offset?: number }): Promise<StockLevelDTO[]> =>
    client.get('/tenant/inventory/stock-levels', { params: filters }),

  getStockLevelsByItem: (itemId: string): Promise<StockLevelDTO[]> =>
    client.get(`/tenant/inventory/stock-levels/${itemId}`),

  getMovements: (filters?: {
    itemId?: string;
    warehouseId?: string;
    referenceType?: string;
    referenceId?: string;
    from?: string;
    to?: string;
    limit?: number;
    offset?: number;
  }): Promise<StockMovementDTO[]> =>
    client.get('/tenant/inventory/movements', { params: filters }),

  getMovementsByItem: (itemId: string, limit?: number, offset?: number): Promise<StockMovementDTO[]> =>
    client.get(`/tenant/inventory/movements/${itemId}`, { params: { limit, offset } }),

  recordOpeningStock: (payload: {
    itemId: string;
    warehouseId: string;
    date: string;
    qty: number;
    unitCostInMoveCurrency: number;
    moveCurrency: string;
    fxRateMovToBase: number;
    fxRateCCYToBase: number;
    notes?: string;
  }): Promise<StockMovementDTO> => client.post('/tenant/inventory/movements/opening', payload),

  createOpeningStockDocument: (payload: OpeningStockDocumentUpsertPayload): Promise<OpeningStockDocumentDTO> =>
    client.post('/tenant/inventory/opening-stock-documents', payload),

  listOpeningStockDocuments: (status?: 'DRAFT' | 'POSTED'): Promise<OpeningStockDocumentDTO[]> =>
    client.get('/tenant/inventory/opening-stock-documents', { params: { status } }),

  updateOpeningStockDocument: (id: string, payload: OpeningStockDocumentUpsertPayload): Promise<OpeningStockDocumentDTO> =>
    client.put(`/tenant/inventory/opening-stock-documents/${id}`, payload),

  deleteOpeningStockDocument: (id: string): Promise<{ success: boolean }> =>
    client.delete(`/tenant/inventory/opening-stock-documents/${id}`),

  postOpeningStockDocument: (id: string): Promise<OpeningStockDocumentDTO> =>
    client.post(`/tenant/inventory/opening-stock-documents/${id}/post`, {}),

  processReturn: (payload: {
    itemId: string;
    warehouseId: string;
    qty: number;
    date: string;
    returnType: 'SALES_RETURN' | 'PURCHASE_RETURN';
    originalMovementId: string;
    moveCurrency: string;
    fxRateMovToBase: number;
    fxRateCCYToBase: number;
    notes?: string;
  }): Promise<StockMovementDTO> => client.post('/tenant/inventory/movements/return', payload),

  createAdjustment: (payload: {
    warehouseId: string;
    date: string;
    reason: string;
    notes?: string;
    lines: Array<{
      itemId: string;
      currentQty: number;
      newQty: number;
      unitCostBase: number;
      unitCostCCY: number;
    }>;
  }): Promise<StockAdjustmentDTO> => client.post('/tenant/inventory/adjustments', payload),

  listAdjustments: (status?: 'DRAFT' | 'POSTED'): Promise<StockAdjustmentDTO[]> =>
    client.get('/tenant/inventory/adjustments', { params: { status } }),

  postAdjustment: (id: string): Promise<StockAdjustmentDTO> =>
    client.post(`/tenant/inventory/adjustments/${id}/post`, {}),

  createInventoryRevaluation: (payload: {
    date: string;
    reason: InventoryRevaluationReason;
    notes?: string;
    lines: Array<{
      itemId: string;
      warehouseId?: string;
      newAvgCostBase: number;
      newAvgCostCCY: number;
      reason?: string;
    }>;
  }): Promise<InventoryRevaluationDTO> => client.post('/tenant/inventory/revaluations', payload),

  listInventoryRevaluations: (status?: 'DRAFT' | 'POSTED'): Promise<InventoryRevaluationDTO[]> =>
    client.get('/tenant/inventory/revaluations', { params: { status } }),

  getInventoryRevaluation: (id: string): Promise<InventoryRevaluationDTO> =>
    client.get(`/tenant/inventory/revaluations/${id}`),

  postInventoryRevaluation: (id: string): Promise<InventoryRevaluationDTO> =>
    client.post(`/tenant/inventory/revaluations/${id}/post`, {}),

  createTransfer: (payload: {
    sourceWarehouseId: string;
    destinationWarehouseId: string;
    date: string;
    notes?: string;
    mode?: 'FLAT' | 'VALUED';
    lines: Array<{
      itemId: string;
      qty: number;
      unitCostBaseAtTransfer?: number;
      unitCostCCYAtTransfer?: number;
      addedCostBaseAtTransfer?: number;
      addedCostCCYAtTransfer?: number;
      revaluationUnitCostBaseAtTransfer?: number;
      revaluationUnitCostCCYAtTransfer?: number;
    }>;
  }): Promise<StockTransferDTO> => client.post('/tenant/inventory/transfers', payload),

  updateTransfer: (id: string, payload: {
    sourceWarehouseId: string;
    destinationWarehouseId: string;
    date: string;
    notes?: string;
    mode?: 'FLAT' | 'VALUED';
    lines: Array<{
      itemId: string;
      qty: number;
      unitCostBaseAtTransfer?: number;
      unitCostCCYAtTransfer?: number;
      addedCostBaseAtTransfer?: number;
      addedCostCCYAtTransfer?: number;
      revaluationUnitCostBaseAtTransfer?: number;
      revaluationUnitCostCCYAtTransfer?: number;
    }>;
  }): Promise<StockTransferDTO> => client.put(`/tenant/inventory/transfers/${id}`, payload),

  completeTransfer: (id: string): Promise<StockTransferDTO> =>
    client.post(`/tenant/inventory/transfers/${id}/complete`, {}),

  undoTransfer: (id: string, date?: string): Promise<StockTransferDTO> =>
    client.post(`/tenant/inventory/transfers/${id}/undo`, { date }),

  cancelTransfer: (id: string): Promise<void> =>
    client.delete(`/tenant/inventory/transfers/${id}`),

  listTransfers: (status?: 'DRAFT' | 'IN_TRANSIT' | 'COMPLETED'): Promise<StockTransferDTO[]> =>
    client.get('/tenant/inventory/transfers', { params: { status } }),

  createSnapshot: (periodKey: string): Promise<InventoryPeriodSnapshotDTO> =>
    client.post('/tenant/inventory/snapshots', { periodKey }),

  getAsOfValuation: (date: string, pricingPolicy: InventoryPricingPolicy = 'AVERAGE'): Promise<AsOfValuationDTO> =>
    client.get('/tenant/inventory/valuation/as-of', { params: { date, pricingPolicy } }),

  getDashboard: (): Promise<InventoryDashboardDTO> =>
    client.get('/tenant/inventory/dashboard'),

  getLowStockAlerts: (): Promise<LowStockAlertDTO[]> =>
    client.get('/tenant/inventory/alerts/low-stock'),

  getUnsettledCosts: (filters?: {
    itemId?: string;
    warehouseId?: string;
    costBasis?: 'AVG' | 'LAST_KNOWN' | 'MISSING';
    fromDate?: string;
    toDate?: string;
    limit?: number;
    offset?: number;
  }): Promise<UnsettledCostReportDTO> =>
    client.get('/tenant/inventory/reports/unsettled-costs', { params: filters }),

  getValuation: (pricingPolicy: InventoryPricingPolicy = 'AVERAGE'): Promise<InventoryValuationDTO> =>
    client.get('/tenant/inventory/valuation', { params: { pricingPolicy } }),

  reconcile: (): Promise<ReconcileResultDTO> =>
    client.post('/tenant/inventory/reconcile', {}),

  getGLReconciliation: (asOfDate?: string): Promise<InventoryGLReconciliationDTO> =>
    client.get('/tenant/inventory/reports/gl-reconciliation', { params: { asOfDate } }),

  configureFinancialIntegration: (payload: {
    accountingMethod: 'PERIODIC' | 'PERPETUAL';
    accountingMode: 'PERIODIC' | 'INVOICE_DRIVEN' | 'PERPETUAL';
    defaultInventoryAssetAccountId?: string;
    defaultCOGSAccountId?: string;
    accountingStartDate?: string;
  }) =>
    client.post('/tenant/inventory/financial-integration', payload),
};
