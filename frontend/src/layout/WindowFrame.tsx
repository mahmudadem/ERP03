
import React from 'react';

interface WindowFrameProps {
  id: string;
  title: string;
  isActive: boolean;
  onClose: () => void;
  onFocus: () => void;
  children: React.ReactNode;
  zIndex: number;
}

export const WindowFrame: React.FC<WindowFrameProps> = ({
  title,
  isActive,
  onClose,
  onFocus,
  children,
  zIndex
}) => {
  return (
    <div
      className={`
        absolute rounded-lg overflow-hidden shadow-xl border flex flex-col bg-white dark:bg-[var(--color-bg-primary)]
        transition-shadow duration-200
        ${isActive ? 'ring-2 ring-blue-400 shadow-2xl border-blue-400' : 'border-gray-300 dark:border-[var(--color-border)]'}
      `}
      style={{
        width: '800px',
        height: '600px',
        top: '100px',
        left: '100px',
        zIndex: zIndex,
        // Mock positioning for now
        transform: isActive ? 'scale(1)' : 'scale(0.98)',
      }}
      onClick={onFocus}
    >
      {/* Title Bar */}
      <div className={`
        h-10 px-4 flex items-center justify-between select-none
        ${isActive ? 'bg-gray-100 dark:bg-[var(--color-bg-tertiary)]' : 'bg-gray-50 dark:bg-[var(--color-bg-tertiary)]'}
        border-b border-gray-200 dark:border-[var(--color-border)]
      `}>
        <span className="font-medium text-sm text-gray-700 dark:text-[var(--color-text-secondary)] truncate">{title}</span>
        <div className="flex items-center gap-2">
           <button className="w-3 h-3 rounded-full bg-yellow-400 hover:bg-yellow-500" />
           <button className="w-3 h-3 rounded-full bg-green-400 hover:bg-green-500" />
           <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="w-3 h-3 rounded-full bg-red-400 hover:bg-red-500" />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto bg-white dark:bg-[var(--color-bg-primary)] p-4 window-scroll relative">
        {children}
      </div>
    </div>
  );
};
