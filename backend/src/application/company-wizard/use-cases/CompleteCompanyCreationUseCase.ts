import { Company } from '../../../domain/core/entities/Company';
import { CompanyWizardStep } from '../../../domain/company-wizard';
import { ICompanyWizardTemplateRepository } from '../../../repository/interfaces/company-wizard/ICompanyWizardTemplateRepository';
import { ICompanyCreationSessionRepository } from '../../../repository/interfaces/company-wizard/ICompanyCreationSessionRepository';
import { ICompanyRepository } from '../../../repository/interfaces/core/ICompanyRepository';
import { IUserRepository } from '../../../repository/interfaces/core/IUserRepository';
import { ICompanyUserRepository as IRbacCompanyUserRepository } from '../../../repository/interfaces/rbac/ICompanyUserRepository';

interface Input {
  sessionId: string;
  userId: string;
}

export class CompleteCompanyCreationUseCase {
  constructor(
    private sessionRepo: ICompanyCreationSessionRepository,
    private templateRepo: ICompanyWizardTemplateRepository,
    private companyRepo: ICompanyRepository,
    private userRepo: IUserRepository,
    private rbacCompanyUserRepo: IRbacCompanyUserRepository
  ) {}

  private filter(steps: CompanyWizardStep[], model: string) {
    return steps
      .filter((step) => !step.modelKey || step.modelKey === model)
      .sort((a, b) => a.order - b.order);
  }

  private validateAllRequired(steps: CompanyWizardStep[], data: Record<string, any>) {
    for (const step of steps) {
      for (const field of step.fields) {
        if (field.required && (data[field.id] === undefined || data[field.id] === null || data[field.id] === '')) {
          throw new Error(`Missing required field: ${field.id}`);
        }
      }
    }
  }

  private generateId(prefix: string) {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  async execute(input: Input): Promise<{ companyId: string; activeCompanyId: string }> {
    const session = await this.sessionRepo.getById(input.sessionId);
    if (!session) throw new Error('Session not found');
    if (session.userId !== input.userId) throw new Error('Forbidden');

    const actor = await this.userRepo.getUserById(session.userId);
    if (!actor) throw new Error('Unauthorized');
    if (actor.isAdmin()) {
      throw new Error('SUPER_ADMIN cannot run the user wizard');
    }

    const template = await this.templateRepo.getById(session.templateId);
    if (!template) throw new Error('Template not found for session');

    const steps = this.filter(template.steps, session.model);
    this.validateAllRequired(steps, session.data);

    const now = new Date();
    const fiscalYearStart = session.data.fiscalYearStart ? new Date(session.data.fiscalYearStart) : now;
    const fiscalYearEnd = new Date(fiscalYearStart);
    fiscalYearEnd.setFullYear(fiscalYearEnd.getFullYear() + 1);

    const company = new Company(
      this.generateId('cmp'),
      session.data.companyName,
      session.userId,
      now,
      now,
      session.data.baseCurrency || 'USD',
      fiscalYearStart,
      fiscalYearEnd,
      [session.model],
      ''
    );

    await this.companyRepo.save(company);
    await this.rbacCompanyUserRepo.assignRole({
      userId: session.userId,
      companyId: company.id,
      roleId: 'OWNER',
      isOwner: true,
      createdAt: now
    });
    await this.userRepo.updateActiveCompany(session.userId, company.id);
    await this.sessionRepo.delete(session.id);

    return { companyId: company.id, activeCompanyId: company.id };
  }
}
