import React from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, CreditCard, Activity } from 'lucide-react';
import { ReportContainer } from '../../components/reports/ReportContainer';
import { ReportTable, ReportColumnDefinition } from '../../components/reports/ReportTable';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { toast } from 'react-hot-toast';

// 1. Define the data model for the report
interface AccountStatementRow {
  id: string;
  date: string;
  reference: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  createdAt: string;
  createdBy: string;
  contraAccount: string;
}

// 2. Define the parameters for the report filter
interface AccountStatementParams {
  accountId: string;
  fromDate: string;
  toDate: string;
}

// 3. Define the columns
const columns: ReportColumnDefinition<AccountStatementRow>[] = [
  { key: 'date', label: 'Date', sortable: true },
  { key: 'reference', label: 'Reference', sortable: true },
  { key: 'description', label: 'Description', sortable: true },
  { 
    key: 'debit', 
    label: 'Debit', 
    align: 'right',
    render: (val: any) => (typeof val === 'number' && val > 0) ? val.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'
  },
  { 
    key: 'credit', 
    label: 'Credit', 
    align: 'right',
    render: (val: any) => (typeof val === 'number' && val > 0) ? val.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'
  },
  { 
    key: 'balance', 
    label: 'Balance', 
    align: 'right',
    sortable: true,
    getCellClassName: (val: any) => (typeof val === 'number' && val < 0) ? 'text-red-600 font-bold bg-red-50/50 dark:bg-red-900/20' : 'text-emerald-600 font-bold',
    render: (val: any) => typeof val === 'number' ? val.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'
  },
  { key: 'contraAccount', label: 'Contra Account', sortable: true },
  { key: 'createdBy', label: 'Created By', sortable: true },
  { key: 'createdAt', label: 'Created At', sortable: true },
];

// 4. Mock data fetcher
const mockFetchData = async (params: AccountStatementParams, page: number, pageSize: number) => {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 800));

  // Generate some dummy data
  const totalItems = 125;
  const startIdx = (page - 1) * pageSize;
  const endIdx = Math.min(startIdx + pageSize, totalItems);
  
  const data: AccountStatementRow[] = [];
  let runningBalance = 10000; // Starting balance

  for (let i = 0; i < totalItems; i++) {
    const isDebit = Math.random() > 0.4;
    const amount = Math.floor(Math.random() * 1000) + 50;
    
    if (isDebit) {
      runningBalance -= amount;
    } else {
      runningBalance += amount;
    }

    if (i >= startIdx && i < endIdx) {
      const isInvoice = i % 4 === 0;
      data.push({
        id: `row-${i}`,
        date: `2026-06-${String((i % 30) + 1).padStart(2, '0')}`,
        reference: isInvoice ? `INV-${2000 + i}` : `JV-${1000 + i}`,
        description: isDebit ? 'Payment to Vendor' : 'Receipt from Customer',
        debit: isDebit ? amount : 0,
        credit: !isDebit ? amount : 0,
        balance: runningBalance,
        contraAccount: isDebit ? '2000-01 Accounts Payable' : '1000-01 Accounts Receivable',
        createdBy: i % 3 === 0 ? 'Admin' : 'System',
        createdAt: new Date(new Date('2026-06-01').getTime() + i * 3600000).toISOString().replace('T', ' ').substring(0, 16)
      });
    }
  }

  return { data, total: totalItems };
};

// 5. Create the Initiator Component (Filter Form)
const StatementInitiator: React.FC<{ 
  onSubmit: (params: AccountStatementParams) => void; 
  initialParams?: AccountStatementParams | null;
  isModal?: boolean;
}> = ({ onSubmit, initialParams, isModal }) => {
    const { t } = useTranslation('common');
  const [params, setParams] = React.useState<AccountStatementParams>(initialParams || {
    accountId: '1010-CASH',
    fromDate: '2026-06-01',
    toDate: '2026-06-30'
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(params);
  };

  return (
    <form onSubmit={handleSubmit} className={`flex flex-col gap-4 ${!isModal ? 'max-w-md' : ''}`}>
      <div className="grid grid-cols-1 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t(`Account`)}</label>
          <Input 
            value={params.accountId}
            onChange={(e) => setParams({ ...params, accountId: e.target.value })}
            placeholder="Select Account..."
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t(`From Date`)}</label>
            <Input 
              type="date"
              value={params.fromDate}
              onChange={(e) => setParams({ ...params, fromDate: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t(`To Date`)}</label>
            <Input 
              type="date"
              value={params.toDate}
              onChange={(e) => setParams({ ...params, toDate: e.target.value })}
            />
          </div>
        </div>
      </div>
      <div className="flex justify-end pt-2">
        <Button type="submit" variant="primary">
          Generate Report
        </Button>
      </div>
    </form>
  );
};

// 6. The Main Page Component
export default function ReportTableDemoPage() {
  const { t } = useTranslation();

  const handleContextMenu = (row: AccountStatementRow) => {
    const actions = [];
    
    if (row.reference.startsWith('INV')) {
      actions.push({
        label: 'Show Invoice',
        icon: <FileText size={16} />,
        onClick: () => toast.success(`Opening Invoice ${row.reference}...`)
      });
    } else {
      actions.push({
        label: 'Show Journal Entry',
        icon: <FileText size={16} />,
        onClick: () => toast.success(`Opening Journal ${row.reference}...`)
      });
    }

    actions.push({
      label: 'Account Card',
      icon: <CreditCard size={16} />,
      onClick: () => toast.success(t('Opening Account Card...'))
    });

    actions.push({
      label: 'Account Statement',
      icon: <Activity size={16} />,
      onClick: () => toast.success(t('Filtering statement to this account...'))
    });

    return actions;
  };

  return (
    <ReportContainer<AccountStatementParams>
      title="Account Statement (Demo)"
      subtitle="Detailed ledger entries for a specific account"
      config={{
        paginated: true,
        defaultPageSize: 25,
        availableColumns: columns.map(c => ({ 
          id: c.key as string, 
          label: c.label || c.key as string,
          defaultHidden: ['contraAccount', 'createdBy', 'createdAt'].includes(c.key as string)
        }))
      }}
      initiator={StatementInitiator}
      ReportContent={(injectedProps) => (
        <ReportTable<AccountStatementRow, AccountStatementParams>
          {...injectedProps}
          columns={columns}
          idKey="id"
          fetchData={mockFetchData}
          rowContextMenu={handleContextMenu}
        />
      )}
    />
  );
}
