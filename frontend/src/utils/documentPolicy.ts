import { InventoryAccountingMode, InventorySettingsDTO } from '../api/inventoryApi';
import { PurchaseSettingsDTO } from '../api/purchasesApi';
import { SalesSettingsDTO, WorkflowMode } from '../api/salesApi';

export const resolveInventoryAccountingMode = (
  settings?: Pick<Partial<InventorySettingsDTO>, 'accountingMode' | 'inventoryAccountingMethod'> | null
): InventoryAccountingMode => {
  if (!settings) return 'INVOICE_DRIVEN';
  return settings.accountingMode || (settings.inventoryAccountingMethod === 'PERPETUAL' ? 'PERPETUAL' : 'INVOICE_DRIVEN');
};

export const resolveWorkflowMode = (mode?: string | null): WorkflowMode =>
  String(mode || '').toUpperCase() === 'SIMPLE' ? 'SIMPLE' : 'OPERATIONAL';

export const shouldShowOperationalDocuments = (workflowMode: WorkflowMode): boolean =>
  workflowMode === 'OPERATIONAL';

export const getAccountingModeLabel = (mode: InventoryAccountingMode): string =>
  mode === 'PERPETUAL' ? 'Perpetual' : 'Invoice-driven';

export const getWorkflowModeLabel = (mode: WorkflowMode): string =>
  mode === 'SIMPLE' ? 'Simple' : 'Operational';

const normalizeDocumentCode = (...values: unknown[]): string => {
  const resolved = values.find((value) => value !== undefined && value !== null && value !== '');
  if (resolved && typeof resolved === 'object') {
    const objectValue = resolved as Record<string, unknown>;
    const identity = objectValue.id ?? objectValue.value ?? objectValue.code ?? objectValue.key ?? objectValue.name ?? objectValue.label;
    return String(identity ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  }

  const normalized = String(resolved ?? '').trim().toLowerCase();
  return normalized.replace(/[\s-]+/g, '_');
};

export const isOperationalSalesDocument = (input: { code?: unknown; formType?: unknown; baseType?: unknown }): boolean => {
  const normalized = normalizeDocumentCode(input.formType || input.baseType, input.code);
  return normalized === 'sales_order' || normalized === 'delivery_note';
};

export const isOperationalPurchaseDocument = (input: { code?: unknown; formType?: unknown; baseType?: unknown }): boolean => {
  const normalized = normalizeDocumentCode(input.formType || input.baseType, input.code);
  return normalized === 'purchase_order' || normalized === 'grn' || normalized === 'goods_receipt';
};

export const resolveSalesWorkflowMode = (
  settings?: Pick<SalesSettingsDTO, 'workflowMode'> | null
): WorkflowMode => resolveWorkflowMode(settings?.workflowMode);

export const resolvePurchaseWorkflowMode = (
  settings?: Pick<PurchaseSettingsDTO, 'workflowMode'> | null
): WorkflowMode => resolveWorkflowMode(settings?.workflowMode);
