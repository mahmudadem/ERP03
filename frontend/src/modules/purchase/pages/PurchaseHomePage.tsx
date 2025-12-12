import React from 'react';
import { Card } from '../../../components/ui/Card';
import { ShoppingBag, Truck, Receipt, FileText } from 'lucide-react';

const PurchaseHomePage: React.FC = () => {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Purchasing Overview</h1>
          <p className="text-slate-500">Manage vendors, purchase orders, and procurement.</p>
        </div>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition">
          New Order
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard icon={<ShoppingBag />} label="Open Orders" value="0" />
        <StatsCard icon={<Truck />} label="In Transit" value="0" />
        <StatsCard icon={<Receipt />} label="Bills to Pay" value="0" />
        <StatsCard icon={<FileText />} label="RFQs" value="0" />
      </div>

      <div className="bg-teal-50 border border-teal-200 rounded-lg p-8 text-center">
        <h3 className="text-lg font-semibold text-teal-800">Coming Soon</h3>
        <p className="text-teal-700 mt-2">The Purchase module is active but under construction. Check back soon!</p>
      </div>
    </div>
  );
};

const StatsCard = ({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) => (
  <Card className="p-6 flex items-center space-x-4">
    <div className="p-3 bg-teal-50 text-teal-600 rounded-full">{icon}</div>
    <div>
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <h4 className="text-2xl font-bold text-slate-900">{value}</h4>
    </div>
  </Card>
);

export default PurchaseHomePage;
