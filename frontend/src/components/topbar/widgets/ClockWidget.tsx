import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

export const ClockWidget: React.FC = () => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-lg text-xs font-bold text-slate-700 shadow-sm border border-slate-200">
      <Clock className="w-3.5 h-3.5 text-indigo-500" />
      {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
    </div>
  );
};
