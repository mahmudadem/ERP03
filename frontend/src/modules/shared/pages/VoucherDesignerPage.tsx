/**
 * VoucherDesignerPage.tsx
 *
 * Unified per-module page for managing Voucher Types AND their Forms.
 * Used by Sales, Purchases, and Accounting via thin wrappers.
 *
 * Architecture
 * - This file is the SHELL: list view (Type-tree layout) + editor entry point.
 * - The actual field-level editor (`DocumentDesigner` from forms-designer/)
 *   is reused unchanged when the user clicks Edit / Clone / Add Custom.
 * - Data loading, save, toggle-enabled, sidebar-group, delete handlers all
 *   delegate to the existing forms-designer services so we don't duplicate
 *   the Firestore quirks and optimistic-update logic.
 * - The "Install" action wires to the Phase 2 voucherTypeManagementApi.
 *
 * UI shape
 *   Installed Types  (expandable rows)
 *     ▼ Sales Invoice                                 3 forms · 1 active
 *         Sales Invoice (Direct)   [Locked]   [✓ Active]    [Clone] [Edit] [Group ⌄]
 *         Sales Invoice (Linked)   [Locked]   [⏸ Inactive]  [Clone] [Edit] [Activate]
 *         Sales Invoice (Service)  [Locked]   [⏸ Inactive]  [Clone] [Edit] [Activate]
 *         + Add Custom Form
 *   Available Types  (one row each, Install button)
 *     Sales Return                                                     [Install]
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronRight, Download, DownloadCloud, Edit3, FileJson, FileText, FolderTree, HelpCircle, Layers, Lock, MoreVertical, PackageCheck, Plus, RefreshCw, Settings, SlidersHorizontal, X} from 'lucide-react';
import { Spinner } from '../../../components/ui/Spinner';
import { InstructionsModal } from '../../../components/instructions/InstructionsModal';
import type { PageInstructions } from '../../../components/instructions/types';
import { useQueryClient } from '@tanstack/react-query';
import {
  DocumentDesigner,
  DocumentFormConfig,
  WizardProvider,
  loadModuleDocumentForms,
  loadModuleDocumentDefinitions,
  loadSystemVoucherTypes as loadSystemVoucherTemplates,
  saveDocumentForm,
  updateFormMetadata,
  AvailableField,
} from '../../tools/forms-designer';
import { useCompanyAccess } from '../../../context/CompanyAccessContext';
import { useAuth } from '../../../context/AuthContext';
import { errorHandler } from '../../../services/errorHandler';
import { emitCompanyModulesRefresh } from '../../../utils/companyModulesEvents';
import {
  voucherTypeManagementApi,
  VoucherTypeModule,
} from '../../../api/voucherTypeManagementApi';
import {
  fieldLibraryApi,
  FieldLibraryEntry,
  ResolvedFieldLibrary,
} from '../../../api/fieldLibraryApi';
import {
  FormSettingsIdentity,
  FormSettingsRecord,
  FormSettingsValue,
  LinePriceSource,
  voucherFormApi,
} from '../../../api/voucherFormApi';
import { AccountSelectorSimple, WarehouseSelector } from '../../../components/shared/selectors';

interface VoucherDesignerPageProps {
  module: VoucherTypeModule;
  moduleLabel: string;
}

interface TypeNode {
  /** Canonical voucherType key (e.g. "purchase_invoice"). */
  typeKey: string;
  /** Display name with persona suffix stripped. */
  name: string;
  /** True when the company has at least one form for this type. */
  isInstalled: boolean;
  /** All forms (locked defaults + custom clones) the company has for this type. */
  forms: DocumentFormConfig[];
  /** System template variants (used to show "Variants: ..." line for available types). */
  catalogVariants: any[];
}

interface BuiltInNativeForm {
  id: string;
  name: string;
  code: string;
  typeId: string;
  module: VoucherTypeModule;
  voucherType: string;
  formType: string;
  documentKind: string;
  builtInFormKey: string;
  isBuiltInNative: true;
  isLocked: true;
  enabled: true;
}

interface DesignerFieldCatalog {
  systemFields: AvailableField[];
  availableFields: AvailableField[];
  availableTableColumns: AvailableField[];
  source: 'field-library' | 'legacy';
}

const stripPersonaSuffix = (formName: string): string => {
  const stripped = formName.replace(/\s*\([^)]*\)\s*$/, '').trim();
  return stripped || formName;
};

const variantLabel = (item: { persona?: string | null; name?: string }): string | null => {
  if (item.persona) return item.persona.charAt(0).toUpperCase() + item.persona.slice(1);
  if (!item.name) return null;
  const match = item.name.match(/\(([^)]+)\)/);
  return match ? match[1] : null;
};

const BUILT_IN_FORMS_BY_MODULE: Record<VoucherTypeModule, BuiltInNativeForm[]> = {
  ACCOUNTING: [
    {
      id: 'native.accounting.vouchers',
      name: 'Native Vouchers',
      code: 'NATIVE_ACCOUNTING_VOUCHERS',
      typeId: 'native.accounting.vouchers',
      module: 'ACCOUNTING',
      voucherType: 'journal_entry',
      formType: 'native_accounting_vouchers',
      documentKind: 'accounting_voucher',
      builtInFormKey: 'native.accounting.vouchers',
      isBuiltInNative: true,
      isLocked: true,
      enabled: true,
    },
  ],
  SALES: [
    {
      id: 'native.sales.invoice',
      name: 'Native Sales Invoice',
      code: 'NATIVE_SALES_INVOICE',
      typeId: 'native.sales.invoice',
      module: 'SALES',
      voucherType: 'sales_invoice',
      formType: 'native_sales_invoice',
      documentKind: 'sales_invoice',
      builtInFormKey: 'native.sales.invoice',
      isBuiltInNative: true,
      isLocked: true,
      enabled: true,
    },
    {
      id: 'native.sales.order',
      name: 'Native Sales Order',
      code: 'NATIVE_SALES_ORDER',
      typeId: 'native.sales.order',
      module: 'SALES',
      voucherType: 'sales_order',
      formType: 'native_sales_order',
      documentKind: 'sales_order',
      builtInFormKey: 'native.sales.order',
      isBuiltInNative: true,
      isLocked: true,
      enabled: true,
    },
  ],
  PURCHASE: [
    {
      id: 'native.purchase.invoice',
      name: 'Native Purchase Invoice',
      code: 'NATIVE_PURCHASE_INVOICE',
      typeId: 'native.purchase.invoice',
      module: 'PURCHASE',
      voucherType: 'purchase_invoice',
      formType: 'native_purchase_invoice',
      documentKind: 'purchase_invoice',
      builtInFormKey: 'native.purchase.invoice',
      isBuiltInNative: true,
      isLocked: true,
      enabled: true,
    },
    {
      id: 'native.purchase.order',
      name: 'Native Purchase Order',
      code: 'NATIVE_PURCHASE_ORDER',
      typeId: 'native.purchase.order',
      module: 'PURCHASE',
      voucherType: 'purchase_order',
      formType: 'native_purchase_order',
      documentKind: 'purchase_order',
      builtInFormKey: 'native.purchase.order',
      isBuiltInNative: true,
      isLocked: true,
      enabled: true,
    },
  ],
};

const buildTypeTree = (
  forms: DocumentFormConfig[],
  definitions: any[],
  catalog: any[],
): { installed: TypeNode[]; available: TypeNode[] } => {
  // Group company forms by their canonical type key. Forms carry typeId
  // pointing back to the company VoucherTypeDefinition.id; that definition
  // carries the canonical `voucherType` field.
  const definitionById = new Map<string, any>(definitions.map((d) => [d.id, d]));
  const installedByTypeKey = new Map<string, TypeNode>();

  for (const form of forms) {
    const def = definitionById.get((form as any).typeId);
    const typeKey: string = ((form as any).documentKind || def?.voucherType || def?.code || (form as any).voucherType || form.code || form.id) as string;
    const existing = installedByTypeKey.get(typeKey);
    if (existing) {
      existing.forms.push(form);
    } else {
      const baseName = def?.name
        ? stripPersonaSuffix(def.name)
        : stripPersonaSuffix(form.name);
      installedByTypeKey.set(typeKey, {
        typeKey,
        name: baseName,
        isInstalled: true,
        forms: [form],
        catalogVariants: [],
      });
    }
  }

  // Available = system catalog types whose canonical key is NOT installed.
  const availableByTypeKey = new Map<string, TypeNode>();
  for (const tpl of catalog) {
    const typeKey: string = tpl.voucherType || tpl.code || tpl.id;
    if (installedByTypeKey.has(typeKey)) {
      // Already installed — attach catalog variants for context
      installedByTypeKey.get(typeKey)!.catalogVariants.push(tpl);
      continue;
    }
    const existing = availableByTypeKey.get(typeKey);
    if (existing) {
      existing.catalogVariants.push(tpl);
    } else {
      availableByTypeKey.set(typeKey, {
        typeKey,
        name: stripPersonaSuffix(tpl.name || tpl.code || typeKey),
        isInstalled: false,
        forms: [],
        catalogVariants: [tpl],
      });
    }
  }

  const sortByName = (a: TypeNode, b: TypeNode) => a.name.localeCompare(b.name);
  return {
    installed: Array.from(installedByTypeKey.values()).sort(sortByName),
    available: Array.from(availableByTypeKey.values()).sort(sortByName),
  };
};

const MODULE_DEFAULTS = {
  ACCOUNTING: {
    rules: [
      { id: 'require_approval', label: 'Require Approval Workflow', enabled: true },
      { id: 'prevent_negative_cash', label: 'Prevent Negative Cash', enabled: false },
      { id: 'allow_future_date', label: 'Allow Future Posting Dates', enabled: true },
    ],
    actions: [
      { type: 'print', label: 'Print Voucher', enabled: true },
      { type: 'email', label: 'Email PDF', enabled: true },
      { type: 'download_pdf', label: 'Download PDF', enabled: true },
    ],
  },
  SALES: {
    rules: [
      { id: 'require_approval', label: 'Require Approval Workflow', enabled: true },
      { id: 'prevent_negative_qty', label: 'Prevent Negative Stock', enabled: true },
      { id: 'validate_credit_limit', label: 'Check Credit Limit', enabled: true },
    ],
    actions: [
      { type: 'print', label: 'Print Document', enabled: true },
      { type: 'email', label: 'Email Customer', enabled: true },
      { type: 'download_pdf', label: 'Download PDF', enabled: true },
    ],
  },
  PURCHASE: {
    rules: [
      { id: 'require_approval', label: 'Require Approval Workflow', enabled: true },
      { id: 'update_inventory', label: 'Auto-Update Stock', enabled: true },
      { id: 'match_invoice_to_grn', label: 'Three-Way Match', enabled: false },
    ],
    actions: [
      { type: 'print', label: 'Print Document', enabled: true },
      { type: 'email', label: 'Email Vendor', enabled: true },
      { type: 'download_pdf', label: 'Download PDF', enabled: true },
    ],
  },
} as const;

const SYSTEM_FIELDS_GENERIC = [
  { id: 'documentId', label: 'Document Number', type: 'text' as const, category: 'systemMetadata' as const, autoManaged: true, sectionHint: 'HEADER' as const },
  { id: 'status', label: 'Status', type: 'text' as const, category: 'systemMetadata' as const, autoManaged: true, sectionHint: 'HEADER' as const },
  { id: 'createdAt', label: 'Creation Date', type: 'date' as const, category: 'systemMetadata' as const, autoManaged: true, sectionHint: 'HEADER' as const },
  { id: 'createdBy', label: 'Created By', type: 'text' as const, category: 'systemMetadata' as const, autoManaged: true, sectionHint: 'HEADER' as const },
  { id: 'subtotalDoc', label: 'Subtotal (Doc)', type: 'amount' as const, category: 'systemMetadata' as const, autoManaged: true, sectionHint: 'FOOTER' as const },
  { id: 'taxTotalDoc', label: 'Tax Total (Doc)', type: 'amount' as const, category: 'systemMetadata' as const, autoManaged: true, sectionHint: 'FOOTER' as const },
  { id: 'grandTotalDoc', label: 'Grand Total (Doc)', type: 'amount' as const, category: 'systemMetadata' as const, autoManaged: true, sectionHint: 'FOOTER' as const },
  { id: 'lineItems', label: 'Line Items Table', type: 'table' as const, category: 'core' as const, mandatory: true, sectionHint: 'BODY' as const },
];

const AVAILABLE_FIELDS_BY_MODULE: Record<string, AvailableField[]> = {
  ACCOUNTING: [
    { id: 'date', label: 'Voucher Date', type: 'date', sectionHint: 'HEADER', category: 'core', mandatory: true },
    { id: 'payee', label: 'Payee / Customer', type: 'text', sectionHint: 'HEADER', category: 'shared' },
    { id: 'reference', label: 'Reference Doc', type: 'text', sectionHint: 'HEADER', category: 'shared' },
    { id: 'description', label: 'Description', type: 'text', sectionHint: 'HEADER', category: 'core' },
    { id: 'currency', label: 'Currency', type: 'select', sectionHint: 'HEADER', category: 'core', mandatory: true },
    { id: 'exchangeRate', label: 'Exchange Rate', type: 'number', sectionHint: 'HEADER', category: 'shared', supportedTypes: ['payment_voucher', 'receipt_voucher', 'transfer_voucher'] },
    { id: 'paymentMethod', label: 'Payment Method', type: 'select', sectionHint: 'HEADER', category: 'shared', supportedTypes: ['payment_voucher'] },
    { id: 'branch', label: 'Branch / Dept', type: 'select', sectionHint: 'HEADER', category: 'shared' },
    { id: 'currencyExchange', label: 'Exchange Rate (Smart)', type: 'number', sectionHint: 'HEADER', category: 'shared' },
    { id: 'account', label: 'Account (Header)', type: 'account-selector', sectionHint: 'HEADER', category: 'shared' },
    { id: 'costCenter', label: 'Cost Center (Header)', type: 'cost-center-selector', sectionHint: 'HEADER', category: 'shared' },
    { id: 'lineItems', label: 'Line Items Table', type: 'table', sectionHint: 'BODY', category: 'core', mandatory: true },
    { id: 'notes', label: 'Internal Notes', type: 'textarea', sectionHint: 'EXTRA', category: 'shared' },
    { id: 'attachments', label: 'Attachments', type: 'text', sectionHint: 'EXTRA', category: 'shared' },
  ],
  SALES: [
    { id: 'invoiceDate', label: 'Invoice Date', type: 'date', sectionHint: 'HEADER', category: 'core', mandatory: true },
    { id: 'deliveryDate', label: 'Delivery Date', type: 'date', sectionHint: 'HEADER', category: 'core', mandatory: true },
    { id: 'returnDate', label: 'Return Date', type: 'date', sectionHint: 'HEADER', category: 'core', mandatory: true },
    { id: 'customerId', label: 'Customer', type: 'party-selector', sectionHint: 'HEADER', category: 'core', mandatory: true },
    { id: 'warehouseId', label: 'Warehouse', type: 'warehouse-selector', sectionHint: 'HEADER', category: 'core' },
    { id: 'currency', label: 'Currency', type: 'select', sectionHint: 'HEADER', category: 'core', mandatory: true },
    { id: 'exchangeRate', label: 'Exchange Rate', type: 'number', sectionHint: 'HEADER', category: 'core', mandatory: true },
    { id: 'totalAmount', label: 'Total Amount', type: 'number', sectionHint: 'HEADER', category: 'shared' },
    { id: 'salesOrderId', label: 'Sales Order Ref', type: 'select', sectionHint: 'HEADER', category: 'shared' },
    { id: 'deliveryNoteId', label: 'Delivery Note Ref', type: 'select', sectionHint: 'HEADER', category: 'shared' },
    { id: 'salesInvoiceId', label: 'Sales Invoice Ref', type: 'select', sectionHint: 'HEADER', category: 'shared' },
    { id: 'reason', label: 'Reason', type: 'text', sectionHint: 'HEADER', category: 'core' },
    { id: 'notes', label: 'Notes', type: 'textarea', sectionHint: 'HEADER', category: 'shared' },
    { id: 'lineItems', label: 'Line Items Table', type: 'table', sectionHint: 'BODY', category: 'core', mandatory: true },
  ],
  PURCHASE: [
    { id: 'invoiceDate', label: 'Invoice Date', type: 'date', sectionHint: 'HEADER', category: 'core', mandatory: true },
    { id: 'orderDate', label: 'Order Date', type: 'date', sectionHint: 'HEADER', category: 'core', mandatory: true },
    { id: 'expectedDeliveryDate', label: 'Expected Delivery Date', type: 'date', sectionHint: 'HEADER', category: 'shared' },
    { id: 'vendorId', label: 'Vendor', type: 'vendor-account-selector', sectionHint: 'HEADER', category: 'core', mandatory: true },
    { id: 'warehouseId', label: 'Default Warehouse', type: 'warehouse-selector', sectionHint: 'HEADER', category: 'shared' },
    { id: 'currency', label: 'Currency', type: 'select', sectionHint: 'HEADER', category: 'core', mandatory: true },
    { id: 'exchangeRate', label: 'Exchange Rate', type: 'number', sectionHint: 'HEADER', category: 'core', mandatory: true },
    { id: 'totalAmount', label: 'Total Amount', type: 'number', sectionHint: 'HEADER', category: 'shared' },
    { id: 'purchaseOrderId', label: 'Purchase Order Ref', type: 'select', sectionHint: 'HEADER', category: 'shared' },
    { id: 'goodsReceiptId', label: 'Goods Receipt Ref', type: 'select', sectionHint: 'HEADER', category: 'shared' },
    { id: 'notes', label: 'Notes', type: 'textarea', sectionHint: 'HEADER', category: 'shared' },
    { id: 'internalNotes', label: 'Internal Notes', type: 'textarea', sectionHint: 'HEADER', category: 'shared' },
    { id: 'lineItems', label: 'Line Items Table', type: 'table', sectionHint: 'BODY', category: 'core', mandatory: true },
  ],
};

const AVAILABLE_TABLE_COLUMNS_BY_MODULE: Record<string, any[]> = {
  ACCOUNTING: [
    { id: 'account', label: 'Account' },
    { id: 'debit', label: 'Debit' },
    { id: 'credit', label: 'Credit' },
    { id: 'costCenterId', label: 'Cost Center' },
    { id: 'notes', label: 'Notes' },
    { id: 'currency', label: 'Currency' },
    { id: 'parity', label: 'Parity' },
    { id: 'equivalent', label: 'Equivalent' },
    { id: 'category', label: 'Category' },
  ],
  SALES: [
    { id: 'itemId', label: 'Item' },
    { id: 'soLineId', label: 'SO Line' },
    { id: 'dnLineId', label: 'DN Line' },
    { id: 'siLineId', label: 'Invoice Line' },
    { id: 'warehouseId', label: 'Warehouse' },
    { id: 'deliveredQty', label: 'Delivered Quantity' },
    { id: 'returnQty', label: 'Return Quantity' },
    { id: 'invoicedQty', label: 'Invoiced Quantity' },
    { id: 'uom', label: 'UOM' },
    { id: 'unitPriceDoc', label: 'Unit Price' },
    { id: 'taxCodeId', label: 'Tax Code' },
    { id: 'lineTotal', label: 'Line Total' },
    { id: 'description', label: 'Description' },
  ],
  PURCHASE: [
    { id: 'itemId', label: 'Item' },
    { id: 'orderedQty', label: 'Ordered Quantity' },
    { id: 'invoicedQty', label: 'Invoiced Quantity' },
    { id: 'poLineId', label: 'PO Line' },
    { id: 'grnLineId', label: 'GRN Line' },
    { id: 'warehouseId', label: 'Warehouse' },
    { id: 'uom', label: 'UOM' },
    { id: 'unitPriceDoc', label: 'Unit Price' },
    { id: 'taxCodeId', label: 'Tax Code' },
    { id: 'lineTotal', label: 'Line Total' },
    { id: 'description', label: 'Description' },
  ],
};

const normalizeFieldId = (field: any): string =>
  String(field?.fieldId || field?.id || field?.name || field || '').trim();

const toBodyFallback = (column: any): AvailableField => ({
  id: normalizeFieldId(column),
  label: column?.label || column?.labelOverride || normalizeFieldId(column),
  type: column?.type,
  sectionHint: 'BODY',
  category: 'shared',
  mandatory: Boolean(column?.mandatory || column?.required),
  autoManaged: Boolean(column?.autoManaged),
  supportedTypes: column?.supportedTypes,
  excludedTypes: column?.excludedTypes,
});

const legacyDesignerFieldCatalog = (module: VoucherTypeModule): DesignerFieldCatalog => ({
  systemFields: SYSTEM_FIELDS_GENERIC as AvailableField[],
  availableFields: (AVAILABLE_FIELDS_BY_MODULE[module] || []).filter(
    (field) => field.sectionHint !== 'BODY'
      && !SYSTEM_FIELDS_GENERIC.some((systemField) => systemField.id === field.id),
  ),
  availableTableColumns: (AVAILABLE_TABLE_COLUMNS_BY_MODULE[module] || []).map(toBodyFallback),
  source: 'legacy',
});

const categoryForFieldClass = (fieldClass: FieldLibraryEntry['fieldClass']): AvailableField['category'] => {
  if (fieldClass === 'computed') return 'systemMetadata';
  if (fieldClass === 'system_core') return 'core';
  return 'shared';
};

const hydrateField = (
  entry: FieldLibraryEntry | undefined,
  fallback: AvailableField | undefined,
  defaultSection: AvailableField['sectionHint'],
  options: { preserveFallbackMandatory?: boolean; preserveLibraryMandatory?: boolean } = {},
): AvailableField => {
  const id = entry?.id || fallback?.id || '';
  const hasFallback = Boolean(fallback);
  const mandatoryFromFallback = options.preserveFallbackMandatory && Boolean(fallback?.mandatory);
  const mandatoryFromLibrary = options.preserveLibraryMandatory
    && Boolean(entry?.alwaysMandatory || entry?.fieldClass === 'system_core');

  return {
    id,
    label: entry?.label || fallback?.label || id,
    type: (entry?.type || fallback?.type || 'text') as AvailableField['type'],
    sectionHint: fallback?.sectionHint || entry?.sectionHint || defaultSection,
    category: hasFallback ? fallback?.category : categoryForFieldClass(entry?.fieldClass || 'system_optional'),
    mandatory: mandatoryFromFallback || (!hasFallback && mandatoryFromLibrary),
    autoManaged: hasFallback ? Boolean(fallback?.autoManaged) : entry?.fieldClass === 'computed',
    supportedTypes: fallback?.supportedTypes ?? entry?.supportedTypes,
    excludedTypes: fallback?.excludedTypes ?? entry?.excludedTypes,
    ...(entry ? {
      fieldLibraryVersion: entry.version,
      deprecated: entry.deprecated,
      selectorBinding: entry.selectorBinding,
    } : {}),
  } as AvailableField;
};

const addFieldIds = (target: Set<string>, fields: any[] | undefined) => {
  if (!Array.isArray(fields)) return;
  for (const field of fields) {
    const id = normalizeFieldId(field);
    if (id && !id.startsWith('action_')) target.add(id);
  }
};

const addLayoutFieldIds = (headerTarget: Set<string>, lineTarget: Set<string>, uiModeOverrides: any) => {
  if (!uiModeOverrides) return;
  Object.values(uiModeOverrides).forEach((mode: any) => {
    Object.entries(mode?.sections || {}).forEach(([sectionKey, section]: [string, any]) => {
      addFieldIds(sectionKey === 'BODY' ? lineTarget : headerTarget, section?.fields);
    });
  });
};

const buildDesignerFieldCatalog = (
  module: VoucherTypeModule,
  fieldLibrary: ResolvedFieldLibrary | null,
  forms: DocumentFormConfig[],
  systemCatalog: any[],
): DesignerFieldCatalog => {
  const legacy = legacyDesignerFieldCatalog(module);
  if (!fieldLibrary?.entries?.length) return legacy;

  const entriesById = new Map(fieldLibrary.entries.map((entry) => [entry.id, entry]));
  const systemFallbackById = new Map(legacy.systemFields.map((field) => [field.id, field]));
  const headerFallbackById = new Map(legacy.availableFields.map((field) => [field.id, field]));
  const lineFallbackById = new Map(legacy.availableTableColumns.map((field) => [field.id, field]));

  const systemIds = new Set(legacy.systemFields.map((field) => field.id));
  const headerIds = new Set(legacy.availableFields.map((field) => field.id));
  const lineIds = new Set(legacy.availableTableColumns.map((field) => field.id));

  for (const template of systemCatalog) {
    addFieldIds(headerIds, template?.headerFields);
    addFieldIds(lineIds, template?.lineFields);
    addFieldIds(lineIds, template?.tableColumns);
  }

  for (const form of forms) {
    addFieldIds(headerIds, (form as any).headerFields);
    addFieldIds(lineIds, (form as any).lineFields);
    addFieldIds(lineIds, (form as any).tableColumns);
    addLayoutFieldIds(headerIds, lineIds, (form as any).uiModeOverrides);
  }

  for (const entry of fieldLibrary.entries) {
    if (entry.fieldClass === 'custom_metadata') {
      if (entry.sectionHint === 'BODY') lineIds.add(entry.id);
      else headerIds.add(entry.id);
    }
  }
  for (const systemId of systemIds) {
    lineIds.delete(systemId);
  }

  const makeFields = (
    ids: Set<string>,
    fallbackById: Map<string, AvailableField>,
    defaultSection: AvailableField['sectionHint'],
    options?: { preserveFallbackMandatory?: boolean; preserveLibraryMandatory?: boolean },
  ): AvailableField[] =>
    Array.from(ids)
      .filter(Boolean)
      .map((id) => hydrateField(entriesById.get(id), fallbackById.get(id), defaultSection, options))
      .filter((field) => field.id);

  return {
    systemFields: makeFields(systemIds, systemFallbackById, 'HEADER', {
      preserveFallbackMandatory: true,
    }),
    availableFields: makeFields(headerIds, headerFallbackById, 'HEADER'),
    availableTableColumns: makeFields(lineIds, lineFallbackById, 'BODY'),
    source: 'field-library',
  };
};

const scopeDesignerFieldCatalogForForm = (
  fieldCatalog: DesignerFieldCatalog,
  form: DocumentFormConfig | null,
  catalog: any[],
): DesignerFieldCatalog => {
  if (!form) return fieldCatalog;

  const headerIds = new Set<string>();
  const lineIds = new Set<string>();
  addFieldIds(headerIds, (form as any).headerFields);
  addFieldIds(lineIds, (form as any).lineFields);
  addFieldIds(lineIds, (form as any).tableColumns);
  addLayoutFieldIds(headerIds, lineIds, (form as any).uiModeOverrides);

  const formKeys = new Set(
    [
      (form as any).formType,
      (form as any).baseType,
      (form as any).code,
      (form as any).id,
    ]
      .filter(Boolean)
      .map((value) => String(value).toLowerCase()),
  );
  const matchingTemplate = catalog.find((template) =>
    [template?.code, template?.id].some((value) => value && formKeys.has(String(value).toLowerCase())),
  );
  if (matchingTemplate) {
    addFieldIds(headerIds, matchingTemplate.headerFields);
    addFieldIds(lineIds, matchingTemplate.lineFields);
    addFieldIds(lineIds, matchingTemplate.tableColumns);
    addFieldIds(lineIds, matchingTemplate.layout?.lineFields);
  }

  return {
    ...fieldCatalog,
    availableFields: fieldCatalog.availableFields
      .filter((field) => headerIds.has(field.id))
      .map((field) =>
        isDirectSalesInvoiceForm(form) && field.id === 'warehouseId'
          ? { ...field, mandatory: true, category: 'core' }
          : field,
      ),
    availableTableColumns: fieldCatalog.availableTableColumns.filter((field) => lineIds.has(field.id)),
  };
};

const isDirectSalesInvoiceForm = (form: DocumentFormConfig | null | undefined): boolean => {
  if (!form) return false;
  return [
    (form as any).formType,
    (form as any).baseType,
    (form as any).code,
    (form as any).id,
    (form as any).persona,
  ]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase())
    .some((value) => value === 'sales_invoice_direct' || value === 'direct');
};

const normalizeFormTemplateForDesigner = (form: DocumentFormConfig | null): DocumentFormConfig | null => {
  if (!form || !isDirectSalesInvoiceForm(form)) return form;

  const removeWarehouseLine = (fields: any[] | undefined) =>
    Array.isArray(fields)
      ? fields.filter((field) => (field?.id || field?.name || field?.fieldId) !== 'warehouseId')
      : fields;
  const requireHeaderWarehouse = (fields: any[] | undefined) =>
    Array.isArray(fields)
      ? fields.map((field) =>
          (field?.id || field?.name || field?.fieldId) === 'warehouseId'
            ? { ...field, required: true, mandatory: true, category: 'core' }
            : field,
        )
      : fields;

  return {
    ...form,
    headerFields: requireHeaderWarehouse((form as any).headerFields),
    tableColumns: removeWarehouseLine((form as any).tableColumns),
    lineFields: removeWarehouseLine((form as any).lineFields),
    uiModeOverrides: {
      ...((form as any).uiModeOverrides || {}),
      tableColumns: removeWarehouseLine((form as any).uiModeOverrides?.tableColumns),
      lineFields: removeWarehouseLine((form as any).uiModeOverrides?.lineFields),
    },
    layout: {
      ...((form as any).layout || {}),
      lineFields: removeWarehouseLine((form as any).layout?.lineFields),
    },
  } as DocumentFormConfig;
};

const VoucherDesignerPage: React.FC<VoucherDesignerPageProps> = ({ module, moduleLabel }) => {
  const { companyId } = useCompanyAccess();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [forms, setForms] = useState<DocumentFormConfig[]>([]);
  const [formSettings, setFormSettings] = useState<FormSettingsRecord[]>([]);
  const [definitions, setDefinitions] = useState<any[]>([]);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [fieldCatalog, setFieldCatalog] = useState<DesignerFieldCatalog>(() =>
    legacyDesignerFieldCatalog(module),
  );
  const [loading, setLoading] = useState(true);
  const [installingTypeKey, setInstallingTypeKey] = useState<string | null>(null);
  const [expandedTypeKeys, setExpandedTypeKeys] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'list' | 'designer'>('list');
  const [editingForm, setEditingForm] = useState<DocumentFormConfig | null>(null);
  const [settingsForm, setSettingsForm] = useState<DocumentFormConfig | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);

  // Page instructions content — lives next to the page rather than in a
  // central registry because it's tightly bound to this UI's specific
  // behaviour (Install / Clone / Activate / Sidebar Group). Memoised so the
  // module label flows through without re-allocating on every render.
  const instructions = useMemo<PageInstructions>(() => ({
    pageId: `forms-management-${module.toLowerCase()}`,
    title: `Forms Management — ${moduleLabel}`,
    overview:
      `Every document the ${moduleLabel} module produces (invoices, orders, receipts, ` +
      `journals…) is rendered from a Form. A Form belongs to a Voucher Type, which is ` +
      `the business concept (e.g. "Sales Invoice"). This page is where you install ` +
      `the types you actually need, choose which form variants are visible to your ` +
      `team, and customise the layout when the defaults aren't quite right.`,
    sections: [
      {
        title: 'Install a Voucher Type',
        content:
          `Anything in the **Available Types** section at the bottom is in the system ` +
          `catalog but not yet in your company. Click **Install** to copy its default ` +
          `form variants into your company catalog.\n\n` +
          `• Newly installed forms are **locked** and **inactive** — they won't appear ` +
          `in the sidebar yet.\n` +
          `• Locked means the layout / fields / rules are protected from edits, so the ` +
          `accounting engine can rely on them.`,
        tip: 'Install a type even if you only need one of its variants — you can leave the others inactive.',
      },
      {
        title: 'Activate / Deactivate a Form',
        content:
          `Flip the green **Active** toggle on any form row to expose it in the ` +
          `sidebar. The change is immediate — the sidebar refreshes on save and the ` +
          `form becomes available to anyone with the right permission.\n\n` +
          `• You can toggle locked default forms freely — activation is a company ` +
          `preference, not a design change.\n` +
          `• Deactivate a form to hide it from the sidebar without deleting it.`,
      },
      {
        title: 'Clone or Add a Custom Form',
        content:
          `Locked defaults can't be edited directly. To customise one, click the **+** ` +
          `(Clone) icon on its row — you get an editable copy with a suggested ID and ` +
          `Prefix you can override. The clone is unlocked and lives alongside the ` +
          `locked original.\n\n` +
          `Use **Add Custom Form** at the bottom of a type's expanded list to start a ` +
          `new variant from the first installed form's defaults.`,
        tip: 'IDs and prefixes are checked for uniqueness inside your company before save.',
      },
      {
        title: 'Sidebar Group',
        content:
          `Open the **⋮ kebab menu** on a form row → **Sidebar Group** to choose which ` +
          `submenu the form lives under in the sidebar. New forms default to ` +
          `**Documents**.\n\n` +
          `• Pick one of the preset chips (Documents, Vouchers, Reports, Operations) or ` +
          `type any custom name — a new top-level group appears for it.\n` +
          `• Locked default forms can be re-grouped freely; it's an organisational ` +
          `preference, not a design change.`,
      },
      {
        title: 'Export & Schema',
        content:
          `**Export JSON** on the kebab menu downloads the form's full config as JSON ` +
          `— useful for moving a customised form between companies or attaching to a ` +
          `support ticket.\n\n` +
          `**View Schema** is reserved for an upcoming read-only schema viewer.`,
      },
    ],
    footerWarnings: [
      'Locked default forms install as inactive on purpose — review them before activating so your team doesn\'t see incomplete defaults.',
      'Deleting a form that already has documents posted against it will be blocked at the backend; deactivate it instead.',
    ],
  }), [module, moduleLabel]);

  const reload = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const fieldLibraryPromise = fieldLibraryApi.list().catch((fieldLibraryError) => {
        console.warn('[VoucherDesigner] Field Library load failed; using legacy field catalog:', fieldLibraryError);
        return null;
      });
      const [loadedForms, loadedDefs, loadedCatalog, loadedFieldLibrary] = await Promise.all([
        loadModuleDocumentForms(companyId, module),
        loadModuleDocumentDefinitions(companyId, module),
        loadSystemVoucherTemplates(module),
        fieldLibraryPromise,
      ]);
      const loadedSettings = await voucherFormApi.listSettings(module).catch((settingsError) => {
        console.warn('[VoucherDesigner] Form settings load failed:', settingsError);
        return [];
      });
      setForms(loadedForms);
      setFormSettings(loadedSettings);
      setDefinitions(loadedDefs);
      setCatalog(loadedCatalog);
      setFieldCatalog(buildDesignerFieldCatalog(module, loadedFieldLibrary, loadedForms, loadedCatalog));
    } catch (err: any) {
      console.error('[VoucherDesigner] Load failed', err);
      errorHandler.showError('Could not load voucher designer data');
    } finally {
      setLoading(false);
    }
  }, [companyId, module]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const displayedForms = useMemo(
    () => [...BUILT_IN_FORMS_BY_MODULE[module], ...forms] as DocumentFormConfig[],
    [forms, module],
  );

  const settingsById = useMemo(() => {
    const map = new Map<string, FormSettingsRecord>();
    formSettings.forEach((record) => {
      if (record.formId) map.set(`form:${record.formId}`, record);
      if (record.builtInFormKey) map.set(`native:${record.builtInFormKey}`, record);
    });
    return map;
  }, [formSettings]);

  const { installed, available } = useMemo(
    () => buildTypeTree(displayedForms, definitions, catalog),
    [displayedForms, definitions, catalog],
  );

  // Distinct sidebarGroups already in use across this company's forms, plus
  // canonical seeds. Surfaced as a <datalist> in the kebab Sidebar Group
  // editor so the user picks from real values instead of chip-style presets.
  // `Default Forms` is intentionally excluded — defaults always force to that
  // group at render time, so it's not a valid user choice on a clone.
  const availableSidebarGroups = useMemo(() => {
    const set = new Set<string>(['Forms', 'Vouchers', 'Reports', 'Operations']);
    forms.forEach((f) => {
      const g = (f as any).sidebarGroup;
      if (typeof g === 'string' && g.trim()) set.add(g.trim());
    });
    set.delete('Default Forms');
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [forms]);

  const editorFieldCatalog = useMemo(
    () => scopeDesignerFieldCatalogForForm(fieldCatalog, editingForm, catalog),
    [fieldCatalog, editingForm, catalog],
  );

  // Auto-expand the first installed type on first load so user sees the
  // tree pattern without having to click. Toggled by user thereafter.
  useEffect(() => {
    if (installed.length > 0 && expandedTypeKeys.size === 0) {
      setExpandedTypeKeys(new Set([installed[0].typeKey]));
    }
  }, [installed, expandedTypeKeys.size]);

  const toggleExpand = (typeKey: string) => {
    setExpandedTypeKeys((prev) => {
      const next = new Set(prev);
      if (next.has(typeKey)) next.delete(typeKey);
      else next.add(typeKey);
      return next;
    });
  };

  /**
   * Assign (or clear) the sidebar submenu group for a form. Routed through
   * the backend metadata update — same authorization path the toggle uses,
   * so the Firestore rules don't block it. After it lands, refresh the
   * sidebar so the form moves to the new group immediately.
   */
  const handleUpdateSidebarGroup = async (formId: string, sidebarGroup: string | null) => {
    if (!companyId || !user) return;
    const previous = forms.find((f) => f.id === formId);
    setForms((prev) => prev.map((f) => (f.id === formId ? ({ ...f, sidebarGroup } as any) : f)));
    const result = await updateFormMetadata(
      companyId,
      module,
      formId,
      { sidebarGroup },
      user.uid,
    );
    if (!result.success) {
      // Rollback the optimistic update
      setForms((prev) =>
        prev.map((f) => (f.id === formId ? ({ ...f, sidebarGroup: (previous as any)?.sidebarGroup ?? null } as any) : f)),
      );
      errorHandler.showError(result.errors?.[0] || 'Failed to update sidebar group');
      return;
    }
    errorHandler.showInfo(
      sidebarGroup ? `Moved to "${sidebarGroup}" group.` : 'Removed from sidebar group.',
    );
    emitCompanyModulesRefresh({ companyId, moduleCode: module.toLowerCase() });
    await queryClient.invalidateQueries({ queryKey: ['companyModules', companyId] });
  };

  const identityForForm = (form: DocumentFormConfig): FormSettingsIdentity => {
    const isBuiltInNative = Boolean((form as any).isBuiltInNative);
    const documentKind = String((form as any).documentKind || (form as any).voucherType || (form as any).formType || form.code || form.id);
    return {
      module,
      documentKind,
      formKind: isBuiltInNative
        ? 'BUILT_IN_NATIVE'
        : ((form as any).isDefault || (form as any).isSystemGenerated || (form as any).isLocked)
          ? 'DESIGNER_DEFAULT'
          : 'DESIGNER_CLONE',
      formId: isBuiltInNative ? null : form.id,
      builtInFormKey: isBuiltInNative ? (form as any).builtInFormKey || form.id : null,
    };
  };

  const settingsForForm = (form: DocumentFormConfig): FormSettingsRecord | null => {
    const identity = identityForForm(form);
    const key = identity.formKind === 'BUILT_IN_NATIVE'
      ? `native:${identity.builtInFormKey}`
      : `form:${identity.formId}`;
    return settingsById.get(key) || null;
  };

  const handleSaveFormSettings = async (form: DocumentFormConfig, settings: FormSettingsValue) => {
    const saved = await voucherFormApi.saveSettings(identityForForm(form), settings);
    setFormSettings((prev) => {
      const filtered = prev.filter((record) => record.id !== saved.id);
      return [...filtered, saved];
    });
    errorHandler.showInfo('Form settings saved.');
  };

  /** Trigger a browser download of the form config as JSON. */
  const handleExportJson = (form: DocumentFormConfig) => {
    const dataStr =
      'data:text/json;charset=utf-8,' +
      encodeURIComponent(JSON.stringify([form], null, 2));
    const a = document.createElement('a');
    a.setAttribute('href', dataStr);
    a.setAttribute('download', `voucher_form_${form.id}.json`);
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleToggleEnabled = async (formId: string, enabled: boolean) => {
    if (!companyId || !user) return;
    setForms((prev) => prev.map((f) => (f.id === formId ? { ...f, enabled } : f)));
    const result = await updateFormMetadata(companyId, module, formId, { enabled }, user.uid);
    if (!result.success) {
      // Rollback
      setForms((prev) => prev.map((f) => (f.id === formId ? { ...f, enabled: !enabled } : f)));
      errorHandler.showError(result.errors?.[0] || 'Failed to update form status');
      return;
    }
    errorHandler.showInfo(`Form ${enabled ? 'activated' : 'deactivated'}.`);
    // Refresh sidebar so the form appears/disappears immediately.
    emitCompanyModulesRefresh({ companyId, moduleCode: module.toLowerCase() });
    await queryClient.invalidateQueries({ queryKey: ['companyModules', companyId] });
  };

  const handleInstallType = async (node: TypeNode) => {
    setInstallingTypeKey(node.typeKey);
    try {
      const templateIds = node.catalogVariants.map((v) => v.id);
      const result = await voucherTypeManagementApi.install(module, templateIds);
      const total = result.formsCreated + result.formsUpdated;
      errorHandler.showInfo(
        `Installed "${node.name}" — ${total} default form${total !== 1 ? 's' : ''} added as locked, inactive.`,
      );
      emitCompanyModulesRefresh({ companyId, moduleCode: module.toLowerCase() });
      await queryClient.invalidateQueries({ queryKey: ['companyModules', companyId] });
      await reload();
      setExpandedTypeKeys((prev) => new Set(prev).add(node.typeKey));
    } catch (err: any) {
      console.error('[VoucherDesigner] Install failed', err);
      errorHandler.showError(err?.response?.data?.error || err?.message || 'Install failed');
    } finally {
      setInstallingTypeKey(null);
    }
  };

  const openEditor = (form: DocumentFormConfig | null) => {
    setEditingForm(normalizeFormTemplateForDesigner(form));
    setViewMode('designer');
  };

  /**
   * Build a suggested ID + Prefix for a new form derived from `seed`.
   * Mirrors the legacy global Forms Designer:
   *   - parentPrefix = letters from the seed's prefix (e.g. "JE-" -> "JE")
   *   - id           = `${parentPrefix}_${timestamp}_${suffix}` (suggested,
   *                    user can override in Step 2)
   *   - prefix       = `${parentPrefix}${suffix}-`
   * The user can override both in the wizard; uniqueness is checked against
   * the in-memory `existingForms` list (see DocumentDesigner step 2).
   */
  const buildSuggestedIdentity = (
    seed: DocumentFormConfig,
    suffix: 'C' | 'N',
  ): { id: string; prefix: string; originalFormType: string; parentPrefix: string } => {
    const timestamp = Date.now();
    const originalFormType =
      (seed as any).formType || (seed as any).baseType || seed.code || seed.id;
    const parentPrefix =
      ((seed.prefix || '').replace('-', '').replace(/[^A-Z]/g, '') || 'FORM').slice(0, 6);
    return {
      id: `${parentPrefix}_${timestamp}_${suffix}`,
      prefix: `${parentPrefix}${suffix}-`,
      originalFormType,
      parentPrefix,
    };
  };

  const handleClone = (form: DocumentFormConfig) => {
    // Port of the legacy Forms Designer's clone rules. We pre-fill a
    // suggested id + prefix so the user has sensible defaults but stays in
    // control — DocumentDesigner step 2 leaves both fields editable when the
    // `__isClone` sentinel is set, and uniqueness validates against the
    // company's current forms before advancing. The sentinel is stripped
    // before saveDocumentForm sends the payload.
    const suggested = buildSuggestedIdentity(form, 'C');
    const cloned: DocumentFormConfig = {
      ...form,
      id: suggested.id,
      name: `${form.name} - Copy`,
      prefix: suggested.prefix,
      isSystemDefault: false,
      isLocked: false,
      isDefault: false,
      isSystemGenerated: false,
      enabled: true,
      formType: suggested.originalFormType,
      voucherType: (form as any).voucherType,
      persona: (form as any).persona,
      baseType: suggested.originalFormType,
      sidebarGroup: (form as any).sidebarGroup || null,
      module: (form as any).module || null,
      __isClone: true,
    } as any;
    openEditor(cloned);
  };

  const handleAddCustomForm = (node: TypeNode) => {
    // Start from the first installed (or catalog) variant so the user has
    // sensible field defaults; they can then customise freely. Same
    // suggested-id pattern as clone, with an `_N` (new) suffix so the
    // generated keys are visually distinguishable in the list.
    const seed = (node.forms[0] || node.catalogVariants[0]) as DocumentFormConfig | undefined;
    if (!seed) {
      openEditor(null);
      return;
    }
    const suggested = buildSuggestedIdentity(seed, 'N');
    const newForm: DocumentFormConfig = {
      ...(seed as any),
      id: suggested.id,
      name: `${node.name} (Custom)`,
      prefix: suggested.prefix,
      isSystemDefault: false,
      isLocked: false,
      isDefault: false,
      isSystemGenerated: false,
      enabled: false,
      formType: suggested.originalFormType,
      voucherType: (seed as any).voucherType,
      persona: (seed as any).persona,
      baseType: suggested.originalFormType,
      sidebarGroup: (seed as any).sidebarGroup || null,
      module: (seed as any).module || null,
      __isClone: true,
    } as any;
    openEditor(newForm);
  };

  const handleSaveAndExit = async (config: DocumentFormConfig) => {
    if (!companyId || !user) return;
    try {
      // A clone / "Add Custom Form" carries `__isClone: true` even though it
      // also has a (suggested) id. Treat those as CREATE, not UPDATE — using
      // editingForm.id alone would route them to the PUT endpoint and 404
      // because no form with that id exists yet. Strip the sentinel so it
      // never reaches the backend or Firestore.
      const isCloneFlow =
        !!(editingForm as any)?.__isClone || !!(config as any).__isClone;
      const isEdit = !!(editingForm as any)?.id && !isCloneFlow;

      const cleanConfig = {
        ...(normalizeFormTemplateForDesigner(config) || config),
      } as DocumentFormConfig & { __isClone?: boolean };
      delete (cleanConfig as any).__isClone;

      const result = await saveDocumentForm(
        companyId,
        module,
        cleanConfig,
        {
          systemFields: editorFieldCatalog.systemFields,
          availableFields: editorFieldCatalog.availableFields,
        },
        user.uid,
        isEdit,
      );
      if (result.success) {
        errorHandler.showInfo(`${cleanConfig.name} saved.`);
        await reload();
        setViewMode('list');
        setEditingForm(null);
        // Refresh the sidebar — a newly created form may need to show up
        // (or a renamed one needs its label updated).
        emitCompanyModulesRefresh({ companyId, moduleCode: module.toLowerCase() });
        await queryClient.invalidateQueries({ queryKey: ['companyModules', companyId] });
      } else {
        errorHandler.showError((result as any).errors?.[0] || 'Save failed');
      }
    } catch (err: any) {
      console.error('[VoucherDesigner] Save failed', err);
      errorHandler.showError('Save failed');
    }
  };

  const handleCancelEdit = () => {
    setViewMode('list');
    setEditingForm(null);
  };

  if (loading && forms.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <Spinner size="lg" />
        <span className="ml-3 text-slate-600">Loading {moduleLabel} forms management...</span>
      </div>
    );
  }

  return (
    <WizardProvider initialForms={forms}>
      {/* List view stays mounted; the editor opens as a modal overlay
          rather than replacing the page, so users keep their context. */}
      <div className="min-h-screen bg-gray-50 py-8">
          <div className="mx-auto max-w-5xl px-4">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-bold text-gray-900">
                  Forms Management &mdash; {moduleLabel}
                </h1>
                <button
                  type="button"
                  onClick={() => setShowInstructions(true)}
                  className="p-1.5 rounded-full text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                  title="What is this page for?"
                  aria-label="Open page instructions"
                >
                  <HelpCircle className="h-5 w-5" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => void reload()}
                className="text-sm text-slate-600 hover:text-slate-900 flex items-center gap-1"
                title="Refresh"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
            </div>

            {/* Installed Types */}
            <section className="mb-8">
              <div className="mb-3 flex items-center gap-2">
                <PackageCheck className="h-5 w-5 text-green-600" />
                <h2 className="text-xl font-semibold text-gray-900">
                  Installed Types ({installed.length})
                </h2>
              </div>
              {installed.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
                  <FileText className="mx-auto mb-3 h-10 w-10 text-gray-400" />
                  <p className="text-sm text-gray-600">
                    No voucher types installed yet. Pick one from Available below to install.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {installed.map((node) => (
                    <InstalledTypeRow
                      key={node.typeKey}
                      node={node}
                      expanded={expandedTypeKeys.has(node.typeKey)}
                      onToggle={() => toggleExpand(node.typeKey)}
                      onEditForm={openEditor}
                      onCloneForm={handleClone}
                      onToggleEnabled={handleToggleEnabled}
                      onAddCustomForm={() => handleAddCustomForm(node)}
                      onExportJson={handleExportJson}
                      onUpdateSidebarGroup={handleUpdateSidebarGroup}
                      availableSidebarGroups={availableSidebarGroups}
                      onOpenSettings={setSettingsForm}
                      getFormSettings={settingsForForm}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Available Types */}
            {available.length > 0 && (
              <section>
                <div className="mb-3 flex items-center gap-2">
                  <Layers className="h-5 w-5 text-blue-600" />
                  <h2 className="text-xl font-semibold text-gray-900">
                    Available Types ({available.length})
                  </h2>
                </div>
                <div className="space-y-2">
                  {available.map((node) => (
                    <AvailableTypeRow
                      key={node.typeKey}
                      node={node}
                      installing={installingTypeKey === node.typeKey}
                      onInstall={() => handleInstallType(node)}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>

      {/* Editor modal overlay — opens on Edit / Clone / Add Custom. Stays
          on top of the list (which keeps its scroll position underneath)
          so closing the editor lands the user right where they left off. */}
      {/* Page instructions slide-over — opens from the (?) icon next to the
          page title. Reuses the shared InstructionsModal so the look matches
          the rest of the ERP's contextual help. */}
      <InstructionsModal
        isOpen={showInstructions}
        onClose={() => setShowInstructions(false)}
        instructions={instructions}
      />

      {settingsForm && (
        <FormSettingsModal
          form={settingsForm}
          record={settingsForForm(settingsForm)}
          onClose={() => setSettingsForm(null)}
          onSave={(settings) => handleSaveFormSettings(settingsForm, settings)}
        />
      )}

      {viewMode === 'designer' && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onClick={(event) => {
            // Click on the backdrop (not the dialog) cancels the edit.
            if (event.target === event.currentTarget) handleCancelEdit();
          }}
        >
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden border border-slate-200">
            <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <span className="text-slate-800">Document Wizard</span>
                  <span className="text-gray-300 font-normal">/</span>
                  <span className="text-indigo-600">
                    {editingForm && (editingForm as any).id
                      ? editingForm.name
                      : editingForm
                        ? editingForm.name
                        : 'New Form'}
                  </span>
                </h2>
                <p className="text-xs text-slate-500">{moduleLabel} Forms Management</p>
              </div>
              <button
                type="button"
                onClick={handleCancelEdit}
                className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors"
                title="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </header>
            <div className="flex-1 overflow-auto">
              <DocumentDesigner
                initialConfig={editingForm}
                availableTemplates={forms}
                onSave={handleSaveAndExit}
                onCancel={handleCancelEdit}
                systemFields={editorFieldCatalog.systemFields}
                availableFields={editorFieldCatalog.availableFields}
                availableTableColumns={editorFieldCatalog.availableTableColumns}
                defaultRules={MODULE_DEFAULTS[module].rules as any}
                defaultActions={MODULE_DEFAULTS[module].actions as any}
                hideHeader={true}
              />
            </div>
          </div>
        </div>
      )}
    </WizardProvider>
  );
};

/* ----------------------------- Sub-components ----------------------------- */

interface InstalledTypeRowProps {
  node: TypeNode;
  expanded: boolean;
  onToggle: () => void;
  onEditForm: (form: DocumentFormConfig) => void;
  onCloneForm: (form: DocumentFormConfig) => void;
  onToggleEnabled: (formId: string, enabled: boolean) => void;
  onAddCustomForm: () => void;
  onExportJson: (form: DocumentFormConfig) => void;
  onUpdateSidebarGroup: (formId: string, sidebarGroup: string | null) => void;
  availableSidebarGroups: string[];
  onOpenSettings: (form: DocumentFormConfig) => void;
  getFormSettings: (form: DocumentFormConfig) => FormSettingsRecord | null;
}

const InstalledTypeRow: React.FC<InstalledTypeRowProps> = ({
  node,
  expanded,
  onToggle,
  onEditForm,
  onCloneForm,
  onToggleEnabled,
  onAddCustomForm,
  onExportJson,
  onUpdateSidebarGroup,
  availableSidebarGroups,
  onOpenSettings,
  getFormSettings,
}) => {
  const activeCount = node.forms.filter((f) => f.enabled !== false).length;
  const lockedCount = node.forms.filter((f) => (f as any).isLocked).length;
  const customCount = node.forms.length - lockedCount;

  return (
    // overflow-visible (not hidden) so the kebab menu on the last form row
    // can render outside the type-row card without being clipped.
    <div className="rounded-lg border border-gray-200 bg-white overflow-visible">
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left rounded-t-lg"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-slate-400" />
        ) : (
          <ChevronRight className="h-4 w-4 text-slate-400" />
        )}
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-semibold text-gray-900">{node.name}</h3>
            <span className="inline-flex items-center px-2 py-0.5 bg-slate-100 text-slate-700 text-xs font-medium rounded">
              {node.forms.length} form{node.forms.length !== 1 ? 's' : ''}
            </span>
            {activeCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded">
                <CheckCircle2 className="h-3 w-3" /> {activeCount} active
              </span>
            )}
            {customCount > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                {customCount} custom
              </span>
            )}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-100">
          {node.forms.map((form) => (
            <FormRow
              key={form.id}
              form={form}
              onEdit={() => onEditForm(form)}
              onClone={() => onCloneForm(form)}
              onToggleEnabled={(enabled) => onToggleEnabled(form.id, enabled)}
              onExportJson={() => onExportJson(form)}
              onUpdateSidebarGroup={(group) => onUpdateSidebarGroup(form.id, group)}
              availableSidebarGroups={availableSidebarGroups}
              onOpenSettings={() => onOpenSettings(form)}
              settingsRecord={getFormSettings(form)}
            />
          ))}
          <div className="border-t border-gray-100 px-4 py-2 bg-gray-50">
            <button
              type="button"
              onClick={onAddCustomForm}
              className="text-sm text-primary-600 font-medium hover:underline flex items-center gap-1"
            >
              <Plus className="h-4 w-4" />
              Add Custom Form
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

interface FormRowProps {
  form: DocumentFormConfig;
  onEdit: () => void;
  onClone: () => void;
  onToggleEnabled: (enabled: boolean) => void;
  onExportJson: () => void;
  onUpdateSidebarGroup: (sidebarGroup: string | null) => void;
  availableSidebarGroups: string[];
  onOpenSettings: () => void;
  settingsRecord: FormSettingsRecord | null;
}

const FormRow: React.FC<FormRowProps> = ({
  form,
  onEdit,
  onClone,
  onToggleEnabled,
  onExportJson,
  onUpdateSidebarGroup,
  availableSidebarGroups,
  onOpenSettings,
  settingsRecord,
}) => {
  const isLocked = (form as any).isLocked === true;
  const isEnabled = form.enabled !== false;
  const isBuiltInNative = Boolean((form as any).isBuiltInNative);
  const persona = variantLabel({ persona: (form as any).persona, name: form.name });
  const currentSidebarGroup: string | null = (form as any).sidebarGroup || null;
  const configuredPriceSource = settingsRecord?.settings?.pricingBehavior?.linePriceSource;

  const [showMenu, setShowMenu] = useState(false);
  const [showSidebarEditor, setShowSidebarEditor] = useState(false);
  const [sidebarInput, setSidebarInput] = useState<string>(currentSidebarGroup || '');
  const menuRef = useRef<HTMLDivElement>(null);

  // Close the menu (and the inline editor) when the user clicks outside it.
  useEffect(() => {
    if (!showMenu) return;
    const onClickAway = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
        setShowSidebarEditor(false);
      }
    };
    document.addEventListener('mousedown', onClickAway);
    return () => document.removeEventListener('mousedown', onClickAway);
  }, [showMenu]);

  const saveSidebarGroup = (value: string | null) => {
    onUpdateSidebarGroup(value);
    setShowSidebarEditor(false);
    setShowMenu(false);
  };

  return (
    <div className="px-4 py-2.5 flex items-center gap-3 hover:bg-gray-50/50 border-b border-gray-50 last:border-b-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-gray-900 truncate">{form.name}</span>
          {persona && (
            <span className="inline-flex items-center px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-medium rounded uppercase tracking-wide">
              {persona}
            </span>
          )}
          {isLocked && (
            <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 uppercase tracking-wide">
              <Lock className="h-3 w-3" /> {isBuiltInNative ? 'Built-in native' : 'Locked default'}
            </span>
          )}
          {configuredPriceSource && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-semibold rounded uppercase tracking-wide">
              <SlidersHorizontal className="h-3 w-3" /> {configuredPriceSource}
            </span>
          )}
          {currentSidebarGroup && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-purple-100 text-purple-700 text-[10px] font-semibold rounded uppercase tracking-wide">
              <FolderTree className="h-3 w-3" /> {currentSidebarGroup}
            </span>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => onToggleEnabled(!isEnabled)}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-all ${
          isEnabled ? 'bg-green-500' : 'bg-slate-300'
        }`}
        title={isEnabled ? 'Deactivate' : 'Activate'}
      >
        <span
          aria-hidden
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
            isEnabled ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        />
      </button>
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 w-11">
        {isEnabled ? 'Active' : 'Off'}
      </span>

      <button
        type="button"
        onClick={onOpenSettings}
        className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-colors"
        title="Form settings"
      >
        <Settings className="h-4 w-4" />
      </button>
      {!isBuiltInNative && (
        <>
          <button
            type="button"
            onClick={onClone}
            className="p-1.5 text-slate-500 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
            title="Clone (creates editable copy)"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
            title={isLocked ? 'View / restricted edit' : 'Edit'}
          >
            <Edit3 className="h-4 w-4" />
          </button>
        </>
      )}

      {/* Kebab menu: per-form secondary actions (Export, Schema, Sidebar Group).
          Sidebar Group is the live action — it routes through the backend
          metadata update so Firestore rules don't block it, then the page
          refreshes the sidebar so the form moves to its new group. */}
      {!isBuiltInNative && (
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setSidebarInput(currentSidebarGroup || '');
            setShowMenu((prev) => !prev);
            setShowSidebarEditor(false);
          }}
          className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
          title="More options"
        >
          <MoreVertical className="h-4 w-4" />
        </button>

        {showMenu && (
          <div className="absolute right-0 top-full mt-1 w-60 bg-white rounded-lg shadow-xl border border-slate-100 z-50 overflow-hidden text-slate-700">
            <div className="py-1">
              <button
                type="button"
                onClick={() => {
                  onExportJson();
                  setShowMenu(false);
                }}
                className="w-full text-left px-4 py-2 text-sm hover:bg-indigo-50 hover:text-indigo-600 flex items-center gap-2"
              >
                <Download className="h-3.5 w-3.5" /> Export JSON
              </button>
              <button
                type="button"
                onClick={() => setShowMenu(false)}
                className="w-full text-left px-4 py-2 text-sm text-slate-400 cursor-not-allowed flex items-center gap-2"
                title="Coming soon"
                disabled
              >
                <FileJson className="h-3.5 w-3.5" /> View Schema
              </button>
              <div className="border-t border-slate-100 mt-1 pt-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowSidebarEditor((prev) => !prev);
                  }}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-purple-50 hover:text-purple-600 flex items-center gap-2"
                >
                  <FolderTree className="h-3.5 w-3.5" /> Sidebar Group
                  {currentSidebarGroup && (
                    <span className="ml-auto text-[10px] bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded font-medium">
                      {currentSidebarGroup}
                    </span>
                  )}
                </button>

                {showSidebarEditor && (
                  <div className="px-3 pb-3 pt-1" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="text"
                      list={`sidebar-groups-${form.id}`}
                      value={sidebarInput}
                      onChange={(e) => setSidebarInput(e.target.value)}
                      placeholder="Type or pick a group…"
                      className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 mb-2 focus:ring-1 focus:ring-purple-500 outline-none"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          saveSidebarGroup(sidebarInput.trim() || null);
                        } else if (e.key === 'Escape') {
                          setShowSidebarEditor(false);
                        }
                      }}
                    />
                    <datalist id={`sidebar-groups-${form.id}`}>
                      {availableSidebarGroups.map((g) => (
                        <option key={g} value={g} />
                      ))}
                    </datalist>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => saveSidebarGroup(sidebarInput.trim() || null)}
                        className="flex-1 text-[10px] bg-purple-600 text-white px-2 py-1 rounded font-medium hover:bg-purple-700"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => saveSidebarGroup(null)}
                        className="text-[10px] text-slate-500 px-2 py-1 rounded border border-slate-200 hover:bg-slate-50"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      )}
    </div>
  );
};

interface FormSettingsModalProps {
  form: DocumentFormConfig;
  record: FormSettingsRecord | null;
  onClose: () => void;
  onSave: (settings: FormSettingsValue) => Promise<void>;
}

const PRICE_SOURCE_OPTIONS: Array<{ value: LinePriceSource; label: string; description: string }> = [
  { value: 'LAST_PARTY_PRICE', label: 'Last party price', description: 'Use this customer/vendor and item memory only.' },
  { value: 'PRICE_LIST', label: 'Price list', description: 'Use the assigned/default price list only.' },
  { value: 'LAST_EVENT', label: 'Last event', description: 'Use the last sale/purchase event for the item.' },
  { value: 'ITEM_DEFAULT', label: 'Item default', description: 'Use the item master default price/cost.' },
];

const FormSettingsModal: React.FC<FormSettingsModalProps> = ({ form, record, onClose, onSave }) => {
  const [activeTab, setActiveTab] = useState<'accountDefaults' | 'pricingBehavior'>('accountDefaults');
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<FormSettingsValue>(() => ({
    accountDefaults: {
      defaultWarehouseId: record?.settings?.accountDefaults?.defaultWarehouseId || null,
      defaultCashAccountId: record?.settings?.accountDefaults?.defaultCashAccountId || null,
      defaultCostCenterId: record?.settings?.accountDefaults?.defaultCostCenterId || null,
    },
    pricingBehavior: {
      linePriceSource: record?.settings?.pricingBehavior?.linePriceSource || null,
    },
  }));

  const tabs = [
    { id: 'accountDefaults' as const, label: 'Account Defaults' },
    { id: 'pricingBehavior' as const, label: 'Pricing Behavior' },
  ];

  const save = async () => {
    setSaving(true);
    try {
      await onSave(settings);
      onClose();
    } catch (err: any) {
      errorHandler.showError(err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Failed to save form settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="flex h-[620px] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Form Settings</h2>
            <p className="text-xs text-slate-500">{form.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
            title="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex min-h-0 flex-1">
          <aside className="w-56 shrink-0 border-r border-slate-200 bg-slate-50 p-3">
            <nav className="space-y-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm font-semibold transition-colors ${
                    activeTab === tab.id
                      ? 'bg-white text-emerald-700 shadow-sm ring-1 ring-slate-200'
                      : 'text-slate-600 hover:bg-white hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                  {activeTab === tab.id && <ChevronRight className="h-4 w-4" />}
                </button>
              ))}
            </nav>
          </aside>

          <main className="min-w-0 flex-1 overflow-auto p-5">
            {activeTab === 'accountDefaults' ? (
              <div className="space-y-5">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Account Defaults</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    Defaults are visible starting values on documents. They do not bypass posting validation.
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <AccountSelectorSimple
                    label="Default cash / bank account"
                    value={settings.accountDefaults?.defaultCashAccountId || ''}
                    onChange={(accountId) => setSettings((prev) => ({
                      ...prev,
                      accountDefaults: { ...(prev.accountDefaults || {}), defaultCashAccountId: accountId || null },
                    }))}
                  />
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium text-slate-700">Default warehouse</span>
                    <WarehouseSelector
                      value={settings.accountDefaults?.defaultWarehouseId || ''}
                      onChange={(warehouse) => setSettings((prev) => ({
                        ...prev,
                        accountDefaults: { ...(prev.accountDefaults || {}), defaultWarehouseId: warehouse?.id || null },
                      }))}
                    />
                  </label>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  Cost center and AR/AP defaults are reserved for a follow-up after each target document field and posting validation path is confirmed.
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Pricing Behavior</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    Choose the default line price source for new documents opened through this form.
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3 hover:border-emerald-300 hover:bg-emerald-50/40">
                    <input
                      type="radio"
                      name="linePriceSource"
                      checked={!settings.pricingBehavior?.linePriceSource}
                      onChange={() => setSettings((prev) => ({
                        ...prev,
                        pricingBehavior: { ...(prev.pricingBehavior || {}), linePriceSource: null },
                      }))}
                      className="mt-1"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-slate-900">Use company default</span>
                      <span className="block text-xs text-slate-500">Falls back to Inventory Settings line price source.</span>
                    </span>
                  </label>
                  {PRICE_SOURCE_OPTIONS.map((option) => (
                    <label
                      key={option.value}
                      className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3 hover:border-emerald-300 hover:bg-emerald-50/40"
                    >
                      <input
                        type="radio"
                        name="linePriceSource"
                        checked={settings.pricingBehavior?.linePriceSource === option.value}
                        onChange={() => setSettings((prev) => ({
                          ...prev,
                          pricingBehavior: { ...(prev.pricingBehavior || {}), linePriceSource: option.value },
                        }))}
                        className="mt-1"
                      />
                      <span>
                        <span className="block text-sm font-semibold text-slate-900">{option.label}</span>
                        <span className="block text-xs text-slate-500">{option.description}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </main>
        </div>

        <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </footer>
      </div>
    </div>
  );
};

interface AvailableTypeRowProps {
  node: TypeNode;
  installing: boolean;
  onInstall: () => void;
}

const AvailableTypeRow: React.FC<AvailableTypeRowProps> = ({ node, installing, onInstall }) => {
  const variants = node.catalogVariants.map(variantLabel).filter((v): v is string => Boolean(v));
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-sm font-semibold text-gray-900">{node.name}</h3>
          <span className="inline-flex items-center px-2 py-0.5 bg-slate-100 text-slate-700 text-xs font-medium rounded">
            {node.catalogVariants.length} default form{node.catalogVariants.length !== 1 ? 's' : ''}
          </span>
        </div>
        {variants.length > 0 && (
          <p className="mt-0.5 text-xs text-gray-500">Variants: {variants.join(' · ')}</p>
        )}
      </div>
      <button
        type="button"
        onClick={onInstall}
        disabled={installing}
        className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
          installing
            ? 'bg-slate-100 text-slate-400 cursor-wait'
            : 'bg-primary-600 text-white hover:bg-primary-700'
        }`}
      >
        {installing ? (
          <>
            <Spinner size="sm" /> Installing
          </>
        ) : (
          <>
            <DownloadCloud className="h-3 w-3" /> Install
          </>
        )}
      </button>
    </div>
  );
};

export default VoucherDesignerPage;
