import React from 'react';
import { StickyNote } from 'lucide-react';

export const NotesWidget: React.FC = () => {
  return (
    <button 
      className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 rounded-lg text-xs font-bold text-amber-700 shadow-sm border border-amber-200 transition-colors"
      onClick={() => alert('Notes widget clicked. Not fully implemented yet.')}
    >
      <StickyNote className="w-3.5 h-3.5" />
      NOTES
    </button>
  );
};
