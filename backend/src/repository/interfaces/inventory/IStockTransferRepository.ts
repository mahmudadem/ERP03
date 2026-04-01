import { StockTransfer, StockTransferStatus } from '../../../domain/inventory/entities/StockTransfer';

export interface StockTransferListOptions {
  limit?: number;
  offset?: number;
}

export interface IStockTransferRepository {
  createTransfer(transfer: StockTransfer): Promise<void>;
  updateTransfer(id: string, data: Partial<StockTransfer>): Promise<void>;
  getTransfer(id: string): Promise<StockTransfer | null>;
  getCompanyTransfers(companyId: string, opts?: StockTransferListOptions): Promise<StockTransfer[]>;
  getByStatus(companyId: string, status: StockTransferStatus, opts?: StockTransferListOptions): Promise<StockTransfer[]>;
  deleteTransfer(id: string): Promise<void>;
}
