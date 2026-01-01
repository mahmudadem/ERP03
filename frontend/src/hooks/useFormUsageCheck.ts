import { useState, useEffect } from 'react';
import { accountingApi } from '../api/accountingApi';

/**
 * Hook to check if a voucher form is being used (has vouchers)
 */
export const useFormUsageCheck = (formId: string | undefined) => {
  const [isInUse, setIsInUse] = useState<boolean>(false);
  const [voucherCount, setVoucherCount] = useState<number>(0);
  const [isChecking, setIsChecking] = useState<boolean>(false);

  useEffect(() => {
    if (!formId) {
      setIsInUse(false);
      setVoucherCount(0);
      return;
    }

    const checkUsage = async () => {
      setIsChecking(true);
      try {
        // Query vouchers with this formId
        const response = await accountingApi.listVouchers({
          formId,
          page: 1,
          pageSize: 1, // Just need to know if any exist
        });
        
        // Handle response structure (it returns { items: [], total: 0 } or just array)
        const vouchers = (response as any).items || (Array.isArray(response) ? response : []);
        const count = typeof (response as any).total === 'number' ? (response as any).total : vouchers.length;
        
        setVoucherCount(count);
        setIsInUse(count > 0);
      } catch (error) {
        console.error('Error checking form usage:', error);
        setIsInUse(false);
        setVoucherCount(0);
      } finally {
        setIsChecking(false);
      }
    };

    checkUsage();
    setIsInUse(false);
    setVoucherCount(0);
  }, [formId]);

  return { isInUse, voucherCount, isChecking };
};
