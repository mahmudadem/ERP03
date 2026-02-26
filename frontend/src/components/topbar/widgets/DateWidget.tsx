import React from 'react';
import { Calendar } from 'lucide-react';

export const DateWidget: React.FC = () => {
  const date = new Date();
  
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-lg text-xs font-bold text-slate-700 shadow-sm border border-slate-200 uppercase tracking-widest">
      <Calendar className="w-3.5 h-3.5 text-blue-500" />
      {date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
    </div>
  );
};
