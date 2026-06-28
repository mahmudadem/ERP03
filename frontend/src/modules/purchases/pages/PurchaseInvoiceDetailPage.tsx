import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { InventoryItemDTO, InventoryWarehouseDTO, UomConversionDTO, inventoryApi } from '../../../api/inventoryApi';
import {
  CreatePurchaseInvoicePayload,
  PurchaseInvoiceAttachmentDTO,
  PurchaseInvoiceDTO,
  PurchaseInvoiceLineDTO,
  PurchaseInvoiceLineInputDTO,
  PurchaseOrderDTO,
  PurchaseSettingsDTO,
  purchasesApi,
} from '../../../api/purchasesApi';
import { PartyDTO, TaxCodeDTO, sharedApi } from '../../../api/sharedApi';
import { FormSettingsRecord, voucherFormApi } from '../../../api/voucherFormApi';
import type { PrintLayoutSchema } from '../../../api/printLayoutApi';
import { Card } from '../../../components/ui/Card';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { useCompanyAccess } from '../../../context/CompanyAccessContext';
import { useAccounts } from '../../../context/AccountsContext';
import { errorHandler } from '../../../services/errorHandler';
import { CurrencySelector } from '../../accounting/components/shared/CurrencySelector';
import { CurrencyExchangeWidget } from '../../accounting/components/shared/CurrencyExchangeWidget';
import { DatePicker } from '../../accounting/components/shared/DatePicker';
import { PartySelector, ItemSelector, UomSelector, WarehouseSelector, TaxCodeSelector, DiscountTypeSelector } from '../../../components/shared/selectors';
import { LinePriceSource, LinePriceSourceSelector } from '../../../components/shared/pricing/LinePriceSourceSelector';
import { createDocumentPriceOverrideMenuItems, createLinePriceOverrideMenuItems } from '../../../components/shared/pricing/createPriceOverrideMenuItems';
import { LinePriceOverrideBadge } from '../../../components/shared/pricing/LinePriceOverrideBadge';
import { ClassicLineItemsTable, ColumnDef } from '../../../components/shared/ClassicLineItemsTable';
import toast from 'react-hot-toast';
import { DocumentChargesAllocation, DocumentChargeModal, ChargeAllocationRow } from '../../../components/shared/DocumentChargesAllocation';
import { SettlementBlock } from '../../../components/shared/settlement/SettlementBlock';
import { RecordPaymentDialog, RecordPaymentPayload } from '../../../components/shared/settlement/RecordPaymentDialog';
import { PaymentHistoryModal } from '../../../components/shared/settlement/PaymentHistoryModal';
import { buildItemUomOptions, getDefaultItemUomOption, ManagedUomOption } from '../../inventory/utils/uomOptions';
import { GlImpactModal } from '../../sales/components/GlImpactModal';
import { todayLocalIso } from '../../../utils/dateUtils';
import { clsx } from 'clsx';
import {
  AlertTriangle,
  CheckCircle2,
  FileImage,
  FileSpreadsheet,
  FileText,
  History,
  Info,
  Link2,
  Paperclip,
  Printer,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import {
  DocumentCompactCard,
  DocumentControlPanel,
  DocumentDetailScaffold,
  DocumentField,
  DocumentFooterTotalsStrip,
  DocumentHeaderGrid,
  DocumentIconButton,
  DocumentPill,
  DocumentRailChecklist,
  DocumentRailFocus,
  DocumentRailStat,
  DocumentRailTotals,
  DocumentScaffoldRailSections,
  DocumentSegmentButton,
  DocumentSegmentedGroup,
  documentHeaderControlClass,
  documentHeaderLabelClass,
  documentHeaderSelectorClass,
} from '../../../components/shared/DocumentDetailScaffold';

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;
const roundMoney = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;
const todayIso = todayLocalIso;
const MAX_ATTACHMENT_FILES = 5;
const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;
const ALLOWED_ATTACHMENT_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const formatFileSize = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

interface EditableLine {
  lineId?: string;
  poLineId?: string;
  grnLineId?: string;
  itemId: string;
  itemCode?: string;
  itemName?: string;
  invoicedQty: number;
  uomId?: string;
  uom: string;
  unitPriceDoc: number;
  discountType?: 'PERCENT' | 'AMOUNT';
  discountValue?: number;
  taxCodeId?: string;
  /** Per-line inclusive override. When undefined, the tax code's default applies. */
  priceIsInclusive?: boolean;
  warehouseId?: string;
  description?: string;
  /**
   * Per-line price-source override (Task 243 Part C). Transient: stripped
   * from buildLinePayload before posting.
   */
  priceSourceOverride?: LinePriceSource | null;
  /**
   * Per-line manual lock. Transient: stripped from buildLinePayload.
   */
  priceLocked?: boolean;
}

interface EditableCharge {
  chargeId?: string;
  /** CHARGE adds to the bill total; DISCOUNT subtracts from it. Defaults to CHARGE. */
  kind?: 'CHARGE' | 'DISCOUNT';
  code?: string;
  name: string;
  amountDoc: number;
  accountId?: string;
  /** Display-only label for the chosen GL account (code/name); not sent to the API. */
  accountLabel?: string;
  description?: string;
}

interface EditableForm {
  purchaseOrderId: string;
  vendorId: string;
  vendorName?: string;
  vendorInvoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  currency: string;
  exchangeRate: number;
  linePriceSource: LinePriceSource;
  warehouseId?: string;
  notes: string;
  lines: EditableLine[];
  charges: EditableCharge[];
}

type PurchaseInvoiceRailFocus =
  | { kind: 'vendor'; code: string; title: string; subtitle: string; note: string }
  | { kind: 'item'; code: string; title: string; subtitle: string; note: string }
  | { kind: 'warehouse'; code: string; title: string; subtitle: string; note: string };

interface PurchaseInvoicePrintTemplateDTO {
  id?: string;
  name: string;
  documentType: 'PURCHASE_INVOICE';
  isDefault: boolean;
  source: 'SAVED_TEMPLATE' | 'GENERATED_DEFAULT';
  layout: PrintLayoutSchema;
}

interface PurchaseInvoicePrintResultDTO {
  payload: Record<string, any>;
  printTemplate: PurchaseInvoicePrintTemplateDTO;
}

let piChargeUidSeq = 0;
const nextPiChargeId = (): string => `chg_${Date.now().toString(36)}_${(piChargeUidSeq++).toString(36)}`;

const createEmptyLine = (): EditableLine => ({
  itemId: '',
  invoicedQty: 0,
  uomId: undefined,
  uom: '',
  unitPriceDoc: 0,
  discountType: undefined,
  discountValue: 0,
  taxCodeId: undefined,
  warehouseId: undefined,
  description: '',
});

const createEmptyForm = (purchaseOrderId = '', vendorId = '', linePriceSource: LinePriceSource = 'LAST_PARTY_PRICE'): EditableForm => ({
  purchaseOrderId,
  vendorId,
  vendorInvoiceNumber: '',
  invoiceDate: todayIso(),
  dueDate: '',
  currency: 'USD',
  exchangeRate: 1,
  linePriceSource,
  warehouseId: undefined,
  notes: '',
  lines: [createEmptyLine()],
  charges: [],
});

const escapePrintHtml = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const readPrintPath = (source: Record<string, any>, path?: string): unknown => {
  if (!path) return '';
  return path.split('.').reduce<unknown>((current, part) => {
    if (current && typeof current === 'object') return (current as Record<string, unknown>)[part];
    return undefined;
  }, source);
};

const renderPrintValue = (value: unknown): string => {
  if (typeof value === 'number') return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return String(value ?? '');
};

const openPrintLayoutWindow = (payload: Record<string, any>, template: PurchaseInvoicePrintTemplateDTO) => {
  const layout = template.layout;
  const paper = layout.paper;
  const unit = paper.unit || 'mm';
  const pageWidth = `${paper.width}${unit}`;
  const pageHeight = `${paper.height}${unit}`;
  const margin = `${paper.marginTop}${unit} ${paper.marginRight}${unit} ${paper.marginBottom}${unit} ${paper.marginLeft}${unit}`;
  const components = layout.components.map((component) => {
    const style = component.style || {};
    const baseStyle = [
      `position:absolute`,
      `left:${component.x}${unit}`,
      `top:${component.y}${unit}`,
      `width:${component.width}${unit}`,
      `height:${component.height}${unit}`,
      `font-family:${style.fontFamily || 'Arial, sans-serif'}`,
      `font-size:${style.fontSize || 10}pt`,
      `font-weight:${style.fontWeight || 'normal'}`,
      `font-style:${style.fontStyle || 'normal'}`,
      `color:${style.color || '#111827'}`,
      `background:${style.backgroundColor || 'transparent'}`,
      `text-align:${style.textAlign || 'left'}`,
      `border:${style.borderWidth ? `${style.borderWidth}px solid ${style.borderColor || '#d4d4d8'}` : '0'}`,
      `box-sizing:border-box`,
      `overflow:hidden`,
    ].join(';');

    if (component.type === 'field') {
      const value = renderPrintValue(readPrintPath(payload, component.fieldPath));
      const label = component.label ? `<span class="print-label">${escapePrintHtml(component.label)}: </span>` : '';
      return `<div style="${baseStyle}">${label}${escapePrintHtml(value)}</div>`;
    }
    if (component.type === 'table') {
      const rows = Array.isArray(readPrintPath(payload, component.tablePath)) ? readPrintPath(payload, component.tablePath) as Record<string, any>[] : [];
      const options = component.tableOptions || {};
      const columns = component.columns || [];
      return `<div style="${baseStyle};overflow:visible">
        <table style="width:100%;border-collapse:collapse;table-layout:fixed;font-size:inherit">
          <thead style="${options.repeatHeaderOnPageBreak ? 'display:table-header-group' : ''}">
            <tr>
              ${columns.map((column) => `<th style="width:${column.width}%;border:1px solid ${style.borderColor || '#d4d4d8'};background:${options.headerBackgroundColor || '#e4e4e7'};color:${options.headerTextColor || '#18181b'};padding:2px;text-align:left">${escapePrintHtml(column.label)}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${rows.map((row) => `<tr>${columns.map((column) => `<td style="border:1px solid ${style.borderColor || '#d4d4d8'};padding:2px;vertical-align:top">${escapePrintHtml(renderPrintValue(row[column.fieldPath]))}</td>`).join('')}</tr>`).join('')}
          </tbody>
        </table>
      </div>`;
    }
    if (component.type === 'text') return `<div style="${baseStyle}">${escapePrintHtml(component.value || '')}</div>`;
    if (component.type === 'line') return `<div style="${baseStyle};border-top:1px solid ${style.borderColor || '#111827'}"></div>`;
    if (component.type === 'box') return `<div style="${baseStyle};border:1px solid ${style.borderColor || '#111827'}"></div>`;
    return `<div style="${baseStyle}">${escapePrintHtml(component.label || component.value || '')}</div>`;
  }).join('\n');

  const printWindow = window.open('', '_blank');
  if (!printWindow) throw new Error('Print popup was blocked.');
  printWindow.document.write(`<!doctype html>
    <html>
      <head>
        <title>${escapePrintHtml(String(readPrintPath(payload, 'invoice.number') || template.name))}</title>
        <style>
          @page { size: ${pageWidth} ${pageHeight}; margin: ${margin}; }
          html, body { margin: 0; padding: 0; background: white; color: #111827; }
          .print-page { position: relative; width: ${pageWidth}; min-height: ${pageHeight}; box-sizing: border-box; }
          .print-label { color: #6b7280; font-weight: 700; }
          table, tr, td, th { break-inside: avoid; }
        </style>
      </head>
      <body>
        <main class="print-page">${components}</main>
        <script>
          window.onload = function () {
            window.focus();
            window.print();
          };
        </script>
      </body>
    </html>`);
  printWindow.document.close();
};

const PurchaseInvoiceDetailPage: React.FC = () => {
  const { company } = useCompanyAccess();
  const { getAccountById } = useAccounts();
  const { t } = useTranslation(['purchases', 'common']);
  const navigate = useNavigate();
  const params = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const isCreateMode = !params.id || params.id === 'new';
  const [isEditMode, setIsEditMode] = useState(false);

  const initialPurchaseOrderId = searchParams.get('purchaseOrderId') || '';
  const initialVendorId = searchParams.get('vendorId') || '';

  const [invoice, setInvoice] = useState<PurchaseInvoiceDTO | null>(null);
  const [settings, setSettings] = useState<PurchaseSettingsDTO | null>(null);
  const [vendors, setVendors] = useState<PartyDTO[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderDTO[]>([]);
  const [items, setItems] = useState<InventoryItemDTO[]>([]);
  const [warehouses, setWarehouses] = useState<InventoryWarehouseDTO[]>([]);
  const [taxCodes, setTaxCodes] = useState<TaxCodeDTO[]>([]);
  const [formSettings, setFormSettings] = useState<FormSettingsRecord[]>([]);
  const [form, setForm] = useState<EditableForm>(() => createEmptyForm(initialPurchaseOrderId, initialVendorId));
  const [requestedSourceMode, setRequestedSourceMode] = useState<'direct' | 'po'>(initialPurchaseOrderId ? 'po' : 'direct');
  const [uomOptionsByItemId, setUomOptionsByItemId] = useState<Record<string, ManagedUomOption[]>>({});

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [orderLineLoading, setOrderLineLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chargeModal, setChargeModal] = useState<{
    kind: 'CHARGE' | 'DISCOUNT';
    editIndex: number | null;
    accountId: string;
    accountLabel: string;
    amount: number;
    description: string;
  } | null>(null);
  const [attachments, setAttachments] = useState<PurchaseInvoiceAttachmentDTO[]>([]);
  const [attachmentBusy, setAttachmentBusy] = useState(false);
  const [attachmentDeletingId, setAttachmentDeletingId] = useState<string | null>(null);
  const [attachmentPendingDelete, setAttachmentPendingDelete] = useState<PurchaseInvoiceAttachmentDTO | null>(null);
  const [unpostConfirmOpen, setUnpostConfirmOpen] = useState(false);
  const [pendingAttachmentFiles, setPendingAttachmentFiles] = useState<File[]>([]);

  // Settlement state
  const [settlementMode, setSettlementMode] = useState<'DEFERRED' | 'CASH_FULL' | 'MULTI'>('DEFERRED');
  const [apAccountId, setApAccountId] = useState('');
  const [settlementRows, setSettlementRows] = useState<{ settlementAccountId: string; amountBase: number; paymentMethod: string; reference: string; notes: string; paymentDate: string }[]>([]);
  const [settlementValidity, setSettlementValidity] = useState<{ ok: boolean; message?: string }>({ ok: true });
  const [recordPaymentOpen, setRecordPaymentOpen] = useState(false);
  const [recordPaymentBusy, setRecordPaymentBusy] = useState(false);
  const [paymentHistoryOpen, setPaymentHistoryOpen] = useState(false);
  const [glImpactOpen, setGlImpactOpen] = useState(false);
  const [printBusy, setPrintBusy] = useState(false);
  const [railFocus, setRailFocus] = useState<PurchaseInvoiceRailFocus>(() => ({
    kind: 'vendor',
    code: 'AP',
    title: t('invoiceDetail.rail.vendorFocusTitle', 'Vendor'),
    subtitle: t('invoiceDetail.rail.vendorFocusSubtitle', 'Select a vendor to review AP context.'),
    note: t('invoiceDetail.rail.vendorFocusNote', 'Vendor focus controls AP settlement, payment terms, currency, and purchase history.'),
  }));

  const vendorNameById = useMemo(
    () =>
      vendors.reduce<Record<string, string>>((acc, vendor) => {
        acc[vendor.id] = vendor.displayName;
        return acc;
      }, {}),
    [vendors]
  );

  const invoiceablePurchaseOrders = useMemo(
    () =>
      purchaseOrders.filter((order) =>
        ['CONFIRMED', 'PARTIALLY_RECEIVED', 'FULLY_RECEIVED'].includes(order.status) ||
        order.id === form.purchaseOrderId
      ),
    [form.purchaseOrderId, purchaseOrders]
  );

  const itemById = useMemo(
    () =>
      items.reduce<Record<string, InventoryItemDTO>>((acc, item) => {
        acc[item.id] = item;
        return acc;
      }, {}),
    [items]
  );

  const warehouseById = useMemo(
    () =>
      warehouses.reduce<Record<string, InventoryWarehouseDTO>>((acc, warehouse) => {
        acc[warehouse.id] = warehouse;
        return acc;
      }, {}),
    [warehouses]
  );

  const taxById = useMemo(
    () =>
      taxCodes.reduce<Record<string, TaxCodeDTO>>((acc, taxCode) => {
        acc[taxCode.id] = taxCode;
        return acc;
      }, {}),
    [taxCodes]
  );

  const focusVendor = (vendorId = form.vendorId, vendorName = form.vendorName) => {
    const vendor = vendorId ? vendors.find((candidate) => candidate.id === vendorId) : undefined;
    const title = vendor?.displayName || vendorName || t('invoiceDetail.rail.vendorFocusTitle', 'Vendor');
    setRailFocus({
      kind: 'vendor',
      code: vendorId || 'AP',
      title,
      subtitle: form.vendorInvoiceNumber || t('invoiceDetail.rail.vendorFocusSubtitle', 'Vendor bill and AP account context'),
      note: t('invoiceDetail.rail.vendorFocusNote', 'Vendor focus controls AP settlement, payment terms, currency, and purchase history.'),
    });
  };

  const focusWarehouse = (warehouseId?: string) => {
    const effectiveWarehouseId = warehouseId || form.warehouseId || settings?.defaultWarehouseId;
    const warehouse = effectiveWarehouseId ? warehouseById[effectiveWarehouseId] : undefined;
    setRailFocus({
      kind: 'warehouse',
      code: effectiveWarehouseId || 'WH',
      title: warehouse?.name || t('invoiceDetail.rail.warehouseFocusTitle', 'Warehouse'),
      subtitle: warehouse?.code || t('invoiceDetail.rail.warehouseFocusSubtitle', 'Direct PI stock receipt location'),
      note: t('invoiceDetail.rail.warehouseFocusNote', 'For direct purchase invoices, this header warehouse is applied to stock lines that do not come from a purchase order.'),
    });
  };

  const focusItem = (line: Pick<EditableLine, 'itemId' | 'itemCode' | 'itemName' | 'warehouseId' | 'invoicedQty' | 'uom'>) => {
    const item = line.itemId ? itemById[line.itemId] : undefined;
    const effectiveWarehouseId = line.warehouseId || form.warehouseId || settings?.defaultWarehouseId;
    const warehouse = effectiveWarehouseId ? warehouseById[effectiveWarehouseId] : undefined;
    setRailFocus({
      kind: 'item',
      code: line.itemCode || item?.code || line.itemId || 'ITEM',
      title: line.itemName || item?.name || t('invoiceDetail.rail.itemFocusTitle', 'Item line'),
      subtitle: `${line.invoicedQty || 0} ${line.uom || item?.purchaseUom || item?.baseUom || ''}`.trim(),
      note: warehouse
        ? t('invoiceDetail.rail.itemFocusNoteWithWarehouse', 'This line receives into {{warehouse}} unless the source document already fixed the warehouse.', { warehouse: warehouse.name })
        : t('invoiceDetail.rail.itemFocusNote', 'Select a header warehouse before posting stock items on a direct purchase invoice.'),
    });
  };

  const purchaseTaxCodes = useMemo(
    () => taxCodes.filter((taxCode) => taxCode.scope === 'PURCHASE' || taxCode.scope === 'BOTH'),
    [taxCodes]
  );

  const resolveConfiguredLinePriceSource = (records = formSettings): LinePriceSource => (
    records.find((record) => record.builtInFormKey === 'native.purchase.invoice')?.settings?.pricingBehavior?.linePriceSource
    || 'LAST_PARTY_PRICE'
  ) as LinePriceSource;

  /**
   * Back-solve unit cost from a target Line Total (gross) or Net, mirroring
   * the SI back-solve. Handles line-level discount (PERCENT or AMOUNT) and
   * inclusive/exclusive tax — same math as the backend's normalizeLine.
   */
  const solveUnitCostFromTotal = (
    target: number,
    field: 'lineGross' | 'net',
    row: EditableLine,
  ): number => {
    const q = Number(row.invoicedQty || 0);
    if (q <= 0 || !Number.isFinite(target)) return 0;
    const taxCode = row.taxCodeId ? taxById[row.taxCodeId] : undefined;
    const taxRate = taxCode?.rate ?? 0;
    const inclusive =
      row.priceIsInclusive !== undefined
        ? row.priceIsInclusive === true
        : taxCode?.priceIsInclusive === true;
    const postDisc = field === 'lineGross'
      ? (inclusive ? target : target / (1 + taxRate))
      : (inclusive ? target * (1 + taxRate) : target);
    const dt = row.discountType;
    const dv = Number(row.discountValue || 0);
    if (dt === 'PERCENT') {
      const factor = 1 - dv / 100;
      if (factor <= 0) return 0;
      return postDisc / (q * factor);
    }
    if (dt === 'AMOUNT') {
      return (postDisc + dv) / q;
    }
    return postDisc / q;
  };

  const computedLines = useMemo(() => {
    return form.lines.map((line) => {
      const taxCode = line.taxCodeId ? taxById[line.taxCodeId] : undefined;
      const taxRate = taxCode?.rate ?? 0;
      const effectiveInclusive =
        line.priceIsInclusive !== undefined
          ? line.priceIsInclusive === true
          : taxCode?.priceIsInclusive === true;
      const divisor = effectiveInclusive ? 1 + taxRate : 1;
      const grossLineTotalDoc = roundMoney((line.invoicedQty || 0) * (line.unitPriceDoc || 0));
      const discountValue = Number(line.discountValue || 0);
      const discountAmountDoc = line.discountType === 'PERCENT'
        ? roundMoney(Math.max(0, Math.min(grossLineTotalDoc, grossLineTotalDoc * (discountValue / 100))))
        : line.discountType === 'AMOUNT'
          ? roundMoney(Math.max(0, Math.min(grossLineTotalDoc, discountValue)))
          : 0;
      const postDiscountDoc = roundMoney(grossLineTotalDoc - discountAmountDoc);
      const postDiscountBase = roundMoney(postDiscountDoc * (form.exchangeRate || 0));
      const lineTotalDoc = roundMoney(postDiscountDoc / divisor);
      const lineTotalBase = roundMoney(postDiscountBase / divisor);
      const taxAmountDoc = effectiveInclusive
        ? roundMoney(postDiscountDoc - lineTotalDoc)
        : roundMoney(lineTotalDoc * taxRate);
      const taxAmountBase = effectiveInclusive
        ? roundMoney(postDiscountBase - lineTotalBase)
        : roundMoney(lineTotalBase * taxRate);
      // `lineGrossDoc` is what the vendor charges for this line — Net + Tax.
      const lineGrossDoc = roundMoney(lineTotalDoc + taxAmountDoc);
      const lineGrossBase = roundMoney(lineTotalBase + taxAmountBase);

      return {
        grossLineTotalDoc,
        discountAmountDoc,
        lineGrossDoc,
        lineGrossBase,
        lineTotalDoc,
        lineTotalBase,
        taxAmountDoc,
        taxAmountBase,
      };
    });
  }, [form.exchangeRate, form.lines, taxById]);

  const totals = useMemo(() => {
    // Whole-invoice CHARGE adds to the subtotal; DISCOUNT subtracts. Both are tax-free.
    const chargeSubtotalDoc = form.charges.reduce(
      (sum, c) => sum + (c.kind === 'DISCOUNT' ? -(c.amountDoc || 0) : (c.amountDoc || 0)), 0);
    const chargeSubtotalBase = roundMoney(chargeSubtotalDoc * (form.exchangeRate || 0));
    const discountTotalDoc = form.charges.reduce(
      (sum, c) => sum + (c.kind === 'DISCOUNT' ? (c.amountDoc || 0) : 0), 0);

    const subtotalDoc = roundMoney(computedLines.reduce((sum, line) => sum + line.lineTotalDoc, 0) + chargeSubtotalDoc);
    const subtotalBase = roundMoney(computedLines.reduce((sum, line) => sum + line.lineTotalBase, 0) + chargeSubtotalBase);
    const taxTotalDoc = roundMoney(computedLines.reduce((sum, line) => sum + line.taxAmountDoc, 0));
    const taxTotalBase = roundMoney(computedLines.reduce((sum, line) => sum + line.taxAmountBase, 0));

    return {
      subtotalDoc,
      subtotalBase,
      taxTotalDoc,
      taxTotalBase,
      discountTotalDoc: roundMoney(discountTotalDoc),
      grandTotalDoc: roundMoney(subtotalDoc + taxTotalDoc),
      grandTotalBase: roundMoney(subtotalBase + taxTotalBase),
    };
  }, [computedLines, form.charges, form.exchangeRate]);

  const toEditableLinesFromPurchaseOrder = (po: PurchaseOrderDTO): EditableLine[] => {
    return po.lines
      .map((line) => {
        const remainingQty = Math.max(line.orderedQty - line.invoicedQty, 0);
        if (remainingQty <= 0) return null;

        return {
          poLineId: line.lineId,
          itemId: line.itemId,
          itemCode: line.itemCode,
          itemName: line.itemName,
          invoicedQty: remainingQty,
          uomId: line.uomId,
          uom: line.uom,
          unitPriceDoc: line.unitPriceDoc,
          taxCodeId: line.taxCodeId,
          warehouseId: line.warehouseId,
          description: line.description,
        } as EditableLine;
      })
      .filter((line): line is EditableLine => line !== null);
  };

  const loadReferenceData = async () => {
    const [settingsResult, vendorResult, orderResult, itemResult, taxResult, warehouseResult, formSettingsResult] = await Promise.all([
      purchasesApi.getSettings(),
      sharedApi.listParties({ role: 'VENDOR', active: true }),
      purchasesApi.listPOs({ limit: 500 }).catch(() => []),
      inventoryApi.listItems({ active: true, limit: 500 }),
      sharedApi.listTaxCodes({ active: true }),
      inventoryApi.listWarehouses({ active: true }),
      voucherFormApi.listSettings('PURCHASE').catch(() => []),
    ]);

    const currentSettings = unwrap<PurchaseSettingsDTO | null>(settingsResult);
    const vendorList = unwrap<PartyDTO[]>(vendorResult);
    const orderList = unwrap<PurchaseOrderDTO[]>(orderResult);
    const itemList = unwrap<InventoryItemDTO[]>(itemResult);
    const taxCodeList = unwrap<TaxCodeDTO[]>(taxResult);
    const warehouseList = unwrap<InventoryWarehouseDTO[]>(warehouseResult);
    const formSettingsList = unwrap<FormSettingsRecord[]>(formSettingsResult);

    setSettings(currentSettings);
    setVendors(Array.isArray(vendorList) ? vendorList : []);
    setPurchaseOrders(Array.isArray(orderList) ? orderList : []);
    setItems(Array.isArray(itemList) ? itemList : []);
    setTaxCodes(Array.isArray(taxCodeList) ? taxCodeList : []);
    setWarehouses(Array.isArray(warehouseList) ? warehouseList : []);
    const normalizedFormSettings = Array.isArray(formSettingsList) ? formSettingsList : [];
    setFormSettings(normalizedFormSettings);
    return normalizedFormSettings;
  };

  const ensureItemUomOptions = async (itemId: string) => {
    if (!itemId || uomOptionsByItemId[itemId] || !itemById[itemId]) return;
    try {
      const result = await inventoryApi.listUomConversions(itemId);
      const conversions = unwrap<UomConversionDTO[]>(result) || [];
      setUomOptionsByItemId((current) => ({
        ...current,
        [itemId]: buildItemUomOptions(itemById[itemId], conversions),
      }));
    } catch (loadError) {
      console.error('Failed to load UOM conversions', loadError);
      setUomOptionsByItemId((current) => ({
        ...current,
        [itemId]: buildItemUomOptions(itemById[itemId], []),
      }));
    }
  };

  const loadPurchaseOrderLines = async (orderId: string) => {
    const trimmedOrderId = orderId.trim();
    if (!trimmedOrderId) return;

    try {
      setOrderLineLoading(true);
      setError(null);

      const orderResult = await purchasesApi.getPO(trimmedOrderId);
      const po = unwrap<PurchaseOrderDTO>(orderResult);
      const nextLines = toEditableLinesFromPurchaseOrder(po);

      setForm((prev) => ({
        ...prev,
        purchaseOrderId: trimmedOrderId,
        vendorId: po.vendorId,
        currency: po.currency,
        exchangeRate: po.exchangeRate,
        warehouseId: undefined,
        lines: nextLines.length ? nextLines : [createEmptyLine()],
      }));
    } catch (err: any) {
      console.error('Failed to load purchase order lines', err);
      setError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          t('invoiceDetail.errors.poLoadFailed', 'Failed to load purchase order lines.')
      );
    } finally {
      setOrderLineLoading(false);
    }
  };

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const loadedFormSettings = await loadReferenceData();

      if (!isCreateMode && params.id) {
        const result = await purchasesApi.getPI(params.id);
        const loaded = unwrap<PurchaseInvoiceDTO>(result);
        setInvoice(loaded);
        setAttachments(Array.isArray(loaded.attachments) ? loaded.attachments : []);
      } else {
        setInvoice(null);
        setAttachments([]);
        setPendingAttachmentFiles([]);
        setForm(createEmptyForm(initialPurchaseOrderId, initialVendorId, resolveConfiguredLinePriceSource(loadedFormSettings)));
        if (initialPurchaseOrderId) {
          await loadPurchaseOrderLines(initialPurchaseOrderId);
        }
      }
    } catch (err: any) {
      console.error('Failed to load purchase invoice detail', err);
      setError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          t('invoiceDetail.errors.loadFailed', 'Failed to load purchase invoice.')
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [params.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const ids = Array.from(new Set(form.lines.map((line) => line.itemId).filter(Boolean)));
    ids.forEach((itemId) => {
      void ensureItemUomOptions(itemId);
    });
  }, [form.lines, itemById]); // eslint-disable-line react-hooks/exhaustive-deps

  const triggerLinePriceLookup = async (vendorId: string, itemId: string, qty: number, lineIndex: number) => {
    if (!vendorId || !itemId) return;
    const line = form.lines[lineIndex];
    if (line?.priceLocked) return; // Task 243 Part C — locked lines never auto-resolve
    const effectiveSource: LinePriceSource = line?.priceSourceOverride ?? form.linePriceSource;
    try {
      const result = await purchasesApi.getEffectivePurchasePrice({
        vendorId,
        itemId,
        qty,
        asOfDate: form.invoiceDate || undefined,
        currency: form.currency,
      exchangeRate: Number(form.exchangeRate || 1),
      uomId: line?.uomId,
      uom: line?.uom,
      priceSource: effectiveSource,
    });
      if (result && result.unitPrice != null) {
        setForm(currentForm => {
          const currentLines = [...currentForm.lines];
          if (currentLines[lineIndex] && currentLines[lineIndex].itemId === itemId) {
            currentLines[lineIndex] = { ...currentLines[lineIndex], unitPriceDoc: result.unitPrice };
          }
          return { ...currentForm, lines: currentLines };
        });
      }
    } catch (err) {
      console.error('Failed to resolve effective purchase price', err);
    }
  };

  const refreshLinePrices = async (priceSource: LinePriceSource = form.linePriceSource) => {
    if (!form.vendorId) return;
    await Promise.all(
      form.lines.map(async (line, index) => {
        if (!line.itemId) return;
        if (line.priceLocked) return; // Task 243 Part C — locked lines never auto-resolve
        const effectiveSource: LinePriceSource = line.priceSourceOverride ?? priceSource;
        try {
          const result = await purchasesApi.getEffectivePurchasePrice({
            vendorId: form.vendorId,
            itemId: line.itemId,
            qty: line.invoicedQty || 1,
            asOfDate: form.invoiceDate || undefined,
            currency: form.currency,
            exchangeRate: Number(form.exchangeRate || 1),
            uomId: line.uomId,
            uom: line.uom,
            priceSource: effectiveSource,
          });
          if (result?.unitPrice != null) {
            setForm((currentForm) => {
              const currentLines = [...currentForm.lines];
              if (currentLines[index]?.itemId === line.itemId) {
                currentLines[index] = { ...currentLines[index], unitPriceDoc: result.unitPrice };
              }
              return { ...currentForm, lines: currentLines };
            });
          }
        } catch (err) {
          console.error('Failed to refresh effective purchase price', err);
        }
      }),
    );
  };

  // Task 243 Part C — right-click handlers (purchases).
  const handleDocumentPriceSourceOverride = (source: LinePriceSource) => {
    if (form.linePriceSource === source) return;
    setForm((prev) => ({ ...prev, linePriceSource: source }));
    void refreshLinePrices(source);
    toast.success(
      t('pricing.override.toastDocumentOverrideSet', 'Document price source set to {{source}}', {
        source: source.replace(/_/g, ' '),
      }),
    );
  };
  const handleResetDocumentPriceSource = () => {
    if (form.linePriceSource === 'LAST_PARTY_PRICE') return;
    setForm((prev) => ({ ...prev, linePriceSource: 'LAST_PARTY_PRICE' }));
    void refreshLinePrices('LAST_PARTY_PRICE');
    toast.success(
      t('pricing.override.toastOverrideCleared', 'Override cleared — using document source'),
    );
  };
  const handleLinePriceSourceOverride = (rowIndex: number | undefined, source: LinePriceSource | null) => {
    if (rowIndex == null) return;
    setLine(rowIndex, { priceSourceOverride: source, priceLocked: false });
    if (source) {
      toast.success(
        t('pricing.override.toastLineOverrideSet', 'Line price source set to {{source}}', {
          source: source.replace(/_/g, ' '),
        }),
      );
    } else {
      toast.success(
        t('pricing.override.toastOverrideCleared', 'Override cleared — using document source'),
      );
    }
  };
  const handleLinePriceLocked = (rowIndex: number | undefined, locked: boolean) => {
    if (rowIndex == null) return;
    setLine(rowIndex, { priceLocked: locked, priceSourceOverride: null });
    if (locked) {
      toast.success(
        t('pricing.override.toastLineLocked', 'Line locked — price will not be auto-resolved'),
      );
    } else {
      toast.success(
        t('pricing.override.toastOverrideCleared', 'Override cleared — using document source'),
      );
    }
  };

  // Trigger pricing refresh when vendor changes
  useEffect(() => {
    if (!form.vendorId) return;
    form.lines.forEach((line, index) => {
      if (line.itemId) {
        void triggerLinePriceLookup(form.vendorId, line.itemId, line.invoicedQty, index);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.vendorId]);

  const setLine = (index: number, patch: Partial<EditableLine>) => {
    setForm((prev) => {
      const lines = [...prev.lines];
      const current = lines[index];
      const next: EditableLine = { ...current, ...patch };

      if (patch.itemId !== undefined) {
        const item = itemById[patch.itemId];
        if (item) {
          const defaultUom = getDefaultItemUomOption(item, 'purchase');
          next.itemCode = item.code;
          next.itemName = item.name;
          next.uomId = next.uomId || defaultUom?.uomId;
          next.uom = next.uom || defaultUom?.code || item.purchaseUom || item.baseUom;
          if (!next.warehouseId && (prev.warehouseId || settings?.defaultWarehouseId)) {
            next.warehouseId = prev.warehouseId || settings?.defaultWarehouseId;
          }
          if (!next.taxCodeId && item.defaultPurchaseTaxCodeId) {
            const defaultTax = purchaseTaxCodes.find((taxCode) => taxCode.id === item.defaultPurchaseTaxCodeId);
            if (defaultTax) next.taxCodeId = defaultTax.id;
          }
          // Trigger price lookup
          if (prev.vendorId) {
            void triggerLinePriceLookup(prev.vendorId, patch.itemId, next.invoicedQty, index);
          }
        } else {
          next.itemCode = undefined;
          next.itemName = undefined;
          next.taxCodeId = undefined;
        }
      } else if (patch.invoicedQty !== undefined && current.itemId && prev.vendorId) {
        void triggerLinePriceLookup(prev.vendorId, current.itemId, patch.invoicedQty, index);
      }

      lines[index] = next;
      return { ...prev, lines };
    });
  };

  const addLine = () => {
    setForm((prev) => ({ ...prev, lines: [...prev.lines, createEmptyLine()] }));
  };

  const removeLine = (index: number) => {
    setForm((prev) => {
      if (prev.lines.length <= 1) return prev;
      return {
        ...prev,
        lines: prev.lines.filter((_, idx) => idx !== index),
      };
    });
  };

  // Whole-invoice charge/discount entry via a single modal opened from the allocation grid.
  const openChargeModal = (kind: 'CHARGE' | 'DISCOUNT', editIndex: number | null = null) => {
    if (editIndex !== null) {
      const existing = form.charges[editIndex];
      setChargeModal({
        kind: existing.kind === 'DISCOUNT' ? 'DISCOUNT' : 'CHARGE',
        editIndex,
        accountId: existing.accountId || '',
        accountLabel: existing.accountLabel || '',
        amount: existing.amountDoc || 0,
        description: existing.name || '',
      });
      return;
    }
    setChargeModal({
      kind,
      editIndex: null,
      // Both default to the purchase expense account; the server credits it for discounts.
      accountId: settings?.defaultPurchaseExpenseAccountId || '',
      accountLabel: '',
      amount: 0,
      description: '',
    });
  };
  const closeChargeModal = () => setChargeModal(null);
  const saveChargeModal = () => {
    if (!chargeModal) return;
    const description = chargeModal.description.trim();
    const amount = roundMoney(chargeModal.amount || 0);
    if (!description || amount <= 0) return;
    const entry: EditableCharge = {
      chargeId: chargeModal.editIndex !== null ? form.charges[chargeModal.editIndex]?.chargeId || nextPiChargeId() : nextPiChargeId(),
      kind: chargeModal.kind,
      name: description,
      amountDoc: amount,
      accountId: chargeModal.accountId || undefined,
      accountLabel: chargeModal.accountLabel || undefined,
    };
    setForm((prev) => {
      const charges = [...prev.charges];
      if (chargeModal.editIndex !== null) charges[chargeModal.editIndex] = entry;
      else charges.push(entry);
      return { ...prev, charges };
    });
    setChargeModal(null);
  };
  const removeCharge = (index: number) => {
    setForm((prev) => ({ ...prev, charges: prev.charges.filter((_, idx) => idx !== index) }));
  };

  const renderAllocationGrid = (readOnly: boolean) => {
    const baseCurrency = company?.baseCurrency || 'USD';
    const showBase = form.currency !== baseCurrency;
    const accountLabelFor = (charge: EditableCharge) => {
      // Rows added in this session carry a display label; rows loaded from the
      // server only carry the account id, so resolve it to "CODE — Name" here.
      if (charge.accountLabel) return charge.accountLabel;
      if (charge.accountId) {
        const acc = getAccountById(charge.accountId);
        if (acc) return `${acc.code} — ${acc.name}`;
        return charge.accountId;
      }
      return charge.kind === 'DISCOUNT'
        ? t('invoiceDetail.charges.defaultDiscountAccount', 'Default discount account')
        : t('invoiceDetail.charges.defaultAccount', 'Default expense account');
    };
    const rows: ChargeAllocationRow[] = form.charges.map((charge, index) => ({
      key: charge.chargeId || String(index),
      kind: charge.kind,
      name: charge.name,
      accountLabel: accountLabelFor(charge),
      amountDoc: charge.amountDoc || 0,
      amountBase: roundMoney((charge.amountDoc || 0) * (form.exchangeRate || 0)),
    }));

    return (
      <DocumentChargesAllocation
        tns="purchases.invoiceDetail"
        rows={rows}
        currency={form.currency}
        baseCurrency={baseCurrency}
        showBase={showBase}
        isReadOnly={readOnly}
        busy={busy}
        onAddCharge={() => openChargeModal('CHARGE')}
        onAddDiscount={() => openChargeModal('DISCOUNT')}
        onEditRow={(index) => openChargeModal(form.charges[index]?.kind || 'CHARGE', index)}
        onRemoveRow={removeCharge}
      />
    );
  };

  const renderChargeModal = () => (
    <DocumentChargeModal
      tns="purchases.invoiceDetail"
      state={chargeModal}
      currency={form.currency}
      onChange={setChargeModal}
      onClose={closeChargeModal}
      onSave={saveChargeModal}
      chargeClassifications={['EXPENSE', 'ASSET']}
      discountClassifications={['REVENUE', 'EXPENSE']}
      chargeContextLabel="Expense"
      discountContextLabel="Discount"
    />
  );

  const isFilledLine = (line: EditableLine): boolean =>
    Boolean(line.itemId || line.itemCode || line.itemName || line.description || line.taxCodeId || line.invoicedQty || line.unitPriceDoc || line.discountValue);

  const validateBeforeSave = (): string | null => {
    if (!form.vendorId) return t('invoiceDetail.validation.vendorRequired', 'Vendor is required.');
    if (!form.invoiceDate) return t('invoiceDetail.validation.invoiceDateRequired', 'Invoice date is required.');
    if (!form.currency.trim()) return t('invoiceDetail.validation.currencyRequired', 'Currency is required.');
    if (Number.isNaN(form.exchangeRate) || form.exchangeRate <= 0) return t('invoiceDetail.validation.exchangeRateInvalid', 'Exchange rate must be greater than 0.');
    // Validate only filled lines — ignore the line table's trailing empty working row.
    const filled = form.lines.filter(isFilledLine);
    if (!filled.length) return t('invoiceDetail.validation.linesRequired', 'At least one line is required.');

    for (let i = 0; i < filled.length; i += 1) {
      const line = filled[i];
      const item = itemById[line.itemId];
      if (!line.itemId) return t('invoiceDetail.validation.lineItemRequired', 'Line {{n}}: item is required.', { n: i + 1 });
      if (Number.isNaN(line.invoicedQty) || line.invoicedQty <= 0) return t('invoiceDetail.validation.lineQtyInvalid', 'Line {{n}}: quantity must be greater than 0.', { n: i + 1 });
      if (Number.isNaN(line.unitPriceDoc) || line.unitPriceDoc < 0) {
        return t('invoiceDetail.validation.lineUnitCostInvalid', 'Line {{n}}: unit cost must be greater than or equal to 0.', { n: i + 1 });
      }
      // Warehouse is mandatory for stock items when direct invoicing is enabled
      const isStockItem = item?.trackInventory ?? true; // Default to true if unsure
      if (isStockItem && !(line.warehouseId || (!line.poLineId && form.warehouseId))) {
        return t('invoiceDetail.validation.lineWarehouseRequired', 'Line {{n}}: Warehouse is required for stock item "{{name}}".', { n: i + 1, name: item?.name || line.itemId });
      }
    }

    return null;
  };

  const buildLinePayload = (line: EditableLine, index: number): PurchaseInvoiceLineInputDTO => {
    const item = itemById[line.itemId];
    // Resolve the EFFECTIVE inclusive flag — line override wins, otherwise inherit
    // from the chosen tax code's default. Without this, the backend defaults to
    // exclusive math and the posted voucher disagrees with the form's display.
    const taxCode = line.taxCodeId ? taxById[line.taxCodeId] : undefined;
    const effectiveInclusive =
      line.priceIsInclusive !== undefined ? line.priceIsInclusive : taxCode?.priceIsInclusive === true;
    return {
      lineId: line.lineId,
      lineNo: index + 1,
      poLineId: line.poLineId || undefined,
      grnLineId: line.grnLineId || undefined,
      itemId: line.itemId || undefined,
      invoicedQty: line.invoicedQty,
      uomId: line.uomId,
      uom: line.uom || item?.purchaseUom || item?.baseUom || 'EA',
      unitPriceDoc: line.unitPriceDoc,
      discountType: line.discountType,
      discountValue: line.discountValue,
      taxCodeId: line.taxCodeId || undefined,
      priceIsInclusive: effectiveInclusive,
      warehouseId: line.warehouseId || (!line.poLineId ? form.warehouseId : undefined) || undefined,
      description: line.description || undefined,
    };
  };

  const validateAttachmentFile = (file: File, currentCount: number): string | null => {
    if (currentCount >= MAX_ATTACHMENT_FILES) {
      return t('invoices.attachments.limitError', 'Maximum 5 files per invoice.');
    }
    if (file.size > MAX_ATTACHMENT_SIZE) {
      return t('invoices.attachments.sizeError', 'File must be 10 MB or smaller.');
    }
    if (!ALLOWED_ATTACHMENT_TYPES.includes(file.type)) {
      return t('invoices.attachments.typeError', 'Unsupported file type.');
    }
    return null;
  };

  const uploadPendingAttachments = async (invoiceId: string) => {
    if (pendingAttachmentFiles.length === 0) return;

    const failed: string[] = [];
    for (const file of pendingAttachmentFiles) {
      try {
        await purchasesApi.uploadInvoiceAttachment(invoiceId, file);
      } catch {
        failed.push(file.name);
      }
    }

    if (failed.length > 0) {
      errorHandler.showError(
        t('invoices.attachments.pendingUploadPartialError', {
          defaultValue: 'Invoice saved, but some attachments failed to upload: {{files}}',
          files: failed.join(', '),
        })
      );
    } else {
      errorHandler.showSuccess(t('invoices.attachments.pendingUploadSuccess', 'Invoice saved and attachments uploaded.'));
      setPendingAttachmentFiles([]);
    }
  };

  const saveInvoice = async () => {
    const validationError = validateBeforeSave();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setBusy(true);
      setError(null);

      const payload: CreatePurchaseInvoicePayload = {
        source: 'native',
        purchaseOrderId: form.purchaseOrderId || undefined,
        vendorId: form.vendorId,
        vendorInvoiceNumber: form.vendorInvoiceNumber || undefined,
        invoiceDate: form.invoiceDate,
        dueDate: form.dueDate || undefined,
        currency: form.currency.toUpperCase(),
        exchangeRate: form.exchangeRate,
        lines: form.lines.filter(isFilledLine).map((line, index) => buildLinePayload(line, index)),
        charges: form.charges.filter((c) => c.name?.trim() && (c.amountDoc || 0) > 0).map((charge) => ({
          chargeId: charge.chargeId,
          kind: charge.kind === 'DISCOUNT' ? 'DISCOUNT' as const : 'CHARGE' as const,
          name: charge.name,
          amountDoc: charge.amountDoc,
          accountId: charge.accountId || undefined,
        })),
        notes: form.notes || undefined,
      };

      if (isCreateMode) {
        const created = await purchasesApi.createPI(payload);
        const dto = unwrap<PurchaseInvoiceDTO>(created);
        await uploadPendingAttachments(dto.id);
        navigate(`/purchases/invoices/${dto.id}`, { replace: true });
      } else if (params.id) {
        const updated = await purchasesApi.updatePI(params.id, payload);
        setInvoice(unwrap<PurchaseInvoiceDTO>(updated));
        setIsEditMode(false);
      }
    } catch (err: any) {
      console.error('Failed to save purchase invoice', err);
      setError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          t('invoiceDetail.errors.saveFailed', 'Failed to save purchase invoice.')
      );
    } finally {
      setBusy(false);
    }
  };

  const createAndPostDraft = async () => {
    const validationError = validateBeforeSave();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setBusy(true);
      setError(null);

      const outstanding = roundMoney(totals.grandTotalBase);
      const useSettlement = settlementMode !== 'DEFERRED' && outstanding > 0.005;

      const settlementInput = useSettlement ? {
        settlementMode,
        receivablePayableAccountId: apAccountId,
        settlements: settlementRows.map(r => ({
          settlementAccountId: r.settlementAccountId,
          amountBase: r.amountBase,
          paymentMethod: r.paymentMethod as any,
          reference: r.reference || undefined,
          notes: r.notes || undefined,
          paymentDate: r.paymentDate || undefined,
        })),
      } : undefined;

      const payload: CreatePurchaseInvoicePayload = {
        source: 'native',
        purchaseOrderId: form.purchaseOrderId || undefined,
        vendorId: form.vendorId,
        vendorInvoiceNumber: form.vendorInvoiceNumber || undefined,
        invoiceDate: form.invoiceDate,
        dueDate: form.dueDate || undefined,
        currency: form.currency.toUpperCase(),
        exchangeRate: form.exchangeRate,
        lines: form.lines.filter(isFilledLine).map((line, index) => buildLinePayload(line, index)),
        charges: form.charges.filter((c) => c.name?.trim() && (c.amountDoc || 0) > 0).map((charge) => ({
          chargeId: charge.chargeId,
          kind: charge.kind === 'DISCOUNT' ? 'DISCOUNT' as const : 'CHARGE' as const,
          name: charge.name,
          amountDoc: charge.amountDoc,
          accountId: charge.accountId || undefined,
        })),
        notes: form.notes || undefined,
        settlementInput,
      };

      const created = await purchasesApi.createAndPostPI(payload);
      const dto = unwrap<PurchaseInvoiceDTO>(created);
      await uploadPendingAttachments(dto.id);
      navigate(`/purchases/invoices/${dto.id}`, { replace: true });
    } catch (err: any) {
      console.error('Failed to create and post purchase invoice', err);
      setError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          t('invoiceDetail.errors.createAndPostFailed', 'Failed to create and post purchase invoice.')
      );
    } finally {
      setBusy(false);
    }
  };

  const toggleEdit = () => {
    if (!invoice) return;
    setForm({
      purchaseOrderId: invoice.purchaseOrderId || '',
      vendorId: invoice.vendorId,
      vendorInvoiceNumber: invoice.vendorInvoiceNumber || '',
      invoiceDate: invoice.invoiceDate,
      dueDate: invoice.dueDate || '',
      currency: invoice.currency,
      exchangeRate: invoice.exchangeRate,
      linePriceSource: 'LAST_PARTY_PRICE',
      warehouseId: invoice.lines.find((line) => !line.poLineId && line.warehouseId)?.warehouseId || undefined,
      notes: invoice.notes || '',
      lines: invoice.lines.map((l) => ({
        lineId: l.lineId,
        poLineId: l.poLineId,
        grnLineId: l.grnLineId,
        itemId: l.itemId,
        itemCode: l.itemCode,
        itemName: l.itemName,
        invoicedQty: l.invoicedQty,
        uomId: l.uomId,
        uom: l.uom,
        unitPriceDoc: l.unitPriceDoc,
        discountType: l.discountType,
        discountValue: l.discountValue,
        priceIsInclusive: l.priceIsInclusive,
        taxCodeId: l.taxCodeId,
        warehouseId: l.warehouseId,
        description: l.description,
      })),
      charges: (invoice.charges || []).map((c) => ({
        chargeId: c.chargeId,
        kind: c.kind === 'DISCOUNT' ? 'DISCOUNT' as const : 'CHARGE' as const,
        code: c.code,
        name: c.name,
        amountDoc: c.amountDoc,
        accountId: c.accountId,
      })),
    });
    setRequestedSourceMode(invoice.purchaseOrderId ? 'po' : 'direct');
    setIsEditMode(true);
  };

  const postDraft = async () => {
    if (!invoice?.id) return;
    try {
      setBusy(true);
      setError(null);

      const settlementInput = settlementMode !== 'DEFERRED' ? {
        settlementMode,
        receivablePayableAccountId: apAccountId,
        settlements: settlementRows.map(r => ({
          settlementAccountId: r.settlementAccountId,
          amountBase: r.amountBase,
          paymentMethod: r.paymentMethod as any,
          reference: r.reference || undefined,
          notes: r.notes || undefined,
          paymentDate: r.paymentDate || undefined,
        })),
      } : undefined;

      // SoD: Purchases never approves. If the PI is already PENDING_APPROVAL,
      // bail out and direct the user to the Accounting Approval Center. Calling
      // approvePI from here would route the approval through the source module,
      // which violates the "one approval authority, one guard" architecture
      // (see docs/architecture/posting-authority.md §4.1 and Task 167).
      if (invoice.status === 'PENDING_APPROVAL') {
        setError(
          t('invoiceDetail.errors.soDGuard', 'This invoice is waiting for accounting approval. Approve it from Accounting → Approval Center.'),
        );
        return;
      }
      const posted = await purchasesApi.postPI(invoice.id, settlementInput);
      setInvoice(unwrap<PurchaseInvoiceDTO>(posted));
    } catch (err: any) {
      console.error('Failed to post purchase invoice', err);
      setError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          t('invoiceDetail.errors.postFailed', 'Failed to post purchase invoice.')
      );
    } finally {
      setBusy(false);
    }
  };

  const handlePostClick = () => {
    if (!invoice) return;
    // The inline SettlementBlock already holds the user's settlement rows.
    // Gate on its validity, then post directly. (#193 retired the old settlement
    // modal — re-opening it here silently wiped the entry.)
    if (settlementMode !== 'DEFERRED' && !settlementValidity.ok) {
      setError(settlementValidity.message || 'Settlement needs attention.');
      return;
    }
    postDraft();
  };

  const unpostPI = async () => {
    if (!invoice?.id) return;
    try {
      setBusy(true);
      setError(null);
      const unposted = await purchasesApi.unpostPI(invoice.id);
      setInvoice(unwrap<PurchaseInvoiceDTO>(unposted));
      setUnpostConfirmOpen(false);
    } catch (err: any) {
      console.error('Failed to unpost purchase invoice', err);
      setError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          t('invoiceDetail.errors.unpostFailed', 'Failed to unpost purchase invoice.')
      );
    } finally {
      setBusy(false);
    }
  };

  const refreshAttachments = async () => {
    if (!invoice?.id) return;
    const result = await purchasesApi.listInvoiceAttachments(invoice.id);
    const list = unwrap<PurchaseInvoiceAttachmentDTO[]>(result);
    const normalized = Array.isArray(list) ? list : [];
    setAttachments(normalized);
    setInvoice((current) => (current ? { ...current, attachments: normalized } : current));
  };

  const uploadAttachment = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const currentCount = invoice?.id ? attachments.length : pendingAttachmentFiles.length;
    const validationError = validateAttachmentFile(file, currentCount);
    if (validationError) {
      setError(validationError);
      errorHandler.showError(validationError);
      return;
    }

    if (!invoice?.id) {
      setPendingAttachmentFiles((current) => [...current, file]);
      errorHandler.showSuccess(t('invoices.attachments.queued', 'Attachment queued for upload when the invoice is saved.'));
      return;
    }

    try {
      setAttachmentBusy(true);
      setError(null);
      await purchasesApi.uploadInvoiceAttachment(invoice.id, file);
      await refreshAttachments();
      errorHandler.showSuccess(t('invoices.attachments.uploadSuccess', 'Attachment uploaded successfully.'));
    } catch (err: any) {
      const message =
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        err?.message ||
        t('invoices.attachments.uploadError', 'Failed to upload attachment.');
      setError(message);
      errorHandler.showError(message);
    } finally {
      setAttachmentBusy(false);
    }
  };

  const removeAttachment = async () => {
    if (!invoice?.id || !attachmentPendingDelete) return;
    try {
      setAttachmentDeletingId(attachmentPendingDelete.id);
      setError(null);
      await purchasesApi.removeInvoiceAttachment(invoice.id, attachmentPendingDelete.id);
      await refreshAttachments();
      errorHandler.showSuccess(t('invoices.attachments.removeSuccess', 'Attachment removed successfully.'));
      setAttachmentPendingDelete(null);
    } catch (err: any) {
      const message =
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        err?.message ||
        t('invoices.attachments.removeError', 'Failed to remove attachment.');
      setError(message);
      errorHandler.showError(message);
    } finally {
      setAttachmentDeletingId(null);
    }
  };

  const downloadAttachment = async (attachmentId: string) => {
    if (!invoice?.id) return;
    try {
      setError(null);
      const result = await purchasesApi.getInvoiceAttachmentDownloadLink(invoice.id, attachmentId);
      const payload = unwrap<{ url?: string }>(result);
      if (!payload?.url) {
        throw new Error(t('invoices.attachments.downloadError', 'Failed to generate download link.'));
      }
      window.open(payload.url, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      const message =
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        err?.message ||
        t('invoices.attachments.downloadError', 'Failed to generate download link.');
      setError(message);
      errorHandler.showError(message);
    }
  };

  const printInvoice = async () => {
    if (!invoice?.id) return;
    try {
      setPrintBusy(true);
      setError(null);
      const result = await purchasesApi.printPI(invoice.id);
      const payload = unwrap<PurchaseInvoicePrintResultDTO>(result);
      openPrintLayoutWindow(payload.payload, payload.printTemplate);
      errorHandler.showSuccess(t('invoiceDetail.printStarted', 'Print preview opened.'));
    } catch (err: any) {
      const message =
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        err?.message ||
        t('invoiceDetail.printFailed', 'Failed to print purchase invoice.');
      setError(message);
      errorHandler.showError(message);
    } finally {
      setPrintBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{t('invoiceDetail.loadingTitle', 'Purchase Invoice')}</h1>
        <Card className="p-6">{t('invoiceDetail.loadingMessage', 'Loading purchase invoice...')}</Card>
      </div>
    );
  }

  const hasUnsavedDocumentChanges = (() => {
    if (!(isCreateMode || isEditMode)) return false;
    const hasLines = form.lines.some((line) =>
      Boolean(line.itemId || line.itemCode || line.itemName || line.description || line.taxCodeId || line.invoicedQty || line.unitPriceDoc || line.discountValue)
    );
    const hasSettlement = settlementMode !== 'DEFERRED' || apAccountId.trim() || settlementRows.some((row) =>
      Boolean(row.settlementAccountId || row.amountBase || row.paymentMethod || row.reference.trim() || row.notes.trim())
    );
    return Boolean(
      form.purchaseOrderId ||
      form.vendorId ||
      form.vendorInvoiceNumber.trim() ||
      form.dueDate ||
      form.warehouseId ||
      form.notes.trim() ||
      hasLines ||
      hasSettlement ||
      pendingAttachmentFiles.length
    );
  })();

  const openNewInvoiceForm = () => {
    setInvoice(null);
    setForm(createEmptyForm('', ''));
    setRequestedSourceMode('direct');
    setAttachments([]);
    setPendingAttachmentFiles([]);
    setSettlementMode('DEFERRED');
    setApAccountId('');
    setSettlementRows([]);
    setIsEditMode(false);
    setError(null);
    navigate('/purchases/invoices/new');
  };

  if (isCreateMode || isEditMode) {
    const baseCurrency = company?.baseCurrency || 'USD';
    const activeSourceMode = form.purchaseOrderId || requestedSourceMode === 'po' ? 'po' : 'direct';
    const selectedPurchaseOrder = form.purchaseOrderId
      ? invoiceablePurchaseOrders.find((order) => order.id === form.purchaseOrderId)
      : undefined;
    const selectedVendorName =
      selectedPurchaseOrder?.vendorName ||
      vendorNameById[form.vendorId] ||
      form.vendorName ||
      '-';
    const selectedWarehouseName =
      form.warehouseId ? warehouseById[form.warehouseId]?.name || form.warehouseId : '-';
    const filledDraftLines = form.lines.filter((line) => line.itemId && line.invoicedQty > 0);
    const draftHasVendor = !!form.vendorId;
    const draftHasLines = filledDraftLines.length > 0;
    const draftBalanced = totals.grandTotalDoc >= 0;
    const draftTaxResolved = filledDraftLines.every((line) => !line.taxCodeId || !!taxById[line.taxCodeId]);
    const draftAttachmentInputId = isCreateMode ? 'purchase-invoice-draft-attachment-input' : 'purchase-invoice-edit-attachment-input';
    const draftAttachmentCount = invoice?.id ? attachments.length : pendingAttachmentFiles.length;
    const headerLabelClass = documentHeaderLabelClass;
    const headerFieldWrapperClass = 'min-w-0';
    const headerControlClass = documentHeaderControlClass;
    const headerSelectorClass = documentHeaderSelectorClass;

    const draftFooterSummary = (
      <DocumentFooterTotalsStrip
        totals={[
          { label: t('invoiceDetail.footer.subtotal', 'Subtotal'), value: `${form.currency} ${totals.subtotalDoc.toFixed(2)}` },
          { label: t('invoiceDetail.footer.tax', 'Tax'), value: `${form.currency} ${totals.taxTotalDoc.toFixed(2)}`, tone: 'blue' },
          { label: t('invoiceDetail.footer.grand', 'Grand'), value: `${form.currency} ${totals.grandTotalDoc.toFixed(2)}`, tone: 'green' },
        ]}
      />
    );
    const draftRailSections: DocumentScaffoldRailSections = {
      info: {
        title: t('invoiceDetail.rail.info', 'Info'),
        action: (
          <DocumentPill tone={railFocus.kind === 'item' ? 'blue' : railFocus.kind === 'warehouse' ? 'amber' : 'slate'}>
            {railFocus.kind === 'item'
              ? t('invoiceDetail.rail.item', 'Item')
              : railFocus.kind === 'warehouse'
                ? t('invoiceDetail.rail.warehouse', 'Warehouse')
                : t('invoiceDetail.rail.vendor', 'Vendor')}
          </DocumentPill>
        ),
        content: (
          <DocumentRailFocus
            code={railFocus.code || (form.purchaseOrderId ? selectedPurchaseOrder?.orderNumber || form.purchaseOrderId : t('invoiceDetail.rail.directBill', 'Direct bill'))}
            title={railFocus.title || selectedVendorName}
            subtitle={railFocus.subtitle || selectedWarehouseName || form.vendorInvoiceNumber || t('invoiceDetail.rail.vendorInvoiceMissing', 'Vendor invoice/reference not entered')}
            note={railFocus.note || t('invoiceDetail.rail.helpDraft', 'Select or hover over an item line to review purchasing details, warehouse, tax, and AP impact.')}
          />
        ),
      },
      readiness: {
        title: t('invoiceDetail.rail.readinessTitle', 'Posting Readiness'),
        content: (
          <DocumentRailChecklist
            items={[
              { state: draftHasVendor && draftHasLines && draftBalanced ? 'ok' : 'warn', label: t('invoiceDetail.rail.readinessBalanced', 'Balanced AP posting preview') },
              { state: draftTaxResolved ? 'ok' : 'warn', label: t('invoiceDetail.rail.readinessTaxResolved', 'Purchase tax accounts resolved') },
              { state: 'info', label: t('invoiceDetail.rail.readinessPolicyActive', 'AP, inventory, and approval policy active') },
            ]}
          />
        ),
      },
      settlement: {
        content: (
          <SettlementBlock
            variant="summary"
            module="purchases"
            mode={settlementMode}
            rows={settlementRows}
            partyAccountId={apAccountId}
            partyAccountLabel={selectedVendorName || apAccountId}
            outstandingBase={totals.grandTotalBase}
          />
        ),
      },
      totals: {
        title: t('invoiceDetail.rail.totalsTitle', 'Totals'),
        action: <DocumentPill tone="slate">{form.currency}</DocumentPill>,
        content: (
          <DocumentRailTotals
            rows={[
              { label: t('invoiceDetail.rail.totalsSubtotal', 'Subtotal'), value: `${form.currency} ${totals.subtotalDoc.toFixed(2)}` },
              { label: t('invoiceDetail.rail.totalsTax', 'Tax'), value: `${form.currency} ${totals.taxTotalDoc.toFixed(2)}` },
            ]}
            grand={{
              label: t('invoiceDetail.rail.totalsGrandTotal', 'Grand Total'),
              value: `${form.currency} ${totals.grandTotalDoc.toFixed(2)}`,
              ...(form.currency !== baseCurrency
                ? {
                    subLabel: t('invoiceDetail.rail.totalsGrandTotalBase', 'Grand Total (Base)'),
                    subValue: `${baseCurrency} ${totals.grandTotalBase.toFixed(2)}`,
                  }
                : {}),
            }}
          />
        ),
      },
    };

    return (
      <>
      <DocumentDetailScaffold
        title={isCreateMode ? t('invoiceDetail.createTitle', 'New Purchase Invoice') : t('invoiceDetail.editTitle', 'Edit {{number}}', { number: invoice?.invoiceNumber })}
        subtitle={t('invoiceDetail.subtitle', 'Vendor bill document. Posting creates AP and purchase/inventory entries.')}
        icon={FileText}
        backLabel={t('invoiceDetail.backLabel', 'Back to purchase invoices')}
        onBack={() => (isEditMode ? setIsEditMode(false) : navigate('/purchases/invoices'))}
        badges={
          <>
            <DocumentPill tone="slate">{isEditMode ? t('invoiceDetail.editDraftPill', 'Edit Draft') : t('invoiceDetail.draftPill', 'Draft')}</DocumentPill>
            {activeSourceMode === 'po' && <DocumentPill tone="blue">{t('invoiceDetail.fromPOPill', 'From PO')}</DocumentPill>}
          </>
        }
        railSections={draftRailSections}
        railTitle={t('invoiceDetail.railTitle', 'Purchase invoice side rail')}
        newAction={{
          label: t('invoiceDetail.newInvoice', 'New Invoice'),
          title: t('invoiceDetail.newInvoice', 'New Invoice'),
          hasUnsavedChanges: hasUnsavedDocumentChanges,
          onNew: openNewInvoiceForm,
        }}
        footerSections={{
          totals: {
            content: ({ showInlineRail, railDrawerOpen }) =>
              showInlineRail || railDrawerOpen ? (
                <div className="text-xs text-slate-500">
                  {t('invoiceDetail.footer.draftWorking', 'Editing draft purchase invoice.')}
                </div>
              ) : (
                draftFooterSummary
              ),
          },
          actions: {
            content: (
          <>
            <button
              type="button"
              className="rounded bg-slate-800 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-slate-900 disabled:opacity-50 dark:bg-slate-700"
              onClick={saveInvoice}
              disabled={busy || orderLineLoading}
            >
              {busy ? t('invoiceDetail.saving', 'Saving...') : isCreateMode ? t('invoiceDetail.saveDraft', 'Save Draft') : t('invoiceDetail.updateDraft', 'Update Draft')}
            </button>
            {isCreateMode && (
              <button
                type="button"
                className="rounded bg-blue-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                onClick={() => {
                  const outstanding = roundMoney(totals.grandTotalBase);
                  if (outstanding <= 0.005) {
                    setSettlementMode('DEFERRED');
                    createAndPostDraft();
                    return;
                  }
                  // Inline SettlementBlock holds the rows; gate on validity, then post.
                  // (#193 retired the old settlement modal — re-opening it wiped the entry.)
                  if (settlementMode !== 'DEFERRED' && !settlementValidity.ok) {
                    setError(settlementValidity.message || t('invoiceDetail.settlementNeedsAttention', 'Settlement needs attention.'));
                    return;
                  }
                  createAndPostDraft();
                }}
                disabled={busy || orderLineLoading}
              >
                {busy ? t('invoiceDetail.savingAndPosting', 'Saving & Posting...') : t('invoiceDetail.saveAndPost', 'Save & Post')}
              </button>
            )}
          </>
            ),
          },
        }}
        sections={{
          banner: {
            content: error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
            ) : null,
          },
          control: {
            content: (
        <DocumentControlPanel>
          <div className="grid gap-2 xl:grid-cols-[minmax(0,1fr)_auto]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <DocumentSegmentedGroup>
                <DocumentSegmentButton
                  active={activeSourceMode === 'direct'}
                  disabled={busy || orderLineLoading || isEditMode}
                  icon={FileText}
                  label={t('invoiceDetail.sourceDirect', 'Direct')}
                  onClick={() => {
                    setRequestedSourceMode('direct');
                    setForm((prev) => ({ ...prev, purchaseOrderId: '' }));
                  }}
                />
                <DocumentSegmentButton
                  active={activeSourceMode === 'po'}
                  disabled={busy || orderLineLoading || isEditMode}
                  icon={Link2}
                  label={t('invoiceDetail.sourceFromPO', 'From PO')}
                  onClick={() => setRequestedSourceMode('po')}
                />
              </DocumentSegmentedGroup>
              <button
                type="button"
                disabled
                className="inline-flex h-7 items-center gap-1.5 rounded border border-slate-200 bg-white px-2 text-[10px] font-black uppercase tracking-wide text-slate-500 disabled:cursor-default dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400"
              >
                <Link2 className="h-3.5 w-3.5" />
                {activeSourceMode === 'po' ? t('invoiceDetail.sourcePickPO', 'Pick PO in header') : t('invoiceDetail.sourceDirectHeaderDriven', 'Direct header driven')}
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-1.5 rounded-md border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-950/50">
              <input
                id={draftAttachmentInputId}
                type="file"
                className="hidden"
                accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx"
                onChange={uploadAttachment}
                disabled={attachmentBusy || (!invoice?.id && pendingAttachmentFiles.length >= MAX_ATTACHMENT_FILES)}
              />
              <DocumentIconButton
                title={t('invoices.attachments.upload', 'Upload Attachment')}
                onClick={() => document.getElementById(draftAttachmentInputId)?.click()}
                disabled={attachmentBusy || (!invoice?.id && pendingAttachmentFiles.length >= MAX_ATTACHMENT_FILES)}
              >
                <Paperclip className="h-3.5 w-3.5" />
              </DocumentIconButton>
              <DocumentIconButton
                title={t('invoiceDetail.downloadExcel', 'Download Excel')}
                onClick={() => errorHandler.showWarning(t('invoiceDetail.excelNotConnected', 'Purchase invoice line export is not connected yet.'))}
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
              </DocumentIconButton>
              <DocumentIconButton
                title={t('invoiceDetail.uploadFromFile', 'Upload from file')}
                onClick={() => errorHandler.showWarning(t('invoiceDetail.importNotConnected', 'Purchase invoice file import is not connected yet.'))}
              >
                <Upload className="h-3.5 w-3.5" />
              </DocumentIconButton>
              <DocumentIconButton
                title={t('invoiceDetail.readFromImage', 'Read from image')}
                onClick={() => errorHandler.showWarning(t('invoiceDetail.imageNotConnected', 'Purchase invoice image reading is not connected yet.'))}
              >
                <FileImage className="h-3.5 w-3.5" />
              </DocumentIconButton>
            </div>
          </div>
        </DocumentControlPanel>
            ),
          },
          header: {
            title: activeSourceMode === 'po' ? t('invoiceDetail.header.fromPO', 'Header - From Purchase Order') : t('invoiceDetail.header.directBill', 'Header - Direct Bill'),
            cardClassName: 'overflow-visible',
            action: (
            <div className="flex items-center gap-1.5">
              <DocumentPill tone={activeSourceMode === 'po' ? 'blue' : 'slate'}>
                {activeSourceMode === 'po' ? t('invoiceDetail.fromPOPill', 'From PO') : t('invoiceDetail.sourceDirect', 'Direct')}
              </DocumentPill>
              <DocumentPill tone="slate">{form.currency}</DocumentPill>
              {draftHasVendor && (
                <DocumentPill tone="green">
                  <ShieldCheck className="h-3 w-3" />
                  {t('invoiceDetail.header.apReady', 'AP Ready')}
                </DocumentPill>
              )}
            </div>
            ),
            content: (
          <DocumentHeaderGrid>
            {activeSourceMode === 'po' ? (
              <>
                <div className={headerFieldWrapperClass}>
                  <label className={headerLabelClass}>{t('invoiceDetail.header.purchaseOrder', 'Purchase Order')}</label>
                  <select
                    className={headerControlClass}
                    value={form.purchaseOrderId}
                    onChange={(e) => {
                      const nextOrderId = e.target.value;
                      setRequestedSourceMode('po');
                      if (!nextOrderId) {
                        setForm((prev) => ({ ...prev, purchaseOrderId: '' }));
                        return;
                      }
                      void loadPurchaseOrderLines(nextOrderId);
                    }}
                    disabled={busy || orderLineLoading || isEditMode}
                  >
                    <option value="">{t('invoiceDetail.header.selectPO', 'Select invoiceable purchase order...')}</option>
                    {invoiceablePurchaseOrders.map((order) => (
                      <option key={order.id} value={order.id}>
                        {order.orderNumber} - {vendorNameById[order.vendorId] || order.vendorName} ({order.status})
                      </option>
                    ))}
                  </select>
                </div>
                <DocumentField label={t('invoiceDetail.header.vendor', 'Vendor')} value={selectedVendorName} locked />
              </>
            ) : (
              <div className={headerFieldWrapperClass} onFocus={() => focusVendor()} onMouseEnter={() => focusVendor()}>
                <label className={headerLabelClass}>{t('invoiceDetail.header.vendor', 'Vendor')}</label>
                <PartySelector
                  role="VENDOR"
                  placeholder={t('invoiceDetail.header.selectVendor', 'Select vendor...')}
                  className={headerSelectorClass}
                  value={form.vendorId}
                  onChange={(party) => {
                    setForm((prev) => ({
                      ...prev,
                      vendorId: party?.id || '',
                      vendorName: party?.displayName || '',
                      currency: party?.defaultCurrency || prev.currency,
                    }));
                    focusVendor(party?.id || '', party?.displayName || '');
                  }}
                />
              </div>
            )}

            <div className={headerFieldWrapperClass}>
              <label className={headerLabelClass}>{t('invoiceDetail.header.vendorInvoiceNumber', 'Vendor Invoice / Ref')}</label>
              <input
                type="text"
                className={headerControlClass}
                value={form.vendorInvoiceNumber}
                onChange={(e) => setForm((prev) => ({ ...prev, vendorInvoiceNumber: e.target.value }))}
              />
            </div>

            <div className={headerFieldWrapperClass}>
              <label className={headerLabelClass}>{t('invoiceDetail.header.invoiceDate', 'Invoice Date')}</label>
              <DatePicker
                className="w-full"
                inputClassName={clsx(headerControlClass, 'pr-8')}
                value={form.invoiceDate}
                onChange={(val) => setForm((prev) => ({ ...prev, invoiceDate: val }))}
              />
            </div>

            <div className={headerFieldWrapperClass}>
              <label className={headerLabelClass}>{t('invoiceDetail.header.dueDate', 'Due Date')}</label>
              <DatePicker
                className="w-full"
                inputClassName={clsx(headerControlClass, 'pr-8')}
                value={form.dueDate}
                onChange={(val) => setForm((prev) => ({ ...prev, dueDate: val }))}
              />
            </div>

            <div className={headerFieldWrapperClass}>
              <label className={headerLabelClass}>{t('invoiceDetail.header.currency', 'Currency')}</label>
              <CurrencySelector
                className={headerSelectorClass}
                value={form.currency}
                onChange={(code) => setForm((prev) => ({ ...prev, currency: code }))}
                disabled={busy || activeSourceMode === 'po'}
              />
            </div>

            <div className={headerFieldWrapperClass}>
              <label className={headerLabelClass}>{t('invoiceDetail.header.exchangeRate', 'Exchange Rate')}</label>
              <div className="[&>div]:h-9 [&>div]:rounded">
                <CurrencyExchangeWidget
                  currency={form.currency}
                  baseCurrency={baseCurrency}
                  voucherDate={form.invoiceDate}
                  value={form.exchangeRate}
                  onChange={(rate) => setForm((prev) => ({ ...prev, exchangeRate: rate }))}
                  disabled={busy || activeSourceMode === 'po'}
                />
              </div>
            </div>

            {activeSourceMode === 'direct' && (
              <div className={headerFieldWrapperClass} onFocus={() => focusWarehouse()} onMouseEnter={() => focusWarehouse()}>
                <label className={headerLabelClass}>{t('invoiceDetail.header.mainWarehouse', 'Main Warehouse')}</label>
                <WarehouseSelector
                  className={headerSelectorClass}
                  value={form.warehouseId || settings?.defaultWarehouseId}
                  onChange={(warehouse) => {
                    const warehouseId = warehouse?.id || undefined;
                    setForm((prev) => ({
                      ...prev,
                      warehouseId,
                      lines: prev.lines.map((line) =>
                        line.poLineId || line.grnLineId
                          ? line
                          : { ...line, warehouseId: line.warehouseId || warehouseId }
                      ),
                    }));
                    focusWarehouse(warehouseId);
                  }}
                  disabled={busy}
                />
              </div>
            )}

            <LinePriceSourceSelector
              className={headerFieldWrapperClass}
              labelClassName={headerLabelClass}
              selectClassName={headerControlClass}
              value={form.linePriceSource}
              disabled={busy || activeSourceMode === 'po'}
              onChange={(source) => {
                setForm((prev) => ({ ...prev, linePriceSource: source }));
                void refreshLinePrices(source);
              }}
            />

            <div className="min-w-0 md:col-span-2 xl:col-span-2">
              <label className={headerLabelClass}>{t('invoiceDetail.header.notes', 'Notes')}</label>
              <textarea
                rows={1}
                className={clsx(headerControlClass, 'h-9 resize-none py-2')}
                value={form.notes}
                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
              />
            </div>
          </DocumentHeaderGrid>
            ),
          },
          lines: {
            content: (
          <ClassicLineItemsTable<EditableLine>
            tableId="purchases.invoice.lines"
            rows={form.lines}
            disabled={busy}
            onRowChange={(index, patch) => setLine(index, patch)}
            onRowRemove={(index) => removeLine(index)}
            onRowsChange={(lines) => setForm((prev) => ({ ...prev, lines }))}
            createEmptyRow={createEmptyLine}
            isRowFilled={(line) => Boolean(line.itemId || line.itemCode || line.itemName || line.description || line.taxCodeId || line.invoicedQty || line.unitPriceDoc || line.discountValue)}
            onRowAdd={addLine}
            addLabel={t('invoiceDetail.columns.addLabel', 'Add Item')}
            columns={[
              {
                id: 'item',
                label: t('invoiceDetail.columns.item', 'Item'),
                kind: 'custom',
                width: '240px',
                render: (row, index) => (
                  <div onFocus={() => focusItem(row)} onMouseEnter={() => focusItem(row)}>
                  <ItemSelector
                    value={row.itemId}
                    onChange={(item) => {
                      if (item) {
                        setLine(index, { itemId: item.id, itemCode: item.code, itemName: item.name });
                        focusItem({ ...row, itemId: item.id, itemCode: item.code, itemName: item.name });
                      } else {
                        // Clearing item resets the whole row.
                        const empty = createEmptyLine();
                        setLine(index, {
                          itemId: empty.itemId,
                          itemCode: empty.itemCode,
                          itemName: empty.itemName,
                          invoicedQty: empty.invoicedQty,
                          uomId: empty.uomId,
                          uom: empty.uom,
                          unitPriceDoc: empty.unitPriceDoc,
                          discountType: empty.discountType,
                          discountValue: empty.discountValue,
                          taxCodeId: empty.taxCodeId,
                          priceIsInclusive: undefined,
                          warehouseId: empty.warehouseId,
                          description: empty.description,
                        });
                      }
                    }}
                    noBorder
                    disabled={busy}
                  />
                  </div>
                ),
              },
              {
                id: 'qty',
                label: t('invoiceDetail.columns.qty', 'Qty'),
                kind: 'number',
                width: '80px',
                accessor: (row) => row.invoicedQty,
                setter: (value) => ({ invoicedQty: Number(value) }),
              },
              {
                id: 'uom',
                label: t('invoiceDetail.columns.uom', 'UOM'),
                kind: 'custom',
                width: '90px',
                render: (row, index) => {
                  return (
                    <UomSelector
                      item={itemById[row.itemId]}
                      itemId={row.itemId}
                      valueId={row.uomId}
                      valueCode={row.uom}
                      usage="purchase"
                      disabled={busy || !row.itemId}
                      noBorder
                      onChange={(selected) => setLine(index, { uomId: selected?.uomId, uom: selected?.code || '' })}
                    />
                  );
                },
              },
              {
                id: 'unitCost',
                label: t('invoiceDetail.columns.unitCost', 'Unit Cost'),
                kind: 'custom',
                width: '130px',
                labelExtras:
                  !busy && form.linePriceSource !== 'LAST_PARTY_PRICE' ? (
                    <LinePriceOverrideBadge variant="document" source={form.linePriceSource} />
                  ) : undefined,
                labelTitle: !busy
                  ? t(
                      'pricing.override.headerMenuTitle',
                      'Right-click the Unit Price column header to override the document source',
                    )
                  : undefined,
                render: (row, _index, onChange) => {
                  if (busy) {
                    return (
                      <div className="flex items-center gap-1.5">
                        <span className="flex-1 text-right text-xs text-slate-800 dark:text-slate-200 tabular-nums">
                          {row.unitPriceDoc ? Number(row.unitPriceDoc).toFixed(2) : '—'}
                        </span>
                        {row.priceLocked ? (
                          <LinePriceOverrideBadge variant="lineLocked" source={null} compact />
                        ) : row.priceSourceOverride ? (
                          <LinePriceOverrideBadge variant="line" source={row.priceSourceOverride} compact />
                        ) : null}
                      </div>
                    );
                  }
                  return (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={row.unitPriceDoc ? String(row.unitPriceDoc) : ''}
                        disabled={busy}
                        onChange={(e) => onChange({ unitPriceDoc: Number(e.target.value) || 0 })}
                        onFocus={(event) => { try { event.currentTarget.select(); } catch { /* noop */ } }}
                        className="h-9 min-w-0 flex-1 bg-transparent px-2 text-right text-xs text-slate-900 outline-none focus:bg-blue-50/40 dark:text-slate-100 dark:focus:bg-blue-950/20 font-mono"
                        placeholder=""
                      />
                      {row.priceLocked ? (
                        <LinePriceOverrideBadge variant="lineLocked" source={null} compact />
                      ) : row.priceSourceOverride ? (
                        <LinePriceOverrideBadge variant="line" source={row.priceSourceOverride} compact />
                      ) : null}
                    </div>
                  );
                },
              },
              {
                id: 'discountType',
                label: t('invoiceDetail.columns.discountType', 'Discount Type'),
                kind: 'custom',
                width: '64px',
                render: (row, _index, onChange) => (
                  <DiscountTypeSelector
                    noBorder
                    value={row.discountType}
                    currencyCode={form.currency}
                    disabled={busy || !row.itemId}
                    onChange={(next) => onChange({ discountType: next || undefined, discountValue: 0 })}
                  />
                ),
              },
              {
                id: 'discountValue',
                label: t('invoiceDetail.columns.discount', 'Discount'),
                kind: 'number',
                width: '70px',
                accessor: (row) => row.discountValue || 0,
                setter: (value) => ({ discountValue: Number(value) }),
              },
              {
                id: 'taxCode',
                label: t('invoiceDetail.columns.taxCode', 'Tax Code'),
                kind: 'custom',
                width: '120px',
                render: (row, index) => (
                  <TaxCodeSelector
                    noBorder
                    options={purchaseTaxCodes.map((tc) => ({ id: tc.id, code: tc.code, name: tc.name, rate: tc.rate }))}
                    valueId={row.taxCodeId}
                    disabled={busy || !row.itemId}
                    emptySetupMessage={t(
                      'purchases.invoiceDetail.taxCodeEmptyHint',
                      'No purchase tax codes set up. Create one with scope PURCHASE or BOTH to use it here.',
                    )}
                    onChange={(option) => setLine(index, { taxCodeId: option?.id })}
                  />
                ),
              },
              {
                id: 'lineTotal',
                label: t('invoiceDetail.columns.lineTotal', 'Line Total'),
                kind: 'computed',
                width: '110px',
                compute: (_row, index) => computedLines[index]?.lineGrossDoc ?? 0,
                solveFromTotal: (value, row) => ({ unitPriceDoc: solveUnitCostFromTotal(value, 'lineGross', row) }),
              },
              {
                id: 'net',
                label: t('invoiceDetail.columns.net', 'Net'),
                kind: 'computed',
                width: '100px',
                compute: (_row, index) => computedLines[index]?.lineTotalDoc ?? 0,
                solveFromTotal: (value, row) => ({ unitPriceDoc: solveUnitCostFromTotal(value, 'net', row) }),
              },
              {
                id: 'tax',
                label: t('invoiceDetail.columns.tax', 'Tax'),
                kind: 'computed',
                width: '90px',
                compute: (_row, index) => computedLines[index]?.taxAmountDoc ?? 0,
              },
              {
                id: 'netBase',
                label: t('invoiceDetail.columns.netBase', 'Net Base'),
                kind: 'computed',
                width: '110px',
                compute: (_row, index) => computedLines[index]?.lineTotalBase ?? 0,
              },
            ]}
            minRows={1}
            className="flex-1 [&>div:first-child]:h-full [&>div:first-child]:max-h-none"
            columnContextMenus={{
              unitCost: createDocumentPriceOverrideMenuItems({
                currentDocumentSource: form.linePriceSource,
                baseSource: 'LAST_PARTY_PRICE',
                onSelectDocumentSource: handleDocumentPriceSourceOverride,
                onResetDocumentSource: handleResetDocumentPriceSource,
              }),
            }}
            cellContextMenus={{
              unitCost: createLinePriceOverrideMenuItems({
                currentLineSource: null,
                currentLineLocked: false,
                onSelectLineSource: () => {},
                onToggleLineLocked: () => {},
              }).map((item) => ({
                ...item,
                onSelect: (rowIndex) => {
                  if (item.key === 'line-manual') {
                    handleLinePriceLocked(rowIndex, true);
                  } else if (item.key === 'line-none') {
                    handleLinePriceSourceOverride(rowIndex, null);
                  } else {
                    const source = item.key.replace(/^line-/, '') as LinePriceSource;
                    handleLinePriceSourceOverride(rowIndex, source);
                  }
                },
              })),
            }}
          />
            ),
          },
          secondary: {
            content: renderAllocationGrid(false),
          },
          attachments: {
            content: (
        <div className="grid gap-2 md:grid-cols-2">
          <DocumentCompactCard
            title={t('invoices.attachments.title', 'Attachments')}
            action={
              <label
                htmlFor={draftAttachmentInputId}
                className="inline-flex h-6 cursor-pointer items-center rounded border border-slate-200 px-2 text-[10px] font-black uppercase tracking-wide text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                {attachmentBusy ? t('invoices.attachments.uploading', 'Uploading...') : t('invoices.attachments.upload', 'Upload')}
              </label>
            }
          >
            <div className="min-h-[56px] p-2.5 text-xs">
              <div className="flex items-center gap-2">
                <Paperclip className="h-4 w-4 text-slate-500" />
                <div className="min-w-0">
                  <div className="font-black text-slate-900 dark:text-slate-100">
                    {draftAttachmentCount} {t('invoiceDetail.attachmentCount', { defaultValue: 'file', count: draftAttachmentCount })}
                  </div>
                  <div className="truncate text-[11px] text-slate-500">
                    {invoice?.id
                      ? t('invoices.attachments.help', 'Allowed: PDF, PNG, JPG, DOCX, XLSX. Max 10 MB per file, 5 files per invoice.')
                      : t('invoices.attachments.unsavedHelp', 'Files selected here are queued locally and uploaded automatically when the invoice is saved.')}
                  </div>
                </div>
              </div>

              {!invoice?.id && pendingAttachmentFiles.length > 0 && (
                <div className="mt-2 grid gap-1">
                  {pendingAttachmentFiles.map((file, index) => (
                    <div
                      key={`${file.name}-${file.lastModified}-${index}`}
                      className="flex items-center justify-between gap-2 rounded border border-slate-200 bg-slate-50 px-2 py-1 dark:border-slate-800 dark:bg-slate-900/40"
                    >
                      <div className="min-w-0 truncate font-medium text-slate-700 dark:text-slate-200">
                        {file.name}
                      </div>
                      <button
                        type="button"
                        className="shrink-0 text-[10px] font-black uppercase text-rose-600"
                        onClick={() => setPendingAttachmentFiles((current) => current.filter((_, idx) => idx !== index))}
                      >
                        {t('invoices.attachments.remove', 'Remove')}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </DocumentCompactCard>

          <DocumentCompactCard
            title={t('invoiceDetail.audit.title', 'Audit & Warnings')}
            action={<DocumentPill tone={draftHasVendor && draftHasLines ? 'green' : 'amber'}>{draftHasVendor && draftHasLines ? t('invoiceDetail.audit.ready', 'Ready') : t('invoiceDetail.audit.open', 'Open')}</DocumentPill>}
          >
            <div className="flex min-h-[56px] items-center gap-2 p-2.5 text-xs">
              <History className="h-4 w-4 text-slate-500" />
              <div className="min-w-0">
                <div className="font-black text-slate-900 dark:text-slate-100">
                  {t('invoiceDetail.audit.draftChecks', 'Draft checks')}
                </div>
                <div className="truncate text-[11px] text-slate-500">
                  {t('invoiceDetail.audit.draftDescription', 'Vendor, line, warehouse, tax, AP, and attachment warnings remain visible before saving.')}
                </div>
              </div>
            </div>
          </DocumentCompactCard>
        </div>
            ),
          },
          custom: {
            content: (
        <SettlementBlock
          module="purchases"
          mode={settlementMode}
          onModeChange={setSettlementMode}
          rows={settlementRows}
          onRowsChange={setSettlementRows}
          partyAccountId={apAccountId}
          partyAccountLabel={selectedVendorName || apAccountId}
          outstandingBase={totals.grandTotalBase}
          paymentMethodConfigs={(settings as any)?.paymentMethodConfigs || []}
          allowOverpayment={(settings as any)?.allowOverpayment === true}
          currencyCode={form.currency}
          onValidityChange={setSettlementValidity}
        />
            ),
          },
        }}
      />
      {renderChargeModal()}
      </>
    );
  }

  if (!invoice) {
    return (
      <div className="space-y-4 p-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{t('invoiceDetail.notFoundTitle', 'Purchase Invoice')}</h1>
        <Card className="p-6 text-sm text-red-700">{t('invoiceDetail.notFoundMessage', 'Purchase invoice not found.')}</Card>
      </div>
    );
  }

  const canCreatePayment = invoice.status === 'POSTED' && invoice.outstandingAmountBase > 0;
  const canCreateReturn = invoice.status === 'POSTED';
  const createReturnHref = `/purchases/returns/new?purchaseInvoiceId=${encodeURIComponent(invoice.id)}${
    invoice.purchaseOrderId ? `&purchaseOrderId=${encodeURIComponent(invoice.purchaseOrderId)}` : ''
  }`;

  // Pay-later entry point (Task 184 Finding 5): record a payment against this posted invoice
  // via the invoice-aware dialog → recordPayment endpoint (posts the linked payment voucher,
  // reconciles outstanding/paymentStatus). Stays on the invoice page; never routes into Accounting.
  const handleRecordPayment = async (payload: RecordPaymentPayload) => {
    if (!invoice) return;
    setRecordPaymentBusy(true);
    try {
      const res = await purchasesApi.recordPayment(invoice.id, payload as any);
      const dto = ((res as any)?.invoice ?? res) as PurchaseInvoiceDTO;
      setInvoice(dto);
      setRecordPaymentOpen(false);
      errorHandler.showSuccess(t('invoiceDetail.recordPaymentSuccess', 'Payment recorded.'));
      window.dispatchEvent(new CustomEvent('documents-updated', { detail: { type: 'PI' } }));
    } catch (err: any) {
      errorHandler.showError(err?.response?.data?.error?.message || err?.response?.data?.message || err?.message || t('invoiceDetail.recordPaymentFailed', 'Failed to record payment.'));
    } finally {
      setRecordPaymentBusy(false);
    }
  };
  const viewBaseCurrency = company?.baseCurrency || 'USD';
  const viewVendorName = vendorNameById[invoice.vendorId] || invoice.vendorName || '-';
  const viewTaxResolved = invoice.lines.every((line) => !line.taxCodeId || line.taxCode || taxById[line.taxCodeId]);
  const viewPostingOk = invoice.status === 'POSTED' || invoice.status === 'PENDING_APPROVAL' || (invoice.lines.length > 0 && !!invoice.vendorId);
  const viewAttachmentInputId = 'purchase-invoice-view-attachment-input';
  const viewFooterSummary = (
    <DocumentFooterTotalsStrip
      totals={[
        { label: t('invoiceDetail.footer.subtotal', 'Subtotal'), value: `${invoice.currency} ${invoice.subtotalDoc.toFixed(2)}` },
        { label: t('invoiceDetail.footer.tax', 'Tax'), value: `${invoice.currency} ${invoice.taxTotalDoc.toFixed(2)}`, tone: 'blue' },
        { label: t('invoiceDetail.footer.outstanding', 'Outstanding'), value: `${company?.baseCurrency || 'Base'} ${invoice.outstandingAmountBase.toFixed(2)}`, tone: 'amber' },
        { label: t('invoiceDetail.footer.grand', 'Grand'), value: `${invoice.currency} ${invoice.grandTotalDoc.toFixed(2)}`, tone: 'green' },
      ]}
    />
  );
  const viewRailSections: DocumentScaffoldRailSections = {
    info: {
      title: t('invoiceDetail.rail.info', 'Info'),
      action: (
        <DocumentPill tone={railFocus.kind === 'item' ? 'blue' : railFocus.kind === 'warehouse' ? 'amber' : 'slate'}>
          {railFocus.kind === 'item'
            ? t('invoiceDetail.rail.item', 'Item')
            : railFocus.kind === 'warehouse'
              ? t('invoiceDetail.rail.warehouse', 'Warehouse')
              : t('invoiceDetail.rail.vendor', 'Vendor')}
        </DocumentPill>
      ),
      content: (
        <DocumentRailFocus
          code={railFocus.code || invoice.purchaseOrderId || invoice.invoiceNumber}
          title={railFocus.title || viewVendorName}
          subtitle={railFocus.subtitle || invoice.vendorInvoiceNumber || t('invoiceDetail.rail.vendorInvoiceMissing', 'Vendor invoice/reference not entered')}
          note={railFocus.note || t('invoiceDetail.rail.helpView', 'Review the vendor bill, stock cost, tax, AP balance, and legal posting actions from this view.')}
        />
      ),
    },
    readiness: {
      title: invoice.status === 'POSTED' ? t('invoiceDetail.rail.docStatusTitle', 'Document Status') : t('invoiceDetail.rail.readinessTitle', 'Posting Readiness'),
      content: (
        <DocumentRailChecklist
          items={[
            { state: viewPostingOk ? 'ok' : 'warn', label: invoice.status === 'POSTED' ? t('invoiceDetail.rail.readinessLedgerCreated', 'Ledger voucher created') : t('invoiceDetail.rail.readinessBalanced', 'Balanced AP posting preview') },
            { state: viewTaxResolved ? 'ok' : 'warn', label: invoice.status === 'POSTED' ? t('invoiceDetail.rail.readinessTaxLinesPosted', 'Purchase tax lines posted') : t('invoiceDetail.rail.readinessTaxResolved', 'Purchase tax accounts resolved') },
            { state: 'info', label: t('invoiceDetail.rail.readinessPolicyActive', 'AP, inventory, and approval policy active') },
          ]}
        />
      ),
    },
    settlement: {
      title: t('invoiceDetail.rail.settlementTitle', 'Settlement'),
      action: (
          <DocumentPill tone={invoice.paymentStatus === 'PAID' ? 'green' : invoice.paymentStatus === 'PARTIALLY_PAID' ? 'amber' : 'slate'}>
            {invoice.paymentStatus === 'UNPAID' ? t('invoiceDetail.rail.settlementCredit', 'Credit') : invoice.paymentStatus}
          </DocumentPill>
      ),
      content: (
        <>
        <div className="grid grid-cols-2 gap-1.5 border-b border-slate-100 p-2 dark:border-slate-800">
          <DocumentRailStat label={t('invoiceDetail.rail.settlementPaid', 'Paid')} value={invoice.paidAmountBase.toFixed(2)} tone="green" />
          <DocumentRailStat label={t('invoiceDetail.rail.settlementRemaining', 'Remaining')} value={invoice.outstandingAmountBase.toFixed(2)} tone={invoice.outstandingAmountBase > 0 ? 'amber' : 'green'} />
          <div className="col-span-2 rounded border border-slate-200 px-2 py-1.5 text-[11px] dark:border-slate-800">
            <div className="text-[9px] font-black uppercase tracking-wide text-slate-400">{t('invoiceDetail.rail.settlementAffectedAccount', 'Affected Account')}</div>
            <div className="truncate font-bold text-slate-800 dark:text-slate-100">{viewVendorName}</div>
            <div className="truncate font-mono text-[10px] text-slate-500">
              {viewBaseCurrency} {invoice.outstandingAmountBase.toFixed(2)}
            </div>
          </div>
        </div>
        </>
      ),
    },
    totals: {
      title: t('invoiceDetail.rail.totalsTitle', 'Totals'),
      action: <DocumentPill tone="slate">{invoice.currency}</DocumentPill>,
      content: (
        <DocumentRailTotals
          rows={[
            { label: t('invoiceDetail.rail.totalsSubtotal', 'Subtotal'), value: `${invoice.currency} ${invoice.subtotalDoc.toFixed(2)}` },
            { label: t('invoiceDetail.rail.totalsTax', 'Tax'), value: `${invoice.currency} ${invoice.taxTotalDoc.toFixed(2)}` },
          ]}
          grand={{
            label: t('invoiceDetail.rail.totalsGrandTotal', 'Grand Total'),
            value: `${invoice.currency} ${invoice.grandTotalDoc.toFixed(2)}`,
            ...(invoice.currency !== viewBaseCurrency
              ? {
                  subLabel: t('invoiceDetail.rail.totalsGrandTotalBase', 'Grand Total (Base)'),
                  subValue: `${viewBaseCurrency} ${invoice.grandTotalBase.toFixed(2)}`,
                }
              : {}),
          }}
        />
      ),
    },
  };

  return (
    <>
    <DocumentDetailScaffold
      title={invoice.invoiceNumber}
      subtitle={invoice.vendorInvoiceNumber
        ? `${t('invoiceDetail.viewSubtitleVendor', 'Vendor: {{name}}', { name: vendorNameById[invoice.vendorId] || invoice.vendorName })}${t('invoiceDetail.viewSubtitleRef', ' | Vendor Invoice / Ref: {{ref}}', { ref: invoice.vendorInvoiceNumber })}`
        : t('invoiceDetail.viewSubtitleVendor', 'Vendor: {{name}}', { name: vendorNameById[invoice.vendorId] || invoice.vendorName })}
      icon={FileText}
      backLabel={t('invoiceDetail.backLabel', 'Back to purchase invoices')}
      onBack={() => navigate('/purchases/invoices')}
      badges={
        <>
          <DocumentPill tone={invoice.status === 'POSTED' ? 'green' : invoice.status === 'PENDING_APPROVAL' ? 'amber' : invoice.status === 'CANCELLED' ? 'rose' : 'slate'}>
            {invoice.status === 'PENDING_APPROVAL' ? t('invoiceDetail.pendingApprovalBadge', 'PENDING APPROVAL') : invoice.status}
          </DocumentPill>
          <DocumentPill tone={invoice.paymentStatus === 'PAID' ? 'green' : invoice.paymentStatus === 'PARTIALLY_PAID' ? 'amber' : 'rose'}>
            {invoice.paymentStatus}
          </DocumentPill>
          {invoice.purchaseOrderId && <DocumentPill tone="blue">{t('invoiceDetail.fromPOPill', 'From PO')}</DocumentPill>}
        </>
      }
      newAction={{
        label: t('invoiceDetail.newInvoice', 'New Invoice'),
        title: t('invoiceDetail.newInvoice', 'New Invoice'),
        hasUnsavedChanges: false,
        onNew: openNewInvoiceForm,
      }}
      railSections={viewRailSections}
      railTitle={t('invoiceDetail.railTitle', 'Purchase invoice side rail')}
      footerSections={{
        totals: {
          content: ({ showInlineRail, railDrawerOpen }) =>
            showInlineRail || railDrawerOpen ? (
              <div className="text-xs text-slate-500">
                {invoice.status === 'PENDING_APPROVAL'
                  ? t('invoiceDetail.footer.pendingApprovalReadonly', 'Invoice is locked while waiting for accounting approval.')
                  : invoice.status === 'POSTED'
                    ? t('invoiceDetail.footer.postedReadonly', 'Posted document is read-only.')
                    : t('invoiceDetail.footer.draftSaved', 'Saved draft. Use Edit Draft to modify.')}
              </div>
            ) : (
              viewFooterSummary
            ),
        },
        actions: {
          content: (
        <>
          <button
            type="button"
            className="rounded border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50"
            onClick={() => navigate('/purchases/invoices')}
          >
            {t('invoiceDetail.backToList', 'Back to List')}
          </button>
          <button
            type="button"
            className="rounded border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
            onClick={printInvoice}
            disabled={printBusy}
          >
            {printBusy ? t('invoiceDetail.printing', 'Printing...') : t('invoiceDetail.print', 'Print')}
          </button>
          {invoice.status === 'DRAFT' && (
            <button
              type="button"
              className="rounded border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
              onClick={toggleEdit}
              disabled={busy}
            >
              {t('invoiceDetail.editDraftBtn', 'Edit Draft')}
            </button>
          )}
          {invoice.status === 'DRAFT' && (
            <button
              type="button"
              className="rounded bg-blue-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
              onClick={handlePostClick}
              disabled={busy}
            >
              {busy ? t('invoiceDetail.posting', 'Posting...') : t('invoiceDetail.postInvoice', 'Post Invoice')}
            </button>
          )}
          {invoice.status === 'POSTED' && (
            <button
              type="button"
              className="rounded border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50"
              onClick={() => setGlImpactOpen(true)}
            >
              {t('invoiceDetail.glImpact', 'GL Impact')}
            </button>
          )}
          {invoice.status === 'POSTED' && (
            <button
              type="button"
              className="rounded border border-indigo-300 bg-white px-4 py-2 text-xs font-bold text-indigo-700 transition-colors hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => navigate(createReturnHref)}
              disabled={!canCreateReturn}
            >
              {t('invoiceDetail.createReturn', 'Create Return')}
            </button>
          )}
          {invoice.status === 'POSTED' && (
            <button
              type="button"
              className="rounded border border-emerald-300 bg-white px-4 py-2 text-xs font-bold text-emerald-700 transition-colors hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => setRecordPaymentOpen(true)}
              disabled={!canCreatePayment}
            >
              {t('invoiceDetail.createPayment', 'Create Payment')}
            </button>
          )}
          {invoice.status === 'POSTED' && (invoice.paidAmountBase || 0) > 0 && (
            <button
              type="button"
              className="rounded border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              onClick={() => setPaymentHistoryOpen(true)}
            >
              {t('invoiceDetail.viewPayments', 'Payments')}
            </button>
          )}
          {invoice.status === 'POSTED' && (
            <button
              type="button"
              className="rounded border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-700 transition-colors hover:bg-amber-100 disabled:opacity-50"
              onClick={() => setUnpostConfirmOpen(true)}
              disabled={busy || canCreatePayment === false || invoice.paymentStatus !== 'UNPAID'}
            >
              {busy ? t('invoiceDetail.unposting', 'Unposting...') : t('invoiceDetail.unpostInvoice', 'Unpost Invoice')}
            </button>
          )}
        </>
          ),
        },
      }}
      sections={{
        banner: {
          content: (invoice.status === 'PENDING_APPROVAL' || error) ? (
            <div className="grid gap-2">
              {/*
                SoD: a Purchase Invoice in PENDING_APPROVAL is awaiting accounting approval. Purchases-side
                cannot Approve its own postings. The accountant clears the parked state from the Approval
                Center. See docs/architecture/posting-authority.md §4.1.
              */}
              {invoice.status === 'PENDING_APPROVAL' && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  <div className="font-semibold mb-0.5">{t('invoiceDetail.pendingApproval.title', '⏳ Awaiting accounting approval')}</div>
                  <div className="text-amber-800">
                    {t('invoiceDetail.pendingApproval.body1', 'This invoice was submitted and is waiting for accounting to approve the ledger effect.')}
                    {' '}{t('invoiceDetail.pendingApproval.body2', 'You cannot edit it while it is pending. The decision will appear here when it is made.')}
                  </div>
                </div>
              )}
              {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
            </div>
          ) : null,
        },
        control: {
          content: (
      <DocumentControlPanel>
        <div className="grid gap-2 xl:grid-cols-[minmax(0,1fr)_auto]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <DocumentSegmentedGroup>
              <DocumentSegmentButton active={!invoice.purchaseOrderId} disabled icon={FileText} label={t('invoiceDetail.sourceDirect', 'Direct')} />
              <DocumentSegmentButton active={!!invoice.purchaseOrderId} disabled icon={Link2} label={t('invoiceDetail.sourceFromPO', 'From PO')} />
            </DocumentSegmentedGroup>
            <button
              type="button"
              disabled
              className="inline-flex h-7 items-center gap-1.5 rounded border border-slate-200 bg-white px-2 text-[10px] font-black uppercase tracking-wide text-slate-500 disabled:cursor-default dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400"
            >
              <Link2 className="h-3.5 w-3.5" />
              {invoice.purchaseOrderId ? t('invoiceDetail.sourceLockedPO', 'Source locked from PO') : t('invoiceDetail.sourceDirectHeaderDriven', 'Direct header driven')}
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-1.5 rounded-md border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-950/50">
            <input
              id={viewAttachmentInputId}
              type="file"
              className="hidden"
              accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx"
              onChange={uploadAttachment}
              disabled={attachmentBusy}
            />
            <DocumentIconButton
              title={t('invoices.attachments.upload', 'Upload Attachment')}
              onClick={() => document.getElementById(viewAttachmentInputId)?.click()}
              disabled={attachmentBusy}
            >
              <Paperclip className="h-3.5 w-3.5" />
            </DocumentIconButton>
            <DocumentIconButton title={t('invoiceDetail.downloadExcel', 'Download Excel')} onClick={() => errorHandler.showWarning(t('invoiceDetail.excelNotConnected', 'Purchase invoice line export is not connected yet.'))}>
              <FileSpreadsheet className="h-3.5 w-3.5" />
            </DocumentIconButton>
            <DocumentIconButton
              title={printBusy ? t('invoiceDetail.printing', 'Printing...') : t('invoiceDetail.print', 'Print')}
              onClick={printInvoice}
              disabled={printBusy}
            >
              <Printer className="h-3.5 w-3.5" />
            </DocumentIconButton>
            <DocumentIconButton title={t('invoiceDetail.uploadFromFile', 'Upload from file')} onClick={() => errorHandler.showWarning(t('invoiceDetail.importNotConnected', 'Purchase invoice file import is not connected yet.'))}>
              <Upload className="h-3.5 w-3.5" />
            </DocumentIconButton>
            <DocumentIconButton title={t('invoiceDetail.readFromImage', 'Read from image')} onClick={() => errorHandler.showWarning(t('invoiceDetail.imageNotConnected', 'Purchase invoice image reading is not connected yet.'))}>
              <FileImage className="h-3.5 w-3.5" />
            </DocumentIconButton>
          </div>
        </div>
      </DocumentControlPanel>
          ),
        },
        header: {
          title: invoice.purchaseOrderId ? t('invoiceDetail.header.fromPO', 'Header - From Purchase Order') : t('invoiceDetail.header.directBill', 'Header - Direct Bill'),
          action: (
          <div className="flex items-center gap-1.5">
            <DocumentPill tone={invoice.purchaseOrderId ? 'blue' : 'slate'}>{invoice.purchaseOrderId ? t('invoiceDetail.fromPOPill', 'From PO') : t('invoiceDetail.sourceDirect', 'Direct')}</DocumentPill>
            <DocumentPill tone="slate">{invoice.currency}</DocumentPill>
            {invoice.status === 'POSTED' && (
              <DocumentPill tone="green">
                <ShieldCheck className="h-3 w-3" />
                {t('invoiceDetail.policyOK', 'Policy OK')}
              </DocumentPill>
            )}
          </div>
          ),
          content: (
        <DocumentHeaderGrid>
          <DocumentField label={t('invoiceDetail.viewHeader.invoiceNo', 'Invoice No.')} value={invoice.invoiceNumber} plain />
          <DocumentField label={t('invoiceDetail.viewHeader.source', 'Source')} value={invoice.purchaseOrderId || t('invoiceDetail.viewHeader.direct', 'Direct')} plain />
          <DocumentField label={t('invoiceDetail.viewHeader.vendor', 'Vendor')} value={viewVendorName} plain />
          <DocumentField label={t('invoiceDetail.viewHeader.vendorInvoiceNumber', 'Vendor Invoice / Ref')} value={invoice.vendorInvoiceNumber || '-'} plain />
          <DocumentField label={t('invoiceDetail.viewHeader.invoiceDate', 'Invoice Date')} value={invoice.invoiceDate} plain />
          <DocumentField label={t('invoiceDetail.viewHeader.dueDate', 'Due Date')} value={invoice.dueDate || '-'} plain />
          <DocumentField label={t('invoiceDetail.viewHeader.currency', 'Currency')} value={invoice.currency} plain />
          <DocumentField label={t('invoiceDetail.viewHeader.exchangeRate', 'Exchange Rate')} value={invoice.exchangeRate} plain />
          <DocumentField label={t('invoiceDetail.viewHeader.paymentTerms', 'Payment Terms')} value={`${invoice.paymentTermsDays}${t('invoiceDetail.viewHeader.days', ' days')}`} plain />
          <DocumentField label={t('invoiceDetail.viewHeader.directInvoicing', 'Direct Invoicing')} value={settings ? (settings.allowDirectInvoicing ? t('invoiceDetail.viewHeader.enabled', 'Enabled') : t('invoiceDetail.viewHeader.disabled', 'Disabled')) : '-'} plain />
        </DocumentHeaderGrid>
          ),
        },
        lines: {
          content: (
        <ClassicLineItemsTable<PurchaseInvoiceLineDTO>
          tableId="purchases.invoice.view.lines"
          rows={invoice.lines}
          disabled
          onRowChange={() => undefined}
          isRowFilled={(line) => Boolean(line.itemId || line.itemCode || line.itemName || line.description || line.taxCodeId || line.invoicedQty || line.unitPriceDoc || line.discountValue)}
          addLabel={t('invoiceDetail.columns.addLabel', 'Add Item')}
          columns={[
            {
              id: 'item',
              label: t('invoiceDetail.columns.item', 'Item'),
              kind: 'custom',
              width: '260px',
              render: (row) => (
                <div
                  className="flex h-9 items-center truncate px-2 text-xs font-medium text-slate-800 dark:text-slate-100"
                  onFocus={() => focusItem(row)}
                  onMouseEnter={() => focusItem(row)}
                  tabIndex={0}
                >
                  {row.itemCode ? `${row.itemCode} - ${row.itemName}` : row.itemName}
                </div>
              ),
            },
            { id: 'qty', label: t('invoiceDetail.columns.qty', 'Qty'), kind: 'computed', width: '80px', compute: (row) => row.invoicedQty },
            { id: 'uom', label: t('invoiceDetail.columns.uom', 'UOM'), kind: 'custom', width: '90px', render: (row) => <div className="flex h-9 items-center px-2 text-xs uppercase text-slate-700 dark:text-slate-200">{row.uom}</div> },
            { id: 'unitCost', label: t('invoiceDetail.columns.unitCost', 'Unit Cost'), kind: 'computed', width: '110px', compute: (row) => row.unitPriceDoc },
            { id: 'taxCode', label: t('invoiceDetail.columns.taxCode', 'Tax Code'), kind: 'custom', width: '140px', render: (row) => <div className="flex h-9 items-center px-2 text-xs text-slate-700 dark:text-slate-200">{row.taxCode || row.taxCodeId || t('invoiceDetail.columns.noTax', 'No Tax')}</div> },
            { id: 'lineTotal', label: t('invoiceDetail.columns.lineTotal', 'Line Total'), kind: 'computed', width: '110px', compute: (row) => row.lineTotalDoc + row.taxAmountDoc },
            { id: 'net', label: t('invoiceDetail.columns.net', 'Net'), kind: 'computed', width: '100px', compute: (row) => row.lineTotalDoc },
            { id: 'tax', label: t('invoiceDetail.columns.tax', 'Tax'), kind: 'computed', width: '90px', compute: (row) => row.taxAmountDoc },
            { id: 'netBase', label: t('invoiceDetail.columns.netBase', 'Net Base'), kind: 'computed', width: '110px', compute: (row) => row.lineTotalBase },
          ]}
          minRows={1}
          className="flex-1 [&>div:first-child]:h-full [&>div:first-child]:max-h-none"
        />
          ),
        },
        secondary: {
          content: renderAllocationGrid(true),
        },
        attachments: {
          content: (
      <div className="grid gap-2 md:grid-cols-2">
        <DocumentCompactCard
          title={t('invoices.attachments.title', 'Attachments')}
          action={
            <label
              htmlFor={viewAttachmentInputId}
              className="inline-flex h-6 cursor-pointer items-center rounded border border-slate-200 px-2 text-[10px] font-black uppercase tracking-wide text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {attachmentBusy ? t('invoices.attachments.uploading', 'Uploading...') : t('invoices.attachments.upload', 'Upload')}
            </label>
          }
        >
          <div className="min-h-[56px] p-2.5 text-xs">
            <div className="flex items-center gap-2">
              <Paperclip className="h-4 w-4 text-slate-500" />
              <div className="min-w-0">
                <div className="font-black text-slate-900 dark:text-slate-100">
                  {attachments.length} {t('invoiceDetail.attachmentCountView', { defaultValue: 'file', count: attachments.length })}
                </div>
                <div className="truncate text-[11px] text-slate-500">
                  {t('invoices.attachments.help', 'Allowed: PDF, PNG, JPG, DOCX, XLSX. Max 10 MB per file, 5 files per invoice.')}
                </div>
              </div>
            </div>
            {attachments.length > 0 && (
              <div className="mt-2 grid gap-1">
                {attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="flex items-center justify-between gap-2 rounded border border-slate-200 bg-slate-50 px-2 py-1 dark:border-slate-800 dark:bg-slate-900/40"
                  >
                    <div className="min-w-0 truncate font-medium text-slate-700 dark:text-slate-200">
                      {attachment.name}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        className="text-[10px] font-black uppercase text-slate-600"
                        onClick={() => downloadAttachment(attachment.id)}
                      >
                        {t('invoices.attachments.open', 'Open')}
                      </button>
                      <button
                        type="button"
                        className="text-[10px] font-black uppercase text-rose-600 disabled:opacity-50"
                        onClick={() => setAttachmentPendingDelete(attachment)}
                        disabled={attachmentDeletingId === attachment.id}
                      >
                        {attachmentDeletingId === attachment.id
                          ? t('invoices.attachments.removing', 'Removing...')
                          : t('invoices.attachments.remove', 'Remove')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DocumentCompactCard>

        <DocumentCompactCard
          title={t('invoiceDetail.audit.title', 'Audit & Warnings')}
          action={<DocumentPill tone={invoice.status === 'POSTED' ? 'green' : invoice.status === 'PENDING_APPROVAL' ? 'amber' : 'slate'}>{invoice.status}</DocumentPill>}
        >
          <div className="flex min-h-[56px] items-center gap-2 p-2.5 text-xs">
            <History className="h-4 w-4 text-slate-500" />
            <div className="min-w-0">
              <div className="font-black text-slate-900 dark:text-slate-100">{t('invoiceDetail.audit.documentChecks', 'Document checks')}</div>
              <div className="truncate text-[11px] text-slate-500">
                {t('invoiceDetail.audit.documentDescription', 'Status, payment, AP, inventory, and attachment warnings stay visible before legal actions.')}
              </div>
            </div>
          </div>
        </DocumentCompactCard>
      </div>
          ),
        },
      }}
    />

      <ConfirmDialog
        isOpen={unpostConfirmOpen}
        title={t('invoices.unpost.confirmTitle', 'Unpost Purchase Invoice')}
        message={t('invoices.unpost.confirmMessage', 'This will reverse all accounting and inventory entries posted for this invoice. The action is auditable but cannot be undone in place. Continue?')}
        confirmLabel={t('invoices.unpost.confirmAction', 'Unpost Invoice')}
        cancelLabel={t('common.cancel', 'Cancel')}
        tone="danger"
        isConfirming={busy}
        onConfirm={unpostPI}
        onCancel={() => { if (!busy) setUnpostConfirmOpen(false); }}
      />

      <ConfirmDialog
        isOpen={!!attachmentPendingDelete}
        title={t('invoices.attachments.confirmRemoveTitle', 'Remove Attachment')}
        message={t('invoices.attachments.confirmRemoveMessage', {
          defaultValue: 'Remove {{name}} from this purchase invoice?',
          name: attachmentPendingDelete?.name || t('invoices.attachments.thisFile', 'this file'),
        })}
        confirmLabel={t('invoices.attachments.remove', 'Remove')}
        cancelLabel={t('common.cancel', 'Cancel')}
        tone="danger"
        isConfirming={!!attachmentDeletingId}
        onConfirm={removeAttachment}
        onCancel={() => {
          if (!attachmentDeletingId) setAttachmentPendingDelete(null);
        }}
      />

      <RecordPaymentDialog
        open={recordPaymentOpen}
        module="purchases"
        invoiceNumber={invoice.invoiceNumber}
        partyName={invoice.vendorName}
        currencyCode={invoice.currency}
        outstandingBase={invoice.outstandingAmountBase || 0}
        paymentMethodConfigs={(settings as any)?.paymentMethodConfigs || []}
        allowOverpayment={(settings as any)?.allowOverpayment === true}
        busy={recordPaymentBusy}
        onClose={() => setRecordPaymentOpen(false)}
        onSubmit={handleRecordPayment}
      />

      <PaymentHistoryModal
        open={paymentHistoryOpen}
        invoiceNumber={invoice.invoiceNumber}
        currencyCode={invoice.currency}
        fetchPayments={() => purchasesApi.getPaymentHistory(invoice.id)}
        onClose={() => setPaymentHistoryOpen(false)}
      />
      <GlImpactModal
        isOpen={glImpactOpen}
        onClose={() => setGlImpactOpen(false)}
        sourceId={invoice.id}
        sourceLabel={invoice.invoiceNumber}
        fallbackVoucherIds={invoice.voucherId ? [invoice.voucherId] : []}
        documentStatus={invoice.status}
        postingContext="purchases"
      />
      {renderChargeModal()}
    </>
  );
};

export default PurchaseInvoiceDetailPage;

