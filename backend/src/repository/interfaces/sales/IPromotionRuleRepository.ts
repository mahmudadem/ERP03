import { PromotionRule, PromotionType, PromotionStatus } from '../../../domain/sales/entities/PromotionRule';

export interface PromotionRuleListOptions {
  status?: PromotionStatus;
  type?: PromotionType;
  /** When true, inactive rules are included even if status is not set. Default: false. */
  includeInactive?: boolean;
  limit?: number;
  offset?: number;
}

export interface IPromotionRuleRepository {
  create(rule: PromotionRule, transaction?: unknown): Promise<void>;
  update(rule: PromotionRule, transaction?: unknown): Promise<void>;
  getById(companyId: string, id: string): Promise<PromotionRule | null>;
  list(companyId: string, opts?: PromotionRuleListOptions): Promise<PromotionRule[]>;
  delete(companyId: string, id: string): Promise<void>;
}
