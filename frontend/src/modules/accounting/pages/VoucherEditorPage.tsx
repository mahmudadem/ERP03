
import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useVoucherTypeDefinition } from '../../../hooks/useVoucherTypeDefinition';
import { DynamicVoucherRenderer } from '../../../designer-engine/components/DynamicVoucherRenderer';
import { accountingApi } from '../../../api/accountingApi';
import { Button } from '../../../components/ui/Button';

const VoucherEditorPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const typeCode = searchParams.get('type') || 'INV';
  const { definition, loading: defLoading, error: defError } = useVoucherTypeDefinition(typeCode);
  
  const [initialValues, setInitialValues] = useState<any>(null);
  const [dataLoading, setDataLoading] = useState(false);

  useEffect(() => {
    if (id && id !== 'new') {
      loadVoucherData(id);
    } else {
      setInitialValues({
        header: {
           date: new Date().toISOString(),
           currency: 'USD'
        },
        lines: []
      });
    }
  }, [id]);

  const loadVoucherData = async (voucherId: string) => {
    try {
      setDataLoading(true);
      const voucher = await accountingApi.getVoucher(voucherId);
      
      // Map API DTO to Renderer format
      setInitialValues({
        header: {
          ...voucher,
          // Extract header fields from root object
          date: voucher.date,
          currency: 'USD', // Mock, should come from API
        },
        lines: voucher.lines || []
      });
    } catch (err) {
      console.error(err);
      alert('Failed to load voucher data');
    } finally {
      setDataLoading(false);
    }
  };

  const handleSubmit = async (formData: any) => {
    try {
      // Map Renderer format to API DTO
      const payload = {
        companyId: 'cmp_123', // Context
        type: definition?.code || 'INV',
        date: formData.date,
        currency: formData.currency || 'USD',
        lines: formData.items.map((item: any) => ({
           accountId: 'acc_123', // Mock, normally selected in UI
           description: item.description,
           fxAmount: Number(item.fxAmount || item.amount),
           costCenterId: null
        }))
      };

      if (id === 'new') {
        await accountingApi.createVoucher(payload);
        alert('Voucher Created Successfully');
      } else {
        await accountingApi.updateVoucher(id!, payload);
        alert('Voucher Updated');
      }
      navigate('/accounting/vouchers');
    } catch (err: any) {
      console.error(err);
      alert(`Error: ${err.message}`);
    }
  };

  const handleApprove = async () => {
    if (!id || id === 'new') return;
    try {
      await accountingApi.approveVoucher(id);
      alert('Voucher Approved');
      navigate('/accounting/vouchers');
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  if (defLoading || dataLoading || !initialValues) {
    return <div className="p-8 text-center text-gray-500">Loading editor...</div>;
  }

  if (defError || !definition) {
    return (
      <div className="p-8 text-center text-red-500">
        Error loading definition: {defError || 'Unknown error'}
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      <div className="flex justify-between items-center">
        <div>
           <h1 className="text-2xl font-bold text-gray-800">
             {id === 'new' ? `New ${definition.name}` : `Edit ${definition.name}`}
           </h1>
           <p className="text-sm text-gray-500">
             {id !== 'new' && `ID: ${id}`}
           </p>
        </div>
        
        {id !== 'new' && (
           <Button onClick={handleApprove} variant="primary">Approve Voucher</Button>
        )}
      </div>

      <DynamicVoucherRenderer 
        definition={definition} 
        initialValues={initialValues}
        onSubmit={handleSubmit}
      />
    </div>
  );
};

export default VoucherEditorPage;
