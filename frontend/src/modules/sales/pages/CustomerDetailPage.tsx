
import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PartyMasterCard from '../../shared/components/PartyMasterCard';

const CustomerDetailPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const handleClose = () => {
    navigate('/sales/customers');
  };

  const handleSaved = () => {
    navigate('/sales/customers');
  };

  return (
    <div className="h-full bg-slate-50 dark:bg-slate-950">
      <PartyMasterCard 
        partyId={id} 
        onClose={handleClose}
        onSaved={handleSaved}
        isWindow={false}
        role="CUSTOMER"
      />
    </div>
  );
};

export default CustomerDetailPage;
