import { accountingApi } from '../api/accountingApi';
import { errorHandler } from '../services/errorHandler';

export const useVoucherActions = () => {
  const saveVoucherInternal = async (data: any) => {
    // 1. Transform UI Data -> API Payload
    const payload = {
      ...data,
      // Header Mappings
      voucherNo: data.voucherNumber || data.voucherNo,
      description: data.description || data.notes, 
      formId: data.formId, 
      prefix: data.prefix, 
      
      // Line Items Mapping
      lines: (data.lines || []).map((line: any) => ({
        id: line.id && typeof line.id === 'string' ? line.id : undefined, 
        accountId: line.accountId || line.account,
        description: line.description || line.notes, 
        debitFx: Number(line.debitFx || line.debit || 0),
        creditFx: Number(line.creditFx || line.credit || 0),
        debitBase: Number(line.debitBase || line.debit || 0) * (Number(line.exchangeRate || line.parity || 1)),
        creditBase: Number(line.creditBase || line.credit || 0) * (Number(line.exchangeRate || line.parity || 1)),
        lineCurrency: line.lineCurrency || line.currency || 'USD',
        exchangeRate: Number(line.exchangeRate || line.parity || 1),
        costCenterId: line.costCenterId || line.category || null, 
      }))
    };
    
    if (payload.id && payload.id.toString().startsWith('voucher-')) {
       delete payload.id;
    }

    const cleanPayload = Object.entries(payload).reduce((acc, [key, value]) => {
      if (value !== '' && value !== undefined && value !== null) {
        acc[key] = value;
      }
      return acc;
    }, {} as any);
    
    let savedVoucher;
    if (cleanPayload.id && !cleanPayload.id.toString().startsWith('voucher-')) {
       await accountingApi.updateVoucher(cleanPayload.id, cleanPayload);
       savedVoucher = { ...cleanPayload, id: cleanPayload.id };
    } else {
       const res = await accountingApi.createVoucher(cleanPayload);
       savedVoucher = res;
    }
    
    // Dispatch global event for list refresh
    window.dispatchEvent(new CustomEvent('vouchers-updated'));
    
    return savedVoucher;
  };

  const handleSaveVoucher = async (windowId: string, data: any) => {
    try {
      await saveVoucherInternal(data);
      errorHandler.showSuccess('voucher_saved');
    } catch (error: any) {
      errorHandler.showError(error);
    }
  };

  const handleSubmitVoucher = async (windowId: string, data: any) => {
    try {
      const saved = await saveVoucherInternal(data);
      if (saved && saved.id) {
         await accountingApi.updateVoucher(saved.id, { status: 'pending' });
         errorHandler.showSuccess('voucher_submitted');
         window.dispatchEvent(new CustomEvent('vouchers-updated'));
      } else {
         throw new Error('Could not retrieve Voucher ID after save.');
      }
    } catch (error: any) {
       errorHandler.showError(error);
    }
  };

  return {
    handleSaveVoucher,
    handleSubmitVoucher
  };
};
