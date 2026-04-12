
import React, { useRef, useState, useEffect } from 'react';
import { X, Minus, Square, Minimize2 } from 'lucide-react';
import { UIWindow, useWindowManager } from '../../../context/WindowManagerContext';
import { clsx } from 'clsx';

interface DraggableWindowProps {
  win: UIWindow;
  children: React.ReactNode;
  defaultSize?: { width: number, height: number };
  minSize?: { width: number, height: number };
}

export const DraggableWindow: React.FC<DraggableWindowProps> = ({ 
  win, 
  children,
  defaultSize = { width: 800, height: 600 },
  minSize = { width: 600, height: 400 }
}) => {
  const { closeWindow, minimizeWindow, maximizeWindow, focusWindow, updateWindowPosition, updateWindowSize } = useWindowManager();
  const windowRef = useRef<HTMLDivElement>(null);

  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  
  // Resize state
  const [isResizing, setIsResizing] = useState(false);
  const [resizeType, setResizeType] = useState('');

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.window-header') && 
        !(e.target as HTMLElement).closest('button')) {
      setIsDragging(true);
      const rect = windowRef.current?.getBoundingClientRect();
      if (rect) {
        setDragOffset({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        });
      }
      focusWindow(win.id);
    }
  };

  const handleResizeMouseDown = (e: React.MouseEvent, type: string) => {
    e.stopPropagation();
    setIsResizing(true);
    setResizeType(type);
    focusWindow(win.id);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && !win.isMaximized) {
        updateWindowPosition(win.id, {
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y
        });
      }
      
      if (isResizing && !win.isMaximized && windowRef.current) {
        const rect = windowRef.current.getBoundingClientRect();
        let newWidth = win.size.width;
        let newHeight = win.size.height;
        let newX = win.position.x;
        let newY = win.position.y;

        if (resizeType.includes('e')) newWidth = e.clientX - rect.left;
        if (resizeType.includes('w')) {
          const deltaX = rect.left - e.clientX;
          newWidth = win.size.width + deltaX;
          newX = e.clientX;
        }
        if (resizeType.includes('s')) newHeight = e.clientY - rect.top;
        if (resizeType.includes('n')) {
          const deltaY = rect.top - e.clientY;
          newHeight = win.size.height + deltaY;
          newY = e.clientY;
        }

        newWidth = Math.max(minSize.width, Math.min(newWidth, window.innerWidth - 20));
        newHeight = Math.max(minSize.height, Math.min(newHeight, window.innerHeight - 100));

        updateWindowSize(win.id, { width: newWidth, height: newHeight });
        if (newX !== win.position.x || newY !== win.position.y) {
          updateWindowPosition(win.id, { x: newX, y: newY });
        }
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
      setResizeType('');
    };

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, dragOffset, resizeType, win.id, win.isMaximized, win.size, win.position, updateWindowPosition, updateWindowSize, minSize]);

  if (win.isMinimized) return null;

  const style: React.CSSProperties = win.isMaximized
    ? {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: '80px',
        width: 'auto',
        height: 'auto',
        zIndex: win.isFocused ? 1000 : 999
      }
    : {
        position: 'fixed',
        left: win.position.x,
        top: win.position.y,
        width: win.size.width,
        height: win.size.height,
        zIndex: win.isFocused ? 1000 : 999
      };

  return (
    <div
      ref={windowRef}
      style={style}
      className={clsx(
        "flex flex-col bg-white dark:bg-slate-950 rounded-lg shadow-2xl overflow-hidden border transition-all duration-300",
        win.isFocused ? "border-blue-500 ring-4 ring-blue-500/10" : "border-slate-200 dark:border-slate-800"
      )}
      onMouseDown={() => focusWindow(win.id)}
    >
      {/* Window Header */}
      <div
        className="window-header relative z-10 flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 cursor-move select-none"
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-2">
           <h3 className="font-bold text-xs text-slate-800 dark:text-slate-100 uppercase tracking-tight opacity-80">
            {win.title}
          </h3>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => minimizeWindow(win.id)} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition-colors">
            <Minus size={14} className="text-slate-600" />
          </button>
          <button onClick={() => maximizeWindow(win.id)} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition-colors">
            {win.isMaximized ? <Minimize2 size={14} className="text-slate-600" /> : <Square size={14} className="text-slate-600" />}
          </button>
          <button onClick={() => closeWindow(win.id)} className="p-1 hover:bg-red-500 hover:text-white rounded transition-colors">
            <X size={14} className="text-slate-600 hover:text-inherit" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden relative">
        {children}
      </div>

      {/* Resize Handles */}
      {!win.isMaximized && (
        <>
          <div onMouseDown={(e) => handleResizeMouseDown(e, 'e')} className="absolute right-0 top-0 bottom-0 w-1 cursor-e-resize z-50 hover:bg-blue-500/20" />
          <div onMouseDown={(e) => handleResizeMouseDown(e, 'w')} className="absolute left-0 top-0 bottom-0 w-1 cursor-w-resize z-50 hover:bg-blue-500/20" />
          <div onMouseDown={(e) => handleResizeMouseDown(e, 's')} className="absolute bottom-0 left-0 right-0 h-1 cursor-s-resize z-50 hover:bg-blue-500/20" />
          <div onMouseDown={(e) => handleResizeMouseDown(e, 'se')} className="absolute bottom-0 right-0 w-3 h-3 cursor-se-resize z-50 hover:bg-blue-500/20" />
        </>
      )}
    </div>
  );
};
