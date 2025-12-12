import React from 'react';
import { Card } from '../../../components/ui/Card';
import { Factory, PenTool, ClipboardCheck, AlertCircle } from 'lucide-react';

const ManufacturingHomePage: React.FC = () => {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Manufacturing Overview</h1>
          <p className="text-slate-500">Monitor production lines and work orders.</p>
        </div>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition">
          New Work Order
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard icon={<Factory />} label="Active Jobs" value="0" />
        <StatsCard icon={<PenTool />} label="Work Stations" value="0" />
        <StatsCard icon={<ClipboardCheck />} label="Completed" value="0" />
        <StatsCard icon={<AlertCircle />} label="Issues" value="0" />
      </div>

      <div className="bg-purple-50 border border-purple-200 rounded-lg p-8 text-center">
        <h3 className="text-lg font-semibold text-purple-800">Coming Soon</h3>
        <p className="text-purple-700 mt-2">The full Manufacturing module is coming in the next update. Module license is active.</p>
      </div>
    </div>
  );
};

const StatsCard = ({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) => (
  <Card className="p-6 flex items-center space-x-4">
    <div className="p-3 bg-purple-50 text-purple-600 rounded-full">{icon}</div>
    <div>
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <h4 className="text-2xl font-bold text-slate-900">{value}</h4>
    </div>
  </Card>
);

export default ManufacturingHomePage;
