import {
  InventoryRevaluation,
  InventoryRevaluationStatus,
} from '../../../domain/inventory/entities/InventoryRevaluation';

export interface InventoryRevaluationListOptions {
  limit?: number;
  offset?: number;
}

export interface IInventoryRevaluationRepository {
  createRevaluation(revaluation: InventoryRevaluation, transaction?: unknown): Promise<void>;
  updateRevaluation(
    companyId: string,
    id: string,
    data: Partial<InventoryRevaluation>,
    transaction?: unknown
  ): Promise<void>;
  getRevaluation(companyId: string, id: string): Promise<InventoryRevaluation | null>;
  getCompanyRevaluations(
    companyId: string,
    opts?: InventoryRevaluationListOptions
  ): Promise<InventoryRevaluation[]>;
  getByStatus(
    companyId: string,
    status: InventoryRevaluationStatus,
    opts?: InventoryRevaluationListOptions
  ): Promise<InventoryRevaluation[]>;
  deleteRevaluation(companyId: string, id: string): Promise<void>;
}
