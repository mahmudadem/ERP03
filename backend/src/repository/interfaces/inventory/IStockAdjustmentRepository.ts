import { StockAdjustment, StockAdjustmentStatus } from '../../../domain/inventory/entities/StockAdjustment';

export interface StockAdjustmentListOptions {
  limit?: number;
  offset?: number;
}

export interface IStockAdjustmentRepository {
  createAdjustment(adjustment: StockAdjustment, transaction?: unknown): Promise<void>;
  updateAdjustment(companyId: string, id: string, data: Partial<StockAdjustment>, transaction?: unknown): Promise<void>;
  getAdjustment(id: string): Promise<StockAdjustment | null>;
  getCompanyAdjustments(companyId: string, opts?: StockAdjustmentListOptions): Promise<StockAdjustment[]>;
  getByStatus(companyId: string, status: StockAdjustmentStatus, opts?: StockAdjustmentListOptions): Promise<StockAdjustment[]>;
  deleteAdjustment(id: string): Promise<void>;
}
