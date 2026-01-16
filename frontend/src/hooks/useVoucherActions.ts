import { accountingApi } from '../api/accountingApi';
import { errorHandler } from '../services/errorHandler';

/**
 * useVoucherActions hook
 * 
 * Handles voucher save and submit operations.
 * Transforms UI data to V2 API payload format.
 */
export const useVoucherActions = () => {
  const saveVoucherInternal = async (data: any) => {
    // 1. Get base currency from company settings or default
    const baseCurrency = data.baseCurrency || data.currency || 'USD';
    const exchangeRate = Number(data.exchangeRate) || 1;
    
    // 2. Transform UI Data -> V2 API Payload
    const payload = {
      ...data,
      // Header Mappings
      voucherNo: data.voucherNumber || data.voucherNo,
      description: data.description || data.notes, 
      formId: data.formId, 
      prefix: data.prefix,
      sourceModule: data.sourceModule || 'accounting', // Track voucher origin
      baseCurrency: baseCurrency,
      exchangeRate: exchangeRate,
      
      // Line Items Mapping - Strict V2 Format
      lines: (data.lines || []).map((line: any) => {
        // Strict V2 format: ensure side and amount are set correctly from UI state
        const side = line.side || (Number(line.debit || 0) > 0 ? 'Debit' : 'Credit');
        const fxAmount = Math.abs(Number(line.amount || line.debit || line.credit || 0));
        
        let baseAmount = Math.abs(Number(line.baseAmount || 0));
        if (baseAmount === 0) {
          baseAmount = fxAmount * exchangeRate;
        }
        
        // Line currency
        const lineCurrency = line.currency || line.lineCurrency || data.currency || baseCurrency;
        
        return {
          id: line.id && typeof line.id === 'string' ? line.id : undefined,
          accountId: line.accountId || line.account,
          side: side,
          amount: fxAmount,
          currency: lineCurrency,
          baseAmount: baseAmount,
          baseCurrency: baseCurrency,
          exchangeRate: Number(line.exchangeRate || line.parity || exchangeRate),
          notes: line.description || line.notes,
          costCenterId: line.costCenterId || line.category || null,
          metadata: line.metadata || {}
        };
      })
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
    await saveVoucherInternal(data);
    errorHandler.showSuccess('SAVE');
  };

  const handleSubmitVoucher = async (windowId: string, data: any) => {
    const saved = await saveVoucherInternal(data);
    if (saved && saved.id) {
       await accountingApi.sendVoucherToApproval(saved.id);
       errorHandler.showSuccess('voucher_submitted');
       window.dispatchEvent(new CustomEvent('vouchers-updated'));
    } else {
       throw new Error('Could not retrieve Voucher ID after save.');
    }
  };

  const handleApproveVoucher = async (windowId: string, id: string) => {
    await accountingApi.approveVoucher(id);
    errorHandler.showSuccess('voucher_approved');
    window.dispatchEvent(new CustomEvent('vouchers-updated'));
  };

  const handleRejectVoucher = async (windowId: string, id: string) => {
    await accountingApi.rejectVoucher(id);
    errorHandler.showSuccess('voucher_rejected');
    window.dispatchEvent(new CustomEvent('vouchers-updated'));
  };

  const handleConfirmVoucher = async (windowId: string, id: string) => {
    await accountingApi.confirmVoucherCustody(id);
    errorHandler.showSuccess('custody_confirmed');
    window.dispatchEvent(new CustomEvent('vouchers-updated'));
  };

  return {
    handleSaveVoucher,
    handleSubmitVoucher,
    handleApproveVoucher,
    handleRejectVoucher,
    handleConfirmVoucher
  };
};
