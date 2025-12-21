import { ICompanyModuleRepository } from '../../../repository/interfaces/company/ICompanyModuleRepository';
import { IAccountRepository } from '../../../repository/interfaces/accounting/IAccountRepository';
import { ISystemMetadataRepository } from '../../../infrastructure/repositories/FirestoreSystemMetadataRepository';

import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import * as crypto from 'crypto';

interface InitializeAccountingRequest {
  companyId: string;
  config: {
    fiscalYearStart: string;
    fiscalYearEnd: string;
    baseCurrency: string;
    coaTemplate: string;
    selectedVoucherTypes?: string[]; // Optional: IDs of voucher types to copy
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

    // 1. Fetch COA Template from DB
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

    // 3. Copy Default Voucher Types to Company
    try {
      await this.copyDefaultVoucherTypes(
        companyId, 
        config.selectedVoucherTypes || [] // Pass selected voucher type IDs
      );
      console.log(`[InitializeAccountingUseCase] Copied default voucher types to company.`);
    } catch (error) {
      console.warn(`[InitializeAccountingUseCase] Failed to copy voucher types:`, error);
      // Don't fail initialization if voucher copy fails
    }

    // 4. Mark Module as Initialized
    await this.companyModuleRepo.update(companyId, 'accounting', {
      initialized: true,
      initializationStatus: 'complete',
      config,
      updatedAt: new Date()
    });
    
    console.log(`[InitializeAccountingUseCase] Module marked as initialized.`);
  }

  /**
   * Copy default voucher types from system_metadata to company
   * Only copies the voucher types specified in selectedVoucherTypeIds
   */
  private async copyDefaultVoucherTypes(
    companyId: string,
    selectedVoucherTypeIds: string[]
  ): Promise<void> {
    const db = admin.firestore();
    
    // If no vouchers selected, skip copying
    if (!selectedVoucherTypeIds || selectedVoucherTypeIds.length === 0) {
      console.log(`[InitializeAccountingUseCase] No voucher types selected, skipping copy`);
      return;
    }
    
    // Load default voucher types from system_metadata/voucher_types/items
    const defaultVouchersRef = db
      .collection('system_metadata')
      .doc('voucher_types')
      .collection('items');
    
    const snapshot = await defaultVouchersRef.get();
    
    if (snapshot.empty) {
      console.warn(`[InitializeAccountingUseCase] No default voucher types found in system_metadata`);
      return;
    }

    const batch = db.batch();
    let count = 0;

    snapshot.forEach(doc => {
      // Only copy if this voucher type was selected
      if (!selectedVoucherTypeIds.includes(doc.id)) {
        return; // Skip this one
      }
      
      const voucherType = doc.data();
      
      // Create a copy for this company
      const companyVoucherRef = db
        .collection('companies')
        .doc(companyId)
        .collection('voucherTypes')
        .doc(doc.id);
      
      // Add company-specific metadata
      const companyVoucher = {
        ...voucherType,
        companyId,
        isSystemDefault: true,  // Mark as system default (immutable)
        isLocked: true,         // Lock for editing
        enabled: true,          // Enable by default
        inUse: false,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };
      
      batch.set(companyVoucherRef, companyVoucher);
      count++;
    });

    await batch.commit();
    console.log(`[InitializeAccountingUseCase] Copied ${count} default voucher types to company ${companyId}`);
  }
}
