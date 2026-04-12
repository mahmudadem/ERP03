
import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PartyMasterCard from '../../shared/components/PartyMasterCard';

const VendorDetailPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const handleClose = () => {
    navigate('/purchases/vendors');
  };

  const handleSaved = () => {
    navigate('/purchases/vendors');
  };

  return (
    <div className="h-full bg-slate-50 dark:bg-slate-950">
      <PartyMasterCard 
        partyId={id} 
        onClose={handleClose}
        onSaved={handleSaved}
        isWindow={false}
        role="VENDOR"
      />
    </div>
  );
};

export default VendorDetailPage;
