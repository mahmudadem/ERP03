import React from 'react';
import { BellRing } from 'lucide-react';

export const AlarmWidget: React.FC = () => {
  return (
    <button 
      className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 rounded-lg text-xs font-bold text-rose-700 shadow-sm border border-rose-200 transition-colors"
      onClick={() => alert('Alarm widget clicked. Add an alarm.')}
    >
      <BellRing className="w-3.5 h-3.5" />
      ALARM
    </button>
  );
};
