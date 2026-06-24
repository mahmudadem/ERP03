/**
 * PosRegistersPage.tsx — Register CRUD for the POS module.
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { posApi, PosRegisterDTO } from '../../../api/posApi';
import { listUsers, CompanyUser } from '../../../api/companyAdmin';
import { inventoryApi, InventoryWarehouseDTO } from '../../../api/inventoryApi';
import { accountingApi, AccountDTO } from '../../../api/accountingApi';
import { Card } from '../../../components/ui/Card';
import { Modal } from '../../../components/ui/Modal';
import { OperationalListLayout } from '../../../components/shared/OperationalListLayout';
import { ColumnDefinition, RowAction } from '../../../components/ui/DataTable';
import { WarehouseSelector } from '../../../components/shared/selectors/WarehouseSelector';
import { AccountSelector } from '../../../modules/accounting/components/shared/AccountSelector';
import { errorHandler } from '../../../services/errorHandler';
import { useConfirm } from '../../../hooks/useConfirm';
import { PosKeyboardShortcutsDialog } from '../components/PosKeyboardShortcutsDialog';
import { Edit2, Power, PowerOff, X, ArrowRight, ArrowLeft, Keyboard } from 'lucide-react';

interface Props { isWindow?: boolean }

const unwrap = <T,>(p: any): T => (p?.data ?? p) as T;

const PosRegistersPage: React.FC<Props> = () => {
  const { t } = useTranslation();
  const [list, setList] = useState<PosRegisterDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<PosRegisterDTO> | null>(null);
  const [companyUsers, setCompanyUsers] = useState<CompanyUser[]>([]);
  const [warehouses, setWarehouses] = useState<InventoryWarehouseDTO[]>([]);
  const [accounts, setAccounts] = useState<AccountDTO[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showShortcutsDialog, setShowShortcutsDialog] = useState(false);
  const { confirm: confirmDialog } = useConfirm();

  const load = async () => {
    try {
      setLoading(true);
      const [result, usersResult, whResult, accResult] = await Promise.all([
        posApi.listRegisters(),
        listUsers().catch(() => [] as CompanyUser[]),
        inventoryApi.listWarehouses().catch(() => []),
        accountingApi.getAccounts().catch(() => []),
      ]);
      setList(unwrap<PosRegisterDTO[]>(result) || []);
      setCompanyUsers(usersResult || []);
      setWarehouses(unwrap<InventoryWarehouseDTO[]>(whResult) || []);
      setAccounts(unwrap<AccountDTO[]>(accResult) || []);
    } catch (err) {
      console.error('Failed to load registers', err);
      toast.error(t('pos:registers.loadError', { defaultValue: 'Failed to load POS registers.' }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const onNew = () => {
    setEditing({
      code: '',
      name: '',
      warehouseId: '',
      defaultPriceListId: '',
      allowedCashierUserIds: [],
      hardwareProfileId: '',
      cashDrawerAccountId: '',
      settlementAccountIds: {},
      status: 'ACTIVE',
      keyboardShortcuts: {},
    });
    setShowForm(true);
  };

  const onEdit = (row: PosRegisterDTO) => {
    setEditing({ ...row });
    setShowForm(true);
  };

  const onSave = async () => {
    if (!editing) return;
    if (!editing.code?.trim() || !editing.name?.trim() || !editing.warehouseId || !editing.cashDrawerAccountId) {
      toast.error(t('pos:registers.requiredFields', { defaultValue: 'Code, name, warehouse, and cash-drawer account are required.' }));
      return;
    }
    const payload = {
      ...editing,
      defaultPriceListId: editing.defaultPriceListId?.trim() || undefined,
      allowedCashierUserIds: editing.allowedCashierUserIds || [],
      hardwareProfileId: editing.hardwareProfileId?.trim() || undefined,
    };
    try {
      setSaving(true);
      if (editing.id) {
        await posApi.updateRegister(editing.id, payload);
        toast.success(t('pos:registers.updated', { defaultValue: 'Register updated.' }));
      } else {
        await posApi.createRegister(payload);
        toast.success(t('pos:registers.created', { defaultValue: 'Register created.' }));
      }
      setShowForm(false);
      setEditing(null);
      await load();
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.message || 'Failed to save register.';
      errorHandler.showError(msg);
    } finally {
      setSaving(false);
    }
  };

  const onToggleStatus = async (row: PosRegisterDTO) => {
    const next = row.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const ok = await confirmDialog({
      title: t('pos:registers.toggleStatus.title', { defaultValue: next === 'ACTIVE' ? 'Activate register?' : 'Deactivate register?' }),
      message: t('pos:registers.toggleStatus.body', {
        defaultValue: next === 'ACTIVE'
          ? `Activate register ${row.code}? Cashiers can open shifts on it again.`
          : `Deactivate register ${row.code}? It cannot be used for new shifts but already-open shifts remain open.`,
      }),
      tone: next === 'ACTIVE' ? 'info' : 'warning',
    });
    if (!ok) return;
    try {
      await posApi.updateRegister(row.id, { status: next });
      toast.success(t('pos:registers.statusUpdated', { defaultValue: 'Register status updated.' }));
      await load();
    } catch (err: any) {
      errorHandler.showError(err?.response?.data?.error?.message || err?.message || 'Failed to update status.');
    }
  };

  const columns: ColumnDefinition<PosRegisterDTO>[] = [
    { key: 'code', label: t('pos:registers.col.code', { defaultValue: 'Code' }), width: '120px', priority: 1, accessor: (r) => r.code },
    { key: 'name', label: t('pos:registers.col.name', { defaultValue: 'Name' }), width: '180px', priority: 1, accessor: (r) => r.name },
    { key: 'branchId', label: t('pos:registers.col.branch', { defaultValue: 'Branch' }), width: '120px', priority: 2, accessor: (r) => r.branchId || '—' },
    { key: 'warehouseId', label: t('pos:registers.col.warehouse', { defaultValue: 'Warehouse' }), width: '180px', priority: 2, accessor: (r) => {
      const wh = warehouses.find(w => w.id === r.warehouseId);
      return wh ? wh.name : r.warehouseId;
    } },
    { key: 'defaultPriceListId', label: t('pos:registers.col.priceList', { defaultValue: 'Price list' }), width: '150px', priority: 3, accessor: (r) => r.defaultPriceListId || '—' },
    { key: 'allowedCashierUserIds', label: t('pos:registers.col.cashiers', { defaultValue: 'Cashiers' }), width: '100px', priority: 3, accessor: (r) => r.allowedCashierUserIds?.length || t('common.all', { defaultValue: 'All' }) },
    { key: 'hardwareProfileId', label: t('pos:registers.col.hardware', { defaultValue: 'Hardware' }), width: '130px', priority: 3, accessor: (r) => r.hardwareProfileId || '—' },
    { key: 'cashDrawerAccountId', label: t('pos:registers.col.cashAccount', { defaultValue: 'Cash account' }), width: '180px', priority: 2, accessor: (r) => {
      const acc = accounts.find(a => a.id === r.cashDrawerAccountId);
      return acc ? `${acc.code} - ${acc.name}` : r.cashDrawerAccountId;
    } },
    {
      key: 'settlementAccountIds',
      label: t('pos:registers.col.settlementAccounts', { defaultValue: 'Non-cash accounts' }),
      width: '180px',
      priority: 3,
      accessor: (r) => {
        const accounts = r.settlementAccountIds || {};
        return ['CARD', 'BANK_TRANSFER', 'CUSTOM'].filter((method) => !!accounts[method as keyof typeof accounts]).length;
      },
    },
    {
      key: 'status', label: t('pos:registers.col.status', { defaultValue: 'Status' }), width: '100px', priority: 1,
      render: (_v, r) => (
        <span className={`px-2 py-0.5 rounded text-xs ${r.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
          {r.status}
        </span>
      ),
    },
  ];

  const rowActions: RowAction<PosRegisterDTO>[] = [
    { key: 'edit', label: t('common.edit', { defaultValue: 'Edit' }), icon: Edit2, onClick: onEdit, primary: true },
    { key: 'toggle', label: t('pos:registers.toggleStatus.title', { defaultValue: 'Toggle status' }), icon: Power, onClick: onToggleStatus },
  ];



  const isRtl = document.documentElement.dir === 'rtl';

  return showForm && editing ? (
    <div className="p-6 max-w-4xl mx-auto space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setShowForm(false); setEditing(null); }}
            className="p-2 -ml-2 rounded-full hover:bg-slate-100 text-slate-500 transition-colors"
          >
            {isRtl ? <ArrowRight size={20} /> : <ArrowLeft size={20} />}
          </button>
          <h2 className="text-2xl font-bold text-slate-800">
            {editing.id ? t('pos:registers.editTitle', { defaultValue: 'Edit Register' }) : t('pos:registers.newTitle', { defaultValue: 'New Register' })}
          </h2>
        </div>
      </div>
      
      <Card className="p-6">
        {editing && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">{t('pos:registers.col.code', { defaultValue: 'Code' })} *</label>
                <input
                  type="text"
                  value={editing.code || ''}
                  onChange={(e) => setEditing({ ...editing, code: e.target.value })}
                  className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('pos:registers.col.name', { defaultValue: 'Name' })} *</label>
                <input
                  type="text"
                  value={editing.name || ''}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('pos:registers.col.branch', { defaultValue: 'Branch' })}</label>
                <input
                  type="text"
                  value={editing.branchId || ''}
                  onChange={(e) => setEditing({ ...editing, branchId: e.target.value || undefined })}
                  className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                />
                <div className="text-xs text-slate-500 mt-1">
                  {t('pos:registers.branchHelp', { defaultValue: 'Free-text branch id. The ERP has no first-class Branch entity yet.' })}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('pos:registers.col.warehouse', { defaultValue: 'Warehouse' })} *</label>
                <WarehouseSelector
                  value={editing.warehouseId}
                  onChange={(w) => setEditing({ ...editing, warehouseId: w?.id || '' })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('pos:registers.col.priceList', { defaultValue: 'Default price list' })}</label>
                <input
                  type="text"
                  value={editing.defaultPriceListId || ''}
                  onChange={(e) => setEditing({ ...editing, defaultPriceListId: e.target.value || undefined })}
                  className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                />
                <div className="text-xs text-slate-500 mt-1">
                  {t('pos:registers.priceListHelp', { defaultValue: 'Placeholder for terminal-specific price-list selection. Leave blank to use normal POS pricing.' })}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('pos:registers.col.hardware', { defaultValue: 'Hardware profile' })}</label>
                <input
                  type="text"
                  value={editing.hardwareProfileId || ''}
                  onChange={(e) => setEditing({ ...editing, hardwareProfileId: e.target.value || undefined })}
                  className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                />
                <div className="text-xs text-slate-500 mt-1">
                  {t('pos:registers.hardwareHelp', { defaultValue: 'Placeholder for receipt printer, cash drawer, scanner, and customer display mapping.' })}
                </div>
              </div>
              <div className="md:col-span-2 rounded border border-slate-200 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-medium">{t('pos:registers.allowedCashiers', { defaultValue: 'Allowed cashiers' })}</label>
                  <button
                    type="button"
                    onClick={() => setEditing({ ...editing, allowedCashierUserIds: [] })}
                    className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
                  >
                    {t('pos:registers.allowAllCashiers', { defaultValue: 'Allow all' })}
                  </button>
                </div>
                <div className="max-h-40 space-y-2 overflow-y-auto">
                  {companyUsers.length === 0 ? (
                    <div className="text-xs text-slate-500">
                      {t('pos:registers.noUsersLoaded', { defaultValue: 'No company users loaded. Leave blank to allow all cashiers.' })}
                    </div>
                  ) : (
                    companyUsers.map((u) => {
                      const checked = (editing.allowedCashierUserIds || []).includes(u.userId);
                      return (
                        <label key={u.userId} className="flex items-center justify-start gap-2 text-sm text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(event) => {
                              const current = editing.allowedCashierUserIds || [];
                              setEditing({
                                ...editing,
                                allowedCashierUserIds: event.target.checked
                                  ? Array.from(new Set([...current, u.userId]))
                                  : current.filter((id) => id !== u.userId),
                              });
                            }}
                          />
                          <span className="truncate" dir="ltr">{u.email || u.userId}</span>
                          {u.roleName ? <span className="text-xs text-slate-400">{t(`common.${u.roleName.toLowerCase()}`, { defaultValue: u.roleName })}</span> : null}
                        </label>
                      );
                    })
                  )}
                </div>
                <div className="text-xs text-slate-500 mt-2">
                  {t('pos:registers.allowedCashiersHelp', { defaultValue: 'When no users are selected, any cashier with POS access can open a shift on this register.' })}
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">{t('pos:registers.col.cashAccount', { defaultValue: 'Cash-drawer account' })} *</label>
                <AccountSelector
                  value={editing.cashDrawerAccountId}
                  onChange={(a) => setEditing({ ...editing, cashDrawerAccountId: a?.id || '' })}
                  allowedClassifications={['ASSET']}
                  contextLabel={t('pos:registers.cashAccountContext', { defaultValue: 'Cash/Bank asset' })}
                  enforceClassification
                  enforceScope
                />
                <div className="text-xs text-slate-500 mt-1">
                  {t('pos:registers.cashDrawerHelp', { defaultValue: 'Used for all CASH sales, cash refunds, cash movements, and over/short close entries for this register.' })}
                </div>
              </div>

              {(['CARD', 'BANK_TRANSFER', 'CUSTOM'] as const).map((method) => (
                <div key={method} className="md:col-span-2">
                  <label className="block text-sm font-medium mb-1">
                    {t(`pos:registers.settlement.${method}`, { defaultValue: `${method} settlement account` })}
                  </label>
                  <AccountSelector
                    value={editing.settlementAccountIds?.[method] || ''}
                    onChange={(a) =>
                      setEditing({
                        ...editing,
                        settlementAccountIds: {
                          ...(editing.settlementAccountIds || {}),
                          [method]: a?.id || '',
                        },
                      })
                    }
                    allowedClassifications={['ASSET']}
                    contextLabel={t('pos:registers.cashAccountContext', { defaultValue: 'Cash/Bank asset' })}
                    enforceClassification
                    enforceScope
                  />
                  <div className="text-xs text-slate-500 mt-1">
                    {t('pos:registers.nonCashSettlementHelp', { defaultValue: 'Used when this register accepts this non-cash method. Leave blank only if the method is not used at this register.' })}
                  </div>
                </div>
              ))}

              <div className="md:col-span-2 border-t border-slate-100 pt-4 mt-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-slate-800">{t('pos:registers.shortcuts.title', { defaultValue: 'Keyboard Shortcuts' })}</h3>
                    <p className="text-xs text-slate-500 mt-1">
                      {t('pos:registers.shortcuts.help', { defaultValue: 'Override default keyboard shortcuts for this specific register.' })}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowShortcutsDialog(true)}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                  >
                    <Keyboard className="w-4 h-4" />
                    {t('pos:registers.shortcuts.configure', { defaultValue: 'Configure' })}
                  </button>
                </div>
                {editing.keyboardShortcuts && Object.keys(editing.keyboardShortcuts).length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {Object.entries(editing.keyboardShortcuts).map(([action, key]) => (
                      <span key={action} className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-slate-100 text-xs font-medium text-slate-600">
                        <span className="text-slate-400">{action}:</span>
                        <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200">{key as string}</kbd>
                      </span>
                    ))}
                  </div>
                )}
              </div>

            </div>
            <div className="flex justify-end gap-2 pt-6 mt-6 border-t border-slate-100">
              <button
                onClick={() => { setShowForm(false); setEditing(null); }}
                className="px-4 py-2 rounded border border-slate-300 text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                {t('common.cancel', { defaultValue: 'Cancel' })}
              </button>
              <button
                onClick={onSave}
                disabled={saving}
                className="px-4 py-2 rounded bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                {saving ? t('common.saving', { defaultValue: 'Saving…' }) : t('common.save', { defaultValue: 'Save' })}
              </button>
            </div>
          </div>
        )}
      </Card>
      
      {editing && (
        <PosKeyboardShortcutsDialog
          isOpen={showShortcutsDialog}
          onClose={() => setShowShortcutsDialog(false)}
          initialShortcuts={editing.keyboardShortcuts || {}}
          onSave={(shortcuts) => setEditing({ ...editing, keyboardShortcuts: shortcuts })}
          title={t('pos:registers.shortcuts.dialogTitle', { defaultValue: 'Register Shortcuts' })}
          subtitle={t('pos:registers.shortcuts.dialogSubtitle', { defaultValue: 'These shortcuts will apply to any cashier using this register, overriding global defaults.' })}
        />
      )}
    </div>
  ) : (
    <div className="p-6">
      <OperationalListLayout<PosRegisterDTO>
        title={t('pos:registers.title', { defaultValue: 'POS Registers' })}
        subtitle={t('pos:registers.subtitle', { defaultValue: 'Tills. Each register is tied to a warehouse and a cash-drawer account.' })}
        newButtonLabel={t('pos:registers.new', { defaultValue: 'New Register' })}
        onNewClick={onNew}
        onRefresh={load}
        data={list}
        columns={columns}
        loading={loading}
        idKey="id"
        emptyMessage={t('pos:registers.empty', { defaultValue: 'No registers yet. Create one to start selling.' })}
        rowActions={rowActions}
      />
    </div>
  );
};

export default PosRegistersPage;
