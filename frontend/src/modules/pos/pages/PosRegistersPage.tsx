/**
 * PosRegistersPage.tsx — Register CRUD for the POS module.
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { posApi, PosRegisterDTO } from '../../../api/posApi';
import { Card } from '../../../components/ui/Card';
import { Modal } from '../../../components/ui/Modal';
import { OperationalListLayout } from '../../../components/shared/OperationalListLayout';
import { ColumnDefinition, RowAction } from '../../../components/ui/DataTable';
import { WarehouseSelector } from '../../../components/shared/selectors/WarehouseSelector';
import { AccountSelector } from '../../../modules/accounting/components/shared/AccountSelector';
import { errorHandler } from '../../../services/errorHandler';
import { useConfirm } from '../../../hooks/useConfirm';
import { Edit2, Power, PowerOff } from 'lucide-react';

interface Props { isWindow?: boolean }

const unwrap = <T,>(p: any): T => (p?.data ?? p) as T;

const PosRegistersPage: React.FC<Props> = () => {
  const { t } = useTranslation();
  const [list, setList] = useState<PosRegisterDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<PosRegisterDTO> | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const { confirm: confirmDialog } = useConfirm();

  const load = async () => {
    try {
      setLoading(true);
      const result = await posApi.listRegisters();
      setList(unwrap<PosRegisterDTO[]>(result) || []);
    } catch (err) {
      console.error('Failed to load registers', err);
      toast.error(t('pos.registers.loadError', { defaultValue: 'Failed to load POS registers.' }));
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
      cashDrawerAccountId: '',
      status: 'ACTIVE',
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
      toast.error(t('pos.registers.requiredFields', { defaultValue: 'Code, name, warehouse, and cash-drawer account are required.' }));
      return;
    }
    try {
      setSaving(true);
      if (editing.id) {
        await posApi.updateRegister(editing.id, editing);
        toast.success(t('pos.registers.updated', { defaultValue: 'Register updated.' }));
      } else {
        await posApi.createRegister(editing);
        toast.success(t('pos.registers.created', { defaultValue: 'Register created.' }));
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
      title: t('pos.registers.toggleStatus.title', { defaultValue: next === 'ACTIVE' ? 'Activate register?' : 'Deactivate register?' }),
      message: t('pos.registers.toggleStatus.body', {
        defaultValue: next === 'ACTIVE'
          ? `Activate register ${row.code}? Cashiers can open shifts on it again.`
          : `Deactivate register ${row.code}? It cannot be used for new shifts but already-open shifts remain open.`,
      }),
      tone: next === 'ACTIVE' ? 'info' : 'warning',
    });
    if (!ok) return;
    try {
      await posApi.updateRegister(row.id, { status: next });
      toast.success(t('pos.registers.statusUpdated', { defaultValue: 'Register status updated.' }));
      await load();
    } catch (err: any) {
      errorHandler.showError(err?.response?.data?.error?.message || err?.message || 'Failed to update status.');
    }
  };

  const columns: ColumnDefinition<PosRegisterDTO>[] = [
    { key: 'code', label: t('pos.registers.col.code', { defaultValue: 'Code' }), width: '120px', priority: 1, accessor: (r) => r.code },
    { key: 'name', label: t('pos.registers.col.name', { defaultValue: 'Name' }), width: '180px', priority: 1, accessor: (r) => r.name },
    { key: 'branchId', label: t('pos.registers.col.branch', { defaultValue: 'Branch' }), width: '120px', priority: 2, accessor: (r) => r.branchId || '—' },
    { key: 'warehouseId', label: t('pos.registers.col.warehouse', { defaultValue: 'Warehouse' }), width: '180px', priority: 2, accessor: (r) => r.warehouseId },
    { key: 'cashDrawerAccountId', label: t('pos.registers.col.cashAccount', { defaultValue: 'Cash account' }), width: '180px', priority: 2, accessor: (r) => r.cashDrawerAccountId },
    {
      key: 'status', label: t('pos.registers.col.status', { defaultValue: 'Status' }), width: '100px', priority: 1,
      render: (_v, r) => (
        <span className={`px-2 py-0.5 rounded text-xs ${r.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
          {r.status}
        </span>
      ),
    },
  ];

  const rowActions: RowAction<PosRegisterDTO>[] = [
    { key: 'edit', label: t('common.edit', { defaultValue: 'Edit' }), icon: Edit2, onClick: onEdit, primary: true },
    { key: 'toggle', label: t('pos.registers.toggleStatus.title', { defaultValue: 'Toggle status' }), icon: Power, onClick: onToggleStatus },
  ];

  return (
    <div className="p-6">
      <OperationalListLayout<PosRegisterDTO>
        title={t('pos.registers.title', { defaultValue: 'POS Registers' })}
        subtitle={t('pos.registers.subtitle', { defaultValue: 'Tills. Each register is tied to a warehouse and a cash-drawer account.' })}
        newButtonLabel={t('pos.registers.new', { defaultValue: 'New Register' })}
        onNewClick={onNew}
        onRefresh={load}
        data={list}
        columns={columns}
        loading={loading}
        idKey="id"
        emptyMessage={t('pos.registers.empty', { defaultValue: 'No registers yet. Create one to start selling.' })}
        rowActions={rowActions}
      />

      <Modal
        isOpen={showForm}
        onClose={() => { setShowForm(false); setEditing(null); }}
        title={editing?.id ? t('pos.registers.editTitle', { defaultValue: 'Edit Register' }) : t('pos.registers.newTitle', { defaultValue: 'New Register' })}
      >
        {editing && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">{t('pos.registers.col.code', { defaultValue: 'Code' })} *</label>
                <input
                  type="text"
                  value={editing.code || ''}
                  onChange={(e) => setEditing({ ...editing, code: e.target.value })}
                  className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('pos.registers.col.name', { defaultValue: 'Name' })} *</label>
                <input
                  type="text"
                  value={editing.name || ''}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('pos.registers.col.branch', { defaultValue: 'Branch' })}</label>
                <input
                  type="text"
                  value={editing.branchId || ''}
                  onChange={(e) => setEditing({ ...editing, branchId: e.target.value || undefined })}
                  className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                />
                <div className="text-xs text-slate-500 mt-1">
                  {t('pos.registers.branchHelp', { defaultValue: 'Free-text branch id. The ERP has no first-class Branch entity yet.' })}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('pos.registers.col.warehouse', { defaultValue: 'Warehouse' })} *</label>
                <WarehouseSelector
                  value={editing.warehouseId}
                  onChange={(w) => setEditing({ ...editing, warehouseId: w?.id || '' })}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">{t('pos.registers.col.cashAccount', { defaultValue: 'Cash-drawer account' })} *</label>
                <AccountSelector
                  value={editing.cashDrawerAccountId}
                  onChange={(a) => setEditing({ ...editing, cashDrawerAccountId: a?.id || '' })}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => { setShowForm(false); setEditing(null); }}
                className="px-3 py-1.5 rounded border border-slate-300 text-sm"
              >
                {t('common.cancel', { defaultValue: 'Cancel' })}
              </button>
              <button
                onClick={onSave}
                disabled={saving}
                className="px-3 py-1.5 rounded bg-indigo-600 text-white text-sm disabled:opacity-50"
              >
                {saving ? t('common.saving', { defaultValue: 'Saving…' }) : t('common.save', { defaultValue: 'Save' })}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default PosRegistersPage;
