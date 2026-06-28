/**
 * PosSettingsPage.tsx — POS settings (registers, payment methods, governance).
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Card } from '../../../components/ui/Card';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { ModuleSettingsLayout } from '../../../components/shared/ModuleSettingsLayout';
import { PartySelector } from '../../../components/shared/selectors/PartySelector';
import { ItemSelector } from '../../../components/shared/selectors/ItemSelector';
import { AccountSelector } from '../../../modules/accounting/components/shared/AccountSelector';
import { listRoles, CompanyRole } from '../../../api/companyAdmin';
import {
  posApi,
  PosCommandDefinitionDTO,
  PosControlButtonDTO,
  PosLayoutDTO,
  PosPaymentMethodCode,
  PosPaymentMethodDTO,
  PosPolicyDTO,
  PosProductShortcutNodeDTO,
  PosSettingsDTO,
  PosCashierRolePolicyDTO,
  PosManagerOverrideAction,
  SellingPolicyDTO,
} from '../../../api/posApi';
import { errorHandler } from '../../../services/errorHandler';
import { Info, Save, Shield, ShieldCheck, UserCog, ListChecks } from 'lucide-react';
import { ModuleControlsTab } from '../../../components/shared/ModuleControlsTab';

interface Props { isWindow?: boolean }

const unwrap = <T,>(p: any): T => (p?.data ?? p) as T;

const ALL_METHOD_CODES: PosPaymentMethodCode[] = ['CASH', 'CARD', 'BANK_TRANSFER', 'CUSTOM'];
const OVERRIDE_ACTIONS: PosManagerOverrideAction[] = ['VOID_LINE', 'PRICE_OVERRIDE', 'DISCOUNT_OVERRIDE', 'TAX_OVERRIDE', 'RETURN', 'REPRINT'];

const createDefaultPolicy = (companyId = ''): PosPolicyDTO => ({
  companyId,
  allowPosDirectSales: false,
  cashierRolePolicies: [],
});

const PosSettingsPage: React.FC<Props> = () => {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<PosSettingsDTO | null>(null);
  const [original, setOriginal] = useState<PosSettingsDTO | null>(null);
  const [policy, setPolicy] = useState<PosPolicyDTO | null>(null);
  const [originalPolicy, setOriginalPolicy] = useState<PosPolicyDTO | null>(null);
  const [sellingPolicy, setSellingPolicy] = useState<SellingPolicyDTO | null>(null);
  const [originalSellingPolicy, setOriginalSellingPolicy] = useState<SellingPolicyDTO | null>(null);
  const [roles, setRoles] = useState<CompanyRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('general');
  const [showAllowDirectConfirm, setShowAllowDirectConfirm] = useState(false);
  const [pendingAllowDirect, setPendingAllowDirect] = useState<boolean | null>(null);
  const [productLayouts, setProductLayouts] = useState<PosLayoutDTO[]>([]);
  const [controlLayouts, setControlLayouts] = useState<PosLayoutDTO[]>([]);
  const [selectedProductLayoutId, setSelectedProductLayoutId] = useState('');
  const [selectedControlLayoutId, setSelectedControlLayoutId] = useState('');
  const [productNodes, setProductNodes] = useState<PosProductShortcutNodeDTO[]>([]);
  const [controlButtons, setControlButtons] = useState<PosControlButtonDTO[]>([]);
  const [commands, setCommands] = useState<PosCommandDefinitionDTO[]>([]);
  const [newProductLayoutName, setNewProductLayoutName] = useState('Default shortcuts');
  const [newControlLayoutName, setNewControlLayoutName] = useState('Default controls');
  const [newNode, setNewNode] = useState<Partial<PosProductShortcutNodeDTO>>({ nodeType: 'GROUP', label: '', sortOrder: 0, isActive: true });
  const [newButton, setNewButton] = useState<Partial<PosControlButtonDTO>>({ zone: 'BOTTOM_BAR', commandCode: 'CASH_PAYMENT', label: '', sortOrder: 0, isActive: true, isVisible: true });

  const normalizeSettings = (data: PosSettingsDTO | null): PosSettingsDTO => {
    const base: PosSettingsDTO = data || {
      companyId: '',
      requireOpenShift: true,
      receiptPrefix: 'R',
      receiptNextSeq: 1,
      cashRounding: 'none',
      allowPosDirectSales: false,
      negativeStockPolicy: 'BLOCK',
      paymentMethods: [],
      allowCreditSales: false,
      creditSaleManagerOverride: false,
    };
    const existing = new Map(base.paymentMethods.map((m) => [m.code, m]));
    return {
      ...base,
      paymentMethods: ALL_METHOD_CODES.map((code) => {
        const prev = existing.get(code);
        return (
          prev || {
            code,
            settlementAccountId: '',
            requiresReference: code !== 'CASH',
            allowsChange: code === 'CASH',
            isEnabled: code === 'CASH',
          }
        );
      }),
    };
  };

  const loadSettings = async (): Promise<PosSettingsDTO> => {
    const result = await posApi.getSettings();
    const data = unwrap<PosSettingsDTO | null>(result);
    return normalizeSettings(data);
  };

  const normalizePolicy = (data: PosPolicyDTO | null, companyId = ''): PosPolicyDTO => ({
    ...createDefaultPolicy(companyId),
    ...(data || {}),
    cashierRolePolicies: Array.isArray(data?.cashierRolePolicies) ? data.cashierRolePolicies : [],
  });

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [normalized, loadedPolicy, loadedRoles, loadedSellingPolicy] = await Promise.all([
          loadSettings(),
          posApi.getPolicy().catch(() => null),
          listRoles().catch(() => [] as CompanyRole[]),
          posApi.getSellingPolicy().catch(() => null),
        ]);
        const normalizedPolicy = normalizePolicy(loadedPolicy, normalized.companyId);
        setSettings(normalized);
        setOriginal(normalized);
        setPolicy(normalizedPolicy);
        setOriginalPolicy(normalizedPolicy);
        setRoles(loadedRoles || []);
        if (loadedSellingPolicy) {
          setSellingPolicy(loadedSellingPolicy);
          setOriginalSellingPolicy(loadedSellingPolicy);
        }
      } catch (err) {
        console.error('Failed to load POS settings', err);
        toast.error(t('pos:settings.loadError', { defaultValue: 'Failed to load POS settings.' }));
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const reloadLayouts = async () => {
    const [pl, cl, cmd] = await Promise.all([
      posApi.listProductShortcutLayouts(),
      posApi.listControlButtonLayouts(),
      posApi.listCommands(),
    ]);
    setProductLayouts(pl);
    setControlLayouts(cl);
    setCommands(cmd);
    setSelectedProductLayoutId((prev) => prev || pl[0]?.id || '');
    setSelectedControlLayoutId((prev) => prev || cl[0]?.id || '');
  };

  useEffect(() => {
    if (!settings) return;
    void reloadLayouts().catch((err) => console.error('Failed to load POS layouts', err));
  }, [settings?.companyId]);

  useEffect(() => {
    if (!selectedProductLayoutId) {
      setProductNodes([]);
      return;
    }
    posApi
      .listProductShortcutNodes(selectedProductLayoutId)
      .then(setProductNodes)
      .catch((err) => console.error('Failed to load product shortcut nodes', err));
  }, [selectedProductLayoutId]);

  useEffect(() => {
    if (!selectedControlLayoutId) {
      setControlButtons([]);
      return;
    }
    posApi
      .listControlButtons(selectedControlLayoutId)
      .then(setControlButtons)
      .catch((err) => console.error('Failed to load POS control buttons', err));
  }, [selectedControlLayoutId]);

  const update = <K extends keyof PosSettingsDTO>(field: K, value: PosSettingsDTO[K]) => {
    setSettings((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const updateMethod = (code: PosPaymentMethodCode, patch: Partial<PosPaymentMethodDTO>) => {
    setSettings((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        paymentMethods: prev.paymentMethods.map((m) =>
          m.code === code ? { ...m, ...patch } : m
        ),
      };
    });
  };

  const upsertRolePolicy = (roleId: string, patch: Partial<PosCashierRolePolicyDTO>) => {
    setPolicy((prev) => {
      if (!prev) return prev;
      const current = prev.cashierRolePolicies.find((p) => p.roleId === roleId) || {
        roleId,
        requireApprovalForDirectSales: false,
        managerOverrideActions: [],
        allowPriceOverride: true,
        allowTaxOverride: true,
      };
      const next = { ...current, ...patch, roleId };
      return {
        ...prev,
        cashierRolePolicies: prev.cashierRolePolicies.some((p) => p.roleId === roleId)
          ? prev.cashierRolePolicies.map((p) => (p.roleId === roleId ? next : p))
          : [...prev.cashierRolePolicies, next],
      };
    });
  };

  const toggleRoleAction = (roleId: string, action: PosManagerOverrideAction, checked: boolean) => {
    const current = policy?.cashierRolePolicies.find((p) => p.roleId === roleId)?.managerOverrideActions || [];
    const next = checked ? Array.from(new Set([...current, action])) : current.filter((a) => a !== action);
    upsertRolePolicy(roleId, { managerOverrideActions: next });
  };

  const hasChanges =
    JSON.stringify(settings) !== JSON.stringify(original) ||
    JSON.stringify(policy) !== JSON.stringify(originalPolicy) ||
    JSON.stringify(sellingPolicy) !== JSON.stringify(originalSellingPolicy);

  const onToggleAllowDirect = (next: boolean) => {
    setPendingAllowDirect(next);
    setShowAllowDirectConfirm(true);
  };

  const confirmToggleAllowDirect = async () => {
    if (pendingAllowDirect === null || !settings) return;
    update('allowPosDirectSales', pendingAllowDirect);
    setShowAllowDirectConfirm(false);
  };

  const onSave = async () => {
    if (!settings) return;
    try {
      setSaving(true);
      await posApi.updateSettings(settings);
      if (policy) {
        await posApi.updatePolicy({
          cashierRolePolicies: policy.cashierRolePolicies.map((p) => ({
            ...p,
            maxLineDiscountPercent: p.maxLineDiscountPercent === undefined ? undefined : Number(p.maxLineDiscountPercent),
            maxLineDiscountAmount: p.maxLineDiscountAmount === undefined ? undefined : Number(p.maxLineDiscountAmount),
          })),
        });
      }
      if (sellingPolicy && JSON.stringify(sellingPolicy) !== JSON.stringify(originalSellingPolicy)) {
        const savedSellingPolicy = await posApi.updateSellingPolicy({
          belowCostMode: sellingPolicy.belowCostMode,
          minMarginPercent: sellingPolicy.minMarginPercent,
          allowManagerOverride: sellingPolicy.allowManagerOverride,
        });
        setSellingPolicy(savedSellingPolicy);
        setOriginalSellingPolicy(savedSellingPolicy);
      }
      const [next, nextPolicy] = await Promise.all([loadSettings(), posApi.getPolicy().catch(() => policy)]);
      setSettings(next);
      setOriginal(next);
      const normalizedPolicy = normalizePolicy(nextPolicy || null, next.companyId);
      setPolicy(normalizedPolicy);
      setOriginalPolicy(normalizedPolicy);
      toast.success(t('pos:settings.saved', { defaultValue: 'POS settings saved and reloaded.' }));
    } catch (err: any) {
      console.error('Failed to save POS settings', err);
      const msg = err?.response?.data?.error?.message || err?.message || 'Failed to save POS settings.';
      errorHandler.showError(msg);
    } finally {
      setSaving(false);
    }
  };

  const createProductLayout = async () => {
    const layout = await posApi.createProductShortcutLayout({
      name: newProductLayoutName || 'POS shortcuts',
      scopeType: 'COMPANY',
      isDefault: productLayouts.length === 0,
      isActive: true,
    });
    setProductLayouts((prev) => [...prev, layout]);
    setSelectedProductLayoutId(layout.id);
    toast.success(t('pos:settings.layouts.created', { defaultValue: 'Layout created.' }));
  };

  const createControlLayout = async () => {
    const layout = await posApi.createControlButtonLayout({
      name: newControlLayoutName || 'POS controls',
      scopeType: 'COMPANY',
      isDefault: controlLayouts.length === 0,
      isActive: true,
    });
    setControlLayouts((prev) => [...prev, layout]);
    setSelectedControlLayoutId(layout.id);
    toast.success(t('pos:settings.layouts.created', { defaultValue: 'Layout created.' }));
  };

  const saveProductNode = async () => {
    if (!selectedProductLayoutId || !newNode.label) return;
    const node = await posApi.createProductShortcutNode(selectedProductLayoutId, {
      ...newNode,
      sortOrder: Number(newNode.sortOrder) || 0,
      isActive: newNode.isActive !== false,
    });
    setProductNodes((prev) => [...prev, node]);
    setNewNode({ nodeType: 'GROUP', label: '', sortOrder: 0, isActive: true });
    toast.success(t('pos:settings.layouts.nodeCreated', { defaultValue: 'Shortcut node created.' }));
  };

  const saveControlButton = async () => {
    if (!selectedControlLayoutId || !newButton.commandCode) return;
    const definition = commands.find((cmd) => cmd.code === newButton.commandCode);
    const button = await posApi.createControlButton(selectedControlLayoutId, {
      ...newButton,
      label: newButton.label || definition?.defaultLabel || newButton.commandCode,
      requiredPermission: newButton.requiredPermission || definition?.requiredPermission,
      sortOrder: Number(newButton.sortOrder) || 0,
      isActive: newButton.isActive !== false,
      isVisible: newButton.isVisible !== false,
    });
    setControlButtons((prev) => [...prev, button]);
    setNewButton({ zone: 'BOTTOM_BAR', commandCode: 'CASH_PAYMENT', label: '', sortOrder: 0, isActive: true, isVisible: true });
    toast.success(t('pos:settings.layouts.buttonCreated', { defaultValue: 'Control button created.' }));
  };

  if (loading) {
    return <div className="p-6 text-sm text-slate-500">{t('common.loading', { defaultValue: 'Loading…' })}</div>;
  }
  if (!settings) {
    return <div className="p-6 text-sm text-rose-600">{t('pos:settings.loadError', { defaultValue: 'Failed to load POS settings.' })}</div>;
  }

  const tabs = [
    { id: 'general', label: t('pos:settings.general.title', { defaultValue: 'General' }), icon: Info },
    { id: 'payments', label: t('pos:settings.paymentMethods.title', { defaultValue: 'Payment Methods' }), icon: Shield },
    { id: 'overShort', label: t('pos:settings.overShort.title', { defaultValue: 'Cash Over/Short' }), icon: ShieldCheck },
    { id: 'cashierPolicies', label: t('pos:settings.cashierPolicies.title', { defaultValue: 'Cashier Policies' }), icon: UserCog },
    { id: 'controls', label: t('pos:settings.controls.title', { defaultValue: 'Controls' }), icon: ListChecks },
  ];

  return (
    <>
      <ModuleSettingsLayout
        title={t('pos:settings.title', { defaultValue: 'POS Settings' })}
        subtitle={t('pos:settings.subtitle', { defaultValue: 'Configure registers, payment methods, and the governance gate for direct sales.' })}
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        topActions={
          <button
            type="button"
            onClick={onSave}
            disabled={!hasChanges || saving}
            className="inline-flex items-center gap-2 rounded bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving
              ? t('common.saving', { defaultValue: 'Saving...' })
              : t('common.save', { defaultValue: 'Save' })}
          </button>
        }
        onSave={onSave}
        onDiscard={() => {
          setSettings(original);
          setPolicy(originalPolicy);
          setSellingPolicy(originalSellingPolicy);
        }}
        saving={saving}
        hasChanges={hasChanges}
      >
        {activeTab === 'general' && (
          <Card>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={settings.requireOpenShift}
                  onChange={(e) => update('requireOpenShift', e.target.checked)}
                  className="rounded border-slate-300"
                />
                <span>{t('pos:settings.requireOpenShift', { defaultValue: 'Require an open shift to sell' })}</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={settings.allowPosDirectSales}
                  onChange={(e) => onToggleAllowDirect(e.target.checked)}
                  className="rounded border-slate-300"
                />
                <span className="font-medium">
                  {t('pos:settings.allowPosDirectSales', { defaultValue: 'Allow POS direct sales' })}
                </span>
              </label>
              <div className="text-xs text-slate-500 md:col-span-2">
                {t('pos:settings.allowPosDirectSalesHelp', {
                  defaultValue:
                    'When enabled, the backend creates a form-scoped governance rule allowing the "direct" persona for formType "pos_sale" so cashiers can post direct Sales Invoices. Disabling it removes the rule.',
                })}
              </div>

              <label className="flex items-center gap-2 text-sm mt-4">
                <input
                  type="checkbox"
                  checked={settings.allowCreditSales}
                  onChange={(e) => update('allowCreditSales', e.target.checked)}
                  className="rounded border-slate-300"
                />
                <span className="font-medium">
                  {t('pos:settings.allowCreditSales', { defaultValue: 'Allow POS Credit Sales (Pay Later)' })}
                </span>
              </label>

              <label className="flex items-center gap-2 text-sm mt-4">
                <input
                  type="checkbox"
                  checked={settings.creditSaleManagerOverride}
                  onChange={(e) => update('creditSaleManagerOverride', e.target.checked)}
                  disabled={!settings.allowCreditSales}
                  className="rounded border-slate-300 disabled:opacity-50"
                />
                <span className={`font-medium ${!settings.allowCreditSales ? 'text-slate-400' : ''}`}>
                  {t('pos:settings.creditSaleManagerOverride', { defaultValue: 'Require Manager Override for Credit Sales' })}
                </span>
              </label>

              <div className="text-xs text-slate-500 md:col-span-2 mb-4">
                {t('pos:settings.allowCreditSalesHelp', {
                  defaultValue:
                    'When enabled, cashiers can complete a sale without payment by billing it to the selected customer\'s AR account. Walk-in customers cannot be used for credit sales.',
                })}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  {t('pos:settings.walkInCustomer', { defaultValue: 'Walk-in customer' })}
                </label>
                <PartySelector
                  role="CUSTOMER"
                  value={settings.walkInCustomerId}
                  onChange={(p) => update('walkInCustomerId', p?.id || '')}
                />
                <div className="text-xs text-slate-500 mt-1">
                  {t('pos:settings.walkInCustomerHelp', {
                    defaultValue: 'Default customer for receipts with no named party. Required when completing a sale.',
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  {t('pos:settings.receiptPrefix', { defaultValue: 'Receipt number prefix' })}
                </label>
                <input
                  type="text"
                  value={settings.receiptPrefix}
                  onChange={(e) => update('receiptPrefix', e.target.value.slice(0, 4))}
                  className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  {t('pos:settings.cashRounding', { defaultValue: 'Cash rounding' })}
                </label>
                <select
                  value={settings.cashRounding}
                  onChange={(e) => update('cashRounding', e.target.value as any)}
                  className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                >
                  <option value="none">{t('pos:settings.rounding.none', { defaultValue: 'None' })}</option>
                  <option value="nearest_05">{t('pos:settings.rounding.nearest_05', { defaultValue: 'Nearest 0.05' })}</option>
                  <option value="nearest_1">{t('pos:settings.rounding.nearest_1', { defaultValue: 'Nearest 1' })}</option>
                </select>
                <div className="text-xs text-slate-500 mt-1">
                  {t('pos:settings.cashRoundingHelp', { defaultValue: 'V1 reserves this field; "none" is applied at the till.' })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  {t('pos:settings.negativeStockPolicy', { defaultValue: 'Negative stock at the till' })}
                </label>
                <select
                  value={settings.negativeStockPolicy}
                  onChange={(e) => update('negativeStockPolicy', e.target.value as any)}
                  className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                >
                  <option value="BLOCK">{t('pos:settings.negativeStock.block', { defaultValue: 'Block — never sell below zero stock' })}</option>
                  <option value="ALLOW">{t('pos:settings.negativeStock.allow', { defaultValue: 'Allow — defer to company inventory setting' })}</option>
                </select>
                <div className="text-xs text-slate-500 mt-1">
                  {t('pos:settings.negativeStockPolicyHelp', {
                    defaultValue:
                      'Block keeps the till from overselling even when the company allows negative stock for back-office sales. Allow defers to the company inventory setting.',
                  })}
                </div>
              </div>

              {sellingPolicy && (
                <div className="md:col-span-2 rounded-lg border border-slate-200 bg-slate-50/60 p-4">
                  <div className="text-sm font-semibold text-slate-800">
                    {t('pos:settings.belowCost.title', { defaultValue: 'Below-cost selling policy' })}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5 mb-3">
                    {t('pos:settings.belowCost.subtitle', {
                      defaultValue:
                        'Company-wide rule for selling at or below cost. Shared with Sales — changing it here changes it everywhere.',
                    })}
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        {t('pos:settings.belowCost.mode', { defaultValue: 'When a line is below cost' })}
                      </label>
                      <select
                        value={sellingPolicy.belowCostMode}
                        onChange={(e) =>
                          setSellingPolicy((prev) =>
                            prev ? { ...prev, belowCostMode: e.target.value as SellingPolicyDTO['belowCostMode'] } : prev
                          )
                        }
                        className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                      >
                        <option value="BLOCK">{t('pos:settings.belowCost.block', { defaultValue: 'Block — never sell below cost' })}</option>
                        <option value="REQUIRE_APPROVAL">{t('pos:settings.belowCost.requireApproval', { defaultValue: 'Require approval — block until a manager approves' })}</option>
                        <option value="ALLOW">{t('pos:settings.belowCost.allow', { defaultValue: 'Allow — sell below cost freely' })}</option>
                      </select>
                      <label className="mt-3 flex items-start gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          className="mt-0.5 h-4 w-4 rounded border-slate-300"
                          checked={sellingPolicy.allowManagerOverride !== false}
                          disabled={sellingPolicy.belowCostMode === 'ALLOW'}
                          onChange={(e) =>
                            setSellingPolicy((prev) => (prev ? { ...prev, allowManagerOverride: e.target.checked } : prev))
                          }
                        />
                        <span className="text-xs text-slate-600">
                          {t('pos:settings.belowCost.allowOverride', {
                            defaultValue: 'Allow manager override (off = absolute block; even an approved override cannot pass).',
                          })}
                        </span>
                      </label>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        {t('pos:settings.belowCost.minMargin', { defaultValue: 'Minimum gross margin (%)' })}
                      </label>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        placeholder={t('pos:settings.belowCost.minMarginPlaceholder', { defaultValue: 'No minimum' })}
                        value={sellingPolicy.minMarginPercent ?? ''}
                        onChange={(e) =>
                          setSellingPolicy((prev) =>
                            prev
                              ? { ...prev, minMarginPercent: e.target.value === '' ? undefined : Number(e.target.value) }
                              : prev
                          )
                        }
                        className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                      />
                      <div className="text-xs text-slate-500 mt-1">
                        {t('pos:settings.belowCost.minMarginHelp', {
                          defaultValue:
                            'Optional. A line below this margin is treated like a below-cost line. Leave blank to only guard against selling below cost.',
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">
                  {t('pos:settings.defaultRevenueAccount', { defaultValue: 'Default revenue account' })}
                </label>
                <AccountSelector
                  value={settings.defaultRevenueAccountId}
                  onChange={(a) => update('defaultRevenueAccountId', a?.id || '')}
                  allowedClassifications={['REVENUE']}
                  contextLabel={t('pos:settings.defaultRevenueContext', { defaultValue: 'Revenue' })}
                  enforceClassification
                  enforceScope
                />
                <div className="text-xs text-slate-500 mt-1">
                  {t('pos:settings.defaultRevenueAccountHelp', {
                    defaultValue:
                      'Fallback revenue account for POS sales when an item (and its category) has none. Resolution order at the till: item → item category → this default.',
                  })}
                </div>
              </div>
            </div>
          </Card>
        )}

        {activeTab === 'payments' && (
          <Card>
            <div className="p-2">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 border-b">
                    <th className="py-2 px-2">{t('pos:settings.method.code', { defaultValue: 'Code' })}</th>
                    <th className="py-2 px-2">{t('pos:settings.method.label', { defaultValue: 'Label' })}</th>
                    <th className="py-2 px-2">{t('pos:settings.method.change', { defaultValue: 'Allows change' })}</th>
                    <th className="py-2 px-2">{t('pos:settings.method.reference', { defaultValue: 'Requires ref' })}</th>
                    <th className="py-2 px-2">{t('pos:settings.method.enabled', { defaultValue: 'Enabled' })}</th>
                  </tr>
                </thead>
                <tbody>
                  {settings.paymentMethods.map((m) => (
                    <tr key={m.code} className="border-b last:border-b-0">
                      <td className="py-2 px-2 font-mono text-xs">{m.code}</td>
                      <td className="py-2 px-2">
                        <input
                          type="text"
                          value={m.label || ''}
                          onChange={(e) => updateMethod(m.code, { label: e.target.value })}
                          className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                        />
                      </td>
                      <td className="py-2 px-2 text-center">
                        <input
                          type="checkbox"
                          checked={m.allowsChange}
                          onChange={(e) => updateMethod(m.code, { allowsChange: e.target.checked })}
                          className="rounded border-slate-300"
                          disabled={m.code !== 'CASH'}
                        />
                      </td>
                      <td className="py-2 px-2 text-center">
                        <input
                          type="checkbox"
                          checked={m.requiresReference}
                          onChange={(e) => updateMethod(m.code, { requiresReference: e.target.checked })}
                          className="rounded border-slate-300"
                        />
                      </td>
                      <td className="py-2 px-2 text-center">
                        <input
                          type="checkbox"
                          checked={m.isEnabled}
                          onChange={(e) => updateMethod(m.code, { isEnabled: e.target.checked })}
                          className="rounded border-slate-300"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {activeTab === 'overShort' && (
          <Card>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  {t('pos:settings.cashOver', { defaultValue: 'Cash over account' })}
                </label>
                <AccountSelector
                  value={settings.cashOverAccountId}
                  onChange={(a) => update('cashOverAccountId', a?.id || '')}
                  allowedClassifications={['REVENUE']}
                  contextLabel={t('pos:settings.cashOverContext', { defaultValue: 'Income' })}
                  enforceClassification
                  enforceScope
                />
                <div className="text-xs text-slate-500 mt-1">
                  {t('pos:settings.cashOverHelp', { defaultValue: 'Credit account for over-counts at shift close.' })}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  {t('pos:settings.cashShort', { defaultValue: 'Cash short account' })}
                </label>
                <AccountSelector
                  value={settings.cashShortAccountId}
                  onChange={(a) => update('cashShortAccountId', a?.id || '')}
                  allowedClassifications={['EXPENSE']}
                  contextLabel={t('pos:settings.cashShortContext', { defaultValue: 'Expense' })}
                  enforceClassification
                  enforceScope
                />
                <div className="text-xs text-slate-500 mt-1">
                  {t('pos:settings.cashShortHelp', { defaultValue: 'Debit account for short-counts at shift close. Required to close a shift that has a non-zero over/short.' })}
                </div>
              </div>
            </div>
          </Card>
        )}

        {activeTab === 'cashierPolicies' && (
          <Card>
            <div className="space-y-4 p-4">
              {roles.length === 0 ? (
                <div className="rounded border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  {t('pos:settings.cashierPolicies.noRoles', { defaultValue: 'No company roles loaded. Create roles first, then return here to configure POS cashier limits.' })}
                </div>
              ) : (
                roles.map((role) => {
                  const rolePolicy = policy?.cashierRolePolicies.find((p) => p.roleId === role.id) || {
                    roleId: role.id,
                    requireApprovalForDirectSales: false,
                    managerOverrideActions: [],
                    allowPriceOverride: true,
                    allowTaxOverride: true,
                  };
                  return (
                    <div key={role.id} className="rounded border border-slate-200 p-3">
                      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">{role.name}</div>
                          <div className="font-mono text-xs text-slate-500">{role.id}</div>
                        </div>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={rolePolicy.requireApprovalForDirectSales === true}
                            onChange={(e) => upsertRolePolicy(role.id, { requireApprovalForDirectSales: e.target.checked })}
                            className="rounded border-slate-300"
                          />
                          <span>{t('pos:settings.cashierPolicies.directApproval', { defaultValue: 'Approve direct sale' })}</span>
                        </label>
                      </div>

                      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                        <div className="rounded border border-slate-100 p-3">
                          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                            {t('pos:settings.cashierPolicies.overrideActions', { defaultValue: 'Manager approval actions' })}
                          </div>
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            {OVERRIDE_ACTIONS.map((action) => (
                              <label key={action} className="flex items-center gap-2 text-sm">
                                <input
                                  type="checkbox"
                                  checked={(rolePolicy.managerOverrideActions || []).includes(action)}
                                  onChange={(e) => toggleRoleAction(role.id, action, e.target.checked)}
                                  className="rounded border-slate-300"
                                />
                                <span>
                                  {t(`pos:managerOverride.actions.${action}`, {
                                    defaultValue: action.replace(/_/g, ' '),
                                  })}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>

                        <div className="rounded border border-slate-100 p-3">
                          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                            {t('pos:settings.cashierPolicies.saleLimits', { defaultValue: 'Sale-line limits' })}
                          </div>
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <label className="text-sm">
                              <span className="mb-1 block text-xs text-slate-500">{t('pos:settings.cashierPolicies.maxDiscountPercent', { defaultValue: 'Max discount %' })}</span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={rolePolicy.maxLineDiscountPercent ?? ''}
                                onChange={(e) => upsertRolePolicy(role.id, { maxLineDiscountPercent: e.target.value === '' ? undefined : Number(e.target.value) })}
                                className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                              />
                            </label>
                            <label className="text-sm">
                              <span className="mb-1 block text-xs text-slate-500">{t('pos:settings.cashierPolicies.maxDiscountAmount', { defaultValue: 'Max discount amount' })}</span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={rolePolicy.maxLineDiscountAmount ?? ''}
                                onChange={(e) => upsertRolePolicy(role.id, { maxLineDiscountAmount: e.target.value === '' ? undefined : Number(e.target.value) })}
                                className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                              />
                            </label>
                            <label className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={rolePolicy.allowPriceOverride !== false}
                                onChange={(e) => upsertRolePolicy(role.id, { allowPriceOverride: e.target.checked })}
                                className="rounded border-slate-300"
                              />
                              <span>{t('pos:settings.cashierPolicies.allowPriceOverride', { defaultValue: 'Allow price override' })}</span>
                            </label>
                            <label className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={rolePolicy.allowTaxOverride !== false}
                                onChange={(e) => upsertRolePolicy(role.id, { allowTaxOverride: e.target.checked })}
                                className="rounded border-slate-300"
                              />
                              <span>{t('pos:settings.cashierPolicies.allowTaxOverride', { defaultValue: 'Allow tax override' })}</span>
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        )}

        {activeTab === 'layouts' && (
          <div className="space-y-4">
            <Card>
              <div className="space-y-4 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-end">
                  <label className="flex-1 text-sm">
                    <span className="mb-1 block text-xs font-medium text-slate-500">
                      {t('pos:settings.layouts.productLayoutName', { defaultValue: 'New product shortcut layout' })}
                    </span>
                    <input
                      value={newProductLayoutName}
                      onChange={(e) => setNewProductLayoutName(e.target.value)}
                      className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                    />
                  </label>
                  <button type="button" onClick={createProductLayout} className="rounded bg-indigo-600 px-3 py-2 text-sm font-semibold text-white">
                    {t('common.create', { defaultValue: 'Create' })}
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">
                      {t('pos:settings.layouts.productLayouts', { defaultValue: 'Product shortcut layouts' })}
                    </label>
                    <select
                      value={selectedProductLayoutId}
                      onChange={(e) => setSelectedProductLayoutId(e.target.value)}
                      className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                    >
                      <option value="">{t('common.select', { defaultValue: 'Select' })}</option>
                      {productLayouts.map((layout) => (
                        <option key={layout.id} value={layout.id}>{layout.name} ({layout.scopeType})</option>
                      ))}
                    </select>
                  </div>
                  <label className="text-sm">
                    <span className="mb-1 block text-xs font-medium text-slate-500">{t('pos:settings.layouts.nodeType', { defaultValue: 'Node type' })}</span>
                    <select
                      value={newNode.nodeType || 'GROUP'}
                      onChange={(e) => setNewNode((prev) => ({ ...prev, nodeType: e.target.value as any, itemId: e.target.value === 'GROUP' ? '' : prev.itemId }))}
                      className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                    >
                      <option value="GROUP">{t('pos:settings.layouts.groupNode', { defaultValue: 'Group' })}</option>
                      <option value="ITEM">{t('pos:settings.layouts.itemNode', { defaultValue: 'Item' })}</option>
                    </select>
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block text-xs font-medium text-slate-500">{t('pos:settings.layouts.parent', { defaultValue: 'Parent group' })}</span>
                    <select
                      value={newNode.parentId || ''}
                      onChange={(e) => setNewNode((prev) => ({ ...prev, parentId: e.target.value || null }))}
                      className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                    >
                      <option value="">{t('pos:settings.layouts.root', { defaultValue: 'Root' })}</option>
                      {productNodes.filter((node) => node.nodeType === 'GROUP').map((node) => (
                        <option key={node.id} value={node.id}>{node.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block text-xs font-medium text-slate-500">{t('common.label', { defaultValue: 'Label' })}</span>
                    <input value={newNode.label || ''} onChange={(e) => setNewNode((prev) => ({ ...prev, label: e.target.value }))} className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
                  </label>
                  <div className="text-sm">
                    <span className="mb-1 block text-xs font-medium text-slate-500">{t('pos:settings.layouts.item', { defaultValue: 'Item' })}</span>
                    <ItemSelector
                      value={newNode.itemId || ''}
                      disabled={newNode.nodeType !== 'ITEM'}
                      placeholder={t('pos:settings.layouts.selectItem', { defaultValue: 'Select item...' })}
                      onChange={(item) => setNewNode((prev) => ({
                        ...prev,
                        itemId: item?.id || '',
                        label: prev.label || item?.name || '',
                      }))}
                    />
                  </div>
                  <label className="text-sm">
                    <span className="mb-1 block text-xs font-medium text-slate-500">{t('pos:settings.layouts.sortOrder', { defaultValue: 'Sort order' })}</span>
                    <input type="number" value={newNode.sortOrder ?? 0} onChange={(e) => setNewNode((prev) => ({ ...prev, sortOrder: Number(e.target.value) || 0 }))} className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
                  </label>
                  <button type="button" onClick={saveProductNode} disabled={!selectedProductLayoutId || !newNode.label || (newNode.nodeType === 'ITEM' && !newNode.itemId)} className="rounded bg-indigo-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
                    {t('pos:settings.layouts.addShortcut', { defaultValue: 'Add shortcut' })}
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs text-slate-500">
                        <th className="px-2 py-2">{t('pos:settings.layouts.type', { defaultValue: 'Type' })}</th>
                        <th className="px-2 py-2">{t('common.label', { defaultValue: 'Label' })}</th>
                        <th className="px-2 py-2">{t('pos:settings.layouts.item', { defaultValue: 'Item' })}</th>
                        <th className="px-2 py-2">{t('pos:settings.layouts.sort', { defaultValue: 'Sort' })}</th>
                        <th className="px-2 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {productNodes.map((node) => (
                        <tr key={node.id} className="border-b">
                          <td className="px-2 py-2 font-mono text-xs">{node.nodeType}</td>
                          <td className="px-2 py-2">{node.label}</td>
                          <td className="px-2 py-2 font-mono text-xs">{node.itemId || '-'}</td>
                          <td className="px-2 py-2">{node.sortOrder}</td>
                          <td className="px-2 py-2 text-right">
                            <button type="button" onClick={async () => { await posApi.deleteProductShortcutNode(node.id); setProductNodes((prev) => prev.filter((n) => n.id !== node.id)); }} className="text-xs font-semibold text-rose-600">
                              {t('common.delete', { defaultValue: 'Delete' })}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </Card>

            <Card>
              <div className="space-y-4 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-end">
                  <label className="flex-1 text-sm">
                    <span className="mb-1 block text-xs font-medium text-slate-500">
                      {t('pos:settings.layouts.controlLayoutName', { defaultValue: 'New control button layout' })}
                    </span>
                    <input
                      value={newControlLayoutName}
                      onChange={(e) => setNewControlLayoutName(e.target.value)}
                      className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                    />
                  </label>
                  <button type="button" onClick={createControlLayout} className="rounded bg-indigo-600 px-3 py-2 text-sm font-semibold text-white">
                    {t('common.create', { defaultValue: 'Create' })}
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
                  <label className="text-sm">
                    <span className="mb-1 block text-xs font-medium text-slate-500">{t('pos:settings.layouts.controlLayouts', { defaultValue: 'Control layouts' })}</span>
                    <select value={selectedControlLayoutId} onChange={(e) => setSelectedControlLayoutId(e.target.value)} className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm">
                      <option value="">{t('common.select', { defaultValue: 'Select' })}</option>
                      {controlLayouts.map((layout) => <option key={layout.id} value={layout.id}>{layout.name} ({layout.scopeType})</option>)}
                    </select>
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block text-xs font-medium text-slate-500">{t('pos:settings.layouts.command', { defaultValue: 'Command' })}</span>
                    <select
                      value={newButton.commandCode || 'CASH_PAYMENT'}
                      onChange={(e) => {
                        const cmd = commands.find((c) => c.code === e.target.value);
                        setNewButton((prev) => ({ ...prev, commandCode: e.target.value as any, label: cmd?.defaultLabel || prev.label, requiredPermission: cmd?.requiredPermission }));
                      }}
                      className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                    >
                      {commands.map((cmd) => <option key={cmd.code} value={cmd.code}>{cmd.code}</option>)}
                    </select>
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block text-xs font-medium text-slate-500">{t('pos:settings.layouts.zone', { defaultValue: 'Zone' })}</span>
                    <select value={newButton.zone || 'BOTTOM_BAR'} onChange={(e) => setNewButton((prev) => ({ ...prev, zone: e.target.value as any }))} className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm">
                      {['TOP_BAR', 'RIGHT_PANEL', 'CART_FOOTER', 'BOTTOM_BAR', 'MORE_MENU'].map((zone) => <option key={zone} value={zone}>{zone}</option>)}
                    </select>
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block text-xs font-medium text-slate-500">{t('common.label', { defaultValue: 'Label' })}</span>
                    <input value={newButton.label || ''} onChange={(e) => setNewButton((prev) => ({ ...prev, label: e.target.value }))} className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
                  </label>
                  <button type="button" onClick={saveControlButton} disabled={!selectedControlLayoutId} className="rounded bg-indigo-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
                    {t('pos:settings.layouts.addButton', { defaultValue: 'Add button' })}
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs text-slate-500">
                        <th className="px-2 py-2">{t('pos:settings.layouts.zone', { defaultValue: 'Zone' })}</th>
                        <th className="px-2 py-2">{t('pos:settings.layouts.command', { defaultValue: 'Command' })}</th>
                        <th className="px-2 py-2">{t('common.label', { defaultValue: 'Label' })}</th>
                        <th className="px-2 py-2">{t('pos:settings.layouts.permission', { defaultValue: 'Permission' })}</th>
                        <th className="px-2 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {controlButtons.map((button) => (
                        <tr key={button.id} className="border-b">
                          <td className="px-2 py-2 font-mono text-xs">{button.zone}</td>
                          <td className="px-2 py-2 font-mono text-xs">{button.commandCode}</td>
                          <td className="px-2 py-2">{button.label}</td>
                          <td className="px-2 py-2 font-mono text-xs">{button.requiredPermission || '-'}</td>
                          <td className="px-2 py-2 text-right">
                            <button type="button" onClick={async () => { await posApi.deleteControlButton(button.id); setControlButtons((prev) => prev.filter((b) => b.id !== button.id)); }} className="text-xs font-semibold text-rose-600">
                              {t('common.delete', { defaultValue: 'Delete' })}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'controls' && (
          <ModuleControlsTab
            module="pos"
            load={posApi.getPolicies}
            save={posApi.updatePolicies}
            knownActions={['directSale', 'return', 'reprint', 'priceOverride', 'discountOverride', 'taxOverride', 'voidLine', 'belowCostSale']}
          />
        )}
      </ModuleSettingsLayout>

      <ConfirmDialog
        isOpen={showAllowDirectConfirm}
        title={t('pos:settings.confirmAllowDirect.title', { defaultValue: 'Toggle POS direct sales?' })}
        message={t('pos:settings.confirmAllowDirect.body', {
          defaultValue: pendingAllowDirect
            ? 'This will insert a form-scoped governance rule that allows the "direct" persona for pos_sale invoices. Use it only when you intend to take real walk-in cash/card sales from the POS terminal.'
            : 'This will remove the form-scoped governance rule that allows the "direct" persona for pos_sale invoices. After this, the POS terminal cannot post direct cash sales and will be blocked by the backend.',
        })}
        tone="warning"
        onConfirm={confirmToggleAllowDirect}
        onCancel={() => setShowAllowDirectConfirm(false)}
        confirmLabel={t('common.confirm', { defaultValue: 'Confirm' })}
      />
    </>
  );
};

export default PosSettingsPage;
