import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { InventoryItemDTO, InventoryWarehouseDTO, UomConversionDTO, inventoryApi } from '../../../api/inventoryApi';
import {
  CreateSalesInvoicePayload,
  InvoiceableLinkedSalesSourceDTO,
  RecurrenceFrequency,
  recurringInvoiceApi,
  SalesInvoiceAttachmentDTO,
  SalesMessagingAccountDTO,
  SalesInvoiceDTO,
  SalesInvoiceLineInputDTO,
  SalesOrderDTO,
  salesApi,
  SalesSettingsDTO,
  UpdateSalesInvoicePayload,
} from '../../../api/salesApi';
import { communicationsApi, CommunicationsSettingsDTO } from '../../../api/communicationsApi';
import { PartyDTO, TaxCodeDTO, sharedApi } from '../../../api/sharedApi';
import { salesMasterDataApi, SalespersonDTO } from '../../../api/salesMasterDataApi';
import { voucherFormApi, VoucherFormResponse } from '../../../api/voucherFormApi';
import { accountingApi, AccountingPolicyConfig } from '../../../api/accountingApi';
import { Card } from '../../../components/ui/Card';
import { Modal } from '../../../components/ui/Modal';
import { StatusChip } from '../../../components/ui/StatusChip';
import { EmptyState } from '../../../components/ui/EmptyState';
import { AttachmentsCard } from '../../../components/attachments/AttachmentsCard';
import { SendDocumentButton } from '../../../components/messaging/SendDocumentButton';
import type { MessagingAccount } from '../../../components/messaging/SendWhatsAppModal';
import { useCompanyAccess } from '../../../context/CompanyAccessContext';
import { useRBAC } from '../../../api/rbac/useRBAC';
import { useDocumentPolicies } from '../../../hooks/useDocumentPolicies';
import { useConfirm } from '../../../hooks/useConfirm';
import { errorHandler } from '../../../services/errorHandler';
import { useUserPreferences } from '../../../hooks/useUserPreferences';
import { clsx } from 'clsx';
import { CurrencySelector } from '../../accounting/components/shared/CurrencySelector';
import { CurrencyExchangeWidget } from '../../accounting/components/shared/CurrencyExchangeWidget';
import { DatePicker } from '../../accounting/components/shared/DatePicker';
import { AccountSelector } from '../../accounting/components/shared/AccountSelector';
import { SettlementBlock } from '../../../components/shared/settlement/SettlementBlock';
import { RecordPaymentDialog, RecordPaymentPayload } from '../../../components/shared/settlement/RecordPaymentDialog';
import { PaymentHistoryModal } from '../../../components/shared/settlement/PaymentHistoryModal';
import { PartySelector, ItemSelector, WarehouseSelector } from '../../../components/shared/selectors';
import { buildItemUomOptions, findItemUomOption, getDefaultItemUomOption, ManagedUomOption } from '../../inventory/utils/uomOptions';
import { isPersonaAllowedByGovernance, resolveSalesWorkflowMode } from '../../../utils/documentPolicy';
import { GlImpactModal } from '../components/GlImpactModal';
import { PeriodLockOverrideModal } from '../components/PeriodLockOverrideModal';
import { RecordAuditModal } from '../components/RecordAuditModal';
import { todayLocalIso } from '../../../utils/dateUtils';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileImage,
  FileSpreadsheet,
  FileText,
  History,
  Info,
  Link2,
  Loader2,
  Lock,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Paperclip,
  ShieldCheck,
  Truck,
  Upload,
  X,
} from 'lucide-react';
import { ClassicLineItemsTable, ColumnDef } from '../../../components/shared/ClassicLineItemsTable';

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;
const roundMoney = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;
const todayIso = todayLocalIso;
const normalizeToken = (value: unknown): string => String(value || '').trim().toLowerCase();

interface EditableLine {
  lineId?: string;
  soLineId?: string;
  dnLineId?: string;
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
  priceIsInclusive?: boolean;
  warehouseId?: string;
  description?: string;
}

interface EditableCharge {
  chargeId?: string;
  code?: string;
  name: string;
  amountDoc: number;
  taxCodeId?: string;
  revenueAccountId?: string;
  description?: string;
}

interface EditableForm {
  id?: string;
  status?: string;
  salesOrderId: string;
  customerId: string;
  customerName?: string;
  invoiceTemplateId: string;
  invoiceTemplateFormType: string;
  salespersonId?: string;
  customerInvoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  currency: string;
  exchangeRate: number;
  warehouseId?: string;
  notes: string;
  lines: EditableLine[];
  charges: EditableCharge[];
}

interface SettlementRowState {
  settlementAccountId: string;
  amountBase: number;
  paymentMethod: string;
  reference: string;
  notes: string;
  paymentDate: string;
}

type RailFocus =
  | { kind: 'account'; title: string; code: string; subtitle: string; balance: number; note: string }
  | { kind: 'item'; title: string; code: string; subtitle: string; balance: number; note: string };

interface SalesInvoiceReferenceData {
  settings: SalesSettingsDTO | null;
  accountingPolicy: AccountingPolicyConfig | null;
  commSettings: CommunicationsSettingsDTO | null;
  customers: PartyDTO[];
  items: InventoryItemDTO[];
  taxCodes: TaxCodeDTO[];
  warehouses: InventoryWarehouseDTO[];
  salesOrders: SalesOrderDTO[];
  salespersons: SalespersonDTO[];
  invoiceTemplates: VoucherFormResponse[];
}

interface SalesInvoiceReferenceCacheEntry {
  expiresAt: number;
  data?: SalesInvoiceReferenceData;
  promise?: Promise<SalesInvoiceReferenceData>;
}

interface LoadingProgress {
  startedAt: number;
  elapsedSeconds: number;
  totalCalls: number;
  completedCalls: number;
  activeLabel: string;
  cacheStatus: 'checking' | 'hit' | 'miss' | 'inflight';
}

interface StartupTiming {
  routeKey: string;
  mode: 'new' | 'edit';
  startedAt: number;
  referenceDataFinishedAt?: number;
  invoiceFetchFinishedAt?: number;
  dataReadyAt?: number;
  visibleAt?: number;
  completedCalls?: number;
  totalCalls?: number;
}

const SALES_INVOICE_REFERENCE_CACHE_TTL_MS = 5 * 60 * 1000;
const salesInvoiceReferenceCache = new Map<string, SalesInvoiceReferenceCacheEntry>();

const getPerfTime = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

const createEmptyLine = (): EditableLine => ({
  itemId: '',
  invoicedQty: 1,
  uomId: undefined,
  uom: '',
  unitPriceDoc: 0,
  discountType: undefined,
  discountValue: 0,
  taxCodeId: undefined,
  warehouseId: undefined,
  description: '',
});

function Field({
  label,
  value,
  muted,
  locked,
  plain,
}: {
  label: string;
  value: string;
  muted?: boolean;
  locked?: boolean;
  plain?: boolean;
}) {
  return (
    <label className="min-w-0 block">
      <span className="mb-0.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-500 select-none">
        {label}
        {locked && <Lock className="h-3 w-3 text-slate-400" />}
      </span>
      <div
        className={clsx(
          'flex min-w-0 items-center rounded px-2 text-xs font-semibold',
          plain ? 'h-8' : 'h-9',
          plain
            ? 'border border-transparent bg-transparent px-0 text-slate-900 dark:text-slate-100'
            : locked
            ? 'border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400'
            : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100',
          !plain && 'border shadow-sm'
        )}
      >
        <span className="truncate">{value}</span>
      </div>
    </label>
  );
}

function CompactCard({
  title,
  children,
  action,
  className,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={clsx('shrink-0 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden flex flex-col', className)}>
      <div className="flex h-8 items-center justify-between border-b border-slate-150 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 px-3 shrink-0">
        {title ? (
          <h2 className="text-[10px] font-black uppercase tracking-wide text-slate-700 dark:text-slate-350">{title}</h2>
        ) : (
          <span />
        )}
        {action}
      </div>
      {children}
    </section>
  );
}

function Pill({
  children,
  tone = 'slate',
}: {
  children: React.ReactNode;
  tone?: 'slate' | 'blue' | 'green' | 'amber' | 'red';
}) {
  const tones = {
    slate: 'border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300',
    blue: 'border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300',
    green: 'border-emerald-250 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300',
    amber: 'border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300',
    red: 'border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-300',
  };
  return (
    <span className={clsx('inline-flex h-5 items-center gap-1 rounded-full border px-2 text-[9px] font-black uppercase tracking-wide', tones[tone])}>
      {children}
    </span>
  );
}

export interface SalesInvoiceDetailProps {
  invoiceId?: string;
  isWindow?: boolean;
  onClose?: () => void;
  onSaved?: () => void;
}

export const SalesInvoiceDetail: React.FC<SalesInvoiceDetailProps> = ({
  invoiceId,
  isWindow = false,
  onClose,
  onSaved,
}) => {
  const { t, i18n } = useTranslation();
  const { company } = useCompanyAccess();
  const { hasPermission, isOwner } = useRBAC();
  const { salesSettings } = useDocumentPolicies();
  const { confirm, confirmDialog } = useConfirm();
  const navigate = useNavigate();
  const params = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const resolvedId = invoiceId !== undefined ? invoiceId : params.id;
  const isCreateMode = !resolvedId || resolvedId === 'new';
  const { uiMode } = useUserPreferences();
  const isWindowsMode = uiMode === 'windows';
  const isRtl = i18n.dir() === 'rtl';
  const BackIcon = isRtl ? ArrowRight : ArrowLeft;
  const RailOpenIcon = isRtl ? PanelLeftOpen : PanelRightOpen;
  const RailCloseIcon = isRtl ? PanelLeftClose : PanelRightClose;

  const canOverrideCredit =
    salesSettings?.allowCreditOverride !== false &&
    (isOwner || hasPermission('sales.creditOverride'));

  const focusLine = (itemId: string) => {
    const item = itemById[itemId];
    if (!item) return;
    setRailFocus({
      kind: 'item',
      title: item.name,
      code: item.code || 'NOCODE',
      subtitle: `${item.salesUom || item.baseUom} item`,
      balance: 0,
      note: item.trackInventory
        ? t('sales.invoiceDetail.focus.inventoryTracked', 'Inventory item: cost and stock checks run before posting.')
        : t('sales.invoiceDetail.focus.serviceItem', 'Service line: no inventory valuation movement.'),
    });
  };

  const LINE_DISPLAY_MIN = 1;
  const padLinesToMin = (lines: EditableLine[]): EditableLine[] => {
    if (lines.length >= LINE_DISPLAY_MIN) return lines;
    return [...lines, createEmptyLine()];
  };
  const filledLines = (lines: EditableLine[]): EditableLine[] => lines.filter((l) => !!l.itemId);
  const hasLineContent = (line: EditableLine | undefined): boolean => {
    if (!line) return false;
    return Boolean(line.itemId || line.itemCode || line.itemName || line.description || line.unitPriceDoc || line.discountValue);
  };

  const createEmptyForm = (salesOrderId = '', customerId = ''): EditableForm => ({
    salesOrderId,
    customerId,
    invoiceTemplateId: '',
    invoiceTemplateFormType: '',
    salespersonId: undefined,
    customerInvoiceNumber: '',
    invoiceDate: todayIso(),
    dueDate: '',
    currency: company?.baseCurrency || 'USD',
    exchangeRate: 1,
    warehouseId: undefined,
    notes: '',
    lines: padLinesToMin([]),
    charges: [],
  });

  const initialSalesOrderId = searchParams.get('salesOrderId') || '';
  const initialCustomerId = searchParams.get('customerId') || '';

  const [invoice, setInvoice] = useState<SalesInvoiceDTO | null>(null);
  const [settings, setSettings] = useState<SalesSettingsDTO | null>(null);
  const [accountingPolicy, setAccountingPolicy] = useState<AccountingPolicyConfig | null>(null);
  const [commSettings, setCommSettings] = useState<CommunicationsSettingsDTO | null>(null);
  const [customers, setCustomers] = useState<PartyDTO[]>([]);
  const [salespersons, setSalespersons] = useState<SalespersonDTO[]>([]);
  const [items, setItems] = useState<InventoryItemDTO[]>([]);
  const [warehouses, setWarehouses] = useState<InventoryWarehouseDTO[]>([]);
  const [salesOrders, setSalesOrders] = useState<SalesOrderDTO[]>([]);
  const [taxCodes, setTaxCodes] = useState<TaxCodeDTO[]>([]);
  const [invoiceTemplates, setInvoiceTemplates] = useState<VoucherFormResponse[]>([]);
  const [form, setForm] = useState<EditableForm>(() => createEmptyForm(initialSalesOrderId, initialCustomerId));
  const [uomOptionsByItemId, setUomOptionsByItemId] = useState<Record<string, ManagedUomOption[]>>({});
  const [attachments, setAttachments] = useState<SalesInvoiceAttachmentDTO[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState<LoadingProgress | null>(null);
  const startupTimingRef = useRef<StartupTiming | null>(null);
  const startupTimingLoggedRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [orderLineLoading, setOrderLineLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [glImpactOpen, setGlImpactOpen] = useState(false);
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [overrideModalData, setOverrideModalData] = useState<{ documentDate: string; lockedThroughDate: string } | null>(null);
  const [pendingPeriodLockRetry, setPendingPeriodLockRetry] = useState<((reason: string) => void) | null>(null);
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [cloneRecurringOpen, setCloneRecurringOpen] = useState(false);
  const [cloneRecurringBusy, setCloneRecurringBusy] = useState(false);
  const [cloneRecurringName, setCloneRecurringName] = useState('');
  const [cloneRecurringFrequency, setCloneRecurringFrequency] = useState<RecurrenceFrequency>('MONTHLY');
  const [cloneRecurringDayOfMonth, setCloneRecurringDayOfMonth] = useState(1);
  const [cloneRecurringDayOfWeek, setCloneRecurringDayOfWeek] = useState(1);
  const [cloneRecurringStartDate, setCloneRecurringStartDate] = useState(todayIso());
  const [cloneRecurringEndDate, setCloneRecurringEndDate] = useState('');
  const [cloneRecurringMaxOccurrences, setCloneRecurringMaxOccurrences] = useState('');
  const [templateTouched, setTemplateTouched] = useState(false);

  // Credit check override state
  const [creditOverrideOpen, setCreditOverrideOpen] = useState(false);
  const [creditOverrideReason, setCreditOverrideReason] = useState('');
  const [creditOverrideInfo, setCreditOverrideInfo] = useState<Record<string, any> | null>(null);
  const [creditWarnBanner, setCreditWarnBanner] = useState<string | null>(null);
  const [pendingCreatePayload, setPendingCreatePayload] = useState<{ payload: CreateSalesInvoicePayload; mode: 'draft' | 'createAndPost' } | null>(null);

  // Settlement state
  const [settlementMode, setSettlementMode] = useState<'DEFERRED' | 'CASH_FULL' | 'MULTI'>('DEFERRED');
  const [arAccountId, setArAccountId] = useState('');
  const [settlementRows, setSettlementRows] = useState<SettlementRowState[]>([]);
  const [settlementValidity, setSettlementValidity] = useState<{ ok: boolean; message?: string }>({ ok: true });
  const [recordPaymentOpen, setRecordPaymentOpen] = useState(false);
  const [recordPaymentBusy, setRecordPaymentBusy] = useState(false);
  const [paymentHistoryOpen, setPaymentHistoryOpen] = useState(false);
  const [requestedSourceMode, setRequestedSourceMode] = useState<'direct' | 'so' | 'dn'>('direct');
  const [attachmentsPanelOpen, setAttachmentsPanelOpen] = useState(false);
  const [railPinned, setRailPinned] = useState(true);
  const [railDrawerOpen, setRailDrawerOpen] = useState(false);
  const [railAutoCollapsed, setRailAutoCollapsed] = useState(false);

  const [railFocus, setRailFocus] = useState<RailFocus>(() => ({
    kind: 'account',
    title: 'AR - Customer Balance',
    code: '120000',
    subtitle: 'Accounts Receivable',
    balance: 0,
    note: t('sales.invoiceDetail.selectItemHint', 'Select or hover over an item line to view details, stock level, and SKU info.'),
  }));

  // Reset settlement state when navigating between invoices
  useEffect(() => {
    setSettlementMode('DEFERRED');
    setArAccountId('');
    setSettlementRows([]);
  }, [resolvedId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(max-width: 1279px)');
    const syncRailMode = () => {
      setRailAutoCollapsed(media.matches);
      if (media.matches || isWindow || isWindowsMode) {
        setRailDrawerOpen(false);
      }
    };

    syncRailMode();
    media.addEventListener('change', syncRailMode);
    return () => media.removeEventListener('change', syncRailMode);
  }, [isWindow, isWindowsMode]);

  const railUsesDrawer = isWindow || isWindowsMode || railAutoCollapsed;
  const showInlineRail = !railUsesDrawer && railPinned;

  useEffect(() => {
    if (!railUsesDrawer) {
      setRailDrawerOpen(false);
    }
  }, [railUsesDrawer]);

  const isReadOnly = !isCreateMode && !(invoice?.status === 'DRAFT');
  const invoiceStatus = invoice?.status || form.status || (isCreateMode ? 'DRAFT' : undefined);
  const isPendingAccountingApproval = invoiceStatus === 'PENDING_APPROVAL';
  const isLedgerPosted = invoiceStatus === 'POSTED';
  const statusPillTone = isLedgerPosted ? 'green' : isPendingAccountingApproval ? 'amber' : 'slate';
  const statusPillLabel = isLedgerPosted
    ? t('sales.invoiceDetail.postedStatusPill', 'Posted')
    : isPendingAccountingApproval
      ? t('sales.invoiceDetail.pendingApprovalStatusPill', 'Pending Approval')
      : t('sales.invoiceDetail.draftStatusPill', 'Draft');

  const canCreateReceipt = invoice?.status === 'POSTED' && (invoice?.outstandingAmountBase || 0) > 0;
  const createReturnHref = invoice ? `/sales/returns/new?salesInvoiceId=${encodeURIComponent(invoice.id)}${invoice.salesOrderId ? `&salesOrderId=${encodeURIComponent(invoice.salesOrderId)}` : ''}` : '';

  // Pay-later entry point (Task 184 Finding 5): record a receipt against this posted invoice
  // via the invoice-aware dialog → recordPayment endpoint (posts the linked receipt voucher,
  // reconciles outstanding/paymentStatus). Stays on the invoice page; never routes into Accounting.
  const handleRecordPayment = async (payload: RecordPaymentPayload) => {
    if (!invoice) return;
    setRecordPaymentBusy(true);
    try {
      const res = await salesApi.recordPayment(invoice.id, payload as any);
      const dto = ((res as any)?.invoice ?? res) as SalesInvoiceDTO;
      setInvoice(dto);
      populateFormFromInvoice(dto);
      setRecordPaymentOpen(false);
      errorHandler.showSuccess(t('sales.invoiceDetail.recordPaymentSuccess', 'Payment recorded.'));
      window.dispatchEvent(new CustomEvent('documents-updated', { detail: { type: 'SI' } }));
    } catch (err: any) {
      errorHandler.showError(err?.response?.data?.error?.message || err?.response?.data?.message || err?.message || t('sales.invoiceDetail.recordPaymentFailed', 'Failed to record payment.'));
    } finally {
      setRecordPaymentBusy(false);
    }
  };

  const enabledPaymentMethodConfigs = useMemo(
    () => (settings?.paymentMethodConfigs || []).filter((config) => config.isEnabled !== false),
    [settings]
  );
  const hasDeliveryNoteLinkedLines = form.lines.some((line) => !!line.dnLineId);
  const sourceMode = hasDeliveryNoteLinkedLines ? 'dn' : form.salesOrderId ? 'so' : 'direct';
  const activeSourceMode = sourceMode === 'direct' ? requestedSourceMode : sourceMode;
  const currentInvoiceFormType = form.salesOrderId ? 'sales_invoice_linked' : 'sales_invoice_direct';
  const currentInvoicePersona = form.salesOrderId ? 'linked' : 'direct';
  const isCurrentPersonaAllowed = settings
    ? isPersonaAllowedByGovernance(
        resolveSalesWorkflowMode(settings),
        settings.governanceRules,
        currentInvoicePersona,
        { formType: currentInvoiceFormType }
      )
    : true;
  const isDirectInvoiceAllowed = settings
    ? isPersonaAllowedByGovernance(
        resolveSalesWorkflowMode(settings),
        settings.governanceRules,
        'direct',
        { formType: 'sales_invoice_direct' }
      )
    : false;
  const customerById = useMemo(
    () =>
      customers.reduce<Record<string, PartyDTO>>((acc, customer) => {
        acc[customer.id] = customer;
        return acc;
      }, {}),
    [customers]
  );
  const messagingAccounts = useMemo<MessagingAccount[]>(
    () =>
      ((commSettings?.messagingAccounts || []) as SalesMessagingAccountDTO[])
        .filter((account) => account.isActive !== false)
        .sort((a, b) => {
          if (!!a.isDefault !== !!b.isDefault) return a.isDefault ? -1 : 1;
          return (a.label || '').localeCompare(b.label || '');
        }) as unknown as MessagingAccount[],
    [commSettings]
  );
  const eligibleInvoiceTemplates = useMemo(
    () =>
      invoiceTemplates
        .filter((template) => {
          if (template.enabled === false) return false;
          const templateFormType = normalizeToken(template.formType);
          if (!templateFormType.startsWith('sales_invoice')) return false;
          return templateFormType === currentInvoiceFormType;
        })
        .sort((a, b) => {
          if (!!a.isDefault !== !!b.isDefault) return a.isDefault ? -1 : 1;
          return (a.name || '').localeCompare(b.name || '');
        }),
    [invoiceTemplates, currentInvoiceFormType]
  );
  const selectedInvoiceTemplate = useMemo(
    () => eligibleInvoiceTemplates.find((template) => template.id === form.invoiceTemplateId) || null,
    [eligibleInvoiceTemplates, form.invoiceTemplateId]
  );

  const customerNameById = useMemo(
    () =>
      customers.reduce<Record<string, string>>((acc, customer) => {
        acc[customer.id] = customer.displayName;
        return acc;
      }, {}),
    [customers]
  );

  const itemById = useMemo(
    () =>
      items.reduce<Record<string, InventoryItemDTO>>((acc, item) => {
        acc[item.id] = item;
        return acc;
      }, {}),
    [items]
  );

  const salesOrderLabelById = useMemo(
    () =>
      salesOrders.reduce<Record<string, string>>((acc, order) => {
        acc[order.id] = `${order.orderNumber} - ${order.customerName}`;
        return acc;
      }, {}),
    [salesOrders]
  );
  const invoiceableSalesOrders = useMemo(
    () =>
      salesOrders.filter((order) =>
        order.id === form.salesOrderId ||
        order.status === 'CONFIRMED' ||
        order.status === 'PARTIALLY_DELIVERED'
      ),
    [form.salesOrderId, salesOrders]
  );

  const taxById = useMemo(
    () =>
      taxCodes.reduce<Record<string, TaxCodeDTO>>((acc, taxCode) => {
        acc[taxCode.id] = taxCode;
        return acc;
      }, {}),
    [taxCodes]
  );

  const salesTaxCodes = useMemo(
    () => taxCodes.filter((taxCode) => taxCode.scope === 'SALES' || taxCode.scope === 'BOTH'),
    [taxCodes]
  );

  const computedLines = useMemo(() => {
    return form.lines.map((line) => {
      const taxCode = line.taxCodeId ? taxById[line.taxCodeId] : undefined;
      const taxRate = taxCode?.rate ?? 0;
      const effectiveInclusive =
        line.priceIsInclusive !== undefined ? line.priceIsInclusive === true : taxCode?.priceIsInclusive === true;
      const divisor = effectiveInclusive ? 1 + taxRate : 1;
      const grossLineTotalDoc = roundMoney((line.invoicedQty || 0) * (line.unitPriceDoc || 0));
      const discountValue = Number(line.discountValue || 0);
      const discountAmountDoc = line.discountType === 'PERCENT'
        ? roundMoney(Math.max(0, Math.min(grossLineTotalDoc, grossLineTotalDoc * (discountValue / 100))))
        : line.discountType === 'AMOUNT'
          ? roundMoney(Math.max(0, Math.min(grossLineTotalDoc, discountValue)))
          : 0;
      const postDiscountDoc = roundMoney(grossLineTotalDoc - discountAmountDoc);
      const lineTotalDoc = effectiveInclusive ? roundMoney(postDiscountDoc / divisor) : postDiscountDoc;
      const lineTotalBase = roundMoney(lineTotalDoc * (form.exchangeRate || 0));
      const taxAmountDoc = effectiveInclusive
        ? roundMoney(postDiscountDoc - lineTotalDoc)
        : roundMoney(lineTotalDoc * taxRate);
      const taxAmountBase = roundMoney(taxAmountDoc * (form.exchangeRate || 0));

      // `lineGrossDoc` is what the user is paying for this line — qty × unit price
      // minus discount, with tax embedded if the line is inclusive. It equals
      // `lineTotalDoc + taxAmountDoc` either way and is what the LINE TOTAL
      // column shows. `lineTotalDoc` (net) is shown separately in the NET column.
      const lineGrossDoc = roundMoney(lineTotalDoc + taxAmountDoc);
      return { grossLineTotalDoc, discountAmountDoc, lineGrossDoc, lineTotalDoc, lineTotalBase, taxAmountDoc, taxAmountBase };
    });
  }, [form.exchangeRate, form.lines, taxById]);

  const computedCharges = useMemo(() => {
    return form.charges.map((charge) => {
      const taxRate = charge.taxCodeId ? taxById[charge.taxCodeId]?.rate ?? 0 : 0;
      const amountDoc = roundMoney(charge.amountDoc || 0);
      const amountBase = roundMoney(amountDoc * (form.exchangeRate || 0));
      const taxAmountDoc = roundMoney(amountDoc * taxRate);
      const taxAmountBase = roundMoney(amountBase * taxRate);
      return { amountDoc, amountBase, taxAmountDoc, taxAmountBase };
    });
  }, [form.charges, form.exchangeRate, taxById]);

  const totals = useMemo(() => {
    const subtotalDoc = roundMoney(
      computedLines.reduce((sum, line) => sum + line.lineTotalDoc, 0)
      + computedCharges.reduce((sum, charge) => sum + charge.amountDoc, 0)
    );
    const subtotalBase = roundMoney(
      computedLines.reduce((sum, line) => sum + line.lineTotalBase, 0)
      + computedCharges.reduce((sum, charge) => sum + charge.amountBase, 0)
    );
    const taxTotalDoc = roundMoney(
      computedLines.reduce((sum, line) => sum + line.taxAmountDoc, 0)
      + computedCharges.reduce((sum, charge) => sum + charge.taxAmountDoc, 0)
    );
    const taxTotalBase = roundMoney(
      computedLines.reduce((sum, line) => sum + line.taxAmountBase, 0)
      + computedCharges.reduce((sum, charge) => sum + charge.taxAmountBase, 0)
    );
    return {
      subtotalDoc, subtotalBase, taxTotalDoc, taxTotalBase,
      grandTotalDoc: roundMoney(subtotalDoc + taxTotalDoc),
      grandTotalBase: roundMoney(subtotalBase + taxTotalBase),
    };
  }, [computedCharges, computedLines]);

  const lineColumns = useMemo<ColumnDef<EditableLine>[]>(() => {
    const showBaseCurrency = form.currency !== (company?.baseCurrency || 'USD');
    const cols: ColumnDef<EditableLine>[] = [
      {
        id: 'item',
        label: t('sales.invoiceDetail.col.item', 'Item'),
        kind: 'custom',
        width: '220px',
        render: (row, index, onChange) => {
          if (isReadOnly) {
            return (
              <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                {row.itemCode ? `${row.itemCode} - ${row.itemName}` : row.itemName || '—'}
              </div>
            );
          }
          return (
            <div className="flex flex-col w-full p-1 gap-1">
              <ItemSelector
                value={row.itemId}
                onChange={(item) => {
                  if (item) {
                    const defaultUom = getDefaultItemUomOption(item, 'sales');
                    onChange({
                      itemId: item.id,
                      itemCode: item.code,
                      itemName: item.name,
                      uomId: defaultUom?.uomId,
                      uom: defaultUom?.code || item.salesUom || item.baseUom,
                      warehouseId: row.warehouseId || settings?.defaultWarehouseId || undefined,
                      taxCodeId: row.taxCodeId || item.defaultSalesTaxCodeId || undefined,
                    });
                    focusLine(item.id);
                  } else {
                    onChange({
                      itemId: '',
                      itemCode: '',
                      itemName: '',
                      uomId: undefined,
                      uom: '',
                      taxCodeId: undefined,
                    });
                  }
                }}
              />
            </div>
          );
        },
      },
      {
        id: 'invoicedQty',
        label: t('sales.invoiceDetail.col.qty', 'Qty'),
        kind: 'number',
        width: '64px',
        accessor: (row) => row.invoicedQty,
        setter: (value) => ({ invoicedQty: Number(value) }),
      },
      {
        id: 'uom',
        label: t('sales.invoiceDetail.col.uom', 'UOM'),
        kind: 'custom',
        width: '64px',
        render: (row, index, onChange) => {
          const opts = uomOptionsByItemId[row.itemId] || [];
          const val = findItemUomOption(opts, row.uomId, row.uom)?.uomId || row.uomId || row.uom || '';
          if (isReadOnly) {
            return <div className="text-center text-xs text-slate-800 dark:text-slate-200 uppercase">{row.uom || '—'}</div>;
          }
          return (
            <select
              value={val}
              disabled={busy || !row.itemId}
              onChange={(e) => {
                const selected = opts.find((o) => (o.uomId || o.code) === e.target.value);
                onChange({ uomId: selected?.uomId, uom: selected?.code || '' });
              }}
              className="w-full h-8 bg-transparent border-0 outline-none text-xs uppercase text-slate-900 dark:text-slate-100 focus:bg-blue-50/40 dark:focus:bg-blue-950/20 appearance-none cursor-pointer"
            >
              <option value="">{row.itemId ? t('sales.invoiceDetail.selectUomShort', 'Select') : '—'}</option>
              {opts.map((option) => (
                <option key={option.uomId || option.code} value={option.uomId || option.code}>
                  {option.code}
                </option>
              ))}
            </select>
          );
        },
      },
      {
        id: 'price',
        label: t('sales.invoiceDetail.col.unitPrice', 'Unit Price'),
        kind: 'number',
        width: '82px',
        accessor: (row) => row.unitPriceDoc,
        setter: (value) => ({ unitPriceDoc: Number(value) }),
      },
      {
        id: 'discountType',
        label: t('sales.invoiceDetail.col.discountType', 'Discount Type'),
        kind: 'select',
        width: '86px',
        accessor: (row) => row.discountType || '',
        setter: (value) => ({ discountType: (value || undefined) as any, discountValue: 0 }),
        options: [
          { value: '', label: t('sales.invoiceDetail.noDiscount', 'No Discount') },
          { value: 'PERCENT', label: t('sales.invoiceDetail.discountPercent', 'Percent') },
          { value: 'AMOUNT', label: t('sales.invoiceDetail.discountAmount', 'Amount') },
        ],
      },
      {
        id: 'discountValue',
        label: t('sales.invoiceDetail.col.discount', 'Discount'),
        kind: 'number',
        width: '70px',
        accessor: (row) => row.discountValue || 0,
        setter: (value) => ({ discountValue: Number(value) }),
      },
      {
        id: 'taxCode',
        label: t('sales.invoiceDetail.col.taxCode', 'Tax Code'),
        kind: 'custom',
        width: '100px',
        render: (row, index, onChange) => {
          if (isReadOnly) {
            return (
              <div className="text-xs text-slate-800 dark:text-slate-200">
                {row.taxCodeId ? taxById[row.taxCodeId]?.code || row.taxCodeId : t('sales.invoiceDetail.noTax', 'No Tax')}
              </div>
            );
          }
          const tc = row.taxCodeId ? taxById[row.taxCodeId] : undefined;
          const effective = row.priceIsInclusive !== undefined ? row.priceIsInclusive : tc?.priceIsInclusive === true;
          return (
            <div className="flex flex-col p-1 gap-0.5">
              <select
                className="w-full border-0 bg-transparent text-xs outline-none text-slate-900 dark:text-slate-100 focus:bg-blue-50/40 dark:focus:bg-blue-950/20 cursor-pointer"
                value={row.taxCodeId || ''}
                onChange={(e) => onChange({ taxCodeId: e.target.value || undefined })}
              >
                <option value="">{t('sales.invoiceDetail.noTax', 'No Tax')}</option>
                {salesTaxCodes.map((taxCode) => (
                  <option key={taxCode.id} value={taxCode.id}>{taxCode.code} ({Math.round(taxCode.rate * 100)}%)</option>
                ))}
              </select>
              {row.taxCodeId && (
                <label className="flex items-center gap-1 text-[10px] text-slate-500 select-none">
                  <input
                    type="checkbox"
                    className="h-3 w-3 rounded border-slate-300 dark:border-slate-700 text-primary-600 focus:ring-primary-500"
                    checked={effective}
                    onChange={(e) => onChange({ priceIsInclusive: e.target.checked })}
                  />
                  <span className="truncate">{t('sales.invoiceDetail.taxInclusive', 'Tax-incl.')}</span>
                </label>
              )}
            </div>
          );
        },
      },
      {
        id: 'discountAmt',
        label: t('sales.invoiceDetail.col.discountAmt', 'Discount Amt'),
        kind: 'computed',
        width: '82px',
        compute: (row, index) => computedLines[index]?.discountAmountDoc ?? 0,
      },
      {
        id: 'lineTotal',
        label: t('sales.invoiceDetail.col.lineTotal', 'Line Total'),
        kind: 'computed',
        width: '90px',
        compute: (row, index) => computedLines[index]?.lineGrossDoc ?? 0,
      },
      {
        id: 'net',
        label: t('sales.invoiceDetail.col.net', 'Net'),
        kind: 'computed',
        width: '82px',
        compute: (row, index) => computedLines[index]?.lineTotalDoc ?? 0,
      },
      {
        id: 'taxAmt',
        label: t('sales.invoiceDetail.col.tax', 'Tax'),
        kind: 'computed',
        width: '82px',
        compute: (row, index) => computedLines[index]?.taxAmountDoc ?? 0,
      }
    ];

    if (showBaseCurrency) {
      cols.push({
        id: 'netBase',
        label: t('sales.invoiceDetail.col.netBase', 'Net Base'),
        kind: 'computed',
        width: '90px',
        compute: (row, index) => computedLines[index]?.lineTotalBase ?? 0,
      });
    }

    return cols;
  }, [form.currency, form.lines, company?.baseCurrency, isReadOnly, uomOptionsByItemId, busy, settings, salesTaxCodes, taxById, computedLines, t]);

  const toEditableLinesFromLinkedSource = (source: InvoiceableLinkedSalesSourceDTO): EditableLine[] => {
    return source.lines.map((line) => ({
      soLineId: line.soLineId,
      dnLineId: line.dnLineId,
      itemId: line.itemId,
      itemCode: line.itemCode,
      itemName: line.itemName,
      invoicedQty: line.remainingQty,
      uomId: line.uomId,
      uom: line.uom,
      unitPriceDoc: line.unitPriceDoc,
      taxCodeId: line.taxCodeId,
      warehouseId: line.warehouseId,
      description: line.description,
    }));
  };

  const setStartupProgress = (patch: Partial<LoadingProgress>) => {
    setLoadingProgress((current) => current ? { ...current, ...patch } : current);
  };

  const trackStartupCall = async <T,>(label: string, work: () => Promise<T>): Promise<T> => {
    setLoadingProgress((current) => current ? { ...current, activeLabel: label } : current);
    try {
      return await work();
    } finally {
      setLoadingProgress((current) => current
        ? {
            ...current,
            completedCalls: Math.min(current.completedCalls + 1, current.totalCalls),
            activeLabel: current.completedCalls + 1 >= current.totalCalls
              ? t('sales.invoiceDetail.loadingFinalizing', 'Finalizing form')
              : current.activeLabel,
          }
        : current
      );
    }
  };

  const loadCachedReferenceData = async (): Promise<SalesInvoiceReferenceData> => {
    const cacheKey = company?.id || 'active-company';
    const now = Date.now();
    const cached = salesInvoiceReferenceCache.get(cacheKey);

    setStartupProgress({ cacheStatus: 'checking', activeLabel: t('sales.invoiceDetail.loadingCheckingCache', 'Checking startup cache') });

    if (cached?.data && cached.expiresAt > now) {
      setStartupProgress({
        cacheStatus: 'hit',
        completedCalls: Math.max(10, loadingProgress?.completedCalls || 0),
        activeLabel: t('sales.invoiceDetail.loadingCacheHit', 'Using cached startup data'),
      });
      return cached.data;
    }

    if (cached?.promise) {
      setStartupProgress({
        cacheStatus: 'inflight',
        activeLabel: t('sales.invoiceDetail.loadingCacheInflight', 'Waiting for shared startup load'),
      });
      return cached.promise;
    }

    setStartupProgress({ cacheStatus: 'miss', activeLabel: t('sales.invoiceDetail.loadingReferenceData', 'Loading reference data') });

    const promise = Promise.all([
      trackStartupCall(t('sales.invoiceDetail.loadingSalesSettings', 'Sales settings'), () => salesApi.getSettings()).then(unwrap<SalesSettingsDTO | null>),
      trackStartupCall(t('sales.invoiceDetail.loadingCustomers', 'Customers'), () => sharedApi.listParties({ role: 'CUSTOMER', active: true })).then(unwrap<PartyDTO[]>),
      trackStartupCall(t('sales.invoiceDetail.loadingItems', 'Items'), () => inventoryApi.listItems({ active: true, limit: 500 })).then(unwrap<InventoryItemDTO[]>),
      trackStartupCall(t('sales.invoiceDetail.loadingTaxCodes', 'Tax codes'), () => sharedApi.listTaxCodes({ active: true })).then(unwrap<TaxCodeDTO[]>),
      trackStartupCall(t('sales.invoiceDetail.loadingWarehouses', 'Warehouses'), () => inventoryApi.listWarehouses({ active: true })).then(unwrap<InventoryWarehouseDTO[]>),
      trackStartupCall(t('sales.invoiceDetail.loadingSalesOrders', 'Sales orders'), () => salesApi.listSOs({ limit: 500 })).then(unwrap<SalesOrderDTO[]>),
      trackStartupCall(t('sales.invoiceDetail.loadingSalespersons', 'Salespersons'), () => salesMasterDataApi.listSalespersons({ status: 'ACTIVE' })).then(unwrap<SalespersonDTO[]>),
      trackStartupCall(t('sales.invoiceDetail.loadingCommunications', 'Communications settings'), () => communicationsApi.getSettings().catch(() => null)).then(unwrap<CommunicationsSettingsDTO | null>),
      trackStartupCall(t('sales.invoiceDetail.loadingAccountingPolicy', 'Accounting policy'), () => accountingApi.getPolicyConfig().catch(() => null)).then(unwrap<AccountingPolicyConfig | null>),
      trackStartupCall(t('sales.invoiceDetail.loadingInvoiceTemplates', 'Invoice templates'), () => voucherFormApi.list().catch((templateError) => {
        console.error('Failed to load sales invoice templates', templateError);
        return [];
      })).then(unwrap<VoucherFormResponse[]>),
    ]).then(([
      settings,
      customers,
      items,
      taxCodes,
      warehouses,
      salesOrders,
      salespersons,
      commSettings,
      accountingPolicy,
      invoiceTemplates,
    ]) => ({
      settings,
      customers: Array.isArray(customers) ? customers : [],
      items: Array.isArray(items) ? items : [],
      taxCodes: Array.isArray(taxCodes) ? taxCodes : [],
      warehouses: Array.isArray(warehouses) ? warehouses : [],
      salesOrders: Array.isArray(salesOrders) ? salesOrders : [],
      salespersons: Array.isArray(salespersons) ? salespersons : [],
      commSettings,
      accountingPolicy,
      invoiceTemplates: Array.isArray(invoiceTemplates) ? invoiceTemplates : [],
    }));

    salesInvoiceReferenceCache.set(cacheKey, {
      expiresAt: now + SALES_INVOICE_REFERENCE_CACHE_TTL_MS,
      promise,
    });

    try {
      const data = await promise;
      salesInvoiceReferenceCache.set(cacheKey, {
        expiresAt: Date.now() + SALES_INVOICE_REFERENCE_CACHE_TTL_MS,
        data,
      });
      return data;
    } catch (referenceError) {
      salesInvoiceReferenceCache.delete(cacheKey);
      throw referenceError;
    }
  };

  const loadReferenceData = async () => {
    const referenceData = await loadCachedReferenceData();

    setSettings(referenceData.settings);
    setAccountingPolicy(referenceData.accountingPolicy);
    setCommSettings(referenceData.commSettings);
    setCustomers(referenceData.customers);
    setItems(referenceData.items);
    setTaxCodes(referenceData.taxCodes);
    setWarehouses(referenceData.warehouses);
    setSalesOrders(referenceData.salesOrders);
    setSalespersons(referenceData.salespersons);
    setInvoiceTemplates(referenceData.invoiceTemplates);
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

  const loadSalesOrderLines = async (orderId: string) => {
    const trimmedOrderId = orderId.trim();
    if (!trimmedOrderId) return;
    try {
      setOrderLineLoading(true);
      setError(null);
      const sourceResult = await salesApi.getInvoiceableLinkedSource(trimmedOrderId);
      const source = unwrap<InvoiceableLinkedSalesSourceDTO>(sourceResult);
      const nextLines = toEditableLinesFromLinkedSource(source);
      setForm((prev) => ({
        ...prev,
        salesOrderId: trimmedOrderId,
        customerId: source.customerId,
        customerName: source.customerName,
        currency: source.currency,
        exchangeRate: source.exchangeRate,
        salespersonId: salesOrders.find((order) => order.id === trimmedOrderId)?.salespersonId || prev.salespersonId,
        warehouseId: undefined,
        lines: nextLines.length ? nextLines : [createEmptyLine()],
      }));
    } catch (err: any) {
      console.error('Failed to load invoiceable linked lines', err);
      errorHandler.showError(err?.response?.data?.error?.message || err?.response?.data?.message || err?.message || t('sales.invoiceDetail.loadLinkedLinesFailed', 'Failed to load invoiceable linked lines.'));
    } finally {
      setOrderLineLoading(false);
    }
  };

  const populateFormFromInvoice = (loaded: SalesInvoiceDTO) => {
    setForm({
      id: loaded.id,
      status: loaded.status,
      salesOrderId: loaded.salesOrderId || '',
      customerId: loaded.customerId,
      customerName: loaded.customerName,
      invoiceTemplateId: loaded.voucherFormId || '',
      invoiceTemplateFormType: loaded.formType || '',
      salespersonId: loaded.salespersonId || undefined,
      customerInvoiceNumber: loaded.customerInvoiceNumber || '',
      invoiceDate: loaded.invoiceDate,
      dueDate: loaded.dueDate || '',
      currency: loaded.currency,
      exchangeRate: loaded.exchangeRate,
      warehouseId: loaded.lines?.find((line) => line.warehouseId)?.warehouseId,
      notes: loaded.notes || '',
      lines: padLinesToMin((loaded.lines || []).map((l) => ({
        lineId: l.lineId,
        soLineId: l.soLineId,
        dnLineId: l.dnLineId,
        itemId: l.itemId,
        itemCode: l.itemCode,
        itemName: l.itemName,
        invoicedQty: l.invoicedQty,
        uomId: l.uomId,
        uom: l.uom,
        unitPriceDoc: l.unitPriceDoc,
        discountType: (l as any).discountType as any,
        discountValue: (l as any).discountValue,
        taxCodeId: l.taxCodeId,
        priceIsInclusive: (l as any).priceIsInclusive,
        warehouseId: l.warehouseId,
        description: l.description,
      }))),
      charges: ((loaded as any).charges || []).map((c: any) => ({
        chargeId: c.chargeId,
        code: c.code,
        name: c.name,
        amountDoc: c.amountDoc,
        taxCodeId: c.taxCodeId,
        revenueAccountId: c.revenueAccountId,
        description: c.description,
      })),
    });
  };

  const load = async () => {
    try {
      const totalStartupCalls = isCreateMode ? 10 : 11;
      const routeKey = resolvedId || 'new';
      startupTimingLoggedRef.current = false;
      startupTimingRef.current = {
        routeKey,
        mode: isCreateMode ? 'new' : 'edit',
        startedAt: getPerfTime(),
        totalCalls: totalStartupCalls,
      };
      setLoading(true);
      setError(null);
      setLoadingProgress({
        startedAt: Date.now(),
        elapsedSeconds: 0,
        totalCalls: totalStartupCalls,
        completedCalls: 0,
        activeLabel: t('sales.invoiceDetail.loadingStarting', 'Starting sales invoice form'),
        cacheStatus: 'checking',
      });
      await loadReferenceData();
      if (startupTimingRef.current?.routeKey === routeKey) {
        startupTimingRef.current.referenceDataFinishedAt = getPerfTime();
      }
      if (!isCreateMode && resolvedId) {
        const result = await trackStartupCall(t('sales.invoiceDetail.loadingInvoice', 'Sales invoice'), () => salesApi.getSI(resolvedId));
        if (startupTimingRef.current?.routeKey === routeKey) {
          startupTimingRef.current.invoiceFetchFinishedAt = getPerfTime();
        }
        const loaded = unwrap<SalesInvoiceDTO>(result);
        setInvoice(loaded);
        setAttachments(Array.isArray(loaded.attachments) ? loaded.attachments : []);
        populateFormFromInvoice(loaded);
      } else {
        setInvoice(null);
        setAttachments([]);
        setForm(createEmptyForm(initialSalesOrderId, initialCustomerId));
        if (initialSalesOrderId) {
          await loadSalesOrderLines(initialSalesOrderId);
        }
      }
      if (startupTimingRef.current?.routeKey === routeKey) {
        startupTimingRef.current.dataReadyAt = getPerfTime();
        startupTimingRef.current.completedCalls = loadingProgress?.completedCalls;
      }
    } catch (err: any) {
      // A missing invoice is a normal not-found state, not a critical error.
      // Leave `invoice` null so the friendly not-found EmptyState renders.
      const status = err?.response?.status;
      const code = err?.response?.data?.error?.code;
      if (status === 404 || code === 'NOT_FOUND') {
        setInvoice(null);
        return;
      }
      console.error('Failed to load sales invoice detail', err);
      errorHandler.showError(err?.response?.data?.error?.message || err?.response?.data?.message || err?.message || t('sales.invoiceDetail.loadFailed', 'Failed to load sales invoice.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [resolvedId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (loading || !startupTimingRef.current || startupTimingLoggedRef.current) return;
    const timing = startupTimingRef.current;
    const frame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        if (startupTimingLoggedRef.current) return;
        startupTimingLoggedRef.current = true;
        timing.visibleAt = getPerfTime();
        const referenceMs = Math.round((timing.referenceDataFinishedAt || timing.dataReadyAt || timing.visibleAt) - timing.startedAt);
        const invoiceMs = timing.invoiceFetchFinishedAt && timing.referenceDataFinishedAt
          ? Math.round(timing.invoiceFetchFinishedAt - timing.referenceDataFinishedAt)
          : 0;
        const dataReadyMs = Math.round((timing.dataReadyAt || timing.visibleAt) - timing.startedAt);
        const visibleMs = Math.round(timing.visibleAt - timing.startedAt);
        const renderAfterDataMs = Math.max(0, visibleMs - dataReadyMs);

        console.groupCollapsed(`[SalesInvoiceDetail] startup timing (${timing.mode}, ${timing.routeKey})`);
        console.table([
          { phase: 'Reference data ready', ms: referenceMs },
          { phase: 'Invoice fetch after reference', ms: invoiceMs },
          { phase: 'All data ready', ms: dataReadyMs },
          { phase: 'First painted frame', ms: visibleMs },
          { phase: 'Render/layout after data', ms: renderAfterDataMs },
        ]);
        console.info('Expected startup API calls:', timing.totalCalls);
        console.groupEnd();
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [loading]);

  useEffect(() => {
    if (!loading || !loadingProgress?.startedAt) return;
    const timer = window.setInterval(() => {
      setLoadingProgress((current) => current
        ? { ...current, elapsedSeconds: Math.max(0, Math.floor((Date.now() - current.startedAt) / 1000)) }
        : current
      );
    }, 250);
    return () => window.clearInterval(timer);
  }, [loading, loadingProgress?.startedAt]);

  useEffect(() => {
    const ids = Array.from(new Set<string>(form.lines.map((line) => line.itemId).filter((id): id is string => Boolean(id))));
    ids.forEach((itemId) => { void ensureItemUomOptions(itemId); });
  }, [form.lines, itemById]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isCreateMode) return;
    if (!form.customerId) return;
    const currentTemplateIsValid = eligibleInvoiceTemplates.some((template) => template.id === form.invoiceTemplateId);
    if (templateTouched && currentTemplateIsValid) return;
    const customer = customerById[form.customerId];
    let nextTemplate =
      eligibleInvoiceTemplates.find((template) => template.id === customer?.defaultSalesInvoiceTemplateId) || null;
    if (!nextTemplate && normalizeToken(customer?.defaultSalesInvoiceFormType) === currentInvoiceFormType) {
      nextTemplate = eligibleInvoiceTemplates.find((template) => !!template.isDefault) || eligibleInvoiceTemplates[0] || null;
    }
    if (!nextTemplate && currentTemplateIsValid) {
      nextTemplate = eligibleInvoiceTemplates.find((template) => template.id === form.invoiceTemplateId) || null;
    }
    if (!nextTemplate) {
      nextTemplate = eligibleInvoiceTemplates.find((template) => !!template.isDefault) || eligibleInvoiceTemplates[0] || null;
    }
    const nextTemplateId = nextTemplate?.id || '';
    const nextTemplateFormType = nextTemplate?.formType || currentInvoiceFormType;
    if (nextTemplateId === form.invoiceTemplateId && nextTemplateFormType === form.invoiceTemplateFormType) return;
    setForm((prev) => ({ ...prev, invoiceTemplateId: nextTemplateId, invoiceTemplateFormType: nextTemplateFormType }));
  }, [currentInvoiceFormType, customerById, eligibleInvoiceTemplates, form.customerId, form.invoiceTemplateFormType, form.invoiceTemplateId, isCreateMode, templateTouched]);

  const setLine = (index: number, patch: Partial<EditableLine>) => {
    setForm((prev) => {
      const lines = [...prev.lines];
      const current = lines[index];
      const next: EditableLine = { ...current, ...patch };
      if (patch.itemId !== undefined) {
        const item = itemById[patch.itemId];
        if (item) {
          const defaultUom = getDefaultItemUomOption(item, 'sales');
          next.itemCode = item.code;
          next.itemName = item.name;
          next.uomId = next.uomId || defaultUom?.uomId;
          next.uom = next.uom || defaultUom?.code || item.salesUom || item.baseUom;
          if (!next.warehouseId && settings?.defaultWarehouseId) {
            next.warehouseId = prev.warehouseId || settings.defaultWarehouseId;
          }
          if (!next.taxCodeId && item.defaultSalesTaxCodeId) {
            const defaultTax = salesTaxCodes.find((taxCode) => taxCode.id === item.defaultSalesTaxCodeId);
            if (defaultTax) next.taxCodeId = defaultTax.id;
          }
        } else {
          next.itemCode = undefined;
          next.itemName = undefined;
          next.taxCodeId = undefined;
        }
      }
      lines[index] = next;
      if (index === lines.length - 1 && hasLineContent(next)) {
        lines.push(createEmptyLine());
      }
      return { ...prev, lines };
    });

    const shouldFetchPrice = patch.itemId !== undefined || patch.invoicedQty !== undefined;
    if (shouldFetchPrice) {
      const closureLine = form.lines[index];
      const resolvedItemId = patch.itemId !== undefined ? patch.itemId : closureLine?.itemId;
      const resolvedQty = patch.invoicedQty !== undefined ? patch.invoicedQty : closureLine?.invoicedQty ?? 1;
      if (form.customerId && resolvedItemId) {
        salesMasterDataApi
          .getEffectivePrice({ customerId: form.customerId, itemId: resolvedItemId, qty: resolvedQty })
          .then((result) => {
            if (result?.unitPrice != null) {
              setForm((latest) => {
                const updatedLines = [...latest.lines];
                if (updatedLines[index]) {
                  updatedLines[index] = { ...updatedLines[index], unitPriceDoc: result.unitPrice };
                }
                return { ...latest, lines: updatedLines };
              });
            }
          })
          .catch((err) => {
            console.warn('Effective price lookup failed', err);
            errorHandler.showWarning(t('sales.invoiceDetail.pricingLookupFailed', 'Could not look up customer-specific price; keeping current price.'));
          });
      }
    }
  };

  const addLine = () => { setForm((prev) => ({ ...prev, lines: [...prev.lines, createEmptyLine()] })); };
  const removeLine = (index: number) => {
    setForm((prev) => {
      if (prev.lines.length <= 1) return prev;
      return { ...prev, lines: padLinesToMin(prev.lines.filter((_, idx) => idx !== index)) };
    });
  };
  const validateBeforeSave = (): string | null => {
    if (!form.customerId) return t('sales.invoiceDetail.validation.customerRequired', 'Customer is required.');
    if (!form.invoiceDate) return t('sales.invoiceDetail.validation.invoiceDateRequired', 'Invoice date is required.');
    if (!form.currency.trim()) return t('sales.invoiceDetail.validation.currencyRequired', 'Currency is required.');
    if (Number.isNaN(form.exchangeRate) || form.exchangeRate <= 0) return t('sales.invoiceDetail.validation.exchangeRateInvalid', 'Exchange rate must be greater than 0.');
    const usable = filledLines(form.lines);
    if (!usable.length) return t('sales.invoiceDetail.validation.linesRequired', 'At least one line is required.');
    for (let i = 0; i < usable.length; i += 1) {
      const line = usable[i];
      if (Number.isNaN(line.unitPriceDoc) || line.unitPriceDoc < 0) return t('sales.invoiceDetail.validation.lineUnitPriceInvalid', 'Line {{n}}: unit price must be >= 0.', { n: i + 1 });
      if (line.discountType && (Number.isNaN(line.discountValue || 0) || (line.discountValue || 0) < 0)) return t('sales.invoiceDetail.validation.lineDiscountInvalid', 'Line {{n}}: discount must be >= 0.', { n: i + 1 });
      const item = itemById[line.itemId];
      if (item?.trackInventory && !line.dnLineId && !(line.warehouseId || (activeSourceMode === 'direct' ? form.warehouseId : undefined))) {
        return t('sales.invoiceDetail.validation.lineWarehouseRequired', 'Line {{n}}: warehouse is required for stock item {{item}}.', { n: i + 1, item: item.name });
      }
    }
    for (let i = 0; i < form.charges.length; i += 1) {
      const charge = form.charges[i];
      const hasName = !!charge.name?.trim();
      const hasAmount = (charge.amountDoc || 0) > 0;
      if (!hasName && !hasAmount) continue; // empty row — silently dropped on save
      if (!hasName) return t('sales.invoiceDetail.validation.chargeNameRequired', 'Charge {{n}}: name is required.', { n: i + 1 });
      if (!hasAmount) return t('sales.invoiceDetail.validation.chargeAmountInvalid', 'Charge {{n}}: amount must be greater than 0.', { n: i + 1 });
    }
    return null;
  };

  const buildLinePayload = (line: EditableLine, index: number): SalesInvoiceLineInputDTO => {
    const item = itemById[line.itemId];
    return {
      lineId: line.lineId,
      lineNo: index + 1,
      soLineId: line.soLineId || undefined,
      dnLineId: line.dnLineId || undefined,
      itemId: line.itemId || undefined,
      invoicedQty: line.invoicedQty,
      uomId: line.uomId,
      uom: line.uom || item?.salesUom || item?.baseUom || 'EA',
      unitPriceDoc: line.unitPriceDoc,
      discountType: line.discountType,
      discountValue: line.discountType ? line.discountValue || 0 : undefined,
      taxCodeId: line.taxCodeId || undefined,
      priceIsInclusive: line.priceIsInclusive,
      warehouseId: line.warehouseId || (activeSourceMode === 'direct' ? form.warehouseId : undefined) || undefined,
      description: line.description || undefined,
    };
  };

  const buildCreatePayload = (creditOverrideReasonParam?: string, settlementInput?: any): CreateSalesInvoicePayload => ({
    source: 'native',
    voucherFormId: selectedInvoiceTemplate?.id || form.invoiceTemplateId || undefined,
    formType: selectedInvoiceTemplate?.formType || form.invoiceTemplateFormType || currentInvoiceFormType,
    salesOrderId: form.salesOrderId || undefined,
    customerId: form.customerId,
    salespersonId: form.salespersonId || undefined,
    customerInvoiceNumber: form.customerInvoiceNumber || undefined,
    invoiceDate: form.invoiceDate,
    currency: form.currency.toUpperCase(),
    exchangeRate: form.exchangeRate,
    lines: filledLines(form.lines).map((line, index) => buildLinePayload(line, index)),
    charges: form.charges.filter((c) => c.name?.trim() && (c.amountDoc || 0) > 0).map((charge) => ({
      chargeId: charge.chargeId,
      code: charge.code || undefined,
      name: charge.name,
      amountDoc: charge.amountDoc,
      taxCodeId: charge.taxCodeId || undefined,
      revenueAccountId: charge.revenueAccountId || undefined,
      description: charge.description || undefined,
    })),
    notes: form.notes || undefined,
    settlementInput,
    creditOverrideReason: creditOverrideReasonParam,
  });

  const buildUpdatePayload = (): UpdateSalesInvoicePayload => ({
    voucherFormId: selectedInvoiceTemplate?.id || form.invoiceTemplateId || undefined,
    formType: selectedInvoiceTemplate?.formType || form.invoiceTemplateFormType || currentInvoiceFormType,
    customerId: form.customerId,
    salespersonId: form.salespersonId || undefined,
    customerInvoiceNumber: form.customerInvoiceNumber || undefined,
    invoiceDate: form.invoiceDate,
    currency: form.currency.toUpperCase(),
    exchangeRate: form.exchangeRate,
    lines: filledLines(form.lines).map((line, index) => buildLinePayload(line, index)),
    charges: form.charges.filter((c) => c.name?.trim() && (c.amountDoc || 0) > 0).map((charge) => ({
      chargeId: charge.chargeId,
      code: charge.code || undefined,
      name: charge.name,
      amountDoc: charge.amountDoc,
      taxCodeId: charge.taxCodeId || undefined,
      revenueAccountId: charge.revenueAccountId || undefined,
      description: charge.description || undefined,
    })),
    notes: form.notes || undefined,
  });

  /**
   * Detect a SOFT period-lock error and open the override modal.
   * Returns true if handled (caller should `return` without further error UI).
   * `retry` will be called with the override reason once user confirms.
   */
  const handlePeriodLock = (err: any, retry: (reason: string) => void): boolean => {
    const data = err?.response?.data?.error;
    if (!data || data.code !== 'PERIOD_LOCKED') return false;
    if (data.tier === 'SOFT') {
      setOverrideModalData({
        documentDate: data.documentDate || form.invoiceDate,
        lockedThroughDate: data.lockedThroughDate || '',
      });
      setPendingPeriodLockRetry(() => retry);
      setOverrideModalOpen(true);
      return true;
    }
    // HARD: cannot override
    errorHandler.showWarning(data.message || t('sales.invoiceDetail.periodLockedHard', 'This accounting period is closed and cannot be overridden.'));
    return true;
  };

  /** Detect known policy/governance blocks (expected validation, not a system error). Returns true if handled. */
  const handlePolicyBlock = (err: any): boolean => {
    const data = err?.response?.data;
    const code = data?.code ?? data?.error?.code ?? '';
    const category = data?.category ?? data?.error?.category ?? '';
    const msg: string = data?.message ?? data?.error?.message ?? err?.message ?? '';
    // PERIOD_LOCKED has its own dedicated modal flow — don't catch it here.
    if (code === 'PERIOD_LOCKED') return false;
    const isPolicy =
      code === 'PERSONA_NOT_ALLOWED' ||
      code === 'GOVERNANCE_RULE_VIOLATION' ||
      code === 'UNSETTLED_COST_BLOCKED' ||
      category === 'POLICY' ||
      msg.toLowerCase().includes('governance policy') ||
      msg.toLowerCase().includes('inventory cost');
    if (isPolicy) {
      errorHandler.showWarning(msg || t('sales.invoiceDetail.policyBlocked', 'This action is blocked by company policy.'));
      return true;
    }
    return false;
  };

  const handleCreditBlock = (err: any, payload: CreateSalesInvoicePayload, mode: 'draft' | 'createAndPost') => {
    const data = err?.response?.data;
    const code = data?.code ?? data?.error?.code ?? '';
    const msg: string = data?.message ?? data?.error?.message ?? err?.message ?? '';
    const isCreditBlock =
      code === 'CREDIT_LIMIT_EXCEEDED' ||
      msg.toLowerCase().includes('credit limit') ||
      msg.toLowerCase().includes('credit_limit');
    if (isCreditBlock) {
      if (!canOverrideCredit) {
        errorHandler.showError(t('sales.invoiceDetail.creditLimitBlocked', 'Customer is over their credit limit. You do not have permission to override.'));
        return true;
      }
      setPendingCreatePayload({ payload, mode });
      setCreditOverrideInfo(data?.details ?? data ?? null);
      setCreditOverrideReason('');
      setCreditOverrideOpen(true);
      return true;
    }
    return false;
  };

  const createDraft = async (creditOverrideReasonParam?: string) => {
    const validationError = validateBeforeSave();
    if (validationError) { errorHandler.showError(validationError); return; }
    try {
      setBusy(true);
      setError(null);
      const payload = buildCreatePayload(creditOverrideReasonParam);
      try {
        const created = await salesApi.createSI(payload);
        const raw = created as any;
        const creditCheck = raw?.creditCheck ?? raw?.data?.creditCheck;
        if (creditCheck?.outcome === 'WARN') {
          setCreditWarnBanner(t('sales.invoiceDetail.creditWarn', 'Invoice created — customer is over their credit limit (warning). Limit: {{limit}}, Exposure: {{exposure}}.', { limit: creditCheck.creditLimit ?? '—', exposure: creditCheck.currentExposure ?? '—' }));
        }
        const dto = unwrap<SalesInvoiceDTO>(created);
        errorHandler.showSuccess(t('sales.invoiceDetail.createSuccess', 'Invoice {{number}} saved as draft.', { number: dto.invoiceNumber }));
        if (isWindow && onSaved) {
          onSaved();
        } else {
          navigate(`/sales/invoices/${dto.id}`, { replace: true });
        }
      } catch (err: any) {
        if (handleCreditBlock(err, payload, 'draft')) return;
        throw err;
      }
    } catch (err: any) {
      if (handlePolicyBlock(err)) return;
      console.error('Failed to create sales invoice', err);
      errorHandler.showError(err?.response?.data?.error?.message || err?.response?.data?.message || err?.message || t('sales.invoiceDetail.createFailed', 'Failed to create sales invoice draft.'));
    } finally {
      setBusy(false);
    }
  };

  const saveDraftChanges = async () => {
    if (!invoice?.id) return;
    const validationError = validateBeforeSave();
    if (validationError) { errorHandler.showError(validationError); return; }
    try {
      setBusy(true);
      setError(null);
      const updated = await salesApi.updateSI(invoice.id, buildUpdatePayload());
      const dto = unwrap<SalesInvoiceDTO>(updated);
      setInvoice(dto);
      populateFormFromInvoice(dto);
      errorHandler.showSuccess(t('sales.invoiceDetail.saveChangesSuccess', 'Changes saved successfully.'));
      window.dispatchEvent(new CustomEvent('documents-updated', { detail: { type: 'SI' } }));
    } catch (err: any) {
      console.error('Failed to update sales invoice', err);
      errorHandler.showError(err?.response?.data?.error?.message || err?.response?.data?.message || err?.message || t('sales.invoiceDetail.updateFailed', 'Failed to save changes.'));
    } finally {
      setBusy(false);
    }
  };

  const createAndPostDraft = async (creditOverrideReasonParam?: string, periodLockOverrideReason?: string) => {
    const validationError = validateBeforeSave();
    if (validationError) { errorHandler.showError(validationError); return; }
    try {
      setBusy(true);
      setError(null);
      const outstanding = roundMoney(totals.grandTotalBase);
      const useSettlement = settlementMode !== 'DEFERRED' && outstanding > 0.005;
      const settlementInput = useSettlement ? {
        settlementMode,
        receivablePayableAccountId: arAccountId || undefined,
        settlements: settlementRows.map(r => ({
          settlementAccountId: r.settlementAccountId || undefined,
          amountBase: r.amountBase,
          paymentMethod: r.paymentMethod as any,
          reference: r.reference || undefined,
          notes: r.notes || undefined,
          paymentDate: r.paymentDate || undefined,
        })),
      } : undefined;
      const payload = buildCreatePayload(creditOverrideReasonParam, settlementInput);
      try {
        const created = await salesApi.createAndPostSI(payload, periodLockOverrideReason);
        const raw = created as any;
        const creditCheck = raw?.creditCheck ?? raw?.data?.creditCheck;
        if (creditCheck?.outcome === 'WARN') {
          setCreditWarnBanner(t('sales.invoiceDetail.creditWarn', 'Invoice created — customer is over their credit limit (warning). Limit: {{limit}}, Exposure: {{exposure}}.', { limit: creditCheck.creditLimit ?? '—', exposure: creditCheck.currentExposure ?? '—' }));
        }
        const dto = unwrap<SalesInvoiceDTO>(created);
        errorHandler.showSuccess(t('sales.invoiceDetail.createAndPostSuccess', 'Invoice {{number}} posted.', { number: dto.invoiceNumber }));
        if (isWindow && onSaved) {
          onSaved();
        } else {
          navigate(`/sales/invoices/${dto.id}`, { replace: true });
        }
      } catch (err: any) {
        if (handleCreditBlock(err, payload, 'createAndPost')) return;
        if (handlePeriodLock(err, (reason) => createAndPostDraft(creditOverrideReasonParam, reason))) return;
        throw err;
      }
    } catch (err: any) {
      if (handlePolicyBlock(err)) return;
      console.error('Failed to create and post sales invoice', err);
      errorHandler.showError(err?.response?.data?.error?.message || err?.response?.data?.message || err?.message || t('sales.invoiceDetail.createAndPostFailed', 'Failed to create and post sales invoice.'));
    } finally {
      setBusy(false);
    }
  };

  const submitCreditOverride = async () => {
    if (!pendingCreatePayload || !creditOverrideReason.trim()) return;
    const { payload, mode } = pendingCreatePayload;
    const newPayload = { ...payload, creditOverrideReason: creditOverrideReason.trim() };
    setCreditOverrideOpen(false);
    setPendingCreatePayload(null);
    setCreditOverrideInfo(null);
    try {
      setBusy(true);
      setError(null);
      if (mode === 'draft') {
        const created = await salesApi.createSI(newPayload);
        const dto = unwrap<SalesInvoiceDTO>(created);
        errorHandler.showSuccess(t('sales.invoiceDetail.createSuccess', 'Invoice {{number}} saved as draft.', { number: dto.invoiceNumber }));
        if (isWindow && onSaved) {
          onSaved();
        } else {
          navigate(`/sales/invoices/${dto.id}`, { replace: true });
        }
      } else {
        const created = await salesApi.createAndPostSI(newPayload);
        const dto = unwrap<SalesInvoiceDTO>(created);
        errorHandler.showSuccess(t('sales.invoiceDetail.createAndPostSuccess', 'Invoice {{number}} posted.', { number: dto.invoiceNumber }));
        if (isWindow && onSaved) {
          onSaved();
        } else {
          navigate(`/sales/invoices/${dto.id}`, { replace: true });
        }
      }
    } catch (err: any) {
      console.error('Failed to create invoice with credit override', err);
      errorHandler.showError(err?.response?.data?.error?.message || err?.response?.data?.message || err?.message || t('sales.invoiceDetail.creditOverrideFailed', 'Failed to create invoice with credit override.'));
    } finally {
      setBusy(false);
    }
  };

  const postDraft = async (periodLockOverrideReason?: string) => {
    if (!invoice?.id) return;
    try {
      setBusy(true);
      setError(null);
      const settlementInput = settlementMode !== 'DEFERRED' ? {
        settlementMode,
        receivablePayableAccountId: arAccountId || undefined,
        settlements: settlementRows.map(r => ({
          settlementAccountId: r.settlementAccountId || undefined,
          amountBase: r.amountBase,
          paymentMethod: r.paymentMethod as any,
          reference: r.reference || undefined,
          notes: r.notes || undefined,
          paymentDate: r.paymentDate || undefined,
        })),
      } : undefined;
      // SoD: Sales never approves. If the SI is already PENDING_APPROVAL,
      // direct the user to Accounting → Approval Center. Routing approval
      // through the source module violates the "one approval authority"
      // architecture (see docs/architecture/posting-authority.md §4.1).
      if (invoice.status === 'PENDING_APPROVAL') {
        setError(
          t(
            'sales.invoiceDetail.approveFromAccounting',
            'This invoice is waiting for accounting approval. Approve it from Accounting → Approval Center.',
          ),
        );
        return;
      }
      const posted = await salesApi.postSI(invoice.id, settlementInput, periodLockOverrideReason);
      const dto = unwrap<SalesInvoiceDTO>(posted);
      setInvoice(dto);
      populateFormFromInvoice(dto);
      errorHandler.showSuccess(t('sales.invoiceDetail.postSuccess', 'Invoice {{number}} posted.', { number: dto.invoiceNumber }));
      if (isWindow && onSaved) {
        onSaved();
      } else {
        window.dispatchEvent(new CustomEvent('documents-updated', { detail: { type: 'SI' } }));
      }
    } catch (err: any) {
      if (handlePeriodLock(err, (reason) => postDraft(reason))) return;
      if (handlePolicyBlock(err)) return;
      console.error('Failed to post sales invoice', err);
      errorHandler.showError(err?.response?.data?.error?.message || err?.response?.data?.message || err?.message || t('sales.invoiceDetail.postFailed', 'Failed to post sales invoice.'));
    } finally {
      setBusy(false);
    }
  };

  const handlePostClick = async () => {
    if (!invoice) return;
    const outstanding = roundMoney((invoice.grandTotalBase || 0) - (invoice.paidAmountBase || 0));
    if (settlementMode === 'DEFERRED') {
      const confirmed = await confirm({
        title: t('sales.invoiceDetail.postOnCreditTitle', 'Post on Credit'),
        message: t('sales.invoiceDetail.postOnCreditMessage', 'Are you sure you want to post this invoice on credit? This will increase the customer\'s receivable balance.'),
        confirmLabel: t('sales.invoiceDetail.postConfirm', 'Confirm & Post'),
        tone: 'warning',
      });
      if (!confirmed) return;
      postDraft();
    } else {
      // The inline SettlementBlock already holds the user's settlement rows.
      // Gate on its validity, then post directly. (#193 retired the old settlement
      // modal — re-opening it here rendered nothing and silently wiped the entry.)
      if (!settlementValidity.ok) {
        errorHandler.showError(settlementValidity.message || t('settlement.validation.needsAttention', 'Settlement needs attention.'));
        return;
      }
      postDraft();
    }
  };

  const handleDiscard = async () => {
    if (!invoice?.id) {
      if (isWindow && onClose) {
        onClose();
      } else {
        navigate('/sales/invoices');
      }
      return;
    }
    const confirmed = await confirm({
      title: t('sales.invoiceDetail.discardTitle', 'Discard Invoice'),
      message: t('sales.invoiceDetail.discardMessage', 'Are you sure you want to discard this draft invoice? This action cannot be undone.'),
      confirmLabel: t('sales.invoiceDetail.discardConfirm', 'Discard'),
      tone: 'danger',
    });
    if (!confirmed) return;
    try {
      setBusy(true);
      await salesApi.deleteSI(invoice.id);
      errorHandler.showSuccess(t('sales.invoiceDetail.discardSuccess', 'Invoice {{number}} discarded.', { number: invoice.invoiceNumber }));
      if (isWindow && onClose) {
        onClose();
      } else {
        navigate('/sales/invoices');
      }
    } catch (err: any) {
      errorHandler.showError(err?.response?.data?.error?.message || err?.message || t('sales.invoiceDetail.discardFailed', 'Failed to discard invoice.'));
    } finally {
      setBusy(false);
    }
  };

  const openCloneRecurringModal = () => {
    if (!invoice) return;
    setCloneRecurringName(`${invoice.invoiceNumber} Recurring`);
    setCloneRecurringFrequency('MONTHLY');
    setCloneRecurringDayOfMonth(1);
    setCloneRecurringDayOfWeek(1);
    setCloneRecurringStartDate(todayIso());
    setCloneRecurringEndDate('');
    setCloneRecurringMaxOccurrences('');
    setCloneRecurringOpen(true);
  };

  const cloneAsRecurringTemplate = async () => {
    if (!invoice?.id) return;
    if (!cloneRecurringName.trim()) {
      errorHandler.showError(t('sales.recurring.validation.cloneNameRequired', 'Template name is required'));
      return;
    }
    try {
      setCloneRecurringBusy(true);
      setError(null);
      await recurringInvoiceApi.cloneToTemplate(invoice.id, {
        name: cloneRecurringName.trim(),
        frequency: cloneRecurringFrequency,
        dayOfMonth: cloneRecurringFrequency !== 'WEEKLY' ? cloneRecurringDayOfMonth : undefined,
        dayOfWeek: cloneRecurringFrequency === 'WEEKLY' ? cloneRecurringDayOfWeek : undefined,
        startDate: cloneRecurringStartDate || undefined,
        endDate: cloneRecurringEndDate || undefined,
        maxOccurrences: cloneRecurringMaxOccurrences ? parseInt(cloneRecurringMaxOccurrences, 10) : undefined,
      });
      setCloneRecurringOpen(false);
      errorHandler.showSuccess(t('sales.recurring.success.cloneFromInvoice', 'Recurring template created successfully.'));
      if (isWindow && onClose) {
        onClose();
      } else {
        navigate('/sales/recurring-invoices');
      }
    } catch (err: any) {
      errorHandler.showError(err?.response?.data?.error?.message || err?.response?.data?.message || err?.message || t('sales.recurring.errors.cloneFromInvoice', 'Failed to clone invoice as recurring template.'));
    } finally {
      setCloneRecurringBusy(false);
    }
  };

  const buildDefaultOutboundMessage = () => {
    if (!invoice) return '';
    return [
      `Invoice ${invoice.invoiceNumber}`,
      `Customer: ${customerNameById[invoice.customerId] || invoice.customerName}`,
      `Amount: ${invoice.grandTotalDoc.toFixed(2)} ${invoice.currency}`,
      `Date: ${invoice.invoiceDate}`,
    ].join('\n');
  };

  // ─── Loading / Not-found states ───────────────────────────────────────────
  if (loading) {
    const progress = loadingProgress;
    const completedCalls = progress?.completedCalls ?? 0;
    const totalCalls = progress?.totalCalls ?? (isCreateMode ? 10 : 11);
    const progressPercent = totalCalls > 0 ? Math.min(100, Math.round((completedCalls / totalCalls) * 100)) : 0;
    const cacheLabel =
      progress?.cacheStatus === 'hit'
        ? t('sales.invoiceDetail.loadingCacheHitShort', 'Cache hit')
        : progress?.cacheStatus === 'miss'
          ? t('sales.invoiceDetail.loadingCacheMissShort', 'Cache miss')
          : progress?.cacheStatus === 'inflight'
            ? t('sales.invoiceDetail.loadingCacheInflightShort', 'Shared load')
            : t('sales.invoiceDetail.loadingCacheCheckingShort', 'Checking cache');

    return (
      <div className="space-y-4 p-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary-600" />
              <div className="min-w-0">
                <div className="text-sm font-black text-slate-900 dark:text-slate-100">
                  {t('sales.invoiceDetail.loadingTitle', 'Opening Sales Invoice form')}
                </div>
                <div className="truncate text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {progress?.activeLabel || t('sales.invoiceDetail.loadingPreparing', 'Preparing form')}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wide">
              <span className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                {cacheLabel}
              </span>
              <span className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                {t('sales.invoiceDetail.loadingElapsed', '{{seconds}}s', { seconds: progress?.elapsedSeconds ?? 0 })}
              </span>
              <span className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                {t('sales.invoiceDetail.loadingApiCount', '{{completed}}/{{total}} API', { completed: completedCalls, total: totalCalls })}
              </span>
            </div>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-primary-600 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            <span>{t('sales.invoiceDetail.loadingReferenceHint', 'Reference data is cached per company for faster reopen.')}</span>
            <span>{progressPercent}%</span>
          </div>
        </div>
        <div className="h-48 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700" />
        <div className="h-64 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700" />
      </div>
    );
  }

  if (!isCreateMode && !invoice) {
    return (
      <div className="space-y-4 p-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{t('sales.invoiceDetail.title', 'Sales Invoice')}</h1>
        <EmptyState
          title={t('sales.invoiceDetail.notFoundTitle', 'Invoice not found')}
          description={t('sales.invoiceDetail.notFoundDesc', 'This sales invoice does not exist or you do not have access.')}
          action={
            <button
              type="button"
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              onClick={() => navigate('/sales/invoices')}
            >
              {t('sales.invoiceDetail.backToList', 'Back to List')}
            </button>
          }
        />
      </div>
    );
  }

  const handleSaveAndPostClick = async () => {
    const outstanding = roundMoney(totals.grandTotalBase);
    if (settlementMode === 'DEFERRED') {
      const confirmed = await confirm({
        title: t('sales.invoiceDetail.saveAndPostCreditTitle', 'Save & Post on Credit'),
        message: t('sales.invoiceDetail.saveAndPostCreditMessage', 'Are you sure you want to save and post this invoice on credit? This will increase the customer\'s receivable balance.'),
        confirmLabel: t('sales.invoiceDetail.saveAndPostConfirm', 'Confirm'),
        tone: 'warning',
      });
      if (!confirmed) return;
      createAndPostDraft();
    } else if (outstanding > 0.005) {
      // Inline SettlementBlock holds the rows; gate on validity, then post directly.
      // (#193 retired the old settlement modal — re-opening it here wiped the entry.)
      if (!settlementValidity.ok) {
        errorHandler.showError(settlementValidity.message || t('settlement.validation.needsAttention', 'Settlement needs attention.'));
        return;
      }
      createAndPostDraft();
    } else {
      setSettlementMode('DEFERRED');
      createAndPostDraft();
    }
  };

  const downloadLinesCsv = () => {
    const rows = filledLines(form.lines);
    if (!rows.length) {
      errorHandler.showWarning(t('sales.invoiceDetail.noLinesToExport', 'There are no invoice lines to export.'));
      return;
    }
    const headers = ['Item Code', 'Item Name', 'Qty', 'UOM', 'Unit Price', 'Discount', 'Tax Code', 'Warehouse', 'Line Total', 'Net', 'Tax'];
    const csvRows = rows.map((line, index) => {
      const computed = computedLines[index];
      const warehouseName = line.warehouseId ? warehouses.find((w) => w.id === line.warehouseId)?.name || line.warehouseId : '';
      const taxCode = line.taxCodeId ? taxById[line.taxCodeId]?.code || line.taxCodeId : '';
      return [
        line.itemCode || '',
        line.itemName || '',
        line.invoicedQty,
        line.uom || '',
        line.unitPriceDoc || 0,
        line.discountValue || 0,
        taxCode,
        warehouseName,
        computed?.lineGrossDoc ?? 0,
        computed?.lineTotalDoc ?? 0,
        computed?.taxAmountDoc ?? 0,
      ];
    });
    const escapeCsv = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const csv = [headers, ...csvRows].map((row) => row.map(escapeCsv).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${invoice?.invoiceNumber || 'sales-invoice-lines'}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    errorHandler.showSuccess(t('sales.invoiceDetail.linesExported', 'Invoice lines exported.'));
  };

  const showImportNotReady = (message: string) => {
    errorHandler.showWarning(message);
  };

  const setSourceMode = async (mode: 'direct' | 'so' | 'dn') => {
    if (isReadOnly) return;
    if (mode === 'dn') {
      errorHandler.showWarning(t('sales.invoiceDetail.deliveryNoteSourceNotReady', 'Delivery Note source loading is not connected on this invoice page yet.'));
      return;
    }
    if (mode === 'so') {
      setRequestedSourceMode('so');
      return;
    }
    setRequestedSourceMode('direct');
    if (sourceMode === 'direct') return;
    const confirmed = await confirm({
      title: t('sales.invoiceDetail.switchToDirectTitle', 'Switch to direct entry?'),
      message: t('sales.invoiceDetail.switchToDirectMessage', 'This will unlink the current source document from the editable invoice lines.'),
      confirmLabel: t('sales.invoiceDetail.switchToDirectConfirm', 'Switch'),
      tone: 'warning',
    });
    if (!confirmed) return;
    setForm((prev) => ({
      ...prev,
      salesOrderId: '',
      lines: padLinesToMin(
        prev.lines.map((line) => ({
          ...line,
          soLineId: undefined,
          dnLineId: undefined,
        })),
      ),
    }));
  };

  const renderDocumentHeaderCard = () => {
    const selectedSalesOrder = form.salesOrderId ? salesOrders.find((order) => order.id === form.salesOrderId) : undefined;
    const selectedWarehouseName = form.warehouseId ? warehouses.find((warehouse) => warehouse.id === form.warehouseId)?.name || form.warehouseId : '—';
    const selectedSalespersonName = form.salespersonId ? salespersons.find((sp) => sp.id === form.salespersonId)?.name || '—' : '—';
    const headerLabelClass = 'mb-1 block text-[10px] font-bold uppercase text-slate-500';
    const headerFieldWrapperClass = 'min-w-0';
    const headerControlClass = 'h-9 w-full rounded border border-slate-300 bg-white px-2 text-xs text-slate-900 outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100';
    const headerSelectorClass = 'h-9 [&>input]:h-9 [&>input]:rounded [&>input]:border-slate-300 [&>input]:py-0 [&>input]:text-xs dark:[&>input]:border-slate-700';

    return (
      <CompactCard
        title={activeSourceMode === 'so'
          ? t('sales.invoiceDetail.headerFromSO', 'Header - From Sales Order')
          : t('sales.invoiceDetail.headerDirect', 'Header - Direct Invoice')}
        action={
          <div className="flex items-center gap-1.5">
            <Pill tone={activeSourceMode === 'so' ? 'blue' : 'slate'}>
              {activeSourceMode === 'so'
                ? t('sales.invoiceDetail.sourceFromSO', 'From SO')
                : t('sales.invoiceDetail.sourceDirect', 'Direct')}
            </Pill>
            <Pill tone="slate">{form.currency}</Pill>
            {invoice?.status === 'POSTED' && (
              <Pill tone="green">
                <ShieldCheck className="h-3 w-3" />
                {t('sales.invoiceDetail.postedStatus', 'Policy OK')}
              </Pill>
            )}
          </div>
        }
        className="overflow-visible"
      >
        <div className={clsx(
          'grid gap-2 p-3',
          isReadOnly ? 'grid-cols-2 md:grid-cols-4 xl:grid-cols-6' : 'grid-cols-[repeat(auto-fit,minmax(180px,1fr))]',
        )}>
          {isReadOnly ? (
            <>
              <Field label={t('sales.invoiceDetail.invoiceNo', 'Invoice No.')} value={invoice?.invoiceNumber || 'SI-DRAFT'} plain />
              <Field label={t('sales.invoiceDetail.source', 'Source')} value={form.salesOrderId ? salesOrderLabelById[form.salesOrderId] || form.salesOrderId : t('sales.invoiceDetail.sourceDirect', 'Direct')} plain />
              <Field label={t('sales.invoiceDetail.customer', 'Customer')} value={customerNameById[form.customerId] || form.customerName || '—'} plain />
              <Field label={t('sales.invoiceDetail.invoiceDate', 'Invoice Date')} value={form.invoiceDate} plain />
              <Field label={t('sales.invoiceDetail.currency', 'Currency')} value={form.currency} plain />
              <Field label={t('sales.invoiceDetail.exchangeRate', 'Exchange Rate')} value={String(form.exchangeRate || 1)} plain />
              {activeSourceMode === 'direct' && <Field label={t('sales.invoiceDetail.mainWarehouse', 'Main Warehouse')} value={selectedWarehouseName} plain />}
              <Field label={t('sales.invoiceDetail.salesperson', 'Salesperson')} value={selectedSalespersonName} plain />
              <Field label={t('sales.invoiceDetail.customerInvoiceNumber', 'Customer Ref')} value={form.customerInvoiceNumber || '—'} plain />
            </>
          ) : (
            <>
              {activeSourceMode === 'so' ? (
                <>
                  <div className={headerFieldWrapperClass}>
                    <label className={headerLabelClass}>{t('sales.invoiceDetail.salesOrder', 'Sales Order')}</label>
                    <select
                      className={headerControlClass}
                      value={form.salesOrderId}
                      onChange={(e) => {
                        const nextSalesOrderId = e.target.value;
                        if (!nextSalesOrderId) {
                          setForm((prev) => ({
                            ...prev,
                            salesOrderId: '',
                            customerId: '',
                            customerName: '',
                            salespersonId: undefined,
                            lines: padLinesToMin([]),
                          }));
                          return;
                        }
                        void loadSalesOrderLines(nextSalesOrderId);
                      }}
                    >
                      <option value="">{t('sales.invoiceDetail.selectSalesOrder', 'Select open sales order...')}</option>
                      {invoiceableSalesOrders.map((order) => (
                        <option key={order.id} value={order.id}>
                          {order.orderNumber} - {order.customerName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className={headerFieldWrapperClass}>
                    <Field
                      label={t('sales.invoiceDetail.customer', 'Customer')}
                      value={selectedSalesOrder?.customerName || customerNameById[form.customerId] || form.customerName || '—'}
                      locked
                    />
                  </div>
                </>
              ) : (
                <div className={headerFieldWrapperClass}>
                  <label className={headerLabelClass}>{t('sales.invoiceDetail.customer', 'Customer')}</label>
                  <PartySelector
                    className={headerSelectorClass}
                    value={form.customerId}
                    onChange={(party) => {
                      setTemplateTouched(false);
                      setForm((prev) => ({
                        ...prev,
                        customerId: party?.id || '',
                        customerName: party?.displayName || '',
                        currency: party?.defaultCurrency || prev.currency,
                        invoiceTemplateId: party ? prev.invoiceTemplateId : '',
                        invoiceTemplateFormType: party ? prev.invoiceTemplateFormType : currentInvoiceFormType,
                      }));
                    }}
                  />
                </div>
              )}
              <div className={headerFieldWrapperClass}>
                <label className={headerLabelClass}>{t('sales.invoiceDetail.invoiceDate', 'Invoice Date')}</label>
                <DatePicker
                  className="w-full"
                  inputClassName={clsx(headerControlClass, 'pr-8')}
                  value={form.invoiceDate}
                  onChange={(val) => setForm((prev) => ({ ...prev, invoiceDate: val }))}
                />
              </div>
              <div className={headerFieldWrapperClass}>
                <label className={headerLabelClass}>{t('sales.invoiceDetail.currency', 'Currency')}</label>
                <CurrencySelector
                  className={headerSelectorClass}
                  value={form.currency}
                  onChange={(code) => setForm((prev) => ({ ...prev, currency: code }))}
                  disabled={busy || activeSourceMode === 'so'}
                />
              </div>
              <div className={headerFieldWrapperClass}>
                <label className={headerLabelClass}>{t('sales.invoiceDetail.exchangeRate', 'Exchange Rate')}</label>
                <div className="[&>div]:h-9 [&>div]:rounded">
                  <CurrencyExchangeWidget
                    currency={form.currency}
                    baseCurrency={company?.baseCurrency || 'USD'}
                    voucherDate={form.invoiceDate}
                    value={form.exchangeRate}
                    onChange={(rate) => setForm((prev) => ({ ...prev, exchangeRate: rate }))}
                    disabled={busy || activeSourceMode === 'so'}
                  />
                </div>
              </div>
              {activeSourceMode === 'direct' && (
                <div className={headerFieldWrapperClass}>
                  <label className={headerLabelClass}>{t('sales.invoiceDetail.mainWarehouse', 'Main Warehouse')}</label>
                  <WarehouseSelector
                    className={headerSelectorClass}
                    value={form.warehouseId || settings?.defaultWarehouseId}
                    onChange={(warehouse) => {
                      const warehouseId = warehouse?.id || undefined;
                      setForm((prev) => ({
                        ...prev,
                        warehouseId,
                        lines: prev.lines.map((line) =>
                          line.dnLineId || line.soLineId
                            ? line
                            : { ...line, warehouseId: line.warehouseId || warehouseId }
                        ),
                      }));
                    }}
                  />
                </div>
              )}
              <div className={headerFieldWrapperClass}>
                <label className={headerLabelClass}>{t('sales.invoiceDetail.salesperson', 'Salesperson')}</label>
                <select
                  className={headerControlClass}
                  value={form.salespersonId || ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, salespersonId: e.target.value || undefined }))}
                >
                  <option value="">{t('sales.invoiceDetail.none', '— None —')}</option>
                  {salespersons.map((sp) => (
                    <option key={sp.id} value={sp.id}>{sp.name}</option>
                  ))}
                </select>
              </div>
              <div className={headerFieldWrapperClass}>
                <label className={headerLabelClass}>{t('sales.invoiceDetail.customerInvoiceNumber', 'Customer Ref')}</label>
                <input
                  type="text"
                  className={headerControlClass}
                  value={form.customerInvoiceNumber}
                  onChange={(e) => setForm((prev) => ({ ...prev, customerInvoiceNumber: e.target.value }))}
                />
              </div>
            </>
          )}
        </div>
      </CompactCard>
    );
  };

  const renderSourceAndControlsCard = () => {
    return (
      <section className="shrink-0 rounded-lg border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="grid gap-2 xl:grid-cols-[minmax(0,1fr)_auto]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1 rounded-md border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-950/50">
              {[
                { mode: 'direct' as const, label: t('sales.invoiceDetail.sourceDirect', 'Direct'), icon: FileText },
                { mode: 'so' as const, label: t('sales.invoiceDetail.sourceFromSO', 'From SO'), icon: Link2 },
                { mode: 'dn' as const, label: t('sales.invoiceDetail.sourceFromDN', 'From DN'), icon: Truck },
              ].map((option) => {
                const Icon = option.icon;
                const active = activeSourceMode === option.mode;
                return (
                  <button
                    key={option.mode}
                    type="button"
                    onClick={() => void setSourceMode(option.mode)}
                    disabled={isReadOnly}
                    className={clsx(
                      'inline-flex h-7 items-center gap-1.5 rounded px-2 text-[10px] font-black uppercase tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                      active
                        ? 'bg-white text-blue-700 shadow-sm ring-1 ring-blue-200 dark:bg-slate-900 dark:text-blue-300 dark:ring-blue-900'
                        : 'text-slate-500 hover:bg-white hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-100',
                    )}
                    title={option.mode === 'dn' ? t('sales.invoiceDetail.deliveryNoteSourceNotReady', 'Delivery Note source loading is not connected on this invoice page yet.') : option.label}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {option.label}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              disabled
              className="inline-flex h-7 items-center gap-1.5 rounded border border-slate-200 bg-white px-2 text-[10px] font-black uppercase tracking-wide text-slate-500 disabled:cursor-default dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400"
            >
              <Link2 className="h-3.5 w-3.5" />
              {activeSourceMode === 'so'
                ? t('sales.invoiceDetail.pickSourceInHeader', 'Pick SO in header')
                : t('sales.invoiceDetail.directHeaderDriven', 'Direct header driven')}
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-1.5 rounded-md border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-950/50">
            <button
              type="button"
              onClick={() => setAttachmentsPanelOpen(true)}
              className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800"
              title={t('sales.invoiceDetail.uploadAttachment', 'Upload attachment')}
            >
              <Paperclip className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setAuditModalOpen(true)}
              disabled={isCreateMode}
              className={clsx(
                'inline-flex h-7 w-7 items-center justify-center rounded border transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                creditWarnBanner
                  ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800',
              )}
              title={creditWarnBanner || t('sales.invoiceDetail.historyAvailable', 'View edit history & change logs')}
            >
              <History className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={downloadLinesCsv}
              className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800"
              title={t('sales.invoiceDetail.downloadExcel', 'Download Excel')}
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => showImportNotReady(t('sales.invoiceDetail.fileImportNotReady', 'File import is not connected yet.'))}
              className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800"
              title={t('sales.invoiceDetail.uploadFromFile', 'Upload from file')}
            >
              <Upload className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => showImportNotReady(t('sales.invoiceDetail.imageReadNotReady', 'Image reading is not connected yet.'))}
              className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800"
              title={t('sales.invoiceDetail.readFromImage', 'Read from image')}
            >
              <FileImage className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

      </section>
    );
  };

  const renderLinesTable = () => {
    return (
      <div className="flex min-h-[210px] flex-none flex-col 2xl:flex-[1.2]">
        <ClassicLineItemsTable<EditableLine>
          rows={form.lines}
          columns={lineColumns}
          disabled={isReadOnly || busy}
          onRowChange={(index, patch) => setLine(index, patch)}
          onRowRemove={!isReadOnly ? removeLine : undefined}
          onRowAdd={!isReadOnly ? addLine : undefined}
          addLabel={t('sales.invoiceDetail.addItem', 'Add Line')}
          minRows={1}
          className="flex-1 [&>div:first-child]:max-h-none [&>div:first-child]:h-full"
        />
      </div>
    );
  };

  const renderChargesSection = () => {
    return (
      <div className="flex min-h-[150px] flex-none flex-col gap-1.5 2xl:flex-[0.55]">
        <div className="overflow-hidden rounded border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-white px-2 py-1.5 dark:border-slate-800 dark:bg-slate-950">
            <div className="flex min-w-0 items-center gap-2">
              <span className="h-4 w-1 rounded-full bg-indigo-500" />
              <span className="truncate text-[11px] font-black uppercase tracking-wide text-slate-800 dark:text-slate-100">
                {t('sales.invoiceDetail.allocation.title', 'Account Ledger & Financial Taxes Allocation Grid')}
              </span>
            </div>
            <button
              type="button"
              onClick={() => showImportNotReady(t('sales.invoiceDetail.taxPresetNotReady', 'Tax preset automation is not connected yet.'))}
              className="hidden h-6 items-center rounded border border-emerald-300 px-2 text-[10px] font-black text-emerald-700 hover:bg-emerald-50 md:inline-flex"
            >
              {t('sales.invoiceDetail.allocation.applyTaxPreset', 'Apply Tax Preset')}
            </button>
          </div>
          <div className="flex min-h-[110px] items-center justify-center bg-slate-50/70 px-4 py-5 text-center dark:bg-slate-900/40">
            <div className="max-w-xl">
              <div className="text-[11px] font-black uppercase tracking-wide text-slate-700 dark:text-slate-200">
                {t('sales.invoiceDetail.allocation.emptyTitle', 'No allocation rows')}
              </div>
              <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                {t(
                  'sales.invoiceDetail.allocation.emptyDescription',
                  'Real ledger and tax allocation controls are not shown until the controlled allocation contract is implemented.'
                )}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderInfoCard = () => {
    return (
      <section className="min-h-0 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        <div className="flex h-8 items-center justify-between border-b border-slate-150 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 px-3">
          <h2 className="text-[10px] font-black uppercase tracking-wide text-slate-700 dark:text-slate-350">
            {t('sales.invoiceDetail.info', 'Info')}
          </h2>
          <Pill tone={railFocus.kind === 'item' ? 'blue' : 'slate'}>
            {railFocus.kind === 'item' ? t('sales.invoiceDetail.item', 'Item') : t('sales.invoiceDetail.account', 'Account')}
          </Pill>
        </div>
        <div className="flex h-[calc(100%-2rem)] min-h-0 flex-col gap-2 overflow-auto p-2.5 text-xs">
          <div className="rounded border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 p-2">
            <div className="truncate text-[9px] font-black uppercase tracking-wide text-slate-500">{railFocus.code}</div>
            <div className="mt-0.5 truncate text-sm font-black text-slate-900 dark:text-slate-100">{railFocus.title}</div>
            <div className="truncate text-[10px] font-semibold text-slate-500">{railFocus.subtitle}</div>
          </div>
          <div className="rounded border border-blue-50 dark:border-blue-950/20 bg-blue-50/50 dark:bg-blue-950/10 px-2 py-1.5 text-[11px] leading-relaxed text-blue-700 dark:text-blue-350">
            {railFocus.note}
          </div>
        </div>
      </section>
    );
  };

  const renderPostingReadiness = () => {
    const isBalanced = totals.grandTotalDoc >= 0;
    const hasCustomer = !!form.customerId;
    const hasLines = filledLines(form.lines).length > 0;
    const taxCodeResolved = filledLines(form.lines).every(l => !l.taxCodeId || taxById[l.taxCodeId]);

    return (
      <section className="min-h-0 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        <div className="flex h-8 items-center justify-between border-b border-slate-150 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 px-3">
          <h2 className="text-[10px] font-black uppercase tracking-wide text-slate-700 dark:text-slate-350">
            {isLedgerPosted ? t('sales.invoiceDetail.documentStatus', 'Document Status') : t('sales.invoiceDetail.postingReadiness', 'Posting Readiness')}
          </h2>
        </div>
        <div className="h-[calc(100%-2rem)] space-y-1.5 overflow-auto p-2.5 text-xs">
          <div className={clsx(
            "flex items-center gap-2 rounded border px-2 py-1.5 font-bold",
            hasCustomer && hasLines && isBalanced
              ? "border-emerald-100 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-350"
              : "border-red-100 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-350"
          )}>
            {hasCustomer && hasLines && isBalanced ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 shrink-0" />
            )}
            <span>{isLedgerPosted ? t('sales.invoiceDetail.ledgerVoucherCreated', 'Ledger voucher created') : t('sales.invoiceDetail.balancedPostingPreview', 'Balanced posting preview')}</span>
          </div>

          <div className={clsx(
            "flex items-center gap-2 rounded border px-2 py-1.5 font-bold",
            taxCodeResolved
              ? "border-emerald-100 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-350"
              : "border-red-100 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-350"
          )}>
            {taxCodeResolved ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 shrink-0" />
            )}
            <span>{isLedgerPosted ? t('sales.invoiceDetail.taxLinesPosted', 'Tax lines posted') : t('sales.invoiceDetail.taxAccountResolved', 'Tax accounts resolved')}</span>
          </div>

          {invoice?.status !== 'POSTED' && (
            <div className="flex items-center gap-2 rounded border border-slate-250 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 px-2 py-1.5 text-slate-650 dark:text-slate-350 font-bold">
              <Info className="h-4 w-4 shrink-0" />
              <span>{t('sales.invoiceDetail.creditChecksActive', 'Credit policy active')}</span>
            </div>
          )}
        </div>
      </section>
    );
  };

  const renderTotalsCard = () => {
    const showBaseCurrency = form.currency !== (company?.baseCurrency || 'USD');
    return (
      <section className="shrink-0 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        <div className="flex h-8 items-center justify-between border-b border-slate-150 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 px-3">
          <h2 className="text-[10px] font-black uppercase tracking-wide text-slate-700 dark:text-slate-350">
            {t('sales.invoiceDetail.totals', 'Totals')}
          </h2>
          <Pill tone="slate">{form.currency}</Pill>
        </div>
        <div className="space-y-1.5 p-2.5">
          <div className="flex items-center justify-between rounded border border-slate-100 dark:border-slate-850 bg-slate-50/40 dark:bg-slate-900/30 px-2 py-1 text-xs">
            <span className="font-bold text-slate-500">{t('sales.invoiceDetail.subtotal', 'Subtotal')}</span>
            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{form.currency} {totals.subtotalDoc.toFixed(2)}</span>
          </div>

          <div className="flex items-center justify-between rounded border border-slate-100 dark:border-slate-850 bg-slate-50/40 dark:bg-slate-900/30 px-2 py-1 text-xs">
            <span className="font-bold text-slate-500">{t('sales.invoiceDetail.tax', 'Tax')}</span>
            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{form.currency} {totals.taxTotalDoc.toFixed(2)}</span>
          </div>

          <div className="rounded-lg border border-slate-950 bg-slate-900 dark:bg-slate-950 px-3 py-2 text-white shadow-md">
            <div className="text-[9px] font-black uppercase tracking-wide text-slate-400">{t('sales.invoiceDetail.grandTotal', 'Grand Total')}</div>
            <div className="mt-0.5 text-right font-mono text-xl font-black text-emerald-400">{form.currency} {totals.grandTotalDoc.toFixed(2)}</div>
            {showBaseCurrency && (
              <div className="mt-1.5 border-t border-white/10 pt-1 flex justify-between text-[10px] font-bold text-slate-300">
                <span>{t('sales.invoiceDetail.grandTotalBase', 'Grand Total (Base)')}</span>
                <span className="font-mono">{company?.baseCurrency || 'USD'} {totals.grandTotalBase.toFixed(2)}</span>
              </div>
            )}
          </div>
        </div>
      </section>
    );
  };

  const renderFooterTotalsStrip = () => {
    const formatFooterMoney = (value: number) => new Intl.NumberFormat(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value);

    const footerTotals = [
      {
        label: t('sales.invoiceDetail.footerTotals.subtotal', 'Subtotal'),
        value: totals.subtotalDoc,
        tone: 'text-slate-950 dark:text-slate-100',
      },
      {
        label: t('sales.invoiceDetail.footerTotals.taxAmount', 'Tax Amount'),
        value: totals.taxTotalDoc,
        tone: 'text-slate-950 dark:text-slate-100',
      },
      {
        label: t('sales.invoiceDetail.footerTotals.grandTotal', 'Grand Total ({{currency}})', { currency: form.currency }),
        value: totals.grandTotalDoc,
        tone: 'text-rose-600 dark:text-rose-400',
      },
    ];

    return (
      <div className="flex justify-start">
        <div className="grid min-w-[min(100%,430px)] grid-cols-3 gap-5 rounded-lg border border-slate-300 bg-slate-100 px-5 py-2 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          {footerTotals.map((item) => (
            <div key={item.label} className="min-w-0">
              <div className="truncate text-[8px] font-black uppercase text-slate-400 dark:text-slate-500">
                {item.label}
              </div>
              <div className={clsx('mt-0.5 truncate font-mono text-[13px] font-black leading-none', item.tone)}>
                {formatFooterMoney(item.value)} {form.currency}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderPostedBanner = () => {
    if (!invoice || invoice.status === 'DRAFT') return null;

    const editPolicy = accountingPolicy?.allowPeriodLockOverride ? 'flexible' : 'rigid';
    const bannerToneClass = isPendingAccountingApproval
      ? 'border-amber-250 bg-amber-50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-300'
      : 'border-emerald-205 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-305';
    const bannerIconClass = isPendingAccountingApproval
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-emerald-600 dark:text-emerald-400';

    return (
      <div className={clsx('grid shrink-0 gap-2 rounded-lg border px-3 py-2 text-xs lg:grid-cols-[minmax(0,1fr)_auto]', bannerToneClass)}>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {isPendingAccountingApproval ? (
            <AlertTriangle className={clsx('h-4 w-4 shrink-0', bannerIconClass)} />
          ) : (
            <CheckCircle2 className={clsx('h-4 w-4 shrink-0', bannerIconClass)} />
          )}
          <span className="font-black">
            {isPendingAccountingApproval
              ? t('sales.invoiceDetail.pendingApprovalView', 'Waiting for accounting approval')
              : t('sales.invoiceDetail.postedView', 'Posted document view')}
          </span>
          <span>
            {isPendingAccountingApproval
              ? t('sales.invoiceDetail.pendingApprovalViewHint', 'The invoice is locked until Accounting approves and posts it.')
              : t('sales.invoiceDetail.postedViewHint', 'Inputs are plain values; only legal ledger actions remain.')}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Pill tone="green">{invoice.invoiceNumber}</Pill>
          <Pill tone="slate">{t('sales.invoiceDetail.editPolicy', 'Edit Policy: {{policy}}', { policy: editPolicy })}</Pill>
          {isLedgerPosted && <Pill tone="blue">{t('sales.invoiceDetail.approvedTag', 'Ledger posted')}</Pill>}
          {isPendingAccountingApproval && <Pill tone="amber">{t('sales.invoiceDetail.awaitingAccountingTag', 'Awaiting accounting')}</Pill>}
        </div>
      </div>
    );
  };

  const renderRailContent = () => (
    <>
      {renderInfoCard()}
      {renderPostingReadiness()}
      <SettlementBlock
        variant="summary"
        module="sales"
        mode={settlementMode}
        rows={settlementRows}
        partyAccountId={arAccountId}
        partyAccountLabel={customerNameById[form.customerId] || form.customerName || arAccountId}
        outstandingBase={isReadOnly ? (invoice?.outstandingAmountBase ?? 0) : totals.grandTotalBase}
        recordedBase={isReadOnly ? (invoice?.paidAmountBase ?? 0) : undefined}
      />
      {renderTotalsCard()}
    </>
  );

  const showRailFromEdge = () => {
    if (railUsesDrawer) {
      setRailDrawerOpen(true);
    } else {
      setRailPinned(true);
    }
  };

  const renderRailEdgeButton = () => (
    <button
      type="button"
      onClick={showRailFromEdge}
      title={t('sales.invoiceDetail.rail.show', 'Show invoice side rail')}
      className={clsx(
        'absolute top-1/2 z-30 flex h-24 w-6 -translate-y-1/2 items-center justify-center border border-slate-250 bg-white text-slate-600 shadow-md transition-colors hover:bg-slate-50 hover:text-slate-950 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800',
        isRtl
          ? 'left-0 rounded-r-md border-l-0'
          : 'right-0 rounded-l-md border-r-0',
      )}
    >
      <RailOpenIcon className="h-4 w-4" />
      <span className="sr-only">{t('sales.invoiceDetail.rail.show', 'Show invoice side rail')}</span>
    </button>
  );

  const renderRailDrawer = () => (
    <div
      className={clsx(
        'absolute inset-0 z-40 flex bg-slate-950/20 backdrop-blur-[1px]',
        isRtl ? 'justify-start' : 'justify-end',
      )}
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label={t('sales.invoiceDetail.rail.close', 'Close invoice side rail')}
        onClick={() => setRailDrawerOpen(false)}
      />
      <aside
        className={clsx(
          'relative z-10 flex h-full w-[min(360px,92vw)] flex-col bg-slate-50 shadow-2xl dark:bg-slate-950',
          isRtl
            ? 'border-r border-slate-200 dark:border-slate-800'
            : 'border-l border-slate-200 dark:border-slate-800',
        )}
      >
        <div className="flex h-11 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex min-w-0 items-center gap-2">
            <RailOpenIcon className="h-4 w-4 text-slate-500" />
            <span className="truncate text-xs font-black uppercase tracking-wide text-slate-700 dark:text-slate-200">
              {t('sales.invoiceDetail.rail.title', 'Invoice side rail')}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setRailDrawerOpen(false)}
            title={t('sales.invoiceDetail.rail.close', 'Close invoice side rail')}
            className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-950 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-750"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid min-h-0 flex-1 auto-rows-min gap-2 overflow-y-auto p-2">
          {renderRailContent()}
        </div>
      </aside>
    </div>
  );

  // ─── Main render ──────────────────────────────────────────────────────────
  return (
    <div className={clsx("relative flex h-full min-h-0 flex-col overflow-hidden bg-slate-50 dark:bg-slate-950", isWindow && "w-full")}>
      {/* Top Header Bar */}
      <div className="flex-none flex items-center justify-between px-4 py-2.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm animate-fade-in">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            className="rounded border border-slate-205 dark:border-slate-700 p-1.5 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-950 dark:hover:text-slate-100 transition-colors"
            onClick={() => {
              if (isWindow && onClose) onClose();
              else navigate('/sales/invoices');
            }}
          >
            <BackIcon className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <FileText className="h-4.5 w-4.5 text-blue-650" />
              <h1 className="truncate text-sm font-black tracking-wide text-slate-950 dark:text-slate-100">
                {isCreateMode ? t('sales.invoiceDetail.newTitle', 'New Sales Invoice') : invoice?.invoiceNumber}
              </h1>
              <Pill tone={statusPillTone}>{statusPillLabel}</Pill>
              {isPendingAccountingApproval && (
                <button
                  type="button"
                  title={t('sales.invoiceDetail.pendingApprovalBanner.description', 'This invoice is waiting for approval in Accounting Approval Center.')}
                  className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                >
                  <Info className="h-3.5 w-3.5" />
                </button>
              )}
              {form.salesOrderId && <Pill tone="blue">{t('sales.invoiceDetail.linkedOrder', 'From SO')}</Pill>}
            </div>
          </div>
        </div>

        {/* Header tools / preview toggle */}
        <div className="flex items-center gap-2">
          {!isReadOnly && !isCreateMode && (
            <button
              type="button"
              onClick={openCloneRecurringModal}
              className="inline-flex h-8 items-center gap-1.5 rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 px-3 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50"
            >
              <History className="h-3.5 w-3.5" />
              {t('sales.recurring.actions.cloneFromInvoice', 'Clone to Recurring')}
            </button>
          )}
        </div>
      </div>

      {/* Banners strip */}
      {isCreateMode && settings?.workflowMode === 'OPERATIONAL' && !form.salesOrderId && !isCurrentPersonaAllowed && (
        <div className="flex-none mx-3 mt-2 rounded-lg border border-amber-250 bg-amber-50 dark:bg-amber-955/20 px-3 py-1.5 text-xs text-amber-800 dark:text-amber-300">
          {t('sales.governance.operationalWarning', 'Operational workflow: Direct invoicing is blocked. Select a Sales Order.')}
        </div>
      )}

      {/* The main workspace container: 2 columns */}
      <div
        className={clsx(
          'grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-y-auto overflow-x-hidden p-2',
          showInlineRail && 'xl:grid-cols-[minmax(0,1fr)_304px] 2xl:overflow-hidden',
        )}
      >
        {/* Left Column: Form components */}
        <section className={clsx('flex min-h-0 flex-col gap-2', isRtl ? 'pl-1' : 'pr-1', !isWindow && '2xl:overflow-y-auto')}>
          {renderPostedBanner()}
          {renderSourceAndControlsCard()}
          {renderDocumentHeaderCard()}
          {renderLinesTable()}
          {renderChargesSection()}
          {!isReadOnly && (
            <SettlementBlock
              module="sales"
              mode={settlementMode}
              onModeChange={setSettlementMode}
              rows={settlementRows}
              onRowsChange={setSettlementRows}
              partyAccountId={arAccountId}
              partyAccountLabel={customerNameById[form.customerId] || form.customerName || arAccountId}
              outstandingBase={totals.grandTotalBase}
              paymentMethodConfigs={enabledPaymentMethodConfigs}
              allowOverpayment={(settings as any)?.allowOverpayment === true}
              currencyCode={form.currency}
              onValidityChange={setSettlementValidity}
            />
          )}
        </section>

        {/* Right Rail Column */}
        {showInlineRail && (
          <aside className="relative grid min-h-0 auto-rows-min gap-2 2xl:grid-rows-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto] 2xl:overflow-hidden">
            <button
              type="button"
              onClick={() => setRailPinned(false)}
              title={t('sales.invoiceDetail.rail.hide', 'Hide invoice side rail')}
              className={clsx(
                'absolute top-3 z-10 inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-250 bg-white text-slate-500 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-950 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800',
                isRtl ? '-right-3' : '-left-3',
              )}
            >
              <RailCloseIcon className="h-4 w-4" />
              <span className="sr-only">{t('sales.invoiceDetail.rail.hide', 'Hide invoice side rail')}</span>
            </button>
            {renderRailContent()}
          </aside>
        )}
      </div>

      {!showInlineRail && renderRailEdgeButton()}
      {railDrawerOpen && renderRailDrawer()}

      {/* Sticky Bottom Actions Footer */}
      <footer
        className={clsx(
          'z-20 shrink-0 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 px-4 py-3 shadow-[0_-8px_20px_rgba(15,23,42,0.06)] backdrop-blur',
          !isWindow && '2xl:sticky 2xl:bottom-0',
        )}
      >
        <div className="grid items-center gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <div className="min-w-0">
            {!showInlineRail && !railDrawerOpen ? (
              <div className="flex justify-start">
                {renderFooterTotalsStrip()}
              </div>
            ) : (
              <div className="text-xs text-slate-500">
                {isPendingAccountingApproval
                  ? t('sales.invoiceDetail.pendingApprovalReadonly', 'Invoice is locked while waiting for accounting approval.')
                  : isReadOnly
                    ? t('sales.invoiceDetail.postedReadonly', 'Posted document is read-only.')
                    : t('sales.invoiceDetail.draftWorking', 'Editing draft sales invoice.')}
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              className="rounded border border-slate-350 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors"
              onClick={() => {
                if (isWindow && onClose) onClose();
                else navigate('/sales/invoices');
              }}
            >
              {isWindow ? t('common.close', 'Close') : t('sales.invoiceDetail.backToList', 'Back to List')}
            </button>

            {isReadOnly && invoice?.status === 'POSTED' && (
              <>
                <button
                  type="button"
                  className="rounded border border-slate-350 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors"
                  onClick={() => setGlImpactOpen(true)}
                >
                  {t('sales.invoiceDetail.glImpact', 'GL Impact')}
                </button>
                <SendDocumentButton
                  accounts={messagingAccounts}
                  defaultPhone={customerById[invoice.customerId]?.phone || ''}
                  documentNumber={invoice.invoiceNumber}
                  customerName={customerNameById[invoice.customerId] || invoice.customerName}
                  amount={invoice.grandTotalDoc}
                  currency={invoice.currency}
                  documentDate={invoice.invoiceDate}
                  onSendWhatsApp={async (p) => {
                    const res = await salesApi.sendInvoiceWhatsApp(invoice.id, p);
                    errorHandler.showSuccess('whatsapp.sendSuccess');
                    return unwrap(res);
                  }}
                  onSendTelegram={async (p) => {
                    const res = await salesApi.sendInvoiceTelegram(invoice.id, p);
                    errorHandler.showSuccess('telegram.sendSuccess');
                    return unwrap(res);
                  }}
                />
                <button
                  type="button"
                  className="rounded border border-rose-250 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/20 px-4 py-2 text-xs font-bold text-rose-700 dark:text-rose-400 hover:bg-rose-100/50 transition-colors"
                  onClick={() => navigate(createReturnHref)}
                >
                  {t('sales.invoiceDetail.createReturn', 'Create Return')}
                </button>
                {invoice?.status === 'POSTED' && (invoice?.paidAmountBase || 0) > 0 && (
                  <button
                    type="button"
                    className="rounded border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    onClick={() => setPaymentHistoryOpen(true)}
                  >
                    {t('sales.invoiceDetail.viewPayments', 'Payments')}
                  </button>
                )}
                <button
                  type="button"
                  className="rounded bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                  onClick={() => setRecordPaymentOpen(true)}
                  disabled={!canCreateReceipt}
                >
                  {t('sales.invoiceDetail.createReceipt', 'Create Receipt')}
                </button>
              </>
            )}

            {!isReadOnly && (
              <>
                <button
                  type="button"
                  className="rounded bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700 transition-colors"
                  onClick={handleDiscard}
                  disabled={busy}
                >
                  {t('sales.invoiceDetail.discard', 'Discard')}
                </button>
                <button
                  type="button"
                  className="rounded bg-slate-800 dark:bg-slate-700 px-4 py-2 text-xs font-bold text-white hover:bg-slate-900 transition-colors"
                  onClick={isCreateMode ? () => createDraft() : saveDraftChanges}
                  disabled={busy}
                >
                  {busy ? t('sales.invoiceDetail.saving', 'Saving...') : t('sales.invoiceDetail.saveChanges', 'Save Changes')}
                </button>
                <button
                  type="button"
                  className="rounded bg-primary-600 px-4 py-2 text-xs font-bold text-white hover:bg-primary-700 transition-colors"
                  onClick={isCreateMode ? handleSaveAndPostClick : handlePostClick}
                  disabled={busy}
                >
                  {busy ? t('sales.invoiceDetail.posting', 'Posting...') : t('sales.invoiceDetail.postInvoice', 'Post Invoice')}
                </button>
              </>
            )}
          </div>
        </div>
      </footer>

      {/* Modals */}
      {invoice && (
        <GlImpactModal
          isOpen={glImpactOpen}
          onClose={() => setGlImpactOpen(false)}
          sourceId={invoice.id}
          sourceLabel={invoice.invoiceNumber}
          documentStatus={invoice.status}
        />
      )}

      <Modal
        isOpen={attachmentsPanelOpen}
        onClose={() => setAttachmentsPanelOpen(false)}
        title={t('sales.invoiceDetail.attachments', 'Attachments')}
      >
        <div className="max-h-[70vh] overflow-auto">
          {!isCreateMode && invoice ? (
            <AttachmentsCard
              entityId={invoice.id}
              attachments={attachments as any}
              onChange={(list) => {
                setAttachments(list as SalesInvoiceAttachmentDTO[]);
                setInvoice((current) => (current ? { ...current, attachments: list as SalesInvoiceAttachmentDTO[] } : current));
              }}
              api={{
                list: (id) => salesApi.listInvoiceAttachments(id) as any,
                upload: (id, file) => salesApi.uploadInvoiceAttachment(id, file) as any,
                remove: (id, attachmentId) => salesApi.removeInvoiceAttachment(id, attachmentId) as any,
                getDownloadLink: (id, attachmentId) => salesApi.getInvoiceAttachmentDownloadLink(id, attachmentId) as any,
              }}
            />
          ) : (
            <div className="text-xs text-slate-500">
              {t('sales.invoiceDetail.attachmentsDraftHint', 'Save draft first to upload attachments.')}
            </div>
          )}
        </div>
      </Modal>

      {overrideModalData && (
        <PeriodLockOverrideModal
          isOpen={overrideModalOpen}
          onClose={() => { setOverrideModalOpen(false); setPendingPeriodLockRetry(null); }}
          documentDate={overrideModalData.documentDate}
          lockedThroughDate={overrideModalData.lockedThroughDate}
          onConfirm={(reason) => {
            setOverrideModalOpen(false);
            // Prefer the pending retry callback (set by handlePeriodLock) so the
            // override works for both postDraft AND createAndPostDraft paths.
            const retry = pendingPeriodLockRetry;
            setPendingPeriodLockRetry(null);
            if (retry) retry(reason); else postDraft(reason);
          }}
        />
      )}

      {!isCreateMode && invoice && (
        <RecordAuditModal
          isOpen={auditModalOpen}
          onClose={() => setAuditModalOpen(false)}
          entityType="SALES_INVOICE"
          entityId={invoice.id}
        />
      )}

      {invoice && (
        <RecordPaymentDialog
          open={recordPaymentOpen}
          module="sales"
          invoiceNumber={invoice.invoiceNumber}
          partyName={customerNameById[form.customerId] || form.customerName || invoice.customerName}
          currencyCode={invoice.currency || form.currency}
          outstandingBase={invoice.outstandingAmountBase || 0}
          paymentMethodConfigs={enabledPaymentMethodConfigs}
          allowOverpayment={(settings as any)?.allowOverpayment === true}
          busy={recordPaymentBusy}
          onClose={() => setRecordPaymentOpen(false)}
          onSubmit={handleRecordPayment}
        />
      )}

      {invoice && (
        <PaymentHistoryModal
          open={paymentHistoryOpen}
          invoiceNumber={invoice.invoiceNumber}
          currencyCode={invoice.currency || form.currency}
          fetchPayments={() => salesApi.getPaymentHistory(invoice.id)}
          onClose={() => setPaymentHistoryOpen(false)}
        />
      )}

      {/* Credit override modal */}
      {creditOverrideOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t('sales.invoiceDetail.creditLimitTitle', 'Credit Limit Exceeded')}</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {t('sales.invoiceDetail.creditLimitMessage', 'This customer is over their credit limit and the policy is set to BLOCK. You can override by providing a reason.')}
            </p>
            {creditOverrideInfo && (
              <div className="rounded-lg bg-slate-50 dark:bg-slate-800 p-3 text-xs text-slate-700 dark:text-slate-300 space-y-1">
                {creditOverrideInfo.creditLimit !== undefined && <div>{t('sales.invoiceDetail.creditLimit', 'Credit Limit:')} <strong>{creditOverrideInfo.creditLimit}</strong></div>}
                {creditOverrideInfo.currentExposure !== undefined && <div>{t('sales.invoiceDetail.currentExposure', 'Current Exposure:')} <strong>{creditOverrideInfo.currentExposure}</strong></div>}
                {creditOverrideInfo.orderAmount !== undefined && <div>{t('sales.invoiceDetail.thisInvoice', 'This Invoice:')} <strong>{creditOverrideInfo.orderAmount}</strong></div>}
                {creditOverrideInfo.projectedExposure !== undefined && <div>{t('sales.invoiceDetail.projectedExposure', 'Projected Exposure:')} <strong>{creditOverrideInfo.projectedExposure}</strong></div>}
              </div>
            )}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                {t('sales.invoiceDetail.overrideReason', 'Override Reason')} <span className="text-red-500">*</span>
              </label>
              <textarea rows={3}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                placeholder={t('sales.invoiceDetail.overridePlaceholder', 'Explain why this credit limit override is approved…')}
                value={creditOverrideReason}
                onChange={(e) => setCreditOverrideReason(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button"
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                onClick={() => { setCreditOverrideOpen(false); setPendingCreatePayload(null); setCreditOverrideInfo(null); setCreditOverrideReason(''); }}
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button type="button"
                className="rounded-lg border border-amber-300 px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                disabled={!creditOverrideReason.trim() || busy}
                onClick={submitCreditOverride}
              >
                {t('sales.invoiceDetail.overrideSubmit', 'Override & Create')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clone to recurring modal */}
      <Modal isOpen={cloneRecurringOpen} onClose={() => setCloneRecurringOpen(false)} title={t('sales.recurring.cloneModal.title', 'Clone Invoice to Recurring Template')}>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">{t('sales.recurring.fields.templateName', 'Template Name *')}</label>
            <input type="text" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={cloneRecurringName} onChange={(e) => setCloneRecurringName(e.target.value)} />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">{t('sales.recurring.fields.frequency', 'Frequency *')}</label>
              <select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={cloneRecurringFrequency} onChange={(e) => setCloneRecurringFrequency(e.target.value as RecurrenceFrequency)}>
                <option value="WEEKLY">{t('sales.recurring.frequency.weekly', 'Weekly')}</option>
                <option value="MONTHLY">{t('sales.recurring.frequency.monthly', 'Monthly')}</option>
                <option value="QUARTERLY">{t('sales.recurring.frequency.quarterly', 'Quarterly')}</option>
                <option value="ANNUALLY">{t('sales.recurring.frequency.annually', 'Annually')}</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">
                {cloneRecurringFrequency === 'WEEKLY' ? t('sales.recurring.fields.dayOfWeek', 'Day of Week') : t('sales.recurring.fields.dayOfMonth', 'Day of Month')}
              </label>
              {cloneRecurringFrequency === 'WEEKLY' ? (
                <select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  value={cloneRecurringDayOfWeek} onChange={(e) => setCloneRecurringDayOfWeek(parseInt(e.target.value, 10))}>
                  <option value={0}>{t('sales.recurring.weekdays.sunday', 'Sunday')}</option>
                  <option value={1}>{t('sales.recurring.weekdays.monday', 'Monday')}</option>
                  <option value={2}>{t('sales.recurring.weekdays.tuesday', 'Tuesday')}</option>
                  <option value={3}>{t('sales.recurring.weekdays.wednesday', 'Wednesday')}</option>
                  <option value={4}>{t('sales.recurring.weekdays.thursday', 'Thursday')}</option>
                  <option value={5}>{t('sales.recurring.weekdays.friday', 'Friday')}</option>
                  <option value={6}>{t('sales.recurring.weekdays.saturday', 'Saturday')}</option>
                </select>
              ) : (
                <input type="number" min={1} max={28} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  value={cloneRecurringDayOfMonth} onChange={(e) => setCloneRecurringDayOfMonth(parseInt(e.target.value, 10) || 1)} />
              )}
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">{t('sales.recurring.fields.startDate', 'Start Date *')}</label>
              <input type="date" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={cloneRecurringStartDate} onChange={(e) => setCloneRecurringStartDate(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">{t('sales.recurring.fields.endDate', 'End Date')}</label>
              <input type="date" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={cloneRecurringEndDate} onChange={(e) => setCloneRecurringEndDate(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">{t('sales.recurring.fields.maxOccurrences', 'Max Occurrences')}</label>
              <input type="number" min={1} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={cloneRecurringMaxOccurrences} onChange={(e) => setCloneRecurringMaxOccurrences(e.target.value)}
                placeholder={t('sales.recurring.placeholders.maxOccurrences', 'Leave empty for unlimited')} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button"
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              onClick={() => setCloneRecurringOpen(false)} disabled={cloneRecurringBusy}>
              {t('common.cancel', 'Cancel')}
            </button>
            <button type="button"
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
              onClick={cloneAsRecurringTemplate} disabled={cloneRecurringBusy}>
              {cloneRecurringBusy ? t('sales.recurring.actions.creatingTemplate', 'Creating...') : t('sales.recurring.actions.createTemplate', 'Create Template')}
            </button>
          </div>
        </div>
      </Modal>

      {confirmDialog}
    </div>
  );
};

export const SalesInvoiceDetailPage: React.FC = () => {
  return <SalesInvoiceDetail />;
};

export default SalesInvoiceDetailPage;
