import React, { useEffect, useState } from 'react';
import { accountingApi, RecurringVoucherTemplateDTO } from '../../../api/accountingApi';

const RecurringVouchersPage: React.FC = () => {
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
    setMessage('Template created');
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
    setMessage('Generation triggered');
    load();
  };

  return (
    <div className="p-6 space-y-4">
      <h2 className="text-lg font-semibold">Recurring Vouchers</h2>
      {message && <div className="p-2 bg-green-50 border border-green-200 rounded">{message}</div>}
      <div className="border rounded p-4 space-y-2">
        <div className="grid grid-cols-2 gap-3">
          <input className="border rounded px-2 py-1" placeholder="Name" value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="border rounded px-2 py-1" placeholder="Source Voucher ID" value={form.sourceVoucherId || ''} onChange={(e) => setForm({ ...form, sourceVoucherId: e.target.value })} />
          <select
            className="border rounded px-2 py-1"
            value={form.frequency}
            onChange={(e) => setForm({ ...form, frequency: e.target.value as RecurringVoucherTemplateDTO['frequency'] })}
          >
            <option value="MONTHLY">Monthly</option>
            <option value="QUARTERLY">Quarterly</option>
            <option value="ANNUALLY">Annually</option>
          </select>
          <input className="border rounded px-2 py-1" type="number" min={1} max={31} value={form.dayOfMonth} onChange={(e) => setForm({ ...form, dayOfMonth: Number(e.target.value) })} />
          <input className="border rounded px-2 py-1" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
          <input className="border rounded px-2 py-1" type="date" value={form.endDate || ''} onChange={(e) => setForm({ ...form, endDate: e.target.value || undefined })} />
          <input className="border rounded px-2 py-1" type="number" min={1} value={form.maxOccurrences || ''} placeholder="Max occurrences" onChange={(e) => setForm({ ...form, maxOccurrences: e.target.value ? Number(e.target.value) : undefined })} />
        </div>
        <button className="btn btn-primary" onClick={create}>Create Template</button>
        <button className="btn btn-secondary" onClick={generate}>Generate Due Vouchers</button>
      </div>

      <div className="border rounded overflow-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="p-2 text-left">Name</th>
              <th className="p-2 text-left">Frequency</th>
              <th className="p-2 text-left">Next Date</th>
              <th className="p-2 text-left">Status</th>
              <th className="p-2 text-left">Generated</th>
              <th className="p-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {templates.map((t) => (
              <tr key={t.id} className="border-t">
                <td className="p-2">{t.name}</td>
                <td className="p-2">{t.frequency}</td>
                <td className="p-2">{t.nextGenerationDate}</td>
                <td className="p-2">{t.status}</td>
                <td className="p-2">{t.occurrencesGenerated}</td>
                <td className="p-2 space-x-2">
                  {t.status === 'ACTIVE' ? (
                    <button className="btn btn-link text-amber-700" onClick={() => pause(t.id)}>Pause</button>
                  ) : (
                    <button className="btn btn-link text-green-700" onClick={() => resume(t.id)}>Resume</button>
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
