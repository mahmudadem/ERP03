import client from './client';

export interface InventoryItemDTO {
  id: string;
  companyId: string;
  code: string;
  name: string;
  description?: string;
  barcode?: string;
  type: 'PRODUCT' | 'SERVICE' | 'RAW_MATERIAL';
  categoryId?: string;
  brand?: string;
  tags?: string[];
  baseUom: string;
  purchaseUom?: string;
  salesUom?: string;
  costCurrency: string;
  costingMethod: 'MOVING_AVG';
  trackInventory: boolean;
  revenueAccountId?: string;
  cogsAccountId?: string;
  inventoryAssetAccountId?: string;
  minStockLevel?: number;
  maxStockLevel?: number;
  reorderPoint?: number;
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
  fromUom: string;
  toUom: string;
  factor: number;
  active: boolean;
}

export interface InventorySettingsDTO {
  companyId: string;
  defaultCostingMethod: 'MOVING_AVG';
  defaultCostCurrency: string;
  allowNegativeStock: boolean;
  defaultWarehouseId?: string;
  autoGenerateItemCode: boolean;
  itemCodePrefix?: string;
  itemCodeNextSeq: number;
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
  transferPairId?: string;
  reversesMovementId?: string;
  unitCostBase: number;
  totalCostBase: number;
  unitCostCCY: number;
  totalCostCCY: number;
  costSettled: boolean;
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

export interface StockTransferDTO {
  id: string;
  companyId: string;
  sourceWarehouseId: string;
  destinationWarehouseId: string;
  date: string;
  notes?: string;
  status: 'DRAFT' | 'IN_TRANSIT' | 'COMPLETED';
  transferPairId: string;
  createdBy: string;
  createdAt: string;
  completedAt?: string;
  lines: Array<{
    itemId: string;
    qty: number;
    unitCostBaseAtTransfer: number;
    unitCostCCYAtTransfer: number;
  }>;
}

export interface InventoryValuationDTO {
  totalValueBase: number;
  totalItems: number;
  levels: Array<{
    itemId: string;
    warehouseId: string;
    qtyOnHand: number;
    avgCostBase: number;
    valueBase: number;
  }>;
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
  snapshotPeriodKey?: string;
  totalValueBase: number;
  totalItems: number;
  items: Array<{
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
    defaultWarehouseName?: string;
    defaultWarehouseCode?: string;
    defaultCostCurrency?: string;
    allowNegativeStock?: boolean;
    autoGenerateItemCode?: boolean;
    itemCodePrefix?: string;
    itemCodeNextSeq?: number;
  }) =>
    client.post('/tenant/inventory/initialize', payload),

  getSettings: (): Promise<InventorySettingsDTO | null> =>
    client.get('/tenant/inventory/settings'),

  updateSettings: (payload: Partial<InventorySettingsDTO>): Promise<InventorySettingsDTO> =>
    client.put('/tenant/inventory/settings', payload),

  createItem: (payload: Partial<InventoryItemDTO>): Promise<InventoryItemDTO> =>
    client.post('/tenant/inventory/items', payload),

  listItems: (filters?: { type?: string; categoryId?: string; active?: boolean; limit?: number; offset?: number }): Promise<InventoryItemDTO[]> =>
    client.get('/tenant/inventory/items', { params: filters }),

  getItem: (id: string): Promise<InventoryItemDTO | null> =>
    client.get(`/tenant/inventory/items/${id}`),

  updateItem: (id: string, payload: Partial<InventoryItemDTO>): Promise<InventoryItemDTO> =>
    client.put(`/tenant/inventory/items/${id}`, payload),

  deleteItem: (id: string): Promise<{ success: boolean }> =>
    client.delete(`/tenant/inventory/items/${id}`),

  searchItems: (q: string, limit?: number, offset?: number): Promise<InventoryItemDTO[]> =>
    client.get('/tenant/inventory/items/search', { params: { q, limit, offset } }),

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

  updateWarehouse: (id: string, payload: Partial<InventoryWarehouseDTO>): Promise<InventoryWarehouseDTO> =>
    client.put(`/tenant/inventory/warehouses/${id}`, payload),

  createUomConversion: (payload: Partial<UomConversionDTO>): Promise<UomConversionDTO> =>
    client.post('/tenant/inventory/uom-conversions', payload),

  listUomConversions: (itemId: string): Promise<UomConversionDTO[]> =>
    client.get(`/tenant/inventory/uom-conversions/${itemId}`),

  getStockLevels: (filters?: { itemId?: string; warehouseId?: string; limit?: number; offset?: number }): Promise<StockLevelDTO[]> =>
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

  createTransfer: (payload: {
    sourceWarehouseId: string;
    destinationWarehouseId: string;
    date: string;
    notes?: string;
    lines: Array<{ itemId: string; qty: number }>;
  }): Promise<StockTransferDTO> => client.post('/tenant/inventory/transfers', payload),

  completeTransfer: (id: string): Promise<StockTransferDTO> =>
    client.post(`/tenant/inventory/transfers/${id}/complete`, {}),

  listTransfers: (status?: 'DRAFT' | 'IN_TRANSIT' | 'COMPLETED'): Promise<StockTransferDTO[]> =>
    client.get('/tenant/inventory/transfers', { params: { status } }),

  createSnapshot: (periodKey: string): Promise<InventoryPeriodSnapshotDTO> =>
    client.post('/tenant/inventory/snapshots', { periodKey }),

  getAsOfValuation: (date: string): Promise<AsOfValuationDTO> =>
    client.get('/tenant/inventory/valuation/as-of', { params: { date } }),

  getDashboard: (): Promise<InventoryDashboardDTO> =>
    client.get('/tenant/inventory/dashboard'),

  getLowStockAlerts: (): Promise<LowStockAlertDTO[]> =>
    client.get('/tenant/inventory/alerts/low-stock'),

  getUnsettledCosts: (filters?: { itemId?: string; limit?: number; offset?: number }): Promise<UnsettledCostReportDTO> =>
    client.get('/tenant/inventory/reports/unsettled-costs', { params: filters }),

  getValuation: (): Promise<InventoryValuationDTO> =>
    client.get('/tenant/inventory/valuation'),

  reconcile: (): Promise<ReconcileResultDTO> =>
    client.post('/tenant/inventory/reconcile', {}),
};
