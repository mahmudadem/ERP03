import React from 'react';
import { Card } from '../../../components/ui/Card';
import { Users, Phone, Mail, Calendar } from 'lucide-react';

const CrmHomePage: React.FC = () => {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">CRM Overview</h1>
          <p className="text-slate-500">Manage your customer relationships and leads.</p>
        </div>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition">
          New Lead
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard icon={<Users />} label="Total Customers" value="0" />
        <StatsCard icon={<Phone />} label="Active Leads" value="0" />
        <StatsCard icon={<Mail />} label="Pending Emails" value="0" />
        <StatsCard icon={<Calendar />} label="Meetings" value="0" />
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-8 text-center">
        <h3 className="text-lg font-semibold text-yellow-800">Coming Soon</h3>
        <p className="text-yellow-700 mt-2">The full CRM module is currently under development. You have successfully activated the license!</p>
      </div>
    </div>
  );
};

const StatsCard = ({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) => (
  <Card className="p-6 flex items-center space-x-4">
    <div className="p-3 bg-blue-50 text-blue-600 rounded-full">{icon}</div>
    <div>
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <h4 className="text-2xl font-bold text-slate-900">{value}</h4>
    </div>
  </Card>
);

export default CrmHomePage;
