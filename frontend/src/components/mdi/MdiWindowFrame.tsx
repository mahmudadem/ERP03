import React, { useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Minus, Square } from 'lucide-react';
import { clsx } from 'clsx';
import { UIWindow, useWindowManager } from '../../context/WindowManagerContext';
import { ConfirmDialog } from '../ui/ConfirmDialog';

export interface MdiWindowFrameProps {
  win: UIWindow;
  title: string;
  onClose?: () => void;
  headerExtra?: React.ReactNode;
  contextMenuExtra?: React.ReactNode;
  footer?: React.ReactNode;
  modals?: React.ReactNode;
  children: React.ReactNode;
  onContextMenuAction?: () => void;
}

export const MdiWindowFrame: React.FC<MdiWindowFrameProps> = ({
  win,
  title,
  onClose,
  headerExtra,
  contextMenuExtra,
  footer,
  modals,
  children,
  onContextMenuAction
}) => {
  const { closeWindow, minimizeWindow, maximizeWindow, focusWindow, updateWindowPosition, updateWindowSize } = useWindowManager();
  const { t } = useTranslation('common');
  const windowRef = useRef<HTMLDivElement>(null);

  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  
  // Resize state
  const [isResizing, setIsResizing] = useState(false);
  const [resizeType, setResizeType] = useState('');
  
  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      closeWindow(win.id);
    }
  };

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

        // Calculate new dimensions based on resize type
        if (resizeType.includes('e')) {
          newWidth = e.clientX - rect.left;
        }
        if (resizeType.includes('w')) {
          const deltaX = rect.left - e.clientX;
          newWidth = win.size.width + deltaX;
          newX = e.clientX;
        }
        if (resizeType.includes('s')) {
          newHeight = e.clientY - rect.top;
        }
        if (resizeType.includes('n')) {
          const deltaY = rect.top - e.clientY;
          newHeight = win.size.height + deltaY;
          newY = e.clientY;
        }

        // Apply minimum size constraints
        newWidth = Math.max(400, Math.min(newWidth, globalThis.window.innerWidth - 20));
        newHeight = Math.max(300, Math.min(newHeight, globalThis.window.innerHeight - 100));

        // Update window size and position
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
  }, [isDragging, isResizing, dragOffset, resizeType, win.id, win.isMaximized, win.size, win.position, updateWindowPosition, updateWindowSize]);

  if (win.isMinimized) return null;

  // Use translate3d for GPU-accelerated dragging
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
        left: 0,
        top: 0,
        transform: `translate3d(${win.position.x}px, ${win.position.y}px, 0)`,
        width: win.size.width,
        height: win.size.height,
        zIndex: win.isFocused ? 1000 : 999,
        willChange: (isDragging || isResizing) ? 'transform' : 'auto'
      };

  return (
    <>
      {/* Invisible overlay during drag/resize to prevent events leaking to background */}
      {(isDragging || isResizing) && (
        <div 
          className="fixed inset-0 z-[9999]"
          style={{ cursor: isDragging ? 'move' : 'se-resize' }}
        />
      )}
      
      <div
        ref={windowRef}
        style={style}
        className={clsx(
          "flex flex-col bg-[var(--color-bg-primary)] rounded-lg shadow-2xl overflow-hidden border transition-colors",
          !isDragging && !isResizing && "transition-all duration-300",
          win.isFocused ? 'border-primary-500/50 ring-1 ring-primary-500/20' : 'border-[var(--color-border)]'
        )}
        onMouseDown={() => focusWindow(win.id)}
      >
        {/* Window Header */}
        <div
          className="window-header relative z-50 flex items-center justify-between px-3 py-2 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)] cursor-move select-none"
          onMouseDown={handleMouseDown}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setContextMenu({ x: e.clientX, y: e.clientY });
          }}
        >
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-sm text-[var(--color-text-primary)]">
              {title}
            </h3>
            {headerExtra}
          </div>
          
          <div className="flex items-center gap-1">
            <button
              onClick={() => minimizeWindow(win.id)}
              className="p-1.5 hover:bg-[var(--color-bg-tertiary)] rounded-full text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
              title={t('minimize', { defaultValue: 'Minimize' })}
            >
              <Minus className="w-4 h-4" />
            </button>
            <button
              onClick={() => maximizeWindow(win.id)}
              className="p-1.5 hover:bg-[var(--color-bg-tertiary)] rounded-full text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
              title={win.isMaximized ? t('restore', { defaultValue: 'Restore' }) : t('maximize', { defaultValue: 'Maximize' })}
            >
              <Square className="w-3 h-3" />
            </button>
            <button
              onClick={handleClose}
              className="p-1.5 hover:bg-danger-500/10 rounded-full text-[var(--color-text-muted)] hover:text-danger-500 transition-colors"
              title={t('close', { defaultValue: 'Close' })}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Context Menu */}
        {contextMenu && (
          <>
            <div 
              className="fixed inset-0 z-[9998]" 
              onClick={() => setContextMenu(null)}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setContextMenu(null);
              }}
            />
            <div 
              className="fixed bg-[var(--color-bg-primary)] rounded-lg shadow-2xl border border-[var(--color-border)] z-[9999] py-1.5 w-52 transition-colors animate-in fade-in zoom-in duration-200"
              style={{ left: contextMenu.x, top: contextMenu.y }}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onClick={() => {
                 if(onContextMenuAction) onContextMenuAction();
              }}
            >
              {contextMenuExtra && (
                 <div onClick={() => setContextMenu(null)}>
                    {contextMenuExtra}
                 </div>
              )}
              
              <div className="border-t border-[var(--color-border)] my-1.5 opacity-50"></div>
              <button
                onClick={() => {
                  minimizeWindow(win.id);
                  setContextMenu(null);
                }}
                className="w-full px-4 py-2 text-left text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] flex items-center gap-3 transition-colors"
              >
                <Minus className="w-4 h-4 text-[var(--color-text-secondary)]" />
                Minimize
              </button>
              <button
                onClick={() => {
                  setContextMenu(null);
                  handleClose();
                }}
                className="w-full px-4 py-2 text-left text-sm text-danger-600 hover:bg-danger-50 flex items-center gap-3 transition-colors"
              >
                <X className="w-4 h-4" />
                Close
              </button>
            </div>
          </>
        )}

        {/* Content */}
        <div className={clsx(
          "flex-1 overflow-y-auto p-4 bg-[var(--color-bg-primary)] overflow-x-auto custom-scroll transition-colors relative",
          (isDragging || isResizing) && "pointer-events-none select-none overflow-hidden"
        )}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)] transition-colors">
            {footer}
          </div>
        )}

        {/* Resize Handles */}
        {!win.isMaximized && (
          <>
            <div className="absolute top-0 left-0 w-full h-1 cursor-n-resize hover:bg-primary-500/20 z-[100]" onMouseDown={(e) => handleResizeMouseDown(e, 'n')} />
            <div className="absolute bottom-0 left-0 w-full h-1 cursor-s-resize hover:bg-primary-500/20 z-[100]" onMouseDown={(e) => handleResizeMouseDown(e, 's')} />
            <div className="absolute top-0 left-0 w-1 h-full cursor-w-resize hover:bg-primary-500/20 z-[100]" onMouseDown={(e) => handleResizeMouseDown(e, 'w')} />
            <div className="absolute top-0 right-0 w-1 h-full cursor-e-resize hover:bg-primary-500/20 z-[100]" onMouseDown={(e) => handleResizeMouseDown(e, 'e')} />
            <div className="absolute top-0 left-0 w-3 h-3 cursor-nw-resize z-[101]" onMouseDown={(e) => handleResizeMouseDown(e, 'nw')} />
            <div className="absolute top-0 right-0 w-3 h-3 cursor-ne-resize z-[101]" onMouseDown={(e) => handleResizeMouseDown(e, 'ne')} />
            <div className="absolute bottom-0 left-0 w-3 h-3 cursor-sw-resize z-[101]" onMouseDown={(e) => handleResizeMouseDown(e, 'sw')} />
            <div className="absolute bottom-0 right-0 w-3 h-3 cursor-se-resize z-[101]" onMouseDown={(e) => handleResizeMouseDown(e, 'se')} />
          </>
        )}
      </div>

      {modals}
    </>
  );
};
