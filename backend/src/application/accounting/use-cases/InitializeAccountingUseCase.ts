import { ICompanyModuleRepository } from '../../../repository/interfaces/company/ICompanyModuleRepository';
import { IAccountRepository } from '../../../repository/interfaces/accounting/IAccountRepository';
import { ISystemMetadataRepository } from '../../../infrastructure/repositories/FirestoreSystemMetadataRepository';

import * as crypto from 'crypto';

interface InitializeAccountingRequest {
  companyId: string;
  config: {
    fiscalYearStart: string;
    fiscalYearEnd: string;
    baseCurrency: string;
    coaTemplate: string;
  };
}

export class InitializeAccountingUseCase {
  constructor(
    private companyModuleRepo: ICompanyModuleRepository,
    private accountRepo: IAccountRepository,
    private systemMetadataRepo: ISystemMetadataRepository
  ) {}

  async execute(request: InitializeAccountingRequest): Promise<void> {
    const { companyId, config } = request;

    console.log(`[InitializeAccountingUseCase] Initializing for ${companyId} with template ${config.coaTemplate}`);

    // 1. Fetch Template from DB
    const templates = await this.systemMetadataRepo.getMetadata('coa_templates');
    const selectedTemplate = templates.find((t: any) => t.id === config.coaTemplate);

    if (!selectedTemplate || !selectedTemplate.accounts) {
      throw new Error(`COA Template '${config.coaTemplate}' not found in system metadata.`);
    }

    const templateAccounts = selectedTemplate.accounts;
    // 2. Create Accounts
    const codeToIdMap = new Map<string, string>();

    // First pass: Generate IDs map
    for (const tpl of templateAccounts) {
      const id = crypto.randomUUID();
      codeToIdMap.set(tpl.code, id);
    }

    // Second pass: Create accounts
    const promises = templateAccounts.map((tpl: any) => {
      const id = codeToIdMap.get(tpl.code)!;
      let parentId: string | null = null;
      
      if (tpl.parentId && codeToIdMap.has(tpl.parentId)) {
        parentId = codeToIdMap.get(tpl.parentId)!;
      }

      const input = {
        id,
        code: tpl.code,
        name: tpl.name,
        type: tpl.type,
        parentId,
        currency: config.baseCurrency
      };

      return this.accountRepo.create(companyId, input);
    });
    
    await Promise.all(promises);
    
    console.log(`[InitializeAccountingUseCase] Created ${promises.length} accounts.`);

    // 3. Mark Module as Initialized
    await this.companyModuleRepo.update(companyId, 'accounting', {
      initialized: true,
      initializationStatus: 'complete',
      config,
      updatedAt: new Date()
    });
    
    console.log(`[InitializeAccountingUseCase] Module marked as initialized.`);
  }
}
