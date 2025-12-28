import React from 'react';
import { Card } from '../../../components/ui/Card';
import { Briefcase, ListTodo, Users, Clock } from 'lucide-react';

const ProjectsHomePage: React.FC = () => {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)] tracking-tight">Projects Overview</h1>
          <p className="text-[var(--color-text-secondary)]">Track project progress, tasks, and timelines.</p>
        </div>
        <button className="bg-primary-600 text-white px-5 py-2 rounded-lg hover:bg-primary-700 transition shadow-md shadow-primary-500/10 active:scale-[0.98]">
          Create Project
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard icon={<Briefcase />} label="Total Projects" value="0" />
        <StatsCard icon={<ListTodo />} label="Pending Tasks" value="0" />
        <StatsCard icon={<Users />} label="Team Members" value="0" />
        <StatsCard icon={<Clock />} label="Hours Logged" value="0" />
      </div>

      <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-12 text-center shadow-inner transition-colors">
        <div className="mx-auto w-16 h-16 bg-primary-100 dark:bg-primary-900/40 rounded-full flex items-center justify-center mb-4">
           <Briefcase className="w-8 h-8 text-primary-600" />
        </div>
        <h3 className="text-xl font-bold text-[var(--color-text-primary)]">Module Under Construction</h3>
        <p className="text-[var(--color-text-secondary)] mt-2 font-medium">We are putting the finishing touches on the Projects module. Your access is verified.</p>
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

export default ProjectsHomePage;
