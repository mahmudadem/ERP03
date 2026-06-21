import { randomUUID } from 'crypto';
import {
  PosSettings,
  PosPaymentMethodConfig,
  PosCashRounding,
} from '../../../domain/pos/entities/PosSettings';
import { IPosSettingsRepository } from '../../../repository/interfaces/pos/IPosSettingsRepository';
import { IAccountRepository } from '../../../repository/interfaces/accounting/IAccountRepository';
import { IPosPolicyRepository } from '../../../repository/interfaces/pos/IPosPolicyRepository';
import { POSPolicy } from '../../../domain/pos/entities/POSPolicy';

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
 * Also keeps the POS-owned policy in sync with `allowPosDirectSales` so direct
 * sale authorization stays inside the POS/System Core boundary.
 */
export class UpdatePosSettingsUseCase {
  constructor(
    private readonly posSettingsRepo: IPosSettingsRepository,
    private readonly accountRepo: IAccountRepository,
    private readonly posPolicyRepo: IPosPolicyRepository
  ) {}

  async execute(input: UpdatePosSettingsInput): Promise<PosSettings> {
    const current = (await this.posSettingsRepo.getSettings(input.companyId)) ||
      PosSettings.createDefault(input.companyId);

    // Validate account references for any explicitly provided values.
    if (input.cashOverAccountId) {
      await this.assertAccount(input.companyId, input.cashOverAccountId, 'cashOverAccountId');
    }
    if (input.cashShortAccountId) {
      await this.assertAccount(input.companyId, input.cashShortAccountId, 'cashShortAccountId');
    }
    if (Array.isArray(input.paymentMethods)) {
      for (const m of input.paymentMethods) {
        if (m.isEnabled && !m.settlementAccountId?.trim()) {
          throw new Error(
            `Payment method ${m.code} is enabled but has no settlement account configured.`
          );
        }
        if (m.isEnabled && m.settlementAccountId) {
          await this.assertAccount(input.companyId, m.settlementAccountId, `paymentMethods.${m.code}.settlementAccountId`);
        }
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

    const policy = (await this.posPolicyRepo.getPolicy(input.companyId)) || POSPolicy.createDefault(input.companyId);
    policy.allowPosDirectSales = next.allowPosDirectSales;
    await this.posPolicyRepo.savePolicy(policy);
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
