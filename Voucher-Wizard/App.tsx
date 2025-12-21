import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { WindowFrame } from './components/WindowFrame';
import { JournalVoucher } from './components/JournalVoucher';
import { LegacyJournalVoucher } from './components/LegacyJournalVoucher';
import { GenericVoucherRenderer } from './components/GenericVoucherRenderer';
import { VoucherTypeManager } from './components/VoucherTypeManager';
import { WindowState } from './types';
import { Layout, Save, Printer, Minus, X, Menu } from 'lucide-react';
import { LanguageProvider, useLanguage } from './LanguageContext';
import { VoucherProvider, useVouchers } from './VoucherContext';

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  windowId: string | null;
}

const AppContent = () => {
  const [windows, setWindows] = useState<WindowState[]>([]);
  const [activeWindowId, setActiveWindowId] = useState<string | null>(null);
  const [nextZIndex, setNextZIndex] = useState(10);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ visible: false, x: 0, y: 0, windowId: null });
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [isSidebarOpen, setIsSidebarOpen] = useState(!isMobile);
  
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const { isRTL, t } = useLanguage();
  const { getVoucher } = useVouchers();

  // Handle Resize for Mobile Detection
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) {
        setIsSidebarOpen(true);
      } else {
        setIsSidebarOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (contextMenu.visible && contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(prev => ({ ...prev, visible: false }));
      }
    };
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [contextMenu.visible]);

  const handleClose = useCallback((id: string) => {
    setWindows(prev => prev.filter(w => w.id !== id));
    setActiveWindowId(prevId => prevId === id ? null : prevId);
    setContextMenu(prev => ({ ...prev, visible: false }));
  }, []);

  const handleMinimize = useCallback((id: string) => {
    setWindows(prev => prev.map(w => 
      w.id === id ? { ...w, isMinimized: true } : w
    ));
    setActiveWindowId(null);
    setContextMenu(prev => ({ ...prev, visible: false }));
  }, []);

  const handleRestore = useCallback((id: string) => {
    setWindows(prev => prev.map(w => 
      w.id === id ? { ...w, isMinimized: false } : w
    ));
    setNextZIndex(prev => {
        setWindows(currentWindows => currentWindows.map(w => 
            w.id === id ? { ...w, zIndex: prev } : w
        ));
        return prev + 1;
    });
    setActiveWindowId(id);
    setContextMenu(prev => ({ ...prev, visible: false }));
  }, []);

  const handleFocus = useCallback((id: string) => {
    setActiveWindowId(currentActive => {
        if (currentActive === id) return currentActive;
        
        setNextZIndex(prevZ => {
            setWindows(currentWindows => currentWindows.map(w => 
                w.id === id ? { ...w, zIndex: prevZ } : w
            ));
            return prevZ + 1;
        });
        
        return id;
    });
  }, []);

  const openVoucher = useCallback((type: string) => {
    const newId = `voucher-${type.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
    let titleKey = type;
    let component: React.ReactNode;
    let initialWidth = 950;
    let initialHeight = 700;

    if (type === "Voucher Designer") {
      titleKey = "Voucher Designer";
      component = <VoucherTypeManager onExit={() => handleClose(newId)} />;
      // Slightly smaller than fullscreen to look like a modal popup
      initialWidth = 1100;
      initialHeight = 800;
    } else {
        // Check for Custom Vouchers First
        const customVoucher = getVoucher(type);

        if (customVoucher) {
            // USE THE NEW GENERIC RENDERER FOR CUSTOM TYPES
            titleKey = customVoucher.name;
            component = <GenericVoucherRenderer config={customVoucher} />;
        } else if (type === "Journal Voucher") {
            titleKey = "journalVoucher";
            component = <JournalVoucher title={titleKey} />;
        } else if (type === "Legacy Journal Voucher") {
            titleKey = "legacyJournalVoucher";
            component = <LegacyJournalVoucher title={titleKey} />;
        } else {
            // Fallback
            component = <JournalVoucher title={type} />;
        }
    }

    setWindows(currentWindows => {
        // Mobile: Full screen new window
        // Desktop: Cascading
        const offset = isMobile ? 0 : (currentWindows.length % 10) * 30; 
        
        const newWindow: WindowState = {
            id: newId,
            title: titleKey, 
            component: component,
            isOpen: true,
            isMinimized: false,
            zIndex: nextZIndex,
            x: isMobile ? 0 : 100 + offset, 
            y: isMobile ? 0 : 50 + offset,
            width: isMobile ? window.innerWidth : initialWidth,
            height: isMobile ? window.innerHeight - 80 : initialHeight 
        };
        return [...currentWindows, newWindow];
    });

    setActiveWindowId(newId);
    setNextZIndex(prev => prev + 1);
    
    // Auto-close sidebar on mobile after selection
    if (isMobile) {
      setIsSidebarOpen(false);
    }
  }, [nextZIndex, isMobile, getVoucher, handleClose]);

  const handleContextMenu = (e: React.MouseEvent, windowId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      visible: true,
      x: Math.min(e.clientX, window.innerWidth - 200),
      y: Math.min(e.clientY, window.innerHeight - 200),
      windowId
    });
  };

  const handleContextAction = (action: 'close' | 'minimize' | 'save' | 'print') => {
    if (!contextMenu.windowId) return;
    const id = contextMenu.windowId;

    switch (action) {
      case 'close':
        handleClose(id);
        break;
      case 'minimize':
        handleMinimize(id);
        break;
      case 'save':
        alert(`Simulating SAVE for window ID: ${id}`);
        setContextMenu(prev => ({ ...prev, visible: false }));
        break;
      case 'print':
        alert(`Simulating PRINT for window ID: ${id}`);
        setContextMenu(prev => ({ ...prev, visible: false }));
        break;
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[url('https://images.unsplash.com/photo-1497215728101-856f4ea42174?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center">
      
      {/* Mobile Menu Button */}
      {isMobile && !isSidebarOpen && (
        <button 
          onClick={() => setIsSidebarOpen(true)}
          className="absolute top-4 left-4 z-[50] p-2 bg-slate-900 text-white rounded-md shadow-lg"
        >
          <Menu size={24} />
        </button>
      )}

      {/* Sidebar Overlay for Mobile */}
      {isMobile && isSidebarOpen && (
        <div 
          className="absolute inset-0 bg-black/50 z-[55]"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
          ${isMobile ? 'absolute inset-y-0 left-0 z-[60] w-64 transform transition-transform duration-300' : 'relative z-[60] h-full shadow-2xl'}
          ${isMobile && !isSidebarOpen ? '-translate-x-full' : 'translate-x-0'}
      `}>
         <Sidebar 
           onOpenVoucher={openVoucher} 
           isMobile={isMobile}
           onClose={() => setIsSidebarOpen(false)}
         />
      </div>

      {/* Desktop Area */}
      <div className="flex-1 relative overflow-hidden">
        {/* Windows Layer */}
        {windows.map(win => (
          <div 
            key={win.id} 
            className={win.isMinimized ? 'hidden' : 'block'}
            style={{ zIndex: win.zIndex }}
          >
            <WindowFrame 
              title={t(win.title) || win.title} 
              isActive={activeWindowId === win.id}
              onClose={() => handleClose(win.id)}
              onMinimize={() => handleMinimize(win.id)}
              onFocus={() => handleFocus(win.id)}
              onContextMenu={(e) => handleContextMenu(e, win.id)}
              initialX={win.x}
              initialY={win.y}
              initialWidth={win.width}
              initialHeight={win.height}
              isMobile={isMobile}
            >
              {win.component}
            </WindowFrame>
          </div>
        ))}

        {/* Taskbar */}
        <div className="absolute bottom-4 left-4 right-4 h-14 bg-white/80 backdrop-blur-md rounded-2xl shadow-2xl border border-white/20 flex items-center px-4 gap-2 z-[100]">
          <div className="p-2 bg-blue-100 rounded-lg text-blue-700 mx-2 flex-shrink-0 hidden md:block">
            <Layout size={20} />
          </div>
          
          <div className="flex-1 flex items-center gap-2 overflow-x-auto no-scrollbar mask-linear px-2">
            {windows.map(win => (
              <button
                key={win.id}
                onClick={() => win.isMinimized ? handleRestore(win.id) : handleFocus(win.id)}
                onContextMenu={(e) => handleContextMenu(e, win.id)}
                className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg transition-all border select-none
                  ${!win.isMinimized && activeWindowId === win.id 
                    ? 'bg-white shadow text-gray-800 border-gray-200' 
                    : 'bg-white/30 border-transparent hover:bg-white/50 text-gray-600'}`}
              >
                <div className={`w-2 h-2 rounded-full ${activeWindowId === win.id ? 'bg-blue-500' : 'bg-gray-400'}`}></div>
                <span className="text-sm font-medium truncate max-w-[120px]">{t(win.title) || win.title}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Context Menu */}
        {contextMenu.visible && (
          <div 
            ref={contextMenuRef}
            className="fixed bg-white rounded-lg shadow-xl border border-gray-200 py-1 w-48 z-[9999] text-start"
            style={{ top: contextMenu.y, left: contextMenu.x }}
          >
            <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase border-b border-gray-100 mb-1">
              Actions
            </div>
            <button 
              onClick={() => handleContextAction('save')}
              className="w-full text-start px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2"
            >
              <Save size={14} className="rtl:rotate-0" /> {t('save')}
            </button>
            <button 
              onClick={() => handleContextAction('print')}
              className="w-full text-start px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2"
            >
              <Printer size={14} /> {t('print')}
            </button>
            <div className="h-px bg-gray-200 my-1"></div>
            <button 
              onClick={() => handleContextAction('minimize')}
              className="w-full text-start px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
            >
              <Minus size={14} /> {t('minimize')}
            </button>
             <button 
              onClick={() => handleContextAction('close')}
              className="w-full text-start px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
            >
              <X size={14} /> {t('close')}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

const App = () => {
  return (
    <LanguageProvider>
      <VoucherProvider>
        <AppContent />
      </VoucherProvider>
    </LanguageProvider>
  );
};

export default App;