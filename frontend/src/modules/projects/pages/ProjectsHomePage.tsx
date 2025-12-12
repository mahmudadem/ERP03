import React from 'react';
import { Card } from '../../../components/ui/Card';
import { Briefcase, ListTodo, Users, Clock } from 'lucide-react';

const ProjectsHomePage: React.FC = () => {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Projects Overview</h1>
          <p className="text-slate-500">Track project progress, tasks, and timelines.</p>
        </div>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition">
          Create Project
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard icon={<Briefcase />} label="Total Projects" value="0" />
        <StatsCard icon={<ListTodo />} label="Pending Tasks" value="0" />
        <StatsCard icon={<Users />} label="Team Members" value="0" />
        <StatsCard icon={<Clock />} label="Hours Logged" value="0" />
      </div>

      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-8 text-center">
        <h3 className="text-lg font-semibold text-indigo-800">Coming Soon</h3>
        <p className="text-indigo-700 mt-2">We are putting the finishing touches on the Projects module. Your access is verified.</p>
      </div>
    </div>
  );
};

const StatsCard = ({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) => (
  <Card className="p-6 flex items-center space-x-4">
    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-full">{icon}</div>
    <div>
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <h4 className="text-2xl font-bold text-slate-900">{value}</h4>
    </div>
  </Card>
);

export default ProjectsHomePage;
