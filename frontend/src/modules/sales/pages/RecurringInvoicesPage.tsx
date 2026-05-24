import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { Card } from '../../../components/ui/Card';
import {
  RecurringInvoiceTemplateDTO,
  RecurringInvoiceStatus,
  RecurrenceFrequency,
  recurringInvoiceApi,
} from '../../../api/salesApi';
import { Plus, Repeat, Search, Pause, Play, X, Calendar, Trash2 } from 'lucide-react';
import { clsx } from 'clsx';
import { PartySelector, ItemSelector } from '../../../components/shared/selectors';
import { DatePicker } from '../../accounting/components/shared/DatePicker';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';

const STATUS_STYLES: Record<RecurringInvoiceStatus, string> = {
  ACTIVE: 'border-green-200 text-green-600 bg-green-50',
  PAUSED: 'border-amber-200 text-amber-600 bg-amber-50',
  COMPLETED: 'border-slate-200 text-slate-500 bg-slate-50',
  CANCELLED: 'border-red-200 text-red-600 bg-red-50',
};

const WEEKDAY_OPTIONS = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

const StatusBadge: React.FC<{ status: RecurringInvoiceStatus }> = ({ status }) => (
  <span
    className={clsx(
      'text-[9px] font-black px-2 py-0.5 rounded-full border tracking-widest uppercase',
      STATUS_STYLES[status] ?? 'border-slate-200 text-slate-400 bg-slate-50'
    )}
  >
    {status}
  </span>
);

// ─── Create Modal ─────────────────────────────────────────────────────────────

interface CreateModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const CreateRecurringInvoiceModal: React.FC<CreateModalProps> = ({ onClose, onSuccess }) => {
  const { t } = useTranslation('common');
  const [name, setName] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [frequency, setFrequency] = useState<RecurrenceFrequency>('MONTHLY');
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState('');
  const [maxOccurrences, setMaxOccurrences] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState([{ itemId: '', itemCode: '', itemName: '', qty: 1, unitPriceDoc: 0, taxRate: 0 }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!name || !customerId || !startDate) {
      setError(t('sales.recurring.validation.requiredTop', 'Name, Customer ID, and Start Date are required'));
      return;
    }
    if (lines.some((l) => !l.itemId)) {
      setError(t('sales.recurring.validation.lineItemRequired', 'Every invoice line must have an item selected'));
      return;
    }
    try {
      setSaving(true);
      await recurringInvoiceApi.create({
        name,
        customerId,
        customerName,
        currency,
        lines,
        notes: notes || undefined,
        frequency,
        dayOfMonth: frequency !== 'WEEKLY' ? dayOfMonth : undefined,
        dayOfWeek: frequency === 'WEEKLY' ? dayOfWeek : undefined,
        startDate,
        endDate: endDate || undefined,
        maxOccurrences: maxOccurrences ? parseInt(maxOccurrences, 10) : undefined,
      });
      onSuccess();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? t('sales.recurring.errors.create', 'Failed to create template'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            {t('sales.recurring.newTemplate', 'New Recurring Invoice')}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
              {t('sales.recurring.fields.templateName', 'Template Name *')}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800"
              placeholder={t('sales.recurring.placeholders.templateName', 'e.g., Monthly Retainer - Client X')}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
              {t('sales.recurring.fields.customer', 'Customer *')}
            </label>
            <PartySelector
              role="CUSTOMER"
              value={customerId}
              onChange={(party) => {
                if (party) {
                  setCustomerId(party.id);
                  setCustomerName(party.displayName);
                  if (!currency && party.defaultCurrency) {
                    setCurrency(party.defaultCurrency);
                  }
                } else {
                  setCustomerId('');
                  setCustomerName('');
                }
              }}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                {t('sales.recurring.fields.frequency', 'Frequency *')}
              </label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as RecurrenceFrequency)}
                className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800"
              >
                <option value="WEEKLY">{t('sales.recurring.frequency.weekly', 'Weekly')}</option>
                <option value="MONTHLY">{t('sales.recurring.frequency.monthly', 'Monthly')}</option>
                <option value="QUARTERLY">{t('sales.recurring.frequency.quarterly', 'Quarterly')}</option>
                <option value="ANNUALLY">{t('sales.recurring.frequency.annually', 'Annually')}</option>
              </select>
            </div>
            {frequency === 'WEEKLY' && (
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                  {t('sales.recurring.fields.dayOfWeek', 'Day of Week')}
                </label>
                <select
                  value={dayOfWeek}
                  onChange={(e) => setDayOfWeek(parseInt(e.target.value, 10))}
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800"
                >
                  {WEEKDAY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {t(`sales.recurring.weekdays.${opt.label.toLowerCase()}`, opt.label)}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {frequency !== 'WEEKLY' && (
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                  {t('sales.recurring.fields.dayOfMonth', 'Day of Month')}
                </label>
                <input
                  type="number"
                  min={1}
                  max={28}
                  value={dayOfMonth}
                  onChange={(e) => setDayOfMonth(parseInt(e.target.value, 10))}
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800"
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                {t('sales.recurring.fields.startDate', 'Start Date *')}
              </label>
              <DatePicker value={startDate} onChange={setStartDate} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                {t('sales.recurring.fields.endDate', 'End Date')}
              </label>
              <DatePicker value={endDate} onChange={setEndDate} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                {t('sales.recurring.fields.maxOccurrences', 'Max Occurrences')}
              </label>
              <input
                type="number"
                min={1}
                value={maxOccurrences}
                onChange={(e) => setMaxOccurrences(e.target.value)}
                className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800"
                placeholder={t('sales.recurring.placeholders.maxOccurrences', 'Leave empty for unlimited')}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
              {t('sales.recurring.fields.notes', 'Notes')}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800"
              rows={2}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
              {t('sales.recurring.fields.invoiceLines', 'Invoice Lines')}
            </label>
            <div className="space-y-2">
              {lines.map((line, i) => (
                <div key={i} className="flex gap-2">
                  <div className="flex-1">
                    <ItemSelector
                      value={line.itemId}
                      onChange={(item) => setLines(lines.map((l, j) => j === i ? {
                        ...l,
                        itemId: item?.id || '',
                        itemCode: item?.code || '',
                        itemName: item?.name || '',
                      } : l))}
                    />
                  </div>
                  <input
                    type="number"
                    value={line.qty}
                    onChange={(e) => setLines(lines.map((l, j) => j === i ? { ...l, qty: parseFloat(e.target.value) || 0 } : l))}
                    className="w-16 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800"
                    placeholder={t('sales.recurring.placeholders.qty', 'Qty')}
                  />
                  <input
                    type="number"
                    value={line.unitPriceDoc}
                    onChange={(e) => setLines(lines.map((l, j) => j === i ? { ...l, unitPriceDoc: parseFloat(e.target.value) || 0 } : l))}
                    className="w-24 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800"
                    placeholder={t('sales.recurring.placeholders.price', 'Price')}
                  />
                </div>
              ))}
              <button
                onClick={() => setLines([...lines, { itemId: '', itemCode: '', itemName: '', qty: 1, unitPriceDoc: 0, taxRate: 0 }])}
                className="text-xs text-blue-600 hover:text-blue-700 font-bold"
              >
                + {t('sales.recurring.actions.addLine', 'Add Line')}
              </button>
            </div>
          </div>
        </div>

        <div className="p-6 border-t dark:border-slate-800 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
          >
            {t('common.cancel', 'Cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
          >
            {saving
              ? t('sales.recurring.actions.creatingTemplate', 'Creating...')
              : t('sales.recurring.actions.createTemplate', 'Create Template')}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────

const RecurringInvoicesPage: React.FC = () => {
  const { t } = useTranslation('common');
  const [templates, setTemplates] = useState<RecurringInvoiceTemplateDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [pendingAction, setPendingAction] = useState<{ id: string; action: 'pause' | 'resume' | 'cancel' | 'delete'; templateName?: string } | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const getFrequencyLabel = (frequency: RecurrenceFrequency): string => {
    if (frequency === 'WEEKLY') return t('sales.recurring.frequency.weekly', 'Weekly');
    if (frequency === 'MONTHLY') return t('sales.recurring.frequency.monthly', 'Monthly');
    if (frequency === 'QUARTERLY') return t('sales.recurring.frequency.quarterly', 'Quarterly');
    return t('sales.recurring.frequency.annually', 'Annually');
  };

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const opts: any = {};
      if (statusFilter) opts.status = statusFilter;
      const result = await recurringInvoiceApi.list(opts);
      setTemplates(Array.isArray(result) ? result : []);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? t('sales.recurring.errors.load', 'Failed to load recurring invoices'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [statusFilter]);

  const requestAction = (id: string, action: 'pause' | 'resume' | 'cancel' | 'delete', templateName?: string) => {
    setPendingAction({ id, action, templateName });
  };

  const confirmAction = async () => {
    if (!pendingAction) return;
    const { id, action } = pendingAction;
    setActionBusy(true);
    try {
      if (action === 'pause') {
        await recurringInvoiceApi.pause(id);
        toast.success(t('sales.recurring.toast.paused', 'Template paused'));
      } else if (action === 'resume') {
        await recurringInvoiceApi.resume(id);
        toast.success(t('sales.recurring.toast.resumed', 'Template resumed'));
      } else if (action === 'cancel') {
        await recurringInvoiceApi.cancel(id);
        toast.success(t('sales.recurring.toast.cancelled', 'Template cancelled'));
      } else {
        await recurringInvoiceApi.remove(id);
        toast.success(t('sales.recurring.toast.deleted', 'Template deleted permanently'));
      }
      setPendingAction(null);
      load();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? t('sales.recurring.errors.action', 'Failed to update template status'));
    } finally {
      setActionBusy(false);
    }
  };

  const handleGenerate = async () => {
    try {
      const invoices = await recurringInvoiceApi.generate();
      load();
      if (invoices.length > 0) {
        toast.success(t('sales.recurring.toast.generated', `${invoices.length} invoice(s) generated successfully`));
      } else {
        toast(t('sales.recurring.toast.noDue', 'No invoices due today'), { icon: 'ℹ️' });
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? err?.message ?? t('sales.recurring.errors.generate', 'Failed to generate invoices'));
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
      <div className="flex-none p-6 border-b bg-white dark:bg-slate-900 shadow-sm relative z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-violet-600 rounded-xl text-white shadow-lg shadow-violet-100 dark:shadow-none">
              <Repeat size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                {t('sales.recurring.title', 'Recurring Invoices')}
              </h1>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-[0.15em]">
                {t('sales.recurring.subtitle', 'Templates & Scheduled Invoices')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleGenerate}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-lg text-xs font-bold shadow-md transition-all uppercase tracking-widest"
            >
              <Calendar size={16} /> {t('sales.recurring.actions.generateDue', 'Generate Due')}
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-xs font-bold shadow-md transition-all uppercase tracking-widest"
            >
              <Plus size={16} /> {t('sales.recurring.actions.newTemplate', 'New Template')}
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 scroll-smooth">
        <div className="mx-auto max-w-5xl">
          <div className="mb-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-sm px-4 py-3 rounded-lg flex items-start gap-2">
            <Calendar size={16} className="mt-0.5 flex-shrink-0" />
            <div>
              <strong>{t('sales.recurring.notice.title', 'Heads up — manual generation only')}</strong>
              <div className="mt-0.5 text-xs leading-relaxed">
                {t(
                  'sales.recurring.notice.body',
                  'Recurring templates do not fire automatically yet. Click "Generate Due" to create the invoices that are due today. A system-wide Scheduled Tasks Engine is on the roadmap and will switch this to true auto-run for every module (Sales, HR payroll, Accounting recurring vouchers, etc.).'
                )}
              </div>
            </div>
          </div>
          {error && (
            <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <Card className="p-0 overflow-hidden border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none">
            <div className="bg-slate-50/50 dark:bg-slate-900/50 px-6 py-4 border-b dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-widest">
                <Search size={14} /> {t('sales.recurring.templateDirectory', 'Template Directory')}
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs bg-white dark:bg-slate-800"
                >
                  <option value="">{t('sales.recurring.filters.allStatuses', 'All Statuses')}</option>
                  <option value="ACTIVE">{t('sales.recurring.status.active', 'Active')}</option>
                  <option value="PAUSED">{t('sales.recurring.status.paused', 'Paused')}</option>
                  <option value="COMPLETED">{t('sales.recurring.status.completed', 'Completed')}</option>
                  <option value="CANCELLED">{t('sales.recurring.status.cancelled', 'Cancelled')}</option>
                </select>
                {loading && (
                  <div className="text-[10px] text-blue-500 font-black animate-pulse uppercase tracking-tighter">
                    {t('common.loading', 'Loading...')}
                  </div>
                )}
              </div>
            </div>

            <div className="p-6">
              {templates.length === 0 && !loading ? (
                <div className="py-20 text-center space-y-4">
                  <div className="inline-flex p-6 bg-slate-50 dark:bg-slate-800 rounded-full text-slate-300">
                    <Repeat size={48} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-600 dark:text-slate-400">
                      {t('sales.recurring.empty.title', 'No Recurring Templates')}
                    </p>
                    <p className="text-xs text-slate-400 max-w-xs mx-auto mt-1">
                      {t('sales.recurring.empty.description', 'Create your first recurring invoice template by clicking the button above.')}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  {templates.map((template) => (
                    <div
                      key={template.id}
                      className="group flex items-center justify-between py-3 px-2 border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-900/40 transition-all rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-violet-50 text-violet-500 group-hover:bg-violet-100 transition-colors">
                          <Repeat size={16} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{template.name}</span>
                            <StatusBadge status={template.status} />
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {template.customerName}
                            <span className="ml-2">· {getFrequencyLabel(template.frequency)}</span>
                            <span className="ml-2">· {t('sales.recurring.nextDate', 'Next')}: {template.nextGenerationDate}</span>
                            {template.maxOccurrences && (
                              <span className="ml-2">· {template.occurrencesGenerated}/{template.maxOccurrences}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {template.status === 'ACTIVE' && (
                          <>
                            <button
                              onClick={() => requestAction(template.id, 'pause', template.name)}
                              className="p-1.5 text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded"
                              title="Pause"
                            >
                              <Pause size={14} />
                            </button>
                            <button
                              onClick={() => requestAction(template.id, 'cancel', template.name)}
                              className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                              title="Cancel"
                            >
                              <X size={14} />
                            </button>
                          </>
                        )}
                        {template.status === 'PAUSED' && (
                          <button
                            onClick={() => requestAction(template.id, 'resume', template.name)}
                            className="p-1.5 text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
                            title="Resume"
                          >
                            <Play size={14} />
                          </button>
                        )}
                        {template.status === 'CANCELLED' && (
                          <button
                            onClick={() => requestAction(template.id, 'delete', template.name)}
                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                            title={t('sales.recurring.actions.delete', 'Delete permanently')}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {showCreate && <CreateRecurringInvoiceModal onClose={() => setShowCreate(false)} onSuccess={() => { setShowCreate(false); load(); }} />}

      <ConfirmDialog
        isOpen={!!pendingAction}
        title={
          pendingAction?.action === 'pause'
            ? t('sales.recurring.confirm.pauseTitle', 'Pause this template?')
            : pendingAction?.action === 'resume'
            ? t('sales.recurring.confirm.resumeTitle', 'Resume this template?')
            : pendingAction?.action === 'delete'
            ? t('sales.recurring.confirm.deleteTitle', 'Delete this template permanently?')
            : t('sales.recurring.confirm.cancelTitle', 'Cancel this template?')
        }
        message={
          pendingAction?.action === 'pause'
            ? t('sales.recurring.confirm.pauseMessage', 'No new invoices will be generated until you resume it.')
            : pendingAction?.action === 'resume'
            ? t('sales.recurring.confirm.resumeMessage', 'The schedule will resume from the next due date.')
            : pendingAction?.action === 'delete'
            ? t('sales.recurring.confirm.deleteMessage', 'This will permanently remove the template and cannot be undone. Any invoices already generated from it are not affected.')
            : t('sales.recurring.confirm.cancelMessage', 'This will permanently stop the template. It cannot be reactivated — you would have to create a new one.')
        }
        confirmLabel={
          pendingAction?.action === 'pause'
            ? t('common.pause', 'Pause')
            : pendingAction?.action === 'resume'
            ? t('common.resume', 'Resume')
            : pendingAction?.action === 'delete'
            ? t('common.delete', 'Delete')
            : t('common.cancel', 'Cancel')
        }
        cancelLabel={t('common.dismiss', 'Dismiss')}
        tone={pendingAction?.action === 'cancel' || pendingAction?.action === 'delete' ? 'danger' : 'warning'}
        isConfirming={actionBusy}
        onConfirm={confirmAction}
        onCancel={() => !actionBusy && setPendingAction(null)}
      />
    </div>
  );
};

export default RecurringInvoicesPage;
