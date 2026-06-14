import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Spinner } from '../components/ui/Spinner';

export interface LoaderTask {
  id: string;
  message: string;
  timestamp: number;
}

interface GlobalLoaderContextValue {
  startLoading: (id: string, message: string) => void;
  stopLoading: (id: string) => void;
  isLoading: boolean;
  currentMessage: string | null;
}

const GlobalLoaderContext = createContext<GlobalLoaderContextValue | null>(null);

export const GlobalLoaderProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t } = useTranslation('common');
  const [tasks, setTasks] = useState<LoaderTask[]>([]);

  const startLoading = useCallback((id: string, message: string) => {
    setTasks((prev) => {
      const existing = prev.find((t) => t.id === id);
      if (existing && existing.message === message) return prev;
      
      const filtered = prev.filter((t) => t.id !== id);
      return [...filtered, { id, message, timestamp: Date.now() }];
    });
  }, []);

  const stopLoading = useCallback((id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const isLoading = tasks.length > 0;
  
  // The most recently added task is at the end of the array
  const currentTask = tasks.length > 0 ? tasks[tasks.length - 1] : null;
  const currentMessage = currentTask ? currentTask.message : null;

  const value = useMemo(
    () => ({
      startLoading,
      stopLoading,
      isLoading,
      currentMessage,
    }),
    [startLoading, stopLoading, isLoading, currentMessage]
  );

  return (
    <GlobalLoaderContext.Provider value={value}>
      {children}
      
      {/* Global Overlay */}
      {isLoading && (
        <div className="fixed inset-0 z-[90] flex flex-col items-center justify-center bg-slate-50/80 backdrop-blur-sm dark:bg-slate-900/80 transition-all duration-200">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 flex flex-col items-center max-w-sm w-full mx-4 border border-slate-100 dark:border-slate-700">
            <div className="relative">
              <div className="absolute inset-0 bg-primary-100 dark:bg-primary-900/30 rounded-full animate-ping opacity-75"></div>
              <div className="relative bg-white dark:bg-slate-800 rounded-full p-4 shadow-sm border border-slate-100 dark:border-slate-700">
                <Spinner size="lg" />
              </div>
            </div>
            
            <h3 className="mt-6 text-lg font-semibold text-slate-900 dark:text-white">
              {t('auth.loadingResource', 'Loading')}
            </h3>
            
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 text-center animate-pulse">
              {currentMessage || 'Please wait...'}
            </p>

            {tasks.length > 1 && (
              <div className="mt-4 flex gap-1 items-center justify-center">
                {tasks.map((_, i) => (
                  <div 
                    key={i} 
                    className={`h-1.5 rounded-full transition-all duration-300 ${i === tasks.length - 1 ? 'w-4 bg-primary-500' : 'w-1.5 bg-slate-300 dark:bg-slate-600'}`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </GlobalLoaderContext.Provider>
  );
};

export const useGlobalLoader = () => {
  const context = useContext(GlobalLoaderContext);
  if (!context) {
    throw new Error('useGlobalLoader must be used within a GlobalLoaderProvider');
  }
  return context;
};

export const useGlobalLoaderTask = (id: string, message: string, isLoadingCondition: boolean) => {
  const { startLoading, stopLoading } = useGlobalLoader();
  
  useEffect(() => {
    if (isLoadingCondition) {
      startLoading(id, message);
    } else {
      stopLoading(id);
    }
    
    return () => stopLoading(id);
  }, [id, message, isLoadingCondition, startLoading, stopLoading]);
};

