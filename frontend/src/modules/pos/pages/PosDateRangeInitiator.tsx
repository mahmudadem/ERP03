/**
 * PosDateRangeInitiator.tsx — A reusable initiator for the POS reports
 * that take a date range. Saves repeating the same form in five pages.
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { DatePicker } from '../../../modules/accounting/components/shared/DatePicker';

export interface PosDateRangeParams {
  dateFrom: string;
  dateTo: string;
}

const today = () => new Date().toISOString().slice(0, 10);
const monthAgo = () => {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
};

export const PosDateRangeInitiator: React.FC<{
  onSubmit: (p: PosDateRangeParams) => void;
  initialParams?: PosDateRangeParams | null;
}> = ({ onSubmit, initialParams }) => {
  const { t } = useTranslation();
  const [from, setFrom] = useState(initialParams?.dateFrom || monthAgo());
  const [to, setTo] = useState(initialParams?.dateTo || today());
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSubmit({ dateFrom: from, dateTo: to }); }}
      className="space-y-6"
    >
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-end">
        <div className="md:col-span-4 space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
            {t('pos:report.dateFrom', { defaultValue: 'Date from' })}
          </label>
          <DatePicker value={from} onChange={setFrom} className="w-full" />
        </div>
        <div className="md:col-span-4 space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
            {t('pos:report.dateTo', { defaultValue: 'Date to' })}
          </label>
          <DatePicker value={to} onChange={setTo} className="w-full" />
        </div>
        <div className="md:col-span-4 flex justify-end">
          <Button type="submit" className="bg-slate-900 hover:bg-black text-white px-8 py-2.5 rounded-xl">
            <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest">
              {t('common.generate', { defaultValue: 'Generate' })} <ChevronRight className="w-4 h-4" />
            </span>
          </Button>
        </div>
      </div>
    </form>
  );
};
