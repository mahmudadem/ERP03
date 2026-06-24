import { randomUUID } from 'crypto';
import {
  PosSettings,
  PosPaymentMethodConfig,
  PosCashRounding,
  PosNegativeStockPolicy,
} from '../../../domain/pos/entities/PosSettings';
import { IPosSettingsRepository } from '../../../repository/interfaces/pos/IPosSettingsRepository';
import { IAccountRepository } from '../../../repository/interfaces/accounting/IAccountRepository';
import { IPosPolicyRepository } from '../../../repository/interfaces/pos/IPosPolicyRepository';
import { POSPolicy } from '../../../domain/pos/entities/POSPolicy';
import { IAuditEngine } from '../../system-core/contracts/IAuditEngine';

export interface UpdatePosSettingsInput {
  companyId: string;
  requireOpenShift?: boolean;
  walkInCustomerId?: string;
  cashOverAccountId?: string;
  cashShortAccountId?: string;
  defaultRevenueAccountId?: string;
  receiptPrefix?: string;
  receiptNextSeq?: number;
  cashRounding?: PosCashRounding;
  allowPosDirectSales?: boolean;
  negativeStockPolicy?: PosNegativeStockPolicy;
  paymentMethods?: PosPaymentMethodConfig[];
  actor?: { userId: string; userEmail?: string };
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
 *   - cashOverAccountId / cashShortAccountId, if set, exist.
 *   - legacy payment-method settlement accounts, if still supplied by an older client, exist.
 * Money routing for sales/refunds is register-level (`PosRegister.cashDrawerAccountId`
 * and `settlementAccountIds`) so every till reconciles to its own accounts.
 * Also keeps the POS-owned policy in sync with `allowPosDirectSales` so direct
 * sale authorization stays inside the POS/System Core boundary.
 */
export class UpdatePosSettingsUseCase {
  constructor(
    private readonly posSettingsRepo: IPosSettingsRepository,
    private readonly accountRepo: IAccountRepository,
    private readonly posPolicyRepo: IPosPolicyRepository,
    private readonly auditEngine?: IAuditEngine
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
    if (input.defaultRevenueAccountId) {
      await this.assertAccount(input.companyId, input.defaultRevenueAccountId, 'defaultRevenueAccountId');
    }
    if (Array.isArray(input.paymentMethods)) {
      for (const m of input.paymentMethods) {
        if (m.settlementAccountId) {
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
      defaultRevenueAccountId: input.defaultRevenueAccountId !== undefined ? input.defaultRevenueAccountId : current.defaultRevenueAccountId,
      receiptPrefix: input.receiptPrefix !== undefined ? input.receiptPrefix : current.receiptPrefix,
      receiptNextSeq: input.receiptNextSeq !== undefined ? input.receiptNextSeq : current.receiptNextSeq,
      cashRounding: input.cashRounding !== undefined ? input.cashRounding : current.cashRounding,
      allowPosDirectSales: input.allowPosDirectSales !== undefined ? input.allowPosDirectSales : current.allowPosDirectSales,
      negativeStockPolicy: input.negativeStockPolicy !== undefined ? input.negativeStockPolicy : current.negativeStockPolicy,
      paymentMethods: input.paymentMethods !== undefined ? input.paymentMethods : current.paymentMethods,
    });

    await this.posSettingsRepo.saveSettings(next);

    const policy = (await this.posPolicyRepo.getPolicy(input.companyId)) || POSPolicy.createDefault(input.companyId);
    policy.allowPosDirectSales = next.allowPosDirectSales;
    await this.posPolicyRepo.savePolicy(policy);

    if (this.auditEngine && input.actor) {
      await this.auditEngine.record({
        companyId: input.companyId,
        entity: { type: 'POS_SETTINGS', id: input.companyId, number: next.receiptPrefix },
        action: current ? 'UPDATE' : 'CREATE',
        actor: input.actor,
        before: current?.toJSON(),
        after: next.toJSON(),
      });
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
