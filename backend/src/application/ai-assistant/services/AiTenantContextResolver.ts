import { ICompanyRepository } from '../../../domain/core/repositories/ICompanyRepository';
import { ICompanySettingsRepository } from '../../../repository/interfaces/core/ICompanySettingsRepository';
import { IUserRepository } from '../../../repository/interfaces/core/IUserRepository';
import { ICompanyUserRepository } from '../../../repository/interfaces/core/ICompanyUserRepository';

export interface AiTenantContext {
  companyName: string;
  baseCurrency: string;
  country?: string;
  timezone: string;
  dateFormat: string;
  language: string;
  fiscalYearStart: string;
  fiscalYearEnd: string;
  enabledModules: string[];
  userName: string;
  userRole: string;
}

export class AiTenantContextResolver {
  constructor(
    private companyRepository: ICompanyRepository,
    private companySettingsRepository: ICompanySettingsRepository,
    private userRepository: IUserRepository,
    private companyUserRepository: ICompanyUserRepository,
  ) {}

  async resolve(companyId: string, userId: string): Promise<AiTenantContext | null> {
    try {
      const [company, settings, user, membership] = await Promise.all([
        this.companyRepository.findById(companyId),
        this.companySettingsRepository.getSettings(companyId),
        this.userRepository.getUserById(userId),
        this.companyUserRepository.getUserMembership(userId, companyId),
      ]);

      if (!company) return null;

      return {
        companyName: company.name,
        baseCurrency: settings?.baseCurrency || company.baseCurrency || 'USD',
        country: company.country,
        timezone: settings?.timezone || 'UTC',
        dateFormat: settings?.dateFormat || 'YYYY-MM-DD',
        language: settings?.language || 'en',
        fiscalYearStart: settings?.fiscalYearStart || '01-01',
        fiscalYearEnd: settings?.fiscalYearEnd || '12-31',
        enabledModules: company.modules || [],
        userName: user?.name || 'User',
        userRole: membership?.role || 'USER',
      };
    } catch (err) {
      console.warn(`[AiTenantContextResolver] Failed to resolve context for ${companyId}/${userId}:`, err);
      return null;
    }
  }

  static formatForPrompt(ctx: AiTenantContext): string {
    return `COMPANY & USER CONTEXT:
- Company: ${ctx.companyName}
- Currency: ${ctx.baseCurrency}${ctx.country ? `\n- Country: ${ctx.country}` : ''}
- Timezone: ${ctx.timezone}
- Date format: ${ctx.dateFormat}
- Language: ${ctx.language}
- Fiscal year: ${ctx.fiscalYearStart} to ${ctx.fiscalYearEnd}
- Modules: ${ctx.enabledModules.join(', ') || 'none'}
- User: ${ctx.userName} (${ctx.userRole})

Base currency is ${ctx.baseCurrency}. When tool results include a currency field, use that instead — this company may have multi-currency transactions. Use ${ctx.dateFormat} for dates. Respect the fiscal year boundaries for period-based queries.

When your response includes data from ERP tools, always start with a small metadata line in this exact format:
> 📋 ${ctx.companyName} · ${ctx.baseCurrency} · {date range used} · {tool name}

Replace {date range used} and {tool name} with the actual values from the tool call. This helps the user audit which context produced the answer.`;
  }
}
