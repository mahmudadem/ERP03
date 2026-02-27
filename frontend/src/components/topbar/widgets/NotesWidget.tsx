import React from 'react';
import { StickyNote } from 'lucide-react';
import { clsx } from 'clsx';

interface NotesWidgetProps {
  showBorder?: boolean;
  showBackground?: boolean;
}

export const NotesWidget: React.FC<NotesWidgetProps> = ({ 
  showBorder = true, 
  showBackground = true 
}) => {
  return (
    <button 
      className={clsx(
        "flex justify-center items-center gap-1.5 px-3 rounded-lg text-xs font-bold text-amber-700 transition-all h-full w-full overflow-hidden",
        showBackground && "bg-amber-50 hover:bg-amber-100 shadow-sm",
        showBorder && "border border-amber-200"
      )}
      onClick={() => alert('Notes widget clicked. Not fully implemented yet.')}
    >
      <StickyNote className="w-3.5 h-3.5 shrink-0" />
      NOTES
    </button>
  );
};
