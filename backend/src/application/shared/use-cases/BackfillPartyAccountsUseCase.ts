import { IPartyRepository } from '../../../repository/interfaces/shared/IPartyRepository';
import { IAccountRepository } from '../../../repository/interfaces/accounting/IAccountRepository';
import { ISalesSettingsRepository } from '../../../repository/interfaces/sales/ISalesSettingsRepository';
import { IPurchaseSettingsRepository } from '../../../repository/interfaces/purchases/IPurchaseSettingsRepository';
import { ICompanyRepository } from '../../../repository/interfaces/core/ICompanyRepository';
import { ICompanyCurrencyRepository } from '../../../repository/interfaces/accounting/ICompanyCurrencyRepository';
import { CreateAccountUseCase } from '../../accounting/use-cases/accounts/CreateAccountUseCase';
import { UpdatePartyUseCase } from './PartyUseCases';
import {
  renderPartyAccountCode,
  templateUsesSequence,
} from '../services/PartyAccountCodeRenderer';

export type PartyAccountBackfillScope = 'AR' | 'AP' | 'BOTH';

export interface BackfillPartyAccountsInput {
  companyId: string;
  actorId: string;
  scope?: PartyAccountBackfillScope;
  activeOnly?: boolean;
}

export interface BackfillPartyAccountsResult {
  created: number;
  skipped: number;
  errors: Array<{
    partyId: string;
    side: 'AR' | 'AP';
    message: string;
  }>;
}

interface SideConfig {
  parentAccountId: string;
  template?: string;
}

export class BackfillPartyAccountsUseCase {
  constructor(
    private readonly partyRepo: IPartyRepository,
    private readonly accountRepo: IAccountRepository,
    private readonly salesSettingsRepo: ISalesSettingsRepository,
    private readonly purchaseSettingsRepo: IPurchaseSettingsRepository,
    private readonly companyRepo: ICompanyRepository,
    private readonly companyCurrencyRepo: ICompanyCurrencyRepository
  ) {}

  async execute(input: BackfillPartyAccountsInput): Promise<BackfillPartyAccountsResult> {
    const scope = input.scope || 'BOTH';
    const includeAr = scope === 'AR' || scope === 'BOTH';
    const includeAp = scope === 'AP' || scope === 'BOTH';

    const arConfig = includeAr ? await this.resolveArConfig(input.companyId) : null;
    const apConfig = includeAp ? await this.resolveApConfig(input.companyId) : null;

    const updatePartyUseCase = new UpdatePartyUseCase(
      this.partyRepo,
      this.companyCurrencyRepo
    );
    const createAccountUseCase = new CreateAccountUseCase(
      this.accountRepo,
      this.companyRepo,
      this.companyCurrencyRepo
    );

    const parties = await this.partyRepo.list(input.companyId, {
      active: input.activeOnly !== false,
    });

    const result: BackfillPartyAccountsResult = {
      created: 0,
      skipped: 0,
      errors: [],
    };

    for (const party of parties) {
      if (includeAr && party.roles.includes('CUSTOMER') && arConfig) {
        await this.processOneSide({
          companyId: input.companyId,
          actorId: input.actorId,
          party,
          side: 'AR',
          existingAccountId: party.defaultARAccountId,
          config: arConfig,
          createAccountUseCase,
          updatePartyUseCase,
          result,
        });
      }

      if (includeAp && party.roles.includes('VENDOR') && apConfig) {
        await this.processOneSide({
          companyId: input.companyId,
          actorId: input.actorId,
          party,
          side: 'AP',
          existingAccountId: party.defaultAPAccountId,
          config: apConfig,
          createAccountUseCase,
          updatePartyUseCase,
          result,
        });
      }
    }

    return result;
  }

  private async processOneSide(args: {
    companyId: string;
    actorId: string;
    party: { id: string; code: string; legalName: string };
    side: 'AR' | 'AP';
    existingAccountId?: string;
    config: SideConfig;
    createAccountUseCase: CreateAccountUseCase;
    updatePartyUseCase: UpdatePartyUseCase;
    result: BackfillPartyAccountsResult;
  }): Promise<void> {
    const {
      companyId,
      actorId,
      party,
      side,
      existingAccountId,
      config,
      createAccountUseCase,
      updatePartyUseCase,
      result,
    } = args;

    try {
      if (existingAccountId && existingAccountId !== config.parentAccountId) {
        const existingAccount = await this.accountRepo.getById(companyId, existingAccountId);
        if (existingAccount?.parentId === config.parentAccountId) {
          result.skipped += 1;
          return;
        }
      }

      const parent = await this.accountRepo.getById(companyId, config.parentAccountId);
      if (!parent) {
        throw new Error(`${side} parent account not found: ${config.parentAccountId}`);
      }

      const parentCode = parent.userCode || '';
      const template = config.template;
      const usesSeq = templateUsesSequence(template);
      let seq = 1;
      let userCode = renderPartyAccountCode(template, {
        parent: parentCode,
        partyCode: party.code,
        seq,
      });

      if (usesSeq) {
        while (await this.accountRepo.existsByUserCode(companyId, userCode)) {
          seq += 1;
          userCode = renderPartyAccountCode(template, {
            parent: parentCode,
            partyCode: party.code,
            seq,
          });
        }
      } else if (await this.accountRepo.existsByUserCode(companyId, userCode)) {
        throw new Error(
          `Generated account code already exists: ${userCode}. Add {seq3} to partyAccountCodeFormat to auto-disambiguate.`
        );
      }

      const account = await createAccountUseCase.execute(companyId, {
        userCode,
        name: `${side} – ${party.legalName}`,
        classification: side === 'AR' ? 'ASSET' : 'LIABILITY',
        parentId: config.parentAccountId,
        accountRole: 'POSTING',
        createdBy: actorId,
      });

      await updatePartyUseCase.execute({
        companyId,
        id: party.id,
        ...(side === 'AR'
          ? { defaultARAccountId: account.id }
          : { defaultAPAccountId: account.id }),
      });

      result.created += 1;
    } catch (error: any) {
      result.errors.push({
        partyId: party.id,
        side,
        message: error?.message || String(error),
      });
    }
  }

  private async resolveArConfig(companyId: string): Promise<SideConfig> {
    const settings = await this.salesSettingsRepo.getSettings(companyId);
    const parentAccountId = settings?.arParentAccountId;
    if (!parentAccountId) {
      throw new Error('Sales Settings AR parent account is not configured.');
    }
    return {
      parentAccountId,
      template: settings?.partyAccountCodeFormat,
    };
  }

  private async resolveApConfig(companyId: string): Promise<SideConfig> {
    const settings = await this.purchaseSettingsRepo.getSettings(companyId);
    const parentAccountId = settings?.apParentAccountId;
    if (!parentAccountId) {
      throw new Error('Purchase Settings AP parent account is not configured.');
    }
    return {
      parentAccountId,
      template: settings?.partyAccountCodeFormat,
    };
  }
}

