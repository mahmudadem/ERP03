import { IPolicyEngine } from '../../system-core/contracts/IPolicyEngine';
import { IAuditEngine } from '../../system-core/contracts/IAuditEngine';
import { IPrintLayoutCore, PrintLayoutSchema } from '../../system-core/contracts/IPrintLayoutCore';
import { PosReceipt } from '../../../domain/pos/entities/PosReceipt';
import { IPosPaymentRepository } from '../../../repository/interfaces/pos/IPosPaymentRepository';
import { IPosReceiptRepository } from '../../../repository/interfaces/pos/IPosReceiptRepository';
import { IPrintLayoutTemplateRepository } from '../../../repository/interfaces/print-layout/IPrintLayoutTemplateRepository';

export interface PosReceiptPrintTemplateResult {
  id?: string;
  name: string;
  documentType: 'POS_RECEIPT';
  isDefault: boolean;
  source: 'SAVED_TEMPLATE' | 'GENERATED_DEFAULT';
  layout: PrintLayoutSchema;
}

export interface PrintPosReceiptResult {
  receipt: PosReceipt;
  payments: unknown[];
  printTemplate: PosReceiptPrintTemplateResult;
}

export interface ReprintPosReceiptInput {
  companyId: string;
  receiptId: string;
  managerOverrideId?: string;
  reason?: string;
  actor: {
    userId: string;
    userEmail?: string;
    roleId?: string;
  };
}

export interface ReprintPosReceiptResult {
  receipt: PosReceipt;
  payments: unknown[];
  printTemplate?: PosReceiptPrintTemplateResult;
}

export class PrintPosReceiptUseCase {
  constructor(
    private readonly receiptRepo: IPosReceiptRepository,
    private readonly paymentRepo: IPosPaymentRepository,
    private readonly printLayoutTemplateRepo: IPrintLayoutTemplateRepository,
    private readonly printLayoutCore: IPrintLayoutCore
  ) {}

  async execute(companyId: string, receiptId: string): Promise<PrintPosReceiptResult> {
    const receipt = await this.receiptRepo.getById(companyId, receiptId);
    if (!receipt) throw new Error('Receipt not found');
    const payments = await this.paymentRepo.listByReceipt(companyId, receiptId);
    const printTemplate = await resolveReceiptPrintTemplate(companyId, this.printLayoutTemplateRepo, this.printLayoutCore);
    return { receipt, payments, printTemplate };
  }
}

export class ReprintPosReceiptUseCase {
  constructor(
    private readonly receiptRepo: IPosReceiptRepository,
    private readonly paymentRepo: IPosPaymentRepository,
    private readonly policyEngine?: IPolicyEngine,
    private readonly auditEngine?: IAuditEngine,
    private readonly printLayoutTemplateRepo?: IPrintLayoutTemplateRepository,
    private readonly printLayoutCore?: IPrintLayoutCore
  ) {}

  async execute(input: ReprintPosReceiptInput): Promise<ReprintPosReceiptResult> {
    const receipt = await this.receiptRepo.getById(input.companyId, input.receiptId);
    if (!receipt) throw new Error('Receipt not found');

    if (this.policyEngine) {
      const policy = await this.policyEngine.resolve({
        scope: 'pos',
        action: 'managerOverride',
        companyId: input.companyId,
        context: {
          overrideAction: 'REPRINT',
          cashierRoleId: input.actor.roleId,
          approvedOverrideId: input.managerOverrideId,
        },
      });
      if (!policy.allowed) {
        throw new Error(`Manager approval is required for POS receipt reprint: ${policy.resolvedBy.join(', ')}`);
      }
    }

    const payments = await this.paymentRepo.listByReceipt(input.companyId, input.receiptId);
    const printTemplate = this.printLayoutTemplateRepo && this.printLayoutCore
      ? await resolveReceiptPrintTemplate(input.companyId, this.printLayoutTemplateRepo, this.printLayoutCore)
      : undefined;
    await this.auditEngine?.record({
      companyId: input.companyId,
      entity: { type: 'POS_RECEIPT', id: receipt.id, number: receipt.receiptNumber },
      action: 'UPDATE',
      before: { reprintRequested: false },
      after: {
        reprintRequested: true,
        reprintedAt: new Date().toISOString(),
        managerOverrideId: input.managerOverrideId,
      },
      actor: { userId: input.actor.userId, userEmail: input.actor.userEmail },
      reason: input.reason || 'POS receipt reprint',
      approval: input.managerOverrideId ? { managerOverrideId: input.managerOverrideId } : undefined,
    });

    return { receipt, payments, printTemplate };
  }
}

async function resolveReceiptPrintTemplate(
  companyId: string,
  printLayoutTemplateRepo: IPrintLayoutTemplateRepository,
  printLayoutCore: IPrintLayoutCore
): Promise<PosReceiptPrintTemplateResult> {
  const saved = await printLayoutTemplateRepo.getDefault(companyId, 'POS_RECEIPT');
  if (saved) {
    return {
      id: saved.id,
      name: saved.name,
      documentType: 'POS_RECEIPT',
      isDefault: saved.isDefault,
      source: 'SAVED_TEMPLATE',
      layout: saved.layout,
    };
  }
  return {
    name: 'POS RECEIPT Default',
    documentType: 'POS_RECEIPT',
    isDefault: true,
    source: 'GENERATED_DEFAULT',
    layout: printLayoutCore.createDefaultLayout('POS_RECEIPT'),
  };
}
