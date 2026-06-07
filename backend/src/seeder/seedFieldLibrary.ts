/**
 * seedFieldLibrary.ts
 *
 * Phase A of task 135 — seeds the Layer 1 Field Library into
 * `system_metadata/field_library/items` from the same content currently
 * hardcoded as constants in
 * `frontend/src/modules/shared/pages/VoucherDesignerPage.tsx`
 * (`SYSTEM_FIELDS_GENERIC`, `AVAILABLE_FIELDS_BY_MODULE`,
 * `AVAILABLE_TABLE_COLUMNS_BY_MODULE`).
 *
 * Why duplicate the constants here instead of importing them?
 *   The constants live in the frontend bundle; the backend can't pull
 *   from `frontend/src/...` without crossing the tsconfig boundary. The
 *   duplication is intentional and short-lived — Phase B's super-admin
 *   editor becomes the source of truth, and the frontend constants get
 *   replaced with a read against the field library API in Phase C. At
 *   that point this seeder reduces to a one-off "first install"
 *   script, not an authoring tool.
 *
 * Idempotency contract (decision 6.3):
 *   - Re-running the seeder with identical content is a no-op (the
 *     repository computes a content hash and skips the write).
 *   - Re-running with changed content bumps the entry's `version` by
 *     exactly one and persists the new content.
 *   - Deleted-in-code entries are NOT auto-purged. Soft-deprecate by
 *     toggling `deprecated: true` in source instead.
 */

import { IFieldLibraryRepository } from '../repository/interfaces/designer/IFieldLibraryRepository';
import {
  FieldClass,
  FieldLibraryEntry,
  FieldSectionHint,
  SelectorBinding,
} from '../domain/designer/entities/FieldLibraryEntry';

/* ───────────────────────────── 1. SOURCE LISTS ─────────────────────────────
 * Verbatim copies of the frontend constants. Two intentional shape diffs:
 *   - `category` becomes our `fieldClass`. We map below.
 *   - `mandatory` becomes `alwaysMandatory` (library-level hint).
 */

interface RawField {
  id: string;
  label: string;
  type: string;
  sectionHint?: FieldSectionHint;
  category?: 'core' | 'shared' | 'systemMetadata';
  mandatory?: boolean;
  autoManaged?: boolean;
  readOnly?: boolean;
  supportedTypes?: string[];
  excludedTypes?: string[];
}

const SYSTEM_FIELDS_GENERIC: RawField[] = [
  { id: 'documentId',    label: 'Document Number',   type: 'text',   sectionHint: 'HEADER', category: 'systemMetadata', autoManaged: true },
  { id: 'status',        label: 'Status',            type: 'text',   sectionHint: 'HEADER', category: 'systemMetadata', autoManaged: true },
  { id: 'createdAt',     label: 'Creation Date',     type: 'date',   sectionHint: 'HEADER', category: 'systemMetadata', autoManaged: true },
  { id: 'createdBy',     label: 'Created By',        type: 'text',   sectionHint: 'HEADER', category: 'systemMetadata', autoManaged: true },
  { id: 'subtotalDoc',   label: 'Subtotal (Doc)',    type: 'amount', sectionHint: 'FOOTER', category: 'systemMetadata', autoManaged: true },
  { id: 'taxTotalDoc',   label: 'Tax Total (Doc)',   type: 'amount', sectionHint: 'FOOTER', category: 'systemMetadata', autoManaged: true },
  { id: 'grandTotalDoc', label: 'Grand Total (Doc)', type: 'amount', sectionHint: 'FOOTER', category: 'systemMetadata', autoManaged: true },
  { id: 'lineItems',     label: 'Line Items Table',  type: 'table',  sectionHint: 'BODY',   category: 'core',           mandatory: true },
];

/**
 * Module-specific header fields. The flat namespace (decision 6.1) means
 * `currency` defined for ACCOUNTING is the same identity as `currency`
 * for SALES — when both modules declare it, we de-dupe and keep the
 * union of supported types. The Phase C cascade will move the
 * per-module placement metadata into the Layer 2 type bindings.
 */
const AVAILABLE_FIELDS_BY_MODULE: Record<string, RawField[]> = {
  ACCOUNTING: [
    { id: 'date',             label: 'Voucher Date',          type: 'date',                    sectionHint: 'HEADER', category: 'core',   mandatory: true },
    { id: 'payee',            label: 'Payee / Customer',      type: 'text',                    sectionHint: 'HEADER', category: 'shared' },
    { id: 'reference',        label: 'Reference Doc',         type: 'text',                    sectionHint: 'HEADER', category: 'shared' },
    { id: 'description',      label: 'Description',           type: 'text',                    sectionHint: 'HEADER', category: 'core' },
    { id: 'currency',         label: 'Currency',              type: 'select',                  sectionHint: 'HEADER', category: 'core',   mandatory: true },
    { id: 'exchangeRate',     label: 'Exchange Rate',         type: 'number',                  sectionHint: 'HEADER', category: 'shared', supportedTypes: ['payment_voucher', 'receipt_voucher', 'transfer_voucher'] },
    { id: 'paymentMethod',    label: 'Payment Method',        type: 'select',                  sectionHint: 'HEADER', category: 'shared', supportedTypes: ['payment_voucher'] },
    { id: 'branch',           label: 'Branch / Dept',         type: 'select',                  sectionHint: 'HEADER', category: 'shared' },
    { id: 'currencyExchange', label: 'Exchange Rate (Smart)', type: 'number',                  sectionHint: 'HEADER', category: 'shared' },
    { id: 'account',          label: 'Account (Header)',      type: 'account-selector',        sectionHint: 'HEADER', category: 'shared' },
    { id: 'costCenter',       label: 'Cost Center (Header)',  type: 'cost-center-selector',    sectionHint: 'HEADER', category: 'shared' },
    { id: 'lineItems',        label: 'Line Items Table',      type: 'table',                   sectionHint: 'BODY',   category: 'core',   mandatory: true },
    { id: 'notes',            label: 'Internal Notes',        type: 'textarea',                sectionHint: 'EXTRA',  category: 'shared' },
    { id: 'attachments',      label: 'Attachments',           type: 'text',                    sectionHint: 'EXTRA',  category: 'shared' },
  ],
  SALES: [
    { id: 'invoiceDate',      label: 'Invoice Date',          type: 'date',                    sectionHint: 'HEADER', category: 'core',   mandatory: true },
    { id: 'deliveryDate',     label: 'Delivery Date',         type: 'date',                    sectionHint: 'HEADER', category: 'core',   mandatory: true },
    { id: 'returnDate',       label: 'Return Date',           type: 'date',                    sectionHint: 'HEADER', category: 'core',   mandatory: true },
    { id: 'customerId',       label: 'Customer',              type: 'party-selector',          sectionHint: 'HEADER', category: 'core',   mandatory: true },
    { id: 'warehouseId',      label: 'Warehouse',             type: 'warehouse-selector',      sectionHint: 'HEADER', category: 'core' },
    { id: 'currency',         label: 'Currency',              type: 'select',                  sectionHint: 'HEADER', category: 'core',   mandatory: true },
    { id: 'exchangeRate',     label: 'Exchange Rate',         type: 'number',                  sectionHint: 'HEADER', category: 'core',   mandatory: true },
    { id: 'totalAmount',      label: 'Total Amount',          type: 'number',                  sectionHint: 'HEADER', category: 'shared' },
    { id: 'salesOrderId',     label: 'Sales Order Ref',       type: 'select',                  sectionHint: 'HEADER', category: 'shared' },
    { id: 'deliveryNoteId',   label: 'Delivery Note Ref',     type: 'select',                  sectionHint: 'HEADER', category: 'shared' },
    { id: 'salesInvoiceId',   label: 'Sales Invoice Ref',     type: 'select',                  sectionHint: 'HEADER', category: 'shared' },
    { id: 'reason',           label: 'Reason',                type: 'text',                    sectionHint: 'HEADER', category: 'core' },
    { id: 'notes',            label: 'Notes',                 type: 'textarea',                sectionHint: 'HEADER', category: 'shared' },
    { id: 'lineItems',        label: 'Line Items Table',      type: 'table',                   sectionHint: 'BODY',   category: 'core',   mandatory: true },
  ],
  PURCHASE: [
    { id: 'invoiceDate',           label: 'Invoice Date',            type: 'date',                       sectionHint: 'HEADER', category: 'core',   mandatory: true },
    { id: 'orderDate',             label: 'Order Date',              type: 'date',                       sectionHint: 'HEADER', category: 'core',   mandatory: true },
    { id: 'expectedDeliveryDate',  label: 'Expected Delivery Date',  type: 'date',                       sectionHint: 'HEADER', category: 'shared' },
    { id: 'vendorId',              label: 'Vendor',                  type: 'vendor-account-selector',    sectionHint: 'HEADER', category: 'core',   mandatory: true },
    { id: 'warehouseId',           label: 'Default Warehouse',       type: 'warehouse-selector',         sectionHint: 'HEADER', category: 'shared' },
    { id: 'currency',              label: 'Currency',                type: 'select',                     sectionHint: 'HEADER', category: 'core',   mandatory: true },
    { id: 'exchangeRate',          label: 'Exchange Rate',           type: 'number',                     sectionHint: 'HEADER', category: 'core',   mandatory: true },
    { id: 'totalAmount',           label: 'Total Amount',            type: 'number',                     sectionHint: 'HEADER', category: 'shared' },
    { id: 'purchaseOrderId',       label: 'Purchase Order Ref',      type: 'select',                     sectionHint: 'HEADER', category: 'shared' },
    { id: 'goodsReceiptId',        label: 'Goods Receipt Ref',       type: 'select',                     sectionHint: 'HEADER', category: 'shared' },
    { id: 'notes',                 label: 'Notes',                   type: 'textarea',                   sectionHint: 'HEADER', category: 'shared' },
    { id: 'internalNotes',         label: 'Internal Notes',          type: 'textarea',                   sectionHint: 'HEADER', category: 'shared' },
    { id: 'lineItems',             label: 'Line Items Table',        type: 'table',                      sectionHint: 'BODY',   category: 'core',   mandatory: true },
  ],
};

/**
 * Line-item table columns. These are *also* fields in Layer 1 (a flat
 * namespace), with `sectionHint: 'BODY'` so the wizard's column picker
 * pulls them via `resolveForCompany().lineEligible`. Phase C will allow
 * one field id to appear in both header (e.g. `warehouseId` for
 * sales_invoice) and line (e.g. `warehouseId` for sales_order)
 * placements — same identity, type-level placement override.
 */
const AVAILABLE_TABLE_COLUMNS_BY_MODULE: Record<string, RawField[]> = {
  ACCOUNTING: [
    { id: 'account',      label: 'Account',      type: 'account-selector',     sectionHint: 'BODY', category: 'shared' },
    { id: 'debit',        label: 'Debit',        type: 'amount',               sectionHint: 'BODY', category: 'shared' },
    { id: 'credit',       label: 'Credit',       type: 'amount',               sectionHint: 'BODY', category: 'shared' },
    { id: 'costCenterId', label: 'Cost Center',  type: 'cost-center-selector', sectionHint: 'BODY', category: 'shared' },
    { id: 'notesLine',    label: 'Line Notes',   type: 'text',                 sectionHint: 'BODY', category: 'shared' },
    { id: 'currencyLine', label: 'Line Currency',type: 'select',               sectionHint: 'BODY', category: 'shared' },
    { id: 'parity',       label: 'Parity',       type: 'number',               sectionHint: 'BODY', category: 'shared' },
    { id: 'equivalent',   label: 'Equivalent',   type: 'amount',               sectionHint: 'BODY', category: 'shared' },
    { id: 'category',     label: 'Category',     type: 'select',               sectionHint: 'BODY', category: 'shared' },
  ],
  SALES: [
    { id: 'itemId',         label: 'Item',                type: 'item-selector',         sectionHint: 'BODY', category: 'core', mandatory: true },
    { id: 'soLineId',       label: 'SO Line',             type: 'select',                sectionHint: 'BODY', category: 'shared' },
    { id: 'dnLineId',       label: 'DN Line',             type: 'select',                sectionHint: 'BODY', category: 'shared' },
    { id: 'siLineId',       label: 'Invoice Line',        type: 'select',                sectionHint: 'BODY', category: 'shared' },
    { id: 'lineWarehouseId',label: 'Line Warehouse',      type: 'warehouse-selector',    sectionHint: 'BODY', category: 'shared' },
    { id: 'deliveredQty',   label: 'Delivered Quantity',  type: 'number',                sectionHint: 'BODY', category: 'shared' },
    { id: 'returnQty',      label: 'Return Quantity',     type: 'number',                sectionHint: 'BODY', category: 'shared' },
    { id: 'invoicedQty',    label: 'Invoiced Quantity',   type: 'number',                sectionHint: 'BODY', category: 'shared' },
    { id: 'uom',            label: 'UOM',                 type: 'select',                sectionHint: 'BODY', category: 'shared' },
    { id: 'unitPriceDoc',   label: 'Unit Price',          type: 'amount',                sectionHint: 'BODY', category: 'core', mandatory: true },
    { id: 'taxCodeId',      label: 'Tax Code',            type: 'select',                sectionHint: 'BODY', category: 'shared' },
    { id: 'lineTotal',      label: 'Line Total',          type: 'amount',                sectionHint: 'BODY', category: 'computed' as any },
    { id: 'lineDescription',label: 'Line Description',    type: 'text',                  sectionHint: 'BODY', category: 'shared' },
  ],
  PURCHASE: [
    { id: 'itemId',          label: 'Item',                 type: 'item-selector',        sectionHint: 'BODY', category: 'core', mandatory: true },
    { id: 'orderedQty',      label: 'Ordered Quantity',     type: 'number',               sectionHint: 'BODY', category: 'shared' },
    { id: 'invoicedQty',     label: 'Invoiced Quantity',    type: 'number',               sectionHint: 'BODY', category: 'shared' },
    { id: 'poLineId',        label: 'PO Line',              type: 'select',               sectionHint: 'BODY', category: 'shared' },
    { id: 'grnLineId',       label: 'GRN Line',             type: 'select',               sectionHint: 'BODY', category: 'shared' },
    { id: 'lineWarehouseId', label: 'Line Warehouse',       type: 'warehouse-selector',   sectionHint: 'BODY', category: 'shared' },
    { id: 'uom',             label: 'UOM',                  type: 'select',               sectionHint: 'BODY', category: 'shared' },
    { id: 'unitPriceDoc',    label: 'Unit Price',           type: 'amount',               sectionHint: 'BODY', category: 'core', mandatory: true },
    { id: 'taxCodeId',       label: 'Tax Code',             type: 'select',               sectionHint: 'BODY', category: 'shared' },
    { id: 'lineTotal',       label: 'Line Total',           type: 'amount',               sectionHint: 'BODY', category: 'computed' as any },
    { id: 'lineDescription', label: 'Line Description',     type: 'text',                 sectionHint: 'BODY', category: 'shared' },
  ],
};

/* ───────────────────────────── 2. MAPPERS ──────────────────────────────── */

const inferFieldClass = (raw: RawField): FieldClass => {
  // Computed if the field is system-derived and the user can't edit it.
  if (raw.autoManaged || raw.readOnly) return 'computed';
  // Both 'core' from the constants and `mandatory: true` collapse into
  // system_core — the field is always required when present on a type.
  if (raw.mandatory || raw.category === 'core') return 'system_core';
  // 'systemMetadata' = engine-owned metadata fields (documentId, totals…).
  if (raw.category === 'systemMetadata') return 'computed';
  // Default for 'shared' and anything else.
  return 'system_optional';
};

const SELECTOR_BINDINGS: Record<string, SelectorBinding> = {
  'party-selector':           { collection: 'parties',      displayField: 'name' },
  'warehouse-selector':       { collection: 'warehouses',   displayField: 'name' },
  'item-selector':            { collection: 'items',        displayField: 'name' },
  'account-selector':         { collection: 'accounts',     displayField: 'name' },
  'cost-center-selector':     { collection: 'cost_centers', displayField: 'name' },
  'customer-account-selector':{ collection: 'parties',      displayField: 'name', filters: { kind: 'customer' } },
  'vendor-account-selector':  { collection: 'parties',      displayField: 'name', filters: { kind: 'vendor' } },
};

const toEntry = (raw: RawField): Omit<FieldLibraryEntry, 'version'> => ({
  id: raw.id,
  label: raw.label,
  type: raw.type,
  fieldClass: inferFieldClass(raw),
  sectionHint: raw.sectionHint,
  alwaysMandatory: !!raw.mandatory || raw.category === 'core',
  alwaysShared: raw.category === 'shared',
  supportedTypes: raw.supportedTypes,
  excludedTypes: raw.excludedTypes,
  selectorBinding: SELECTOR_BINDINGS[raw.type],
  scope: 'system',
});

/**
 * De-dupe the union of all source lists. The flat namespace (6.1) means
 * `currency` from ACCOUNTING and `currency` from SALES collapse into a
 * single entry. We keep the *first* occurrence's metadata and union the
 * `supportedTypes` / `excludedTypes` arrays so no historical scoping
 * data is lost.
 */
const buildUnion = (): Array<Omit<FieldLibraryEntry, 'version'>> => {
  const byId = new Map<string, Omit<FieldLibraryEntry, 'version'>>();
  const sources: RawField[] = [
    ...SYSTEM_FIELDS_GENERIC,
    ...AVAILABLE_FIELDS_BY_MODULE.ACCOUNTING,
    ...AVAILABLE_FIELDS_BY_MODULE.SALES,
    ...AVAILABLE_FIELDS_BY_MODULE.PURCHASE,
    ...AVAILABLE_TABLE_COLUMNS_BY_MODULE.ACCOUNTING,
    ...AVAILABLE_TABLE_COLUMNS_BY_MODULE.SALES,
    ...AVAILABLE_TABLE_COLUMNS_BY_MODULE.PURCHASE,
  ];
  for (const raw of sources) {
    const next = toEntry(raw);
    const existing = byId.get(next.id);
    if (!existing) {
      byId.set(next.id, next);
      continue;
    }
    // Union the type-scoping arrays so nothing is lost on dedupe.
    const supportedTypes = Array.from(
      new Set([...(existing.supportedTypes ?? []), ...(next.supportedTypes ?? [])])
    );
    const excludedTypes = Array.from(
      new Set([...(existing.excludedTypes ?? []), ...(next.excludedTypes ?? [])])
    );
    byId.set(next.id, {
      ...existing,
      supportedTypes: supportedTypes.length ? supportedTypes : undefined,
      excludedTypes: excludedTypes.length ? excludedTypes : undefined,
      // Promote mandatory if any source said so. Demoting requires explicit
      // editing via the Phase B super-admin UI.
      alwaysMandatory: existing.alwaysMandatory || next.alwaysMandatory,
    });
  }
  return Array.from(byId.values());
};

/* ───────────────────────────── 3. ENTRYPOINT ───────────────────────────── */

export async function seedFieldLibrary(
  repo: IFieldLibraryRepository,
  options: { updatedBy?: string } = {}
): Promise<{ total: number; written: number; unchanged: number }> {
  const updatedBy = options.updatedBy || 'system_seeder';
  const entries = buildUnion();

  // Read existing versions up-front so the per-entry log is meaningful.
  const before = await repo.listSystemEntries();
  const beforeById = new Map(before.map((e) => [e.id, e]));

  let written = 0;
  let unchanged = 0;

  for (const partial of entries) {
    const previous = beforeById.get(partial.id);
    const entry: FieldLibraryEntry = {
      ...(partial as FieldLibraryEntry),
      version: previous?.version ?? 1,
    };
    const result = await repo.upsertSystemEntry(entry, updatedBy);
    if (previous && previous.version === result.version) {
      unchanged++;
    } else {
      written++;
      console.log(
        `  • ${result.id.padEnd(24)}  v${result.version}  ${previous ? '(updated)' : '(new)'}`
      );
    }
  }

  return { total: entries.length, written, unchanged };
}
