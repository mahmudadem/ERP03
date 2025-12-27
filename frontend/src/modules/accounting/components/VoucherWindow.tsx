/**
 * Voucher Window Component - Legacy Style
 * 
 * Floating, draggable, resizable window matching legacy design.
 */

import React, { useRef, useState, useEffect } from 'react';
import { X, Minus, Square, ChevronDown, Save, Printer, Loader2, Send } from 'lucide-react';
import { GenericVoucherRenderer, GenericVoucherRendererRef } from './shared/GenericVoucherRenderer';
import { VoucherWindow as VoucherWindowType } from '../../../context/WindowManagerContext';
import { useWindowManager } from '../../../context/WindowManagerContext';
import { errorHandler } from '../../../services/errorHandler';
import { UnsavedChangesModal } from './shared/UnsavedChangesModal';

interface VoucherWindowProps {
  win: VoucherWindowType;
  onSave: (id: string, data: any) => Promise<void>;
  onSubmit: (id: string, data: any) => Promise<void>;
}

export const VoucherWindow: React.FC<VoucherWindowProps> = ({ 
  win, 
  onSave,
  onSubmit
}) => {
  const { closeWindow, minimizeWindow, maximizeWindow, focusWindow, updateWindowPosition, updateWindowSize, updateWindowData } = useWindowManager();
  const windowRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<GenericVoucherRendererRef>(null);
  
  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  
  // Resize state
  const [isResizing, setIsResizing] = useState(false);
  const [resizeType, setResizeType] = useState('');
  
  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  
  // Save state
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [, forceUpdate] = useState(0); // Force re-render for totals
  const [isDirty, setIsDirty] = useState(false);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);

  const handleCloseAttempt = () => {
    if (isDirty) {
      setShowUnsavedModal(true);
    } else {
      closeWindow(win.id);
    }
  };

  const handleConfirmClose = () => {
    setShowUnsavedModal(false);
    closeWindow(win.id);
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

  const handleSave = async () => {
    if (!rendererRef.current) {
      return;
    }
    
    setIsSaving(true);
    try {
      const formData = rendererRef.current.getData();
      await onSave(win.id, formData);
    } catch (error: any) {
      errorHandler.showError(error);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle submit for approval
  const handleSubmit = async () => {
    if (!rendererRef.current) {
      return;
    }
    
    setIsSaving(true);
    try {
      const formData = rendererRef.current.getData();
      await onSubmit(win.id, formData);
    } catch (error: any) {
      errorHandler.showError(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDataChange = (newData: any) => {
    updateWindowData(win.id, newData);
  };

  const handleNew = () => {
    if (rendererRef.current) {
      rendererRef.current.resetData();
      // Update window context data to reflect new state
      updateWindowData(win.id, {
        ...win.data,
        id: undefined,
        status: 'Draft',
        lines: []
      });
    }
  };

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
        className={`flex flex-col bg-white rounded-lg shadow-xl overflow-hidden border ${
          win.isFocused ? 'border-gray-300' : 'border-gray-200'
        }`}
        onMouseDown={() => focusWindow(win.id)}
      >
      {/* Window Header */}
      <div
        className="window-header flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200 cursor-move select-none"
        onMouseDown={handleMouseDown}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setContextMenu({ x: e.clientX, y: e.clientY });
        }}
      >
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-sm text-gray-700">{win.title}</h3>
          {win.data?.status && (
            <span className={`px-2 py-0.5 text-xs rounded ${
              win.data.status === 'approved' ? 'bg-green-100 text-green-700' :
              win.data.status === 'draft' ? 'bg-gray-200 text-gray-700' :
              'bg-blue-100 text-blue-700'
            }`}>
              {win.data.status.toUpperCase()}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-1">
          <button
            onClick={() => minimizeWindow(win.id)}
            className="p-1 hover:bg-gray-200 rounded text-gray-500"
            title="Minimize"
          >
            <Minus className="w-4 h-4" />
          </button>
          <button
            onClick={() => maximizeWindow(win.id)}
            className="p-1 hover:bg-gray-200 rounded text-gray-500"
            title={win.isMaximized ? "Restore" : "Maximize"}
          >
            <Square className="w-3 h-3" />
          </button>
          <button
            onClick={handleCloseAttempt}
            className="p-1 hover:bg-gray-200 rounded text-gray-500"
            title="Close"
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
            className="fixed bg-white rounded-md shadow-lg border border-gray-200 z-[9999] py-1 w-44"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <button
              onClick={() => {
                console.log('Save voucher');
                setContextMenu(null);
              }}
              className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              Save
            </button>
            <button
              onClick={() => {
                window.print();
                setContextMenu(null);
              }}
              className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
            <div className="border-t border-gray-200 my-1"></div>
            <button
              onClick={() => {
                minimizeWindow(win.id);
                setContextMenu(null);
              }}
              className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
            >
              <Minus className="w-4 h-4" />
              Minimize
            </button>
            <button
              onClick={() => {
                setContextMenu(null);
                handleCloseAttempt();
              }}
              className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              Close
            </button>
          </div>
        </>
      )}

      {/* Voucher Content */}
      <div className="flex-1 overflow-y-auto p-4 bg-white overflow-x-hidden">
        <GenericVoucherRenderer
          ref={rendererRef}
          definition={win.voucherType as any}
          mode="windows"
          initialData={win.data}
          onChange={() => {
            setIsDirty(true);
            forceUpdate(prev => prev + 1);
          }}
        />
      </div>

      {/* Window Footer - Core Actions */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
        {/* Totals Display */}
        <div className="flex items-center gap-4">
          {(() => {
            // Get current rows from renderer
            const rows = rendererRef.current?.getRows() || [];
            
            const totalDebit = rows.reduce((sum: number, row: any) => sum + (parseFloat(row.debit) || 0), 0);
            const totalCredit = rows.reduce((sum: number, row: any) => sum + (parseFloat(row.credit) || 0), 0);
            const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;
            const hasValues = totalDebit > 0 || totalCredit > 0;
            
            // Gray when both are 0, green when balanced with values, red when unbalanced
            const bgColor = !hasValues ? 'bg-gray-100' : (isBalanced ? 'bg-green-100' : 'bg-red-100');
            
            return (
              <div className={`flex items-center gap-6 px-4 py-2 ${bgColor} rounded-md transition-colors border border-gray-200/50 shadow-sm`}>
                <div className="flex items-baseline gap-2">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Total Debit</span>
                  <span className="text-base font-bold text-slate-900 font-mono">
                    {new Intl.NumberFormat('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }).format(totalDebit)}
                  </span>
                </div>
                
                {/* Vertical Divider (Pipeline) */}
                <div className="w-[1px] h-5 bg-gray-300/60" />
                
                <div className="flex items-baseline gap-2">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Total Credit</span>
                  <span className="text-base font-bold text-slate-900 font-mono">
                    {new Intl.NumberFormat('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }).format(totalCredit)}
                  </span>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            className="px-3 py-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
            onClick={handleNew}
            title="Create a new voucher in this window"
          >
            New
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-1.5 text-sm bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50 disabled:opacity-50"
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save as Draft
              </>
            )}
          </button>
          
          {win.data?.status !== 'approved' && (
            <button
            onClick={handleSubmit}
            className="flex items-center gap-2 px-4 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Submitting...
              </>
            ) : (
              <Send className="w-4 h-4" />
            )}
            Submit for Approval
          </button>
          )}
        </div>
      </div>

      {/* Resize Handles - Only when not maximized */}
      {!win.isMaximized && (
        <>
          {/* Corner resize handles */}
          <div 
            className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize"
            onMouseDown={(e) => handleResizeMouseDown(e, 'se')}
          />
          <div 
            className="absolute bottom-0 left-0 w-4 h-4 cursor-nesw-resize"
            onMouseDown={(e) => handleResizeMouseDown(e, 'sw')}
          />
          <div 
            className="absolute top-0 right-0 w-4 h-4 cursor-nesw-resize"
            onMouseDown={(e) => handleResizeMouseDown(e, 'ne')}
          />
          <div 
            className="absolute top-0 left-0 w-4 h-4 cursor-nwse-resize"
            onMouseDown={(e) => handleResizeMouseDown(e, 'nw')}
          />
        </>
      )}
    </div>
    
    <UnsavedChangesModal 
      isOpen={showUnsavedModal}
      onCancel={() => setShowUnsavedModal(false)}
      onConfirm={handleConfirmClose}
    />
    </>
  );
};
