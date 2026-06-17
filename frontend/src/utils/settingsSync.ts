import { useEffect } from 'react';

// Setup global broadcast channel for tab/window settings sync
const bc = new BroadcastChannel('erp_company_settings_sync');

/**
 * Notifies the application (both current tab and other tabs) that company settings have changed.
 * This triggers contexts and pages to re-fetch settings from the backend.
 * 
 * @param companyId The ID of the company whose settings changed
 */
export const notifySettingsChanged = (companyId: string) => {
  console.debug('[SettingsSync] Dispatching settings updated event locally and broadcasting', { companyId });
  
  // Dispatch local CustomEvent for components in the same tab/window
  window.dispatchEvent(
    new CustomEvent('erp-settings-updated', { detail: { companyId } })
  );
  
  // Broadcast message to other tabs/windows
  try {
    bc.postMessage({ type: 'SETTINGS_UPDATED', companyId });
  } catch (e) {
    console.warn('[SettingsSync] Broadcast failed', e);
  }
};

/**
 * Subscribes a callback to settings change events.
 * Listens to both local custom events and cross-tab broadcast messages.
 * Returns an unsubscribe cleanup function.
 * 
 * @param callback Function to run when settings are updated
 */
export const subscribeToSettingsChanges = (callback: (companyId: string) => void) => {
  const handleLocal = (e: Event) => {
    const customEvent = e as CustomEvent;
    const companyId = customEvent.detail?.companyId || '';
    callback(companyId);
  };
  
  const handleBroadcast = (event: MessageEvent) => {
    if (event.data?.type === 'SETTINGS_UPDATED') {
      const companyId = event.data.companyId || '';
      callback(companyId);
    }
  };
  
  window.addEventListener('erp-settings-updated', handleLocal);
  bc.addEventListener('message', handleBroadcast);
  
  return () => {
    window.removeEventListener('erp-settings-updated', handleLocal);
    bc.removeEventListener('message', handleBroadcast);
  };
};

/**
 * Custom hook to listen to settings updates in React components.
 * 
 * @param callback Function to run when settings change
 * @param deps Dependencies for the callback effect
 */
export const useOnSettingsChanged = (callback: (companyId: string) => void, deps: React.DependencyList = []) => {
  useEffect(() => {
    return subscribeToSettingsChanges(callback);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
};
