/**
 * DocumentValidator - Abstract Base Class
 * 
 * Implements the 3-layer validation architecture:
 * - Layer 1: Structural (developer-defined, always blocks)
 * - Layer 2: Business Rules (user-configured, 4 outcomes)
 * - Layer 3: System Warnings (never configurable, always warns)
 */

import { VoucherTypeDefinition } from '../../../designer-engine/types/VoucherTypeDefinition';
import {
  StructuralResult,
  BusinessResult,
  SystemWarningResult,
  BusinessRulesConfig,
  RuleOutcome,
  ValidationResult,
} from './types';

export abstract class DocumentValidator {
  protected definition: VoucherTypeDefinition;
  protected formData: any;
  protected businessRules: BusinessRulesConfig;

  constructor(
    definition: VoucherTypeDefinition,
    formData: any,
    businessRules?: BusinessRulesConfig
  ) {
    this.definition = definition;
    this.formData = formData;
    this.businessRules = this.resolveBusinessRules(businessRules);
  }

  /**
   * Main entry point - runs all 3 layers
   */
  validate(): ValidationResult {
    const layer1 = this.validateStructure();
    const layer2 = this.validateBusiness();
    const layer3 = this.generateWarnings();

    // Layer 1 errors always block
    const hasStructuralErrors = layer1.errors.length > 0;

    // Layer 2 errors block (outcome determined by rule config)
    const hasBusinessErrors = layer2.errors.length > 0;
    const hasBusinessWarnings = layer2.warnings.length > 0;

    // Layer 3 warnings never block
    const hasSystemWarnings = layer3.warnings.length > 0;

    // canSave: structural pass + no blocking business errors
    const canSave = !hasStructuralErrors && !hasBusinessErrors;

    return {
      structuralErrors: layer1.errors,
      businessErrors: layer2.errors,
      businessWarnings: layer2.warnings,
      systemWarnings: layer3.warnings,
      canSave,
      hasWarnings: hasBusinessWarnings || hasSystemWarnings,
      hasErrors: hasStructuralErrors || hasBusinessErrors,
      ...(process.env.NODE_ENV === 'development' && {
        _debug: {
          layer1,
          layer2,
          layer3,
        },
      }),
    };
  }

  /**
   * Layer 1: Structural Validation
   * Must be implemented by each validator class
   */
  abstract validateStructure(): StructuralResult;

  /**
   * Layer 2: Business Rules Validation
   * Default implementation handles predefined rules
   * Can be overridden for custom rule logic
   */
  validateBusiness(): BusinessResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const passed: string[] = [];

    // Evaluate each configured rule
    for (const [ruleName, ruleConfig] of Object.entries(this.businessRules || {})) {
      if (!ruleConfig?.enabled) {
        continue;
      }

      const violated = this.checkBusinessRule(ruleName);

      if (violated) {
        const outcome = ruleConfig.outcome || RuleOutcome.BLOCK;
        const message = ruleConfig.errorMessage || this.getDefaultErrorMessage(ruleName);

        if (outcome === RuleOutcome.BLOCK || outcome === RuleOutcome.BLOCK_AND_WARN) {
          errors.push(message);
        }
        if (outcome === RuleOutcome.ALLOW_WITH_WARN || outcome === RuleOutcome.BLOCK_AND_WARN) {
          warnings.push(message);
        }
        if (outcome === RuleOutcome.ALLOW) {
          passed.push(ruleName);
        }
      } else {
        passed.push(ruleName);
      }
    }

    // Evaluate dynamic rules from voucherConfig.rules[]
    const dynamicRules = this.definition.rules?.filter((r) => r.type === 'VALIDATION') || [];
    for (const rule of dynamicRules) {
      if (!rule.enabled && rule.enabled !== undefined) {
        continue;
      }

      if (this.checkDynamicRule(rule)) {
        const outcome = (rule as any).outcome || RuleOutcome.BLOCK;
        const message = rule.errorMessage || 'Business rule violated';

        if (outcome === RuleOutcome.BLOCK || outcome === RuleOutcome.BLOCK_AND_WARN) {
          errors.push(message);
        }
        if (outcome === RuleOutcome.ALLOW_WITH_WARN || outcome === RuleOutcome.BLOCK_AND_WARN) {
          warnings.push(message);
        }
      }
    }

    return { errors, warnings, passed };
  }

  /**
   * Layer 3: System Warnings
   * Generate informational warnings (never block)
   * Can be overridden for custom warnings
   */
  generateWarnings(): SystemWarningResult {
    return { warnings: [] };
  }

  /**
   * Resolve business rules with 3-tier cascade:
   * 1. Form-level overrides (voucherConfig.metadata.businessRules)
   * 2. Company-level defaults (injected from policyConfig)
   * 3. System defaults (hardcoded)
   */
  private resolveBusinessRules(injectedRules?: BusinessRulesConfig): BusinessRulesConfig {
    // Tier 1: Form-level
    const formRules = this.definition?.metadata?.businessRules || {};

    // Tier 2: Company-level
    const companyRules = injectedRules || {};

    // Tier 3: System defaults - ALL DISABLED by default (opt-in per form)
    const systemDefaults: BusinessRulesConfig = {
      requirePositiveTotal: { enabled: false, outcome: RuleOutcome.BLOCK },
      preventBelowCost: { enabled: false, outcome: RuleOutcome.ALLOW_WITH_WARN },
      enforceCreditLimit: { enabled: false, outcome: RuleOutcome.BLOCK },
      requireWarehouse: { enabled: false, outcome: RuleOutcome.BLOCK },
      minLineCount: { enabled: false, outcome: RuleOutcome.BLOCK },
    };

    // Cascade: form > company > system
    return { ...systemDefaults, ...companyRules, ...formRules };
  }

  /**
   * Check a specific business rule
   * Returns true if rule is violated
   */
  protected checkBusinessRule(ruleName: string): boolean {
    switch (ruleName) {
      case 'requirePositiveTotal':
        return this.checkRequirePositiveTotal();
      case 'preventBelowCost':
        return this.checkPreventBelowCost();
      case 'enforceCreditLimit':
        return this.checkEnforceCreditLimit();
      case 'requireWarehouse':
        return this.checkRequireWarehouse();
      case 'minLineCount':
        return this.checkMinLineCount();
      default:
        return false;
    }
  }

  /**
   * Get default error message for a rule
   */
  protected getDefaultErrorMessage(ruleName: string): string {
    const messages: Record<string, string> = {
      requirePositiveTotal: 'Total amount must be greater than 0',
      preventBelowCost: 'One or more items are priced below cost',
      enforceCreditLimit: 'Customer credit limit would be exceeded',
      requireWarehouse: 'Warehouse is required',
      minLineCount: 'Minimum number of line items not met',
    };
    return messages[ruleName] || `${ruleName} validation failed`;
  }

  // ─── Rule Implementation Methods ───

  protected checkRequirePositiveTotal(): boolean {
    const total = this.calculateTotal();
    return total <= 0;
  }

  protected checkPreventBelowCost(): boolean {
    const lines = this.getLines();
    return lines.some((l) => {
      const unitPrice = Number(l.unitPrice || l.price || 0);
      const costPrice = Number(l.costPrice || l.cost || 0);
      return unitPrice > 0 && costPrice > 0 && unitPrice < costPrice;
    });
  }

  protected checkEnforceCreditLimit(): boolean {
    // Placeholder - requires async API call to fetch customer outstanding
    // This would be implemented in SalesValidator
    return false;
  }

  protected checkRequireWarehouse(): boolean {
    const hasWarehouse = this.hasField('warehouseId') || this.hasField('warehouse');
    const lines = this.getLines();
    const linesWithoutWarehouse = lines.filter(
      (l) => !l.warehouseId && !l.warehouse
    ).length;
    return !hasWarehouse || linesWithoutWarehouse > 0;
  }

  protected checkMinLineCount(): boolean {
    const lines = this.getLines();
    const minCount = this.businessRules?.minLineCount?.value || 1;
    return lines.length < minCount;
  }

  // ─── Dynamic Rule Evaluation ───

  protected checkDynamicRule(rule: any): boolean {
    const conditions = rule.conditions || [];
    const matchType = rule.matchType || 'AND';

    if (matchType === 'AND') {
      return conditions.every((c: any) => this.checkCondition(c));
    } else {
      return conditions.some((c: any) => this.checkCondition(c));
    }
  }

  protected checkCondition(condition: any): boolean {
    const fieldValue = this.formData?.[condition.fieldId];
    const targetValue = condition.value;
    const operator = condition.operator;

    switch (operator) {
      case 'EQUALS':
        return fieldValue == targetValue;
      case 'NOT_EQUALS':
        return fieldValue != targetValue;
      case 'CONTAINS':
        return String(fieldValue || '').includes(String(targetValue));
      case 'IS_EMPTY':
        return fieldValue === null || fieldValue === undefined || fieldValue === '';
      case 'IS_NOT_EMPTY':
        return fieldValue !== null && fieldValue !== undefined && fieldValue !== '';
      case 'GREATER_THAN':
        return Number(fieldValue) > Number(targetValue);
      case 'LESS_THAN':
        return Number(fieldValue) < Number(targetValue);
      default:
        return false;
    }
  }

  // ─── Helper Methods ───

  /**
   * Extract lines from form data regardless of shape
   */
  protected getLines(): any[] {
    return this.formData?.lines || this.formData?.detailLines || [];
  }

  /**
   * Check if a field has a truthy value
   */
  protected hasField(fieldId: string): boolean {
    return !!this.formData?.[fieldId];
  }

  /**
   * Calculate document total
   */
  protected calculateTotal(): number {
    const lines = this.getLines();
    return lines.reduce((sum, l) => {
      const val =
        Number(l.amount) ||
        Number(l.total) ||
        Number(l.lineTotal) ||
        Number(l.lineTotalDoc) ||
        Number(l.rowTotal) ||
        0;
      return sum + val;
    }, 0);
  }

  /**
   * Determine the amount field name from tableColumns
   */
  protected getAmountFieldId(): string {
    const cols = this.definition.tableColumns || [];
    const amountCol = cols.find((c) => {
      const id = (c.fieldId || '').toLowerCase();
      return id.includes('amount') || id.includes('total') || id.includes('line') || id.includes('row');
    });
    return amountCol?.fieldId || 'amount';
  }
}
