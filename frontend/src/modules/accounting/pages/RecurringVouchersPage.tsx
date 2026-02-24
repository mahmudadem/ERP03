import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { accountingApi, RecurringVoucherTemplateDTO } from '../../../api/accountingApi';
import { DatePicker } from '../components/shared/DatePicker';

const RecurringVouchersPage: React.FC = () => {
  const { t } = useTranslation('accounting');
  const [templates, setTemplates] = useState<RecurringVoucherTemplateDTO[]>([]);
  const [form, setForm] = useState<Partial<RecurringVoucherTemplateDTO>>({
    frequency: 'MONTHLY',
    dayOfMonth: 1,
    startDate: new Date().toISOString().slice(0, 10)
  });
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    const data = await accountingApi.listRecurringVouchers();
    setTemplates(data);
  };

  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    await accountingApi.createRecurringVoucher(form as any);
    setMessage(t('recurring.messageCreated'));
    setForm({ frequency: 'MONTHLY', dayOfMonth: 1, startDate: form.startDate || new Date().toISOString().slice(0, 10) });
    load();
  };

  const pause = async (id: string) => {
    await accountingApi.pauseRecurringVoucher(id);
    load();
  };
  const resume = async (id: string) => {
    await accountingApi.resumeRecurringVoucher(id);
    load();
  };
  const generate = async () => {
    await accountingApi.generateRecurringVouchers();
    setMessage(t('recurring.messageGenerated'));
    load();
  };

  return (
    <div className="p-6 space-y-4">
      <h2 className="text-lg font-semibold">{t('recurring.title')}</h2>
      {message && <div className="p-2 bg-green-50 border border-green-200 rounded">{message}</div>}
      <div className="border rounded p-4 space-y-2">
        <div className="grid grid-cols-2 gap-3">
          <input className="border rounded px-2 py-1" placeholder={t('recurring.name')} value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="border rounded px-2 py-1" placeholder={t('recurring.sourceVoucherId')} value={form.sourceVoucherId || ''} onChange={(e) => setForm({ ...form, sourceVoucherId: e.target.value })} />
          <select
            className="border rounded px-2 py-1"
            value={form.frequency}
            onChange={(e) => setForm({ ...form, frequency: e.target.value as RecurringVoucherTemplateDTO['frequency'] })}
          >
            <option value="MONTHLY">{t('recurring.frequencies.MONTHLY')}</option>
            <option value="QUARTERLY">{t('recurring.frequencies.QUARTERLY')}</option>
            <option value="ANNUALLY">{t('recurring.frequencies.ANNUALLY')}</option>
          </select>
          <input className="border rounded px-2 py-1" type="number" min={1} max={31} value={form.dayOfMonth} onChange={(e) => setForm({ ...form, dayOfMonth: Number(e.target.value) })} placeholder={t('recurring.dayOfMonth')} />
          <DatePicker value={form.startDate || ''} onChange={(date) => setForm({ ...form, startDate: date })} className="w-full text-sm" />
          <DatePicker value={form.endDate || ''} onChange={(date) => setForm({ ...form, endDate: date || undefined })} className="w-full text-sm" />
          <input className="border rounded px-2 py-1" type="number" min={1} value={form.maxOccurrences || ''} placeholder={t('recurring.maxOccurrences')} onChange={(e) => setForm({ ...form, maxOccurrences: e.target.value ? Number(e.target.value) : undefined })} />
        </div>
        <button className="btn btn-primary" onClick={create}>{t('recurring.createTemplate')}</button>
        <button className="btn btn-secondary" onClick={generate}>{t('recurring.generate')}</button>
      </div>

      <div className="border rounded overflow-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="p-2 text-left">{t('recurring.name')}</th>
              <th className="p-2 text-left">{t('recurring.frequency')}</th>
              <th className="p-2 text-left">{t('recurring.nextDate')}</th>
              <th className="p-2 text-left">{t('recurring.status')}</th>
              <th className="p-2 text-left">{t('recurring.generated')}</th>
              <th className="p-2 text-left">{t('recurring.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {templates.map((tmpl) => (
              <tr key={tmpl.id} className="border-t">
                <td className="p-2">{tmpl.name}</td>
                <td className="p-2">{t('recurring.frequencies.' + tmpl.frequency)}</td>
                <td className="p-2">{tmpl.nextGenerationDate}</td>
                <td className="p-2">{t('recurring.statuses.' + tmpl.status)}</td>
                <td className="p-2">{tmpl.occurrencesGenerated}</td>
                <td className="p-2 space-x-2">
                  {tmpl.status === 'ACTIVE' ? (
                    <button className="btn btn-link text-amber-700" onClick={() => pause(tmpl.id)}>{t('recurring.pause')}</button>
                  ) : (
                    <button className="btn btn-link text-green-700" onClick={() => resume(tmpl.id)}>{t('recurring.resume')}</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RecurringVouchersPage;
