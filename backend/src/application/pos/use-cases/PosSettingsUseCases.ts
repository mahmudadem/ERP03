import { randomUUID } from 'crypto';
import {
  PosSettings,
  PosPaymentMethodConfig,
  PosCashRounding,
} from '../../../domain/pos/entities/PosSettings';
import { IPosSettingsRepository } from '../../../repository/interfaces/pos/IPosSettingsRepository';
import { IAccountRepository } from '../../../repository/interfaces/accounting/IAccountRepository';
import { ISalesSettingsRepository } from '../../../repository/interfaces/sales/ISalesSettingsRepository';
import { GovernanceRule } from '../../../domain/sales/entities/SalesSettings';

export interface UpdatePosSettingsInput {
  companyId: string;
  requireOpenShift?: boolean;
  walkInCustomerId?: string;
  cashOverAccountId?: string;
  cashShortAccountId?: string;
  receiptPrefix?: string;
  receiptNextSeq?: number;
  cashRounding?: PosCashRounding;
  allowPosDirectSales?: boolean;
  paymentMethods?: PosPaymentMethodConfig[];
}

const POS_SALE_GOVERNANCE_RULE_ID = 'pos_direct_sale_form_allow';

/**
 * Initialize (or re-initialize) POS settings for a company with the safe defaults.
 * Idempotent.
 */
export class InitializePosUseCase {
  constructor(private readonly posSettingsRepo: IPosSettingsRepository) {}

  async execute(companyId: string): Promise<PosSettings> {
    const existing = await this.posSettingsRepo.getSettings(companyId);
    if (existing) return existing;
    const settings = PosSettings.createDefault(companyId);
    await this.posSettingsRepo.saveSettings(settings);
    return settings;
  }
}

export class GetPosSettingsUseCase {
  constructor(private readonly posSettingsRepo: IPosSettingsRepository) {}

  async execute(companyId: string): Promise<PosSettings | null> {
    return this.posSettingsRepo.getSettings(companyId);
  }
}

/**
 * Update POS settings. Validates that:
 *   - Every enabled payment method has a settlementAccountId that exists.
 *   - cashOverAccountId / cashShortAccountId, if set, exist.
 * Also keeps the Sales `governanceRules` list in sync with `allowPosDirectSales` —
 * a form-scoped allow rule for `formType:'pos_sale'` / `persona:'direct'` is
 * inserted when enabled and removed when disabled. We do NOT alter `workflowMode`.
 */
export class UpdatePosSettingsUseCase {
  constructor(
    private readonly posSettingsRepo: IPosSettingsRepository,
    private readonly accountRepo: IAccountRepository,
    private readonly salesSettingsRepo: ISalesSettingsRepository
  ) {}

  async execute(input: UpdatePosSettingsInput): Promise<PosSettings> {
    const current = (await this.posSettingsRepo.getSettings(input.companyId)) ||
      PosSettings.createDefault(input.companyId);

    // Validate company-level over/short account references. Payment settlement
    // accounts belong to each register, not POS Settings.
    if (input.cashOverAccountId) {
      await this.assertAccount(input.companyId, input.cashOverAccountId, 'cashOverAccountId');
    }
    if (input.cashShortAccountId) {
      await this.assertAccount(input.companyId, input.cashShortAccountId, 'cashShortAccountId');
    }
    if (Array.isArray(input.paymentMethods)) {
      for (const m of input.paymentMethods) {
        m.settlementAccountId = '';
      }
    }

    const next = new PosSettings({
      companyId: input.companyId,
      requireOpenShift: input.requireOpenShift !== undefined ? input.requireOpenShift : current.requireOpenShift,
      walkInCustomerId: input.walkInCustomerId !== undefined ? input.walkInCustomerId : current.walkInCustomerId,
      cashOverAccountId: input.cashOverAccountId !== undefined ? input.cashOverAccountId : current.cashOverAccountId,
      cashShortAccountId: input.cashShortAccountId !== undefined ? input.cashShortAccountId : current.cashShortAccountId,
      receiptPrefix: input.receiptPrefix !== undefined ? input.receiptPrefix : current.receiptPrefix,
      receiptNextSeq: input.receiptNextSeq !== undefined ? input.receiptNextSeq : current.receiptNextSeq,
      cashRounding: input.cashRounding !== undefined ? input.cashRounding : current.cashRounding,
      allowPosDirectSales: input.allowPosDirectSales !== undefined ? input.allowPosDirectSales : current.allowPosDirectSales,
      paymentMethods: input.paymentMethods !== undefined ? input.paymentMethods : current.paymentMethods,
    });

    await this.posSettingsRepo.saveSettings(next);

    // Sync the Sales governance rule.
    const salesSettings = await this.salesSettingsRepo.getSettings(input.companyId);
    if (salesSettings) {
      const currentRules: GovernanceRule[] = (salesSettings.governanceRules || []).filter(
        (r) => r.id !== POS_SALE_GOVERNANCE_RULE_ID
      );
      const updatedRules: GovernanceRule[] = next.allowPosDirectSales
        ? [
            ...currentRules,
            {
              id: POS_SALE_GOVERNANCE_RULE_ID,
              scope: 'form',
              formType: 'pos_sale',
              action: 'allow',
              persona: 'direct',
            },
          ]
        : currentRules;
      salesSettings.governanceRules = updatedRules;
      await this.salesSettingsRepo.saveSettings(salesSettings);
    }

    return next;
  }

  private async assertAccount(companyId: string, accountId: string, label: string): Promise<void> {
    const account = await this.accountRepo.getById(companyId, accountId);
    if (!account) {
      throw new Error(
        `Account not found for ${label}: ${accountId}. Pick an existing account or leave it blank.`
      );
    }
  }
}
