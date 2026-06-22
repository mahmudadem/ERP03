import { PrintDocumentType } from '../../../application/system-core/contracts/IPrintLayoutCore';
import { PrintLayoutTemplate } from '../../../domain/print-layout/PrintLayoutTemplate';

export interface IPrintLayoutTemplateRepository {
  create(template: PrintLayoutTemplate): Promise<void>;
  update(template: PrintLayoutTemplate): Promise<void>;
  getById(companyId: string, id: string): Promise<PrintLayoutTemplate | null>;
  list(companyId: string, documentType?: PrintDocumentType): Promise<PrintLayoutTemplate[]>;
  getDefault(companyId: string, documentType: PrintDocumentType): Promise<PrintLayoutTemplate | null>;
  clearDefault(companyId: string, documentType: PrintDocumentType, exceptId?: string): Promise<void>;
  delete(companyId: string, id: string): Promise<void>;
}
