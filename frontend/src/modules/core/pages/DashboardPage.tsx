
import React from 'react';
import { Card } from '../../../components/ui/Card';

const DashboardPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
        <span className="text-sm text-gray-500">Last updated: Just now</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="p-6">
            <h3 className="text-gray-500 text-sm font-medium uppercase">Total Revenue</h3>
            <p className="text-2xl font-bold mt-2 text-gray-900">$124,500.00</p>
            <div className="mt-4 flex items-center text-green-600 text-sm font-medium">
              <span>↑ 12%</span>
              <span className="text-gray-400 ml-2 font-normal">vs last month</span>
            </div>
          </Card>
        ))}
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-6 h-96">
          <h2 className="text-lg font-bold mb-4">Financial Overview</h2>
          <div className="flex items-center justify-center h-full bg-gray-50 rounded border border-dashed border-gray-300 text-gray-400">
            Chart Area
          </div>
        </Card>

        <Card className="p-6 h-96">
          <h2 className="text-lg font-bold mb-4">Recent Activities</h2>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-start gap-3 pb-3 border-b border-gray-100 last:border-0">
                <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 flex-shrink-0"></div>
                <div>
                  <p className="text-sm font-medium text-gray-800">New Invoice Created</p>
                  <p className="text-xs text-gray-500">User John Doe created INV-00{i}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default DashboardPage;
