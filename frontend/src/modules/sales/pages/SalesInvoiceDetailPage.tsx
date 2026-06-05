import React, { useEffect, useMemo, useState } from 'react';
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
import { PartySelector, ItemSelector, WarehouseSelector } from '../../../components/shared/selectors';
import { buildItemUomOptions, findItemUomOption, getDefaultItemUomOption, ManagedUomOption } from '../../inventory/utils/uomOptions';
import { isPersonaAllowedByGovernance, resolveSalesWorkflowMode } from '../../../utils/documentPolicy';
import { GlImpactModal } from '../components/GlImpactModal';
import { PeriodLockOverrideModal } from '../components/PeriodLockOverrideModal';
import { RecordAuditModal } from '../components/RecordAuditModal';
import { todayLocalIso } from '../../../utils/dateUtils';

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

const createEmptyCharge = (): EditableCharge => ({
  name: '',
  amountDoc: 0,
  taxCodeId: undefined,
  revenueAccountId: undefined,
  description: '',
});

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
  const { t } = useTranslation();
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

  const canOverrideCredit =
    salesSettings?.allowCreditOverride !== false &&
    (isOwner || hasPermission('sales.creditOverride'));

  const LINE_DISPLAY_MIN = 10;
  const padLinesToMin = (lines: EditableLine[]): EditableLine[] => {
    if (lines.length >= LINE_DISPLAY_MIN) return lines;
    const pad: EditableLine[] = [];
    for (let i = lines.length; i < LINE_DISPLAY_MIN; i++) pad.push(createEmptyLine());
    return [...lines, ...pad];
  };
  const filledLines = (lines: EditableLine[]): EditableLine[] => lines.filter((l) => !!l.itemId);

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
    notes: '',
    lines: padLinesToMin([]),
    charges: [],
  });

  const initialSalesOrderId = searchParams.get('salesOrderId') || '';
  const initialCustomerId = searchParams.get('customerId') || '';

  const [invoice, setInvoice] = useState<SalesInvoiceDTO | null>(null);
  const [settings, setSettings] = useState<SalesSettingsDTO | null>(null);
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
  const [showSettlement, setShowSettlement] = useState(false);

  // Reset settlement state when navigating between invoices
  useEffect(() => {
    setSettlementMode('DEFERRED');
    setArAccountId('');
    setSettlementRows([]);
    setShowSettlement(false);
  }, [resolvedId]);

  // Clause 1: mode flag — DRAFT is editable, everything else is read-only
  const isReadOnly = !isCreateMode && !(invoice?.status === 'DRAFT');

  const enabledPaymentMethodConfigs = useMemo(
    () => (settings?.paymentMethodConfigs || []).filter((config) => config.isEnabled !== false),
    [settings]
  );
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

  const loadReferenceData = async () => {
    const [settingsResult, customerResult, itemResult, taxResult, warehouseResult, salesOrderResult, salespersonResult, commResult] = await Promise.all([
      salesApi.getSettings(),
      sharedApi.listParties({ role: 'CUSTOMER', active: true }),
      inventoryApi.listItems({ active: true, limit: 500 }),
      sharedApi.listTaxCodes({ active: true }),
      inventoryApi.listWarehouses({ active: true }),
      salesApi.listSOs({ limit: 500 }),
      salesMasterDataApi.listSalespersons({ status: 'ACTIVE' }),
      communicationsApi.getSettings().catch(() => null),
    ]);

    const currentSettings = unwrap<SalesSettingsDTO | null>(settingsResult);
    const customerList = unwrap<PartyDTO[]>(customerResult);
    const itemList = unwrap<InventoryItemDTO[]>(itemResult);
    const taxCodeList = unwrap<TaxCodeDTO[]>(taxResult);
    const warehouseList = unwrap<InventoryWarehouseDTO[]>(warehouseResult);
    const salesOrderList = unwrap<SalesOrderDTO[]>(salesOrderResult);

    setSettings(currentSettings);
    setCommSettings(commResult);
    setCustomers(Array.isArray(customerList) ? customerList : []);
    setItems(Array.isArray(itemList) ? itemList : []);
    setTaxCodes(Array.isArray(taxCodeList) ? taxCodeList : []);
    setWarehouses(Array.isArray(warehouseList) ? warehouseList : []);
    setSalesOrders(Array.isArray(salesOrderList) ? salesOrderList : []);
    setSalespersons(Array.isArray(salespersonResult) ? salespersonResult : []);
    try {
      const templateResult = await voucherFormApi.list();
      const templates = unwrap<VoucherFormResponse[]>(templateResult);
      setInvoiceTemplates(Array.isArray(templates) ? templates : []);
    } catch (templateError) {
      console.error('Failed to load sales invoice templates', templateError);
      setInvoiceTemplates([]);
    }
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
      setLoading(true);
      setError(null);
      await loadReferenceData();
      if (!isCreateMode && resolvedId) {
        const result = await salesApi.getSI(resolvedId);
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
            next.warehouseId = settings.defaultWarehouseId;
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
      return { ...prev, lines: prev.lines.filter((_, idx) => idx !== index) };
    });
  };
  const setCharge = (index: number, patch: Partial<EditableCharge>) => {
    setForm((prev) => {
      const charges = [...prev.charges];
      charges[index] = { ...charges[index], ...patch };
      return { ...prev, charges };
    });
  };
  const addCharge = () => { setForm((prev) => ({ ...prev, charges: [...prev.charges, createEmptyCharge()] })); };
  const removeCharge = (index: number) => {
    setForm((prev) => ({ ...prev, charges: prev.charges.filter((_, idx) => idx !== index) }));
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
      if (item?.trackInventory && !line.dnLineId && !line.warehouseId) {
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
      warehouseId: line.warehouseId || undefined,
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
    dueDate: form.dueDate || undefined,
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
    dueDate: form.dueDate || undefined,
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
        setShowSettlement(false);
        return;
      }
      const posted = await salesApi.postSI(invoice.id, settlementInput, periodLockOverrideReason);
      const dto = unwrap<SalesInvoiceDTO>(posted);
      setInvoice(dto);
      populateFormFromInvoice(dto);
      setShowSettlement(false);
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

  const handlePostClick = () => {
    if (!invoice) return;
    const outstanding = roundMoney((invoice.grandTotalBase || 0) - (invoice.paidAmountBase || 0));
    if (outstanding > 0.005) {
      setShowSettlement(true);
      setSettlementRows([{ settlementAccountId: '', amountBase: outstanding, paymentMethod: enabledPaymentMethodConfigs[0]?.method || 'CASH', reference: '', notes: '', paymentDate: todayIso() }]);
    } else {
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
    return (
      <div className="space-y-4 p-4">
        <div className="h-8 w-64 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
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

  const canCreateReceipt = invoice?.status === 'POSTED' && (invoice?.outstandingAmountBase || 0) > 0;
  const receiptHref = invoice ? `/accounting/vouchers?mode=create&type=receipt&sourceType=SALES_INVOICE&sourceId=${invoice.id}` : '';
  const createReturnHref = invoice
    ? `/sales/returns/new?salesInvoiceId=${encodeURIComponent(invoice.id)}${invoice.salesOrderId ? `&salesOrderId=${encodeURIComponent(invoice.salesOrderId)}` : ''}`
    : '';

  // ─── Shared settlement section renderer ──────────────────────────────────
  const renderSettlementSection = (onConfirm: () => void, confirmLabel: string) => (
    <Card className="p-5 border-blue-200 bg-blue-50">
      <h2 className="mb-3 text-lg font-semibold text-slate-900">{t('sales.invoiceDetail.settlement.title', 'Settlement')}</h2>
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">{t('sales.invoiceDetail.settlement.mode', 'Settlement Mode')}</label>
          <select
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={settlementMode}
            onChange={(e) => setSettlementMode(e.target.value as any)}
          >
            <option value="DEFERRED">{t('sales.invoiceDetail.settlement.deferred', 'Deferred (No Payment)')}</option>
            <option value="CASH_FULL">{t('sales.invoiceDetail.settlement.cashFull', 'Cash Full Payment')}</option>
            <option value="MULTI">{t('sales.invoiceDetail.settlement.multi', 'Multiple Payments')}</option>
          </select>
        </div>
        {settlementMode !== 'DEFERRED' && (
          <>
            <div>
              <label className="mb-1 block text-sm font-medium">{t('sales.invoiceDetail.settlement.arAccount', 'AR Account (Optional Override)')}</label>
              <AccountSelector
                value={arAccountId}
                placeholder={t('sales.invoiceDetail.settlement.arAccountPlaceholder', 'Leave empty to use Sales default AR')}
                onChange={(account) => setArAccountId(account?.id || '')}
              />
            </div>
            {settlementRows.map((row, idx) => (
              <div key={idx} className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
                <div className="text-sm font-medium text-slate-700">{t('sales.invoiceDetail.settlement.paymentRow', 'Payment Row {{n}}', { n: idx + 1 })}</div>
                <div className="grid gap-2 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium">{t('sales.invoiceDetail.settlement.settlementAccount', 'Receiving Account (Cash / Bank)')}</label>
                    <AccountSelector
                      value={row.settlementAccountId}
                      placeholder={t('sales.invoiceDetail.settlement.settlementAccountPlaceholder', 'Leave empty to use payment method mapping')}
                      onChange={(account) => {
                        const updated = [...settlementRows];
                        updated[idx].settlementAccountId = account?.id || '';
                        setSettlementRows(updated);
                      }}
                    />
                    <p className="mt-1 text-[11px] text-slate-500">{t('sales.invoiceDetail.settlement.settlementAccountHint', 'Where the money lands. The customer’s AR account is reduced automatically.')}</p>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">{t('sales.invoiceDetail.settlement.amountBase', 'Amount (Base)')}</label>
                    <input type="number" step="0.01" className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                      value={row.amountBase}
                      onChange={(e) => { const updated = [...settlementRows]; updated[idx].amountBase = parseFloat(e.target.value) || 0; setSettlementRows(updated); }}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">{t('sales.invoiceDetail.settlement.paymentMethod', 'Payment Method')}</label>
                    <select className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                      value={row.paymentMethod}
                      onChange={(e) => { const updated = [...settlementRows]; updated[idx].paymentMethod = e.target.value; setSettlementRows(updated); }}
                    >
                      {enabledPaymentMethodConfigs.length > 0 ? (
                        enabledPaymentMethodConfigs.map((config) => (
                          <option key={config.method} value={config.method}>{config.label || config.method}</option>
                        ))
                      ) : (
                        <>
                          <option value="CASH">{t('sales.invoiceDetail.settlement.cash', 'Cash')}</option>
                          <option value="BANK_TRANSFER">{t('sales.invoiceDetail.settlement.bankTransfer', 'Bank Transfer')}</option>
                          <option value="CHECK">{t('sales.invoiceDetail.settlement.check', 'Check')}</option>
                          <option value="CREDIT_CARD">{t('sales.invoiceDetail.settlement.creditCard', 'Credit Card')}</option>
                          <option value="OTHER">{t('sales.invoiceDetail.settlement.other', 'Other')}</option>
                        </>
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">{t('sales.invoiceDetail.settlement.paymentDate', 'Payment Date')}</label>
                    <input type="date" className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                      value={row.paymentDate}
                      onChange={(e) => { const updated = [...settlementRows]; updated[idx].paymentDate = e.target.value; setSettlementRows(updated); }}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">{t('sales.invoiceDetail.settlement.reference', 'Reference')}</label>
                    <input type="text" className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                      value={row.reference}
                      onChange={(e) => { const updated = [...settlementRows]; updated[idx].reference = e.target.value; setSettlementRows(updated); }}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">{t('sales.invoiceDetail.settlement.notes', 'Notes')}</label>
                    <input type="text" className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                      value={row.notes}
                      onChange={(e) => { const updated = [...settlementRows]; updated[idx].notes = e.target.value; setSettlementRows(updated); }}
                    />
                  </div>
                </div>
                {settlementMode === 'MULTI' && (
                  <button type="button" className="text-xs text-rose-600 hover:text-rose-800"
                    onClick={() => setSettlementRows(settlementRows.filter((_, i) => i !== idx))}
                  >
                    {t('sales.invoiceDetail.settlement.removeRow', 'Remove Row')}
                  </button>
                )}
              </div>
            ))}
            {settlementMode === 'MULTI' && (
              <button type="button"
                className="rounded-lg border border-slate-300 px-3 py-1 text-sm text-slate-700 hover:bg-slate-50"
                onClick={() => setSettlementRows([...settlementRows, { settlementAccountId: '', amountBase: 0, paymentMethod: enabledPaymentMethodConfigs[0]?.method || 'CASH', reference: '', notes: '', paymentDate: todayIso() }])}
              >
                {t('sales.invoiceDetail.settlement.addRow', '+ Add Payment Row')}
              </button>
            )}
          </>
        )}
        <div className="flex gap-2 pt-2">
          <button type="button"
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            onClick={onConfirm} disabled={busy}
          >
            {busy ? t('sales.invoiceDetail.processing', 'Processing...') : confirmLabel}
          </button>
          <button type="button"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            onClick={() => setShowSettlement(false)} disabled={busy}
          >
            {t('common.cancel', 'Cancel')}
          </button>
        </div>
      </div>
    </Card>
  );

  // ─── Header fields form (shared for create + edit DRAFT) ─────────────────
  const renderHeaderForm = () => (
    <div className="flex-none bg-slate-50/50 dark:bg-slate-950/50 border-b border-slate-200/60 dark:border-slate-800/60 p-4 space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        {/* Card 1: Customer & Logistics */}
        <div className="rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-white/85 dark:bg-slate-900/85 p-4 shadow-sm space-y-3">
          <div className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800 pb-2">
            {t('sales.invoiceDetail.sections.customerLogistics', 'Customer & Timelines')}
          </div>
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
            <div className="col-span-full">
              <label className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-400">{t('sales.invoiceDetail.customer', 'Customer')}</label>
              {isReadOnly ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-900">
                  {customerNameById[form.customerId] || form.customerName || form.customerId || '—'}
                </div>
              ) : (
                <PartySelector
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
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-400">{t('sales.invoiceDetail.invoiceDate', 'Invoice Date')}</label>
              <DatePicker value={form.invoiceDate} onChange={(val) => setForm((prev) => ({ ...prev, invoiceDate: val }))} disabled={isReadOnly} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-400">{t('sales.invoiceDetail.dueDate', 'Due Date (optional)')}</label>
              <DatePicker value={form.dueDate} onChange={(val) => setForm((prev) => ({ ...prev, dueDate: val }))} disabled={isReadOnly} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-400">{t('sales.invoiceDetail.salesperson', 'Salesperson')}</label>
              <select
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm disabled:bg-slate-50 disabled:text-slate-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none text-slate-900 dark:text-slate-100"
                value={form.salespersonId || ''}
                disabled={isReadOnly}
                onChange={(e) => setForm((prev) => ({ ...prev, salespersonId: e.target.value || undefined }))}
              >
                <option value="">{t('sales.invoiceDetail.none', '— None —')}</option>
                {salespersons.map((sp) => (
                  <option key={sp.id} value={sp.id}>{sp.name}</option>
                ))}
              </select>
            </div>
            {eligibleInvoiceTemplates.length > 1 && (
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-400">{t('sales.invoiceTemplates.fieldLabel', 'Print Template')}</label>
                <select
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm disabled:bg-slate-50 disabled:text-slate-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none text-slate-900 dark:text-slate-100"
                  value={form.invoiceTemplateId}
                  disabled={isReadOnly}
                  onChange={(e) => {
                    const selected = eligibleInvoiceTemplates.find((template) => template.id === e.target.value);
                    setTemplateTouched(true);
                    setForm((prev) => ({
                      ...prev,
                      invoiceTemplateId: e.target.value,
                      invoiceTemplateFormType: selected?.formType || currentInvoiceFormType,
                    }));
                  }}
                >
                  <option value="">{t('sales.invoiceTemplates.autoSelect', 'Auto Select')}</option>
                  {eligibleInvoiceTemplates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}{template.isDefault ? ` ${t('sales.invoiceTemplates.defaultTag', '(Default)')}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Card 2: Financial Details & Origin */}
        <div className="rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-white/85 dark:bg-slate-900/85 p-4 shadow-sm space-y-3">
          <div className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800 pb-2">
            {t('sales.invoiceDetail.sections.financialDetails', 'Financial Details')}
          </div>
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
            <div className="col-span-full">
              <label className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-400">{t('sales.invoiceDetail.salesOrder', 'Sales Order (optional)')}</label>
              <div className="flex gap-2">
                <select
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm disabled:bg-slate-50 disabled:text-slate-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none text-slate-900 dark:text-slate-100"
                  value={form.salesOrderId}
                  disabled={isReadOnly}
                  onChange={(e) => setForm((prev) => ({ ...prev, salesOrderId: e.target.value }))}
                >
                  <option value="">{t('sales.invoiceDetail.noSalesOrder', 'No sales order')}</option>
                  {salesOrders.map((order) => (
                    <option key={order.id} value={order.id}>{order.orderNumber} - {order.customerName}</option>
                  ))}
                </select>
                {!isReadOnly && (
                  <button type="button"
                    className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 transition-all active:scale-[0.98]"
                    onClick={() => loadSalesOrderLines(form.salesOrderId)}
                    disabled={busy || orderLineLoading || !form.salesOrderId.trim()}
                  >
                    {orderLineLoading ? t('sales.invoiceDetail.loading', 'Loading...') : t('sales.invoiceDetail.loadLines', 'Load Lines')}
                  </button>
                )}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-400">{t('sales.invoiceDetail.customerInvoiceNumber', 'Customer Invoice #')}</label>
              <input type="text"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm disabled:bg-slate-50 disabled:text-slate-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none text-slate-900 dark:text-slate-100"
                value={form.customerInvoiceNumber}
                disabled={isReadOnly}
                onChange={(e) => setForm((prev) => ({ ...prev, customerInvoiceNumber: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400">{t('sales.invoiceDetail.currency', 'Currency')}</label>
              <CurrencySelector value={form.currency} onChange={(code) => setForm((prev) => ({ ...prev, currency: code }))} disabled={isReadOnly || busy} />
            </div>
            <div className="flex flex-col gap-1 col-span-full">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400">{t('sales.invoiceDetail.exchangeRate', 'Exchange Rate')}</label>
              <CurrencyExchangeWidget
                currency={form.currency}
                baseCurrency={company?.baseCurrency || 'USD'}
                voucherDate={form.invoiceDate}
                value={form.exchangeRate}
                onChange={(rate) => setForm((prev) => ({ ...prev, exchangeRate: rate }))}
                disabled={isReadOnly || busy}
              />
            </div>
          </div>
        </div>
      </div>
      <div className="bg-white/85 dark:bg-slate-900/85 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm">
        <label className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-400">{t('sales.invoiceDetail.notes', 'Notes')}</label>
        <textarea rows={1.5}
          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm disabled:bg-slate-50 disabled:text-slate-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none resize-y text-slate-900 dark:text-slate-100"
          value={form.notes}
          disabled={isReadOnly}
          onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
        />
      </div>
    </div>
  );

  const renderLinesTable = () => (
    <div className="flex-1 min-h-[250px] flex flex-col bg-white dark:bg-slate-900 border-y border-slate-200/60 dark:border-slate-800/60">
      <div className="flex-none flex items-center justify-between px-4 py-2 border-b border-slate-100 dark:border-slate-800">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{t('sales.invoiceDetail.lineItems', 'Line Items')}</h2>
        {!isReadOnly && (
          <button type="button"
            className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 transition-all active:scale-[0.98]"
            onClick={addLine} disabled={busy}
          >
            {t('sales.invoiceDetail.addItem', 'Add Row')}
          </button>
        )}
      </div>
      <div className="flex-1 overflow-auto">
        <table className="min-w-full text-xs border-collapse">
          <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900 border-b border-slate-200/60 dark:border-slate-800/60 z-10 shadow-sm">
            <tr>
              <th className="border-b border-slate-200/60 dark:border-slate-800/60 px-3 py-2 text-left text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">{t('sales.invoiceDetail.col.item', 'Item')}</th>
              <th className="border-b border-slate-200/60 dark:border-slate-800/60 px-3 py-2 text-right text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">{t('sales.invoiceDetail.col.qty', 'Qty')}</th>
              <th className="border-b border-slate-200/60 dark:border-slate-800/60 px-3 py-2 text-left text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">{t('sales.invoiceDetail.col.uom', 'UOM')}</th>
              <th className="border-b border-slate-200/60 dark:border-slate-800/60 px-3 py-2 text-right text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">{t('sales.invoiceDetail.col.unitPrice', 'Unit Price')}</th>
              <th className="border-b border-slate-200/60 dark:border-slate-800/60 px-3 py-2 text-left text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">{t('sales.invoiceDetail.col.discountType', 'Discount Type')}</th>
              <th className="border-b border-slate-200/60 dark:border-slate-800/60 px-3 py-2 text-right text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">{t('sales.invoiceDetail.col.discount', 'Discount')}</th>
              <th className="border-b border-slate-200/60 dark:border-slate-800/60 px-3 py-2 text-left text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">{t('sales.invoiceDetail.col.taxCode', 'Tax Code')}</th>
              <th className="border-b border-slate-200/60 dark:border-slate-800/60 px-3 py-2 text-left text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">{t('sales.invoiceDetail.col.warehouse', 'Warehouse')}</th>
              <th className="border-b border-slate-200/60 dark:border-slate-800/60 px-3 py-2 text-right text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">{t('sales.invoiceDetail.col.discountAmt', 'Discount Amt')}</th>
              <th className="border-b border-slate-200/60 dark:border-slate-800/60 px-3 py-2 text-right text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">{t('sales.invoiceDetail.col.lineTotal', 'Line Total')}</th>
              <th className="border-b border-slate-200/60 dark:border-slate-800/60 px-3 py-2 text-right text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">{t('sales.invoiceDetail.col.net', 'Net')}</th>
              <th className="border-b border-slate-200/60 dark:border-slate-800/60 px-3 py-2 text-right text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">{t('sales.invoiceDetail.col.tax', 'Tax')}</th>
              <th className="border-b border-slate-200/60 dark:border-slate-800/60 px-3 py-2 text-right text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">{t('sales.invoiceDetail.col.netBase', 'Net Base')}</th>
              {!isReadOnly && <th className="border-b border-slate-200/60 dark:border-slate-800/60 px-3 py-2 text-right text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {form.lines.map((line, index) => (
              <tr key={line.lineId || `line-${index}`} className="hover:bg-slate-50/80 dark:hover:bg-slate-950/40 align-middle transition-colors duration-150">
                <td className="border-r border-slate-100 dark:border-slate-800 px-2 py-1 align-middle min-w-[180px]">
                  {isReadOnly ? (
                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{line.itemCode ? `${line.itemCode} - ${line.itemName}` : line.itemName || '—'}</div>
                  ) : (
                    <>
                      <ItemSelector value={line.itemId}
                        onChange={(item) => {
                          if (item) {
                            const defaultUom = getDefaultItemUomOption(item, 'sales');
                            setLine(index, { itemId: item.id, itemCode: item.code, itemName: item.name, uomId: defaultUom?.uomId, uom: defaultUom?.code || item.salesUom || item.baseUom });
                          } else {
                            setLine(index, { itemId: '', itemCode: '', itemName: '', uomId: undefined, uom: '' });
                          }
                        }}
                      />
                      {(line.itemCode || line.itemName) && (
                        <div className="mt-1 text-[10px] text-slate-400">{(line.itemCode || '') + (line.itemName ? ` - ${line.itemName}` : '')}</div>
                      )}
                    </>
                  )}
                </td>
                <td className="border-r border-slate-100 dark:border-slate-800 px-2 py-1 align-middle w-[70px]">
                  {isReadOnly ? (
                    <div className="text-right font-mono font-medium text-sm text-slate-900 dark:text-slate-100">{line.invoicedQty}</div>
                  ) : (
                    <input type="number" min={0.000001} step={0.000001}
                      className="w-full border-0 bg-transparent px-1 py-1.5 text-xs text-right font-mono focus:ring-1 focus:ring-primary-500 focus:bg-white dark:focus:bg-slate-800 outline-none text-slate-900 dark:text-slate-100"
                      value={line.invoicedQty}
                      onChange={(e) => setLine(index, { invoicedQty: Number(e.target.value) })}
                    />
                  )}
                </td>
                <td className="border-r border-slate-100 dark:border-slate-800 px-2 py-1 align-middle w-[80px]">
                  {isReadOnly ? (
                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100 uppercase">{line.uom || '—'}</div>
                  ) : (
                    <select className="w-full border-0 bg-transparent px-1 py-1.5 text-xs uppercase focus:ring-1 focus:ring-primary-500 focus:bg-white dark:focus:bg-slate-800 outline-none text-slate-900 dark:text-slate-100"
                      value={findItemUomOption(uomOptionsByItemId[line.itemId] || [], line.uomId, line.uom)?.uomId || line.uomId || line.uom}
                      disabled={!line.itemId}
                      onChange={(e) => {
                        const selected = (uomOptionsByItemId[line.itemId] || []).find((option) => (option.uomId || option.code) === e.target.value);
                        setLine(index, { uomId: selected?.uomId, uom: selected?.code || '' });
                      }}
                    >
                      <option value="">{line.itemId ? t('sales.invoiceDetail.selectUom', 'Select UOM') : t('sales.invoiceDetail.noItem', 'No item')}</option>
                      {(uomOptionsByItemId[line.itemId] || []).map((option) => (
                        <option key={option.uomId || option.code} value={option.uomId || option.code}>{option.code}</option>
                      ))}
                    </select>
                  )}
                </td>
                <td className="border-r border-slate-100 dark:border-slate-800 px-2 py-1 align-middle w-[90px]">
                  {isReadOnly ? (
                    <div className="text-right font-mono font-medium text-sm text-slate-900 dark:text-slate-100">{line.unitPriceDoc?.toFixed(2)}</div>
                  ) : (
                    <input type="number" min={0} step={0.01}
                      className="w-full border-0 bg-transparent px-1 py-1.5 text-xs text-right font-mono focus:ring-1 focus:ring-primary-500 focus:bg-white dark:focus:bg-slate-800 outline-none text-slate-900 dark:text-slate-100"
                      value={line.unitPriceDoc}
                      onChange={(e) => setLine(index, { unitPriceDoc: Number(e.target.value) })}
                    />
                  )}
                </td>
                <td className="border-r border-slate-100 dark:border-slate-800 px-2 py-1 align-middle w-[100px]">
                  {isReadOnly ? (
                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{line.discountType || t('sales.invoiceDetail.noDiscount', 'No Discount')}</div>
                  ) : (
                    <select className="w-full border-0 bg-transparent px-1 py-1.5 text-xs focus:ring-1 focus:ring-primary-500 focus:bg-white dark:focus:bg-slate-800 outline-none text-slate-900 dark:text-slate-100"
                      value={line.discountType || ''}
                      onChange={(e) => setLine(index, { discountType: (e.target.value || undefined) as any, discountValue: 0 })}
                    >
                      <option value="">{t('sales.invoiceDetail.noDiscount', 'No Discount')}</option>
                      <option value="PERCENT">{t('sales.invoiceDetail.discountPercent', 'Percent')}</option>
                      <option value="AMOUNT">{t('sales.invoiceDetail.discountAmount', 'Amount')}</option>
                    </select>
                  )}
                </td>
                <td className="border-r border-slate-100 dark:border-slate-800 px-2 py-1 align-middle w-[70px]">
                  {isReadOnly ? (
                    <div className="text-right font-mono font-medium text-sm text-slate-900 dark:text-slate-100">{line.discountValue || 0}</div>
                  ) : (
                    <input type="number" min={0} step={0.01}
                      className="w-full border-0 bg-transparent px-1 py-1.5 text-xs text-right font-mono focus:ring-1 focus:ring-primary-500 focus:bg-white dark:focus:bg-slate-800 outline-none text-slate-900 dark:text-slate-100"
                      value={line.discountValue || 0}
                      disabled={!line.discountType}
                      onChange={(e) => setLine(index, { discountValue: Number(e.target.value) })}
                    />
                  )}
                </td>
                <td className="border-r border-slate-100 dark:border-slate-800 px-2 py-1 align-middle w-[110px]">
                  {isReadOnly ? (
                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{line.taxCodeId ? taxById[line.taxCodeId]?.code || line.taxCodeId : t('sales.invoiceDetail.noTax', 'No Tax')}</div>
                  ) : (
                    <div className="flex flex-col p-1 gap-1">
                      <select className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded px-1 py-0.5 text-xs focus:ring-1 focus:ring-primary-500 outline-none text-slate-900 dark:text-slate-100"
                        value={line.taxCodeId || ''}
                        onChange={(e) => setLine(index, { taxCodeId: e.target.value || undefined })}
                      >
                        <option value="">{t('sales.invoiceDetail.noTax', 'No Tax')}</option>
                        {salesTaxCodes.map((taxCode) => (
                          <option key={taxCode.id} value={taxCode.id}>{taxCode.code} ({Math.round(taxCode.rate * 100)}%)</option>
                        ))}
                      </select>
                      {line.taxCodeId && (() => {
                        const tc = taxById[line.taxCodeId];
                        const effective = line.priceIsInclusive !== undefined ? line.priceIsInclusive : tc?.priceIsInclusive === true;
                        return (
                          <label className="flex items-center gap-1 text-[10px] text-slate-500 select-none">
                            <input type="checkbox" className="h-3 w-3 rounded border-slate-300 dark:border-slate-700 text-primary-600 focus:ring-primary-500"
                              checked={effective}
                              onChange={(e) => setLine(index, { priceIsInclusive: e.target.checked })}
                            />
                            <span className="truncate">
                              {t('sales.invoiceDetail.taxInclusive', 'Tax-incl.')}
                            </span>
                          </label>
                        );
                      })()}
                    </div>
                  )}
                </td>
                <td className="border-r border-slate-100 dark:border-slate-800 px-2 py-1 align-middle min-w-[120px]">
                  {line.dnLineId ? (
                    <div className="rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 px-2 py-1 text-[10px] text-slate-500">
                      {t('sales.invoiceDetail.autoFromDN', 'Auto from DN')}
                    </div>
                  ) : isReadOnly ? (
                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{line.warehouseId ? (warehouses.find(w => w.id === line.warehouseId)?.name || line.warehouseId) : '—'}</div>
                  ) : (
                    <WarehouseSelector value={line.warehouseId} onChange={(wh) => setLine(index, { warehouseId: wh?.id || undefined })} />
                  )}
                </td>
                <td className="border-r border-slate-100 dark:border-slate-800 px-2 py-1 align-middle text-right font-mono text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">{computedLines[index]?.discountAmountDoc.toFixed(2)}</td>
                <td className="border-r border-slate-100 dark:border-slate-800 px-2 py-1 align-middle text-right font-mono text-xs font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">{computedLines[index]?.lineGrossDoc.toFixed(2)}</td>
                <td className="border-r border-slate-100 dark:border-slate-800 px-2 py-1 align-middle text-right font-mono text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">{computedLines[index]?.lineTotalDoc.toFixed(2)}</td>
                <td className="border-r border-slate-100 dark:border-slate-800 px-2 py-1 align-middle text-right font-mono text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">{computedLines[index]?.taxAmountDoc.toFixed(2)}</td>
                <td className="border-r border-slate-100 dark:border-slate-800 px-2 py-1 align-middle text-right font-mono text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">{computedLines[index]?.lineTotalBase.toFixed(2)}</td>
                {!isReadOnly && (
                  <td className="px-2 py-1 text-center align-middle">
                    <button type="button"
                      className="rounded-full h-5 w-5 inline-flex items-center justify-center border border-slate-200 dark:border-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/20 hover:text-rose-600 dark:hover:text-rose-400 text-slate-400 transition-all active:scale-[0.98]"
                      onClick={() => removeLine(index)} disabled={busy || form.lines.length <= 1}
                    >
                      ✕
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderChargesSection = () => (
    <div className="py-2 space-y-3 bg-white dark:bg-slate-900">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{t('sales.invoiceDetail.charges', 'Charges / Additions')}</h3>
        {!isReadOnly && (
          <button type="button"
            className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 transition-all active:scale-[0.98]"
            onClick={addCharge} disabled={busy}
          >
            {t('sales.invoiceDetail.addCharge', 'Add Charge')}
          </button>
        )}
      </div>
      <div className="space-y-2">
        {form.charges.length === 0 && (
          <div className="text-xs text-slate-400 dark:text-slate-500 py-2 italic">{t('sales.invoiceDetail.noCharges', 'No charges added.')}</div>
        )}
        {form.charges.map((charge, index) => (
          <div key={charge.chargeId || `charge-${index}`} className="grid gap-3 p-3 rounded-lg border border-slate-200/60 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-950/20 md:grid-cols-6 items-center">
            <div>
              <input type="text"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none disabled:bg-slate-50 disabled:text-slate-400 text-slate-900 dark:text-slate-100"
                placeholder={t('sales.invoiceDetail.chargeName', 'Charge name')}
                value={charge.name} disabled={isReadOnly}
                onChange={(e) => setCharge(index, { name: e.target.value })}
              />
            </div>
            <div>
              <input type="number" min={0} step={0.01}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-right font-mono focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none disabled:bg-slate-50 disabled:text-slate-400 text-slate-900 dark:text-slate-100"
                placeholder={t('sales.invoiceDetail.chargeAmount', 'Amount')}
                value={charge.amountDoc} disabled={isReadOnly}
                onChange={(e) => setCharge(index, { amountDoc: Number(e.target.value) })}
              />
            </div>
            <div>
              <select className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none disabled:bg-slate-50 disabled:text-slate-400 text-slate-900 dark:text-slate-100"
                value={charge.taxCodeId || ''} disabled={isReadOnly}
                onChange={(e) => setCharge(index, { taxCodeId: e.target.value || undefined })}
              >
                <option value="">{t('sales.invoiceDetail.noTax', 'No Tax')}</option>
                {salesTaxCodes.map((taxCode) => (
                  <option key={taxCode.id} value={taxCode.id}>{taxCode.code} ({Math.round(taxCode.rate * 100)}%)</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2 flex items-center gap-2">
              <input type="text"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none disabled:bg-slate-50 disabled:text-slate-400 text-slate-900 dark:text-slate-100"
                placeholder={t('sales.invoiceDetail.chargeDescription', 'Description (optional)')}
                value={charge.description || ''} disabled={isReadOnly}
                onChange={(e) => setCharge(index, { description: e.target.value })}
              />
              <div className="text-xs font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                {form.currency} {computedCharges[index]?.amountDoc.toFixed(2)} + {t('sales.invoiceDetail.tax', 'Tax')} {computedCharges[index]?.taxAmountDoc.toFixed(2)}
              </div>
            </div>
            <div className="flex items-center justify-end">
              {!isReadOnly && (
                <button type="button"
                  className="rounded-lg border border-red-200 dark:border-red-900 bg-white dark:bg-slate-900 px-3 py-1 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all active:scale-[0.98]"
                  onClick={() => removeCharge(index)} disabled={busy}
                >
                  {t('sales.invoiceDetail.remove', 'Remove')}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderTotals = () => (
    <Card className="p-5">
      <h3 className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100">{t('sales.invoiceDetail.totals', 'Totals')}</h3>
      <div className="grid gap-2 text-sm md:grid-cols-2">
        <div className="flex justify-between">
          <span className="text-slate-600">{t('sales.invoiceDetail.subtotalDoc', 'Subtotal ({{currency}})', { currency: form.currency })}</span>
          <span className="font-medium">{form.currency} {totals.subtotalDoc.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-600">{t('sales.invoiceDetail.subtotalBase', 'Subtotal (Base)')}</span>
          <span className="font-medium">{totals.subtotalBase.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-600">{t('sales.invoiceDetail.taxDoc', 'Tax ({{currency}})', { currency: form.currency })}</span>
          <span className="font-medium">{form.currency} {totals.taxTotalDoc.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-600">{t('sales.invoiceDetail.taxBase', 'Tax (Base)')}</span>
          <span className="font-medium">{totals.taxTotalBase.toFixed(2)}</span>
        </div>
        <div className="flex justify-between border-t border-slate-200 pt-2">
          <span className="font-semibold text-slate-900 dark:text-slate-100">{t('sales.invoiceDetail.grandTotalDoc', 'Grand Total ({{currency}})', { currency: form.currency })}</span>
          <span className="font-semibold text-slate-900 dark:text-slate-100">{form.currency} {totals.grandTotalDoc.toFixed(2)}</span>
        </div>
        <div className="flex justify-between border-t border-slate-200 pt-2">
          <span className="font-semibold text-slate-900 dark:text-slate-100">{t('sales.invoiceDetail.grandTotalBase', 'Grand Total (Base)')}</span>
          <span className="font-semibold text-slate-900 dark:text-slate-100">{totals.grandTotalBase.toFixed(2)}</span>
        </div>
      </div>
    </Card>
  );

  // ─── Main render ──────────────────────────────────────────────────────────
  return (
    <div className={clsx("flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950", isWindow ? "h-full w-full" : "h-[calc(100vh-3.5rem)]")}>
      {/* Info bar — ~5% */}
      <div className="flex-none flex items-center justify-between px-4 py-2 bg-white dark:bg-slate-900 border-b border-slate-200/60 dark:border-slate-800/60">
        <div className="flex items-baseline gap-3 min-w-0">
          <h1 className="text-base font-semibold text-slate-900 dark:text-slate-100 truncate">
            {isCreateMode ? t('sales.invoiceDetail.newTitle', 'New Sales Invoice') : (invoice?.invoiceNumber || t('sales.invoiceDetail.title', 'Sales Invoice'))}
          </h1>
          {invoice && (
            <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {customerNameById[invoice.customerId] || invoice.customerName}
              {invoice.customerInvoiceNumber ? ` · ${t('sales.invoiceDetail.customerRef', 'Customer Ref:')} ${invoice.customerInvoiceNumber}` : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {invoice && <StatusChip status={invoice.status} type="si" />}
          {isCreateMode && <StatusChip status="DRAFT" type="si" />}
        </div>
      </div>

      {/* Banners */}
      {/*
        SoD: a Sales Invoice in PENDING_APPROVAL is awaiting accounting approval. Sales-side
        cannot Approve its own postings. The accountant clears the parked state from the
        Approval Center. See docs/architecture/posting-authority.md §4.1.
      */}
      {invoice?.status === 'PENDING_APPROVAL' && (
        <div className="flex-none mx-3 mt-2 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
          <div className="font-semibold mb-0.5">
            {t('sales.invoiceDetail.pendingApprovalBanner.title', '⏳ Awaiting accounting approval')}
          </div>
          <div className="text-amber-800 dark:text-amber-300">
            {t('sales.invoiceDetail.pendingApprovalBanner.description', 'This invoice was submitted and is waiting for accounting to approve the ledger effect. You cannot edit it while it is pending. The decision will appear here when it is made.')}
          </div>
        </div>
      )}
      {isCreateMode && settings?.workflowMode === 'OPERATIONAL' && !form.salesOrderId && !isCurrentPersonaAllowed && (
        <div className="flex-none mx-3 mt-2 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20 px-3 py-1.5 text-xs text-amber-800 dark:text-amber-300">
          {t('sales.governance.operationalWarning', 'Operational workflow: Direct invoicing is blocked. Select a Sales Order or ask an admin for an exception.')}
        </div>
      )}
      {creditWarnBanner && (
        <div className="flex-none mx-3 mt-2 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20 px-3 py-1.5 text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between gap-2">
          <span>{creditWarnBanner}</span>
          <button type="button" className="text-amber-500 hover:text-amber-700 font-bold shrink-0" onClick={() => setCreditWarnBanner(null)}>✕</button>
        </div>
      )}

      {/* Payment info — POSTED only, inline compact strip */}
      {invoice && invoice.status !== 'DRAFT' && (
        <div className="flex-none bg-white dark:bg-slate-900 border-b border-slate-200/60 dark:border-slate-800/60 px-4 py-2">
          <div className="grid gap-2 grid-cols-3 md:grid-cols-6">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">{t('sales.invoiceDetail.invoiceDateLabel', 'Invoice Date')}</div>
              <div className="mt-1 font-medium text-slate-900 dark:text-slate-100">{invoice.invoiceDate}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">{t('sales.invoiceDetail.dueDateLabel', 'Due Date')}</div>
              <div className="mt-1 font-medium text-slate-900 dark:text-slate-100">{invoice.dueDate || '-'}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">{t('sales.invoiceDetail.soRefLabel', 'SO Reference')}</div>
              <div className="mt-1 font-medium text-slate-900 dark:text-slate-100">
                {(invoice.salesOrderId && salesOrderLabelById[invoice.salesOrderId]) || invoice.salesOrderId || '-'}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">{t('sales.invoiceDetail.currencyLabel', 'Currency')}</div>
              <div className="mt-1 font-medium text-slate-900 dark:text-slate-100">{invoice.currency}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">{t('sales.invoiceDetail.exchangeRateLabel', 'Exchange Rate')}</div>
              <div className="mt-1 font-medium text-slate-900 dark:text-slate-100">{invoice.exchangeRate}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">{t('sales.invoiceDetail.salespersonLabel', 'Salesperson')}</div>
              <div className="mt-1 font-medium text-slate-900 dark:text-slate-100">
                {(() => {
                  if (!invoice.salespersonId) return '-';
                  const sp = salespersons.find((s) => s.id === invoice.salespersonId);
                  return sp ? `${sp.code} - ${sp.name}` : invoice.salespersonId;
                })()}
              </div>
            </div>
          </div>
          {invoice.status === 'POSTED' && (
            <div className="mt-4 grid gap-2 text-sm md:grid-cols-2 border-t border-slate-100 pt-4">
              <div className="flex justify-between">
                <span className="text-slate-600">{t('sales.invoiceDetail.paymentStatus', 'Payment Status')}</span>
                <span className="font-medium">{invoice.paymentStatus}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">{t('sales.invoiceDetail.paymentTerms', 'Payment Terms (days)')}</span>
                <span className="font-medium">{invoice.paymentTermsDays}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">{t('sales.invoiceDetail.outstandingBase', 'Outstanding (Base)')}</span>
                <span className="font-medium">{invoice.outstandingAmountBase?.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">{t('sales.invoiceDetail.paidBase', 'Paid (Base)')}</span>
                <span className="font-medium">{invoice.paidAmountBase?.toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* DRAFT: editable form */}
      {(isCreateMode || invoice?.status === 'DRAFT') && renderHeaderForm()}

      {/* Lines — flex-1 */}
      {renderLinesTable()}

      {/* Charges (collapsible) — flex-none */}
      <details className="flex-none bg-white dark:bg-slate-900 border-t border-slate-200/60 dark:border-slate-800/60 group">
        <summary className="cursor-pointer px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 select-none hover:bg-slate-50 dark:hover:bg-slate-950/40 transition-colors duration-150">
          {t('sales.invoiceDetail.charges', 'Charges / Additions')} {form.charges.length > 0 && <span className="text-slate-400">({form.charges.length})</span>}
        </summary>
        <div className="px-4 pb-3 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">{renderChargesSection()}</div>
      </details>

      {/* Totals + Attachments (collapsed) — flex-none */}
      <div className="flex-none px-4 py-3 bg-slate-50 dark:bg-slate-950 border-t border-slate-200/60 dark:border-slate-800/60 flex flex-wrap items-center justify-between gap-3 shadow-inner">
        <div className="text-xs text-slate-500">
          {!isCreateMode && invoice && (
            <details className="inline-block relative">
              <summary className="cursor-pointer text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 select-none transition-colors duration-150 font-medium">
                📎 {t('sales.invoiceDetail.attachmentsLink', 'Attachments')} ({attachments.length})
              </summary>
              <div className="absolute right-0 bottom-full mb-2 z-[999] w-[480px] max-w-[90vw] rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-3 shadow-xl">
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
              </div>
            </details>
          )}
        </div>
        <div className="flex items-center gap-6 text-sm">
          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500">{t('sales.invoiceDetail.subtotal', 'Subtotal')}</span>
            <span className="font-mono font-medium text-slate-900 dark:text-slate-100">{form.currency} {totals.subtotalDoc.toFixed(2)}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500">{t('sales.invoiceDetail.tax', 'Tax')}</span>
            <span className="font-mono font-medium text-slate-900 dark:text-slate-100">{form.currency} {totals.taxTotalDoc.toFixed(2)}</span>
          </div>
          <div className="flex flex-col items-end border-l border-slate-200 dark:border-slate-800 pl-6">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500">{t('sales.invoiceDetail.grandTotal', 'Grand Total')}</span>
            <span className="font-mono font-black text-xl text-primary-600 dark:text-primary-400">{form.currency} {totals.grandTotalDoc.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Settlement section (conditional overlay-style band).
          SoD guard: never render once the SI is PENDING_APPROVAL — the only
          legitimate next step at that point is approval in Accounting. */}
      {showSettlement && (isCreateMode || invoice?.status === 'DRAFT') && (
        <div className="flex-none px-4 py-2 bg-blue-50 border-t border-blue-200 max-h-[40vh] overflow-auto">
          {isCreateMode
            ? renderSettlementSection(() => createAndPostDraft(), t('sales.invoiceDetail.confirmSaveAndPost', 'Confirm Save & Post'))
            : renderSettlementSection(() => postDraft(), t('sales.invoiceDetail.confirmPost', 'Confirm & Post'))}
        </div>
      )}

      {/* Action button bar — sticky bottom, flex-none */}
      <div className="flex-none flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 px-4 py-3 bg-white dark:bg-slate-900 border-t border-slate-200/60 dark:border-slate-800/60">
        {/* Left Side: Back, History, Sharing, GL Impact */}
        <div className="flex flex-wrap items-center gap-2">
          <button type="button"
            className="rounded-lg border border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-[0.98]"
            onClick={() => {
              if (isWindow && onClose) {
                onClose();
              } else {
                navigate('/sales/invoices');
              }
            }}
          >
            {isWindow ? t('common.close', 'Close') : t('sales.invoiceDetail.backToList', 'Back to List')}
          </button>
          
          {!isCreateMode && (
            <button type="button"
              className="rounded-lg border border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-[0.98]"
              onClick={() => setAuditModalOpen(true)}
            >
              {t('sales.invoiceDetail.history', 'History')}
            </button>
          )}

          {invoice?.status === 'POSTED' && (
            <>
              {/* GL Impact */}
              <button type="button"
                className="rounded-lg border border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-[0.98]"
                onClick={() => setGlImpactOpen(true)}
              >
                {t('sales.invoiceDetail.glImpact', 'GL Impact')}
              </button>
              
              {/* Unified send (WhatsApp / Telegram / share link) */}
              <SendDocumentButton
                accounts={messagingAccounts}
                defaultPhone={invoice ? (customerById[invoice.customerId]?.phone || '').trim() : ''}
                documentNumber={invoice?.invoiceNumber || ''}
                customerName={invoice ? (customerNameById[invoice.customerId] || invoice.customerName) : ''}
                amount={invoice?.grandTotalDoc || 0}
                currency={invoice?.currency || ''}
                documentDate={invoice?.invoiceDate || ''}
                onSendWhatsApp={async (params) => {
                  if (!invoice?.id) return { messageId: '', recipientPhoneNumber: '' };
                  const result = await salesApi.sendInvoiceWhatsApp(invoice.id, {
                    messagingAccountId: params.messagingAccountId,
                    toPhoneNumber: params.toPhoneNumber,
                    messageText: params.messageText,
                    documentUrl: params.documentUrl,
                  });
                  const payload = unwrap<any>(result);
                  errorHandler.showInfo(
                    t('sales.invoices.whatsapp.success', 'WhatsApp sent successfully to {{phone}} using {{sender}} (message id: {{messageId}}).', {
                      phone: payload.recipientPhoneNumber,
                      sender: payload.senderLabel || t('sales.invoices.whatsapp.defaultSender', 'default sender'),
                      messageId: payload.messageId,
                    })
                  );
                  return payload;
                }}
                onSendTelegram={async (params) => {
                  if (!invoice?.id) return { messageId: '', recipientChatId: '' };
                  const result = await salesApi.sendInvoiceTelegram(invoice.id, {
                    messagingAccountId: params.messagingAccountId,
                    toChatId: params.toChatId,
                    messageText: params.messageText,
                    documentUrl: params.documentUrl,
                  });
                  const payload = unwrap<any>(result);
                  errorHandler.showInfo(
                    t('sales.invoices.telegram.success', 'Telegram sent successfully to {{chatId}} using {{sender}} (message id: {{messageId}}).', {
                      chatId: payload.recipientChatId,
                      sender: payload.senderLabel || t('sales.invoices.telegram.defaultSender', 'default sender'),
                      messageId: payload.messageId,
                    })
                  );
                  return payload;
                }}
              />
            </>
          )}
        </div>

        {/* Right Side: State changes (Save, Post, Discard, Reversing, Receipt) */}
        <div className="flex flex-wrap items-center gap-2 justify-end">
          {/* POSTED actions (Refund/Receipt/Recurring) */}
          {invoice?.status === 'POSTED' && (
            <>
              {/* Caution: clone to recurring */}
              <button type="button"
                className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20 px-4 py-2 text-sm font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-100/50 dark:hover:bg-amber-950/40 transition-all active:scale-[0.98]"
                onClick={openCloneRecurringModal}
              >
                {t('sales.recurring.actions.cloneFromInvoice', 'Clone to Recurring')}
              </button>

              {/* Caution: create return */}
              <button type="button"
                className="rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/20 px-4 py-2 text-sm font-medium text-rose-700 dark:text-rose-400 hover:bg-rose-100/50 dark:hover:bg-rose-950/40 transition-all active:scale-[0.98]"
                onClick={() => navigate(createReturnHref)}
              >
                {t('sales.invoiceDetail.createReturn', 'Create Reversing Sales Return')}
              </button>

              {/* Outbound: create receipt */}
              <button type="button"
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
                onClick={() => navigate(receiptHref)} disabled={!canCreateReceipt}
              >
                {t('sales.invoiceDetail.createReceipt', 'Create Receipt')}
              </button>
            </>
          )}

          {/* PENDING_APPROVAL actions: SoD says Sales cannot Approve its own posting.
              Only History is rendered so the user can see who submitted and when.
              Approval happens in the Accounting Approval Center. */}
          {!isCreateMode && invoice?.status === 'PENDING_APPROVAL' && (
            <>
              <button type="button"
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-[0.98]"
                onClick={() => setAuditModalOpen(true)}
              >
                {t('sales.invoiceDetail.history', 'History')}
              </button>
            </>
          )}

          {/* DRAFT actions */}
          {!isCreateMode && invoice?.status === 'DRAFT' && (
            <>
              {/* Clone to recurring (draft) */}
              <button type="button"
                className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20 px-4 py-2 text-sm font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-100/50 dark:hover:bg-amber-950/40 transition-all active:scale-[0.98]"
                onClick={openCloneRecurringModal}
              >
                {t('sales.recurring.actions.cloneFromInvoice', 'Clone to Recurring')}
              </button>

              {/* Discard */}
              <button type="button"
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 transition-all active:scale-[0.98] disabled:opacity-50"
                onClick={handleDiscard} disabled={busy}
              >
                {t('sales.invoiceDetail.discard', 'Discard')}
              </button>

              {/* Save Draft Changes */}
              <button type="button"
                className="rounded-lg bg-slate-800 dark:bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900 dark:hover:bg-slate-600 transition-all active:scale-[0.98] disabled:opacity-50"
                onClick={saveDraftChanges} disabled={busy}
              >
                {busy ? t('sales.invoiceDetail.saving', 'Saving...') : t('sales.invoiceDetail.saveChanges', 'Save Changes')}
              </button>

              {/* Post Invoice */}
              {!showSettlement && (
                <button type="button"
                  className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 transition-all active:scale-[0.98] disabled:opacity-50"
                  onClick={handlePostClick} disabled={busy}
                >
                  {busy ? t('sales.invoiceDetail.posting', 'Posting...') : t('sales.invoiceDetail.postInvoice', 'Post Invoice')}
                </button>
              )}
            </>
          )}

          {/* CREATE actions */}
          {isCreateMode && (
            <>
              {/* Save Draft */}
              <button type="button"
                className="rounded-lg bg-slate-800 dark:bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900 dark:hover:bg-slate-600 transition-all active:scale-[0.98] disabled:opacity-50"
                onClick={() => createDraft()} disabled={busy || orderLineLoading}
              >
                {busy ? t('sales.invoiceDetail.creating', 'Creating...') : t('sales.invoiceDetail.saveDraft', 'Save Draft')}
              </button>

              {/* Save & Post */}
              <button type="button"
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 transition-all active:scale-[0.98] disabled:opacity-50"
                onClick={() => {
                  const outstanding = roundMoney(totals.grandTotalBase);
                  if (outstanding > 0.005) {
                    setShowSettlement(true);
                    setSettlementRows([{ settlementAccountId: '', amountBase: outstanding, paymentMethod: enabledPaymentMethodConfigs[0]?.method || 'CASH', reference: '', notes: '', paymentDate: todayIso() }]);
                  } else {
                    setSettlementMode('DEFERRED');
                    createAndPostDraft();
                  }
                }}
                disabled={busy || orderLineLoading}
              >
                {busy ? t('sales.invoiceDetail.savingAndPosting', 'Saving & Posting...') : t('sales.invoiceDetail.saveAndPost', 'Save & Post')}
              </button>
            </>
          )}
        </div>
      </div>

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
