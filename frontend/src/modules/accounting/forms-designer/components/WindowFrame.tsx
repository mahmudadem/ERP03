import React, { useState, useEffect, useRef } from 'react';
import { Minus, X, Maximize2 } from 'lucide-react';
import { useLanguage } from '../LanguageContext';

interface WindowFrameProps {
  title: string;
  isActive: boolean;
  onClose: () => void;
  onMinimize: () => void;
  onFocus: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  initialX?: number;
  initialY?: number;
  initialWidth?: number;
  initialHeight?: number;
  isMobile?: boolean;
  children: React.ReactNode;
}

export const WindowFrame: React.FC<WindowFrameProps> = React.memo(({
  title,
  isActive,
  onClose,
  onMinimize,
  onFocus,
  onContextMenu,
  initialX = 100,
  initialY = 50,
  initialWidth = 900,
  initialHeight = 650,
  isMobile = false,
  children
}) => {
  const [position, setPosition] = useState({ x: initialX, y: initialY });
  const [size, setSize] = useState({ width: initialWidth, height: initialHeight });
  const { isRTL } = useLanguage();
  
  // Dragging state
  const isDragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  
  // Resizing state
  const isResizing = useRef(false);
  const resizeStart = useRef({ x: 0, y: 0, width: 0, height: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isMobile) return; // Disable drag on mobile
    
    e.stopPropagation(); 
    onFocus(); 
    isDragging.current = true;
    dragOffset.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
  };

  const handleResizeStart = (e: React.MouseEvent) => {
    if (isMobile) return; // Disable resize on mobile
    
    e.stopPropagation();
    isResizing.current = true;
    resizeStart.current = {
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging.current) {
        setPosition({
          x: e.clientX - dragOffset.current.x,
          y: e.clientY - dragOffset.current.y
        });
      } else if (isResizing.current) {
        const deltaX = isRTL 
           ? resizeStart.current.x - e.clientX 
           : e.clientX - resizeStart.current.x;
           
        const deltaY = e.clientY - resizeStart.current.y;
        
        setSize({
          width: Math.max(400, resizeStart.current.width + deltaX),
          height: Math.max(300, resizeStart.current.height + deltaY)
        });
      }
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      isResizing.current = false;
    };

    if (isActive && !isMobile) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isActive, isRTL, isMobile]);

  // Mobile Styles Override
  const mobileStyles = isMobile ? {
      position: 'fixed' as 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: 'calc(100% - 60px)', // Leave space for taskbar
      borderRadius: 0,
      transform: 'none'
  } : {
      width: `${size.width}px`,
      height: `${size.height}px`,
      transform: `translate(${position.x}px, ${position.y}px)`,
      top: 0, 
      left: 0,
  };

  return (
    <div 
      className={`absolute flex flex-col bg-white transition-shadow duration-200 overflow-hidden
        ${isActive ? 'border-blue-400 ring-1 ring-blue-300 shadow-2xl z-50' : 'border-gray-300 shadow-lg'}
        ${!isMobile ? 'rounded-lg' : ''}`}
      style={mobileStyles}
      onClick={onFocus}
      dir={isRTL ? 'rtl' : 'ltr'} 
    >
      {/* Title Bar */}
      <div 
        className={`flex items-center justify-between px-3 py-2 select-none 
          ${isActive ? 'bg-gradient-to-r from-gray-100 to-gray-200' : 'bg-gray-100'}`}
        onMouseDown={handleMouseDown}
        onContextMenu={onContextMenu}
        style={{ cursor: isMobile ? 'default' : 'grab' }}
      >
        <div className="flex items-center gap-2 pointer-events-none">
           <span className="text-gray-500">
             <div className="w-4 h-4 rounded-sm bg-blue-500 flex items-center justify-center text-white text-[10px] font-bold">
               {isRTL ? 'س' : 'J'}
             </div>
           </span>
           <span className="text-sm font-medium text-gray-700">{title}</span>
        </div>
        
        <div className="flex items-center gap-1" onMouseDown={(e) => e.stopPropagation()}>
          <button 
            onClick={(e) => { e.stopPropagation(); onMinimize(); }}
            className="p-1 hover:bg-gray-200 rounded text-gray-600 transition-colors"
          >
            <Minus size={14} />
          </button>
          {!isMobile && (
            <button 
                className="p-1 hover:bg-gray-200 rounded text-gray-600 transition-colors"
            >
                <Maximize2 size={14} />
            </button>
          )}
          <button 
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="p-1 hover:bg-red-100 hover:text-red-600 rounded text-gray-600 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden relative flex flex-col">
        {children}
      </div>

      {/* Resize Handle - Desktop only */}
      {!isMobile && (
        <div 
          className={`absolute bottom-0 w-4 h-4 cursor-nwse-resize z-50
            ${isRTL ? 'left-0 cursor-nesw-resize' : 'right-0'}`}
          onMouseDown={handleResizeStart}
        >
           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-full h-full text-gray-400 opacity-50">
             <path d="M21 15L15 21M21 8L8 21" />
           </svg>
        </div>
      )}
    </div>
  );
});