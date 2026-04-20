import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { salesApi } from '../api/salesApi';
import { purchasesApi } from '../api/purchasesApi';
import { errorHandler } from '../services/errorHandler';

export type DocumentType = 'SI' | 'SO' | 'DN' | 'SR' | 'PI' | 'PO' | 'GRN' | 'PR';

export interface DocumentActionContext {
  id: string;
  type: DocumentType;
  windowId: string;
}

export const useDocumentActions = () => {
  const { t } = useTranslation('common');
  const [isBusy, setIsBusy] = useState(false);

  // Generic wrapper to handle errors and loading state
  const performAction = async (
    actionName: string,
    id: string,
    actionFn: (id: string) => Promise<any>,
    successMessage?: string
  ) => {
    setIsBusy(true);
    try {
      const result = await actionFn(id);
      errorHandler.showSuccess(successMessage || t('actionSuccess', { action: actionName, defaultValue: `${actionName} performed successfully` }));
      return result;
    } catch (error: any) {
      errorHandler.showError(error);
      throw error;
    } finally {
      setIsBusy(false);
    }
  };

  const sales = {
    getSettings: () => salesApi.getSettings(),
    createInvoice: (payload: any) => performAction('Create Invoice', '', () => salesApi.createSI(payload)),
    updateInvoice: (id: string, payload: any) => performAction('Update Invoice', id, () => salesApi.updateSI(id, payload)),
    postInvoice: (id: string) => performAction('Post Invoice', id, salesApi.postSI),
    
    createOrder: (payload: any) => performAction('Create Order', '', () => salesApi.createSO(payload)),
    updateOrder: (id: string, payload: any) => performAction('Update Order', id, () => salesApi.updateSO(id, payload)),
    confirmOrder: (id: string) => performAction('Confirm Order', id, salesApi.confirmSO),
    cancelOrder: (id: string) => performAction('Cancel Order', id, salesApi.cancelSO),
    closeOrder: (id: string) => performAction('Close Order', id, salesApi.closeSO),
    
    createDeliveryNote: (payload: any) => performAction('Create Delivery Note', '', () => salesApi.createDN(payload)),
    postDeliveryNote: (id: string) => performAction('Post Delivery Note', id, salesApi.postDN),
    
    createReturn: (payload: any) => performAction('Create Return', '', () => salesApi.createReturn(payload)),
    postReturn: (id: string) => performAction('Post Return', id, salesApi.postReturn),
  };

  const purchases = {
    getSettings: () => purchasesApi.getSettings(),
    createInvoice: (payload: any) => performAction('Create Invoice', '', () => purchasesApi.createPI(payload)),
    updateInvoice: (id: string, payload: any) => performAction('Update Invoice', id, () => purchasesApi.updatePI(id, payload)),
    postInvoice: (id: string) => performAction('Post Invoice', id, purchasesApi.postPI),
    unpostInvoice: (id: string) => performAction('Unpost Invoice', id, purchasesApi.unpostPI),
    
    createOrder: (payload: any) => performAction('Create Order', '', () => purchasesApi.createPO(payload)),
    updateOrder: (id: string, payload: any) => performAction('Update Order', id, () => purchasesApi.updatePO(id, payload)),
    confirmOrder: (id: string) => performAction('Confirm Order', id, purchasesApi.confirmPO),
    cancelOrder: (id: string) => performAction('Cancel Order', id, purchasesApi.cancelPO),
    closeOrder: (id: string) => performAction('Close Order', id, purchasesApi.closePO),
    
    createReceipt: (payload: any) => performAction('Create Receipt', '', () => purchasesApi.createGRN(payload)),
    updateReceipt: (id: string, payload: any) => performAction('Update Receipt', id, () => purchasesApi.updateGRN(id, payload)),
    postReceipt: (id: string) => performAction('Post Receipt', id, purchasesApi.postGRN),
    unpostReceipt: (id: string) => performAction('Unpost Receipt', id, purchasesApi.unpostGRN),
    
    createReturn: (payload: any) => performAction('Create Return', '', () => purchasesApi.createReturn(payload)),
    updateReturn: (id: string, payload: any) => performAction('Update Return', id, () => purchasesApi.updateReturn(id, payload)),
    postReturn: (id: string) => performAction('Post Return', id, purchasesApi.postReturn),
    unpostReturn: (id: string) => performAction('Unpost Return', id, purchasesApi.unpostReturn),
  };

  return {
    isBusy,
    sales,
    purchases,
    // Add more if needed
  };
};
