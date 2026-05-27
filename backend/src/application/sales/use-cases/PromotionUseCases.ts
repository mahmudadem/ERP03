import { PromotionRule, PromotionRuleProps, PromotionStatus } from '../../../domain/sales/entities/PromotionRule';
import {
  IPromotionRuleRepository,
  PromotionRuleListOptions,
} from '../../../repository/interfaces/sales/IPromotionRuleRepository';
import {
  PromotionApplicationService,
  PromotionEvalLine,
  PromotionEvaluationResult,
} from '../services/PromotionApplicationService';

// ---------------------------------------------------------------------------
// Shared input helpers
// ---------------------------------------------------------------------------

/** Return today as YYYY-MM-DD */
function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// CreatePromotionRuleUseCase
// ---------------------------------------------------------------------------

export type CreatePromotionRuleInput = Omit<PromotionRuleProps, 'id' | 'createdAt' | 'updatedAt'>;

export class CreatePromotionRuleUseCase {
  constructor(private readonly promotionRuleRepo: IPromotionRuleRepository) {}

  async execute(input: CreatePromotionRuleInput): Promise<PromotionRule> {
    const rule = new PromotionRule({
      ...input,
      status: input.status ?? 'ACTIVE',
      priority: input.priority ?? 0,
    });
    await this.promotionRuleRepo.create(rule);
    return rule;
  }
}

// ---------------------------------------------------------------------------
// UpdatePromotionRuleUseCase
// ---------------------------------------------------------------------------

export interface UpdatePromotionRuleInput {
  companyId: string;
  id: string;
  name?: string;
  description?: string | null;
  status?: PromotionStatus;
  priority?: number;
  validFrom?: string | null;
  validTo?: string | null;
  // Note: type, scope, and config sub-objects are intentionally immutable after
  // creation (changing them would fundamentally alter the rule semantics). A
  // caller that needs to change those should delete and recreate the rule.
}

export class UpdatePromotionRuleUseCase {
  constructor(private readonly promotionRuleRepo: IPromotionRuleRepository) {}

  async execute(input: UpdatePromotionRuleInput): Promise<PromotionRule> {
    const existing = await this.promotionRuleRepo.getById(input.companyId, input.id);
    if (!existing) {
      throw new Error(`PromotionRule not found: ${input.id}`);
    }

    const updated = new PromotionRule({
      id: existing.id,
      companyId: existing.companyId,
      name: input.name ?? existing.name,
      description:
        input.description !== undefined
          ? (input.description ?? undefined)
          : existing.description,
      type: existing.type,
      status: input.status ?? existing.status,
      priority: input.priority !== undefined ? input.priority : existing.priority,
      validFrom:
        input.validFrom !== undefined
          ? (input.validFrom ?? undefined)
          : existing.validFrom,
      validTo:
        input.validTo !== undefined
          ? (input.validTo ?? undefined)
          : existing.validTo,
      scope: existing.scope,
      itemIds: existing.itemIds,
      categoryIds: existing.categoryIds,
      buyXGetY: existing.buyXGetY,
      thresholdDiscount: existing.thresholdDiscount,
      createdBy: existing.createdBy,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    });

    await this.promotionRuleRepo.update(updated);
    return updated;
  }
}

// ---------------------------------------------------------------------------
// DeletePromotionRuleUseCase
// ---------------------------------------------------------------------------

export class DeletePromotionRuleUseCase {
  constructor(private readonly promotionRuleRepo: IPromotionRuleRepository) {}

  async execute(companyId: string, id: string): Promise<void> {
    const existing = await this.promotionRuleRepo.getById(companyId, id);
    if (!existing) {
      throw new Error(`PromotionRule not found: ${id}`);
    }
    await this.promotionRuleRepo.delete(companyId, id);
  }
}

// ---------------------------------------------------------------------------
// GetPromotionRuleUseCase
// ---------------------------------------------------------------------------

export class GetPromotionRuleUseCase {
  constructor(private readonly promotionRuleRepo: IPromotionRuleRepository) {}

  async execute(companyId: string, id: string): Promise<PromotionRule | null> {
    return this.promotionRuleRepo.getById(companyId, id);
  }
}

// ---------------------------------------------------------------------------
// ListPromotionRulesUseCase
// ---------------------------------------------------------------------------

export class ListPromotionRulesUseCase {
  constructor(private readonly promotionRuleRepo: IPromotionRuleRepository) {}

  async execute(
    companyId: string,
    opts?: PromotionRuleListOptions
  ): Promise<PromotionRule[]> {
    return this.promotionRuleRepo.list(companyId, opts);
  }
}

// ---------------------------------------------------------------------------
// EvaluatePromotionsUseCase
// ---------------------------------------------------------------------------

export interface EvaluatePromotionsInput {
  companyId: string;
  lines: PromotionEvalLine[];
  /** YYYY-MM-DD — defaults to today */
  asOfDate?: string;
}

export class EvaluatePromotionsUseCase {
  private readonly service = new PromotionApplicationService();

  constructor(private readonly promotionRuleRepo: IPromotionRuleRepository) {}

  async execute(input: EvaluatePromotionsInput): Promise<PromotionEvaluationResult> {
    const asOfDate = input.asOfDate ?? todayISO();

    // Load all active rules for the company (repo defaults to ACTIVE-only)
    const rules = await this.promotionRuleRepo.list(input.companyId);

    return this.service.evaluate(input.lines, rules, asOfDate);
  }
}
