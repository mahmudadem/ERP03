import React from 'react';
import { Card } from '../../../components/ui/Card';
import { Users, Phone, Mail, Calendar } from 'lucide-react';

const CrmHomePage: React.FC = () => {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)] tracking-tight">CRM Overview</h1>
          <p className="text-[var(--color-text-secondary)]">Manage your customer relationships and leads.</p>
        </div>
        <button className="bg-primary-600 text-white px-5 py-2 rounded-lg hover:bg-primary-700 transition shadow-md shadow-primary-500/10 active:scale-[0.98]">
          New Lead
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard icon={<Users />} label="Total Customers" value="0" />
        <StatsCard icon={<Phone />} label="Active Leads" value="0" />
        <StatsCard icon={<Mail />} label="Pending Emails" value="0" />
        <StatsCard icon={<Calendar />} label="Meetings" value="0" />
      </div>

      <div className="bg-warning-50/30 dark:bg-warning-900/10 border border-warning-200/50 dark:border-warning-900/30 rounded-xl p-12 text-center shadow-inner transition-all">
        <div className="mx-auto w-16 h-16 bg-warning-100 dark:bg-warning-900/40 rounded-full flex items-center justify-center mb-4">
           <Phone className="w-8 h-8 text-warning-600 dark:text-warning-400" />
        </div>
        <h3 className="text-xl font-bold text-warning-800 dark:text-warning-400">Module Under Development</h3>
        <p className="text-warning-700 dark:text-warning-500 mt-2 font-medium">The full CRM module is currently under development. You have successfully activated the license!</p>
      </div>
    </div>
  );
};

const StatsCard = ({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) => (
  <Card className="p-6 flex items-center space-x-4 bg-[var(--color-bg-primary)] border-[var(--color-border)] shadow-sm hover:shadow-md transition-shadow">
    <div className="p-3 bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-xl">{icon}</div>
    <div>
      <p className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">{label}</p>
      <h4 className="text-2xl font-extrabold text-[var(--color-text-primary)]">{value}</h4>
    </div>
  </Card>
);

export default CrmHomePage;
