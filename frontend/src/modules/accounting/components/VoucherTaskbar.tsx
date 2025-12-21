/**
 * Voucher Taskbar Component - Legacy Floating Style
 * 
 * Floating pill-shaped tabs at bottom showing open windows.
 */

import React from 'react';
import { FileText, Minimize2 } from 'lucide-react';
import { useWindowManager } from '../../../context/WindowManagerContext';

export const VoucherTaskbar: React.FC = () => {
  const { windows, focusWindow } = useWindowManager();

  if (windows.length === 0) return null;

  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 max-w-[90vw]">
      <div className="flex items-center gap-2 px-3 py-2 bg-white/95 backdrop-blur-sm rounded-full shadow-lg border border-gray-200 overflow-x-auto max-w-full">
        <div className="flex items-center gap-2">
          {windows.map((window) => (
            <button
              key={window.id}
              onClick={() => focusWindow(window.id)}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-full text-sm transition-all whitespace-nowrap
                ${window.isFocused 
                  ? 'bg-blue-100 text-blue-700 border border-blue-300' 
                  : 'bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100'
                }
                ${window.isMinimized ? 'opacity-60' : ''}
              `}
            >
              <FileText className="w-4 h-4 flex-shrink-0" />
              <span className="font-medium">
                {window.title}
              </span>
              {window.isMinimized && (
                <Minimize2 className="w-3 h-3 flex-shrink-0 text-gray-400" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
